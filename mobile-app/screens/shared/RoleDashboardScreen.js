import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';

import FeatureCard from '../../components/FeatureCard';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import StatCard from '../../components/StatCard';
import { roleLabels } from '../../config/appConfig';
import { theme } from '../../config/theme';
import { getDashboardSummary } from '../../services/resourceService';
import { useAuthStore } from '../../store/authStore';
import { getRoleFeatures } from '../../utils/roleScreens';
import { queryKeys } from '../../utils/queryKeys';

export default function RoleDashboardScreen({ navigation }) {
  const profile = useAuthStore((state) => state.profile);
  const features = getRoleFeatures(profile.role);

  const summaryQuery = useQuery({
    queryKey: queryKeys.dashboard(profile.role, profile.uid),
    queryFn: () => getDashboardSummary(profile),
  });

  if (summaryQuery.isLoading) {
    return <LoadingBlock label="Panel hazirlaniyor..." />;
  }

  return (
    <ScreenLayout
      title={`${roleLabels[profile.role]} Paneli`}
      subtitle={`${profile.name} olarak giris yaptiniz. Rolunuze uygun ekranlar ve gercek zamanli veriler hazir.`}
    >
      <View style={styles.summaryWrap}>
        {summaryQuery.data?.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} />
        ))}
      </View>

      <SectionHeader title="Hizli erisim" caption="En cok kullanilan moduller" />
      <View style={styles.featureList}>
        {features.slice(0, 6).map((feature) => (
          <FeatureCard
            key={feature.key}
            feature={feature}
            onPress={() => navigation.navigate('FeatureList', { featureKey: feature.key })}
          />
        ))}
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Realtime durum</Text>
        <Text style={styles.infoText}>Sohbet, cagri bildirimleri ve Firestore kayitlari anlik olarak dinleniyor. Cevrimdisi islemler tekrar baglandiginda otomatik kuyruktan senkronize edilir.</Text>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  summaryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  featureList: {
    gap: 12,
  },
  infoCard: {
    backgroundColor: '#edf7ff',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 6,
  },
  infoTitle: {
    color: theme.colors.primaryDeep,
    fontWeight: '800',
  },
  infoText: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
});