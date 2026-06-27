import { StyleSheet, View } from 'react-native';

import FeatureCard from '../../components/FeatureCard';
import ScreenLayout from '../../components/ScreenLayout';
import { theme } from '../../config/theme';

const modules = [
  { key: 'organization', title: 'Organizasyon', icon: 'business-outline', routeName: 'ADOrganizationOps', accentColor: theme.colors.primary, iconTint: theme.colors.primaryLight, cardTint: theme.colors.surface, caption: 'Kulup, sube ve ekip yapisini yonet' },
  { key: 'schedule', title: 'Programlama', icon: 'time-outline', routeName: 'ADScheduleOps', accentColor: theme.colors.success, iconTint: '#dcfce7', cardTint: theme.colors.surface, caption: 'Saat, bitis takvimi ve ertelemeleri gor' },
  { key: 'shopping', title: 'Alisveris', icon: 'bag-handle-outline', routeName: 'ADShoppingOps', accentColor: theme.colors.warning, iconTint: '#fffbeb', cardTint: theme.colors.surface, caption: 'Vitrin, kampanya ve siparis akisini yonet' },
  { key: 'finance', title: 'Finans', icon: 'cash-outline', routeName: 'ADBusinessOps', accentColor: '#0d9488', iconTint: '#ccfbf1', cardTint: theme.colors.surface, caption: 'Gelir, gider, kar ve indirim kodlari' },
  { key: 'content', title: 'Duyuru ve Takvim', icon: 'notifications-outline', routeName: 'ADContentOps', accentColor: '#a21caf', iconTint: '#fae8ff', cardTint: theme.colors.surface, caption: 'Duyuru ve etkinlik takvimini yonet' },
  { key: 'standards', title: 'Barajlar', icon: 'trophy-outline', routeName: 'ADStandardsOps', accentColor: '#b45309', iconTint: '#fef3c7', cardTint: theme.colors.surface, caption: 'Yaris bazli gruplu baraj listesi' },
];

export default function AdminModulesScreen({ navigation }) {
  return (
    <ScreenLayout
      eyebrow="MODULLER"
      title="Admin modulleri"
      subtitle="Admin rolundeki ana alanlar artik daha temiz modullere ayrildi."
    >
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
    gap: 12,
  },
});