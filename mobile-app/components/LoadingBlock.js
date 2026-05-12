import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { theme } from '../config/theme';

export default function LoadingBlock({ label = 'Yukleniyor...' }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
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
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 15,
  },
});