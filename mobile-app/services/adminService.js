import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import { createManagedAuthUser } from '../api/authApi';
import { db } from '../config/firebase';
import {
  buildCreditCardSnapshot,
  buildInitialMarketStatusHistory,
  listUserMarketFavorites,
  listVisibleMarketCampaigns,
  normalizeMarketOrder,
} from './marketService';
import { createAppNotification } from './notificationService';
import { nowIso, sortByDateDesc } from '../utils/date';

function toNumber(value, fallback = 0) {
  if (value === '' || value === null || typeof value === 'undefined') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function listAll(collectionName, constraints = []) {
  const snapshot = constraints.length
    ? await getDocs(query(collection(db, collectionName), ...constraints))
    : await getDocs(collection(db, collectionName));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function normalizeAdminCartItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const quantity = Math.max(1, toNumber(item.quantity, 1));
      const unitPrice = toNumber(item.unitPrice ?? item.price, 0);
      return {
        productId: item.productId || item.id || '',
        productName: String(item.productName || item.name || '').trim(),
        quantity,
        unitPrice,
        lineTotal: unitPrice * quantity,
      };
    })
    .filter((item) => item.productId && item.productName && item.quantity > 0);
}

function getAdminOrderTitle(items) {
  if (!items.length) return 'Market siparisi';
  if (items.length === 1) {
    return `${items[0].productName}${items[0].quantity > 1 ? ` x${items[0].quantity}` : ''}`;
  }
  return `${items[0].productName} +${items.length - 1} urun`;
}

async function notifySuperAdminsAboutAdminOrder(orderTitle, buyerName, orderId, buyerId) {
  const superAdmins = await listAll('users', [where('role', '==', 'superadmin')]);
  await Promise.all(superAdmins.map((user) => createAppNotification({
    userId: user.id,
    title: 'Yeni market siparisi',
    message: `${buyerName || 'Admin'} tarafindan ${orderTitle} siparisi olusturuldu.`,
    type: 'market_order',
    data: { orderId, buyerId },
  }).catch(() => null)));
}

function parseDateValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeDateToStart(value) {
  const date = parseDateValue(value);
  if (!date) return null;
  const normalized = new Date(date.getTime());
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function getDaysUntilDate(value) {
  const target = normalizeDateToStart(value);
  if (!target) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getAdminStudentInstallments(student) {
  if (Array.isArray(student?.installments) && student.installments.length) {
    return student.installments;
  }

  const installmentCount = Math.max(1, toNumber(student?.installmentCount, 1));
  const totalAmount = toNumber(student?.totalAmount, 0);
  const baseAmount = installmentCount > 0 ? totalAmount / installmentCount : 0;

  return Array.from({ length: installmentCount }, (_, index) => ({
    installmentNumber: index + 1,
    amount: index === installmentCount - 1 ? totalAmount - baseAmount * index : baseAmount,
    dueDate: '',
    paidAmount: 0,
    lessonLabel: '',
  }));
}

function buildInstallmentAlerts(students, branches, schedules) {
  return students
    .flatMap((student) => {
      const branch = branches.find((item) => item.id === student.branchId);
      const schedule = schedules.find((item) => item.id === student.scheduleId);
      return getAdminStudentInstallments(student)
        .map((installment) => {
          const amount = toNumber(installment.amount, 0);
          const paidAmount = toNumber(installment.paidAmount, 0);
          const remainingAmount = Math.max(0, amount - paidAmount);
          const daysUntil = getDaysUntilDate(installment.dueDate);
          if (!installment.dueDate || remainingAmount <= 0.009 || daysUntil === null || daysUntil > 3) {
            return null;
          }

          return {
            studentId: student.id,
            studentName: [student.name, student.surname].filter(Boolean).join(' ') || 'Bilinmiyor',
            installmentNumber: installment.installmentNumber,
            dueDate: installment.dueDate,
            daysUntil,
            remainingAmount,
            lessonLabel: installment.lessonLabel || '',
            branchName: branch?.name || 'Bilinmiyor',
            scheduleName: schedule?.time || '-',
          };
        })
        .filter(Boolean);
    })
    .sort((left, right) => left.daysUntil - right.daysUntil);
}

function getTrainerReviewAverage(review) {
  const scores = Object.values(review?.questionScores || {})
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5);
  if (!scores.length) return null;
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

function getTrainerReviewStats(trainer, reviews) {
  const matchingReviews = reviews.filter((review) => {
    const trainerIds = [trainer?.id, trainer?.uid].filter(Boolean);
    const reviewIds = [review?.trainerDocId, review?.trainerId].filter(Boolean);
    return trainerIds.some((value) => reviewIds.includes(value));
  });
  const averages = matchingReviews.map((review) => getTrainerReviewAverage(review)).filter(Number.isFinite);
  return {
    count: averages.length,
    average: averages.length ? averages.reduce((sum, value) => sum + value, 0) / averages.length : null,
    generalCount: matchingReviews.filter((review) => review.scopeType === 'general').length,
    lessonCount: matchingReviews.filter((review) => review.scopeType === 'lesson').length,
  };
}

function normalizeScheduleTrainerAssignments(schedule, trainers) {
  if (Array.isArray(schedule?.trainerAssignments) && schedule.trainerAssignments.length) {
    return schedule.trainerAssignments.map((assignment, index) => {
      const linkedTrainer = trainers.find((trainer) => trainer.id === assignment.trainerDocId || trainer.uid === assignment.trainerId || trainer.uid === assignment.trainerName || trainer.id === assignment.trainerName);
      const resolvedTrainerName = linkedTrainer?.name || assignment.trainerName;
      return {
        trainerId: assignment.trainerId,
        trainerDocId: assignment.trainerDocId,
        trainerName:
          resolvedTrainerName ||
          trainers.find((trainer) => trainer.id === assignment.trainerDocId || trainer.uid === assignment.trainerId)?.name ||
          'Bilinmiyor',
        role: assignment.role || (index === 0 ? 'head' : 'assistant'),
        trainerRate: toNumber(assignment.trainerRate, 0),
        trainerPaymentDetails: Array.isArray(assignment.trainerPaymentDetails) ? assignment.trainerPaymentDetails : [],
        trainerPaymentStatus: assignment.trainerPaymentStatus === 'paid' ? 'paid' : 'pending',
        trainerPaidLessonCount: toNumber(assignment.trainerPaidLessonCount, 0),
      };
    });
  }

  const fallbackTrainer = trainers.find((trainer) => trainer.id === schedule?.trainerDocId || trainer.uid === schedule?.trainerId);
  if (!fallbackTrainer && !schedule?.trainerId) {
    return [];
  }

  return [
    {
      trainerId: schedule?.trainerId || fallbackTrainer?.uid || '',
      trainerDocId: fallbackTrainer?.id || '',
      trainerName: fallbackTrainer?.name || 'Bilinmiyor',
      role: 'head',
      trainerRate: toNumber(schedule?.trainerRate, 0),
      trainerPaymentDetails: Array.isArray(schedule?.trainerPaymentDetails) ? schedule.trainerPaymentDetails : [],
      trainerPaymentStatus: schedule?.trainerPaymentStatus === 'paid' ? 'paid' : 'pending',
      trainerPaidLessonCount: toNumber(schedule?.trainerPaidLessonCount, 0),
    },
  ];
}

function summarizeSchedulePayments(schedule, trainers) {
  const assignments = normalizeScheduleTrainerAssignments(schedule, trainers);
  const totalLessons = Math.max(1, toNumber(schedule?.lessonsCount, 1));
  const paidLessons = assignments.reduce((sum, assignment) => {
    const paidCount = assignment.trainerPaymentDetails.filter((item) => item?.status === 'paid').length;
    return sum + paidCount;
  }, 0);
  return {
    assignments,
    totalLessons: totalLessons * Math.max(1, assignments.length),
    paidLessons,
    pendingLessons: Math.max(totalLessons * Math.max(1, assignments.length) - paidLessons, 0),
  };
}

function mapDayLabel(dayKey) {
  const labels = {
    monday: 'Pazartesi',
    tuesday: 'Sali',
    wednesday: 'Carsamba',
    thursday: 'Persembe',
    friday: 'Cuma',
    saturday: 'Cumartesi',
    sunday: 'Pazar',
  };
  return labels[dayKey] || dayKey || '-';
}

function calculateLessonDatesFromStart(startDate, scheduleDays, lessonCount) {
  const map = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  const targetDays = (scheduleDays || []).map((day) => map[day]).filter((day) => typeof day === 'number');
  const uniqueDays = [...new Set(targetDays.length ? targetDays : [1])];
  const dates = [];
  const cursor = new Date(startDate.getTime());
  cursor.setHours(0, 0, 0, 0);
  let guard = 0;
  while (dates.length < lessonCount && guard < 4000) {
    if (uniqueDays.includes(cursor.getDay())) {
      dates.push(new Date(cursor.getTime()));
    }
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return dates;
}

function getSchedulePostponements(schedule) {
  if (Array.isArray(schedule?.postponements)) {
    return schedule.postponements.filter(Boolean);
  }

  const fallbackCount = Number(schedule?.postponementCount || 0);
  return Number.isFinite(fallbackCount) && fallbackCount > 0
    ? Array.from({ length: fallbackCount }, (_, index) => ({ id: `legacy_${index + 1}` }))
    : [];
}

function getSchedulePostponementCount(schedule) {
  return getSchedulePostponements(schedule).length;
}

function getScheduleLessonCount(schedule) {
  const lessonsCount = Number(schedule?.lessonsCount);
  return Number.isFinite(lessonsCount) && lessonsCount > 0 ? lessonsCount : 1;
}

function getScheduleLessonType(schedule) {
  return schedule?.lessonType === 'private' ? 'private' : 'group';
}

function getAttendanceRecordTimestamp(record) {
  if (!record) return 0;

  const values = [record.updatedAt, record.createdAt, record.date];
  for (const value of values) {
    const parsedDate = parseDateValue(value);
    if (parsedDate) {
      return parsedDate.getTime();
    }
  }

  return 0;
}

function buildAttendanceLessonCountMap(records = []) {
  const latestRecordMap = {};
  const latestTimestampMap = {};

  records.forEach((record) => {
    const lessonNumber = Number(record?.lessonNumber);
    if (!record?.studentId || !record?.scheduleId || !Number.isFinite(lessonNumber)) {
      return;
    }

    const lessonKey = `${record.studentId}_${record.scheduleId}_${lessonNumber}`;
    const recordTimestamp = getAttendanceRecordTimestamp(record);
    if (!Object.prototype.hasOwnProperty.call(latestTimestampMap, lessonKey) || recordTimestamp >= latestTimestampMap[lessonKey]) {
      latestTimestampMap[lessonKey] = recordTimestamp;
      latestRecordMap[lessonKey] = record;
    }
  });

  return Object.values(latestRecordMap).reduce((accumulator, record) => {
    const progressKey = `${record.studentId}_${record.scheduleId}`;
    accumulator[progressKey] = (accumulator[progressKey] || 0) + 1;
    return accumulator;
  }, {});
}

function getFinanceDateRange(rangePreset = 'week') {
  if (rangePreset === 'all') {
    return null;
  }

  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end.getTime());

  switch (rangePreset) {
    case 'week':
      start.setDate(start.getDate() - 6);
      break;
    case 'twoWeeks':
      start.setDate(start.getDate() - 13);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'twoMonths':
      start.setMonth(start.getMonth() - 2);
      break;
    case 'threeMonths':
      start.setMonth(start.getMonth() - 3);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      start.setDate(start.getDate() - 6);
      break;
  }

  start.setHours(0, 0, 0, 0);
  return { start, end, preset: rangePreset };
}

function isDateInFinanceRange(value, range) {
  if (!range) {
    return true;
  }

  const date = parseDateValue(value);
  return Boolean(date && date >= range.start && date <= range.end);
}

function getFinanceRecordDate(record) {
  if (!record) {
    return null;
  }

  return parseDateValue(record.timestamp || record.date || record.createdAt || record.updatedAt);
}

function resolveFinanceBranchId(record, student = null) {
  return record?.branchId || record?.studentBranchId || student?.branchId || 'unknown';
}

function resolveFinanceScheduleId(record, student = null) {
  return record?.scheduleId || record?.studentScheduleId || student?.scheduleId || 'unknown';
}

function isBranchLevelIncomeRecord(income) {
  const scheduleId = String(income?.scheduleId || '').trim();
  return !scheduleId || scheduleId === 'unknown';
}

function doesIncomeMatchFinanceDetail(income, branchId, scheduleId) {
  const incomeBranchId = resolveFinanceBranchId(income);
  if (incomeBranchId !== branchId) {
    return false;
  }

  const incomeScheduleId = resolveFinanceScheduleId(income);
  return incomeScheduleId === scheduleId || isBranchLevelIncomeRecord(income);
}

function createFinanceScheduleEntry(scheduleId, schedules) {
  const schedule = schedules.find((item) => item.id === scheduleId);
  return {
    scheduleId,
    scheduleName: schedule ? `${schedule.time} (${schedule.lessonsCount || 1} Ders)` : 'Bilinmiyor',
    turnover: 0,
    income: 0,
    paymentIncome: 0,
    extraIncome: 0,
    expense: 0,
    manualExpense: 0,
    salaryExpense: 0,
    profit: 0,
    payments: [],
    incomes: [],
    expenses: [],
    salaryDetails: [],
  };
}

function ensureFinanceBranchEntry(branchData, branchId, branches) {
  if (!branchData[branchId]) {
    branchData[branchId] = {
      branchId,
      branchName: branches.find((branch) => branch.id === branchId)?.name || 'Bilinmiyor',
      schedules: {},
      totalTurnover: 0,
      totalIncome: 0,
      totalExpense: 0,
      totalManualExpense: 0,
      totalSalaryExpense: 0,
      totalProfit: 0,
    };
  }
  return branchData[branchId];
}

function ensureFinanceScheduleEntry(branchData, branchId, scheduleId, branches, schedules) {
  const branchEntry = ensureFinanceBranchEntry(branchData, branchId, branches);
  if (!branchEntry.schedules[scheduleId]) {
    branchEntry.schedules[scheduleId] = createFinanceScheduleEntry(scheduleId, schedules);
  }
  return branchEntry.schedules[scheduleId];
}

function buildVisibleFinanceBranchData(branchData, branchFilter, scheduleFilter) {
  return Object.entries(branchData).reduce((accumulator, [branchId, branch]) => {
    if (branchFilter && branchId !== branchFilter) {
      return accumulator;
    }

    const visibleSchedules = Object.entries(branch.schedules).reduce((scheduleAccumulator, [scheduleId, schedule]) => {
      if (scheduleFilter && scheduleId !== scheduleFilter) {
        return scheduleAccumulator;
      }
      scheduleAccumulator[scheduleId] = schedule;
      return scheduleAccumulator;
    }, {});

    if (!Object.keys(visibleSchedules).length) {
      return accumulator;
    }

    const totals = Object.values(visibleSchedules).reduce((summary, schedule) => {
      summary.totalTurnover += schedule.turnover;
      summary.totalIncome += schedule.income;
      summary.totalExpense += schedule.expense;
      summary.totalManualExpense += schedule.manualExpense;
      summary.totalSalaryExpense += schedule.salaryExpense;
      return summary;
    }, {
      totalTurnover: 0,
      totalIncome: 0,
      totalExpense: 0,
      totalManualExpense: 0,
      totalSalaryExpense: 0,
    });

    accumulator[branchId] = {
      ...branch,
      schedules: visibleSchedules,
      ...totals,
      totalProfit: totals.totalIncome - totals.totalExpense,
    };
    return accumulator;
  }, {});
}

function calculateScheduleTrainerSalaryExpense(schedule, range = null) {
  const assignments = normalizeScheduleTrainerAssignments(schedule, []);
  const details = assignments.flatMap((assignment) => {
    const trainerRate = Number(assignment?.trainerRate);
    if (!Number.isFinite(trainerRate) || trainerRate <= 0) {
      return [];
    }

    const paymentDetails = Array.isArray(assignment?.trainerPaymentDetails) ? assignment.trainerPaymentDetails : [];
    const paidLessons = paymentDetails.filter((item) => {
      if (item?.status !== 'paid') {
        return false;
      }
      if (!range) {
        return true;
      }
      const paidDate = parseDateValue(item?.paidAt || item?.updatedAt || schedule?.compensationUpdatedAt);
      return paidDate && paidDate >= range.start && paidDate <= range.end;
    });

    if (!paidLessons.length) {
      return [];
    }

    return [{
      trainerId: assignment.trainerId,
      trainerDocId: assignment.trainerDocId,
      trainerName: assignment.trainerName || 'Bilinmiyor',
      paidLessons: paidLessons.length,
      trainerRate,
      amount: trainerRate * paidLessons.length,
    }];
  });

  return {
    total: details.reduce((sum, item) => sum + item.amount, 0),
    details,
  };
}

function getAdminTrainerIdentitySet(trainers) {
  const trainerIds = new Set();

  trainers.forEach((trainer) => {
    if (trainer.id) trainerIds.add(trainer.id);
    if (trainer.uid) trainerIds.add(trainer.uid);
  });

  return trainerIds;
}

function getAdminStandardScope(standard) {
  if (standard.scopeType) return standard.scopeType;
  if (standard.adminId) return 'admin';
  if (standard.trainerId) return 'trainer';
  return 'global';
}

function cleanAdminStandardDocumentTitle(value) {
  const rawTitle = String(value || '').trim();
  if (!rawTitle) return 'BARAJ';

  const upperTitle = rawTitle.toLocaleUpperCase('tr-TR')
    .replace(/\b\d{1,2}\s*[-/]\s*\d{1,2}\s*YAŞ\b/g, ' ')
    .replace(/\b\d{1,2}\s+\d{1,2}\s*YAŞ\b/g, ' ')
    .replace(/\b[A-ZÇĞİÖŞÜ]+\s+ANISINA\b/g, ' ')
    .replace(/\bARENA\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const priorityMarkers = ['ULUSAL GELİŞİM LİGİ', 'TÜRKİYE FİNALİ', 'TURKIYE FINALI', 'ANALİG', 'ANALIG', 'OKUL SPORLARI', 'MİLLİ TAKIM', 'MILLI TAKIM'];
  const foundIndexes = priorityMarkers
    .map((marker) => upperTitle.indexOf(marker))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right);

  return (foundIndexes.length ? upperTitle.slice(foundIndexes[0]) : upperTitle).replace(/\s+/g, ' ').trim() || 'BARAJ';
}

function getAdminReadableStandardTitle(standard) {
  const year = standard.birthYear ? String(standard.birthYear) : '';
  const eventTitle = cleanAdminStandardDocumentTitle(standard.name || standard.groupLabel || '');
  const poolLabel = standard.poolType ? `${standard.poolType} metre` : '';
  const categoryLabel = standard.category ? String(standard.category).toLocaleLowerCase('tr-TR') : '';
  return [year, eventTitle, poolLabel, categoryLabel].filter(Boolean).join(' ').trim();
}

function getAdminStandardMeta(standard) {
  const scope = getAdminStandardScope(standard);
  return scope === 'global' ? 'Super Admin' : scope === 'admin' ? 'Kulup Baraji' : 'Eski Antrenor Kaydi';
}

function isStandardVisibleToAdmin(adminId, standard) {
  const scopeType = getAdminStandardScope(standard);
  if (scopeType === 'global') return true;
  if (scopeType === 'admin') return standard?.adminId === adminId;
  return false;
}

export async function getAdminDashboardData(adminId) {
  const [branches, trainers, schedules, students, clubProfile] = await Promise.all([
    listAll('branches', [where('adminId', '==', adminId)]),
    listAll('trainers', [where('adminId', '==', adminId)]),
    listAll('schedules', [where('adminId', '==', adminId)]),
    listAll('students', [where('adminId', '==', adminId)]),
    getDoc(doc(db, 'clubProfiles', adminId)),
  ]);

  const totalPaid = students.reduce((sum, student) => sum + toNumber(student.totalPaid, 0), 0);
  const recentStudents = sortByDateDesc(students).slice(0, 5).map((student) => ({
    ...student,
    fullName: [student.name, student.surname].filter(Boolean).join(' '),
    branchName: branches.find((branch) => branch.id === student.branchId)?.name || '-',
  }));

  return {
    stats: [
      { label: 'Toplam Sube', value: branches.length },
      { label: 'Toplam Antrenor', value: trainers.length },
      { label: 'Toplam Ogrenci', value: students.length },
      { label: 'Tahsilat', value: `₺${totalPaid.toFixed(2)}` },
    ],
    recentStudents,
    installmentAlerts: buildInstallmentAlerts(students, branches, schedules).slice(0, 8),
    clubProfile: clubProfile.exists() ? clubProfile.data() : null,
  };
}

export async function getAdminOrganizationOverview(adminId) {
  const [clubProfile, secretaries, branches, trainers, reviews] = await Promise.all([
    getDoc(doc(db, 'clubProfiles', adminId)),
    listAll('users', [where('adminId', '==', adminId), where('role', '==', 'secretary')]),
    listAll('branches', [where('adminId', '==', adminId)]),
    listAll('trainers', [where('adminId', '==', adminId)]),
    listAll('trainer_reviews', [where('adminId', '==', adminId)]),
  ]);

  return {
    clubProfile: clubProfile.exists() ? clubProfile.data() : null,
    secretaries: secretaries.sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'tr')),
    branches: branches.sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'tr')),
    trainers: trainers
      .map((trainer) => ({
        ...trainer,
        branchesLabel: (trainer.branches || [])
          .map((branchId) => branches.find((branch) => branch.id === branchId)?.name || branchId)
          .join(', '),
        reviewStats: getTrainerReviewStats(trainer, reviews),
      }))
      .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'tr')),
  };
}

