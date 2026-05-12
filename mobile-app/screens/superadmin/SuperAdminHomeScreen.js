import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
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
  },
  {
    key: 'finance',
    title: 'Finans Operasyonlari',
    caption: 'Kredi talepleri, siparisler, bozdurma ve paket yonetimi.',
    routeName: 'SAFinanceOps',
  },
  {
    key: 'content',
    title: 'Icerik Operasyonlari',
    caption: 'Market katalogu, reklamlar, barajlar ve yaris importlari.',
    routeName: 'SAContentOps',
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
      title="Super Admin"
      subtitle="Web panelindeki kritik modulleri mobilde rol-ozel operasyon merkezlerine ayirir."
    >
      <View style={styles.statsGrid}>
        {data.stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </View>

      <SectionHeader title="Operasyon merkezleri" caption="Her kart superadmin panelindeki ayri bir yonetim akisini acar." />
      <View style={styles.quickGrid}>
        {quickLinks.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => navigation.navigate(item.routeName)}
            style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
          >
            <Text style={styles.quickTitle}>{item.title}</Text>
            <Text style={styles.quickCaption}>{item.caption}</Text>
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
              style={({ pressed }) => [styles.listCard, pressed && styles.pressed]}
              onPress={() => navigation.navigate('SAAdminOps')}
            >
              <Text style={styles.cardTitle}>{application.name || 'Isimsiz basvuru'}</Text>
              <Text style={styles.cardText}>{application.email || '-'}</Text>
              <Text style={styles.cardText}>{application.sportType || '-'} | {application.city || '-'} / {application.district || '-'}</Text>
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
              style={({ pressed }) => [styles.listCard, pressed && styles.pressed]}
              onPress={() => navigation.navigate('SAAdminDetail', { adminId: admin.id })}
            >
              <Text style={styles.cardTitle}>{admin.name}</Text>
              <Text style={styles.cardText}>{admin.email}</Text>
              <Text style={styles.cardText}>
                {admin.metrics.isExpired ? 'Uyelik sona ermis' : `Kalan gun: ${admin.metrics.daysLeft}`}
              </Text>
              <Text style={styles.cardText}>Kalan odeme: ₺{admin.metrics.remainingAmount.toFixed(2)}</Text>
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
    gap: 12,
  },
  quickCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: 8,
  },
  quickTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 17,
  },
  quickCaption: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  stack: {
    gap: 12,
  },
  listCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: 4,
  },
  cardTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  cardText: {
    color: theme.colors.textMuted,
  },
  pressed: {
    opacity: 0.88,
  },
});