const DEFAULT_LEAD_FORM_SETTINGS = {
  eyebrowText: 'Ön kayıt formu',
  title: '',
  description: '',
  logoUrl: '',
  videoUrl: '',
  accentColor: '#0b7ea8',
};

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