export async function saveClubProfile({ adminId, values, currentAdminId }) {
  await setDoc(
    doc(db, 'clubProfiles', adminId),
    {
      clubName: values.clubName.trim(),
      logoUrl: values.logoUrl?.trim() || '',
      adminId,
      updatedAt: nowIso(),
      updatedBy: currentAdminId,
    },
    { merge: true }
  );
}

export async function createSecretary({ adminId, values }) {
  const user = await createManagedAuthUser({
    email: values.email.trim(),
    password: values.password,
  });

  await setDoc(doc(db, 'users', user.uid), {
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
    role: 'secretary',
    adminId,
    createdAt: nowIso(),
  });

  return user.uid;
}

export async function deleteSecretary(secretaryId) {
  await deleteDoc(doc(db, 'users', secretaryId));
}

export async function saveBranch({ adminId, branchId = null, values, currentAdminId }) {
  const payload = {
    name: values.name.trim(),
    address: values.address?.trim() || '',
    phone: values.phone?.trim() || '',
    adminId,
    updatedAt: nowIso(),
    updatedBy: currentAdminId,
  };

  if (branchId) {
    await updateDoc(doc(db, 'branches', branchId), payload);
    return branchId;
  }

  const created = await addDoc(collection(db, 'branches'), {
    ...payload,
    createdAt: nowIso(),
  });
  return created.id;
}

