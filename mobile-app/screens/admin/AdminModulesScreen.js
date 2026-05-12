import { StyleSheet, View } from 'react-native';

import FeatureCard from '../../components/FeatureCard';
import ScreenLayout from '../../components/ScreenLayout';

const modules = [
  { key: 'organization', title: '🏢 Organizasyon', icon: 'business-outline', routeName: 'ADOrganizationOps', accentColor: '#0f6ea8', iconTint: '#dff1ff', cardTint: '#eef8ff', caption: 'Kulup, sube ve ekip yapisini yonet' },
  { key: 'schedule', title: '🗓️ Programlama', icon: 'time-outline', routeName: 'ADScheduleOps', accentColor: '#1b7f5c', iconTint: '#dff7ea', cardTint: '#eefbf5', caption: 'Saat, bitis takvimi ve ertelemeleri gor' },
  { key: 'shopping', title: '🛍️ Alisveris', icon: 'bag-handle-outline', routeName: 'ADShoppingOps', accentColor: '#b05d19', iconTint: '#ffeddc', cardTint: '#fff8ef', caption: 'Vitrin, kampanya ve siparis akisini yonet' },
  { key: 'finance', title: '💰 Finans', icon: 'cash-outline', routeName: 'ADBusinessOps', accentColor: '#b96a00', iconTint: '#ffeed2', cardTint: '#fff7eb', caption: 'Gelir, gider, kar ve indirim kodlari' },
  { key: 'content', title: '📣 Duyuru ve Takvim', icon: 'notifications-outline', routeName: 'ADContentOps', accentColor: '#b3367a', iconTint: '#ffe0f1', cardTint: '#fff0f8', caption: 'Duyuru ve etkinlik takvimini yonet' },
  { key: 'standards', title: '🎯 Barajlar', icon: 'trophy-outline', routeName: 'ADStandardsOps', accentColor: '#7a4c00', iconTint: '#ffefcf', cardTint: '#fff6e8', caption: 'Yaris bazli gruplu baraj listesi' },
];

export default function AdminModulesScreen({ navigation }) {
  return (
    <ScreenLayout title="Admin Modulleri" subtitle="Admin rolundeki ana alanlar artik daha temiz modullere ayrildi.">
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