import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../config/theme';

export default function StatCard({ label, value, tone = 'primary' }) {
  const toneMap = {
    primary: { badge: '#d9eefb', card: '#ffffff', value: theme.colors.primaryDeep },
    success: { badge: '#dff5ea', card: '#f8fffb', value: theme.colors.success },
    warning: { badge: '#fff0d8', card: '#fffaf2', value: theme.colors.warning },
  };
  const palette = toneMap[tone] || toneMap.primary;

  return (
    <View style={[styles.card, theme.shadow.card, { backgroundColor: palette.card }]}>
      <View style={[styles.badge, { backgroundColor: palette.badge }]} />
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: palette.value }]}>{String(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 10,
  },
  badge: {
    width: 44,
    height: 6,
    borderRadius: 999,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  value: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
});