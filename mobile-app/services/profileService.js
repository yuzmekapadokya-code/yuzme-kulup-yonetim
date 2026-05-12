import { collection, getDocs, limit, query, where } from 'firebase/firestore';

import { db } from '../config/firebase';
import { getDocument } from '../api/firestoreClient';

async function findTrainerProfile(uid) {
  const snapshot = await getDocs(query(collection(db, 'trainers'), where('uid', '==', uid), limit(1)));
  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

export async function buildUserProfile(firebaseUser) {
  if (!firebaseUser) return null;

  const userDoc = await getDocument('users', firebaseUser.uid);
  if (!userDoc) return null;

  const base = {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    name: userDoc.name || firebaseUser.email || 'Kullanici',
    role: userDoc.role,
    adminId: userDoc.adminId || null,
    studentId: userDoc.studentId || null,
    frozen: Boolean(userDoc.frozen),
    membershipEnd: userDoc.membershipEnd || null,
    raw: userDoc,
  };

  if (base.role === 'trainer') {
    const trainerProfile = await findTrainerProfile(firebaseUser.uid);
    return {
      ...base,
      trainerDocId: trainerProfile?.id || null,
      adminId: trainerProfile?.adminId || base.adminId,
      branches: trainerProfile?.branches || [],
      trainerProfile,
    };
  }

  if (base.role === 'parent' && base.studentId) {
    const student = await getDocument('students', base.studentId);
    return {
      ...base,
      adminId: student?.adminId || base.adminId,
      student,
    };
  }

  return base;
}