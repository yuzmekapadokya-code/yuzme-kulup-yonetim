import { StyleSheet, View } from 'react-native';

import FeatureCard from '../../components/FeatureCard';
import HeroBanner from '../../components/HeroBanner';
import ScreenLayout from '../../components/ScreenLayout';
import { theme } from '../../config/theme';

const modules = [
  { key: 'classes', title: 'Ders Akislari', caption: 'Musaitlik, yoklama, erteleme ve yorumlar.', routeName: 'TRClassOps', icon: 'calendar-outline', accentColor: theme.colors.primary, iconTint: theme.colors.primaryLight, cardTint: theme.colors.surface },
  { key: 'students', title: 'Ogrenciler', caption: 'Devam yuzdesi ve grup takibi.', routeName: 'TRStudentsOps', icon: 'people-outline', accentColor: theme.colors.success, iconTint: '#dcfce7', cardTint: theme.colors.surface },
  { key: 'chronometer', title: 'Antrenman Ekrani', caption: 'Set, tur, geri sayim ve uzaktan kontrol.', routeName: 'TRChronometer', icon: 'stopwatch-outline', accentColor: theme.colors.warning, iconTint: '#fef3c7', cardTint: theme.colors.surface },
  { key: 'performance', title: 'Performans', caption: 'Derece girisi, rapor ve barajlar.', routeName: 'TRPerformanceOps', icon: 'speedometer-outline', accentColor: '#7c3aed', iconTint: '#f3e8ff', cardTint: theme.colors.surface },
  { key: 'workouts', title: 'Antrenman ve Market', caption: 'Workout olustur, satisa cikar, satin al.', routeName: 'TRWorkoutOps', icon: 'water-outline', accentColor: '#0e7490', iconTint: '#cffafe', cardTint: theme.colors.surface },
  { key: 'shopping', title: 'Alisveris', caption: 'Sepet, kulup urunleri ve siparis gecmisi.', routeName: 'TRShoppingOps', icon: 'bag-handle-outline', accentColor: '#b45309', iconTint: '#fef3c7', cardTint: theme.colors.surface },
  { key: 'finance', title: 'Kredi ve Finans', caption: 'Kredi bakiyesi, paketler ve bozdurma talepleri.', routeName: 'TRFinanceOps', icon: 'cash-outline', accentColor: '#0d9488', iconTint: '#ccfbf1', cardTint: theme.colors.surface },
];

export default function TrainerModulesScreen({ navigation }) {
  return (
    <ScreenLayout
      eyebrow="MODULLER"
      title="Trainer modulleri"
      subtitle="Performans, alisveris ve operasyon alanlari daha net kartlarla ayrildi."
    >
      <HeroBanner
        eyebrow="HIZLI ERISIM"
        title="Tum operasyonlar tek panelde"
        description="Ders, ogrenci, antrenman, alisveris ve finans ekranlari daha net ayrilir."
      />
      <View style={styles.list}>
        {modules.map((item) => (
          <FeatureCard key={item.key} feature={item} onPress={() => navigation.navigate(item.routeName)} />
        ))}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
});
