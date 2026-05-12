import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { addDoc, collection, doc, getDoc, setDoc } from 'firebase/firestore';

import { db } from '../config/firebase';
import { nowIso } from '../utils/date';

const FALLBACK_PROJECT_ID = '9e124f1f-6095-45dd-b5cc-134942a82fc6';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getProjectId() {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId
    || Constants?.easConfig?.projectId
    || FALLBACK_PROJECT_ID
  );
}

function normalizeTokens(tokens = []) {
  return Array.from(new Set((Array.isArray(tokens) ? tokens : []).filter(Boolean)));
}

async function getUserPushTokens(userId) {
  if (!userId) return [];
  const snapshot = await getDoc(doc(db, 'users', userId));
  if (!snapshot.exists()) return [];
  return normalizeTokens(snapshot.data()?.expoPushTokens || []);
}

export async function registerPushToken(profile) {
  if (!profile?.uid || Platform.OS === 'web' || !Device.isDevice) {
    return null;
  }

  const existingPermission = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermission.status;

  if (finalStatus !== 'granted') {
    const requestedPermission = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermission.status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Genel',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0ea5e9',
      sound: 'default',
    });
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId: getProjectId() });
  const token = tokenResponse?.data || null;
  if (!token) {
    return null;
  }

  const userRef = doc(db, 'users', profile.uid);
  const userSnapshot = await getDoc(userRef);
  const currentTokens = normalizeTokens(userSnapshot.data()?.expoPushTokens || []);
  const nextTokens = normalizeTokens([...currentTokens, token]);

  await setDoc(
    userRef,
    {
      expoPushTokens: nextTokens,
      lastExpoPushToken: token,
      pushPlatform: Platform.OS,
      pushUpdatedAt: nowIso(),
    },
    { merge: true }
  );

  return token;
}

export async function sendExpoPushNotifications(tokens, payload) {
  const validTokens = normalizeTokens(tokens);
  if (!validTokens.length) {
    return [];
  }

  const messages = validTokens.map((token) => ({
    to: token,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
    channelId: 'default',
  }));

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    throw new Error(`Push servisi ${response.status} hatasi verdi.`);
  }

  const result = await response.json();
  return result?.data || [];
}

export async function createAppNotification({ userId, title, message, type, data = {} }) {
  if (!userId || !title || !message) {
    return null;
  }

  const payload = {
    userId,
    title,
    message,
    type: type || 'general',
    read: false,
    createdAt: nowIso(),
    ...data,
  };

  const created = await addDoc(collection(db, 'notifications'), payload);

  try {
    const tokens = await getUserPushTokens(userId);
    if (tokens.length) {
      await sendExpoPushNotifications(tokens, {
        title,
        body: message,
        data: {
          notificationId: created.id,
          type: type || 'general',
          ...data,
        },
      });
    }
  } catch (error) {
    console.warn('Push bildirimi gonderilemedi:', error.message);
  }

  return created.id;
}

export async function createAppNotifications(userIds, payload) {
  const recipients = Array.from(new Set((Array.isArray(userIds) ? userIds : []).filter(Boolean)));
  if (!recipients.length) {
    return [];
  }

  return Promise.all(
    recipients.map((userId) => createAppNotification({ ...payload, userId }))
  );
}