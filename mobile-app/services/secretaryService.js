import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import { createManagedAuthUser } from '../api/authApi';
import { createOrReuseDirectChat } from '../api/chatApi';
import { db } from '../config/firebase';
import { nowIso, sortByDateDesc, todayIsoDate } from '../utils/date';
import { getAdminScope } from './roleService';

const cleanupCollections = [
  'payments',
  'attendance',
  'performances',
  'lesson_comments',
  'trainer_reviews',
  'student_workouts',
];

const dayLabels = {
  monday: 'Pzt',
  tuesday: 'Sal',
  wednesday: 'Car',
  thursday: 'Per',
  friday: 'Cum',
  saturday: 'Cmt',
  sunday: 'Paz',
};

function toNumber(value, fallback = 0) {
  if (value === '' || value === null || typeof value === 'undefined') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundCurrency(value) {
  return Math.round(toNumber(value, 0) * 100) / 100;
}

function parseDateValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(value) {
  const date = parseDateValue(value);
  if (!date) return '';
  return date.toISOString().slice(0, 10);
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function isStudentActive(student) {
  const status = String(student?.status || 'active').toLowerCase();
  return status !== 'inactive' && status !== 'deleted';
}

function buildParticipantTitle(chat, currentUserId) {
  if (chat.type === 'group') {
    return {
      title: chat.groupName || 'Grup Sohbeti',
      subtitle: `${Array.isArray(chat.userIds) ? chat.userIds.length : 0} uye`,
    };
  }

  const otherId = (chat.userIds || []).find((userId) => userId !== currentUserId);
  const otherUser = chat.users?.[otherId] || chat.participants?.find((item) => item.uid === otherId) || null;
  return {
    title: otherUser?.name || 'Birebir Sohbet',
    subtitle: otherUser?.role || otherUser?.email || 'Kullanici',
  };
}

function describeScheduleDays(schedule) {
  const values = Array.isArray(schedule?.days)
    ? schedule.days
    : Array.isArray(schedule?.scheduleDays)
      ? schedule.scheduleDays
      : [];
  if (!values.length) return '-';
  return values.map((day) => dayLabels[day] || day).join(', ');
}

function buildInstallmentAmounts(totalAmount, installmentCount) {
  const count = Math.max(1, toNumber(installmentCount, 1));
  const total = roundCurrency(totalAmount);
  if (!total || total <= 0) {
    return Array.from({ length: count }, () => 0);
  }

  const baseAmount = roundCurrency(total / count);
  const amounts = [];
  let distributed = 0;

  for (let index = 0; index < count; index += 1) {
    const nextAmount = index === count - 1 ? roundCurrency(total - distributed) : baseAmount;
    amounts.push(nextAmount);
    distributed = roundCurrency(distributed + nextAmount);
  }

  return amounts;
}

function buildDefaultInstallmentDate(index) {
  const date = new Date();
  date.setMonth(date.getMonth() + index);
  return date.toISOString().slice(0, 10);
}

export function buildSecretaryInstallmentPlanDraft({ totalAmount, installmentCount, previousInstallments = [] }) {
  const count = Math.max(1, toNumber(installmentCount, 1));
  const amounts = buildInstallmentAmounts(totalAmount, count);
  const existingMap = new Map(
    (Array.isArray(previousInstallments) ? previousInstallments : []).map((item, index) => [
      Number(item?.installmentNumber || index + 1),
      item || {},
    ])
  );

  return Array.from({ length: count }, (_, index) => {
    const installmentNumber = index + 1;
    const previous = existingMap.get(installmentNumber) || {};
    const amount = roundCurrency(amounts[index] || 0);
    const paidAmount = Math.min(roundCurrency(previous.paidAmount || 0), amount);

    return {
      installmentNumber,
      amount,
      dueDate: previous.dueDate || buildDefaultInstallmentDate(index),
      lessonLabel: previous.lessonLabel || '',
      paidAmount,
      paidAt: previous.paidAt || null,
      paid: paidAmount + 0.009 >= amount,
    };
  });
}

function getStudentInstallments(student) {
  if (Array.isArray(student?.installments) && student.installments.length) {
    return student.installments.map((item) => ({ ...item }));
  }

  return buildSecretaryInstallmentPlanDraft({
    totalAmount: student?.totalAmount || 0,
    installmentCount: student?.installmentCount || 1,
  });
}

function getNextPendingInstallment(student) {
  return getStudentInstallments(student).find((item) => {
    return roundCurrency(item.paidAmount || 0) + 0.009 < roundCurrency(item.amount || 0);
  }) || null;
}

function applyPaymentToInstallments(student, paymentAmount, paymentTimestamp) {
  const installments = getStudentInstallments(student);
  let remainingPayment = roundCurrency(paymentAmount);
  const allocations = [];

  installments.forEach((item) => {
    if (remainingPayment <= 0) return;

    const totalAmount = roundCurrency(item.amount || 0);
    const alreadyPaid = roundCurrency(item.paidAmount || 0);
    const remainingInstallment = Math.max(0, roundCurrency(totalAmount - alreadyPaid));
    if (remainingInstallment <= 0.009) return;

    const appliedAmount = Math.min(remainingPayment, remainingInstallment);
    if (appliedAmount <= 0) return;

    item.paidAmount = roundCurrency(alreadyPaid + appliedAmount);
    item.paid = item.paidAmount + 0.009 >= totalAmount;
    if (item.paid) {
      item.paidAt = paymentTimestamp;
    }

    remainingPayment = roundCurrency(remainingPayment - appliedAmount);
    allocations.push({
      installmentNumber: item.installmentNumber,
      appliedAmount,
      dueDate: item.dueDate || null,
      lessonLabel: item.lessonLabel || '',
    });
  });

  return { installments, allocations };
}

function getInstallmentAlerts(students, support) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return students
    .flatMap((student) => {
      const branch = support.branches.find((item) => item.id === student.branchId);
      const schedule = support.schedules.find((item) => item.id === student.scheduleId);
      return getStudentInstallments(student)
        .filter((installment) => roundCurrency(installment.paidAmount || 0) + 0.009 < roundCurrency(installment.amount || 0))
        .map((installment) => {
          const dueDate = parseDateValue(installment.dueDate);
          if (!dueDate) return null;
          dueDate.setHours(0, 0, 0, 0);
          const daysUntil = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return {
            studentId: student.id,
            studentName: `${student.name || ''} ${student.surname || ''}`.trim() || 'Ogrenci',
            branchName: branch?.name || 'Bilinmiyor',
            scheduleName: schedule?.time || 'Program yok',
            installmentNumber: installment.installmentNumber,
            dueDate: installment.dueDate,
            lessonLabel: installment.lessonLabel || '',
            remainingAmount: Math.max(0, roundCurrency(installment.amount || 0) - roundCurrency(installment.paidAmount || 0)),
            daysUntil,
          };
        })
        .filter(Boolean);
    })
    .filter((item) => item.daysUntil <= 3)
    .sort((left, right) => left.daysUntil - right.daysUntil)
    .slice(0, 8);
}

function mapStudent(student, support, payments = []) {
  const branch = support.branches.find((item) => item.id === student.branchId);
  const schedule = support.schedules.find((item) => item.id === student.scheduleId);
  const trainer = support.trainers.find((item) => item.id === student.trainerId || item.uid === student.trainerId);
  const installments = getStudentInstallments(student);
  const totalAmount = roundCurrency(student.totalAmount || 0);
  const totalPaid = roundCurrency(student.totalPaid || 0);
  const remainingBalance = Math.max(0, roundCurrency(totalAmount - totalPaid));
  const nextPendingInstallment = getNextPendingInstallment(student);

  return {
    ...student,
    fullName: `${student.name || ''} ${student.surname || ''}`.trim() || 'Ogrenci',
    branchName: branch?.name || 'Bilinmiyor',
    scheduleName: schedule?.time || 'Program yok',
    scheduleDaysLabel: describeScheduleDays(schedule),
    trainerName: trainer?.name || 'Atanmadi',
    installments,
    totalAmount,
    totalPaid,
    remainingBalance,
    nextPendingInstallment: nextPendingInstallment
      ? {
          ...nextPendingInstallment,
          remainingAmount: Math.max(
            0,
            roundCurrency(nextPendingInstallment.amount || 0) - roundCurrency(nextPendingInstallment.paidAmount || 0)
          ),
        }
      : null,
    paymentHistory: sortByDateDesc(
      payments.filter((item) => item.studentId === student.id),
      'timestamp'
    ),
  };
}

async function listAll(collectionName, constraints = []) {
  const snapshot = constraints.length
    ? await getDocs(query(collection(db, collectionName), ...constraints))
    : await getDocs(collection(db, collectionName));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function getUserById(userId) {
  if (!userId) return null;
  const snapshot = await getDoc(doc(db, 'users', userId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const snapshot = await getDocs(
    query(collection(db, 'users'), where('email', '==', normalizedEmail), limit(1))
  );
  if (snapshot.empty) return null;
  const item = snapshot.docs[0];
  return { id: item.id, ...item.data() };
}

async function getSecretarySupport(adminId, secretaryUid) {
  const [branches, schedules, trainers, students, prices, discounts, payments, chats] = await Promise.all([
    listAll('branches', [where('adminId', '==', adminId)]),
    listAll('schedules', [where('adminId', '==', adminId)]),
    listAll('trainers', [where('adminId', '==', adminId)]),
    listAll('students', [where('adminId', '==', adminId)]),
    listAll('prices', [where('adminId', '==', adminId)]),
    listAll('discounts', [where('adminId', '==', adminId)]),
    listAll('payments', [where('adminId', '==', adminId)]),
    listAll('chats', [where('userIds', 'array-contains', secretaryUid)]),
  ]);

  return { branches, schedules, trainers, students, prices, discounts, payments, chats };
}

function getScheduleAssignments(schedule) {
  if (Array.isArray(schedule?.trainerAssignments) && schedule.trainerAssignments.length) {
    return schedule.trainerAssignments;
  }

  if (!schedule?.trainerId && !schedule?.trainerDocId) return [];
  return [
    {
      trainerId: schedule?.trainerId || '',
      trainerDocId: schedule?.trainerDocId || '',
      role: 'head',
    },
  ];
}

function getSchedulePrice(prices, schedule, branchId) {
  if (!schedule) return 0;
  const keyByTime = `${branchId || schedule.branchId}_${schedule.time}`;
  const keyById = `${branchId || schedule.branchId}_${schedule.id}`;
  const match = prices.find((item) => item.id === keyByTime || item.key === keyByTime || item.id === keyById || item.key === keyById);
  return roundCurrency(match?.price || 0);
}

function buildLessonGroupChatId(adminId, branchId, scheduleId) {
  return ['lesson-group', adminId || 'global', branchId || 'unknown', scheduleId || 'unknown']
    .join('_')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function ensureLessonGroupChat({ profile, support, studentId, studentData, parentUid }) {
  const adminId = getAdminScope(profile);
  if (!studentData?.branchId || !studentData?.scheduleId || !adminId || !parentUid) return;

  const branch = support.branches.find((item) => item.id === studentData.branchId);
  const schedule = support.schedules.find((item) => item.id === studentData.scheduleId);
  const trainer = support.trainers.find((item) => item.id === studentData.trainerId || item.uid === studentData.trainerId);
  const trainerUserId = trainer?.uid || trainer?.id || '';

  if (!branch || !schedule || !trainerUserId) return;

  const chatId = buildLessonGroupChatId(adminId, branch.id, schedule.id);
  const chatRef = doc(db, 'chats', chatId);
  const chatSnapshot = await getDoc(chatRef);
  const existingData = chatSnapshot.exists() ? chatSnapshot.data() || {} : {};
  const [adminUser, trainerUser] = await Promise.all([getUserById(adminId), getUserById(trainerUserId)]);

  const participantMap = {
    [adminId]: {
      name: adminUser?.name || 'Kulup Yoneticisi',
      role: adminUser?.role || 'admin',
      email: adminUser?.email || '',
    },
    [profile.uid]: {
      name: profile.name || 'Sekreter',
      role: 'secretary',
      email: profile.email || '',
    },
    [trainerUserId]: {
      name: trainer?.name || trainerUser?.name || 'Antrenor',
      role: trainerUser?.role || 'trainer',
      email: trainer?.email || trainerUser?.email || '',
    },
    [parentUid]: {
      name: studentData.parentName || 'Veli',
      role: 'parent',
      email: studentData.parentEmail || '',
    },
  };

  const participantIds = Array.from(new Set(Object.keys(participantMap).filter(Boolean)));
  const nextUsers = { ...(existingData.users || {}) };
  participantIds.forEach((userId) => {
    nextUsers[userId] = {
      ...(nextUsers[userId] || {}),
      ...(participantMap[userId] || {}),
    };
  });

  await setDoc(
    chatRef,
    {
      type: 'group',
      lessonGroup: true,
      adminId,
      branchId: branch.id,
      scheduleId: schedule.id,
      trainerId: trainerUserId,
      studentIds: Array.from(new Set((existingData.studentIds || []).concat(studentId).filter(Boolean))),
      groupName: `${branch.name || 'Sube'} - ${schedule.time || 'Saat'}`,
      userIds: Array.from(new Set((existingData.userIds || []).concat(participantIds))),
      userEmails: Array.from(
        new Set((existingData.userEmails || []).concat(participantIds.map((userId) => participantMap[userId]?.email).filter(Boolean)))
      ),
      users: nextUsers,
      adminIds: Array.from(new Set((existingData.adminIds || []).concat([adminId, profile.uid]).filter(Boolean))),
      createdBy: existingData.createdBy || profile.uid,
      createdAt: existingData.createdAt || nowIso(),
      updatedAt: nowIso(),
      status: 'active',
      groupSettings: {
        ...(existingData.groupSettings || {}),
        messagingMode: 'all',
        autoCreated: true,
      },
      unreadCounts: existingData.unreadCounts || {},
    },
    { merge: true }
  );

  if (!chatSnapshot.exists()) {
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      senderId: profile.uid,
      senderName: profile.name,
      senderEmail: profile.email || '',
      text: `${studentData.name} ${studentData.surname} ogrencisi icin ders grubu olusturuldu.`,
      type: 'system',
      timestamp: nowIso(),
    });
  }
}

async function cleanupLessonGroupChatIfEmpty({ adminId, branchId, scheduleId }) {
  if (!adminId || !branchId || !scheduleId) return;

  const remainingStudents = await listAll('students', [
    where('adminId', '==', adminId),
    where('branchId', '==', branchId),
    where('scheduleId', '==', scheduleId),
  ]);

  if (remainingStudents.filter(isStudentActive).length > 0) return;

  const chatId = buildLessonGroupChatId(adminId, branchId, scheduleId);
  const chatSnapshot = await getDoc(doc(db, 'chats', chatId));
  if (!chatSnapshot.exists()) return;
  await deleteDoc(doc(db, 'chats', chatId));
}

async function deleteDocumentsByField(collectionName, fieldName, value) {
  if (!value) return 0;
  const snapshot = await getDocs(query(collection(db, collectionName), where(fieldName, '==', value)));
  if (snapshot.empty) return 0;
  await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));
  return snapshot.size;
}

async function cleanupOrphanParentUser({ adminId, parentUid, excludedStudentId = '' }) {
  if (!adminId || !parentUid) return;

  const students = await listAll('students', [
    where('adminId', '==', adminId),
    where('parentUid', '==', parentUid),
  ]);

  const hasRemainingStudent = students.some((student) => student.id !== excludedStudentId);
  if (!hasRemainingStudent) {
    await deleteDoc(doc(db, 'users', parentUid)).catch(() => null);
  }
}

async function cleanupStudentRecords({ adminId, studentId, studentData }) {
  await Promise.all(cleanupCollections.map((collectionName) => deleteDocumentsByField(collectionName, 'studentId', studentId)));
  await deleteDoc(doc(db, 'students', studentId));
  await cleanupOrphanParentUser({ adminId, parentUid: studentData.parentUid || '', excludedStudentId: studentId });
  await cleanupLessonGroupChatIfEmpty({ adminId, branchId: studentData.branchId, scheduleId: studentData.scheduleId });
}

function validateInstallments(installments) {
  installments.forEach((item) => {
    if (!normalizeText(item.dueDate) && !normalizeText(item.lessonLabel)) {
      throw new Error(`${item.installmentNumber}. taksit icin vade tarihi veya ders notu girilmelidir.`);
    }
  });
}

function buildStudentPayload({ values, existingStudent, adminId }) {
  const payload = {
    name: normalizeText(values.name),
    surname: normalizeText(values.surname),
    birthYear: toNumber(values.birthYear, null),
    gender: normalizeText(values.gender),
    phone: normalizeText(values.phone),
    parentName: normalizeText(values.parentName),
    parentEmail: normalizeEmail(values.parentEmail),
    parentPhone: normalizeText(values.parentPhone),
    address: normalizeText(values.address),
    branchId: values.branchId,
    scheduleId: values.scheduleId,
    trainerId: values.trainerId,
    startDate: values.startDate || todayIsoDate(),
    monthlyPrice: roundCurrency(values.monthlyPrice),
    installmentCount: Math.max(1, toNumber(values.installmentCount, 1)),
    totalAmount: roundCurrency(values.totalAmount),
    totalPaid: roundCurrency(existingStudent?.totalPaid || 0),
    attendedClasses: toNumber(existingStudent?.attendedClasses, 0),
    missedClasses: toNumber(existingStudent?.missedClasses, 0),
    status: existingStudent?.status || 'active',
    adminId,
    createdAt: existingStudent?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  if (values.discount?.code) {
    payload.discountCode = values.discount.code;
    payload.discountPercentage = toNumber(values.discount.percentage, 0);
    payload.originalAmount = roundCurrency(values.monthlyPrice);
  }

  return payload;
}

export async function validateSecretaryDiscount({ profile, code, baseAmount }) {
  const adminId = getAdminScope(profile);
  const normalizedCode = normalizeText(code).toUpperCase();
  if (!normalizedCode) {
    throw new Error('Indirim kodu girilmedi.');
  }

  const discounts = await listAll('discounts', [where('adminId', '==', adminId), where('code', '==', normalizedCode)]);
  const discount = discounts[0];
  if (!discount) {
    throw new Error('Gecersiz indirim kodu.');
  }

  const expiryDate = parseDateValue(discount.expiryDate);
  if (expiryDate && expiryDate.getTime() < Date.now()) {
    throw new Error('Bu indirim kodunun suresi dolmus.');
  }

  if (discount.usageLimit && toNumber(discount.usageCount, 0) >= toNumber(discount.usageLimit, 0)) {
    throw new Error('Bu indirim kodunun kullanim limiti dolmus.');
  }

  const discountAmount = roundCurrency((roundCurrency(baseAmount) * toNumber(discount.percentage, 0)) / 100);
  const discountedAmount = roundCurrency(roundCurrency(baseAmount) - discountAmount);

  return {
    ...discount,
    code: normalizedCode,
    discountAmount,
    discountedAmount,
  };
}

export async function getSecretaryDashboardData(profile) {
  const adminId = getAdminScope(profile);
  const support = await getSecretarySupport(adminId, profile.uid);
  const mappedStudents = support.students.map((student) => mapStudent(student, support, support.payments));
  const activeStudents = mappedStudents.filter(isStudentActive);
  const todayPayments = support.payments.filter((item) => item.date === todayIsoDate() || item.paidAt === todayIsoDate());

  const groupMap = activeStudents.reduce((result, student) => {
    const key = `${student.branchId}_${student.scheduleId}`;
    if (!result[key]) {
      result[key] = {
        key,
        branchName: student.branchName,
        scheduleName: student.scheduleName,
        daysLabel: student.scheduleDaysLabel,
        studentCount: 0,
        paidStudents: 0,
        outstandingAmount: 0,
      };
    }

    result[key].studentCount += 1;
    result[key].outstandingAmount += student.remainingBalance;
    if (student.remainingBalance <= 0.009) {
      result[key].paidStudents += 1;
    }
    return result;
  }, {});

  const chatCards = sortByDateDesc(support.chats, 'updatedAt').slice(0, 5).map((chat) => {
    const summary = buildParticipantTitle(chat, profile.uid);
    return {
      ...chat,
      ...summary,
      lastMessageText: chat.lastMessage || 'Mesaj yok',
    };
  });

  return {
    stats: [
      { label: 'Kayitli Ogrenci', value: mappedStudents.length },
      { label: 'Aktif Ogrenci', value: activeStudents.length },
      { label: 'Bugun Tahsilat', value: `₺${todayPayments.reduce((sum, item) => sum + roundCurrency(item.amount || 0), 0).toFixed(2)}` },
      { label: 'Aktif Sohbet', value: support.chats.length },
    ],
    groups: Object.values(groupMap)
      .sort((left, right) => right.studentCount - left.studentCount)
      .slice(0, 6)
      .map((item) => ({
        ...item,
        outstandingAmount: roundCurrency(item.outstandingAmount),
      })),
    installmentAlerts: getInstallmentAlerts(activeStudents, support),
    recentPayments: sortByDateDesc(
      support.payments.map((payment) => {
        const student = mappedStudents.find((item) => item.id === payment.studentId);
        return {
          ...payment,
          studentName: payment.studentName || student?.fullName || 'Ogrenci',
          amount: roundCurrency(payment.amount || 0),
          methodLabel:
            payment.method === 'transfer'
              ? 'Transfer'
              : payment.method === 'credit'
                ? 'Kredi Karti'
                : 'Nakit',
        };
      }),
      'timestamp'
    ).slice(0, 8),
    chats: chatCards,
  };
}

export async function getSecretaryRegistrationData(profile) {
  const adminId = getAdminScope(profile);
  const support = await getSecretarySupport(adminId, profile.uid);
  const mappedStudents = support.students.map((student) => mapStudent(student, support, support.payments));

  return {
    branches: support.branches,
    schedules: support.schedules,
    trainers: support.trainers,
    prices: support.prices,
    discounts: support.discounts,
    students: mappedStudents,
    priceLookup: support.prices.reduce((result, item) => {
      result[item.id || item.key] = roundCurrency(item.price || 0);
      return result;
    }, {}),
  };
}

export async function saveSecretaryStudent({ profile, studentId = '', values }) {
  const adminId = getAdminScope(profile);
  const support = await getSecretarySupport(adminId, profile.uid);
  const existingStudent = studentId ? support.students.find((item) => item.id === studentId) : null;
  const schedule = support.schedules.find((item) => item.id === values.scheduleId);
  if (!schedule) {
    throw new Error('Gecerli bir ders saati secilmedi.');
  }

  const birthYear = toNumber(values.birthYear, 0);
  if (!birthYear || birthYear < 1990 || birthYear > 2035) {
    throw new Error('Lutfen gecerli bir dogum yili girin.');
  }

  if (!normalizeText(values.gender)) {
    throw new Error('Ogrenci cinsiyeti secilmedi.');
  }

  if (!normalizeText(values.parentName) || !normalizeEmail(values.parentEmail)) {
    throw new Error('Veli bilgileri eksik.');
  }

  if (!studentId) {
    if (normalizeText(values.parentPassword).length < 6) {
      throw new Error('Veli sifresi en az 6 karakter olmalidir.');
    }
    if (values.parentPassword !== values.parentPasswordConfirm) {
      throw new Error('Veli sifreleri eslesmiyor.');
    }
  }

  const activeStudentsInSchedule = support.students
    .filter((student) => student.scheduleId === values.scheduleId)
    .filter((student) => !studentId || student.id !== studentId)
    .filter(isStudentActive);
  const capacity = Math.max(0, toNumber(schedule.capacity, 0));
  if (capacity > 0 && activeStudentsInSchedule.length >= capacity) {
    throw new Error(`Bu ders saatinin kapasitesi dolu. Kapasite: ${capacity}`);
  }

  const finalInstallments = buildSecretaryInstallmentPlanDraft({
    totalAmount: values.totalAmount,
    installmentCount: values.installmentCount,
    previousInstallments: values.installments || existingStudent?.installments || [],
  }).map((item, index) => ({
    ...item,
    dueDate: normalizeText(values.installments?.[index]?.dueDate || item.dueDate),
    lessonLabel: normalizeText(values.installments?.[index]?.lessonLabel || item.lessonLabel),
  }));
  validateInstallments(finalInstallments);

  const payload = buildStudentPayload({ values, existingStudent, adminId });
  payload.installments = finalInstallments;

  if (studentId) {
    const existingDoc = await getDoc(doc(db, 'students', studentId));
    const existingData = existingDoc.exists() ? existingDoc.data() || {} : {};

    await updateDoc(doc(db, 'students', studentId), {
      ...payload,
      totalPaid: roundCurrency(existingData.totalPaid || payload.totalPaid || 0),
      attendedClasses: toNumber(existingData.attendedClasses, payload.attendedClasses || 0),
      missedClasses: toNumber(existingData.missedClasses, payload.missedClasses || 0),
      status: existingData.status || payload.status || 'active',
      installments: buildSecretaryInstallmentPlanDraft({
        totalAmount: values.totalAmount,
        installmentCount: values.installmentCount,
        previousInstallments: existingData.installments || finalInstallments,
      }).map((item, index) => ({
        ...item,
        dueDate: normalizeText(values.installments?.[index]?.dueDate || item.dueDate),
        lessonLabel: normalizeText(values.installments?.[index]?.lessonLabel || item.lessonLabel),
      })),
      parentUid: existingData.parentUid || null,
    });

    if (existingData.parentUid) {
      await setDoc(
        doc(db, 'users', existingData.parentUid),
        {
          name: normalizeText(values.parentName),
          phone: normalizeText(values.parentPhone),
          adminId,
        },
        { merge: true }
      );

      await ensureLessonGroupChat({
        profile,
        support,
        studentId,
        studentData: payload,
        parentUid: existingData.parentUid,
      });
    }

    if (existingData.branchId !== payload.branchId || existingData.scheduleId !== payload.scheduleId) {
      await cleanupLessonGroupChatIfEmpty({
        adminId,
        branchId: existingData.branchId,
        scheduleId: existingData.scheduleId,
      });
    }

    return studentId;
  }

  let parentUser = await findUserByEmail(values.parentEmail);
  if (parentUser) {
    if (parentUser.role !== 'parent') {
      throw new Error('Bu e-posta baska bir rol tarafindan kullaniliyor.');
    }
    if (parentUser.studentId) {
      throw new Error('Bu veli e-postasi zaten baska bir ogrenciye bagli.');
    }
  }

  if (!parentUser) {
    const createdParent = await createManagedAuthUser({
      email: normalizeEmail(values.parentEmail),
      password: values.parentPassword,
    });

    await setDoc(doc(db, 'users', createdParent.uid), {
      name: normalizeText(values.parentName),
      email: normalizeEmail(values.parentEmail),
      phone: normalizeText(values.parentPhone),
      role: 'parent',
      adminId,
      studentId: null,
      createdAt: nowIso(),
    });

    parentUser = { id: createdParent.uid };
  }

  const createdStudent = await addDoc(collection(db, 'students'), {
    ...payload,
    parentUid: parentUser.id,
  });

  await setDoc(
    doc(db, 'users', parentUser.id),
    {
      name: normalizeText(values.parentName),
      email: normalizeEmail(values.parentEmail),
      phone: normalizeText(values.parentPhone),
      studentId: createdStudent.id,
      adminId,
    },
    { merge: true }
  );

  await ensureLessonGroupChat({
    profile,
    support,
    studentId: createdStudent.id,
    studentData: payload,
    parentUid: parentUser.id,
  });

  if (values.discount?.id) {
    await updateDoc(doc(db, 'discounts', values.discount.id), {
      usageCount: toNumber(values.discount.usageCount, 0) + 1,
    });
  }

  return createdStudent.id;
}

export async function getSecretaryStudentOpsData(profile) {
  const adminId = getAdminScope(profile);
  const support = await getSecretarySupport(adminId, profile.uid);
  const students = support.students.map((student) => mapStudent(student, support, support.payments));
  const groups = students.reduce((result, student) => {
    const key = `${student.branchId}_${student.scheduleId}`;
    if (!result[key]) {
      result[key] = {
        key,
        label: `${student.branchName} - ${student.scheduleName}`,
        details: `${student.scheduleDaysLabel} | ${student.installmentCount || 1} taksit`,
        students: [],
      };
    }
    result[key].students.push(student);
    return result;
  }, {});

  return {
    students,
    groups: Object.values(groups)
      .map((group) => ({
        ...group,
        students: sortByDateDesc(group.students, 'createdAt'),
      }))
      .sort((left, right) => left.label.localeCompare(right.label, 'tr')),
  };
}

export async function processSecretaryPayment({ profile, studentId, values }) {
  const studentSnapshot = await getDoc(doc(db, 'students', studentId));
  if (!studentSnapshot.exists()) {
    throw new Error('Ogrenci kaydi bulunamadi.');
  }

  const student = { id: studentSnapshot.id, ...studentSnapshot.data() };
  const paymentAmount = roundCurrency(values.amount);
  if (paymentAmount <= 0) {
    throw new Error('Lutfen gecerli bir odeme tutari girin.');
  }

  const totalAmount = roundCurrency(student.totalAmount || 0);
  const currentPaid = roundCurrency(student.totalPaid || 0);
  const newBalance = roundCurrency(currentPaid + paymentAmount);
  if (newBalance > totalAmount + 0.009) {
    throw new Error(`Odeme tutari fazla. Maksimum: ₺${Math.max(0, totalAmount - currentPaid).toFixed(2)}`);
  }

  if (values.method === 'transfer' && !values.attachmentDataUrl) {
    throw new Error('Transfer odemesi icin dekont secilmelidir.');
  }

  if (values.method === 'credit' && !values.attachmentDataUrl) {
    throw new Error('Kredi karti odemesi icin fatura veya slip secilmelidir.');
  }

  let paymentTimestamp = nowIso();
  if (values.method === 'cash') {
    const current = new Date();
    current.setHours(toNumber(values.hour, current.getHours()), toNumber(values.minute, current.getMinutes()), toNumber(values.second, current.getSeconds()), 0);
    paymentTimestamp = current.toISOString();
  }

  const installmentResult = applyPaymentToInstallments(student, paymentAmount, paymentTimestamp);
  await updateDoc(doc(db, 'students', studentId), {
    totalPaid: newBalance,
    installments: installmentResult.installments,
  });

  const paymentRecord = {
    studentId,
    studentName: `${student.name || ''} ${student.surname || ''}`.trim() || 'Ogrenci',
    branchId: student.branchId || '',
    scheduleId: student.scheduleId || '',
    trainerId: student.trainerId || '',
    amount: paymentAmount,
    method: values.method || 'cash',
    note: normalizeText(values.note),
    description: `${profile.name} sekreteri, ${student.name} ${student.surname} ogrencisinden taksit odemesi aldi`,
    previousBalance: currentPaid,
    newBalance,
    date: paymentTimestamp.slice(0, 10),
    timestamp: paymentTimestamp,
    createdBy: profile.uid,
    createdByName: profile.name,
    adminId: getAdminScope(profile),
    installmentAllocations: installmentResult.allocations,
  };

  if (values.method === 'cash') {
    paymentRecord.paymentTime = {
      hour: toNumber(values.hour, new Date().getHours()),
      minute: toNumber(values.minute, new Date().getMinutes()),
      second: toNumber(values.second, new Date().getSeconds()),
    };
  }

  if (values.method === 'transfer' && values.attachmentDataUrl) {
    paymentRecord.receiptData = values.attachmentDataUrl;
    paymentRecord.receiptFileName = values.attachmentFileName || 'dekont.jpg';
  }

  if (values.method === 'credit' && values.attachmentDataUrl) {
    paymentRecord.invoiceData = values.attachmentDataUrl;
    paymentRecord.invoiceFileName = values.attachmentFileName || 'fis.jpg';
  }

  await addDoc(collection(db, 'payments'), paymentRecord);
  return {
    studentId,
    paymentAmount,
    remainingBalance: Math.max(0, roundCurrency(totalAmount - newBalance)),
  };
}

export async function deleteSecretaryStudent({ profile, studentId }) {
  const adminId = getAdminScope(profile);
  const snapshot = await getDoc(doc(db, 'students', studentId));
  if (!snapshot.exists()) {
    return;
  }

  const studentData = snapshot.data() || {};
  await cleanupStudentRecords({
    adminId,
    studentId,
    studentData,
  });
}

export async function getSecretaryChatOpsData(profile) {
  const chats = await listAll('chats', [where('userIds', 'array-contains', profile.uid)]);
  return {
    chats: sortByDateDesc(chats, 'updatedAt').map((chat) => ({
      ...chat,
      ...buildParticipantTitle(chat, profile.uid),
      lastMessageText: chat.lastMessage || 'Mesaj yok',
    })),
  };
}

export async function lookupSecretaryChatUser(email) {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error('Kullanici bulunamadi.');
  }

  return user;
}

export async function createSecretaryDirectChat({ profile, email }) {
  const targetUser = await lookupSecretaryChatUser(email);
  if (targetUser.id === profile.uid) {
    throw new Error('Kendinizle birebir sohbet baslatamazsiniz.');
  }

  const chatId = await createOrReuseDirectChat({
    currentUser: profile,
    targetUser,
  });

  return {
    id: chatId,
    type: 'direct',
    userIds: [profile.uid, targetUser.id],
    users: {
      [profile.uid]: { name: profile.name, role: profile.role, email: profile.email || '' },
      [targetUser.id]: { name: targetUser.name, role: targetUser.role, email: targetUser.email || '' },
    },
  };
}

export async function createSecretaryGroupChat({ profile, groupName, emails }) {
  const normalizedName = normalizeText(groupName);
  if (!normalizedName) {
    throw new Error('Grup adi zorunludur.');
  }

  const emailList = Array.from(new Set((Array.isArray(emails) ? emails : []).map(normalizeEmail).filter(Boolean)));
  if (!emailList.length) {
    throw new Error('En az bir e-posta adresi girilmelidir.');
  }

  if (!emailList.includes(normalizeEmail(profile.email))) {
    emailList.push(normalizeEmail(profile.email));
  }

  const users = {};
  const userIds = [];
  for (const email of emailList) {
    const user = await findUserByEmail(email);
    if (!user) {
      throw new Error(`Kullanici bulunamadi: ${email}`);
    }
    userIds.push(user.id);
    users[user.id] = {
      name: user.name || email,
      role: user.role || 'user',
      email: user.email || email,
    };
  }

  const created = await addDoc(collection(db, 'chats'), {
    userIds,
    userEmails: emailList,
    users,
    type: 'group',
    groupName: normalizedName,
    createdBy: profile.uid,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastMessage: '',
    lastMessageTime: nowIso(),
  });

  return {
    id: created.id,
    type: 'group',
    userIds,
    users,
    groupName: normalizedName,
  };
}

export function resolveSecretarySchedulePrice({ prices, schedules, branchId, scheduleId }) {
  const schedule = schedules.find((item) => item.id === scheduleId);
  return getSchedulePrice(prices, schedule, branchId);
}
