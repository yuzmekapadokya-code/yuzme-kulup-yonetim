import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updatePassword,
} from 'firebase/auth';

import { auth, createSecondaryAuthContext } from '../config/firebase';

export async function login(email, password) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function logout() {
  return signOut(auth);
}

export async function createManagedAuthUser({ email, password }) {
  const secondary = await createSecondaryAuthContext();

  try {
    const credential = await createUserWithEmailAndPassword(
      secondary.auth,
      email.trim(),
      password
    );

    return credential.user;
  } finally {
    await secondary.dispose();
  }
}

export async function changeMyEmail({ currentPassword, newEmail }) {
  if (!auth.currentUser || !auth.currentUser.email) {
    throw new Error('Aktif oturum bulunamadi.');
  }

  const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
  await reauthenticateWithCredential(auth.currentUser, credential);
  await updateEmail(auth.currentUser, newEmail.trim());
}

export async function changeMyPassword({ currentPassword, newPassword }) {
  if (!auth.currentUser || !auth.currentUser.email) {
    throw new Error('Aktif oturum bulunamadi.');
  }

  const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
  await reauthenticateWithCredential(auth.currentUser, credential);
  await updatePassword(auth.currentUser, newPassword);
}