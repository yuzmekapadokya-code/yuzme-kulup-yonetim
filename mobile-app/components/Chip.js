import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../config/theme';

// Web tarafindaki .badge / .chip elemanlariyla esdeger; rozet ve etiketler icin.
const TONE_MAP = {
  primary: { background: theme.colors.primaryLight, border: theme.colors.primary, color: theme.colors.primaryDeep },
  success: { background: theme.colors.successLight, border: theme.colors.success, color: '#065f46' },
  warning: { background: theme.colors.warningLight, border: theme.colors.warning, color: '#7c2d12' },
  danger: { background: theme.colors.dangerLight, border: theme.colors.danger, color: '#7f1d1d' },
  info: { background: theme.colors.infoLight, border: theme.colors.info, color: '#075985' },
  neutral: { background: theme.colors.surfaceAlt, border: theme.colors.border, color: theme.colors.textMuted },
};

export default function Chip({ label, tone = 'primary', icon }) {
  const palette = TONE_MAP[tone] || TONE_MAP.primary;
  return (
    <View
      style={[styles.chip, { backgroundColor: palette.background, borderColor: palette.border }]}
    >
      {icon ? <View>{icon}</View> : null}
      <Text style={[styles.label, { color: palette.color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  label: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.bold,
    letterSpacing: 0.4,
  },
});
