import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../config/theme';

export default function SectionHeader({ title, caption }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  caption: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
});