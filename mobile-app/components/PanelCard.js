import { StyleSheet, View } from 'react-native';

import { theme } from '../config/theme';

// Web tarafindaki .panel-enhanced .card ile birebir gorunum saglar.
export default function PanelCard({ children, style, padding = 'md', tone = 'surface' }) {
  const padValue = padding === 'sm' ? theme.spacing.sm : padding === 'lg' ? theme.spacing.lg : theme.spacing.md;
  const toneStyle = tone === 'tint'
    ? { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.border }
    : tone === 'muted'
      ? { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }
      : { backgroundColor: theme.colors.surface, borderColor: theme.colors.border };

  return (
    <View
      style={[
        styles.card,
        toneStyle,
        { padding: padValue },
        theme.shadow.sm,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.spacing.sm,
  },
});
