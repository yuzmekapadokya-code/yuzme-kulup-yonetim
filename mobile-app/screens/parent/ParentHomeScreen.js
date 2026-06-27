import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
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
import { getParentDashboardData } from '../../services/parentService';
import { useAuthStore } from '../../store/authStore';
import { formatDate } from '../../utils/date';

const quickLinks = [
  { key: 'shopping', title: 'Alisveris', caption: 'Kulup urunleri, sepet ve siparis takibi.', routeName: 'PRShoppingOps', icon: 'bag-handle-outline', accent: theme.colors.warning, tint: '#fffbeb' },
  { key: 'daily', title: 'Gunluk Yasam', caption: 'Odeme, devam, etkinlik, duyuru ve antrenmanlar.', routeName: 'PRDailyOps', icon: 'calendar-outline', accent: theme.colors.primary, tint: theme.colors.primaryLight },
  { key: 'progress', title: 'Performans', caption: 'Dereceler, barajlar ve antrenor degerlendirmeleri.', routeName: 'PRProgressOps', icon: 'speedometer-outline', accent: theme.colors.success, tint: '#dcfce7' },
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
    <ScreenLayout
      eyebrow="VELI MERKEZI"
      title="Veli paneli"
      subtitle="Ogrencinin finans, devam, etkinlik ve iletisim akislari tek merkezde."
    >
      <HeroBanner
        eyebrow="SPORCU"
        title={data.student.fullName}
        description={`${data.student.branchName || 'Sube'} | ${data.student.scheduleName || 'Ders'} | Yas: ${data.student.age || '-'}`}
        stats={[
          { label: 'Devam', value: `%${data.attendanceSummary.attendanceRate}` },
          { label: 'Taksit', value: String(data.installments?.length ?? 0) },
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

      <SectionHeader title="Hizli merkezler" caption="Veli icin ilk ekranda en sik 3 akis gosterilir." />
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

      <SectionHeader title="Taksit plani" caption="Kalan odeme dagilimi" />
      <View style={styles.stack}>
        {!data.installments.length ? (
          <EmptyState title="Taksit bilgisi yok" description="Ogrenci kaydinda taksit plani bulunamadi." />
        ) : (
          data.installments.map((item) => (
            <PanelCard
              key={item.installmentNumber}
              style={{ borderLeftWidth: 4, borderLeftColor: item.remainingAmount <= 0.009 ? theme.colors.success : theme.colors.warning }}
            >
              <Text style={styles.cardTitle}>{item.installmentNumber}. taksit</Text>
              <Text style={styles.cardText}>Tutar: <Text style={{ fontWeight: '700', color: theme.colors.text }}>₺{Number(item.amount || 0).toFixed(2)}</Text></Text>
              <Text style={styles.cardText}>Vade: {formatDate(item.dueDate)}</Text>
              {item.lessonLabel ? <Text style={styles.cardText}>Not: {item.lessonLabel}</Text> : null}
              <Text style={[styles.cardText, item.remainingAmount <= 0.009 ? styles.success : styles.warning, { fontWeight: '700', fontSize: 14 }]}>
                {item.remainingAmount <= 0.009 ? 'Odendi' : `Kalan ₺${item.remainingAmount.toFixed(2)}`}
              </Text>
            </PanelCard>
          ))
        )}
      </View>

      <SectionHeader title="Devam ozeti" caption="Katilim durumu" />
      <PanelCard tone="tint">
        <Text style={styles.summaryEyebrow}>DEVAM ORANI</Text>
        <Text style={styles.summaryValue}>%{data.attendanceSummary.attendanceRate}</Text>
        <View style={styles.summaryMetaRow}>
          <Text style={styles.summaryLine}>Toplam ders: {data.attendanceSummary.totalLessons}</Text>
          <Text style={styles.summaryLine}>Katilinan: {data.attendanceSummary.present}</Text>
          <Text style={styles.summaryLine}>Kacirilan: {data.attendanceSummary.missed}</Text>
        </View>
      </PanelCard>

      <SectionHeader title="Yaklasan etkinlikler" caption="Takvimdeki sonraki kayitlar" />
      <View style={styles.stack}>
        {!data.upcomingEvents.length ? (
          <EmptyState title="Etkinlik yok" description="Yaklasan etkinlik bulunmuyor." />
        ) : (
          data.upcomingEvents.map((event) => (
            <PanelCard key={event.id} style={{ borderLeftWidth: 4, borderLeftColor: '#7c3aed' }}>
              <View style={styles.rowHeader}>
                <MaterialCommunityIcons name="calendar-check" size={18} color="#7c3aed" />
                <Text style={styles.cardTitle}>{event.name}</Text>
              </View>
              <Text style={styles.cardText}>{formatDate(event.date)} • {event.type || 'Etkinlik'}</Text>
              <Text style={styles.cardText}>{event.description || 'Aciklama yok'}</Text>
            </PanelCard>
          ))
        )}
      </View>

      <SectionHeader title="Duyurular" caption="Ogrenciye iliskin en guncel bildiriler" />
      <View style={styles.stack}>
        {!data.announcements.length ? (
          <EmptyState title="Duyuru yok" description="Bu ogrenciye hedefli duyuru bulunmuyor." />
        ) : (
          data.announcements.map((announcement) => (
            <PanelCard key={announcement.id} style={{ borderLeftWidth: 4, borderLeftColor: theme.colors.danger }}>
              <View style={styles.rowHeader}>
                <MaterialCommunityIcons name="bell-circle" size={18} color={theme.colors.danger} />
                <Text style={styles.cardTitle}>{announcement.title}</Text>
              </View>
              <Text style={styles.cardText}>{announcement.content}</Text>
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
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    lineHeight: 18,
  },
  summaryEyebrow: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  summaryValue: {
    color: theme.colors.primaryDeep,
    fontSize: 28,
    fontWeight: '800',
  },
  summaryMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  summaryLine: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  success: {
    color: theme.colors.success,
  },
  warning: {
    color: theme.colors.warning,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});