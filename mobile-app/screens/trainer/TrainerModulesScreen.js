import { Pressable, StyleSheet, Text, View } from 'react-native';

import ScreenLayout from '../../components/ScreenLayout';
import { theme } from '../../config/theme';

const modules = [
  { key: 'classes', title: '📅 Ders Akislari', caption: 'Musaitlik, yoklama, erteleme ve yorumlar.', routeName: 'TRClassOps', bg: '#e9f4ff', border: '#c6def9', accent: '#0d5b9c' },
  { key: 'students', title: '👥 Ogrenciler', caption: 'Devam yuzdesi ve grup takibi.', routeName: 'TRStudentsOps', bg: '#ecf9f0', border: '#cbead4', accent: '#246b42' },
  { key: 'chronometer', title: '⏱️ Antrenman Ekrani', caption: 'Set, tur, geri sayim ve uzaktan kontrol.', routeName: 'TRChronometer', bg: '#fff2e8', border: '#ffd8be', accent: '#9b4f16' },
  { key: 'performance', title: '🏁 Performans', caption: 'Derece girisi, rapor ve barajlar.', routeName: 'TRPerformanceOps', bg: '#f3eeff', border: '#d9cbff', accent: '#5a3aa6' },
  { key: 'workouts', title: '🏊‍♂️ Antrenman ve Market', caption: 'Workout olustur, satisa cikar, satin al.', routeName: 'TRWorkoutOps', bg: '#e8fbff', border: '#c2ebf6', accent: '#0e6679' },
  { key: 'shopping', title: '🛒 Alisveris', caption: 'Sepet, kulup urunleri ve siparis gecmisi.', routeName: 'TRShoppingOps', bg: '#fff5ee', border: '#ffd9bf', accent: '#9b4b14' },
  { key: 'finance', title: '💳 Kredi ve Finans', caption: 'Kredi bakiyesi, paketler ve bozdurma talepleri.', routeName: 'TRFinanceOps', bg: '#fff8eb', border: '#f4e4c3', accent: '#8a5f0c' },
];

export default function TrainerModulesScreen({ navigation }) {
  return (
    <ScreenLayout title="Trainer Modulleri" subtitle="Performans, alisveris ve operasyon alanlari daha net kartlarla ayrildi.">
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>🔥 HIZLI ERISIM</Text>
        <Text style={styles.heroTitle}>Tum operasyonlar tek panelde</Text>
        <Text style={styles.heroText}>Ders, ogrenci, antrenman, alisveris ve finans ekranlari daha net ayrilir.</Text>
      </View>
      <View style={styles.list}>
        {modules.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => navigation.navigate(item.routeName)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: item.bg, borderColor: item.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.cardTitle, { color: item.accent }]}>{item.title}</Text>
            <Text style={styles.cardCaption}>{item.caption}</Text>
          </Pressable>
        ))}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#10395f',
    borderWidth: 1,
    borderColor: '#2d6a9d',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: 8,
  },
  heroEyebrow: {
    color: '#b8e3ff',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 24,
  },
  heroText: {
    color: '#d2e8f8',
    fontSize: 15,
    lineHeight: 22,
  },
  list: {
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    gap: 6,
    ...theme.shadow.card,
  },
  cardTitle: {
    fontWeight: '900',
    fontSize: 20,
  },
  cardCaption: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.995 }],
  },
});