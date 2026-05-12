import { StyleSheet, View } from 'react-native';

import FeatureCard from '../../components/FeatureCard';
import ScreenLayout from '../../components/ScreenLayout';

const modules = [
  { key: 'progress', title: 'Performans ve Baraj', icon: 'speedometer-outline', routeName: 'PRProgressOps', caption: 'Dereceler, baraj gecisleri ve gelisim takibi.', accentColor: '#0d6285', iconTint: '#dff4fb', cardTint: '#f4fbfd' },
  { key: 'shopping', title: 'Alisveris', icon: 'bag-handle-outline', routeName: 'PRShoppingOps', caption: 'Sepet, siparis ve kulup urunlerine hizli ulasim.', accentColor: '#b9641d', iconTint: '#fff0e4', cardTint: '#fffaf4' },
  { key: 'daily', title: 'Gunluk Yasam', icon: 'calendar-outline', routeName: 'PRDailyOps', caption: 'Odeme, devam, etkinlik ve planlar.', accentColor: '#2e7b63', iconTint: '#e4f6ef', cardTint: '#f7fcf9' },
  { key: 'communication', title: 'Iletisim ve Destek', icon: 'chatbubbles-outline', routeName: 'PRCommunicationOps', caption: 'Mesajlar, sorular ve kulup ile temas.', accentColor: '#6b4ba6', iconTint: '#efe8ff', cardTint: '#faf7ff' },
];

export default function ParentModulesScreen({ navigation }) {
  return (
    <ScreenLayout title="Veli Modulleri" subtitle="Gelisim, alisveris ve gunluk takip alanlari daha net kartlarla ayrildi.">
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