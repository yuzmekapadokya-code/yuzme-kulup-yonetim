import { useQuery } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import StatCard from '../../components/StatCard';
import { theme } from '../../config/theme';
import { getParentDashboardData } from '../../services/parentService';
import { useAuthStore } from '../../store/authStore';
import { formatDate } from '../../utils/date';

const quickLinks = [
  { key: 'shopping', title: 'Alisveris', caption: 'Kulup urunleri, sepet ve siparis takibi.', routeName: 'PRShoppingOps', icon: 'shopping-outline', bgColor: '#fff1e6', accentColor: '#c56b1f' },
  { key: 'daily', title: 'Gunluk Yasam', caption: 'Odeme, devam, etkinlik, duyuru ve antrenmanlar.', routeName: 'PRDailyOps', icon: 'calendar-today', bgColor: '#fff9c4', accentColor: '#f9a825' },
  { key: 'progress', title: 'Performans', caption: 'Dereceler, barajlar ve antrenor degerlendirmeleri.', routeName: 'PRProgressOps', icon: 'chart-line', bgColor: '#e3f2fd', accentColor: '#1976d2' },
];

export default function ParentHomeScreen({ navigation }) {
  const profile = useAuthStore((state) => state.profile);
  const dashboardQuery = useQuery({
    queryKey: ['pr-dashboard', profile?.uid],
    queryFn: () => getParentDashboardData(profile),
    enabled: Boolean(profile?.uid),
  });

  if (dashboardQuery.isLoading) {
    return <LoadingBlock label="Veli paneli yukleniyor..." />;
  }

  const data = dashboardQuery.data;

  return (
    <ScreenLayout title="Veli" subtitle="Ogrencinin finans, devam, etkinlik ve iletisim akislarini tek merkezde toplar.">
      <View style={styles.hero}>
        <Text style={styles.heroName}>{data.student.fullName}</Text>
        <Text style={styles.heroText}>{data.student.branchName} | {data.student.scheduleName}</Text>
        <Text style={styles.heroText}>Yas: {data.student.age || '-'} | Gelisim, market ve iletisim ayni merkezde</Text>
      </View>

      <View style={styles.statsGrid}>
        {data.stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </View>

      <SectionHeader title="Hizli merkezler" caption="Veli icin ilk ekranda sadece en sik 3 akis gosterilir" />
      <View style={styles.quickGrid}>
        {quickLinks.map((item) => (
          <Pressable key={item.key} onPress={() => navigation.navigate(item.routeName)} style={({ pressed }) => [styles.quickCard, { backgroundColor: item.bgColor }, pressed && styles.pressed]}>
            <View style={styles.quickHeader}>
              <MaterialCommunityIcons name={item.icon} size={32} color={item.accentColor} />
              <Text style={[styles.quickTitle, { color: item.accentColor }]}>{item.title}</Text>
            </View>
            <Text style={styles.quickCaption}>{item.caption}</Text>
          </Pressable>
        ))}
      </View>
      <ActionButton label="Tum modulleri gor" variant="secondary" onPress={() => navigation.getParent()?.navigate('ModulesTab')} fullWidth />

      <SectionHeader title="Taksit plani" caption="Kalan odeme dagilimi" />
      <View style={styles.stack}>
        {!data.installments.length ? (
          <EmptyState title="Taksit bilgisi yok" description="Ogrenci kaydinda taksit plani bulunamadi." />
        ) : (
          data.installments.map((item) => (
            <View key={item.installmentNumber} style={[styles.listCard, { borderLeftColor: item.remainingAmount <= 0.009 ? '#4caf50' : '#ff9800' }]}>
              <Text style={styles.cardTitle}>{item.installmentNumber}. taksit</Text>
              <Text style={styles.cardText}>Tutar: <Text style={{ fontWeight: '700', color: theme.colors.text }}>₺{Number(item.amount || 0).toFixed(2)}</Text></Text>
              <Text style={styles.cardText}>Vade: {formatDate(item.dueDate)}</Text>
              {item.lessonLabel ? <Text style={styles.cardText}>Not: {item.lessonLabel}</Text> : null}
              <Text style={[styles.cardText, item.remainingAmount <= 0.009 ? styles.success : styles.warning, { fontWeight: '700', fontSize: 14 }]}>
                {item.remainingAmount <= 0.009 ? '✓ Odendi' : `⊘ Kalan ₺${item.remainingAmount.toFixed(2)}`}
              </Text>
            </View>
          ))
        )}
      </View>

      <SectionHeader title="Devam ozeti" caption="Katilim durumu" />
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLine}>Toplam ders: {data.attendanceSummary.totalLessons}</Text>
        <Text style={styles.summaryLine}>Katilinan: {data.attendanceSummary.present}</Text>
        <Text style={styles.summaryLine}>Kacirilan: {data.attendanceSummary.missed}</Text>
        <Text style={styles.summaryValue}>Devam: %{data.attendanceSummary.attendanceRate}</Text>
      </View>

      <SectionHeader title="Yaklasan etkinlikler" caption="Takvimdeki sonraki kayitlar" />
      <View style={styles.stack}>
        {!data.upcomingEvents.length ? (
          <EmptyState title="Etkinlik yok" description="Yaklasan etkinlik bulunmuyor." />
        ) : (
          data.upcomingEvents.map((event) => (
            <View key={event.id} style={[styles.listCard, { borderLeftColor: '#7b1fa2' }]}>
              <View style={styles.eventHeader}>
                <MaterialCommunityIcons name="calendar-check" size={20} color="#7b1fa2" />
                <Text style={styles.cardTitle}>{event.name}</Text>
              </View>
              <Text style={styles.cardText}>{formatDate(event.date)} • {event.type || 'Etkinlik'}</Text>
              <Text style={styles.cardText}>{event.description || 'Aciklama yok'}</Text>
            </View>
          ))
        )}
      </View>

      <SectionHeader title="Duyurular" caption="Ogrenciye ilgili en guncel bildiriler" />
      <View style={styles.stack}>
        {!data.announcements.length ? (
          <EmptyState title="Duyuru yok" description="Bu ogrenciye hedefli duyuru bulunmuyor." />
        ) : (
          data.announcements.map((announcement) => (
            <View key={announcement.id} style={[styles.listCard, { borderLeftColor: '#d32f2f' }]}>
              <View style={styles.announcementHeader}>
                <MaterialCommunityIcons name="bell-circle" size={20} color="#d32f2f" />
                <Text style={styles.cardTitle}>{announcement.title}</Text>
              </View>
              <Text style={styles.cardText}>{announcement.content}</Text>
            </View>
          ))
        )}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: theme.colors.primaryDeep,
    borderRadius: theme.radius.lg,
    padding: 20,
    gap: 10,
    marginBottom: 8,
  },
  heroName: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 18,
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
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: 12,
  },
  quickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 17,
    flex: 1,
  },
  quickCaption: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stack: {
    gap: 12,
  },
  listCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: 6,
  },
  cardTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
  cardText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  summaryCard: {
    backgroundColor: '#eef8ff',
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderColor: '#bbdefb',
    padding: theme.spacing.lg,
    gap: 10,
  },
  summaryLine: {
    color: '#0d47a1',
    fontSize: 14,
    fontWeight: '500',
  },
  summaryValue: {
    color: '#1565c0',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
  },
  success: {
    color: theme.colors.success,
  },
  warning: {
    color: theme.colors.warning,
  },
  pressed: {
    opacity: 0.88,
  },
});