import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../config/theme';

export default function FeatureCard({ feature, onPress }) {
  const accentColor = feature.accentColor || theme.colors.primary;
  const iconTint = feature.iconTint || theme.colors.primaryLight;
  const cardTint = feature.cardTint || theme.colors.surface;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: cardTint, borderLeftColor: accentColor },
        theme.shadow.sm,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconTint }]}>
        <Ionicons name={feature.icon} size={22} color={accentColor} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{feature.title}</Text>
        <Text style={styles.caption} numberOfLines={2}>
          {feature.caption || 'Kayitlari incele ve guncelle'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
  },
  caption: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    lineHeight: 18,
  },
});
