import { Pressable, StyleSheet, Text } from 'react-native';

import { theme } from '../config/theme';

export default function ActionButton({ label, onPress, variant = 'primary', fullWidth = false, disabled = false }) {
  const filled = variant === 'primary';

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        fullWidth && styles.fullWidth,
        filled ? styles.primaryButton : styles.secondaryButton,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabledButton,
      ]}
    >
      <Text style={[filled ? styles.primaryLabel : styles.secondaryLabel, disabled && styles.disabledLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  fullWidth: {
    width: '100%',
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  secondaryButton: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
  },
  primaryLabel: {
    color: '#ffffff',
    fontWeight: '700',
  },
  secondaryLabel: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  disabledButton: {
    opacity: 0.45,
  },
  disabledLabel: {
    opacity: 0.7,
  },
});