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
import { getSecretaryDashboardData } from '../../services/secretaryService';
import { useAuthStore } from '../../store/authStore';

const quickLinks = [
  {
    key: 'prereg',
    title: 'On Kayit Linki',
    caption: 'Tek kalici baglanti ve form gorunumu ozellestirme.',
    routeName: 'SECPreRegistrationOps',
    icon: 'link-outline',
    accent: theme.colors.info,
    tint: '#e0f2fe',
  },
  {
    key: 'registration',
    title: 'Ogrenci Kayit',
    caption: 'Yeni kayit ac, veli hesabi uret ve taksit planini kur.',
    routeName: 'SECRegistrationOps',
    icon: 'person-add-outline',
    accent: theme.colors.primary,
    tint: theme.colors.primaryLight,
  },
  {
    key: 'students',
    title: 'Ogrenci ve Odeme',
    caption: 'Gruplu liste, detay, odeme alma ve kayit temizligi.',
    routeName: 'SECStudentsOps',
    icon: 'people-outline',
    accent: theme.colors.success,
    tint: '#dcfce7',
  },
  {
    key: 'chat',
    title: 'Sohbet Operasyonlari',
    caption: 'E-posta ile birebir veya grup sohbeti baslat.',
    routeName: 'SECChatOps',
    icon: 'chatbubble-ellipses-outline',
    accent: '#7c3aed',
    tint: '#f3e8ff',
  },
];

export default function SecretaryHomeScreen({ navigation }) {
  const profile = useAuthStore((state) => state.profile);
  const dashboardQuery = useQuery({
    queryKey: ['sec-dashboard', profile?.uid],
    queryFn: () => getSecretaryDashboardData(profile),
    enabled: Boolean(profile?.uid),
  });

  if (dashboardQuery.isLoading) {
    return <LoadingBlock label="Sekreter paneli yukleniyor..." />;
  }

  const data = dashboardQuery.data;

  return (
    <ScreenLayout
      eyebrow="KAYIT MERKEZI"
      title="Sekreter paneli"
      subtitle="Kayit, taksit, odeme ve sohbet akislari rol-ozel operasyon merkezlerine ayrildi."
    >
      <HeroBanner
        eyebrow="GUNUN OZET"
        title="Sekreter operasyon merkezi"
        description="Kayit acmadan veli iletisimine kadar tum akislar tek ekranda."
        stats={[
          { label: 'Ogrenci', value: data?.stats?.[0]?.value ?? '-' },
          { label: 'Bekleyen', value: String(data?.installmentAlerts?.length ?? 0) },
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

      <SectionHeader title="Operasyon merkezleri" caption="Web panelindeki ana sekreter akislarinin mobil karsiliklari." />
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

      <SectionHeader title="Ders gruplari" caption="Sube ve saat bazli aktif ogrenci yogunlugu" />
      <View style={styles.stack}>
        {!data.groups.length ? (
          <EmptyState title="Grup bulunamadi" description="Sekreter kapsaminda aktif ogrenci kaydi yok." />
        ) : (
          data.groups.map((group) => (
            <PanelCard key={group.key}>
              <Text style={styles.cardTitle}>{group.branchName} | {group.scheduleName}</Text>
              <Text style={styles.cardText}>{group.daysLabel}</Text>
              <Text style={styles.cardText}>Toplam ogrenci: {group.studentCount}</Text>
              <Text style={styles.cardText}>Tam odeme: {group.paidStudents}</Text>
              <Text style={styles.cardText}>Acik bakiye: ₺{group.outstandingAmount.toFixed(2)}</Text>
            </PanelCard>
          ))
        )}
      </View>

      <SectionHeader title="Taksit uyarilari" caption="3 gun icindeki veya geciken odemeler" />
      <View style={styles.stack}>
        {!data.installmentAlerts.length ? (
          <EmptyState title="Kritik taksit yok" description="Yakin vadeli veya geciken odeme bulunmuyor." />
        ) : (
          data.installmentAlerts.map((alert) => (
            <PanelCard
              key={`${alert.studentId}-${alert.installmentNumber}`}
              style={{ borderLeftWidth: 4, borderLeftColor: alert.daysUntil < 0 ? theme.colors.danger : theme.colors.warning }}
            >
              <Text style={styles.cardTitle}>{alert.studentName}</Text>
              <Text style={styles.cardText}>{alert.branchName} | {alert.scheduleName}</Text>
              <Text style={styles.cardText}>{alert.installmentNumber}. taksit | Kalan ₺{alert.remainingAmount.toFixed(2)}</Text>
              <Text style={[styles.cardText, alert.daysUntil < 0 ? styles.danger : styles.warning]}>
                {alert.daysUntil < 0
                  ? `${Math.abs(alert.daysUntil)} gun gecikti`
                  : alert.daysUntil === 0
                    ? 'Bugun son gun'
                    : `${alert.daysUntil} gun kaldi`}
              </Text>
            </PanelCard>
          ))
        )}
      </View>

      <SectionHeader title="Son odemeler" caption="En son tahsilatlar" />
      <View style={styles.stack}>
        {!data.recentPayments.length ? (
          <EmptyState title="Odeme yok" description="Henuz kayitli tahsilat bulunmuyor." />
        ) : (
          data.recentPayments.map((payment) => (
            <PanelCard key={payment.id}>
              <Text style={styles.cardTitle}>{payment.studentName}</Text>
              <Text style={styles.cardText}>{payment.methodLabel} | ₺{payment.amount.toFixed(2)}</Text>
              <Text style={styles.cardText}>{payment.note || payment.description}</Text>
            </PanelCard>
          ))
        )}
      </View>

      <SectionHeader title="Sohbet ozeti" caption="Sekreterin dahil oldugu son konusmalar" />
      <View style={styles.stack}>
        {!data.chats.length ? (
          <EmptyState title="Sohbet yok" description="Sekreter kullanicisi icin chat kaydi bulunmuyor." />
        ) : (
          data.chats.map((chat) => (
            <Pressable
              key={chat.id}
              onPress={() => navigation.navigate('ChatDetail', { chat })}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <PanelCard>
                <Text style={styles.cardTitle}>{chat.title}</Text>
                <Text style={styles.cardText}>{chat.subtitle}</Text>
                <Text style={styles.cardText}>{chat.lastMessageText}</Text>
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
  warning: {
    color: theme.colors.warning,
    fontWeight: '700',
  },
  danger: {
    color: theme.colors.danger,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});