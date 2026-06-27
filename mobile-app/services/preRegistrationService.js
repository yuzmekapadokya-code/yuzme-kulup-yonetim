import { doc, getDoc, setDoc } from 'firebase/firestore';

import { db } from '../config/firebase';
import { getClubDisplayName, getClubLogoUrl, getLeadFormSettings, parseVideoEmbedUrl } from '../utils/clubProfileHelpers';
import { nowIso } from '../utils/date';

const CLUB_PROFILES_COLLECTION = 'clubProfiles';

function generateSecretToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export function buildPreRegistrationUrl(token) {
  const base = 'https://course-abfe3.web.app/onkayit.html';
  return `${base}?token=${encodeURIComponent(token)}`;
}

export function buildPreRegistrationShareText(clubName, link) {
  return `${clubName || 'Kulübümüz'} ön kayıt formu için bağlantı:\n${link}`;
}

export async function ensurePreRegistrationLink(adminId) {
  const profileRef = doc(db, CLUB_PROFILES_COLLECTION, adminId);
  const profileDoc = await getDoc(profileRef);
  const profileData = profileDoc.exists() ? profileDoc.data() || {} : {};

  let token = String(profileData.leadFormToken || '').trim();
  if (!token) {
    token = generateSecretToken();
    await setDoc(profileRef, {
      leadFormToken: token,
      leadFormUpdatedAt: nowIso(),
    }, { merge: true });
  }

  const clubName = getClubDisplayName(profileData);
  const link = buildPreRegistrationUrl(token);

  return {
    token,
    clubName,
    link,
    shareText: buildPreRegistrationShareText(clubName, link),
    profileData,
    settings: getLeadFormSettings(profileData),
    logoUrl: getLeadFormSettings(profileData).logoUrl || getClubLogoUrl(profileData),
  };
}

export async function getPreRegistrationCustomizeData(adminId) {
  const profileRef = doc(db, CLUB_PROFILES_COLLECTION, adminId);
  const profileDoc = await getDoc(profileRef);
  const profileData = profileDoc.exists() ? profileDoc.data() || {} : {};
  const settings = getLeadFormSettings(profileData);

  return {
    profileData,
    settings,
    clubName: getClubDisplayName(profileData),
    fallbackLogoUrl: getClubLogoUrl(profileData),
  };
}

export async function savePreRegistrationCustomizeData(adminId, values) {
  const profileRef = doc(db, CLUB_PROFILES_COLLECTION, adminId);
  const profileDoc = await getDoc(profileRef);
  const profileData = profileDoc.exists() ? profileDoc.data() || {} : {};
  const existingSettings = getLeadFormSettings(profileData);

  const rawVideoUrl = String(values.videoUrl || '').trim();
  const videoEmbedUrl = parseVideoEmbedUrl(rawVideoUrl);
  if (rawVideoUrl && !videoEmbedUrl) {
    throw new Error('Video linki desteklenmiyor. YouTube veya Vimeo linki girin.');
  }

  const leadFormSettings = {
    eyebrowText: String(values.eyebrowText || 'Ön kayıt formu').trim(),
    title: String(values.title || '').trim(),
    description: String(values.description || '').trim(),
    accentColor: String(values.accentColor || '#0b7ea8').trim(),
    logoUrl: String(values.logoUrl || existingSettings.logoUrl || '').trim(),
    videoUrl: rawVideoUrl,
    videoEmbedUrl,
  };

  await setDoc(profileRef, {
    leadFormSettings,
    updatedAt: nowIso(),
  }, { merge: true });

  return leadFormSettings;
}
