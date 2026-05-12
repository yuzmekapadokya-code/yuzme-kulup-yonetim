import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  setDoc,
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

const ROLE_ACCOUNTS = {
  superadmin: { email: 'superadmin@yuzme.com', password: 'SuperAdmin123' },
  admin: { email: 'admin@yuzme.com', password: 'Admin123' },
  secretary: { email: 'secretary@yuzme.com', password: 'Secretary123' },
  trainer: { email: 'trainer@yuzme.com', password: 'Trainer123' },
  parent: { email: 'parent@yuzme.com', password: 'Parent123' },
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function nowIso() {
  return new Date().toISOString();
}

async function signOutQuietly() {
  try {
    await signOut(auth);
  } catch {
    // Ignore cleanup failures.
  }
}

async function findDocsByEmail(collectionName, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const snapshot = await getDocs(query(collection(db, collectionName), where('email', '==', normalizedEmail), limit(25)));
  return snapshot.docs.map((item) => ({ id: item.id, ref: item.ref, ...item.data() }));
}

async function cleanupDuplicateUserDocs(email, keepUid) {
  const duplicates = await findDocsByEmail('users', email);
  const removals = duplicates
    .filter((item) => item.id !== keepUid)
    .map((item) => deleteDoc(doc(db, 'users', item.id)));

  await Promise.all(removals);
}

async function ensureAuthAccount({ email, password }) {
  await signOutQuietly();

  try {
    const signedIn = await signInWithEmailAndPassword(auth, email, password);
    return signedIn.user;
  } catch (signInError) {
    try {
      const created = await createUserWithEmailAndPassword(auth, email, password);
      return created.user;
    } catch (createError) {
      if (createError.code === 'auth/email-already-in-use') {
        const retry = await signInWithEmailAndPassword(auth, email, password);
        return retry.user;
      }

      throw new Error(`${email} hesabi onarilamadi: ${createError.message || createError.code || signInError.message || signInError.code}`);
    }
  }
}

async function ensureUserDoc(user, payload) {
  await cleanupDuplicateUserDocs(payload.email, user.uid);
  await setDoc(doc(db, 'users', user.uid), {
    ...payload,
    email: String(payload.email || user.email || '').trim().toLowerCase(),
    createdAt: payload.createdAt || nowIso(),
  }, { merge: true });
}

async function getOrCreateBranch(adminUid) {
  const existing = await getDocs(query(collection(db, 'branches'), where('adminId', '==', adminUid), limit(1)));
  if (!existing.empty) {
    return { id: existing.docs[0].id, ...existing.docs[0].data() };
  }

  const created = await addDoc(collection(db, 'branches'), {
    name: 'Merkez Subesi',
    address: 'Istanbul, Besiktas',
    phone: '02120000000',
    adminId: adminUid,
    createdAt: nowIso(),
  });
  const snapshot = await getDoc(created);
  return { id: snapshot.id, ...snapshot.data() };
}

async function ensureClubProfile(adminUid) {
  await setDoc(doc(db, 'clubProfiles', adminUid), {
    adminId: adminUid,
    clubName: 'Yuzme Demo Kulubu',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }, { merge: true });
}

async function getOrCreateTrainerDoc(adminUid, trainerUid, branchId) {
  const byUid = await getDocs(query(collection(db, 'trainers'), where('uid', '==', trainerUid), limit(1)));
  if (!byUid.empty) {
    const trainerDoc = byUid.docs[0];
    await setDoc(trainerDoc.ref, {
      name: 'Emre Hoca',
      email: ROLE_ACCOUNTS.trainer.email,
      uid: trainerUid,
      role: 'trainer',
      adminId: adminUid,
      branches: [branchId],
      updatedAt: nowIso(),
    }, { merge: true });
    return { id: trainerDoc.id, ...trainerDoc.data(), uid: trainerUid };
  }

  const byEmail = await findDocsByEmail('trainers', ROLE_ACCOUNTS.trainer.email);
  if (byEmail.length) {
    await setDoc(doc(db, 'trainers', byEmail[0].id), {
      name: 'Emre Hoca',
      email: ROLE_ACCOUNTS.trainer.email,
      uid: trainerUid,
      role: 'trainer',
      adminId: adminUid,
      branches: [branchId],
      updatedAt: nowIso(),
    }, { merge: true });
    return { id: byEmail[0].id, ...byEmail[0], uid: trainerUid };
  }

  const created = await addDoc(collection(db, 'trainers'), {
    name: 'Emre Hoca',
    email: ROLE_ACCOUNTS.trainer.email,
    uid: trainerUid,
    role: 'trainer',
    adminId: adminUid,
    branches: [branchId],
    createdAt: nowIso(),
  });
  const snapshot = await getDoc(created);
  return { id: snapshot.id, ...snapshot.data() };
}

async function getOrCreateSchedule(adminUid, branchId, trainerDocId) {
  const existing = await getDocs(
    query(
      collection(db, 'schedules'),
      where('adminId', '==', adminUid),
      where('branchId', '==', branchId),
      where('trainerId', '==', trainerDocId),
      limit(1),
    ),
  );

  if (!existing.empty) {
    const scheduleDoc = existing.docs[0];
    await setDoc(scheduleDoc.ref, {
      time: '10:00',
      capacity: 15,
      adminId: adminUid,
      branchId,
      trainerId: trainerDocId,
      updatedAt: nowIso(),
    }, { merge: true });
    return { id: scheduleDoc.id, ...scheduleDoc.data() };
  }

  const created = await addDoc(collection(db, 'schedules'), {
    branchId,
    trainerId: trainerDocId,
    adminId: adminUid,
    time: '10:00',
    capacity: 15,
    createdAt: nowIso(),
  });
  const snapshot = await getDoc(created);
  return { id: snapshot.id, ...snapshot.data() };
}

async function ensurePrice(branchId, scheduleId, adminUid) {
  await setDoc(doc(db, 'prices', `${branchId}_10:00`), {
    branchId,
    scheduleId,
    adminId: adminUid,
    price: 3000,
    updatedAt: nowIso(),
  }, { merge: true });
}

async function getOrCreateStudent(parentUid, adminUid, branchId, scheduleId) {
  const byParent = await getDocs(query(collection(db, 'students'), where('parentUid', '==', parentUid), limit(1)));
  if (!byParent.empty) {
    const studentDoc = byParent.docs[0];
    await setDoc(studentDoc.ref, {
      name: 'Ahmet',
      surname: 'Kaya',
      age: 12,
      phone: '5300000000',
      parentName: 'Fatma Kaya',
      parentEmail: ROLE_ACCOUNTS.parent.email,
      parentPhone: '5300000001',
      address: 'Istanbul, Besiktas, Yildiz Mahallesi',
      branchId,
      scheduleId,
      adminId: adminUid,
      monthlyPrice: 3000,
      installmentCount: 3,
      totalAmount: 9000,
      totalPaid: 3000,
      attendedClasses: 8,
      missedClasses: 2,
      parentUid,
      status: 'active',
      updatedAt: nowIso(),
    }, { merge: true });
    return { id: studentDoc.id, ...studentDoc.data() };
  }

  const created = await addDoc(collection(db, 'students'), {
    name: 'Ahmet',
    surname: 'Kaya',
    age: 12,
    phone: '5300000000',
    parentName: 'Fatma Kaya',
    parentEmail: ROLE_ACCOUNTS.parent.email,
    parentPhone: '5300000001',
    address: 'Istanbul, Besiktas, Yildiz Mahallesi',
    branchId,
    scheduleId,
    adminId: adminUid,
    monthlyPrice: 3000,
    installmentCount: 3,
    totalAmount: 9000,
    totalPaid: 3000,
    attendedClasses: 8,
    missedClasses: 2,
    parentUid,
    status: 'active',
    createdAt: nowIso(),
  });
  const snapshot = await getDoc(created);
  return { id: snapshot.id, ...snapshot.data() };
}

async function main() {
  const superAdminAuth = await ensureAuthAccount(ROLE_ACCOUNTS.superadmin);
  await ensureUserDoc(superAdminAuth, {
    name: 'Super Admin',
    email: ROLE_ACCOUNTS.superadmin.email,
    role: 'superadmin',
    frozen: false,
  });

  const adminAuth = await ensureAuthAccount(ROLE_ACCOUNTS.admin);
  await ensureUserDoc(adminAuth, {
    name: 'Yonetici',
    email: ROLE_ACCOUNTS.admin.email,
    role: 'admin',
    frozen: false,
    membershipStart: new Date().toISOString().split('T')[0],
    membershipEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    membershipPrice: 5000,
    membershipInstallments: 12,
  });

  const branch = await getOrCreateBranch(adminAuth.uid);
  await ensureClubProfile(adminAuth.uid);

  const secretaryAuth = await ensureAuthAccount(ROLE_ACCOUNTS.secretary);
  await ensureUserDoc(secretaryAuth, {
    name: 'Sekreter',
    email: ROLE_ACCOUNTS.secretary.email,
    role: 'secretary',
    adminId: adminAuth.uid,
  });

  const trainerAuth = await ensureAuthAccount(ROLE_ACCOUNTS.trainer);
  await ensureUserDoc(trainerAuth, {
    name: 'Emre Hoca',
    email: ROLE_ACCOUNTS.trainer.email,
    role: 'trainer',
    adminId: adminAuth.uid,
  });

  const trainerDoc = await getOrCreateTrainerDoc(adminAuth.uid, trainerAuth.uid, branch.id);
  await ensureUserDoc(trainerAuth, {
    name: 'Emre Hoca',
    email: ROLE_ACCOUNTS.trainer.email,
    role: 'trainer',
    adminId: adminAuth.uid,
    trainerDocId: trainerDoc.id,
  });

  const schedule = await getOrCreateSchedule(adminAuth.uid, branch.id, trainerDoc.id);
  await ensurePrice(branch.id, schedule.id, adminAuth.uid);

  const parentAuth = await ensureAuthAccount(ROLE_ACCOUNTS.parent);
  const student = await getOrCreateStudent(parentAuth.uid, adminAuth.uid, branch.id, schedule.id);
  await ensureUserDoc(parentAuth, {
    name: 'Fatma Kaya',
    email: ROLE_ACCOUNTS.parent.email,
    role: 'parent',
    adminId: adminAuth.uid,
    studentId: student.id,
  });

  console.log(JSON.stringify({
    ok: true,
    adminUid: adminAuth.uid,
    branchId: branch.id,
    scheduleId: schedule.id,
    trainerDocId: trainerDoc.id,
    studentId: student.id,
  }, null, 2));
}

main()
  .then(async () => {
    await signOutQuietly();
  })
  .catch(async (error) => {
    console.error(error.message || error);
    await signOutQuietly();
    process.exitCode = 1;
  });