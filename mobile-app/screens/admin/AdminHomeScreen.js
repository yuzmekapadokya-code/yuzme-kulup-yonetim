import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import HeroBanner from '../../components/HeroBanner';
import LoadingBlock from '../../components/LoadingBlock';
import PanelCard from '../../components/PanelCard';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import StatCard from '../../components/StatCard';
import { theme } from '../../config/theme';
import { getAdminDashboardData } from '../../services/adminService';
import { useAuthStore } from '../../store/authStore';

const quickLinks = [
  {
    key: 'schedule',
    title: 'Programlama',
    caption: 'Ders saatleri, fiyatlar, musaitlik sablonu ve bitis takvimi.',
    routeName: 'ADScheduleOps',
    icon: 'calendar-outline',
    accentColor: theme.colors.success,
    cardTint: '#f0fdf4',
  },
  {
    key: 'shopping',
    title: 'Alisveris',
    caption: 'Ayrik vitrin, kampanya kartlari ve siparis yonetimi.',
    routeName: 'ADShoppingOps',
    icon: 'cart-outline',
    accentColor: theme.colors.warning,
    cardTint: '#fffbeb',
  },
  {
    key: 'finance',
    title: 'Finans',
    caption: 'Web panelindeki gelir-gider tablosuna yakin finans takibi, kayit islemleri ve indirim kodlari.',
    routeName: 'ADBusinessOps',
    icon: 'cash-outline',
    accentColor: theme.colors.primary,
    cardTint: theme.colors.primaryLight,
  },
  {
    key: 'content',
    title: 'Duyuru ve Takvim',
    caption: 'Duyurulari yayinla ve etkinlik takvimini yonet.',
    routeName: 'ADContentOps',
    icon: 'megaphone-outline',
    accentColor: '#a21caf',
    cardTint: '#fdf4ff',
  },
  {
    key: 'standards',
    title: 'Barajlar',
    caption: 'Yaris ve baraj kayitlarini isim bazli gruplar halinde incele.',
    routeName: 'ADStandardsOps',
    icon: 'trophy-outline',
    accentColor: '#b45309',
    cardTint: '#fffbeb',
  },
];

export default function AdminHomeScreen({ navigation }) {
  const profile = useAuthStore((state) => state.profile);
  const dashboardQuery = useQuery({
    queryKey: ['ad-dashboard', profile?.uid],
    queryFn: () => getAdminDashboardData(profile.uid),
    enabled: Boolean(profile?.uid),
  });

  if (dashboardQuery.isLoading) {
    return <LoadingBlock label="Admin paneli yukleniyor..." />;
  }

  const data = dashboardQuery.data;

  return (
    <ScreenLayout
      eyebrow="OPERASYON MERKEZI"
      title="Admin paneli"
      subtitle="Programlama, finans ve baraj akislari birbirinden ayrildi. Kritik alanlar tek bakista gorunur."
    >
      <HeroBanner
        eyebrow="GUNUN OZET"
        title="Kulup yonetimi tek bakista"
        description="Programlama, finans ve baraj akislari net bicimde ayrildi. Bu sayede admin paneli daha okunur ve daha az karmasik hale geldi."
        stats={[
          { label: 'Ogrenci', value: data?.stats?.[0]?.value ?? '-' },
          { label: 'Aktif ders', value: data?.stats?.[1]?.value ?? '-' },
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

      {!data.clubProfile?.clubName ? (
        <PanelCard tone="muted" style={{ borderColor: theme.colors.warning }}>
          <View style={styles.warningRow}>
            <Ionicons name="alert-circle-outline" size={20} color={theme.colors.warning} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.warningTitle}>Kulup profili eksik</Text>
              <Text style={styles.warningText}>Sohbet ve profil gorunumu icin kulup adi ve logo kaydedilmesi onerilir.</Text>
            </View>
          </View>
        </PanelCard>
      ) : null}

      <SectionHeader title="Bugun en cok kullanilanlar" caption="Admin rolu icin ilk ekranda en sik aksiyonlar gosterilir." />
      <View style={styles.quickGrid}>
        {quickLinks.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => navigation.navigate(item.routeName)}
            style={({ pressed }) => [
              styles.quickCard,
              { borderLeftColor: item.accentColor },
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: item.cardTint }]}>
              <Ionicons name={item.icon} size={22} color={item.accentColor} />
            </View>
            <View style={styles.quickBody}>
              <Text style={styles.quickTitle}>{item.title}</Text>
              <Text style={styles.quickCaption} numberOfLines={2}>{item.caption}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>
        ))}
      </View>
      <ActionButton
        label="Tum modulleri gor"
        variant="secondary"
        onPress={() => navigation.getParent()?.navigate('ModulesTab')}
        fullWidth
      />

      <SectionHeader title="Son kayitlar" caption="Son eklenen ogrenciler" />
      <View style={styles.stack}>
        {!data.recentStudents.length ? (
          <EmptyState title="Kayit yok" description="Henuz ogrenci kaydi bulunmuyor." />
        ) : (
          data.recentStudents.map((student) => (
            <PanelCard key={student.id}>
              <Text style={styles.cardTitle}>{student.fullName || 'Ogrenci'}</Text>
              <Text style={styles.cardText}>{student.branchName}</Text>
              <Text style={styles.cardText}>{student.parentName || '-'}</Text>
            </PanelCard>
          ))
        )}
      </View>

      <SectionHeader title="Taksit bildirimleri" caption="3 gun icindeki odeme aksiyonlari" />
      <View style={styles.stack}>
        {!data.installmentAlerts.length ? (
          <EmptyState title="Acil odeme bildirimi yok" description="Onumuzdeki 3 gunde kritik taksit gorunmuyor." />
        ) : (
          data.installmentAlerts.map((alert) => (
            <PanelCard key={`${alert.studentId}-${alert.installmentNumber}`}>
              <Text style={styles.cardTitle}>{alert.studentName}</Text>
              <Text style={styles.cardText}>{alert.branchName} | {alert.scheduleName}</Text>
              <Text style={styles.cardText}>{alert.installmentNumber}. taksit | Kalan: ₺{alert.remainingAmount.toFixed(2)}</Text>
              <Text style={[styles.cardText, alert.daysUntil < 0 ? styles.dangerText : styles.warningTextInline]}>
                {alert.daysUntil < 0 ? `${Math.abs(alert.daysUntil)} gun gecikti` : alert.daysUntil === 0 ? 'Bugun son gun' : `${alert.daysUntil} gun kaldi`}
              </Text>
            </PanelCard>
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
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
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
  warningRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  warningTitle: {
    color: theme.colors.warning,
    fontWeight: '800',
  },
  warningText: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  warningTextInline: {
    color: theme.colors.warning,
  },
  dangerText: {
    color: theme.colors.danger,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});