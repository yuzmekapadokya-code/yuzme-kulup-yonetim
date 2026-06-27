import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import EmptyState from '../../components/EmptyState';
import HeroBanner from '../../components/HeroBanner';
import LoadingBlock from '../../components/LoadingBlock';
import PanelCard from '../../components/PanelCard';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import StatCard from '../../components/StatCard';
import { theme } from '../../config/theme';
import { getSuperAdminDashboardData } from '../../services/superAdminService';

const quickLinks = [
  {
    key: 'admins',
    title: 'Yonetici ve Basvurular',
    caption: 'Admin olustur, odeme yonet ve basvuru akislarini sonuclandir.',
    routeName: 'SAAdminOps',
    icon: 'people-outline',
    accent: theme.colors.primary,
    tint: theme.colors.primaryLight,
  },
  {
    key: 'finance',
    title: 'Finans Operasyonlari',
    caption: 'Kredi talepleri, siparisler, bozdurma ve paket yonetimi.',
    routeName: 'SAFinanceOps',
    icon: 'cash-outline',
    accent: theme.colors.success,
    tint: '#dcfce7',
  },
  {
    key: 'content',
    title: 'Icerik Operasyonlari',
    caption: 'Market katalogu, reklamlar, barajlar ve yaris importlari.',
    routeName: 'SAContentOps',
    icon: 'library-outline',
    accent: theme.colors.warning,
    tint: '#fffbeb',
  },
];

export default function SuperAdminHomeScreen({ navigation }) {
  const dashboardQuery = useQuery({
    queryKey: ['sa-dashboard'],
    queryFn: getSuperAdminDashboardData,
  });

  if (dashboardQuery.isLoading) {
    return <LoadingBlock label="Super admin paneli yukleniyor..." />;
  }

  const data = dashboardQuery.data;

  return (
    <ScreenLayout
      eyebrow="GLOBAL KONTROL"
      title="Super Admin paneli"
      subtitle="Web panelindeki kritik moduller rol-ozel operasyon merkezlerine ayrildi."
    >
      <HeroBanner
        eyebrow="OZET"
        title="Platform kontrol merkezi"
        description="Adminler, finans hareketleri ve icerik akislari tek bakista."
        stats={[
          { label: 'Toplam', value: data?.stats?.[0]?.value ?? '-' },
          { label: 'Bekleyen', value: String(data?.pendingApplications?.length ?? 0) },
        ]}
      />

      <View style={styles.statsGrid}>
        {data.stats.map((stat, index) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            tone={['primary', 'success', 'warning', 'info'][index % 4]}
          />
        ))}
      </View>

      <SectionHeader title="Operasyon merkezleri" caption="Her kart superadmin panelindeki ayri bir yonetim akisini acar." />
      <View style={styles.quickGrid}>
        {quickLinks.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => navigation.navigate(item.routeName)}
            style={({ pressed }) => [
              styles.quickCard,
              { borderLeftColor: item.accent },
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: item.tint }]}>
              <Ionicons name={item.icon} size={22} color={item.accent} />
            </View>
            <View style={styles.quickBody}>
              <Text style={styles.quickTitle}>{item.title}</Text>
              <Text style={styles.quickCaption} numberOfLines={2}>{item.caption}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>
        ))}
      </View>

      <SectionHeader title="Bekleyen basvurular" caption="Hizli aksiyon gereken son kayitlar" />
      <View style={styles.stack}>
        {!data.pendingApplications.length ? (
          <EmptyState title="Bekleyen basvuru yok" description="Tum basvurular sonuclandirilmis." />
        ) : (
          data.pendingApplications.map((application) => (
            <Pressable
              key={application.id}
              style={({ pressed }) => [pressed && styles.pressed]}
              onPress={() => navigation.navigate('SAAdminOps')}
            >
              <PanelCard>
                <Text style={styles.cardTitle}>{application.name || 'Isimsiz basvuru'}</Text>
                <Text style={styles.cardText}>{application.email || '-'}</Text>
                <Text style={styles.cardText}>{application.sportType || '-'} | {application.city || '-'} / {application.district || '-'}</Text>
              </PanelCard>
            </Pressable>
          ))
        )}
      </View>

      <SectionHeader title="Admin uyarilari" caption="Uyelik veya odeme acigi olan kayitlar" />
      <View style={styles.stack}>
        {!data.adminAlerts.length ? (
          <EmptyState title="Acil uyari yok" description="Tum adminlerde odeme ve sure durumu normal." />
        ) : (
          data.adminAlerts.map((admin) => (
            <Pressable
              key={admin.id}
              style={({ pressed }) => [pressed && styles.pressed]}
              onPress={() => navigation.navigate('SAAdminDetail', { adminId: admin.id })}
            >
              <PanelCard style={{ borderLeftWidth: 4, borderLeftColor: admin.metrics.isExpired ? theme.colors.danger : theme.colors.warning }}>
                <Text style={styles.cardTitle}>{admin.name}</Text>
                <Text style={styles.cardText}>{admin.email}</Text>
                <Text style={styles.cardText}>
                  {admin.metrics.isExpired ? 'Uyelik sona ermis' : `Kalan gun: ${admin.metrics.daysLeft}`}
                </Text>
                <Text style={styles.cardText}>Kalan odeme: ₺{admin.metrics.remainingAmount.toFixed(2)}</Text>
              </PanelCard>
            </Pressable>
          ))
        )}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickGrid: {
    gap: 10,
  },
  quickCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 4,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...theme.shadow.sm,
  },
  quickIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBody: {
    flex: 1,
    gap: 4,
  },
  quickTitle: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  quickCaption: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  stack: {
    gap: 12,
  },
  cardTitle: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  cardText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});