export async function deleteBranch(branchId) {
  const [students, schedules] = await Promise.all([
    listAll('students', [where('branchId', '==', branchId)]),
    listAll('schedules', [where('branchId', '==', branchId)]),
  ]);

  if (students.length || schedules.length) {
    throw new Error('Bu subeye bagli ogrenci veya ders saatleri var. Once bagli kayitlari tasiyin veya silin.');
  }

  await deleteDoc(doc(db, 'branches', branchId));
}

export async function saveTrainer({ adminId, trainerId = null, values, currentAdminId }) {
  const payload = {
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
    branches: Array.isArray(values.branches) ? values.branches : [],
    adminId,
    role: 'trainer',
    updatedAt: nowIso(),
    updatedBy: currentAdminId,
  };

  if (trainerId) {
    const trainerRef = doc(db, 'trainers', trainerId);
    const trainerSnapshot = await getDoc(trainerRef);
    await updateDoc(trainerRef, payload);
    const trainerData = trainerSnapshot.exists() ? trainerSnapshot.data() : null;
    if (trainerData?.uid) {
      await setDoc(doc(db, 'users', trainerData.uid), payload, { merge: true });
    }
    return trainerId;
  }

  const user = await createManagedAuthUser({
    email: values.email.trim(),
    password: values.password,
  });

  await setDoc(doc(db, 'users', user.uid), {
    ...payload,
    uid: user.uid,
    createdAt: nowIso(),
  });

  const created = await addDoc(collection(db, 'trainers'), {
    ...payload,
    uid: user.uid,
    createdAt: nowIso(),
  });
  return created.id;
}

