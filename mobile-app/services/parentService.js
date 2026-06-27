import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
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
import { getScheduleDisplayLabel } from '../utils/scheduleDisplay';
import { nowIso, sortByDateDesc } from '../utils/date';

const reviewLabels = {
  1: 'Cok Kotu',
  2: 'Kotu',
  3: 'Orta',
  4: 'Iyi',
  5: 'Cok Iyi',
};

const reviewQuestions = [
  { key: 'safety', label: 'Antrenorun guvenlige dikkati' },
  { key: 'teaching', label: 'Yuzme teknigi ogretme becerisi' },
  { key: 'planning', label: 'Derslerin duzeni ve planlamasi' },
  { key: 'communicationWithChildren', label: 'Cocuklarla iletisim' },
  { key: 'motivation', label: 'Motivasyon ve cesaretlendirme' },
  { key: 'studentDevelopment', label: 'Ogrenci gelisimi katkisi' },
  { key: 'communicationWithParents', label: 'Veli iletisim ve bilgilendirme' },
  { key: 'overallSatisfaction', label: 'Genel memnuniyet' },
];

function toNumber(value, fallback = 0) {
  if (value === '' || value === null || typeof value === 'undefined') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundCurrency(value) {
  return Math.round(toNumber(value, 0) * 100) / 100;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function parseDateValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatIsoDate(value) {
  const date = parseDateValue(value);
  return date ? date.toISOString().slice(0, 10) : '';
}

function timeToSeconds(timeString) {
  if (!timeString || typeof timeString !== 'string' || !timeString.includes(':')) return Number.POSITIVE_INFINITY;
  const [minutes, secondsPart] = timeString.split(':');
  const [seconds, centiseconds = '0'] = String(secondsPart || '').split('.');
  return (Number(minutes) * 60) + Number(seconds) + (Number(centiseconds) / 100);
}

function formatTimeDifference(seconds) {
  if (!Number.isFinite(seconds)) return '-';
  const totalCentiseconds = Math.round(seconds * 100);
  const minutes = Math.floor(totalCentiseconds / 6000);
  const remainingCentiseconds = totalCentiseconds % 6000;
  const wholeSeconds = Math.floor(remainingCentiseconds / 100);
  const centiseconds = remainingCentiseconds % 100;
  if (minutes > 0) {
    return `${minutes}:${String(wholeSeconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
  }
  return `${wholeSeconds}.${String(centiseconds).padStart(2, '0')} sn`;
}

function normalizePerformanceStyle(style) {
  // Normalize to ASCII-safe canonical form so web Turkish values (Kurbağalama, Sırtüstü, Kelebekçe)
  // and mobile-internal values (Kurbaga, Sirt, Kelebek, Karisik) all match each other.
  const compact = String(style || '')
    .trim()
    .toUpperCase()
    .replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ş/g, 'S')
    .replace(/İ/g, 'I').replace(/I/g, 'I').replace(/Ö/g, 'O').replace(/Ç/g, 'C');
  if (compact === 'SERBEST' || compact === 'FREE' || compact === 'FREESTYLE') return 'Serbest';
  if (compact.startsWith('KURBAG') || compact.includes('BREAST')) return 'Kurbagalama';
  if (compact.startsWith('SIRT') || compact.includes('BACK')) return 'Sirtustu';
  if (compact.startsWith('KELEBEK') || compact.includes('FLY') || compact.includes('BUTTERFLY')) return 'Kelebekce';
  if (compact === 'KARISIK' || compact === 'KARMA' || compact.includes('MEDLEY')) return 'Karma';
  return String(style || '').trim();
}

async function listAll(collectionName, constraints = []) {
  const snapshot = constraints.length
    ? await getDocs(query(collection(db, collectionName), ...constraints))
    : await getDocs(collection(db, collectionName));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function getParentStudent(profile) {
  const studentId = profile?.studentId || profile?.student?.id;
  if (!studentId) {
    throw new Error('Veli hesabina bagli ogrenci bulunamadi.');
  }
  const snapshot = await getDoc(doc(db, 'students', studentId));
  if (!snapshot.exists()) {
    throw new Error('Ogrenci kaydi bulunamadi.');
  }
  return { id: snapshot.id, ...snapshot.data() };
}

function getStudentBirthYear(student) {
  if (!student) return null;
  if (student.birthYear) return Number(student.birthYear);
  if (student.age) return new Date().getFullYear() - Number(student.age);
  return null;
}

function getStudentAge(student) {
  const birthYear = getStudentBirthYear(student);
  return birthYear ? new Date().getFullYear() - birthYear : null;
}

function getStudentInstallments(student) {
  if (Array.isArray(student?.installments) && student.installments.length) {
    return student.installments.map((item) => ({ ...item }));
  }

  const installmentCount = Math.max(1, Number(student?.installmentCount) || 1);
  const totalAmount = roundCurrency(student?.totalAmount || 0);
  const baseAmount = installmentCount > 0 ? roundCurrency(totalAmount / installmentCount) : 0;

  return Array.from({ length: installmentCount }, (_, index) => ({
    installmentNumber: index + 1,
    amount: index === installmentCount - 1 ? roundCurrency(totalAmount - (baseAmount * index)) : baseAmount,
    dueDate: null,
    lessonLabel: '',
    paid: false,
    paidAmount: 0,
    paidAt: null,
  }));
}

function normalizeCartItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const quantity = Math.max(1, toNumber(item.quantity, 1));
      const price = roundCurrency(item.price || 0);
      return {
        productId: item.productId || item.id || '',
        productName: normalizeText(item.productName || item.name),
        quantity,
        unitPrice: price,
        lineTotal: roundCurrency(price * quantity),
      };
    })
    .filter((item) => item.productId && item.productName && item.quantity > 0);
}

function getOrderTitleFromItems(items) {
  if (!items.length) return 'Market siparisi';
  if (items.length === 1) {
    return `${items[0].productName}${items[0].quantity > 1 ? ` x${items[0].quantity}` : ''}`;
  }
  return `${items[0].productName} +${items.length - 1} urun`;
}

async function notifySuperAdminsAboutOrder(orderTitle, buyerName, orderId) {
  const superAdmins = await listAll('users', [where('role', '==', 'superadmin')]);
  await Promise.all(superAdmins.map((user) => createAppNotification({
    userId: user.id,
    title: 'Yeni market siparisi',
    message: `${buyerName || 'Veli'} tarafindan ${orderTitle} siparisi olusturuldu.`,
    type: 'market_order',
    data: { orderId },
  }).catch(() => null)));
}

function getReviewAverage(review) {
  const questionScores = review?.questionScores || {};
  const scores = reviewQuestions
    .map((item) => Number(questionScores[item.key]))
    .filter((score) => Number.isFinite(score) && score >= 1 && score <= 5);
  if (!scores.length) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function formatRating(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return '-';
  return `${score.toFixed(1)} / 5`;
}

function getRatingStars(value) {
  const score = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return '★'.repeat(score) + '☆'.repeat(5 - score);
}

function getAssignedTrainerOptions(student, schedules, trainers) {
  const schedule = schedules.find((item) => item.id === student?.scheduleId);
  if (!schedule) return [];

  const rawAssignments = Array.isArray(schedule.trainerAssignments) && schedule.trainerAssignments.length
    ? schedule.trainerAssignments
    : (schedule.trainerId || schedule.trainerDocId
      ? [{ trainerId: schedule.trainerId || '', trainerDocId: schedule.trainerDocId || '', trainerName: schedule.trainerName || '' }]
      : []);

  const uniqueAssignments = new Map();
  rawAssignments.forEach((assignment) => {
    const trainer = trainers.find((item) => {
      return item.id === assignment?.trainerDocId
        || item.id === assignment?.trainerId
        || item.uid === assignment?.trainerId
        || item.uid === assignment?.trainerDocId;
    }) || null;
    const trainerId = assignment?.trainerId || trainer?.uid || trainer?.id || '';
    const trainerDocId = assignment?.trainerDocId || trainer?.id || '';
    const key = trainerDocId || trainerId;
    if (!key || uniqueAssignments.has(key)) return;
    uniqueAssignments.set(key, {
      trainerId,
      trainerDocId,
      trainerKey: key,
      trainerName: assignment?.trainerName || trainer?.name || 'Antrenor',
    });
  });
  return Array.from(uniqueAssignments.values());
}

function getStandardScope(standard) {
  if (standard.scopeType) return standard.scopeType;
  if (standard.adminId) return 'admin';
  if (standard.trainerId) return 'trainer';
  return 'global';
}

function isStandardVisibleToParent(standard, student) {
  if (!student) return false;
  const scope = getStandardScope(standard);
  const matchesGender = !student.gender || !standard.gender || standard.gender === student.gender;
  if (!matchesGender) return false;
  if (scope === 'global') return true;
  if (scope === 'admin') return standard.adminId === student.adminId;
  if (scope === 'trainer') return standard.trainerId === student.trainerId;
  return false;
}

function cleanStandardTitle(value) {
  const rawTitle = String(value || '').trim();
  if (!rawTitle) return 'BARAJ';
  return rawTitle.toLocaleUpperCase('tr-TR')
    .replace(/\b\d{1,2}\s*[-/]\s*\d{1,2}\s*YAŞ\b/g, ' ')
    .replace(/\b\d{1,2}\s+\d{1,2}\s*YAŞ\b/g, ' ')
    .replace(/\b[A-ZÇĞİÖŞÜ]+\s+ANISINA\b/g, ' ')
    .replace(/\bARENA\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'BARAJ';
}

function getReadableStandardTitle(standard) {
  const year = standard.birthYear ? String(standard.birthYear) : '';
  const eventTitle = cleanStandardTitle(standard.name || standard.groupLabel || '');
  const poolLabel = standard.poolType ? `${standard.poolType} metre` : '';
  const categoryLabel = standard.category ? String(standard.category).toLocaleLowerCase('tr-TR') : '';
  return [year, eventTitle, poolLabel, categoryLabel].filter(Boolean).join(' ').trim();
}

function getBestPerformance(performances, style, distance) {
  const matching = performances.filter((item) => {
    return normalizePerformanceStyle(item.style) === normalizePerformanceStyle(style)
      && Number(item.distance) === Number(distance);
  });
  if (!matching.length) return null;
  return matching.reduce((best, current) => {
    return timeToSeconds(current.time) < timeToSeconds(best.time) ? current : best;
  });
}

function getStandardMatchForPerformance(standards, performances, student, performance) {
  const studentBirthYear = getStudentBirthYear(student);
  const performanceSeconds = timeToSeconds(performance.time);
  const matchingStandards = standards
    .filter((standard) => Number(standard.birthYear) <= Number(studentBirthYear || standard.birthYear))
    .filter((standard) => normalizePerformanceStyle(standard.style) === normalizePerformanceStyle(performance.style))
    .filter((standard) => Number(standard.distance) === Number(performance.distance))
    .sort((left, right) => Number(right.birthYear) - Number(left.birthYear) || (timeToSeconds(left.time) - timeToSeconds(right.time)));
  if (!matchingStandards.length) return null;

  const passed = matchingStandards.filter((standard) => performanceSeconds <= timeToSeconds(standard.time));
  if (passed.length) {
    const strongest = passed[0];
    return {
      passed: true,
      standard: strongest,
      difference: timeToSeconds(strongest.time) - performanceSeconds,
    };
  }

  const nearest = matchingStandards[0];
  return {
    passed: false,
    standard: nearest,
    difference: performanceSeconds - timeToSeconds(nearest.time),
  };
}

function buildChatSummary(chat, currentUserId) {
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

async function findUserByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const snapshot = await getDocs(query(collection(db, 'users'), where('email', '==', normalized), limit(1)));
  if (snapshot.empty) return null;
  const item = snapshot.docs[0];
  return { id: item.id, ...item.data() };
}

async function getParentBaseData(profile) {
  const student = await getParentStudent(profile);
  const adminId = student.adminId || profile.adminId || '';
  const [schedules, branches, trainers, announcements, events, products, performances, comments, reviews, attendance, standards, studentWorkouts, chats] = await Promise.all([
    listAll('schedules', [where('adminId', '==', adminId)]),
    listAll('branches', [where('adminId', '==', adminId)]),
    listAll('trainers', [where('adminId', '==', adminId)]),
    listAll('announcements', [where('adminId', '==', adminId)]),
    listAll('events', [where('adminId', '==', adminId)]).catch(() => listAll('events')),
    listAll('products'),
    listAll('performances', [where('studentId', '==', student.id)]),
    listAll('lesson_comments', [where('studentId', '==', student.id)]),
    listAll('trainer_reviews', [where('studentId', '==', student.id)]),
    listAll('attendance', [where('studentId', '==', student.id)]),
    listAll('standards'),
    listAll('student_workouts', [where('studentId', '==', student.id)]),
    listAll('chats', [where('userIds', 'array-contains', profile.uid)]),
  ]);

  const workoutIds = Array.from(new Set(studentWorkouts.map((item) => item.workoutId).filter(Boolean)));
  const workouts = await Promise.all(workoutIds.map(async (workoutId) => {
    const snapshot = await getDoc(doc(db, 'workouts', workoutId));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  }));

  return {
    adminId,
    student,
    schedules,
    branches,
    trainers,
    announcements,
    events,
    products,
    performances: sortByDateDesc(performances, 'date'),
    comments: sortByDateDesc(comments, 'lessonDate'),
    reviews: sortByDateDesc(reviews, 'updatedAt'),
    attendance: sortByDateDesc(attendance, 'date'),
    standards,
    studentWorkouts: sortByDateDesc(studentWorkouts),
    workouts: workouts.filter(Boolean),
    chats: sortByDateDesc(chats, 'updatedAt'),
  };
}

function getRelevantAnnouncements(announcements, student) {
  return announcements.filter((item) => {
    if (item.target === 'all') return true;
    return item.target === 'schedule' && item.scheduleId === student.scheduleId;
  });
}

function buildParentReviews(reviews, comments, assignedTrainers) {
  const generalReviews = assignedTrainers.map((trainer) => {
    const generalReview = reviews.find((review) => review.scopeKey === `general_${trainer.trainerKey}` || (review.scopeType === 'general' && (review.trainerDocId === trainer.trainerDocId || review.trainerId === trainer.trainerId)));
    const average = getReviewAverage(generalReview);
    const lessonReviewCount = reviews.filter((review) => {
      if (review.scopeType !== 'lesson') return false;
      const reviewValues = [review?.trainerId, review?.trainerDocId].filter(Boolean);
      return [trainer.trainerId, trainer.trainerDocId, trainer.trainerKey].filter(Boolean).some((value) => reviewValues.includes(value));
    }).length;

    return {
      ...trainer,
      reviewId: generalReview?.id || '',
      average,
      averageLabel: formatRating(average),
      stars: getRatingStars(average),
      lessonReviewCount,
      hasReview: Boolean(generalReview),
      existingQuestionScores: generalReview?.questionScores || {},
      existingComment: generalReview?.comment || '',
    };
  });

  const lessonReviews = comments.map((comment) => {
    const lessonReview = reviews.find((review) => review.scopeType === 'lesson' && (review.lessonCommentId === comment.id || review.targetId === comment.id));
    const average = getReviewAverage(lessonReview);
    return {
      ...comment,
      reviewId: lessonReview?.id || '',
      average,
      averageLabel: formatRating(average),
      stars: getRatingStars(average),
      hasReview: Boolean(lessonReview),
      existingQuestionScores: lessonReview?.questionScores || {},
      existingComment: lessonReview?.comment || '',
    };
  });

  const scores = reviews.map((review) => getReviewAverage(review)).filter((score) => Number.isFinite(score));

  return {
    generalReviews,
    lessonReviews,
    aggregate: {
      count: scores.length,
      average: scores.length ? (scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
    },
  };
}

export function getParentReviewQuestions() {
  return reviewQuestions.map((item) => ({
    ...item,
    options: Object.entries(reviewLabels).map(([value, label]) => ({ value: Number(value), label })),
  }));
}

export async function getParentDashboardData(profile) {
  const data = await getParentBaseData(profile);
  const schedule = data.schedules.find((item) => item.id === data.student.scheduleId) || null;
  const branch = data.branches.find((item) => item.id === data.student.branchId) || null;
  const installments = getStudentInstallments(data.student).map((item) => ({
    ...item,
    remainingAmount: Math.max(0, roundCurrency(item.amount || 0) - roundCurrency(item.paidAmount || 0)),
  }));
  const totalAmount = roundCurrency(data.student.totalAmount || 0);
  const totalPaid = roundCurrency(data.student.totalPaid || 0);
  const attendancePresent = data.attendance.filter((item) => item.present === true).length;
  const attendanceMissed = data.attendance.filter((item) => item.present === false).length;
  const totalLessons = schedule?.lessonsCount || installments.length || 0;
  const attendanceRate = totalLessons > 0 ? Math.round((attendancePresent / totalLessons) * 100) : 0;
  const upcomingEvents = [...data.events]
    .filter((item) => parseDateValue(item.date)?.getTime() >= new Date(new Date().toDateString()).getTime())
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
    .slice(0, 5);
  const announcements = getRelevantAnnouncements(data.announcements, data.student).slice(0, 4);

  return {
    student: {
      ...data.student,
      fullName: `${data.student.name || ''} ${data.student.surname || ''}`.trim() || 'Ogrenci',
      age: getStudentAge(data.student),
      branchName: branch?.name || 'Bilinmiyor',
      scheduleName: getScheduleDisplayLabel(schedule, branch),
    },
    stats: [
      { label: 'Toplam Tutar', value: `₺${totalAmount.toFixed(2)}` },
      { label: 'Odenen', value: `₺${totalPaid.toFixed(2)}` },
      { label: 'Kalan', value: `₺${Math.max(0, totalAmount - totalPaid).toFixed(2)}` },
      { label: 'Devam', value: `%${attendanceRate}` },
    ],
    installments,
    attendanceSummary: {
      totalLessons,
      present: attendancePresent,
      missed: attendanceMissed,
      attendanceRate,
    },
    upcomingEvents,
    announcements,
    recentChats: data.chats.slice(0, 4).map((chat) => ({ ...chat, ...buildChatSummary(chat, profile.uid) })),
  };
}

export async function getParentProgressData(profile) {
  const data = await getParentBaseData(profile);
  const visibleStandards = data.standards
    .filter((item) => item.birthYear)
    .filter((item) => Number(item.birthYear) <= Number(getStudentBirthYear(data.student) || item.birthYear))
    .filter((item) => isStandardVisibleToParent(item, data.student));
  const assignedTrainers = getAssignedTrainerOptions(data.student, data.schedules, data.trainers);
  const reviews = buildParentReviews(data.reviews, data.comments, assignedTrainers);

  const normalizedPerformances = data.performances.map((performance) => ({
    ...performance,
    type: performance.type === 'race' ? 'competition' : (performance.type || 'training'),
  }));

  const performanceCards = Object.values(normalizedPerformances.reduce((result, performance) => {
    const key = `${normalizePerformanceStyle(performance.style)}_${performance.distance}_${performance.type}`;
    if (!result[key]) result[key] = [];
    result[key].push(performance);
    return result;
  }, {})).map((group) => {
    const sortedByDate = [...group].sort((left, right) => new Date(right.date || right.createdAt || 0) - new Date(left.date || left.createdAt || 0));
    const best = group.reduce((bestItem, currentItem) => {
      return timeToSeconds(currentItem.time) < timeToSeconds(bestItem.time) ? currentItem : bestItem;
    });
    const latest = sortedByDate[0];
    const standardState = getStandardMatchForPerformance(visibleStandards, data.performances, data.student, best);
    return {
      key: `${best.style}_${best.distance}_${best.type}`,
      styleLabel: normalizePerformanceStyle(best.style),
      distance: best.distance,
      type: best.type,
      typeLabel: best.type === 'competition' ? 'Yaris' : 'Antrenman',
      bestTime: best.time,
      latestTime: latest.time,
      latestDate: latest.date || latest.createdAt,
      status: standardState
        ? {
            passed: standardState.passed,
            title: standardState.standard?.name || getReadableStandardTitle(standardState.standard || {}),
            deltaLabel: formatTimeDifference(standardState.difference),
          }
        : null,
      history: sortedByDate,
    };
  }).sort((left, right) => {
    if (left.type !== right.type) return left.type === 'competition' ? -1 : 1;
    return left.distance - right.distance;
  });

  const bestOverall = data.performances.reduce((best, current) => {
    if (!best) return current;
    return timeToSeconds(current.time) < timeToSeconds(best.time) ? current : best;
  }, null);
  const passedCount = data.performances.reduce((count, performance) => {
    const status = getStandardMatchForPerformance(visibleStandards, data.performances, data.student, performance);
    return count + (status?.passed ? 1 : 0);
  }, 0);

  const groupedStandards = Object.values(visibleStandards.reduce((result, standard) => {
    const title = getReadableStandardTitle(standard);
    const meta = [(getStandardScope(standard) === 'global' ? 'Genel Baraj' : 'Kulup Baraji'), standard.gender].filter(Boolean).join(' • ');
    const key = [title, meta].join('|');
    if (!result[key]) result[key] = { key, title, meta, items: [] };
    const bestPerformance = getBestPerformance(data.performances, standard.style, standard.distance);
    const bestSeconds = timeToSeconds(bestPerformance?.time);
    const standardSeconds = timeToSeconds(standard.time);
    const passed = bestPerformance ? bestSeconds <= standardSeconds : false;
    result[key].items.push({
      ...standard,
      bestPerformance: bestPerformance?.time || '',
      passed,
      deltaLabel: bestPerformance ? formatTimeDifference(Math.abs(bestSeconds - standardSeconds)) : '-',
    });
    return result;
  }, {}));

  return {
    stats: [
      { label: 'Toplam Derece', value: data.performances.length },
      { label: 'En Iyi Sure', value: bestOverall ? `${bestOverall.distance}m ${normalizePerformanceStyle(bestOverall.style)} • ${bestOverall.time}` : '-' },
      { label: 'Gecilen Baraj', value: passedCount },
      { label: 'Antrenor Yorumu', value: data.comments.length },
      { label: 'Veli Degerlendirmesi', value: reviews.aggregate.count },
      { label: 'Ortalama Puan', value: reviews.aggregate.average ? formatRating(reviews.aggregate.average) : '-' },
    ],
    performances: performanceCards,
    comments: data.comments,
    reviews,
    standards: groupedStandards,
  };
}

export async function saveParentTrainerReview({ profile, values }) {
  const data = await getParentBaseData(profile);
  const student = data.student;
  const now = nowIso();
  const existingReview = values.reviewId ? data.reviews.find((item) => item.id === values.reviewId) : null;
  const payload = {
    adminId: student.adminId || '',
    branchId: student.branchId || '',
    scheduleId: student.scheduleId || '',
    studentId: student.id,
    studentName: `${student.name || ''} ${student.surname || ''}`.trim(),
    parentId: profile.uid,
    parentName: profile.name || 'Veli',
    trainerId: values.trainerId || '',
    trainerDocId: values.trainerDocId || '',
    trainerName: values.trainerName || 'Antrenor',
    scopeType: values.scopeType,
    targetId: values.targetId,
    scopeKey: values.scopeKey,
    lessonCommentId: values.lessonCommentId || '',
    lessonDate: values.lessonDate || '',
    lessonTopic: values.lessonTopic || '',
    questionScores: values.questionScores,
    averageScore: roundCurrency(getReviewAverage({ questionScores: values.questionScores }) || 0),
    questionCount: reviewQuestions.length,
    comment: normalizeText(values.comment),
    updatedAt: now,
    createdAt: existingReview?.createdAt || now,
  };

  if (values.reviewId) {
    await setDoc(doc(db, 'trainer_reviews', values.reviewId), payload, { merge: true });
    return values.reviewId;
  }

  const created = await addDoc(collection(db, 'trainer_reviews'), payload);
  return created.id;
}

export async function getParentDailyData(profile) {
  const data = await getParentBaseData(profile);
  const schedule = data.schedules.find((item) => item.id === data.student.scheduleId) || null;
  const branch = data.branches.find((item) => item.id === data.student.branchId) || null;
  const announcements = getRelevantAnnouncements(data.announcements, data.student);
  const installments = getStudentInstallments(data.student).map((item) => ({
    ...item,
    remainingAmount: Math.max(0, roundCurrency(item.amount || 0) - roundCurrency(item.paidAmount || 0)),
  }));
  const totalLessons = schedule?.lessonsCount || installments.length || 0;
  const attendancePresent = data.attendance.filter((item) => item.present === true).length;
  const attendanceMissed = data.attendance.filter((item) => item.present === false).length;
  const attendanceRate = totalLessons > 0 ? Math.round((attendancePresent / totalLessons) * 100) : 0;
  const orders = await listAll('orders', [where('buyerId', '==', profile.uid)]).catch(() => []);

  return {
    payments: installments,
    attendanceSummary: {
      totalLessons,
      present: attendancePresent,
      missed: attendanceMissed,
      attendanceRate,
      records: data.attendance,
    },
    announcements,
    events: [...data.events].sort((left, right) => new Date(left.date || 0).getTime() - new Date(right.date || 0).getTime()),
    workouts: data.studentWorkouts.map((item) => {
      const workout = data.workouts.find((workoutItem) => workoutItem.id === item.workoutId) || null;
      return {
        ...item,
        workoutName: workout?.name || 'Isimsiz Antrenman',
        exercises: workout?.exercises || [],
        branchName: branch?.name || 'Bilinmiyor',
        scheduleName: getScheduleDisplayLabel(schedule, branch),
      };
    }),
  };
}

export async function getParentMarketOverview(profile) {
  const student = await getParentStudent(profile);
  const [products, orders, favorites, campaigns, bankSettingsSnapshot] = await Promise.all([
    listAll('products'),
    listAll('orders', [where('buyerId', '==', profile.uid)]).catch(() => []),
    listUserMarketFavorites(profile.uid),
    listVisibleMarketCampaigns({ adminId: student.adminId || profile.adminId || '' }),
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
      buyerPhone: normalizeText(profile?.phone || student.parentPhone || student.phone || ''),
      shippingAddress: normalizeText(profile?.address || student.address || ''),
    },
  };
}

export async function submitParentMarketCheckout({
  profile,
  items,
  buyerPhone,
  shippingAddress,
  paymentMethod,
  cardDetails,
  installmentPreference,
  note,
}) {
  const student = await getParentStudent(profile);
  const normalizedItems = normalizeCartItems(items);
  if (!normalizedItems.length) {
    throw new Error('Sepette en az bir urun bulunmali.');
  }

  const cleanPhone = normalizeText(buyerPhone || student.parentPhone || student.phone || '');
  const cleanAddress = normalizeText(shippingAddress || student.address || '');
  const cleanPaymentMethod = normalizeText(paymentMethod || 'iban').toLowerCase();
  const cleanInstallment = normalizeText(installmentPreference);
  const cleanNote = normalizeText(note);

  if (!cleanPhone) {
    throw new Error('Iletisim telefonu gerekli.');
  }
  if (!cleanAddress) {
    throw new Error('Teslimat adresi gerekli.');
  }

  const totalAmount = roundCurrency(normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0));
  const itemCount = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);
  const orderTitle = getOrderTitleFromItems(normalizedItems);
  const orderRef = doc(collection(db, 'orders'));
  const cardSnapshot = cleanPaymentMethod === 'credit_card' ? buildCreditCardSnapshot(cardDetails) : {};

  await runTransaction(db, async (transaction) => {
    transaction.set(orderRef, {
      type: 'product',
      status: 'pending',
      statusHistory: buildInitialMarketStatusHistory({
        actorId: profile.uid,
        actorRole: 'parent',
      }),
      paymentMethod: cleanPaymentMethod || 'iban',
      items: normalizedItems,
      itemCount,
      orderTitle,
      totalAmount,
      buyerId: profile.uid,
      buyerName: profile.name || student.parentName || 'Veli',
      buyerEmail: profile.email || student.parentEmail || '',
      buyerRole: 'parent',
      buyerPhone: cleanPhone,
      shippingAddress: cleanAddress,
      installmentPreference: cleanInstallment,
      note: cleanNote,
      adminId: student.adminId || profile.adminId || '',
      studentId: student.id,
      studentName: [student.name, student.surname].filter(Boolean).join(' '),
      ...cardSnapshot,
      createdAt: nowIso(),
      shippingCarrier: '',
      trackingNumber: '',
    });
  });

  await notifySuperAdminsAboutOrder(orderTitle, profile.name || student.parentName, orderRef.id);

  return {
    id: orderRef.id,
    orderTitle,
    itemCount,
    totalAmount,
  };
}

export async function getParentCommunicationData(profile) {
  const data = await getParentBaseData(profile);
  return {
    chats: data.chats.map((chat) => ({
      ...chat,
      ...buildChatSummary(chat, profile.uid),
      lastMessageText: chat.lastMessage || 'Mesaj yok',
    })),
    products: data.products,
  };
}

export async function createParentDirectChat({ profile, email }) {
  const targetUser = await findUserByEmail(email);
  if (!targetUser) {
    throw new Error('Kullanici bulunamadi.');
  }
  if (targetUser.id === profile.uid) {
    throw new Error('Kendinizle sohbet baslatamazsiniz.');
  }

  const chatId = await createOrReuseDirectChat({ currentUser: profile, targetUser });
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

export async function createParentGroupChat({ profile, groupName, emails }) {
  const normalizedName = normalizeText(groupName);
  if (!normalizedName) {
    throw new Error('Grup adi zorunludur.');
  }

  const emailList = Array.from(new Set((Array.isArray(emails) ? emails : []).map(normalizeEmail).filter(Boolean)));
  if (!emailList.length) {
    throw new Error('En az bir e-posta girilmelidir.');
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

export async function connectParentToSuperAdminFromMarket({ profile, product }) {
  const superAdmins = await listAll('users', [where('role', '==', 'superadmin')]);
  const superAdmin = superAdmins[0];
  if (!superAdmin) {
    throw new Error('Baglanti kurulacak yetkili bulunamadi.');
  }

  const chat = await createParentDirectChat({ profile, email: superAdmin.email });
  await sendMessage(chat.id, {
    senderId: profile.uid,
    senderName: profile.name,
    text: `Merhaba, ${product.name} urunu hakkinda bilgi almak istiyorum. Fiyat: ₺${Number(product.price || 0).toFixed(2)}.`,
  });
  return chat;
}
