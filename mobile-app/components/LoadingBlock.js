import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { theme } from '../config/theme';

export default function LoadingBlock({ label = 'Yukleniyor...' }) {
  return (
    <View style={styles.container}>
      <View style={styles.spinnerWrap}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: theme.colors.background,
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  spinnerWrap: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
  },
});
