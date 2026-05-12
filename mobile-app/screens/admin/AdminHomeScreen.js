import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import StatCard from '../../components/StatCard';
import { theme } from '../../config/theme';
import { getAdminDashboardData } from '../../services/adminService';
import { useAuthStore } from '../../store/authStore';

const quickLinks = [
  {
    key: 'schedule',
    title: '🗓️ Programlama',
    caption: 'Ders saatleri, fiyatlar, musaitlik sablonu ve bitis takvimi.',
    routeName: 'ADScheduleOps',
    accentColor: '#1b7f5c',
    cardTint: '#eefbf5',
  },
  {
    key: 'shopping',
    title: '🛍️ Alisveris',
    caption: 'Ayrik vitrin, kampanya kartlari ve siparis yonetimi.',
    routeName: 'ADShoppingOps',
    accentColor: '#b05d19',
    cardTint: '#fff8ef',
  },
  {
    key: 'finance',
    title: '💰 Finans',
    caption: 'Web panelindeki gelir-gider tablosuna yakin finans takibi, kayit islemleri ve indirim kodlari.',
    routeName: 'ADBusinessOps',
    accentColor: '#b96a00',
    cardTint: '#fff7eb',
  },
  {
    key: 'content',
    title: '📣 Duyuru ve Takvim',
    caption: 'Duyurulari yayinla ve etkinlik takvimini yonet.',
    routeName: 'ADContentOps',
    accentColor: '#b3367a',
    cardTint: '#fff0f8',
  },
  {
    key: 'standards',
    title: '🎯 Barajlar',
    caption: 'Yaris ve baraj kayitlarini isim bazli gruplar halinde incele.',
    routeName: 'ADStandardsOps',
    accentColor: '#7a4c00',
    cardTint: '#fff6e8',
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
      title="Admin"
      subtitle="Kulup operasyonlarini yoneten mobil merkez. Kritik alanlar daha net, daha renkli ve daha ayri akislara bolundu."
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>OPERASYON MERKEZI</Text>
        <Text style={styles.heroTitle}>Kulup yonetimi tek bakista</Text>
        <Text style={styles.heroText}>Programlama, finans ve baraj akislari birbirinden ayrildi. Bu sayede admin paneli daha okunur ve daha az karmasik hale geldi.</Text>
      </View>

      <View style={styles.statsGrid}>
        {data.stats.map((stat, index) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} tone={index % 2 === 0 ? 'primary' : 'success'} />
        ))}
      </View>

      {!data.clubProfile?.clubName ? (
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>Kulup profili eksik</Text>
          <Text style={styles.warningText}>Sohbet ve profil gorunumu icin kulup adi ve logo kaydedilmesi onerilir.</Text>
        </View>
      ) : null}

      <SectionHeader title="Bugun en cok kullanilanlar" caption="Admin rolu icin ilk ekranda sadece 3 ana aksiyon gosterilir." />
      <View style={styles.quickGrid}>
        {quickLinks.map((item) => (
          <Pressable key={item.key} onPress={() => navigation.navigate(item.routeName)} style={({ pressed }) => [styles.quickCard, { backgroundColor: item.cardTint }, pressed && styles.pressed]}>
            <Text style={styles.quickTitle}>{item.title}</Text>
            <Text style={styles.quickCaption}>{item.caption}</Text>
          </Pressable>
        ))}
      </View>
      <ActionButton label="Tum modulleri gor" variant="secondary" onPress={() => navigation.getParent()?.navigate('ModulesTab')} fullWidth />

      <SectionHeader title="Son kayitlar" caption="Son eklenen ogrenciler" />
      <View style={styles.stack}>
        {!data.recentStudents.length ? (
          <EmptyState title="Kayit yok" description="Henuz ogrenci kaydi bulunmuyor." />
        ) : (
          data.recentStudents.map((student) => (
            <View key={student.id} style={styles.listCard}>
              <Text style={styles.cardTitle}>{student.fullName || 'Ogrenci'}</Text>
              <Text style={styles.cardText}>{student.branchName}</Text>
              <Text style={styles.cardText}>{student.parentName || '-'}</Text>
            </View>
          ))
        )}
      </View>

      <SectionHeader title="Taksit bildirimleri" caption="3 gun icindeki odeme aksiyonlari" />
      <View style={styles.stack}>
        {!data.installmentAlerts.length ? (
          <EmptyState title="Acil odeme bildirimi yok" description="Onumuzdeki 3 gunde kritik taksit gorunmuyor." />
        ) : (
          data.installmentAlerts.map((alert) => (
            <View key={`${alert.studentId}-${alert.installmentNumber}`} style={styles.listCard}>
              <Text style={styles.cardTitle}>{alert.studentName}</Text>
              <Text style={styles.cardText}>{alert.branchName} | {alert.scheduleName}</Text>
              <Text style={styles.cardText}>{alert.installmentNumber}. taksit | Kalan: ₺{alert.remainingAmount.toFixed(2)}</Text>
              <Text style={[styles.cardText, alert.daysUntil < 0 ? styles.dangerText : styles.warningTextInline]}>
                {alert.daysUntil < 0 ? `${Math.abs(alert.daysUntil)} gun gecikti` : alert.daysUntil === 0 ? 'Bugun son gun' : `${alert.daysUntil} gun kaldi`}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#eaf6ff',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#c9e6fa',
    padding: theme.spacing.lg,
    gap: 8,
  },
  heroEyebrow: {
    color: theme.colors.primaryDeep,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    color: theme.colors.primaryDeep,
    fontWeight: '800',
    fontSize: 24,
  },
  heroText: {
    color: theme.colors.textMuted,
    lineHeight: 20,
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
    backgroundColor: '#ffffff',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: 8,
    ...theme.shadow.card,
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
  warningBox: {
    backgroundColor: '#fff6e8',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#f3d7a4',
    padding: theme.spacing.md,
    gap: 6,
  },
  warningTitle: {
    color: '#9b5f00',
    fontWeight: '800',
  },
  warningText: {
    color: '#9b5f00',
    lineHeight: 20,
  },
  warningTextInline: {
    color: theme.colors.warning,
  },
  dangerText: {
    color: theme.colors.danger,
  },
  pressed: {
    opacity: 0.88,
  },
});