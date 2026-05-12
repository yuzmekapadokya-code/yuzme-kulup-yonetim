import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  where,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBEk3rweB33vuXh2j2vVLfCeYcoFCDJ5YU',
  authDomain: 'course-abfe3.firebaseapp.com',
  projectId: 'course-abfe3',
  storageBucket: 'course-abfe3.appspot.com',
  messagingSenderId: '1093027241421',
  appId: '1:1093027241421:web:bb72890d59e40812c33884',
  measurementId: 'G-CX86K5746H',
};

const roleAccounts = [
  {
    role: 'superadmin',
    email: 'superadmin@yuzme.com',
    password: 'SuperAdmin123',
  },
  {
    role: 'admin',
    email: 'admin@yuzme.com',
    password: 'Admin123',
  },
  {
    role: 'secretary',
    email: 'secretary@yuzme.com',
    password: 'Secretary123',
  },
  {
    role: 'trainer',
    email: 'trainer@yuzme.com',
    password: 'Trainer123',
  },
  {
    role: 'parent',
    email: 'parent@yuzme.com',
    password: 'Parent123',
  },
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function serializeError(error) {
  return error?.message || error?.code || String(error);
}

async function getOne(collectionName, constraints = []) {
  const snapshot = constraints.length
    ? await getDocs(query(collection(db, collectionName), ...constraints, limit(1)))
    : await getDocs(query(collection(db, collectionName), limit(1)));

  return {
    size: snapshot.size,
    empty: snapshot.empty,
    first: snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() },
  };
}

async function findUserDocByEmail(email) {
  const snapshot = await getDocs(
    query(collection(db, 'users'), where('email', '==', String(email).trim().toLowerCase()), limit(1))
  );

  if (snapshot.empty) {
    return null;
  }

  return {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data(),
  };
}

async function getUserProfile(user) {
  const userSnap = await getDoc(doc(db, 'users', user.uid));
  if (!userSnap.exists()) {
    throw new Error(`users/${user.uid} bulunamadi`);
  }

  const userDoc = { id: userSnap.id, ...userSnap.data() };
  const profile = {
    uid: user.uid,
    email: user.email,
    role: userDoc.role,
    adminId: userDoc.adminId || null,
    studentId: userDoc.studentId || null,
    userDoc,
  };

  if (profile.role === 'trainer') {
    const trainerDoc = await getOne('trainers', [where('uid', '==', user.uid)]);
    profile.trainerDoc = trainerDoc.first;
    profile.adminId = trainerDoc.first?.adminId || profile.adminId;
  }

  if (profile.role === 'parent' && profile.studentId) {
    const studentSnap = await getDoc(doc(db, 'students', profile.studentId));
    if (studentSnap.exists()) {
      profile.studentDoc = { id: studentSnap.id, ...studentSnap.data() };
      profile.adminId = profile.studentDoc.adminId || profile.adminId;
    }
  }

  return profile;
}

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runSuperAdminChecks(profile) {
  const admins = await getOne('users', [where('role', '==', 'admin')]);
  const applications = await getOne('applications');
  const orders = await getOne('orders');
  const credits = await getOne('credit_requests');
  const withdrawals = await getOne('cash_withdrawal_requests');
  const ads = await getOne('advertisements');

  return {
    adminUsersVisible: !admins.empty,
    applicationsAccessible: true,
    ordersAccessible: true,
    creditRequestsAccessible: true,
    withdrawalRequestsAccessible: true,
    advertisementsAccessible: true,
    samples: {
      admins: admins.size,
      applications: applications.size,
      orders: orders.size,
      creditRequests: credits.size,
      withdrawals: withdrawals.size,
      advertisements: ads.size,
    },
  };
}

