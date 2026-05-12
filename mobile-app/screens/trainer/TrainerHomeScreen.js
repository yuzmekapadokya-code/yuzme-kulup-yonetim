import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import StatCard from '../../components/StatCard';
import { theme } from '../../config/theme';
import { getTrainerDashboardData } from '../../services/trainerService';
import { useAuthStore } from '../../store/authStore';

const quickLinks = [
  { key: 'classes', title: '📅 Ders Akislari', caption: 'Musaitlik, ders gruplari, yoklama ve yorum.', routeName: 'TRClassOps', bg: '#e8f4ff', border: '#b9dcff', accent: '#0b63a7' },
  { key: 'performance', title: '🏁 Performans', caption: 'Derece girisi, rapor ve baraj takibi.', routeName: 'TRPerformanceOps', bg: '#f2efff', border: '#d8ccff', accent: '#56379b' },
  { key: 'shopping', title: '🛒 Alisveris', caption: 'Sepet, kulup urunleri ve siparis takibi.', routeName: 'TRShoppingOps', bg: '#fff2e8', border: '#ffd7b8', accent: '#9b4b14' },
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
      title="Trainer"
      subtitle="Ders, performans, alisveris ve finans akislarini daha okunur kartlarla ayirir."
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>🔥 GUNLUK KONTROL MERKEZI</Text>
        <Text style={styles.heroTitle}>Antrenor operasyon merkezi</Text>
        <Text style={styles.heroText}>Ders, ogrenci, antrenman, alisveris ve finans panelleri daha hizli erisim icin tek ekranda toplandi.</Text>
      </View>

      <View style={styles.statsGrid}>
        {data.stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </View>

      <SectionHeader title="🚀 Hizli merkezler" caption="Antrenor icin ilk ekranda sadece en sik 3 akis gosterilir" />
      <View style={styles.quickGrid}>
        {quickLinks.map((item) => (
          <Pressable key={item.key} onPress={() => navigation.navigate(item.routeName)} style={({ pressed }) => [styles.quickCard, { backgroundColor: item.bg, borderColor: item.border }, pressed && styles.pressed]}>
            <Text style={[styles.quickTitle, { color: item.accent }]}>{item.title}</Text>
            <Text style={styles.quickCaption}>{item.caption}</Text>
          </Pressable>
        ))}
      </View>
      <ActionButton label="Tum modulleri gor" variant="secondary" onPress={() => navigation.getParent()?.navigate('ModulesTab')} fullWidth />

      <SectionHeader title="💰 Kazanc ozeti" caption="Ders atamalarindan hesaplanan tahmini tablo" />
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>💰 Toplam projected kazanc</Text>
        <Text style={styles.summaryValue}>₺{data.salarySummary.totalProjected.toFixed(2)}</Text>
        <Text style={styles.summaryText}>Odenen: ₺{data.salarySummary.totalPaid.toFixed(2)}</Text>
        <Text style={styles.summaryText}>Toplam ders: {data.salarySummary.totalLessons}</Text>
        <Text style={styles.summaryText}>Bekleyen ders odemesi: {data.salarySummary.pendingLessons}</Text>
        {!!data.salarySummary.rows?.length && (
          <View style={styles.salaryList}>
            {data.salarySummary.rows.map((row) => (
              <View key={row.scheduleId} style={styles.salaryRow}>
                <Text style={styles.salaryTitle}>👥 {row.branchName} | ⏰ {row.time}</Text>
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
      </View>

      <SectionHeader title="📚 Ders gruplari" caption="Antrenore atanmis aktif gruplar" />
      <View style={styles.stack}>
        {!data.upcomingClasses.length ? (
          <EmptyState title="Ders grubu bulunamadi" description="Bu antrenore bagli schedule kaydi yok." />
        ) : (
          data.upcomingClasses.map((item, index) => (
            <View key={item.id} style={[styles.listCard, index % 2 === 0 ? styles.classCardBlue : styles.classCardMint]}>
              <Text style={styles.cardTitle}>{item.branchName}</Text>
              <Text style={styles.cardText}>{item.time} | {item.daysLabel}</Text>
              <Text style={styles.cardText}>{item.lessonTypeLabel} | Kapasite: {item.capacity}</Text>
              <Text style={styles.cardText}>{item.postponementCount ? `${item.postponementCount} erteleme var` : 'Erteleme yok'}</Text>
            </View>
          ))
        )}
      </View>

      <SectionHeader title="⚠️ Bitis ve aksiyon uyarilari" caption="Ders doneminin sonuna yaklasan ogrenciler" />
      <View style={styles.stack}>
        {!data.alerts.length ? (
          <EmptyState title="Kritik uyari yok" description="Yakin bitisli ogrenci veya ozel ders alarmi gorunmuyor." />
        ) : (
          data.alerts.map((alert) => (
            <View key={alert.studentId} style={[styles.listCard, styles.alertCard]}>
              <Text style={styles.cardTitle}>{alert.studentName}</Text>
              <Text style={styles.cardText}>{alert.branchName} | {alert.scheduleName}</Text>
              <Text style={styles.cardText}>Bitis: {alert.endDate}</Text>
              <Text style={[styles.cardText, alert.daysLeft < 0 ? styles.danger : styles.warning]}>
                {alert.daysLeft < 0 ? `${Math.abs(alert.daysLeft)} gun gecti` : alert.daysLeft === 0 ? 'Bugun bitiyor' : `${alert.daysLeft} gun kaldi`}
              </Text>
              {alert.isPrivateLesson ? <Text style={styles.cardText}>Kalan ozel ders: {alert.remainingLessons}</Text> : null}
            </View>
          ))
        )}
      </View>

      <SectionHeader title="💳 Finans akislari" caption="Trainer kredi ve talep durumu" />
      <View style={styles.summaryMiniRow}>
        <View style={styles.summaryMiniCard}>
          <Text style={styles.summaryMiniLabel}>Satistaki workout</Text>
          <Text style={styles.summaryMiniValue}>{data.salesSummary.mySales}</Text>
        </View>
        <View style={styles.summaryMiniCard}>
          <Text style={styles.summaryMiniLabel}>Bekleyen kredi talebi</Text>
          <Text style={styles.summaryMiniValue}>{data.salesSummary.pendingCreditRequests}</Text>
        </View>
        <View style={styles.summaryMiniCard}>
          <Text style={styles.summaryMiniLabel}>Bekleyen bozdurma</Text>
          <Text style={styles.summaryMiniValue}>{data.salesSummary.pendingWithdrawals}</Text>
        </View>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#0f3d6e',
    borderWidth: 1,
    borderColor: '#2d76bf',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: 10,
  },
  heroEyebrow: {
    color: '#b7e3ff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
  },
  heroText: {
    color: '#cfe4f7',
    lineHeight: 22,
    fontSize: 15,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickGrid: {
    gap: 12,
  },
  quickCard: {
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    gap: 8,
    ...theme.shadow.card,
  },
  quickTitle: {
    fontSize: 19,
    fontWeight: '800',
  },
  quickCaption: {
    color: theme.colors.textMuted,
    lineHeight: 21,
    fontSize: 14,
  },
  summaryCard: {
    backgroundColor: '#fff4e6',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#f6d3a0',
    padding: theme.spacing.md,
    gap: 6,
  },
  summaryTitle: {
    color: theme.colors.primaryDeep,
    fontWeight: '800',
  },
  summaryValue: {
    color: theme.colors.primaryDeep,
    fontSize: 26,
    fontWeight: '800',
  },
  summaryText: {
    color: theme.colors.textMuted,
  },
  salaryList: {
    marginTop: 8,
    gap: 8,
  },
  salaryRow: {
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#f6deb9',
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    gap: 2,
  },
  salaryTitle: {
    color: '#814f11',
    fontWeight: '800',
  },
  salaryMeta: {
    color: '#7a6550',
    fontSize: 12,
  },
  stack: {
    gap: 12,
  },
  listCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 4,
    ...theme.shadow.card,
  },
  classCardBlue: {
    backgroundColor: '#f2f8ff',
    borderColor: '#cee2fb',
  },
  classCardMint: {
    backgroundColor: '#effbf5',
    borderColor: '#c7ead8',
  },
  alertCard: {
    backgroundColor: '#fff6ea',
    borderColor: '#f4d7b1',
  },
  cardTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  cardText: {
    color: theme.colors.textMuted,
  },
  warning: {
    color: theme.colors.warning,
  },
  danger: {
    color: theme.colors.danger,
  },
  summaryMiniRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryMiniCard: {
    flexGrow: 1,
    minWidth: '30%',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 6,
  },
  summaryMiniLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  summaryMiniValue: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.88,
  },
});