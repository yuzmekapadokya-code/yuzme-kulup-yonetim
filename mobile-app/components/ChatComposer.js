import { StyleSheet, TextInput, View } from 'react-native';

import { theme } from '../config/theme';
import ActionButton from './ActionButton';

export default function ChatComposer({ value, onChangeText, onSend, disabled, sendLabel = 'Gonder' }) {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Mesaj yaz..."
        placeholderTextColor={theme.colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        multiline
        editable={!disabled}
      />
      <ActionButton label={sendLabel} onPress={onSend} variant="primary" disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 12,
  },
  input: {
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.text,
    backgroundColor: '#fbfdff',
  },
});