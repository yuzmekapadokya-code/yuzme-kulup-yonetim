import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../config/theme';

// Web .card h2 ile birebir: 2px primary-light alt cizgi + 1.25rem baslik.
export default function SectionHeader({ title, caption, right }) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={styles.title}>{title}</Text>
          {caption ? <Text style={styles.caption}>{caption}</Text> : null}
        </View>
        {right ? <View>{right}</View> : null}
      </View>
      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
    paddingBottom: 10,
  },
  text: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    letterSpacing: -0.2,
  },
  caption: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  divider: {
    height: 2,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 999,
  },
});
