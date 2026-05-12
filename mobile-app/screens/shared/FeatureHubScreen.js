import { StyleSheet, View } from 'react-native';

import FeatureCard from '../../components/FeatureCard';
import ScreenLayout from '../../components/ScreenLayout';
import { useAuthStore } from '../../store/authStore';
import { getRoleFeatures } from '../../utils/roleScreens';

export default function FeatureHubScreen({ navigation }) {
  const role = useAuthStore((state) => state.profile?.role);
  const features = getRoleFeatures(role);

  return (
    <ScreenLayout title="Moduller" subtitle="Web panelindeki rol bazli bolumler mobil ekrana donusturuldu.">
      <View style={styles.list}>
        {features.map((feature) => (
          <FeatureCard
            key={feature.key}
            feature={feature}
            onPress={() => navigation.navigate('FeatureList', { featureKey: feature.key })}
          />
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