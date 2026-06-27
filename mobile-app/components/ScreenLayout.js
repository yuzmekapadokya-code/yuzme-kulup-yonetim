import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '../config/theme';

// Web tarafindaki .panel-enhanced .header sticky kartiyla birebir hizalanmistir.
export default function ScreenLayout({ title, subtitle, children, scroll = true, right, eyebrow }) {
  const Container = scroll ? ScrollView : View;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Container
        style={styles.container}
        contentContainerStyle={scroll ? styles.content : undefined}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right ? <View style={styles.headerRight}>{right}</View> : null}
        </View>
        {children}
      </Container>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  header: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    ...theme.shadow.sm,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  headerRight: {
    flexShrink: 0,
  },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.extrabold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.fontSize.base,
    lineHeight: 20,
    color: theme.colors.textMuted,
  },
});
