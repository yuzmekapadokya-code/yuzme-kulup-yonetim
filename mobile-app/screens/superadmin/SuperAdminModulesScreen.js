import { StyleSheet, View } from 'react-native';

import FeatureCard from '../../components/FeatureCard';
import ScreenLayout from '../../components/ScreenLayout';

const modules = [
  { key: 'admin-ops', title: 'Yonetici Operasyonlari', icon: 'shield-checkmark-outline', routeName: 'SAAdminOps' },
  { key: 'finance-ops', title: 'Finans Operasyonlari', icon: 'cash-outline', routeName: 'SAFinanceOps' },
  { key: 'content-ops', title: 'Icerik Operasyonlari', icon: 'albums-outline', routeName: 'SAContentOps' },
];

export default function SuperAdminModulesScreen({ navigation }) {
  return (
    <ScreenLayout title="Super Admin Modulleri" subtitle="Superadmin yetkilerini generic liste yerine dogrudan operasyon ekranlarina ayirir.">
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