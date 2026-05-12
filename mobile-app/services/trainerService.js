import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  limit,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import { createOrReuseDirectChat, sendMessage } from '../api/chatApi';
import { db } from '../config/firebase';
import {
  buildCreditCardSnapshot,
  buildInitialMarketStatusHistory,
  listUserMarketFavorites,
  listVisibleMarketCampaigns,
  normalizeMarketOrder,
} from './marketService';
import { createAppNotification } from './notificationService';
import { nowIso, sortByDateDesc, todayIsoDate } from '../utils/date';

const dayLabels = {
  monday: 'Pazartesi',
  tuesday: 'Sali',
  wednesday: 'Carsamba',
  thursday: 'Persembe',
  friday: 'Cuma',
  saturday: 'Cumartesi',
  sunday: 'Pazar',
};

function toNumber(value, fallback = 0) {
  if (value === '' || value === null || typeof value === 'undefined') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundCurrency(value) {
  return Math.round(toNumber(value, 0) * 100) / 100;
}

function normalizeCartItems(items, options = {}) {
  const useCredits = Boolean(options.useCredits);
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const quantity = Math.max(1, toNumber(item.quantity, 1));
      const unitPrice = roundCurrency(item.unitPrice ?? item.price ?? 0);
      const unitCredits = toNumber(item.unitCredits ?? item.creditCost ?? 0);
      return {
        productId: item.productId || item.id || '',
        productName: String(item.productName || item.name || '').trim(),
        quantity,
        unitPrice,
        unitCredits,
        lineTotal: roundCurrency(unitPrice * quantity),
        lineCredits: unitCredits * quantity,
      };
    })
    .filter((item) => item.productId && item.productName && item.quantity > 0 && (!useCredits || item.unitCredits > 0));
}

function getOrderTitle(items) {
  if (!items.length) return 'Market siparisi';
  if (items.length === 1) {
    return `${items[0].productName}${items[0].quantity > 1 ? ` x${items[0].quantity}` : ''}`;
  }
  return `${items[0].productName} +${items.length - 1} urun`;
}

function normalizeTrainerOrder(order) {
  const items = Array.isArray(order?.items) && order.items.length
    ? order.items
    : (order?.productId ? [{
      productId: order.productId,
      productName: order.productName || 'Urun',
      quantity: Number(order.quantity || 1),
      unitPrice: roundCurrency(order.productPrice || order.totalAmount || 0),
      unitCredits: toNumber(order.totalCredits || 0),
      lineTotal: roundCurrency(order.totalAmount || order.productPrice || 0),
      lineCredits: toNumber(order.totalCredits || 0),
    }] : []);

  return {
    ...order,
    items,
    itemCount: Number(order?.itemCount || items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)),
    orderTitle: order?.orderTitle || getOrderTitle(items),
  };
}

async function notifySuperAdminsAboutTrainerOrder(orderId, orderTitle, trainer) {
  const superAdmins = await listAll('users', [where('role', '==', 'superadmin')]);
  await Promise.all(superAdmins.map((user) => createAppNotification({
    userId: user.id,
    title: 'Yeni market siparisi',
    message: `${trainer.name || 'Antrenor'} tarafindan ${orderTitle} siparisi olusturuldu.`,
    type: 'market_order',
    data: { orderId, buyerId: trainer.uid },
  }).catch(() => null)));
}

function getStudentDisplayName(student) {
  return [student?.name, student?.surname].filter(Boolean).join(' ') || 'Ogrenci';
}

async function notifyStudentParent(student, payload) {
  const recipientId = student?.parentUid || student?.parentId || '';
  if (!recipientId) {
    return;
  }

  try {
    await createAppNotification({
      userId: recipientId,
      ...payload,
      data: {
        studentId: student.id,
        scheduleId: student.scheduleId || '',
        ...(payload.data || {}),
      },
    });
  } catch (error) {
    console.warn('Veli bildirimi gonderilemedi:', error.message);
  }
}

