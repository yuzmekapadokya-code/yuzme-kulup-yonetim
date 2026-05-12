import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import { db } from '../config/firebase';

export function collectionRef(collectionName) {
  return collection(db, collectionName);
}

export function documentRef(collectionName, documentId) {
  return doc(db, collectionName, documentId);
}

export async function getDocument(collectionName, documentId) {
  const snapshot = await getDoc(documentRef(collectionName, documentId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function listDocuments(collectionName, constraints = []) {
  const sourceQuery = constraints.length
    ? query(collectionRef(collectionName), ...constraints)
    : query(collectionRef(collectionName));
  const snapshot = await getDocs(sourceQuery);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export function subscribeDocuments(collectionName, constraints = [], onNext, onError) {
  const sourceQuery = constraints.length
    ? query(collectionRef(collectionName), ...constraints)
    : query(collectionRef(collectionName));

  return onSnapshot(
    sourceQuery,
    (snapshot) => {
      const docs = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      onNext(docs);
    },
    onError
  );
}

export async function createDocument(collectionName, payload) {
  const ref = await addDoc(collectionRef(collectionName), payload);
  return ref.id;
}

export async function upsertDocument(collectionName, documentId, payload, merge = true) {
  await setDoc(documentRef(collectionName, documentId), payload, { merge });
  return documentId;
}

export async function patchDocument(collectionName, documentId, payload) {
  await updateDoc(documentRef(collectionName, documentId), payload);
  return documentId;
}

export async function removeDocument(collectionName, documentId) {
  await deleteDoc(documentRef(collectionName, documentId));
}

export { limit, orderBy, where };