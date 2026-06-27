import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../config/theme';

// Web tarafindaki gradient hero seritleriyle birebir hizali. Linear gradient yerine duz
// koyu mavi + alt sarit kullaniyoruz; expo-linear-gradient bagimliligi olmadan basarili sonuc verir.
export default function HeroBanner({ eyebrow, title, description, stats = [], tone = 'primary' }) {
  const palette = tone === 'success'
    ? { background: '#dcfce7', accent: theme.colors.success, eyebrow: theme.colors.success, title: '#064e3b', description: '#065f46' }
    : tone === 'warning'
      ? { background: '#fef3c7', accent: theme.colors.warning, eyebrow: theme.colors.warning, title: '#7c2d12', description: '#92400e' }
      : { background: theme.colors.primaryLight, accent: theme.colors.primary, eyebrow: theme.colors.primary, title: theme.colors.primaryDeep, description: theme.colors.textMuted };

  return (
    <View style={[styles.card, { backgroundColor: palette.background }, theme.shadow.sm]}>
      <View style={[styles.accentBar, { backgroundColor: palette.accent }]} />
      {eyebrow ? <Text style={[styles.eyebrow, { color: palette.eyebrow }]}>{eyebrow}</Text> : null}
      <Text style={[styles.title, { color: palette.title }]}>{title}</Text>
      {description ? <Text style={[styles.description, { color: palette.description }]}>{description}</Text> : null}
      {stats.length ? (
        <View style={styles.statsRow}>
          {stats.map((stat) => (
            <View key={stat.label} style={[styles.statChip, { borderColor: palette.accent }]}>
              <Text style={[styles.statLabel, { color: palette.description }]}>{stat.label}</Text>
              <Text style={[styles.statValue, { color: palette.title }]}>{stat.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  eyebrow: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.extrabold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: theme.fontWeight.extrabold,
    lineHeight: 28,
  },
  description: {
    fontSize: theme.fontSize.base,
    lineHeight: 20,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  statChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
    minWidth: 100,
  },
  statLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.extrabold,
  },
});
