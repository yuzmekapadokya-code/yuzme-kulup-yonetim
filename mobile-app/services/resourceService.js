import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
} from 'firebase/firestore';

import { createManagedAuthUser } from '../api/authApi';
import {
  createDocument,
  getDocument,
  listDocuments,
  patchDocument,
  removeDocument,
  upsertDocument,
} from '../api/firestoreClient';
import { db } from '../config/firebase';
import { nowIso, sortByDateDesc, todayIsoDate } from '../utils/date';
import { getFeatureConfig } from '../utils/roleScreens';
import { getAdminScope } from './roleService';

function toNumber(value, fallback = 0) {
  if (value === '' || value === null || typeof value === 'undefined') return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function enrichStudents(items, support) {
  return items.map((item) => ({
    ...item,
    fullName: [item.name, item.surname].filter(Boolean).join(' '),
    branchLabel: support.branches.find((branch) => branch.id === item.branchId)?.name || item.branchId,
    scheduleLabel: support.schedules.find((schedule) => schedule.id === item.scheduleId)?.time || item.scheduleId,
  }));
}

function enrichSchedules(items, support) {
  return items.map((item) => ({
    ...item,
    branchLabel: support.branches.find((branch) => branch.id === item.branchId)?.name || item.branchId,
    trainerLabel:
      support.trainers.find((trainer) => trainer.id === item.trainerId || trainer.uid === item.trainerId)?.name ||
      item.trainerId,
  }));
}

function enrichGenericRelations(items, support) {
  return items.map((item) => ({
    ...item,
    branchLabel: support.branches.find((branch) => branch.id === item.branchId)?.name || item.branchId,
    scheduleLabel: support.schedules.find((schedule) => schedule.id === item.scheduleId)?.time || item.scheduleId,
    studentLabel:
      support.students.find((student) => student.id === item.studentId)?.fullName ||
      support.students.find((student) => student.id === item.studentId)?.name ||
      item.studentId,
  }));
}

async function fetchSupport(profile) {
  const role = profile.role;
  const adminId = getAdminScope(profile);
  const support = {
    branches: [],
    trainers: [],
    schedules: [],
    students: [],
    products: [],
  };

  if (role === 'superadmin') {
    const [branches, trainers, schedules, students, products] = await Promise.all([
      listDocuments('branches'),
      listDocuments('trainers'),
      listDocuments('schedules'),
      listDocuments('students'),
      listDocuments('products'),
    ]);
    return { ...support, branches, trainers, schedules, students: enrichStudents(students, { branches, schedules }), products };
  }

  if (adminId) {
    const [branches, trainers, schedules, students, products] = await Promise.all([
      listDocuments('branches', [where('adminId', '==', adminId)]),
      listDocuments('trainers', [where('adminId', '==', adminId)]),
      listDocuments('schedules', [where('adminId', '==', adminId)]),
      listDocuments('students', [where('adminId', '==', adminId)]),
      listDocuments('products'),
    ]);

    return {
      branches,
      trainers,
      schedules: enrichSchedules(schedules, { branches, trainers }),
      students: enrichStudents(students, { branches, schedules }),
      products,
    };
  }

  if (role === 'parent' && profile.student) {
    const [products, events] = await Promise.all([listDocuments('products'), listDocuments('events')]);
    return { ...support, students: [profile.student], products, events };
  }

  return support;
}

function normalizeItem(featureKey, item, support) {
  if (featureKey === 'students') {
    return enrichStudents([item], support)[0];
  }
  if (featureKey === 'schedules') {
    return enrichSchedules([item], support)[0];
  }
  return enrichGenericRelations([item], support)[0];
}

async function findUserByEmail(email) {
  const snapshot = await getDocs(query(collection(db, 'users'), where('email', '==', email.trim()), limit(1)));
  if (snapshot.empty) return null;
  const result = snapshot.docs[0];
  return { id: result.id, ...result.data() };
}

async function createManagedUserRecord(feature, values, profile) {
  const managedUser = await createManagedAuthUser({ email: values.email, password: values.password });
  const timestamp = nowIso();
  const baseUserDoc = {
    name: values.name,
    email: values.email.trim(),
    role: feature.managedRole,
    createdAt: timestamp,
  };

  if (feature.managedRole === 'admin') {
    const adminPayload = {
      ...baseUserDoc,
      membershipStart: values.membershipStart,
      membershipEnd: values.membershipEnd,
      membershipPrice: toNumber(values.membershipPrice),
      membershipInstallments: toNumber(values.membershipInstallments, 1),
      membershipPaid: 0,
    };

    await upsertDocument('users', managedUser.uid, adminPayload);
    await upsertDocument('admins', managedUser.uid, adminPayload);
    return managedUser.uid;
  }

  const adminId = getAdminScope(profile);
  const userPayload = {
    ...baseUserDoc,
    adminId,
  };

  await upsertDocument('users', managedUser.uid, userPayload);

  if (feature.managedRole === 'trainer') {
    await createDocument('trainers', {
      uid: managedUser.uid,
      name: values.name,
      email: values.email.trim(),
      role: 'trainer',
      adminId,
      branches: values.branches || [],
      createdAt: timestamp,
    });
  }

  return managedUser.uid;
}

async function saveStudent(values, profile, item) {
  const support = await fetchSupport(profile);
  const schedule = support.schedules.find((entry) => entry.id === values.scheduleId);
  const adminId = getAdminScope(profile);
  const payload = {
    name: values.name,
    surname: values.surname,
    age: toNumber(values.age, null),
    phone: values.phone || '',
    parentName: values.parentName,
    parentEmail: values.parentEmail.trim(),
    parentPhone: values.parentPhone || '',
    address: values.address || '',
    branchId: values.branchId,
    scheduleId: values.scheduleId,
    trainerId: schedule?.trainerId || '',
    monthlyPrice: toNumber(values.monthlyPrice),
    installmentCount: toNumber(values.installmentCount, 1),
    totalAmount: toNumber(values.totalAmount),
    status: values.status || 'active',
    adminId,
    updatedAt: nowIso(),
  };

  if (item?.id) {
    await patchDocument('students', item.id, payload);
    return item.id;
  }

  let parentUser = await findUserByEmail(values.parentEmail);

  if (!parentUser) {
    const createdParent = await createManagedAuthUser({
      email: values.parentEmail.trim(),
      password: values.parentPassword || 'Parent123',
    });

    await upsertDocument('users', createdParent.uid, {
      name: values.parentName,
      email: values.parentEmail.trim(),
      role: 'parent',
      adminId,
      createdAt: nowIso(),
    });
    parentUser = { id: createdParent.uid };
  }

  const studentId = await createDocument('students', {
    ...payload,
    parentUid: parentUser.id,
    totalPaid: 0,
    attendedClasses: 0,
    missedClasses: 0,
    createdAt: nowIso(),
  });

  await patchDocument('users', parentUser.id, {
    studentId,
    adminId,
  });

  return studentId;
}

async function savePayment(values, profile) {
  const support = await fetchSupport(profile);
  const student = support.students.find((entry) => entry.id === values.studentId);
  const amount = toNumber(values.amount);
  const paymentId = await createDocument('payments', {
    studentId: values.studentId,
    adminId: student?.adminId || getAdminScope(profile),
    amount,
    status: values.status || 'paid',
    method: values.method || 'cash',
    dueDate: values.dueDate || todayIsoDate(),
    paidAt: values.paidAt || todayIsoDate(),
    note: values.note || '',
    createdAt: nowIso(),
  });

  if (student) {
    await patchDocument('students', student.id, {
      totalPaid: toNumber(student.totalPaid) + amount,
    });
  }

  return paymentId;
}

function buildFeatureQuery(featureKey, profile) {
  const adminId = getAdminScope(profile);
  switch (featureKey) {
    case 'secretaries':
      return ['users', [where('adminId', '==', adminId), where('role', '==', 'secretary')]];
    case 'admins':
      return ['users', [where('role', '==', 'admin')]];
    case 'applications':
      return ['applications', []];
    case 'branches':
      return ['branches', [where('adminId', '==', adminId)]];
    case 'trainers':
      return ['trainers', [where('adminId', '==', adminId)]];
    case 'schedules':
      if (profile.role === 'trainer') {
        const trainerId = profile.trainerDocId || profile.uid;
        return ['schedules', [where('trainerId', '==', trainerId)]];
      }
      return ['schedules', [where('adminId', '==', adminId)]];
    case 'prices':
      return ['prices', [where('adminId', '==', adminId)]];
    case 'students':
      if (profile.role === 'trainer') {
        return ['students', [where('adminId', '==', adminId)]];
      }
      return ['students', [where('adminId', '==', adminId)]];
    case 'payments':
      if (profile.role === 'parent') {
        return ['payments', [where('studentId', '==', profile.studentId || profile.student?.id)]];
      }
      return ['payments', [where('adminId', '==', adminId)]];
    case 'events':
      return ['events', []];
    case 'announcements':
      if (profile.role === 'parent' && profile.student?.scheduleId) {
        return ['announcements', []];
      }
      return ['announcements', [where('adminId', '==', adminId)]];
    case 'products':
      return ['products', []];
    case 'standards':
      return ['standards', []];
    case 'discounts':
      return ['discounts', [where('adminId', '==', adminId)]];
    case 'incomes':
      return ['incomes', [where('adminId', '==', adminId)]];
    case 'expenses':
      return ['expenses', [where('adminId', '==', adminId)]];
    case 'attendance':
      if (profile.role === 'parent') {
        return ['attendance', [where('studentId', '==', profile.studentId || profile.student?.id)]];
      }
      return ['attendance', []];
    case 'performances':
      if (profile.role === 'parent') {
        return ['performances', [where('studentId', '==', profile.studentId || profile.student?.id)]];
      }
      return ['performances', []];
    case 'workouts':
      if (profile.role === 'parent') {
        return ['student_workouts', [where('studentId', '==', profile.studentId || profile.student?.id)]];
      }
      return ['workouts', [where('trainerId', '==', profile.uid)]];
    case 'creditPackages':
      return ['credit_packages', []];
    case 'creditRequests':
      if (profile.role === 'trainer') {
        return ['credit_requests', [where('trainerId', '==', profile.uid)]];
      }
      return ['credit_requests', []];
    case 'cashWithdrawalRequests':
      if (profile.role === 'trainer') {
        return ['cash_withdrawal_requests', [where('trainerId', '==', profile.uid)]];
      }
      return ['cash_withdrawal_requests', []];
    case 'advertisements':
      return ['advertisements', []];
    case 'orders':
      if (profile.role === 'superadmin') return ['orders', []];
      return ['orders', [where('userId', '==', profile.uid)]];
    case 'clubProfile':
      return ['clubProfiles', []];
    case 'raceImports':
      return ['race_result_imports', []];
    default:
      return [getFeatureConfig(featureKey)?.collectionName, []];
  }
}

export async function getFeatureSupportData(featureKey, profile) {
  const support = await fetchSupport(profile);
  return support;
}

export async function getFeatureItems(featureKey, profile) {
  const [collectionName, constraints] = buildFeatureQuery(featureKey, profile);
  const support = await fetchSupport(profile);
  let items = await listDocuments(collectionName, constraints);

  if (featureKey === 'announcements' && profile.role === 'parent') {
    items = items.filter((item) => {
      if (item.target === 'all') return true;
      if (item.target === 'schedule' && item.scheduleId === profile.student?.scheduleId) return true;
      return false;
    });
  }

  if (featureKey === 'products') {
    items = items.filter((item) => item.active !== false);
  }

  if (featureKey === 'clubProfile') {
    const profileDoc = await getDocument('clubProfiles', profile.uid);
    return profileDoc ? [profileDoc] : [];
  }

  return sortByDateDesc(items.map((item) => normalizeItem(featureKey, item, support)));
}

export async function getDashboardSummary(profile) {
  const adminId = getAdminScope(profile);

  if (profile.role === 'superadmin') {
    const [admins, applications, orders, creditRequests, withdrawals] = await Promise.all([
      listDocuments('users', [where('role', '==', 'admin')]),
      listDocuments('applications'),
      listDocuments('orders'),
      listDocuments('credit_requests'),
      listDocuments('cash_withdrawal_requests'),
    ]);

    return [
      { label: 'Admin', value: admins.length },
      { label: 'Bekleyen Basvuru', value: applications.filter((entry) => entry.status === 'pending').length },
      { label: 'Bekleyen Siparis', value: orders.filter((entry) => entry.status === 'pending').length },
      { label: 'Kredi Talepleri', value: creditRequests.filter((entry) => entry.status === 'pending').length },
      { label: 'Cekim Talepleri', value: withdrawals.filter((entry) => entry.status === 'pending').length },
    ];
  }

  if (profile.role === 'admin') {
    const [branches, trainers, students, payments, incomes, expenses] = await Promise.all([
      listDocuments('branches', [where('adminId', '==', adminId)]),
      listDocuments('trainers', [where('adminId', '==', adminId)]),
      listDocuments('students', [where('adminId', '==', adminId)]),
      listDocuments('payments', [where('adminId', '==', adminId)]),
      listDocuments('incomes', [where('adminId', '==', adminId)]),
      listDocuments('expenses', [where('adminId', '==', adminId)]),
    ]);

    const paymentIncome = payments.reduce((sum, item) => sum + toNumber(item.amount), 0);
    const extraIncome = incomes.reduce((sum, item) => sum + toNumber(item.amount), 0);
    const totalExpense = expenses.reduce((sum, item) => sum + toNumber(item.amount), 0);

    return [
      { label: 'Sube', value: branches.length },
      { label: 'Antrenor', value: trainers.length },
      { label: 'Ogrenci', value: students.length },
      { label: 'Gelir', value: `₺${paymentIncome + extraIncome}` },
      { label: 'Gider', value: `₺${totalExpense}` },
    ];
  }

  if (profile.role === 'secretary') {
    const [students, payments] = await Promise.all([
      listDocuments('students', [where('adminId', '==', adminId)]),
      listDocuments('payments', [where('adminId', '==', adminId)]),
    ]);

    return [
      { label: 'Kayitli Ogrenci', value: students.length },
      { label: 'Bugun Odenen', value: payments.filter((item) => item.paidAt === todayIsoDate()).length },
      { label: 'Aktif Ogrenci', value: students.filter((item) => item.status === 'active').length },
    ];
  }

  if (profile.role === 'trainer') {
    const [schedules, students, performances, workouts] = await Promise.all([
      getFeatureItems('schedules', profile),
      getFeatureItems('students', profile),
      getFeatureItems('performances', profile),
      getFeatureItems('workouts', profile),
    ]);

    return [
      { label: 'Ders', value: schedules.length },
      { label: 'Sporcu', value: students.length },
      { label: 'Performans Kaydi', value: performances.length },
      { label: 'Antrenman', value: workouts.length },
    ];
  }

  if (profile.role === 'parent') {
    const [payments, attendance, performances] = await Promise.all([
      getFeatureItems('payments', profile),
      getFeatureItems('attendance', profile),
      getFeatureItems('performances', profile),
    ]);

    return [
      { label: 'Cocuk', value: profile.student ? `${profile.student.name} ${profile.student.surname || ''}`.trim() : '-' },
      { label: 'Odeme Kaydi', value: payments.length },
      { label: 'Yoklama Kaydi', value: attendance.length },
      { label: 'Performans', value: performances.length },
    ];
  }

  return [];
}

export async function saveFeatureItem(featureKey, values, profile, item = null) {
  const feature = getFeatureConfig(featureKey);
  const timestamp = nowIso();
  const adminId = getAdminScope(profile);

  switch (featureKey) {
    case 'secretaries':
    case 'trainers':
    case 'admins':
      if (item?.id) {
        const payload = { name: values.name, email: values.email.trim() };
        if (featureKey === 'admins') {
          payload.membershipStart = values.membershipStart;
          payload.membershipEnd = values.membershipEnd;
          payload.membershipPrice = toNumber(values.membershipPrice);
          payload.membershipInstallments = toNumber(values.membershipInstallments, 1);
        }
        await patchDocument('users', item.id, payload);
        if (featureKey === 'trainers' && item.trainerDocId) {
          await patchDocument('trainers', item.trainerDocId, { name: values.name, email: values.email.trim(), branches: values.branches || [] });
        }
        return item.id;
      }
      return createManagedUserRecord(feature, values, profile);
    case 'students':
      return saveStudent(values, profile, item);
    case 'payments':
      return savePayment(values, profile);
    case 'clubProfile':
      await upsertDocument('clubProfiles', profile.uid, {
        name: values.name,
        description: values.description || '',
        logo: values.logo || '',
        updatedAt: timestamp,
      });
      return profile.uid;
    case 'prices': {
      const documentId = item?.id || `${values.branchId}_${values.scheduleId}`;
      await upsertDocument('prices', documentId, {
        branchId: values.branchId,
        scheduleId: values.scheduleId,
        price: toNumber(values.price),
        adminId,
        updatedAt: timestamp,
        createdAt: item?.createdAt || timestamp,
      });
      return documentId;
    }
    case 'creditRequests':
      if (profile.role === 'superadmin' && item?.id) {
        await patchDocument('credit_requests', item.id, {
          status: values.status,
          note: values.note || '',
          updatedAt: timestamp,
        });
        return item.id;
      }
      return createDocument('credit_requests', {
        trainerId: profile.uid,
        credit: toNumber(values.credit),
        amount: toNumber(values.amount),
        note: values.note || '',
        status: values.status || 'pending',
        createdAt: timestamp,
      });
    case 'cashWithdrawalRequests':
      if (profile.role === 'superadmin' && item?.id) {
        await patchDocument('cash_withdrawal_requests', item.id, {
          status: values.status,
          note: values.note || '',
          updatedAt: timestamp,
        });
        return item.id;
      }
      return createDocument('cash_withdrawal_requests', {
        trainerId: profile.uid,
        credits: toNumber(values.credits),
        iban: values.iban || '',
        note: values.note || '',
        status: values.status || 'pending',
        createdAt: timestamp,
      });
    default: {
      const payload = {
        ...values,
        adminId,
        updatedAt: timestamp,
      };

      if (featureKey === 'schedules') {
        payload.capacity = toNumber(values.capacity);
        payload.lessonsCount = toNumber(values.lessonsCount);
      }
      if (featureKey === 'discounts') {
        payload.discountPercent = toNumber(values.discountPercent, null);
        payload.discountAmount = toNumber(values.discountAmount, null);
        payload.maxUsage = toNumber(values.maxUsage, 1);
        payload.valid = true;
      }
      if (featureKey === 'performances') {
        payload.distance = toNumber(values.distance);
        payload.grade = toNumber(values.grade, null);
        payload.trainerId = profile.uid;
        payload.adminId = adminId;
      }
      if (featureKey === 'attendance') {
        payload.trainerId = profile.uid;
      }
      if (featureKey === 'workouts') {
        payload.trainerId = profile.uid;
        payload.exercises = values.exercisesText ? JSON.parse(values.exercisesText || '[]') : [];
        delete payload.exercisesText;
      }
      if (featureKey === 'creditPackages') {
        payload.credit = toNumber(values.credit);
        payload.price = toNumber(values.price);
      }
      if (featureKey === 'products') {
        payload.price = toNumber(values.price);
        payload.stock = toNumber(values.stock);
        payload.active = values.active !== false;
      }
      if (featureKey === 'advertisements') {
        payload.active = values.active !== false;
      }
      if (featureKey === 'incomes' || featureKey === 'expenses') {
        payload.amount = toNumber(values.amount);
      }

      if (item?.id) {
        await patchDocument(feature.collectionName, item.id, payload);
        return item.id;
      }

      payload.createdAt = timestamp;
      return createDocument(feature.collectionName, payload);
    }
  }
}

export async function deleteFeatureItem(featureKey, item, profile) {
  switch (featureKey) {
    case 'clubProfile':
      throw new Error('Kulup profili silinemez; yalnizca guncellenebilir.');
    case 'secretaries':
    case 'admins':
      return removeDocument('users', item.id);
    case 'trainers': {
      if (item.uid) {
        await removeDocument('users', item.uid).catch(() => null);
      }
      return removeDocument('trainers', item.id);
    }
    case 'students':
    case 'branches':
    case 'schedules':
    case 'products':
    case 'discounts':
    case 'incomes':
    case 'expenses':
    case 'advertisements':
    case 'creditPackages':
    case 'standards':
      return removeDocument(getFeatureConfig(featureKey).collectionName, item.id);
    case 'prices':
      return removeDocument('prices', item.id);
    default:
      throw new Error('Bu kayit mobil istemcide silinemez.');
  }
}

export async function createOrderForProduct(product, profile) {
  return createDocument('orders', {
    productId: product.id,
    productName: product.name,
    userId: profile.uid,
    userName: profile.name,
    userRole: profile.role,
    amount: toNumber(product.price),
    status: 'pending',
    createdAt: nowIso(),
  });
}

export async function performQueuedOperation(job) {
  if (job.type === 'save') {
    await saveFeatureItem(job.featureKey, job.values, job.profile, job.item || null);
    return;
  }

  if (job.type === 'delete') {
    await deleteFeatureItem(job.featureKey, job.item, job.profile);
  }
}