async function runAdminChecks(profile) {
  const adminId = profile.uid;
  const branches = await getOne('branches', [where('adminId', '==', adminId)]);
  const trainers = await getOne('trainers', [where('adminId', '==', adminId)]);
  const schedules = await getOne('schedules', [where('adminId', '==', adminId)]);
  const students = await getOne('students', [where('adminId', '==', adminId)]);
  const payments = await getOne('payments', [where('adminId', '==', adminId)]);
  const incomes = await getOne('incomes', [where('adminId', '==', adminId)]);
  const expenses = await getOne('expenses', [where('adminId', '==', adminId)]);
  const clubProfile = await getDoc(doc(db, 'clubProfiles', adminId));

  return {
    adminScopeResolved: Boolean(adminId),
    branchesAccessible: true,
    trainersAccessible: true,
    schedulesAccessible: true,
    studentsAccessible: true,
    financeCollectionsAccessible: true,
    clubProfileAccessible: clubProfile.exists() || !clubProfile.exists(),
    samples: {
      branches: branches.size,
      trainers: trainers.size,
      schedules: schedules.size,
      students: students.size,
      payments: payments.size,
      incomes: incomes.size,
      expenses: expenses.size,
      clubProfile: clubProfile.exists() ? 1 : 0,
    },
  };
}

async function runSecretaryChecks(profile) {
  const adminId = profile.adminId;
  expect(adminId, 'Sekreter icin adminId cozumlenemedi');

  const students = await getOne('students', [where('adminId', '==', adminId)]);
  const payments = await getOne('payments', [where('adminId', '==', adminId)]);
  const schedules = await getOne('schedules', [where('adminId', '==', adminId)]);
  const branches = await getOne('branches', [where('adminId', '==', adminId)]);
  const trainers = await getOne('trainers', [where('adminId', '==', adminId)]);
  const chats = await getOne('chats', [where('userIds', 'array-contains', profile.uid)]);

  return {
    adminScopeResolved: true,
    studentsAccessible: true,
    paymentsAccessible: true,
    schedulingDataAccessible: true,
    chatsAccessible: true,
    samples: {
      students: students.size,
      payments: payments.size,
      schedules: schedules.size,
      branches: branches.size,
      trainers: trainers.size,
      chats: chats.size,
    },
  };
}

async function runTrainerChecks(profile) {
  expect(profile.trainerDoc, 'Antrenor dokumani bulunamadi');
  const adminId = profile.adminId;
  expect(adminId, 'Antrenor icin adminId cozumlenemedi');

  const schedules = await getOne('schedules', [where('adminId', '==', adminId)]);
  const students = await getOne('students', [where('adminId', '==', adminId)]);
  const workouts = await getOne('workouts', [where('trainerId', '==', profile.uid)]);
  const studentWorkouts = await getOne('student_workouts', [where('trainerId', '==', profile.uid)]);
  const creditRequests = await getOne('credit_requests', [where('trainerId', '==', profile.uid)]);
  const cashWithdrawals = await getOne('cash_withdrawal_requests', [where('trainerId', '==', profile.uid)]);
  const chats = await getOne('chats', [where('userIds', 'array-contains', profile.uid)]);

  return {
    trainerProfileResolved: true,
    adminScopeResolved: true,
    classDataAccessible: true,
    workoutDataAccessible: true,
    financeDataAccessible: true,
    chatsAccessible: true,
    samples: {
      schedules: schedules.size,
      students: students.size,
      workouts: workouts.size,
      studentWorkouts: studentWorkouts.size,
      creditRequests: creditRequests.size,
      cashWithdrawals: cashWithdrawals.size,
      chats: chats.size,
    },
  };
}

