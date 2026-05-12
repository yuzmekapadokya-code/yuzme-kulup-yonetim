import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@yuzme-mobile';

function buildKey(key) {
  return `${PREFIX}:${key}`;
}

export async function setSessionValue(key, value) {
  await AsyncStorage.setItem(buildKey(key), JSON.stringify(value));
}

export async function getSessionValue(key, fallbackValue = null) {
  const raw = await AsyncStorage.getItem(buildKey(key));
  if (!raw) return fallbackValue;

  try {
    return JSON.parse(raw);
  } catch {
    return fallbackValue;
  }
}

export async function removeSessionValue(key) {
  await AsyncStorage.removeItem(buildKey(key));
}

export async function clearSessionNamespace() {
  const keys = await AsyncStorage.getAllKeys();
  const matching = keys.filter((key) => key.startsWith(PREFIX));
  if (matching.length) {
    await AsyncStorage.multiRemove(matching);
  }
}