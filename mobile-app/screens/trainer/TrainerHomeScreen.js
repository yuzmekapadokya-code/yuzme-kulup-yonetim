import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import HeroBanner from '../../components/HeroBanner';
import LoadingBlock from '../../components/LoadingBlock';
import PanelCard from '../../components/PanelCard';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import StatCard from '../../components/StatCard';
import { theme } from '../../config/theme';
import { getTrainerDashboardData } from '../../services/trainerService';
import { useAuthStore } from '../../store/authStore';

const quickLinks = [
  { key: 'classes', title: 'Ders Akislari', caption: 'Musaitlik, ders gruplari, yoklama ve yorum.', routeName: 'TRClassOps', icon: 'calendar-outline', accent: theme.colors.primary, tint: theme.colors.primaryLight },
  { key: 'performance', title: 'Performans', caption: 'Derece girisi, rapor ve baraj takibi.', routeName: 'TRPerformanceOps', icon: 'speedometer-outline', accent: '#7c3aed', tint: '#f3e8ff' },
  { key: 'shopping', title: 'Alisveris', caption: 'Sepet, kulup urunleri ve siparis takibi.', routeName: 'TRShoppingOps', icon: 'bag-handle-outline', accent: theme.colors.warning, tint: '#fffbeb' },
];

export default function TrainerHomeScreen({ navigation }) {
  const profile = useAuthStore((state) => state.profile);
  const dashboardQuery = useQuery({
    queryKey: ['tr-dashboard', profile?.uid],
    queryFn: () => getTrainerDashboardData(profile),
    enabled: Boolean(profile?.uid),
    staleTime: 30000,
    gcTime: 5 * 60000,
    refetchOnWindowFocus: false,
  });

  if (dashboardQuery.isLoading) {
    return <LoadingBlock label="Trainer paneli yukleniyor..." />;
  }

  const data = dashboardQuery.data;

  return (
    <ScreenLayout
      eyebrow="GUNLUK KONTROL"
      title="Antrenor paneli"
      subtitle="Ders, performans, alisveris ve finans akislari okunur kartlarla ayrildi."
    >
      <HeroBanner
        eyebrow="OPERASYON"
        title="Antrenor operasyon merkezi"
        description="Ders, ogrenci, antrenman, alisveris ve finans panelleri tek ekranda toplandi."
        stats={[
          { label: 'Aktif ders', value: String(data?.upcomingClasses?.length ?? 0) },
          { label: 'Bekleyen', value: String(data?.salarySummary?.pendingLessons ?? 0) },
        ]}
      />

      <View style={styles.statsGrid}>
        {data.stats.map((stat, index) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            tone={['primary', 'success', 'info', 'warning'][index % 4]}
          />
        ))}
      </View>

      <SectionHeader title="Hizli merkezler" caption="Antrenor icin ilk ekranda en sik 3 akis gosterilir." />
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
      <ActionButton label="Tum modulleri gor" variant="secondary" onPress={() => navigation.getParent()?.navigate('ModulesTab')} fullWidth />

      <SectionHeader title="Kazanc ozeti" caption="Ders atamalarindan hesaplanan tahmini tablo." />
      <PanelCard tone="tint">
        <Text style={styles.summaryEyebrow}>TOPLAM PROJECTED KAZANC</Text>
        <Text style={styles.summaryValue}>₺{data.salarySummary.totalProjected.toFixed(2)}</Text>
        <View style={styles.summaryMetaRow}>
          <Text style={styles.summaryText}>Odenen: ₺{data.salarySummary.totalPaid.toFixed(2)}</Text>
          <Text style={styles.summaryText}>Toplam ders: {data.salarySummary.totalLessons}</Text>
          <Text style={styles.summaryText}>Bekleyen: {data.salarySummary.pendingLessons}</Text>
        </View>
        {!!data.salarySummary.rows?.length && (
          <View style={styles.salaryList}>
            {data.salarySummary.rows.map((row) => (
              <View key={row.scheduleId} style={styles.salaryRow}>
                <Text style={styles.salaryTitle}>{row.branchName} | {row.time}</Text>
                <Text style={styles.salaryMeta}>
                  Ders basi: {row.hasConfiguredRate ? `₺${row.trainerRate.toFixed(2)}` : 'Tanimsiz'} | Toplam: ₺{row.totalSalary.toFixed(2)}
                </Text>
                <Text style={styles.salaryMeta}>
                  Odenen: ₺{row.paidAmount.toFixed(2)} ({row.paidLessons}/{row.lessonsCount}) | Bekleyen: ₺{row.pendingAmount.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </PanelCard>

      <SectionHeader title="Ders gruplari" caption="Antrenore atanmis aktif gruplar" />
      <View style={styles.stack}>
        {!data.upcomingClasses.length ? (
          <EmptyState title="Ders grubu bulunamadi" description="Bu antrenore bagli schedule kaydi yok." />
        ) : (
          data.upcomingClasses.map((item) => (
            <PanelCard key={item.id}>
              <Text style={styles.cardTitle}>{item.branchName}</Text>
              <Text style={styles.cardText}>{item.time} | {item.daysLabel}</Text>
              <Text style={styles.cardText}>{item.lessonTypeLabel} | Kapasite: {item.capacity}</Text>
              <Text style={styles.cardText}>{item.postponementCount ? `${item.postponementCount} erteleme var` : 'Erteleme yok'}</Text>
            </PanelCard>
          ))
        )}
      </View>

      <SectionHeader title="Bitis ve aksiyon uyarilari" caption="Ders doneminin sonuna yaklasan ogrenciler" />
      <View style={styles.stack}>
        {!data.alerts.length ? (
          <EmptyState title="Kritik uyari yok" description="Yakin bitisli ogrenci veya ozel ders alarmi gorunmuyor." />
        ) : (
          data.alerts.map((alert) => (
            <PanelCard key={alert.studentId} style={{ borderLeftWidth: 4, borderLeftColor: alert.daysLeft < 0 ? theme.colors.danger : theme.colors.warning }}>
              <Text style={styles.cardTitle}>{alert.studentName}</Text>
              <Text style={styles.cardText}>{alert.branchName} | {alert.scheduleName}</Text>
              <Text style={styles.cardText}>Bitis: {alert.endDate}</Text>
              <Text style={[styles.cardText, alert.daysLeft < 0 ? styles.danger : styles.warning]}>
                {alert.daysLeft < 0 ? `${Math.abs(alert.daysLeft)} gun gecti` : alert.daysLeft === 0 ? 'Bugun bitiyor' : `${alert.daysLeft} gun kaldi`}
              </Text>
              {alert.isPrivateLesson ? <Text style={styles.cardText}>Kalan ozel ders: {alert.remainingLessons}</Text> : null}
            </PanelCard>
          ))
        )}
      </View>

      <SectionHeader title="Finans akislari" caption="Trainer kredi ve talep durumu" />
      <View style={styles.summaryMiniRow}>
        <StatCard tone="info" label="Satistaki workout" value={String(data.salesSummary.mySales)} />
        <StatCard tone="warning" label="Bekleyen kredi" value={String(data.salesSummary.pendingCreditRequests)} />
        <StatCard tone="danger" label="Bekleyen bozdurma" value={String(data.salesSummary.pendingWithdrawals)} />
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
  summaryEyebrow: {
    color: theme.colors.primary,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '800',
  },
  summaryValue: {
    color: theme.colors.primaryDeep,
    fontSize: 26,
    fontWeight: '800',
  },
  summaryMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  summaryText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  salaryList: {
    marginTop: 8,
    gap: 8,
  },
  salaryRow: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    gap: 2,
  },
  salaryTitle: {
    color: theme.colors.primaryDeep,
    fontWeight: '700',
    fontSize: 13,
  },
  salaryMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
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
  warning: {
    color: theme.colors.warning,
    fontWeight: '700',
  },
  danger: {
    color: theme.colors.danger,
    fontWeight: '700',
  },
  summaryMiniRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});