export async function deleteTrainer(trainerId) {
  const trainerRef = doc(db, 'trainers', trainerId);
  const trainerSnapshot = await getDoc(trainerRef);
  if (!trainerSnapshot.exists()) {
    throw new Error('Antrenor bulunamadi.');
  }

  const trainer = trainerSnapshot.data();
  const schedules = await listAll('schedules', [where('adminId', '==', trainer.adminId)]);
  const isAssigned = schedules.some((schedule) => {
    const directMatch = schedule.trainerId === trainer.uid || schedule.trainerDocId === trainerId;
    const assignedIds = Array.isArray(schedule.trainerIds) ? schedule.trainerIds : [];
    return directMatch || assignedIds.includes(trainer.uid);
  });

  if (isAssigned) {
    throw new Error('Bu antrenor aktif ders saatlerine atanmis. Once ders atamalarini guncelleyin.');
  }

  await deleteDoc(trainerRef);
  if (trainer.uid) {
    await deleteDoc(doc(db, 'users', trainer.uid)).catch(() => null);
  }
}

export async function getAdminScheduleOverview(adminId) {
  const [branches, trainers, schedules, students, prices, templates, preferences, attendance] = await Promise.all([
    listAll('branches', [where('adminId', '==', adminId)]),
    listAll('trainers', [where('adminId', '==', adminId)]),
    listAll('schedules', [where('adminId', '==', adminId)]),
    listAll('students', [where('adminId', '==', adminId)]),
    listAll('prices', [where('adminId', '==', adminId)]),
    listAll('trainer_time_programs', [where('adminId', '==', adminId)]),
    listAll('trainer_time_preferences', [where('adminId', '==', adminId)]),
    listAll('attendance').catch(() => []),
  ]);

  const enrichedSchedules = schedules
    .map((schedule) => {
      const branch = branches.find((item) => item.id === schedule.branchId);
      const paymentSummary = summarizeSchedulePayments(schedule, trainers);
      return {
        ...schedule,
        branchName: branch?.name || 'Bilinmiyor',
        dayLabels: (schedule.days || []).map(mapDayLabel).join(', '),
        trainerSummary: paymentSummary.assignments.map((item) => `${item.trainerName} (${item.role === 'assistant' ? 'yardimci' : 'bas'})`).join(', '),
        postponementCount: getSchedulePostponementCount(schedule),
        paymentSummary,
      };
    })
    .sort((left, right) => String(left.time || '').localeCompare(String(right.time || ''), 'tr'));

  const privateScheduleIds = new Set(
    schedules
      .filter((schedule) => getScheduleLessonType(schedule) === 'private')
      .map((schedule) => schedule.id)
      .filter(Boolean)
  );

  const attendanceCountMap = buildAttendanceLessonCountMap(
    attendance.filter((record) => privateScheduleIds.has(record.scheduleId))
  );

  const completionCalendar = students
    .filter((student) => String(student.status || 'active') === 'active')
    .map((student) => {
      const schedule = schedules.find((item) => item.id === student.scheduleId);
      if (!schedule) return null;
      const branch = branches.find((item) => item.id === student.branchId);
      const startDate = parseDateValue(student.startDate || schedule.startDate || student.createdAt);
      if (!startDate) return null;
      const lessonsCount = getScheduleLessonCount(schedule);
      const postponementCount = getSchedulePostponementCount(schedule);
      const lessonDates = calculateLessonDatesFromStart(startDate, schedule.days || ['monday'], lessonsCount + postponementCount);
      const endDate = lessonDates.length ? lessonDates[lessonDates.length - 1] : startDate;
      const now = new Date();
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isPrivateLesson = getScheduleLessonType(schedule) === 'private';
      const completedLessons = isPrivateLesson ? (attendanceCountMap[`${student.id}_${schedule.id}`] || 0) : null;
      const remainingLessons = isPrivateLesson ? Math.max(0, lessonsCount - completedLessons) : null;
      return {
        studentId: student.id,
        studentName: [student.name, student.surname].filter(Boolean).join(' '),
        branchName: branch?.name || 'Bilinmiyor',
        scheduleTime: schedule.time || '-',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        daysLeft,
        postponementCount,
        isPrivateLesson,
        remainingLessons,
      };
    })
    .filter(Boolean)
    .sort((left, right) => new Date(left.endDate).getTime() - new Date(right.endDate).getTime());

  return {
    branches,
    trainers,
    schedules: enrichedSchedules,
    prices,
    availabilityTemplates: templates,
    availabilityPreferences: preferences,
    completionCalendar,
  };
}

