export function getAdminScope(profile) {
  if (!profile) return null;

  if (profile.role === 'admin') return profile.uid;
  if (profile.role === 'superadmin') return null;

  return profile.adminId || null;
}

export function canManageUsers(profile) {
  return profile?.role === 'admin' || profile?.role === 'superadmin';
}

export function canEditFeature(profile, feature) {
  if (!profile || !feature) return false;
  if (profile.role === 'superadmin') return feature.allowRoles?.includes('superadmin') !== false;
  return feature.allowRoles?.includes(profile.role) ?? false;
}

export function isReadOnlyRole(profile) {
  return profile?.role === 'parent';
}