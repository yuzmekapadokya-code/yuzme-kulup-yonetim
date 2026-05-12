import { subscribeDocuments } from '../api/firestoreClient';

export function watchCollection(collectionName, constraints, onNext, onError) {
  return subscribeDocuments(collectionName, constraints, onNext, onError);
}