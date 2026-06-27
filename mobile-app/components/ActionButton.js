import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../config/theme';

// Web tarafindaki .btn-primary / .btn-secondary / .btn-success / .btn-danger / .btn-warning / .btn-info ile birebir hizalidir.
const VARIANT_STYLES = {
  primary: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    color: theme.colors.textInverse,
    shadow: theme.shadow.primary,
  },
  secondary: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    shadow: theme.shadow.sm,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    color: theme.colors.primary,
    shadow: null,
  },
  success: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
    color: theme.colors.textInverse,
    shadow: theme.shadow.sm,
  },
  warning: {
    backgroundColor: theme.colors.warning,
    borderColor: theme.colors.warning,
    color: theme.colors.textInverse,
    shadow: theme.shadow.sm,
  },
  danger: {
    backgroundColor: theme.colors.danger,
    borderColor: theme.colors.danger,
    color: theme.colors.textInverse,
    shadow: theme.shadow.sm,
  },
  info: {
    backgroundColor: theme.colors.info,
    borderColor: theme.colors.info,
    color: theme.colors.textInverse,
    shadow: theme.shadow.sm,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.primary,
    color: theme.colors.primary,
    shadow: null,
  },
};

export default function ActionButton({
  label,
  onPress,
  variant = 'primary',
  fullWidth = false,
  disabled = false,
  icon = null,
  size = 'md',
}) {
  const variantStyle = VARIANT_STYLES[variant] || VARIANT_STYLES.primary;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.sizeSm,
        size === 'lg' && styles.sizeLg,
        {
          backgroundColor: variantStyle.backgroundColor,
          borderColor: variantStyle.borderColor,
        },
        variantStyle.shadow,
        fullWidth && styles.fullWidth,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabledButton,
      ]}
    >
      <View style={styles.contentRow}>
        {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
        <Text
          style={[
            styles.label,
            { color: variantStyle.color },
            size === 'sm' && styles.labelSm,
            size === 'lg' && styles.labelLg,
            disabled && styles.disabledLabel,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: theme.touchTarget,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sizeSm: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.xs,
  },
  sizeLg: {
    minHeight: 52,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  fullWidth: {
    alignSelf: 'stretch',
    width: '100%',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    marginRight: 4,
  },
  label: {
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.base,
    letterSpacing: 0.2,
  },
  labelSm: {
    fontSize: theme.fontSize.sm,
  },
  labelLg: {
    fontSize: theme.fontSize.md,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledLabel: {
    opacity: 0.85,
  },
});