async function runParentChecks(profile) {
  expect(profile.studentDoc, 'Veli hesabina bagli ogrenci bulunamadi');
  const adminId = profile.adminId;
  expect(adminId, 'Veli icin adminId cozumlenemedi');

  const schedules = await getOne('schedules', [where('adminId', '==', adminId)]);
  const branches = await getOne('branches', [where('adminId', '==', adminId)]);
  const trainers = await getOne('trainers', [where('adminId', '==', adminId)]);
  const announcements = await getOne('announcements', [where('adminId', '==', adminId)]);
  const events = await getOne('events', [where('adminId', '==', adminId)]);
  const products = await getOne('products');
  const performances = await getOne('performances', [where('studentId', '==', profile.studentDoc.id)]);
  const comments = await getOne('lesson_comments', [where('studentId', '==', profile.studentDoc.id)]);
  const reviews = await getOne('trainer_reviews', [where('studentId', '==', profile.studentDoc.id)]);
  const attendance = await getOne('attendance', [where('studentId', '==', profile.studentDoc.id)]);
  const standards = await getOne('standards');
  const studentWorkouts = await getOne('student_workouts', [where('studentId', '==', profile.studentDoc.id)]);
  const chats = await getOne('chats', [where('userIds', 'array-contains', profile.uid)]);

  return {
    studentBindingResolved: true,
    adminScopeResolved: true,
    progressDataAccessible: true,
    dailyDataAccessible: true,
    communicationDataAccessible: true,
    samples: {
      schedules: schedules.size,
      branches: branches.size,
      trainers: trainers.size,
      announcements: announcements.size,
      events: events.size,
      products: products.size,
      performances: performances.size,
      lessonComments: comments.size,
      trainerReviews: reviews.size,
      attendance: attendance.size,
      standards: standards.size,
      studentWorkouts: studentWorkouts.size,
      chats: chats.size,
    },
  };
}

async function runChecksForRole(account) {
  const credential = await signInWithEmailAndPassword(auth, account.email, account.password);
  const profile = await getUserProfile(credential.user);

  expect(profile.role === account.role, `Rol uyusmuyor. Beklenen: ${account.role}, gelen: ${profile.role}`);

  let details;

  switch (account.role) {
    case 'superadmin':
      details = await runSuperAdminChecks(profile);
      break;
    case 'admin':
      details = await runAdminChecks(profile);
      break;
    case 'secretary':
      details = await runSecretaryChecks(profile);
      break;
    case 'trainer':
      details = await runTrainerChecks(profile);
      break;
    case 'parent':
      details = await runParentChecks(profile);
      break;
    default:
      throw new Error(`Desteklenmeyen rol: ${account.role}`);
  }

  await signOut(auth);

  return {
    role: account.role,
    email: account.email,
    uid: credential.user.uid,
    profileRole: profile.role,
    details,
  };
}

async function diagnoseFailedLogin(account) {
  try {
    await signOut(auth).catch(() => undefined);
    await signInWithEmailAndPassword(auth, 'superadmin@yuzme.com', 'SuperAdmin123');
    const userDoc = await findUserDocByEmail(account.email);
    await signOut(auth).catch(() => undefined);

    return {
      userDocExists: Boolean(userDoc),
      userDoc: userDoc
        ? {
            id: userDoc.id,
            role: userDoc.role || null,
            adminId: userDoc.adminId || null,
            studentId: userDoc.studentId || null,
          }
        : null,
    };
  } catch (error) {
    await signOut(auth).catch(() => undefined);
    return {
      diagnosticError: serializeError(error),
    };
  }
}

async function main() {
  const results = [];
  let failures = 0;

  for (const account of roleAccounts) {
    try {
      const result = await runChecksForRole(account);
      results.push({ status: 'PASS', ...result });
    } catch (error) {
      failures += 1;
      const diagnosis = await diagnoseFailedLogin(account);
      results.push({
        status: 'FAIL',
        role: account.role,
        email: account.email,
        error: serializeError(error),
        diagnosis,
      });

      try {
        await signOut(auth);
      } catch {
        // Ignore cleanup failures.
      }
    }
  }

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    total: results.length,
    failures,
    results,
  }, null, 2));

  if (failures > 0) {
    process.exitCode = 1;
  }
}

await main();