const dayLabels = {
  monday: 'Pzt',
  tuesday: 'Sal',
  wednesday: 'Car',
  thursday: 'Per',
  friday: 'Cum',
  saturday: 'Cmt',
  sunday: 'Paz',
};

export function formatScheduleDays(schedule) {
  return (schedule?.days || [])
    .map((day) => dayLabels[day] || day)
    .filter(Boolean)
    .join(', ');
}

export function getScheduleDisplayLabel(schedule, branch = null) {
  if (!schedule) return 'Bilinmiyor';

  const customName = String(schedule.customName || '').trim();
  const time = schedule.time || '';
  const days = formatScheduleDays(schedule);
  const daySuffix = days ? ` • ${days}` : '';

  if (customName) {
    return `${customName} • ${time}${daySuffix}`;
  }

  const branchName = branch?.name || schedule.branchName || 'Şube';
  return `${branchName} • ${time}${daySuffix}`;
}
