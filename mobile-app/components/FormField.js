import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { theme } from '../config/theme';

// Web tarafindaki .form-group input/select/textarea ile birebir gorunum:
// 44px min height, primary focus halkasi ve subtle border.
export default function FormField({
  label,
  hint,
  error,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
  secureTextEntry,
  autoCapitalize = 'sentences',
  autoCorrect = true,
  style,
  ...rest
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? theme.colors.danger
    : focused
      ? theme.colors.primary
      : theme.colors.border;

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[
          styles.input,
          multiline && styles.multiline,
          {
            borderColor,
            backgroundColor: focused ? '#ffffff' : theme.colors.surface,
          },
          focused && styles.focusedShadow,
        ]}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        multiline={multiline}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
  },
  input: {
    minHeight: theme.touchTarget,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  focusedShadow: {
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },
  hint: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
  },
  error: {
    color: theme.colors.danger,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
});
