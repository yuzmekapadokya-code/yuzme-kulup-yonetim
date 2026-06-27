import { StyleSheet, View } from 'react-native';

import FeatureCard from '../../components/FeatureCard';
import ScreenLayout from '../../components/ScreenLayout';
import { theme } from '../../config/theme';

const modules = [
  { key: 'admin-ops', title: 'Yonetici Operasyonlari', icon: 'shield-checkmark-outline', routeName: 'SAAdminOps', caption: 'Adminleri yonet, basvuru sonuclandir, odeme ekle.', accentColor: theme.colors.primary, iconTint: theme.colors.primaryLight, cardTint: theme.colors.surface },
  { key: 'finance-ops', title: 'Finans Operasyonlari', icon: 'cash-outline', routeName: 'SAFinanceOps', caption: 'Kredi talepleri, siparisler, paketler ve bozdurmalar.', accentColor: theme.colors.success, iconTint: '#dcfce7', cardTint: theme.colors.surface },
  { key: 'content-ops', title: 'Icerik Operasyonlari', icon: 'albums-outline', routeName: 'SAContentOps', caption: 'Market katalogu, reklamlar, barajlar ve importlar.', accentColor: theme.colors.warning, iconTint: '#fef3c7', cardTint: theme.colors.surface },
];

export default function SuperAdminModulesScreen({ navigation }) {
  return (
    <ScreenLayout
      eyebrow="MODULLER"
      title="Super admin modulleri"
      subtitle="Superadmin yetkilerini generic liste yerine dogrudan operasyon ekranlarina ayirir."
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
    gap: 10,
  },
});
