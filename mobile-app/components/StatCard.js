import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../config/theme';

// Web tarafindaki .stat-card stiline gore: tabela rengi primary, hafif border + golge,
// alt cizgi badge ile tonu vurgulanir.
const TONE_MAP = {
  primary: {
    badge: theme.colors.primary,
    value: theme.colors.primary,
    background: theme.colors.surface,
    backgroundAlt: theme.colors.surfaceAlt,
  },
  success: {
    badge: theme.colors.success,
    value: theme.colors.success,
    background: '#f0fdf4',
    backgroundAlt: '#dcfce7',
  },
  warning: {
    badge: theme.colors.warning,
    value: theme.colors.warning,
    background: '#fffbeb',
    backgroundAlt: '#fef3c7',
  },
  danger: {
    badge: theme.colors.danger,
    value: theme.colors.danger,
    background: '#fef2f2',
    backgroundAlt: '#fee2e2',
  },
  info: {
    badge: theme.colors.info,
    value: theme.colors.info,
    background: '#f0f9ff',
    backgroundAlt: '#e0f2fe',
  },
};

export default function StatCard({ label, value, tone = 'primary', caption }) {
  const palette = TONE_MAP[tone] || TONE_MAP.primary;

  return (
    <View style={[styles.card, { backgroundColor: palette.background }, theme.shadow.sm]}>
      <View style={[styles.badge, { backgroundColor: palette.badge }]} />
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: palette.value }]} numberOfLines={1}>{String(value)}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '46%',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: 8,
  },
  badge: {
    width: 36,
    height: 4,
    borderRadius: 999,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.extrabold,
  },
  caption: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
});
