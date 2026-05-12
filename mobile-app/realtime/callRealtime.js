import { Alert } from 'react-native';

import { subscribeDocuments, where } from '../api/firestoreClient';

let unsubscribeRef = null;
let lastShownCallId = null;

export function startIncomingCallWatcher(profile) {
  stopIncomingCallWatcher();

  unsubscribeRef = subscribeDocuments(
    'calls',
    [where('participants', 'array-contains', profile.uid)],
    (calls) => {
      const incoming = calls.find(
        (call) => call.status === 'ringing' && call.callerId && call.callerId !== profile.uid
      );

      if (!incoming || incoming.id === lastShownCallId) {
        return;
      }

      lastShownCallId = incoming.id;
      Alert.alert('Gelen Cagri', `${incoming.callerName || 'Bir kullanici'} sizi ariyor.`);
    },
    (error) => console.warn('Incoming call watcher failed:', error.message)
  );

  return unsubscribeRef;
}

export function stopIncomingCallWatcher() {
  unsubscribeRef?.();
  unsubscribeRef = null;
  lastShownCallId = null;
}