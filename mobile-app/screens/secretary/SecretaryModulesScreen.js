import { StyleSheet, View } from 'react-native';

import FeatureCard from '../../components/FeatureCard';
import ScreenLayout from '../../components/ScreenLayout';

const modules = [
  { key: 'registration', title: 'Ogrenci Kayit', icon: 'person-add-outline', routeName: 'SECRegistrationOps' },
  { key: 'students', title: 'Ogrenci ve Odeme', icon: 'card-outline', routeName: 'SECStudentsOps' },
  { key: 'chat', title: 'Sohbet Operasyonlari', icon: 'chatbubbles-outline', routeName: 'SECChatOps' },
];

export default function SecretaryModulesScreen({ navigation }) {
  return (
    <ScreenLayout title="Sekreter Modulleri" subtitle="Web panelindeki sekreter operasyonlari mobilde kayit, tahsilat ve sohbet merkezlerine ayrildi.">
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