import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../config/theme';

export default function FeatureCard({ feature, onPress }) {
  const accentColor = feature.accentColor || theme.colors.primaryDeep;
  const iconTint = feature.iconTint || '#dff1fc';
  const cardTint = feature.cardTint || theme.colors.surface;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: cardTint, borderLeftColor: accentColor }, pressed && styles.pressed]}>
      <View style={[styles.iconWrap, { backgroundColor: iconTint }]}>
        <Ionicons name={feature.icon} size={20} color={accentColor} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{feature.title}</Text>
        <Text style={styles.caption}>{feature.caption || 'Kayitlari incele ve guncelle'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...theme.shadow.card,
  },
  pressed: {
    opacity: 0.85,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#dff1fc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  caption: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
});