export async function getAdminFinanceOverview(adminId, options = {}) {
  const rangePreset = options.rangePreset || 'all';
  const branchFilter = options.branchId || '';
  const scheduleFilter = options.scheduleId || '';
  const range = getFinanceDateRange(rangePreset);

  const [branches, schedules, students, expenses, payments, incomes, discounts] = await Promise.all([
    listAll('branches', [where('adminId', '==', adminId)]),
    listAll('schedules', [where('adminId', '==', adminId)]),
    listAll('students', [where('adminId', '==', adminId)]),
    listAll('expenses', [where('adminId', '==', adminId)]),
    listAll('payments', [where('adminId', '==', adminId)]),
    listAll('incomes', [where('adminId', '==', adminId)]),
    listAll('discounts', [where('adminId', '==', adminId)]),
  ]);

  const branchData = {};

  students.forEach((student) => {
    const branchId = resolveFinanceBranchId(student, student);
    const scheduleId = resolveFinanceScheduleId(student, student);
    const turnover = Number(student.totalAmount || 0);

    const branchEntry = ensureFinanceBranchEntry(branchData, branchId, branches);
    const scheduleEntry = ensureFinanceScheduleEntry(branchData, branchId, scheduleId, branches, schedules);

    scheduleEntry.turnover += turnover;
    branchEntry.totalTurnover += turnover;
  });

  expenses.filter((expense) => isDateInFinanceRange(expense.date || expense.createdAt, range)).forEach((expense) => {
    const branchId = resolveFinanceBranchId(expense);
    const scheduleId = resolveFinanceScheduleId(expense);
    const amount = Number(expense.amount || 0);

    const branchEntry = ensureFinanceBranchEntry(branchData, branchId, branches);
    const scheduleEntry = ensureFinanceScheduleEntry(branchData, branchId, scheduleId, branches, schedules);

    scheduleEntry.expense += amount;
    scheduleEntry.manualExpense += amount;
    scheduleEntry.expenses.push(expense);
    branchEntry.totalExpense += amount;
    branchEntry.totalManualExpense += amount;
  });

  schedules.forEach((schedule) => {
    const branchId = resolveFinanceBranchId(schedule);
    const scheduleId = schedule.id || resolveFinanceScheduleId(schedule);
    const salaryExpense = calculateScheduleTrainerSalaryExpense(schedule, range);

    if (!salaryExpense.total) {
      return;
    }

    const branchEntry = ensureFinanceBranchEntry(branchData, branchId, branches);
    const scheduleEntry = ensureFinanceScheduleEntry(branchData, branchId, scheduleId, branches, schedules);
    scheduleEntry.expense += salaryExpense.total;
    scheduleEntry.salaryExpense += salaryExpense.total;
    scheduleEntry.salaryDetails = salaryExpense.details;
    branchEntry.totalExpense += salaryExpense.total;
    branchEntry.totalSalaryExpense += salaryExpense.total;
  });

  payments.filter((payment) => isDateInFinanceRange(getFinanceRecordDate(payment), range)).forEach((payment) => {
    const student = students.find((item) => item.id === payment.studentId);
    const branchId = resolveFinanceBranchId(payment, student);
    const scheduleId = resolveFinanceScheduleId(payment, student);
    const paid = Number(payment.amount || 0);

    const branchEntry = ensureFinanceBranchEntry(branchData, branchId, branches);
    const scheduleEntry = ensureFinanceScheduleEntry(branchData, branchId, scheduleId, branches, schedules);

    scheduleEntry.income += paid;
    scheduleEntry.paymentIncome += paid;
    scheduleEntry.payments.push(payment);
    branchEntry.totalIncome += paid;
  });

  incomes.filter((income) => isDateInFinanceRange(income.date || income.createdAt, range)).forEach((income) => {
    const branchId = resolveFinanceBranchId(income);
    const scheduleId = resolveFinanceScheduleId(income);
    const amount = Number(income.amount || 0);

    const branchEntry = ensureFinanceBranchEntry(branchData, branchId, branches);
    const scheduleEntry = ensureFinanceScheduleEntry(branchData, branchId, scheduleId, branches, schedules);
    scheduleEntry.income += amount;
    scheduleEntry.extraIncome += amount;
    scheduleEntry.incomes.push(income);
    branchEntry.totalIncome += amount;
  });

  Object.values(branchData).forEach((branch) => {
    branch.totalProfit = branch.totalIncome - branch.totalExpense;
    Object.values(branch.schedules).forEach((schedule) => {
      schedule.profit = schedule.income - schedule.expense;
    });
  });

  const filteredBranchData = buildVisibleFinanceBranchData(branchData, branchFilter, scheduleFilter);
  const summary = Object.values(filteredBranchData).reduce((accumulator, branch) => {
    accumulator.turnover += branch.totalTurnover || 0;
    accumulator.income += branch.totalIncome || 0;
    accumulator.expense += branch.totalExpense || 0;
    accumulator.manualExpense += branch.totalManualExpense || 0;
    accumulator.salaryExpense += branch.totalSalaryExpense || 0;
    return accumulator;
  }, {
    turnover: 0,
    income: 0,
    expense: 0,
    manualExpense: 0,
    salaryExpense: 0,
  });

  const visibleSchedules = Object.values(filteredBranchData).flatMap((branch) => Object.values(branch.schedules));
  const rangedIncomes = incomes.filter((income) => isDateInFinanceRange(income.date || income.createdAt, range));
  const rangedExpenses = expenses.filter((expense) => isDateInFinanceRange(expense.date || expense.createdAt, range));

  return {
    rangePreset,
    branches,
    schedules,
    range,
    summary: {
      ...summary,
      profit: summary.income - summary.expense,
    },
    branchCards: Object.values(filteredBranchData),
    scheduleRows: visibleSchedules,
    recentIncomes: sortByDateDesc(rangedIncomes).slice(0, 8),
    recentExpenses: sortByDateDesc(rangedExpenses).slice(0, 8),
    discounts: sortByDateDesc(discounts).slice(0, 12),
  };
}

export async function getAdminStandardsOverview(adminId) {
  const [standards, trainers] = await Promise.all([
    listAll('standards'),
    listAll('trainers', [where('adminId', '==', adminId)]),
  ]);

  const trainerIdentitySet = getAdminTrainerIdentitySet(trainers);
  const visibleStandards = standards.filter((standard) => {
    const scope = getAdminStandardScope(standard);
    if (scope === 'global') return true;
    if (scope === 'admin') return standard.adminId === adminId;
    return trainerIdentitySet.has(standard.trainerId);
  });

  const groupedStandards = new Map();
  visibleStandards.forEach((standard) => {
    const groupKey = [
      standard.birthYear || '',
      cleanAdminStandardDocumentTitle(standard.name || standard.groupLabel || ''),
      standard.poolType || '',
      standard.category || '',
      getAdminStandardScope(standard),
      standard.adminId || '',
      standard.trainerId || '',
    ].join('|');

    if (!groupedStandards.has(groupKey)) {
      groupedStandards.set(groupKey, {
        key: groupKey,
        title: getAdminReadableStandardTitle(standard),
        meta: getAdminStandardMeta(standard),
        items: [],
      });
    }

    groupedStandards.get(groupKey).items.push({
      ...standard,
      scopeType: getAdminStandardScope(standard),
      editable: getAdminStandardScope(standard) === 'admin' && standard.adminId === adminId,
    });
  });

  return {
    groups: Array.from(groupedStandards.values())
      .map((group) => ({
        ...group,
        items: [...group.items].sort((left, right) => String(left.style || '').localeCompare(String(right.style || ''), 'tr') || Number(left.distance || 0) - Number(right.distance || 0)),
      }))
      .sort((left, right) => Number(right.items[0]?.birthYear || 0) - Number(left.items[0]?.birthYear || 0) || String(left.title || '').localeCompare(String(right.title || ''), 'tr') || String(left.meta || '').localeCompare(String(right.meta || ''), 'tr')),
  };
}

