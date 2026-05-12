import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import StatCard from '../../components/StatCard';
import { theme } from '../../config/theme';
import { getSecretaryDashboardData } from '../../services/secretaryService';
import { useAuthStore } from '../../store/authStore';

const quickLinks = [
  {
    key: 'registration',
    title: 'Ogrenci Kayit',
    caption: 'Yeni kayit ac, veli hesabi uret ve taksit planini kur.',
    routeName: 'SECRegistrationOps',
  },
  {
    key: 'students',
    title: 'Ogrenci ve Odeme',
    caption: 'Gruplu liste, detay, odeme alma ve kayit temizligi.',
    routeName: 'SECStudentsOps',
  },
  {
    key: 'chat',
    title: 'Sohbet Operasyonlari',
    caption: 'E-posta ile birebir veya grup sohbeti baslat.',
    routeName: 'SECChatOps',
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
      title="Sekreter"
      subtitle="Kayit, taksit, odeme ve sohbet akislarini mobilde rol-ozel operasyon merkezlerine ayirir."
    >
      <View style={styles.statsGrid}>
        {data.stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </View>

      <SectionHeader title="Operasyon merkezleri" caption="Web panelindeki ana sekreter akislarinin mobil karsiliklari" />
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

      <SectionHeader title="Ders gruplari" caption="Sube ve saat bazli aktif ogrenci yogunlugu" />
      <View style={styles.stack}>
        {!data.groups.length ? (
          <EmptyState title="Grup bulunamadi" description="Sekreter kapsaminda aktif ogrenci kaydi yok." />
        ) : (
          data.groups.map((group) => (
            <View key={group.key} style={styles.listCard}>
              <Text style={styles.cardTitle}>{group.branchName} | {group.scheduleName}</Text>
              <Text style={styles.cardText}>{group.daysLabel}</Text>
              <Text style={styles.cardText}>Toplam ogrenci: {group.studentCount}</Text>
              <Text style={styles.cardText}>Tam odeme: {group.paidStudents}</Text>
              <Text style={styles.cardText}>Acik bakiye: ₺{group.outstandingAmount.toFixed(2)}</Text>
            </View>
          ))
        )}
      </View>

      <SectionHeader title="Taksit uyarilari" caption="3 gun icindeki veya geciken odemeler" />
      <View style={styles.stack}>
        {!data.installmentAlerts.length ? (
          <EmptyState title="Kritik taksit yok" description="Yakin vadeli veya geciken odeme bulunmuyor." />
        ) : (
          data.installmentAlerts.map((alert) => (
            <View key={`${alert.studentId}-${alert.installmentNumber}`} style={styles.listCard}>
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
            </View>
          ))
        )}
      </View>

      <SectionHeader title="Son odemeler" caption="En son tahsilatlar" />
      <View style={styles.stack}>
        {!data.recentPayments.length ? (
          <EmptyState title="Odeme yok" description="Henuz kayitli tahsilat bulunmuyor." />
        ) : (
          data.recentPayments.map((payment) => (
            <View key={payment.id} style={styles.listCard}>
              <Text style={styles.cardTitle}>{payment.studentName}</Text>
              <Text style={styles.cardText}>{payment.methodLabel} | ₺{payment.amount.toFixed(2)}</Text>
              <Text style={styles.cardText}>{payment.note || payment.description}</Text>
            </View>
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
              style={({ pressed }) => [styles.listCard, pressed && styles.pressed]}
            >
              <Text style={styles.cardTitle}>{chat.title}</Text>
              <Text style={styles.cardText}>{chat.subtitle}</Text>
              <Text style={styles.cardText}>{chat.lastMessageText}</Text>
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
  warning: {
    color: theme.colors.warning,
  },
  danger: {
    color: theme.colors.danger,
  },
  pressed: {
    opacity: 0.88,
  },
});