async function listAll(collectionName, constraints = []) {
  const resolver = constraints.length
    ? query(collection(db, collectionName), ...constraints)
    : collection(db, collectionName);
  let snapshot;
  try {
    snapshot = await getDocsFromServer(resolver);
  } catch (_error) {
    // Fallback to cache/network mixed mode when server read is temporarily unavailable.
    snapshot = await getDocs(resolver);
  }
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function parseDateValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'object' && typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeDateStart(value) {
  const date = parseDateValue(value);
  if (!date) return null;
  const normalized = new Date(date.getTime());
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function formatDayList(days) {
  const normalized = getNormalizedScheduleDays({ days });
  return normalized.length ? normalized.map((day) => dayLabels[day] || day).join(', ') : '-';
}

function getNormalizedScheduleDays(schedule) {
  if (Array.isArray(schedule?.days) && schedule.days.length) return schedule.days;
  if (Array.isArray(schedule?.scheduleDays) && schedule.scheduleDays.length) return schedule.scheduleDays;
  if (typeof schedule?.day === 'string' && schedule.day.trim()) return [schedule.day.trim()];
  return [];
}

function getScheduleLessonType(schedule) {
  if (schedule?.lessonType) return String(schedule.lessonType).toLowerCase();
  if (schedule?.type) return String(schedule.type).toLowerCase();
  return 'group';
}

function getScheduleLessonTypeLabel(schedule) {
  return getScheduleLessonType(schedule) === 'private' ? 'Ozel ders' : 'Grup dersi';
}

function getScheduleLessonCount(schedule) {
  return Math.max(1, toNumber(schedule?.lessonsCount, 1));
}

function getSchedulePostponements(schedule) {
  return Array.isArray(schedule?.postponements) ? schedule.postponements : [];
}

function getSchedulePostponementCount(schedule) {
  return getSchedulePostponements(schedule).length;
}

function mapDayKeyToJsDay(dayKey) {
  const map = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  return map[dayKey] ?? null;
}

function calculateLessonDatesFromStart(startDate, scheduleDays, lessonCount) {
  const targetDays = (scheduleDays || []).map(mapDayKeyToJsDay).filter((day) => day !== null);
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

function getSchedulePostponableDates(schedule) {
  if (!schedule) return [];
  const startDate = parseDateValue(schedule.startDate) || parseDateValue(schedule.createdAt) || new Date();
  startDate.setHours(0, 0, 0, 0);

  const lessonDates = calculateLessonDatesFromStart(
    startDate,
    getNormalizedScheduleDays(schedule),
    getScheduleLessonCount(schedule) + getSchedulePostponementCount(schedule)
  );
  const postponedDateSet = new Set(
    getSchedulePostponements(schedule)
      .map((item) => item?.date)
      .filter(Boolean)
  );

  return lessonDates
    .map((date) => formatIsoDate(date))
    .filter(Boolean)
    .filter((iso) => !postponedDateSet.has(iso));
}

function formatIsoDate(value) {
  const date = parseDateValue(value);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysUntilDate(value) {
  const target = normalizeDateStart(value);
  if (!target) return null;
  const current = new Date();
  current.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
}

function normalizeTrainerAssignments(schedule) {
  if (Array.isArray(schedule?.trainerAssignments) && schedule.trainerAssignments.length) {
    return schedule.trainerAssignments.map((assignment, index) => ({
      trainerId: assignment.trainerId || '',
      trainerDocId: assignment.trainerDocId || '',
      trainerName: assignment.trainerName || 'Bilinmiyor',
      role: assignment.role || (index === 0 ? 'head' : 'assistant'),
      trainerRate: toNumber(assignment.trainerRate, 0),
      trainerPaymentDetails: Array.isArray(assignment.trainerPaymentDetails) ? assignment.trainerPaymentDetails : [],
      trainerPaymentStatus: assignment.trainerPaymentStatus || 'pending',
      trainerPaidLessonCount: toNumber(assignment.trainerPaidLessonCount, 0),
    }));
  }

  if (!schedule?.trainerId && !schedule?.trainerDocId) return [];

  return [
    {
      trainerId: schedule?.trainerId || '',
      trainerDocId: schedule?.trainerDocId || '',
      trainerName: schedule?.trainerName || 'Bilinmiyor',
      role: 'head',
      trainerRate: toNumber(schedule?.trainerRate, 0),
      trainerPaymentDetails: Array.isArray(schedule?.trainerPaymentDetails) ? schedule.trainerPaymentDetails : [],
      trainerPaymentStatus: schedule?.trainerPaymentStatus || 'pending',
      trainerPaidLessonCount: toNumber(schedule?.trainerPaidLessonCount, 0),
    },
  ];
}

function scheduleBelongsToTrainer(schedule, trainer) {
  if (!schedule || !trainer) return false;
  const directIds = [schedule.trainerId, schedule.trainerDocId, ...(Array.isArray(schedule.trainerIds) ? schedule.trainerIds : [])].filter(Boolean);
  if (directIds.includes(trainer.uid) || directIds.includes(trainer.docId) || directIds.includes(trainer.id)) {
    return true;
  }

  const assignments = normalizeTrainerAssignments(schedule);
  return assignments.some((assignment) => {
    return [assignment.trainerId, assignment.trainerDocId].filter(Boolean).includes(trainer.uid)
      || [assignment.trainerId, assignment.trainerDocId].filter(Boolean).includes(trainer.docId)
      || [assignment.trainerId, assignment.trainerDocId].filter(Boolean).includes(trainer.id);
  });
}

function getAttendanceRecordTimestamp(record) {
  const readValue = (value) => {
    if (!value) return 0;
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    if (typeof value === 'number') return value;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return Math.max(readValue(record?.updatedAt), readValue(record?.createdAt), readValue(record?.date));
}

function buildAttendanceMap(records) {
  const timestampMap = {};
  const attendanceMap = {};
  (records || []).forEach((record) => {
    if (!Number.isFinite(Number(record.lessonNumber))) return;
    const key = `${record.studentId}_${record.lessonNumber}`;
    const recordTs = getAttendanceRecordTimestamp(record);
    if (!Object.prototype.hasOwnProperty.call(timestampMap, key) || recordTs >= timestampMap[key]) {
      timestampMap[key] = recordTs;
      attendanceMap[key] = typeof record.present === 'boolean' ? record.present : null;
    }
  });
  return attendanceMap;
}

function buildTrainerAttendanceLessonCountMap(records) {
  return (records || []).reduce((result, record) => {
    if (record?.present !== true) return result;
    const key = `${record.studentId}_${record.scheduleId}`;
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function getNormalizedDailySlots(rawData) {
  const dailySlots = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };

  if (rawData?.dailySlots && typeof rawData.dailySlots === 'object') {
    Object.keys(dailySlots).forEach((key) => {
      const values = rawData.dailySlots[key];
      dailySlots[key] = Array.isArray(values) ? values.map((item) => String(item).trim()).filter(Boolean).sort() : [];
    });
    return dailySlots;
  }

  if (Array.isArray(rawData?.slots)) {
    dailySlots.monday = rawData.slots.map((item) => String(item).trim()).filter(Boolean).sort();
  }

  return dailySlots;
}

function getStudentBirthYear(student) {
  if (!student) return null;
  if (student.birthYear) return Number(student.birthYear);
  if (student.birthDate) {
    const parsed = parseDateValue(student.birthDate);
    return parsed ? parsed.getFullYear() : null;
  }
  return null;
}

function timeToSeconds(timeValue) {
  if (!timeValue || typeof timeValue !== 'string') return Number.NaN;
  const match = timeValue.trim().match(/^(\d{1,2}):(\d{2})\.(\d{1,2})$/);
  if (!match) return Number.NaN;
  return (Number(match[1]) * 60) + Number(match[2]) + (Number(match[3]) / 100);
}

function normalizePerformanceStyleToStandard(style) {
  // Normalize to ASCII-safe canonical form to handle both mobile-internal values
  // (Sirt, Kurbaga, Kelebek) and web Turkish values (Sırtüstü, Kurbağalama, Kelebekçe)
  const compact = String(style || '')
    .trim()
    .toUpperCase()
    .replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ş/g, 'S')
    .replace(/İ/g, 'I').replace(/I/g, 'I').replace(/Ö/g, 'O').replace(/Ç/g, 'C');
  if (compact === 'SERBEST' || compact === 'FREE' || compact === 'FREESTYLE') return 'Serbest';
  if (compact.startsWith('KURBAG') || compact.includes('BREAST')) return 'Kurbagalama';
  if (compact.startsWith('SIRT') || compact.startsWith('SIRTUSTU') || compact.includes('BACK')) return 'Sirtustu';
  if (compact.startsWith('KELEBEK') || compact.includes('FLY') || compact.includes('BUTTERFLY')) return 'Kelebekce';
  if (compact === 'KARISIK' || compact === 'KARMA' || compact === 'KARISIK' || compact.includes('MEDLEY')) return 'Karma';
  return String(style || '').trim();
}

function normalizeGenderToken(gender) {
  const compact = String(gender || '')
    .trim()
    .toUpperCase()
    .replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ş/g, 'S')
    .replace(/İ/g, 'I').replace(/I/g, 'I').replace(/Ö/g, 'O').replace(/Ç/g, 'C');
  if (!compact) return '';
  if (compact.includes('ERKEK') || compact === 'E' || compact.includes('MALE') || compact.includes('MEN') || compact.includes('BAY')) return 'M';
  if (compact.includes('KIZ') || compact.includes('KADIN') || compact === 'K' || compact.includes('FEMALE') || compact.includes('WOMEN') || compact.includes('BAYAN')) return 'F';
  return compact;
}

function getReadableStandardTitle(standard) {
  const title = standard?.name || standard?.groupLabel || 'Baraj';
  return String(title || 'Baraj').trim() || 'Baraj';
}

function isOpenAgeStandard(standard) {
  const token = String(standard?.ageGroupToken || '').trim();
  return Boolean(standard?.isOpenAgeGroup) || token.endsWith('+');
}

function doesStandardMatchBirthYear(standard, studentBirthYear) {
  const standardBirthYear = Number(standard?.birthYear);
  if (!Number.isFinite(standardBirthYear)) return false;

  const normalizedStudentBirthYear = Number(studentBirthYear);
  if (!Number.isFinite(normalizedStudentBirthYear)) return true;

  // Open age standards: 2007+ means 2007 and any earlier birth year.
  if (isOpenAgeStandard(standard)) {
    return normalizedStudentBirthYear <= standardBirthYear;
  }

  // Normal rule: a swimmer can also be evaluated against older age-group barriers,
  // but never against younger groups.
  return standardBirthYear <= normalizedStudentBirthYear;
}

function isStandardVisibleToTrainer(trainer, standard) {
  const scopeType = standard?.scopeType || 'global';
  if (scopeType === 'global') return true;
  if (scopeType === 'admin') return standard?.adminId === trainer.adminId;
  if (scopeType === 'trainer') {
    return [standard?.trainerId, standard?.trainerDocId].filter(Boolean).includes(trainer.uid)
      || [standard?.trainerId, standard?.trainerDocId].filter(Boolean).includes(trainer.docId);
  }
  // Legacy / unknown scope values should still be visible rather than silently hidden.
  return true;
}

function buildCompletionRows(students, schedules, branches, attendanceRecords) {
  const attendanceCountMap = buildTrainerAttendanceLessonCountMap(attendanceRecords);

  return students
    .map((student) => {
      const schedule = schedules.find((item) => item.id === student.scheduleId);
      if (!schedule) return null;

      const branch = branches.find((item) => item.id === student.branchId || item.id === schedule.branchId);
      const lessonsCount = getScheduleLessonCount(schedule);
      const postponementCount = getSchedulePostponementCount(schedule);
      const startDate = parseDateValue(student.startDate) || parseDateValue(schedule.startDate) || parseDateValue(student.createdAt);
      if (!startDate) return null;

      const lessonDates = calculateLessonDatesFromStart(startDate, getNormalizedScheduleDays(schedule), lessonsCount + postponementCount);
      const endDate = lessonDates.length ? lessonDates[lessonDates.length - 1] : startDate;
      const isPrivateLesson = getScheduleLessonType(schedule) === 'private';
      const completedLessons = isPrivateLesson ? (attendanceCountMap[`${student.id}_${schedule.id}`] || 0) : null;
      const remainingLessons = isPrivateLesson ? Math.max(0, lessonsCount - completedLessons) : null;

      return {
        studentId: student.id,
        studentName: [student.name, student.surname].filter(Boolean).join(' ') || 'Ogrenci',
        branchName: branch?.name || 'Bilinmiyor',
        scheduleName: schedule.time || '-',
        startDate: formatIsoDate(startDate),
        endDate: formatIsoDate(endDate),
        daysLeft: daysUntilDate(endDate),
        postponementCount,
        isPrivateLesson,
        remainingLessons,
      };
    })
    .filter(Boolean)
    .sort((left, right) => new Date(left.endDate).getTime() - new Date(right.endDate).getTime());
}

function summarizeTrainerSalary(schedules, trainer) {
  const summary = schedules.reduce(
    (summary, schedule) => {
      const assignments = normalizeTrainerAssignments(schedule);
      const currentAssignment = assignments.find((assignment) => {
        const ids = [assignment.trainerId, assignment.trainerDocId].filter(Boolean);
        return ids.includes(trainer.uid) || ids.includes(trainer.docId) || ids.includes(trainer.id);
      });
      if (!currentAssignment) return summary;

      const totalLessons = getScheduleLessonCount(schedule);
      const rate = toNumber(currentAssignment.trainerRate, 0);
      const paidDetails = currentAssignment.trainerPaymentDetails.filter((item) => item?.status === 'paid');
      const paidLessons = paidDetails.length || toNumber(currentAssignment.trainerPaidLessonCount, 0);
      const pendingLessons = Math.max(totalLessons - paidLessons, 0);
      const paidAmount = paidDetails.reduce((sum, item) => sum + toNumber(item.amount, 0), 0) || (paidLessons * rate);
      const projectedAmount = totalLessons * rate;
      const branchName = schedule.branchName || 'Bilinmiyor';

      summary.totalLessons += totalLessons;
      summary.paidLessons += paidLessons;
      summary.pendingLessons += pendingLessons;
      summary.totalProjected += projectedAmount;
      summary.totalPaid += paidAmount;
      summary.rows.push({
        scheduleId: schedule.id,
        branchName,
        time: schedule.time || '-',
        lessonsCount: totalLessons,
        trainerRate: rate,
        hasConfiguredRate: rate > 0,
        paidLessons,
        pendingLessons,
        paidAmount,
        pendingAmount: pendingLessons * rate,
        totalSalary: projectedAmount,
      });
      return summary;
    },
    {
      totalLessons: 0,
      paidLessons: 0,
      pendingLessons: 0,
      totalProjected: 0,
      totalPaid: 0,
      rows: [],
    }
  );

  summary.rows.sort((left, right) => String(left.time).localeCompare(String(right.time), 'tr'));
  return summary;
}

function buildTrainerBranchMap(branches) {
  return branches.reduce((result, branch) => {
    result[branch.id] = branch;
    return result;
  }, {});
}

async function fetchPerformancesByStudentIds(studentIds) {
  const ids = [...new Set((studentIds || []).filter(Boolean))];
  if (!ids.length) return [];

  const snapshots = await Promise.all(
    Array.from({ length: Math.ceil(ids.length / 10) }, (_, index) => {
      const chunk = ids.slice(index * 10, (index * 10) + 10);
      return getDocs(query(collection(db, 'performances'), where('studentId', 'in', chunk)));
    })
  );

  return snapshots.flatMap((snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
}

async function fetchStudentsByScheduleIds(scheduleIds) {
  const ids = [...new Set((scheduleIds || []).filter(Boolean))];
  if (!ids.length) return [];

  const snapshots = await Promise.all(
    Array.from({ length: Math.ceil(ids.length / 10) }, (_, index) => {
      const chunk = ids.slice(index * 10, (index * 10) + 10);
      return getDocs(query(collection(db, 'students'), where('scheduleId', 'in', chunk)));
    })
  );

  return snapshots.flatMap((snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
}

async function fetchTrainerSchedules(trainer) {
  const queryBatches = [
    listAll('schedules', [where('trainerId', '==', trainer.uid)]).catch(() => []),
    listAll('schedules', [where('trainerId', '==', trainer.docId)]).catch(() => []),
    listAll('schedules', [where('trainerDocId', '==', trainer.uid)]).catch(() => []),
    listAll('schedules', [where('trainerDocId', '==', trainer.docId)]).catch(() => []),
    listAll('schedules', [where('trainerIds', 'array-contains', trainer.uid)]).catch(() => []),
  ];

  if (trainer.docId && trainer.docId !== trainer.uid) {
    queryBatches.push(
      listAll('schedules', [where('trainerIds', 'array-contains', trainer.docId)]).catch(() => []),
    );
  }

  const scheduleBatches = await Promise.all(queryBatches);
  const uniqueSchedules = [];
  const seenScheduleIds = new Set();

  scheduleBatches.flat().forEach((schedule) => {
    if (!schedule?.id || seenScheduleIds.has(schedule.id)) {
      return;
    }
    seenScheduleIds.add(schedule.id);
    if (scheduleBelongsToTrainer(schedule, trainer)) {
      uniqueSchedules.push(schedule);
    }
  });

  if (!uniqueSchedules.length && trainer.adminId) {
    const fallbackSchedules = await listAll('schedules', [where('adminId', '==', trainer.adminId)]).catch(() => []);
    fallbackSchedules.forEach((schedule) => {
      if (!schedule?.id || seenScheduleIds.has(schedule.id)) {
        return;
      }
      seenScheduleIds.add(schedule.id);
      if (scheduleBelongsToTrainer(schedule, trainer)) {
        uniqueSchedules.push(schedule);
      }
    });
  }

  return uniqueSchedules;
}

async function getOrCreateCreditBalance(userId) {
  const creditRef = doc(db, 'user_credits', userId);
  const snapshot = await getDoc(creditRef);
  if (!snapshot.exists()) {
    await setDoc(creditRef, { balance: 0, blockedCredits: 0, createdAt: nowIso(), lastUpdated: nowIso() }, { merge: true });
    return { balance: 0, blockedCredits: 0 };
  }

  const data = snapshot.data() || {};
  return {
    balance: toNumber(data.balance, 0),
    blockedCredits: toNumber(data.blockedCredits, 0),
  };
}

async function changeUserCreditBalance(userId, delta, description, type, referenceId = null, extraFields = {}) {
  const creditRef = doc(db, 'user_credits', userId);
  let balanceAfter = 0;

  await runTransaction(db, async (transaction) => {
    const creditDoc = await transaction.get(creditRef);
    const currentBalance = creditDoc.exists() ? toNumber(creditDoc.data().balance, 0) : 0;
    const nextBalance = currentBalance + toNumber(delta, 0);
    if (nextBalance < 0) {
      throw new Error('Yetersiz kredi bakiyesi.');
    }

    balanceAfter = nextBalance;
    transaction.set(creditRef, {
      balance: nextBalance,
      lastUpdated: nowIso(),
    }, { merge: true });
  });

  await addDoc(collection(db, 'credit_transactions'), {
    userId,
    amount: toNumber(delta, 0),
    type,
    description,
    referenceId,
    balanceAfter,
    timestamp: nowIso(),
    ...extraFields,
  });

  return balanceAfter;
}

export async function resolveTrainerContext(profile) {
  if (!profile?.uid) {
    throw new Error('Trainer oturumu bulunamadi.');
  }

  const trainerByUid = await getDocs(query(collection(db, 'trainers'), where('uid', '==', profile.uid), limit(1)));
  if (!trainerByUid.empty) {
    const record = trainerByUid.docs[0];
    const data = record.data() || {};
    return {
      id: profile.uid,
      uid: profile.uid,
      docId: record.id,
      name: data.name || profile.name || '',
      email: data.email || profile.email || '',
      adminId: data.adminId || profile.adminId || '',
      branches: Array.isArray(data.branches) ? data.branches : [],
      role: 'trainer',
    };
  }

  const userDoc = await getDoc(doc(db, 'users', profile.uid));
  if (userDoc.exists()) {
    const data = userDoc.data() || {};
    return {
      id: profile.uid,
      uid: profile.uid,
      docId: profile.uid,
      name: data.name || profile.name || '',
      email: data.email || profile.email || '',
      adminId: data.adminId || profile.adminId || '',
      branches: Array.isArray(data.branches) ? data.branches : [],
      role: 'trainer',
    };
  }

  return {
    id: profile.uid,
    uid: profile.uid,
    docId: profile.uid,
    name: profile.name || '',
    email: profile.email || '',
    adminId: profile.adminId || '',
    branches: Array.isArray(profile.branches) ? profile.branches : [],
    role: 'trainer',
  };
}

export async function getTrainerDashboardData(profile) {
  const trainer = await resolveTrainerContext(profile);
  const [branches, schedules, students, attendance, sales, creditRequests, withdrawals, credits] = await Promise.all([
    listAll('branches', [where('adminId', '==', trainer.adminId)]),
    listAll('schedules', [where('adminId', '==', trainer.adminId)]),
    listAll('students', [where('adminId', '==', trainer.adminId)]),
    listAll('attendance', [where('trainerId', '==', trainer.uid)]),
    listAll('workout_sales', [where('sellerId', '==', trainer.uid)]),
    listAll('credit_requests', [where('trainerId', '==', trainer.uid)]),
    listAll('cash_withdrawal_requests', [where('trainerId', '==', trainer.uid)]),
    getOrCreateCreditBalance(trainer.uid),
  ]);

  const trainerSchedules = schedules.filter((schedule) => scheduleBelongsToTrainer(schedule, trainer));
  const trainerScheduleIds = new Set(trainerSchedules.map((schedule) => schedule.id));
  const trainerStudents = students.filter((student) => trainerScheduleIds.has(student.scheduleId));
  const branchMap = buildTrainerBranchMap(branches);
  const salaryInput = trainerSchedules.map((item) => ({ ...item }));
  const salarySummary = summarizeTrainerSalary(
    salaryInput.map((item) => ({ ...item, branchName: branchMap[item.branchId]?.name || 'Bilinmiyor' })),
    trainer
  );
  const completionRows = buildCompletionRows(trainerStudents, trainerSchedules, branches, attendance);

  return {
    trainer,
    stats: [
      { label: 'Sube', value: new Set(trainerSchedules.map((item) => item.branchId).filter(Boolean)).size },
      { label: 'Ders Grubu', value: trainerSchedules.length },
      { label: 'Aktif Sporcu', value: trainerStudents.filter((item) => String(item.status || 'active') === 'active').length },
      { label: 'Kredi', value: credits.balance },
    ],
    salarySummary,
    upcomingClasses: trainerSchedules
      .map((schedule) => ({
        id: schedule.id,
        branchName: branches.find((item) => item.id === schedule.branchId)?.name || 'Bilinmiyor',
        time: schedule.time || '-',
        daysLabel: formatDayList(schedule.days || schedule.scheduleDays || []),
        lessonTypeLabel: getScheduleLessonTypeLabel(schedule),
        capacity: toNumber(schedule.capacity, 0),
        postponementCount: getSchedulePostponementCount(schedule),
      }))
      .sort((left, right) => String(left.time).localeCompare(String(right.time), 'tr')),
    alerts: completionRows.slice(0, 8),
    salesSummary: {
      mySales: sales.length,
      pendingCreditRequests: creditRequests.filter((item) => item.status === 'pending').length,
      pendingWithdrawals: withdrawals.filter((item) => item.status === 'pending').length,
    },
  };
}

export async function getTrainerClassesOverview(profile) {
  const trainer = await resolveTrainerContext(profile);
  const [branches, schedules, students, attendance, preferences, recentComments] = await Promise.all([
    listAll('branches', [where('adminId', '==', trainer.adminId)]),
    listAll('schedules', [where('adminId', '==', trainer.adminId)]),
    listAll('students', [where('adminId', '==', trainer.adminId)]),
    listAll('attendance', [where('trainerId', '==', trainer.uid)]),
    listAll('trainer_time_preferences', [where('adminId', '==', trainer.adminId), where('trainerId', '==', trainer.uid)]),
    listAll('lesson_comments', [where('trainerId', '==', trainer.uid)]),
  ]);

  const trainerSchedules = schedules.filter((schedule) => scheduleBelongsToTrainer(schedule, trainer));
  const trainerScheduleIds = new Set(trainerSchedules.map((item) => item.id));
  const trainerStudents = students.filter((student) => trainerScheduleIds.has(student.scheduleId));
  const templateDocs = await Promise.all(
    branches.map(async (branch) => {
      const snapshot = await getDoc(doc(db, 'trainer_time_programs', `${trainer.adminId}_${branch.id}`));
      return [branch.id, snapshot.exists() ? snapshot.data() : null];
    })
  );

  const availabilityTemplates = Object.fromEntries(templateDocs.map(([branchId, data]) => [branchId, getNormalizedDailySlots(data)]));
  const preferenceByBranch = preferences.reduce((result, item) => {
    result[item.branchId] = {
      id: item.id,
      dailySlots: getNormalizedDailySlots(item),
    };
    return result;
  }, {});

  const groupedSchedules = trainerSchedules
    .map((schedule) => ({
      schedule,
      branch: branches.find((item) => item.id === schedule.branchId) || null,
      students: trainerStudents.filter((student) => student.scheduleId === schedule.id),
    }))
    .sort((left, right) => String(left.schedule.time || '').localeCompare(String(right.schedule.time || ''), 'tr'));

  return {
    trainer,
    branches,
    schedules: trainerSchedules,
    students: trainerStudents,
    groupedSchedules,
    availabilityTemplates,
    preferenceByBranch,
    availabilitySummary: preferences.map((item) => {
      const branch = branches.find((entry) => entry.id === item.branchId);
      const dailySlots = getNormalizedDailySlots(item);
      const daySummary = Object.entries(dailySlots)
        .filter(([, slots]) => slots.length)
        .map(([key, slots]) => `${dayLabels[key]}: ${slots.join(', ')}`)
        .join(' | ');
      return {
        id: item.id,
        branchId: item.branchId,
        branchName: branch?.name || 'Bilinmiyor',
        daySummary,
      };
    }),
    attendanceMap: buildAttendanceMap(attendance),
    completionRows: buildCompletionRows(trainerStudents, trainerSchedules, branches, attendance),
    recentComments: sortByDateDesc(recentComments).slice(0, 10),
  };
}

export async function saveTrainerAvailability({ profile, branchId, dayKey, slots }) {
  const trainer = await resolveTrainerContext(profile);
  if (!branchId) throw new Error('Sube secilmedi.');
  if (!dayKey) throw new Error('Gun secilmedi.');
  if (!Array.isArray(slots) || !slots.length) throw new Error('En az bir saat secin.');

  const docId = `${trainer.adminId}_${branchId}_${trainer.uid}`;
  const ref = doc(db, 'trainer_time_preferences', docId);
  const snapshot = await getDoc(ref);
  const dailySlots = getNormalizedDailySlots(snapshot.exists() ? snapshot.data() : null);
  dailySlots[dayKey] = [...slots].sort();

  await setDoc(ref, {
    adminId: trainer.adminId,
    branchId,
    trainerId: trainer.uid,
    trainerDocId: trainer.docId,
    slots: dailySlots[dayKey],
    dailySlots,
    updatedAt: nowIso(),
    createdAt: snapshot.exists() ? (snapshot.data()?.createdAt || nowIso()) : nowIso(),
  }, { merge: true });
}

export async function toggleTrainerLessonAttendance({ profile, studentId, scheduleId, lessonNumber, date = todayIsoDate(), nextState }) {
  const trainer = await resolveTrainerContext(profile);
  const studentSnapshot = await getDoc(doc(db, 'students', studentId));
  const student = studentSnapshot.exists() ? { id: studentSnapshot.id, ...studentSnapshot.data() } : null;
  const existingSnap = await getDocs(query(
    collection(db, 'attendance'),
    where('studentId', '==', studentId),
    where('scheduleId', '==', scheduleId),
    where('lessonNumber', '==', lessonNumber)
  ));

  const records = existingSnap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((left, right) => getAttendanceRecordTimestamp(right) - getAttendanceRecordTimestamp(left));

  const currentState = records.length ? records[0].present : null;
  let resolvedNextState = nextState;
  if (typeof resolvedNextState !== 'boolean' && resolvedNextState !== null) {
    resolvedNextState = true;
    if (currentState === true) resolvedNextState = false;
    if (currentState === false) resolvedNextState = null;
  }

  if (records.length) {
    const latestRef = doc(db, 'attendance', records[0].id);
    if (resolvedNextState === null) {
      await deleteDoc(latestRef);
    } else {
      await updateDoc(latestRef, {
        present: resolvedNextState,
        date,
        adminId: trainer.adminId || '',
        updatedAt: nowIso(),
      });
    }
  } else if (resolvedNextState !== null) {
    await addDoc(collection(db, 'attendance'), {
      studentId,
      scheduleId,
      trainerId: trainer.uid,
      lessonNumber,
      date,
      present: resolvedNextState,
      adminId: trainer.adminId || '',
      createdAt: nowIso(),
    });
  }

  if (student && resolvedNextState !== null) {
    const attendanceLabel = resolvedNextState ? 'katildi' : 'katilmadi';
    await notifyStudentParent(student, {
      title: 'Yoklama guncellendi',
      message: `${getStudentDisplayName(student)} icin ${date} tarihli ders yoklamasi ${attendanceLabel} olarak kaydedildi.`,
      type: 'attendance_updated',
      data: {
        lessonNumber,
        present: resolvedNextState,
        date,
        trainerId: trainer.uid,
      },
    });
  }

  return resolvedNextState;
}

export async function saveTrainerComment({ profile, studentId, topic, comment, lessonDate }) {
  const trainer = await resolveTrainerContext(profile);
  if (!studentId || !topic?.trim() || !comment?.trim() || !lessonDate) {
    throw new Error('Tum yorum alanlarini doldurun.');
  }

  const studentSnapshot = await getDoc(doc(db, 'students', studentId));
  if (!studentSnapshot.exists()) {
    throw new Error('Ogrenci bulunamadi.');
  }

  const student = studentSnapshot.data() || {};
  await addDoc(collection(db, 'lesson_comments'), {
    studentId,
    studentName: [student.name, student.surname].filter(Boolean).join(' '),
    trainerId: trainer.uid,
    trainerName: trainer.name,
    adminId: trainer.adminId || '',
    scheduleId: student.scheduleId || '',
    branchId: student.branchId || '',
    topic: topic.trim(),
    comment: comment.trim(),
    lessonDate,
    createdAt: nowIso(),
  });
}

export async function getTrainerPerformanceOverview(profile) {
  const trainer = await resolveTrainerContext(profile);
  const standardQueryPromises = [
    // New global standards from superadmin panel
    listAll('standards', [where('scopeType', '==', 'global')]).catch(() => []),
    // Legacy global standards that may not have scopeType but keep adminId as null
    listAll('standards', [where('adminId', '==', null)]).catch(() => []),
  ];
  if (trainer.adminId) {
    standardQueryPromises.push(
      listAll('standards', [where('adminId', '==', trainer.adminId)]).catch(() => []),
    );
  }
  if (trainer.uid) {
    standardQueryPromises.push(
      listAll('standards', [where('trainerId', '==', trainer.uid)]).catch(() => []),
    );
  }
  if (trainer.docId && trainer.docId !== trainer.uid) {
    standardQueryPromises.push(
      listAll('standards', [where('trainerId', '==', trainer.docId)]).catch(() => []),
    );
  }

  const [branches, trainerSchedules, ...standardBatches] = await Promise.all([
    listAll('branches', [where('adminId', '==', trainer.adminId)]),
    fetchTrainerSchedules(trainer),
    ...standardQueryPromises,
  ]);

  let allStandards = standardBatches.flat();
  if (!allStandards.length) {
    allStandards = await listAll('standards').catch(() => []);
  }

  const seenStandardIds = new Set();
  allStandards = allStandards.filter((standard) => {
    if (!standard?.id || seenStandardIds.has(standard.id)) return false;
    seenStandardIds.add(standard.id);
    return true;
  });

  const trainerScheduleIds = new Set(trainerSchedules.map((item) => item.id));
  const trainerStudents = (await fetchStudentsByScheduleIds(trainerSchedules.map((item) => item.id)))
    .filter((student) => trainerScheduleIds.has(student.scheduleId));
  const performances = await fetchPerformancesByStudentIds(trainerStudents.map((item) => item.id));

  const standards = allStandards
    .filter((standard) => isStandardVisibleToTrainer(trainer, standard))
    .sort((left, right) => Number(right.birthYear || 0) - Number(left.birthYear || 0) || String(left.name || '').localeCompare(String(right.name || ''), 'tr'));

  return {
    trainer,
    branches,
    schedules: trainerSchedules,
    students: trainerStudents,
    performances: sortByDateDesc(performances, 'date'),
    standards: standards.map((standard) => ({
      ...standard,
      readableTitle: getReadableStandardTitle(standard),
    })),
  };
}

export async function saveTrainerPerformance({ profile, studentId, style, distance, time, date, type }) {
  const trainer = await resolveTrainerContext(profile);
  if (!studentId || !style || !distance || !time || !date) {
    throw new Error('Tum performans alanlarini doldurun.');
  }

  if (!/^(\d{1,2}):(\d{2})\.(\d{1,2})$/.test(String(time).trim())) {
    throw new Error('Derece formati hatali. Ornek: 1:20.45');
  }

  const payload = {
    studentId,
    trainerId: trainer.uid,
    adminId: trainer.adminId,
    style,
    distance: toNumber(distance, 0),
    time: String(time).trim(),
    type: type || 'training',
    date,
    createdAt: nowIso(),
  };

  const docRef = await addDoc(collection(db, 'performances'), payload);
  const studentSnapshot = await getDoc(doc(db, 'students', studentId));
  if (studentSnapshot.exists()) {
    const student = { id: studentSnapshot.id, ...studentSnapshot.data() };
    await notifyStudentParent(student, {
      title: 'Yeni performans derecesi',
      message: `${getStudentDisplayName(student)} icin ${distance}m ${style} derecesi girildi: ${time}.`,
      type: 'performance_recorded',
      data: {
        performanceId: docRef.id,
        trainerId: trainer.uid,
        style,
        distance: toNumber(distance, 0),
        time,
        date,
      },
    });
  }
  return { id: docRef.id, ...payload };
}

function buildPerformanceStandardStatus(student, performance, standards) {
  const birthYear = getStudentBirthYear(student);
  if (!birthYear) {
    return {
      passed: false,
      label: 'Dogum yili eksik',
      barajName: null,
      deltaSeconds: null,
      standard: null,
    };
  }
  const normalizedStyle = normalizePerformanceStyleToStandard(performance.style);
  const referenceSeconds = timeToSeconds(performance.time);
  if (!Number.isFinite(referenceSeconds)) {
    return {
      passed: false,
      label: 'Gecersiz derece',
      barajName: null,
      deltaSeconds: null,
      standard: null,
    };
  }

  const matchingStandards = standards.filter((standard) => {
    const sameOrOlderGroup = doesStandardMatchBirthYear(standard, birthYear);
    // Normalize both sides so web Turkish values (Kurbağalama) match mobile values (Kurbaga)
    const sameStyle = normalizePerformanceStyleToStandard(standard.style) === normalizedStyle;
    const sameDistance = Number(standard.distance || 0) === Number(performance.distance || 0);
    const studentGender = normalizeGenderToken(student.gender);
    const standardGender = normalizeGenderToken(standard.gender);
    const sameGender = !studentGender || !standardGender || studentGender === standardGender;
    return sameOrOlderGroup && sameStyle && sameDistance && sameGender && Number.isFinite(timeToSeconds(standard.time));
  });

  if (!matchingStandards.length) {
    return {
      passed: false,
      label: 'Eslesen baraj yok',
      barajName: null,
      deltaSeconds: null,
      standard: null,
      passedStandards: [],
    };
  }

  // Sort by threshold time ascending (hardest first)
  const sorted = [...matchingStandards].sort((a, b) => timeToSeconds(a.time) - timeToSeconds(b.time));

  // Find the hardest barrier the athlete has passed
  const passedStandard = sorted.find((standard) => referenceSeconds <= timeToSeconds(standard.time));
  const passedStandards = sorted.filter((standard) => referenceSeconds <= timeToSeconds(standard.time));

  if (passedStandard) {
    const delta = timeToSeconds(passedStandard.time) - referenceSeconds;
    return {
      passed: true,
      label: `${getReadableStandardTitle(passedStandard)} baraji gecildi`,
      barajName: getReadableStandardTitle(passedStandard),
      deltaSeconds: delta,
      standard: passedStandard,
      passedStandards,
    };
  }

  // Missed — show closest barrier
  const closestMissed = sorted[sorted.length - 1];
  const delta = referenceSeconds - timeToSeconds(closestMissed.time);
  return {
    passed: false,
    label: `${getReadableStandardTitle(closestMissed)} baraji kacirdi`,
    barajName: getReadableStandardTitle(closestMissed),
    deltaSeconds: delta,
    standard: closestMissed,
    passedStandards: [],
  };
}

export async function getTrainerCommerceOverview(profile) {
  const trainer = await resolveTrainerContext(profile);
  const [branches, schedules, workouts, allSales, products, creditPackages, orders, creditRequests, withdrawals, workoutLibrary, creditInfo, bankSettings, exchangeRate, favorites, campaigns] = await Promise.all([
    listAll('branches', [where('adminId', '==', trainer.adminId)]),
    listAll('schedules', [where('adminId', '==', trainer.adminId)]),
    listAll('workouts', [where('trainerId', '==', trainer.uid)]),
    listAll('workout_sales'),
    listAll('products'),
    listAll('credit_packages'),
    listAll('orders', [where('buyerId', '==', trainer.uid)]),
    listAll('credit_requests', [where('trainerId', '==', trainer.uid)]),
    listAll('cash_withdrawal_requests', [where('trainerId', '==', trainer.uid)]),
    listAll('workout_library', [where('buyerId', '==', trainer.uid)]).catch(() => []),
    getOrCreateCreditBalance(trainer.uid),
    getDoc(doc(db, 'app_settings', 'credit_purchase_bank')),
    getDoc(doc(db, 'app_settings', 'credit_exchange_rate')),
    listUserMarketFavorites(trainer.uid),
    listVisibleMarketCampaigns({ adminId: trainer.adminId || '' }),
  ]);

  const mySales = allSales
    .filter((sale) => sale.sellerId === trainer.uid)
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
  const trainerSchedules = schedules.filter((schedule) => scheduleBelongsToTrainer(schedule, trainer));
  const marketSales = allSales
    .filter((sale) => sale.status === 'active' && sale.sellerId !== trainer.uid && (!trainer.adminId || sale.adminId === trainer.adminId))
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());

  return {
    trainer,
    branches,
    schedules: trainerSchedules,
    creditBalance: creditInfo.balance,
    blockedCredits: creditInfo.blockedCredits,
    workouts: sortByDateDesc(workouts),
    mySales,
    marketSales,
    products: products.sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'tr')),
    creditPackages: [...creditPackages].sort((left, right) => toNumber(left.credit, 0) - toNumber(right.credit, 0)),
    orders: sortByDateDesc(orders).map(normalizeMarketOrder),
    creditRequests: sortByDateDesc(creditRequests),
    withdrawals: sortByDateDesc(withdrawals),
    workoutLibrary: sortByDateDesc(workoutLibrary, 'purchasedAt'),
    creditPurchaseSettings: bankSettings.exists() ? bankSettings.data() : null,
    exchangeRate: exchangeRate.exists() ? exchangeRate.data() : null,
    favoriteProductIds: favorites.map((item) => item.productId),
    campaigns,
  };
}

export async function getTrainerMarketOverview(profile) {
  const trainer = await resolveTrainerContext(profile);
  const [products, orders, credits, settingsSnapshot, favorites, campaigns] = await Promise.all([
    listAll('products'),
    listAll('orders', [where('buyerId', '==', trainer.uid)]).catch(() => []),
    getOrCreateCreditBalance(trainer.uid),
    getDoc(doc(db, 'app_settings', 'credit_purchase_bank')).catch(() => null),
    listUserMarketFavorites(trainer.uid),
    listVisibleMarketCampaigns({ adminId: trainer.adminId || '' }),
  ]);

  const settings = settingsSnapshot?.exists?.() ? settingsSnapshot.data() || {} : {};

  return {
    trainer,
    products: products.sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'tr')),
    orders: sortByDateDesc(orders).map((order) => normalizeMarketOrder(order)),
    creditBalance: toNumber(credits?.balance, 0),
    blockedCredits: toNumber(credits?.blockedCredits, 0),
    favoriteProductIds: favorites.map((item) => item.productId),
    campaigns,
    bankSettings: {
      bankName: settings.bankName || '',
      accountHolder: settings.accountHolder || '',
      iban: settings.iban || '',
      note: settings.note || '',
    },
    defaults: {
      buyerPhone: String(profile?.phone || '').trim(),
      shippingAddress: String(profile?.address || '').trim(),
    },
  };
}

function normalizeWorkoutExercisePayload(exercises = []) {
  return (exercises || [])
    .map((exercise) => ({
      distance: Math.max(0, toNumber(exercise.distance, 0)),
      style: String(exercise.style || '').trim(),
      reps: Math.max(1, toNumber(exercise.reps, 1)),
      intervalSeconds: Math.max(1, toNumber(exercise.intervalSeconds, 30)),
      restSeconds: Math.max(0, toNumber(exercise.restSeconds, 0)),
    }))
    .filter((exercise) => exercise.distance > 0 && exercise.style && exercise.intervalSeconds > 0);
}

function normalizeWorkoutBlocks(workoutBlocks = [], fallbackExercises = []) {
  const normalizedBlocks = (workoutBlocks || [])
    .map((block, index) => {
      const exercises = normalizeWorkoutExercisePayload(block?.exercises || []);
      if (!exercises.length) {
        return null;
      }

      return {
        name: String(block?.name || `Blok ${index + 1}`).trim(),
        repeatCount: Math.max(1, toNumber(block?.repeatCount, 1)),
        roundRestSeconds: Math.max(0, toNumber(block?.roundRestSeconds, 0)),
        exercises,
      };
    })
    .filter(Boolean);

  if (normalizedBlocks.length) {
    return normalizedBlocks;
  }

  const fallback = normalizeWorkoutExercisePayload(fallbackExercises);
  if (!fallback.length) {
    return [];
  }

  return [{
    name: 'Blok 1',
    repeatCount: 1,
    roundRestSeconds: 0,
    exercises: fallback,
  }];
}

export async function saveWorkout({ profile, name, scheduleId, exercises, workoutBlocks }) {
  const trainer = await resolveTrainerContext(profile);
  if (!name?.trim() || !scheduleId) throw new Error('Workout adi ve ders grubu gerekli.');
  const cleanExercises = normalizeWorkoutExercisePayload(exercises);
  const normalizedBlocks = normalizeWorkoutBlocks(workoutBlocks, cleanExercises);

  if (!cleanExercises.length) throw new Error('En az bir gecerli egzersiz girin.');

  const workoutRef = await addDoc(collection(db, 'workouts'), {
    name: name.trim(),
    exercises: cleanExercises,
    workoutBlocks: normalizedBlocks,
    scheduleId,
    trainerId: trainer.uid,
    adminId: trainer.adminId || null,
    published: true,
    sharedAt: nowIso(),
    createdAt: nowIso(),
  });

  const studentsInClass = await listAll('students', [where('adminId', '==', trainer.adminId)]);
  const recipients = studentsInClass.filter((student) => student.scheduleId === scheduleId);
  for (const student of recipients) {
    await addDoc(collection(db, 'student_workouts'), {
      studentId: student.id,
      workoutId: workoutRef.id,
      scheduleId,
      trainerId: trainer.uid,
      adminId: trainer.adminId || null,
      createdAt: nowIso(),
      completed: false,
    });
  }

  return workoutRef.id;
}

export async function updateWorkout({ profile, workoutId, name, scheduleId, exercises, workoutBlocks }) {
  const trainer = await resolveTrainerContext(profile);
  if (!workoutId) throw new Error('Duzenlenecek workout secilmedi.');
  if (!name?.trim() || !scheduleId) throw new Error('Workout adi ve ders grubu gerekli.');

  const workoutRef = doc(db, 'workouts', workoutId);
  const workoutSnapshot = await getDoc(workoutRef);
  if (!workoutSnapshot.exists()) {
    throw new Error('Workout bulunamadi.');
  }

  const workout = workoutSnapshot.data() || {};
  if (workout.trainerId && workout.trainerId !== trainer.uid) {
    throw new Error('Bu workoutu duzenleme yetkiniz yok.');
  }

  const cleanExercises = normalizeWorkoutExercisePayload(exercises);
  const normalizedBlocks = normalizeWorkoutBlocks(workoutBlocks, cleanExercises);
  if (!cleanExercises.length) {
    throw new Error('En az bir gecerli egzersiz girin.');
  }

  await updateDoc(workoutRef, {
    name: name.trim(),
    exercises: cleanExercises,
    workoutBlocks: normalizedBlocks,
    scheduleId,
    updatedAt: nowIso(),
  });

  return workoutId;
}

export async function deleteWorkoutCascade(workoutId) {
  await deleteDoc(doc(db, 'workouts', workoutId));
  const [studentWorkouts, workoutSales] = await Promise.all([
    listAll('student_workouts', [where('workoutId', '==', workoutId)]),
    listAll('workout_sales', [where('workoutId', '==', workoutId)]),
  ]);

  await Promise.all([
    ...studentWorkouts.map((item) => deleteDoc(doc(db, 'student_workouts', item.id))),
    ...workoutSales.map((item) => deleteDoc(doc(db, 'workout_sales', item.id))),
    deleteDoc(doc(db, 'active_workouts', workoutId)).catch(() => null),
  ]);
}

export async function sellWorkout({ profile, workoutId, name, description, ageGroup, target, style, distance, workoutType, credit }) {
  const trainer = await resolveTrainerContext(profile);
  if (!workoutId || !name?.trim() || !description?.trim() || !ageGroup?.trim() || !target?.trim()) {
    throw new Error('Satis formundaki zorunlu alanlari doldurun.');
  }
  if (toNumber(credit, 0) < 1) {
    throw new Error('Workout satisi icin en az 1 kredi belirleyin.');
  }

  const workoutSnapshot = await getDoc(doc(db, 'workouts', workoutId));
  if (!workoutSnapshot.exists()) {
    throw new Error('Workout bulunamadi.');
  }

  const workout = workoutSnapshot.data() || {};
  await addDoc(collection(db, 'workout_sales'), {
    workoutId,
    sellerId: trainer.uid,
    sellerName: trainer.name,
    sellerEmail: trainer.email,
    name: name.trim(),
    description: description.trim(),
    ageGroup: ageGroup.trim(),
    target: target.trim(),
    style: style || 'Karma',
    distance: distance || 'Karma',
    workoutType: workoutType || 'general',
    credit: toNumber(credit, 0),
    exercises: Array.isArray(workout.exercises) ? workout.exercises : [],
    workoutBlocks: Array.isArray(workout.workoutBlocks) ? workout.workoutBlocks : [],
    adminId: trainer.adminId,
    createdAt: nowIso(),
    status: 'active',
    purchaseRequests: [],
    negotiations: [],
    specialOffers: {},
  });
}

export async function removeWorkoutSale(saleId) {
  await deleteDoc(doc(db, 'workout_sales', saleId));
}

export async function submitWorkoutOffer({ profile, saleId, offer, message }) {
  const trainer = await resolveTrainerContext(profile);
  if (!saleId) throw new Error('Workout secilmedi.');
  if (toNumber(offer, 0) < 1) throw new Error('Gecerli bir teklif girin.');
  const saleRef = doc(db, 'workout_sales', saleId);
  const saleSnapshot = await getDoc(saleRef);
  if (!saleSnapshot.exists()) throw new Error('Satis kaydi bulunamadi.');

  const sale = saleSnapshot.data() || {};
  const nextNegotiations = Array.isArray(sale.negotiations) ? [...sale.negotiations] : [];
  nextNegotiations.push({
    from: trainer.uid,
    fromName: trainer.name,
    offer: toNumber(offer, 0),
    message: message?.trim() || '',
    timestamp: nowIso(),
  });

  await updateDoc(saleRef, {
    negotiations: nextNegotiations,
    updatedAt: nowIso(),
  });

  await createAppNotification({
    userId: sale.sellerId,
    title: 'Yeni workout teklifi',
    message: `${trainer.name}, ${sale.name} icin ${offer} kredi teklif etti.`,
    type: 'workout_negotiation',
    data: {
      saleId,
      buyerId: trainer.uid,
    },
  });
}

export async function approveWorkoutOffer({ saleId, buyerId, buyerName, approvedPrice, sellerName }) {
  if (toNumber(approvedPrice, 0) < 1) {
    throw new Error('Gecerli bir ozel fiyat girin.');
  }
  const saleRef = doc(db, 'workout_sales', saleId);
  const saleSnapshot = await getDoc(saleRef);
  if (!saleSnapshot.exists()) throw new Error('Satis kaydi bulunamadi.');
  const sale = saleSnapshot.data() || {};
  const specialOffers = { ...(sale.specialOffers || {}) };
  specialOffers[buyerId] = {
    buyerId,
    buyerName: buyerName || 'Kullanici',
    price: toNumber(approvedPrice, 0),
    status: 'accepted',
    acceptedAt: nowIso(),
    originalPrice: toNumber(sale.credit, 0),
    message: `${sellerName || sale.sellerName || 'Satici'} sana ozel fiyat tanimladi.`,
  };

  await updateDoc(saleRef, {
    specialOffers,
    updatedAt: nowIso(),
  });

  await createAppNotification({
    userId: buyerId,
    title: 'Workout teklifi onaylandi',
    message: `${sale.name} icin ${approvedPrice} kredi ozel fiyat tanimlandi.`,
    type: 'workout_negotiation_accepted',
    data: {
      saleId,
      sellerId: sale.sellerId,
    },
  });
}

export async function buyWorkoutSale({ profile, saleId }) {
  const trainer = await resolveTrainerContext(profile);
  const saleRef = doc(db, 'workout_sales', saleId);
  const saleSnapshot = await getDoc(saleRef);
  if (!saleSnapshot.exists()) throw new Error('Workout satisi bulunamadi.');
  const sale = saleSnapshot.data() || {};
  const specialOffer = sale.specialOffers?.[trainer.uid] && sale.specialOffers[trainer.uid].status === 'accepted'
    ? sale.specialOffers[trainer.uid]
    : null;
  const finalPrice = specialOffer ? toNumber(specialOffer.price, 0) : toNumber(sale.credit, 0);

  if (finalPrice <= 0) throw new Error('Gecersiz satis bedeli.');

  await changeUserCreditBalance(trainer.uid, -finalPrice, `${sale.name} workout satin alindi`, 'workout_purchase', saleId, {
    sellerId: sale.sellerId,
  });
  await changeUserCreditBalance(sale.sellerId, finalPrice, `${sale.name} workout satildi`, 'workout_sale', saleId, {
    buyerId: trainer.uid,
  });

  await addDoc(collection(db, 'workout_library'), {
    buyerId: trainer.uid,
    buyerName: trainer.name,
    sellerId: sale.sellerId,
    sellerName: sale.sellerName,
    workoutSaleId: saleId,
    workoutName: sale.name,
    ageGroup: sale.ageGroup,
    target: sale.target,
    style: sale.style,
    distance: sale.distance,
    workoutType: sale.workoutType,
    exercises: Array.isArray(sale.exercises) ? sale.exercises : [],
    workoutBlocks: Array.isArray(sale.workoutBlocks) ? sale.workoutBlocks : [],
    price: finalPrice,
    purchasedAt: nowIso(),
    contentIncluded: true,
    contentLockedUntilPurchase: false,
  });

  if (specialOffer) {
    const specialOffers = { ...(sale.specialOffers || {}) };
    specialOffers[trainer.uid] = {
      ...specialOffer,
      status: 'used',
      usedAt: nowIso(),
    };
    await updateDoc(saleRef, { specialOffers });
  }

  await createAppNotification({
    userId: sale.sellerId,
    title: 'Workout satildi',
    message: `${trainer.name}, ${sale.name} workoutunu satin aldi.`,
    type: 'workout_sold',
    data: {
      saleId,
      buyerId: trainer.uid,
    },
  });
}

export async function deletePurchasedWorkoutLibraryItem({ profile, libraryItemId }) {
  const trainer = await resolveTrainerContext(profile);
  if (!libraryItemId) throw new Error('Silinecek workout secilmedi.');
  const libraryRef = doc(db, 'workout_library', libraryItemId);
  const librarySnapshot = await getDoc(libraryRef);
  if (!librarySnapshot.exists()) throw new Error('Satin alinan workout bulunamadi.');

  const item = librarySnapshot.data() || {};
  if (item.buyerId !== trainer.uid) {
    throw new Error('Bu workout kaydini silme yetkiniz yok.');
  }

  await deleteDoc(libraryRef);
}

export async function getTrainerActiveWorkoutControl(profile) {
  const trainer = await resolveTrainerContext(profile);
  const controlRef = doc(db, 'active_workouts', trainer.uid);
  const snapshot = await getDoc(controlRef);
  if (!snapshot.exists()) {
    return {
      id: trainer.uid,
      trainerId: trainer.uid,
      laneCount: 4,
      commandType: 'idle',
      commandNonce: '',
      selectedWorkoutId: '',
      updatedAt: '',
    };
  }

  return { id: snapshot.id, ...snapshot.data() };
}

export async function saveTrainerActiveWorkoutControl({ profile, commandType, commandNonce, selectedWorkoutId = '', laneCount, laneIndex }) {
  const trainer = await resolveTrainerContext(profile);
  const controlRef = doc(db, 'active_workouts', trainer.uid);
  const payload = {
    trainerId: trainer.uid,
    trainerName: trainer.name,
    adminId: trainer.adminId || '',
    updatedAt: nowIso(),
  };

  if (commandType) payload.commandType = commandType;
  if (commandNonce) payload.commandNonce = commandNonce;
  if (typeof selectedWorkoutId === 'string') payload.selectedWorkoutId = selectedWorkoutId;
  if (Number.isFinite(Number(laneCount))) payload.laneCount = Math.min(8, Math.max(1, Number(laneCount)));
  if (Number.isFinite(Number(laneIndex))) payload.laneIndex = Math.max(0, Number(laneIndex));

  await setDoc(controlRef, payload, { merge: true });
  return { id: trainer.uid, ...payload };
}

export async function startWorkoutSellerChat({ profile, saleId }) {
  const trainer = await resolveTrainerContext(profile);
  const saleSnapshot = await getDoc(doc(db, 'workout_sales', saleId));
  if (!saleSnapshot.exists()) throw new Error('Workout satisi bulunamadi.');
  const sale = saleSnapshot.data() || {};
  const sellerSnapshot = await getDoc(doc(db, 'users', sale.sellerId));
  const seller = sellerSnapshot.exists()
    ? { id: sale.sellerId, ...(sellerSnapshot.data() || {}) }
    : { id: sale.sellerId, name: sale.sellerName || 'Antrenor', email: sale.sellerEmail || '' };

  const chatId = await createOrReuseDirectChat({
    currentUser: { uid: trainer.uid, name: trainer.name, email: trainer.email },
    targetUser: { id: seller.id, name: seller.name || sale.sellerName || 'Antrenor', email: seller.email || sale.sellerEmail || '' },
  });

  await sendMessage(chatId, {
    senderId: trainer.uid,
    senderName: trainer.name,
    text: `Merhaba, ${sale.name} workoutu icin detayli gorusmek istiyorum.`,
  });

  return {
    id: chatId,
    type: 'direct',
    participants: [
      { uid: trainer.uid, name: trainer.name, email: trainer.email },
      { uid: seller.id, name: seller.name || sale.sellerName || 'Antrenor', email: seller.email || sale.sellerEmail || '' },
    ],
    userIds: [trainer.uid, seller.id],
    lastMessage: `Merhaba, ${sale.name} workoutu icin detayli gorusmek istiyorum.`,
    lastMessageTime: nowIso(),
  };
}

export async function submitTrainerMarketCheckout({ profile, items, paymentMethod, cardDetails, buyerPhone, shippingAddress, note }) {
  const trainer = await resolveTrainerContext(profile);
  const cleanPaymentMethod = String(paymentMethod || 'credit').trim().toLowerCase();
  const normalizedItems = normalizeCartItems(items, { useCredits: cleanPaymentMethod === 'credit' });
  if (!normalizedItems.length) {
    throw new Error('Sepette en az bir urun bulunmali.');
  }

  const cleanPhone = String(buyerPhone || profile?.phone || '').trim();
  const cleanAddress = String(shippingAddress || profile?.address || '').trim();

  if (!cleanPhone) {
    throw new Error('Iletisim telefonu gerekli.');
  }
  if (!cleanAddress) {
    throw new Error('Teslimat adresi gerekli.');
  }

  const totalAmount = roundCurrency(normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0));
  const totalCredits = normalizedItems.reduce((sum, item) => sum + item.lineCredits, 0);
  const itemCount = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);
  const orderTitle = getOrderTitle(normalizedItems);
  const orderRef = doc(collection(db, 'orders'));
  const cleanNote = String(note || '').trim();
  const cardSnapshot = cleanPaymentMethod === 'credit_card' ? buildCreditCardSnapshot(cardDetails) : {};

  if (cleanPaymentMethod === 'credit') {
    if (totalCredits <= 0) {
      throw new Error('Sepette kredi maliyeti tanimli olmayan urun bulunuyor.');
    }

    await runTransaction(db, async (transaction) => {
      const creditRef = doc(db, 'user_credits', trainer.uid);
      const creditDoc = await transaction.get(creditRef);
      const balance = creditDoc.exists() ? toNumber(creditDoc.data().balance, 0) : 0;
      const blockedCredits = creditDoc.exists() ? toNumber(creditDoc.data().blockedCredits, 0) : 0;
      if (balance < totalCredits) {
        throw new Error('Yetersiz kredi bakiyesi.');
      }

      transaction.set(creditRef, {
        balance: balance - totalCredits,
        blockedCredits,
        updatedAt: nowIso(),
      }, { merge: true });
      transaction.set(doc(collection(db, 'credit_transactions')), {
        userId: trainer.uid,
        delta: -totalCredits,
        balanceAfter: balance - totalCredits,
        description: `${orderTitle} market siparisi`,
        type: 'market_purchase',
        referenceId: orderRef.id,
        createdAt: nowIso(),
      });
      transaction.set(orderRef, {
        type: 'product',
        paymentMethod: 'credit',
        status: 'pending',
        statusHistory: buildInitialMarketStatusHistory({
          actorId: trainer.uid,
          actorRole: 'trainer',
        }),
        items: normalizedItems,
        itemCount,
        orderTitle,
        totalAmount,
        totalCredits,
        buyerId: trainer.uid,
        buyerName: trainer.name,
        buyerEmail: trainer.email,
        buyerRole: 'trainer',
        buyerPhone: cleanPhone,
        shippingAddress: cleanAddress,
        adminId: trainer.adminId || '',
        ...cardSnapshot,
        createdAt: nowIso(),
        note: cleanNote || 'Kredi ile satin alindi; teslim ve onay bekleniyor.',
        shippingCarrier: '',
        trackingNumber: '',
      });
    });
  } else {
    let settings = {};
    if (cleanPaymentMethod === 'iban') {
      const settingsSnapshot = await getDoc(doc(db, 'app_settings', 'credit_purchase_bank'));
      settings = settingsSnapshot.exists() ? settingsSnapshot.data() || {} : {};
    }
    await setDoc(orderRef, {
      type: 'product',
      paymentMethod: cleanPaymentMethod === 'credit_card' ? 'credit_card' : 'iban',
      status: 'pending',
      statusHistory: buildInitialMarketStatusHistory({
        actorId: trainer.uid,
        actorRole: 'trainer',
      }),
      items: normalizedItems,
      itemCount,
      orderTitle,
      totalAmount,
      totalCredits,
      buyerId: trainer.uid,
      buyerName: trainer.name,
      buyerEmail: trainer.email,
      buyerRole: 'trainer',
      buyerPhone: cleanPhone,
      shippingAddress: cleanAddress,
      adminId: trainer.adminId || '',
      createdAt: nowIso(),
      note: cleanNote,
      ibanSnapshot: cleanPaymentMethod === 'iban' ? (settings.iban || '') : '',
      bankNameSnapshot: cleanPaymentMethod === 'iban' ? (settings.bankName || '') : '',
      accountHolderSnapshot: cleanPaymentMethod === 'iban' ? (settings.accountHolder || '') : '',
      ...cardSnapshot,
      shippingCarrier: '',
      trackingNumber: '',
    });
  }

  await notifySuperAdminsAboutTrainerOrder(orderRef.id, orderTitle, trainer);
}

export async function buyTrainerProduct({ profile, productId }) {
  const productSnapshot = await getDoc(doc(db, 'products', productId));
  if (!productSnapshot.exists()) throw new Error('Urun bulunamadi.');
  const product = { id: productId, ...productSnapshot.data() };
  return submitTrainerMarketCheckout({
    profile,
    items: [{ id: product.id, name: product.name, price: product.price, creditCost: product.creditCost, quantity: 1 }],
    paymentMethod: 'credit',
    buyerPhone: profile?.phone || '',
    shippingAddress: profile?.address || '',
    note: 'Tek urun hizli satin alma akisi.',
  });
}

export async function submitCreditRequest({ profile, amount, description }) {
  const trainer = await resolveTrainerContext(profile);
  if (toNumber(amount, 0) <= 0 || !description?.trim()) {
    throw new Error('Kredi miktari ve aciklama gerekli.');
  }

  await addDoc(collection(db, 'credit_requests'), {
    trainerId: trainer.uid,
    trainerName: trainer.name,
    trainerEmail: trainer.email,
    amount: toNumber(amount, 0),
    description: description.trim(),
    status: 'pending',
    createdAt: nowIso(),
  });
}

export async function submitManualCreditPurchase({ profile, packageItem, note, receiptBase64, receiptMimeType, receiptFileName }) {
  const trainer = await resolveTrainerContext(profile);
  if (!packageItem?.id) throw new Error('Kredi paketi secilmedi.');
  if (!note?.trim()) throw new Error('Aciklama gerekli.');
  if (!receiptBase64) throw new Error('Dekont secilmedi.');

  const settingsSnapshot = await getDoc(doc(db, 'app_settings', 'credit_purchase_bank'));
  const settings = settingsSnapshot.exists() ? settingsSnapshot.data() || {} : null;
  if (!settings?.iban) throw new Error('Gecerli banka bilgisi bulunmuyor.');

  await addDoc(collection(db, 'orders'), {
    type: 'credit_package_purchase',
    packageId: packageItem.id,
    packageName: `${toNumber(packageItem.credit, 0)} Kredi Paketi`,
    packageCredit: toNumber(packageItem.credit, 0),
    buyerId: trainer.uid,
    buyerName: trainer.name,
    buyerEmail: trainer.email,
    buyerRole: 'trainer',
    totalAmount: toNumber(packageItem.price, 0),
    paymentMethod: 'iban',
    status: 'pending',
    note: note.trim(),
    receiptFileName: receiptFileName || 'dekont.jpg',
    receiptMimeType: receiptMimeType || 'image/jpeg',
    receiptDataUrl: `data:${receiptMimeType || 'image/jpeg'};base64,${receiptBase64}`,
    ibanSnapshot: settings.iban || '',
    bankNameSnapshot: settings.bankName || '',
    accountHolderSnapshot: settings.accountHolder || '',
    createdAt: nowIso(),
  });
}

export async function submitWithdrawalRequest({ profile, amount, paymentMethod, iban, accountName, walletAddress, network, coinType }) {
  const trainer = await resolveTrainerContext(profile);
  const numericAmount = toNumber(amount, 0);
  if (numericAmount <= 0) throw new Error('Gecerli bir kredi miktari girin.');

  const exchangeRateSnapshot = await getDoc(doc(db, 'app_settings', 'credit_exchange_rate'));
  if (!exchangeRateSnapshot.exists()) {
    throw new Error('Bozdurma orani tanimli degil.');
  }

  const rate = exchangeRateSnapshot.data() || {};
  const tlAmount = (numericAmount * toNumber(rate.turAmount, 0)) / Math.max(toNumber(rate.creditAmount, 1), 1);
  const creditRef = doc(db, 'user_credits', trainer.uid);
  const withdrawalRef = doc(collection(db, 'cash_withdrawal_requests'));

  await runTransaction(db, async (transaction) => {
    const creditDoc = await transaction.get(creditRef);
    const balance = creditDoc.exists() ? toNumber(creditDoc.data().balance, 0) : 0;
    const blockedCredits = creditDoc.exists() ? toNumber(creditDoc.data().blockedCredits, 0) : 0;
    if (balance < numericAmount) {
      throw new Error('Yeterli krediniz yok.');
    }

    transaction.set(creditRef, {
      balance: balance - numericAmount,
      blockedCredits: blockedCredits + numericAmount,
      lastUpdated: nowIso(),
    }, { merge: true });

    transaction.set(withdrawalRef, {
      trainerId: trainer.uid,
      trainerName: trainer.name,
      creditAmount: numericAmount,
      turAmount: tlAmount,
      paymentMethod,
      status: 'pending',
      iban: paymentMethod === 'eft' ? (iban || '') : '',
      accountName: paymentMethod === 'eft' ? (accountName || '') : '',
      walletAddress: paymentMethod === 'crypto' ? (walletAddress || '') : '',
      network: paymentMethod === 'crypto' ? (network || '') : '',
      coinType: paymentMethod === 'crypto' ? (coinType || '') : '',
      createdAt: nowIso(),
    });
  });

  await addDoc(collection(db, 'credit_transactions'), {
    userId: trainer.uid,
    amount: -numericAmount,
    type: 'cash_withdrawal_hold',
    description: `${numericAmount} kredi bozdurma icin bloke edildi`,
    referenceId: withdrawalRef.id,
    timestamp: nowIso(),
  });
}

export function buildTrainerPerformanceReport(students, performances, standards) {
  const performanceMap = performances.reduce((result, performance) => {
    if (!result[performance.studentId]) result[performance.studentId] = [];
    result[performance.studentId].push(performance);
    return result;
  }, {});

  return students.map((student) => {
    const studentPerformances = [...(performanceMap[student.id] || [])]
      .sort((left, right) => new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime());

    const grouped = studentPerformances.reduce((result, performance) => {
      const key = `${performance.style}_${performance.distance}_${performance.type || 'training'}`;
      const current = result[key] || {
        latest: null,
        previous: null,
        best: null,
        bestSeconds: Number.POSITIVE_INFINITY,
      };

      if (!current.latest) {
        current.latest = performance;
      } else if (!current.previous) {
        current.previous = performance;
      }

      const performanceSeconds = timeToSeconds(performance.time);
      if (Number.isFinite(performanceSeconds) && performanceSeconds < current.bestSeconds) {
        current.bestSeconds = performanceSeconds;
        current.best = performance;
      }

      result[key] = current;
      return result;
    }, {});

    const summary = Object.entries(grouped).map(([key, group]) => {
      const latest = group.latest || null;
      const previous = group.previous || null;
      const best = group.best || latest || null;
      const trendSeconds = latest && previous ? timeToSeconds(previous.time) - timeToSeconds(latest.time) : null;

      return {
        key,
        best,
        latest,
        previous,
        trendSeconds,
        standardStatus: latest ? buildPerformanceStandardStatus(student, latest, standards) : { passed: false, label: 'Kayit yok', barajName: null, deltaSeconds: null },
      };
    }).sort((left, right) => new Date(right.latest?.date || 0).getTime() - new Date(left.latest?.date || 0).getTime());

    return {
      student,
      summary,
    };
  });
}

export async function postponeTrainerLesson({ profile, scheduleId, postponeDate, reason = '' }) {
  const trainer = await resolveTrainerContext(profile);
  if (!scheduleId) throw new Error('Ders secilmedi.');
  if (!postponeDate) throw new Error('Erteleme tarihi gerekli.');

  const scheduleRef = doc(db, 'schedules', scheduleId);
  const scheduleSnapshot = await getDoc(scheduleRef);
  if (!scheduleSnapshot.exists()) {
    throw new Error('Ders kaydi bulunamadi.');
  }

  const schedule = { id: scheduleSnapshot.id, ...scheduleSnapshot.data() };
  if (!scheduleBelongsToTrainer(schedule, trainer)) {
    throw new Error('Bu ders icin erteleme yetkiniz yok.');
  }

  const normalizedDate = formatIsoDate(postponeDate);
  if (!normalizedDate) {
    throw new Error('Gecerli bir tarih secin.');
  }

  const eligibleDates = getSchedulePostponableDates(schedule);
  if (!eligibleDates.includes(normalizedDate)) {
    throw new Error('Bu tarih secilen ders gunleri arasinda degil veya zaten ertelenmis.');
  }

  const existingPostponements = getSchedulePostponements(schedule);
  if (existingPostponements.some((item) => item?.date === normalizedDate)) {
    throw new Error('Bu tarihte zaten erteleme kaydi var.');
  }

  const nextPostponements = existingPostponements.concat({
    id: `postpone_${Date.now()}`,
    date: normalizedDate,
    reason: String(reason || '').trim(),
    createdAt: nowIso(),
    createdBy: trainer.uid,
  });

  await updateDoc(scheduleRef, {
    postponements: nextPostponements,
    postponementCount: nextPostponements.length,
    updatedAt: nowIso(),
    updatedBy: trainer.uid,
  });
}

export async function getTrainerStudentsOverview(profile) {
  const trainer = await resolveTrainerContext(profile);
  const [branches, schedules, students, attendance] = await Promise.all([
    listAll('branches', [where('adminId', '==', trainer.adminId)]),
    listAll('schedules', [where('adminId', '==', trainer.adminId)]),
    listAll('students', [where('adminId', '==', trainer.adminId)]),
    listAll('attendance', [where('trainerId', '==', trainer.uid)]),
  ]);

  const trainerSchedules = schedules.filter((schedule) => scheduleBelongsToTrainer(schedule, trainer));
  const trainerScheduleIds = new Set(trainerSchedules.map((item) => item.id));
  const trainerStudents = students.filter((student) => trainerScheduleIds.has(student.scheduleId));
  const attendanceCountMap = buildTrainerAttendanceLessonCountMap(attendance);

  const groupedMap = {};
  trainerStudents.forEach((student) => {
    const schedule = trainerSchedules.find((item) => item.id === student.scheduleId);
    if (!schedule) return;
    const branch = branches.find((item) => item.id === student.branchId || item.id === schedule.branchId);
    const key = `${schedule.branchId || 'unknown'}_${schedule.id}`;
    if (!groupedMap[key]) {
      groupedMap[key] = {
        key,
        branchId: schedule.branchId || '',
        branchName: branch?.name || 'Bilinmiyor',
        scheduleId: schedule.id,
        scheduleName: schedule.time || '-',
        lessonTypeLabel: getScheduleLessonTypeLabel(schedule),
        lessonsCount: getScheduleLessonCount(schedule),
        postponementCount: getSchedulePostponementCount(schedule),
        students: [],
      };
    }

    const completedLessons = attendanceCountMap[`${student.id}_${schedule.id}`] || 0;
    const totalLessonTarget = Math.max(1, getScheduleLessonCount(schedule));
    const progressPercent = Math.min(100, Math.round((completedLessons / totalLessonTarget) * 100));
    groupedMap[key].students.push({
      ...student,
      completedLessons,
      totalLessonTarget,
      progressPercent,
      fullName: [student.name, student.surname].filter(Boolean).join(' ').trim() || 'Ogrenci',
    });
  });

  const groups = Object.values(groupedMap)
    .map((group) => ({
      ...group,
      students: group.students.sort((left, right) => left.fullName.localeCompare(right.fullName, 'tr')),
      averageProgress: group.students.length
        ? Math.round(group.students.reduce((sum, item) => sum + item.progressPercent, 0) / group.students.length)
        : 0,
    }))
    .sort((left, right) => String(left.scheduleName).localeCompare(String(right.scheduleName), 'tr'));

  return {
    trainer,
    groups,
    summary: {
      groupCount: groups.length,
      studentCount: trainerStudents.length,
      averageProgress: groups.length
        ? Math.round(groups.reduce((sum, item) => sum + item.averageProgress, 0) / groups.length)
        : 0,
    },
  };
}