export async function saveSchedule({ adminId, scheduleId = null, values, currentAdminId }) {
  const trainerAssignments = (values.trainerIds || [])
    .filter(Boolean)
    .map((trainerId, index) => {
      const trainer = values.trainers.find((item) => item.uid === trainerId || item.id === trainerId);
      return {
        trainerId: trainer?.uid || trainerId,
        trainerDocId: trainer?.id || trainerId,
        trainerName: trainer?.name || 'Bilinmiyor',
        role: values.primaryTrainerId === trainerId || (!values.primaryTrainerId && index === 0) ? 'head' : 'assistant',
      };
    });

  if (!trainerAssignments.length) {
    throw new Error('En az bir antrenor secin.');
  }

  const headAssignment = trainerAssignments.find((item) => item.role === 'head') || trainerAssignments[0];
  const payload = {
    branchId: values.branchId,
    time: values.time,
    lessonType: values.lessonType === 'private' ? 'private' : 'group',
    startDate: values.startDate,
    days: Array.isArray(values.days) && values.days.length ? values.days : ['monday'],
    trainerId: headAssignment.trainerId,
    trainerDocId: headAssignment.trainerDocId,
    trainerAssignments,
    trainerIds: trainerAssignments.map((item) => item.trainerId),
    capacity: toNumber(values.capacity, 1),
    lessonsCount: toNumber(values.lessonsCount, 1),
    adminId,
    updatedAt: nowIso(),
    updatedBy: currentAdminId,
  };

  if (scheduleId) {
    await updateDoc(doc(db, 'schedules', scheduleId), payload);
    return scheduleId;
  }

  const created = await addDoc(collection(db, 'schedules'), {
    ...payload,
    createdAt: nowIso(),
  });
  return created.id;
}

export async function saveAvailabilityTemplate({ adminId, branchId, dayKey, slots, currentAdminId }) {
  const templateRef = doc(db, 'trainer_time_programs', `${adminId}_${branchId}`);
  const templateSnapshot = await getDoc(templateRef);
  const existing = templateSnapshot.exists() ? templateSnapshot.data() : {};
  const dailySlots = { ...(existing.dailySlots || {}) };
  dailySlots[dayKey] = slots;

  await setDoc(
    templateRef,
    {
      adminId,
      branchId,
      slots,
      dailySlots,
      updatedAt: nowIso(),
      updatedBy: currentAdminId,
    },
    { merge: true }
  );
}

export async function savePrice({ adminId, branchId, time, price, currentAdminId }) {
  await setDoc(
    doc(db, 'prices', `${branchId}_${time}`),
    {
      adminId,
      branchId,
      price: toNumber(price),
      updatedAt: nowIso(),
      updatedBy: currentAdminId,
    },
    { merge: true }
  );
}

export async function getAdminBusinessOverview(adminId) {
  const [announcements, discounts, events, products, standards, incomes, expenses, payments, branches, schedules] = await Promise.all([
    listAll('announcements', [where('adminId', '==', adminId)]),
    listAll('discounts', [where('adminId', '==', adminId)]),
    listAll('events'),
    listAll('products'),
    listAll('standards'),
    listAll('incomes', [where('adminId', '==', adminId)]),
    listAll('expenses', [where('adminId', '==', adminId)]),
    listAll('payments', [where('adminId', '==', adminId)]),
    listAll('branches', [where('adminId', '==', adminId)]),
    listAll('schedules', [where('adminId', '==', adminId)]),
  ]);

  const paymentIncome = payments.reduce((sum, item) => sum + toNumber(item.amount, 0), 0);
  const extraIncome = incomes.reduce((sum, item) => sum + toNumber(item.amount, 0), 0);
  const expenseTotal = expenses.reduce((sum, item) => sum + toNumber(item.amount, 0), 0);

  return {
    financeSummary: {
      paymentIncome,
      extraIncome,
      totalIncome: paymentIncome + extraIncome,
      expenseTotal,
      profit: paymentIncome + extraIncome - expenseTotal,
      paymentCount: payments.length,
    },
    announcements: sortByDateDesc(announcements).slice(0, 10),
    discounts: sortByDateDesc(discounts),
    events: [...events].sort((left, right) => new Date(left.date || 0).getTime() - new Date(right.date || 0).getTime()).slice(0, 12),
    products: products.slice(0, 12),
    standards: standards.filter((standard) => isStandardVisibleToAdmin(adminId, standard)).sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'tr')),
    incomes: sortByDateDesc(incomes).slice(0, 8),
    expenses: sortByDateDesc(expenses).slice(0, 8),
    branches,
    schedules,
  };
}

export async function getAdminContentOverview(adminId) {
  const [announcements, discounts, events, branches, schedules] = await Promise.all([
    listAll('announcements', [where('adminId', '==', adminId)]),
    listAll('discounts', [where('adminId', '==', adminId)]),
    listAll('events', [where('adminId', '==', adminId)]).catch(() => []),
    listAll('branches', [where('adminId', '==', adminId)]),
    listAll('schedules', [where('adminId', '==', adminId)]),
  ]);

  const upcomingEvents = [...events]
    .sort((left, right) => new Date(left.date || 0).getTime() - new Date(right.date || 0).getTime())
    .map((event) => ({
      ...event,
      branchName: branches.find((branch) => branch.id === event.branchId)?.name || '',
      scheduleName: event.time || '',
    }));

  return {
    announcements: sortByDateDesc(announcements).slice(0, 12),
    discounts: sortByDateDesc(discounts).slice(0, 12),
    events: upcomingEvents.slice(0, 20),
    branches,
    schedules,
    summary: {
      announcementCount: announcements.length,
      eventCount: events.length,
      discountCount: discounts.length,
    },
  };
}

export async function saveAnnouncement({ adminId, values, currentAdminId }) {
  await addDoc(collection(db, 'announcements'), {
    title: values.title.trim(),
    content: values.content.trim(),
    target: values.target || 'all',
    branchId: values.target === 'schedule' ? values.branchId || null : null,
    scheduleId: values.target === 'schedule' ? values.scheduleId || null : null,
    adminId,
    createdAt: nowIso(),
    createdBy: currentAdminId,
  });
}

export async function deleteAnnouncement(announcementId) {
  await deleteDoc(doc(db, 'announcements', announcementId));
}

export async function saveDiscount({ adminId, values, currentAdminId }) {
  const code = values.code.trim().toUpperCase();
  const existing = await listAll('discounts', [where('adminId', '==', adminId), where('code', '==', code)]);
  if (existing.length) {
    throw new Error('Bu indirim kodu zaten mevcut.');
  }

  await addDoc(collection(db, 'discounts'), {
    code,
    percentage: toNumber(values.percentage, 0),
    expiryDate: values.expiryDate,
    usageLimit: values.usageLimit ? toNumber(values.usageLimit, 0) : null,
    usageCount: 0,
    adminId,
    createdAt: nowIso(),
    createdBy: currentAdminId,
  });
}

