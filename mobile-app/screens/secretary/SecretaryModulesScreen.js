import { StyleSheet, View } from 'react-native';

import FeatureCard from '../../components/FeatureCard';
import ScreenLayout from '../../components/ScreenLayout';
import { theme } from '../../config/theme';

const modules = [
  { key: 'prereg', title: 'On Kayit Linki', icon: 'link-outline', routeName: 'SECPreRegistrationOps', caption: 'Tek kalici baglanti ve form gorunumu ozellestirme.', accentColor: theme.colors.info, iconTint: '#e0f2fe', cardTint: theme.colors.surface },
  { key: 'registration', title: 'Ogrenci Kayit', icon: 'person-add-outline', routeName: 'SECRegistrationOps', caption: 'Yeni kayit ac, veli hesabi uret, taksit kur.', accentColor: theme.colors.primary, iconTint: theme.colors.primaryLight, cardTint: theme.colors.surface },
  { key: 'students', title: 'Ogrenci ve Odeme', icon: 'card-outline', routeName: 'SECStudentsOps', caption: 'Gruplu liste, detay, odeme alma ve kayit temizligi.', accentColor: theme.colors.success, iconTint: '#dcfce7', cardTint: theme.colors.surface },
  { key: 'chat', title: 'Sohbet Operasyonlari', icon: 'chatbubbles-outline', routeName: 'SECChatOps', caption: 'E-posta ile birebir veya grup sohbeti baslat.', accentColor: '#7c3aed', iconTint: '#f3e8ff', cardTint: theme.colors.surface },
];

export default function SecretaryModulesScreen({ navigation }) {
  return (
    <ScreenLayout
      eyebrow="MODULLER"
      title="Sekreter modulleri"
      subtitle="Web panelindeki sekreter operasyonlari kayit, tahsilat ve sohbet merkezlerine ayrildi."
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
