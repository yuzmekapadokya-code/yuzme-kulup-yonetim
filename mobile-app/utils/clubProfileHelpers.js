const DEFAULT_LEAD_FORM_SETTINGS = {
  eyebrowText: 'Ön kayıt formu',
  title: '',
  description: '',
  logoUrl: '',
  videoUrl: '',
  accentColor: '#0b7ea8',
};

export const BUILT_IN_EDUCATION_MODELS = [
  { id: 'group', name: 'Grup Dersi', defaultPerTrainerCapacity: 8, builtIn: true, removable: false },
  { id: 'private', name: 'Özel Ders', defaultPerTrainerCapacity: 1, builtIn: true, removable: false },
];

export function slugifyEducationModelName(name) {
  const value = String(name || '').trim().toLocaleLowerCase('tr');
  if (!value) return '';
  return value
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

export function normalizeEducationModelEntry(entry, options = {}) {
  if (!entry || typeof entry !== 'object') return null;
  const rawName = String(entry.name || '').trim();
  if (!rawName) return null;
  const builtInDefault = options.builtIn || Boolean(entry.builtIn);
  let id = String(entry.id || '').trim();
  if (!id) {
    const slug = slugifyEducationModelName(rawName);
    id = slug ? `em_${slug}_${Math.random().toString(36).slice(2, 7)}` : `em_${Date.now().toString(36)}`;
  }
  const capRaw = Number(entry.defaultPerTrainerCapacity);
  const defaultPerTrainerCapacity = Number.isFinite(capRaw) && capRaw > 0
    ? Math.max(1, Math.min(50, Math.floor(capRaw)))
    : 8;
  return {
    id,
    name: rawName,
    defaultPerTrainerCapacity,
    builtIn: builtInDefault,
    removable: builtInDefault ? false : (entry.removable !== false),
  };
}

export function getEducationModels(profileData) {
  const customRaw = Array.isArray(profileData?.educationModels) ? profileData.educationModels : [];
  const seenIds = new Set();
  const models = [];
  BUILT_IN_EDUCATION_MODELS.forEach((item) => {
    models.push({ ...item });
    seenIds.add(item.id);
  });
  customRaw.forEach((entry) => {
    const normalized = normalizeEducationModelEntry(entry, { builtIn: Boolean(entry?.builtIn) });
    if (!normalized) return;
    if (seenIds.has(normalized.id)) return;
    seenIds.add(normalized.id);
    models.push(normalized);
  });
  return models;
}

export function getEducationModelById(profileData, modelId) {
  const target = String(modelId || '').trim();
  if (!target) return null;
  return getEducationModels(profileData).find((item) => item.id === target) || null;
}

export function getEducationModelLabel(profileData, modelId) {
  const model = getEducationModelById(profileData, modelId);
  if (model) return model.name;
  if (modelId === 'private') return 'Özel Ders';
  if (modelId === 'group') return 'Grup Dersi';
  return String(modelId || 'Ders');
}

export const EXPENSE_CATEGORIES = [
  { id: 'pool_rent', label: 'Havuz kirası' },
  { id: 'advertising', label: 'Reklam / tanıtım harcaması' },
  { id: 'utilities', label: 'Elektrik / su / doğalgaz' },
  { id: 'equipment', label: 'Malzeme ve ekipman' },
  { id: 'maintenance', label: 'Bakım ve onarım' },
  { id: 'insurance', label: 'Sigorta' },
  { id: 'staff_services', label: 'Personel / dış hizmet' },
  { id: 'taxes_fees', label: 'Vergi ve resmi harçlar' },
  { id: 'office', label: 'Ofis / kırtasiye' },
  { id: 'other', label: 'Diğer' },
];

export function getClubDisplayName(profileData) {
  return String(profileData?.clubName || profileData?.name || '').trim();
}

export function getClubLogoUrl(profileData) {
  return String(profileData?.logoUrl || '').trim();
}

export function getLeadFormSettings(profileData) {
  const stored = profileData?.leadFormSettings && typeof profileData.leadFormSettings === 'object'
    ? profileData.leadFormSettings
    : {};
  return {
    ...DEFAULT_LEAD_FORM_SETTINGS,
    ...stored,
  };
}

export function getExpenseCategoryMeta(categoryId) {
  return EXPENSE_CATEGORIES.find((item) => item.id === categoryId) || null;
}

export function getExpenseDisplayLabel(expense) {
  if (!expense) return 'Gider';
  if (expense.category === 'other' && expense.otherNote) {
    return `Diğer: ${expense.otherNote}`;
  }
  if (expense.categoryLabel) return expense.categoryLabel;
  const meta = getExpenseCategoryMeta(expense.category);
  if (meta) return meta.label;
  return expense.description || 'Gider';
}

export function parseVideoEmbedUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) return '';

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const videoId = url.pathname.replace('/', '');
      return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const videoId = url.searchParams.get('v');
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
      const shortsMatch = url.pathname.match(/\/shorts\/([^/]+)/);
      if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
    }

    if (host === 'vimeo.com') {
      const videoId = url.pathname.split('/').filter(Boolean)[0];
      return videoId ? `https://player.vimeo.com/video/${videoId}` : '';
    }
  } catch (error) {
    return '';
  }

  return '';
}