export async function deleteDiscount(discountId) {
  await deleteDoc(doc(db, 'discounts', discountId));
}

export async function saveEvent({ adminId, values, currentAdminName }) {
  await addDoc(collection(db, 'events'), {
    name: values.name.trim(),
    date: values.date,
    branchId: values.branchId || null,
    time: values.time || null,
    type: values.type,
    description: values.description?.trim() || '',
    location: values.location?.trim() || '',
    createdBy: currentAdminName || adminId,
    adminId,
    createdAt: nowIso(),
  });
}

export async function deleteEvent(eventId) {
  await deleteDoc(doc(db, 'events', eventId));
}

export async function saveIncome({ adminId, values, currentAdminId }) {
  await addDoc(collection(db, 'incomes'), {
    description: values.description.trim(),
    amount: toNumber(values.amount),
    date: values.date,
    branchId: values.branchId || '',
    scheduleId: values.scheduleId || '',
    adminId,
    createdAt: nowIso(),
    createdBy: currentAdminId,
  });
}

export async function saveExpense({ adminId, values, currentAdminId }) {
  await addDoc(collection(db, 'expenses'), {
    description: values.description.trim(),
    amount: toNumber(values.amount),
    date: values.date,
    branchId: values.branchId || '',
    scheduleId: values.scheduleId || '',
    adminId,
    createdAt: nowIso(),
    createdBy: currentAdminId,
  });
}

export async function deleteIncome(incomeId) {
  await deleteDoc(doc(db, 'incomes', incomeId));
}

export async function deleteExpense(expenseId) {
  await deleteDoc(doc(db, 'expenses', expenseId));
}

export async function saveAdminStandard({ adminId, standardId = null, values, currentAdminId }) {
  const payload = {
    name: values.name.trim(),
    birthYear: toNumber(values.birthYear),
    gender: values.gender,
    style: values.style,
    distance: toNumber(values.distance),
    time: values.time.trim(),
    scopeType: 'admin',
    adminId,
    updatedAt: nowIso(),
    updatedBy: currentAdminId,
    updatedByRole: 'admin',
  };

  if (standardId) {
    await updateDoc(doc(db, 'standards', standardId), payload);
    return standardId;
  }

  const created = await addDoc(collection(db, 'standards'), {
    ...payload,
    createdAt: nowIso(),
    createdBy: currentAdminId,
    createdByRole: 'admin',
  });
  return created.id;
}

export async function deleteAdminStandard(standardId) {
  await deleteDoc(doc(db, 'standards', standardId));
}

export async function getAdminMarketOverview(profile) {
  const adminId = profile?.uid || profile?.adminId || '';
  if (!adminId) {
    throw new Error('Admin oturumu bulunamadi.');
  }

  const [products, orders, favorites, campaigns, bankSettingsSnapshot] = await Promise.all([
    listAll('products'),
    listAll('orders', [where('buyerId', '==', adminId)]).catch(() => []),
    listUserMarketFavorites(adminId),
    listVisibleMarketCampaigns({ adminId }),
    getDoc(doc(db, 'app_settings', 'credit_purchase_bank')).catch(() => null),
  ]);

  const bankSettings = bankSettingsSnapshot?.exists?.() ? bankSettingsSnapshot.data() || {} : {};

  return {
    products: products.sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'tr')),
    orders: sortByDateDesc(orders).map(normalizeMarketOrder),
    favoriteProductIds: favorites.map((item) => item.productId),
    campaigns,
    bankSettings: {
      bankName: bankSettings.bankName || '',
      accountHolder: bankSettings.accountHolder || '',
      iban: bankSettings.iban || '',
      note: bankSettings.note || '',
    },
    defaults: {
      buyerPhone: String(profile?.phone || '').trim(),
      shippingAddress: String(profile?.clubAddress || profile?.address || '').trim(),
    },
  };
}

export async function submitAdminMarketCheckout({
  profile,
  items,
  buyerPhone,
  shippingAddress,
  paymentMethod,
  cardDetails,
  installmentPreference,
  note,
}) {
  const adminId = profile?.uid || profile?.adminId || '';
  if (!adminId) {
    throw new Error('Admin oturumu bulunamadi.');
  }

  const normalizedItems = normalizeAdminCartItems(items);
  if (!normalizedItems.length) {
    throw new Error('Sepette en az bir urun bulunmali.');
  }

  const cleanPhone = String(buyerPhone || profile?.phone || '').trim();
  const cleanAddress = String(shippingAddress || profile?.clubAddress || profile?.address || '').trim();
  const cleanPaymentMethod = String(paymentMethod || 'iban').trim().toLowerCase();
  const cleanInstallment = String(installmentPreference || '').trim();
  const cleanNote = String(note || '').trim();

  if (!cleanPhone) {
    throw new Error('Iletisim telefonu gerekli.');
  }
  if (!cleanAddress) {
    throw new Error('Teslimat adresi gerekli.');
  }

  const totalAmount = normalizedItems.reduce((sum, item) => sum + toNumber(item.lineTotal, 0), 0);
  const itemCount = normalizedItems.reduce((sum, item) => sum + toNumber(item.quantity, 0), 0);
  const orderTitle = getAdminOrderTitle(normalizedItems);
  const orderRef = doc(collection(db, 'orders'));
  const cardSnapshot = cleanPaymentMethod === 'credit_card' ? buildCreditCardSnapshot(cardDetails) : {};

  await runTransaction(db, async (transaction) => {
    transaction.set(orderRef, {
      type: 'product',
      status: 'pending',
      statusHistory: buildInitialMarketStatusHistory({
        actorId: adminId,
        actorRole: 'admin',
      }),
      paymentMethod: cleanPaymentMethod,
      items: normalizedItems,
      itemCount,
      orderTitle,
      totalAmount,
      buyerId: adminId,
      buyerName: profile?.name || 'Admin',
      buyerEmail: profile?.email || '',
      buyerRole: 'admin',
      buyerPhone: cleanPhone,
      shippingAddress: cleanAddress,
      installmentPreference: cleanInstallment,
      note: cleanNote,
      adminId,
      ...cardSnapshot,
      createdAt: nowIso(),
      shippingCarrier: '',
      trackingNumber: '',
    });
  });

  await notifySuperAdminsAboutAdminOrder(orderTitle, profile?.name || 'Admin', orderRef.id, adminId);

  return {
    id: orderRef.id,
    orderTitle,
    itemCount,
    totalAmount,
  };
}