import { StyleSheet, View } from 'react-native';

import FeatureCard from '../../components/FeatureCard';
import ScreenLayout from '../../components/ScreenLayout';
import { theme } from '../../config/theme';

const modules = [
  { key: 'progress', title: 'Performans ve Baraj', icon: 'speedometer-outline', routeName: 'PRProgressOps', caption: 'Dereceler, baraj gecisleri ve gelisim takibi.', accentColor: theme.colors.primary, iconTint: theme.colors.primaryLight, cardTint: theme.colors.surface },
  { key: 'shopping', title: 'Alisveris', icon: 'bag-handle-outline', routeName: 'PRShoppingOps', caption: 'Sepet, siparis ve kulup urunlerine hizli ulasim.', accentColor: theme.colors.warning, iconTint: '#fef3c7', cardTint: theme.colors.surface },
  { key: 'daily', title: 'Gunluk Yasam', icon: 'calendar-outline', routeName: 'PRDailyOps', caption: 'Odeme, devam, etkinlik ve planlar.', accentColor: theme.colors.success, iconTint: '#dcfce7', cardTint: theme.colors.surface },
  { key: 'communication', title: 'Iletisim ve Destek', icon: 'chatbubbles-outline', routeName: 'PRCommunicationOps', caption: 'Mesajlar, sorular ve kulup ile temas.', accentColor: '#7c3aed', iconTint: '#f3e8ff', cardTint: theme.colors.surface },
];

export default function ParentModulesScreen({ navigation }) {
  return (
    <ScreenLayout
      eyebrow="MODULLER"
      title="Veli modulleri"
      subtitle="Gelisim, alisveris ve gunluk takip alanlari daha net kartlarla ayrildi."
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
