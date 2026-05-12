import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, deleteApp, getApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBEk3rweB33vuXh2j2vVLfCeYcoFCDJ5YU',
  authDomain: 'course-abfe3.firebaseapp.com',
  projectId: 'course-abfe3',
  storageBucket: 'course-abfe3.appspot.com',
  messagingSenderId: '1093027241421',
  appId: '1:1093027241421:web:bb72890d59e40812c33884',
  measurementId: 'G-CX86K5746H',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

let authInstance;

try {
  authInstance = initializeAuth(firebaseApp, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  authInstance = getAuth(firebaseApp);
}

let firestoreInstance;

try {
  firestoreInstance = initializeFirestore(firebaseApp, {
    experimentalForceLongPolling: true,
    useFetchStreams: false,
    ignoreUndefinedProperties: true,
  });
} catch {
  firestoreInstance = getFirestore(firebaseApp);
}

export const auth = authInstance;
export const db = firestoreInstance;
export const storage = getStorage(firebaseApp);

export async function createSecondaryAuthContext() {
  const secondaryName = `secondary-${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryName);
  const secondaryAuth = initializeAuth(secondaryApp, {
    persistence: getReactNativePersistence(AsyncStorage),
  });

  return {
    auth: secondaryAuth,
    dispose: async () => {
      await deleteApp(secondaryApp);
    },
  };
}