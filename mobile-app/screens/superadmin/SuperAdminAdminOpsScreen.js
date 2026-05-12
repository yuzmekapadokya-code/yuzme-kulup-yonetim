import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import { theme } from '../../config/theme';
import { listAdminOverview, listApplicationsOverview, updateApplicationStatus } from '../../services/superAdminService';
import { useAuthStore } from '../../store/authStore';

export default function SuperAdminAdminOpsScreen({ navigation }) {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);

  const adminsQuery = useQuery({
    queryKey: ['sa-admins'],
    queryFn: listAdminOverview,
  });

  const applicationsQuery = useQuery({
    queryKey: ['sa-applications'],
    queryFn: listApplicationsOverview,
  });

  const applicationMutation = useMutation({
    mutationFn: ({ applicationId, status }) =>
      updateApplicationStatus({ applicationId, status, currentSuperAdminId: profile.uid }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sa-applications'] });
      queryClient.invalidateQueries({ queryKey: ['sa-dashboard'] });
    },
    onError: (error) => Alert.alert('Islem hatasi', error.message || 'Basvuru guncellenemedi.'),
  });

  const isLoading = adminsQuery.isLoading || applicationsQuery.isLoading;

  if (isLoading) {
    return <LoadingBlock label="Admin operasyonlari yukleniyor..." />;
  }

  return (
    <ScreenLayout
      title="Yonetici Operasyonlari"
      subtitle="Admin olusturma, odeme takibi ve uyelik basvurulari tek akista yonetilir."
      right={<ActionButton label="Yeni Admin" onPress={() => navigation.navigate('SAAdminForm')} />}
    >
      <ScrollView
        refreshControl={<RefreshControl refreshing={adminsQuery.isRefetching || applicationsQuery.isRefetching} onRefresh={() => { adminsQuery.refetch(); applicationsQuery.refetch(); }} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stack}>
          <SectionHeader title="Kayitli adminler" caption="Uyelik ve odeme durumu ile birlikte" />
          {!adminsQuery.data.length ? (
            <EmptyState title="Admin yok" description="Henuz admin olusturulmamis." />
          ) : (
            adminsQuery.data.map((admin) => (
              <Pressable
                key={admin.id}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                onPress={() => navigation.navigate('SAAdminDetail', { adminId: admin.id })}
              >
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>{admin.name}</Text>
                  <Text style={[styles.badge, admin.metrics.isExpired ? styles.badgeDanger : styles.badgeInfo]}>
                    {admin.metrics.isExpired ? 'Sona ermis' : `${admin.metrics.daysLeft} gun`}
                  </Text>
                </View>
                <Text style={styles.cardText}>{admin.email}</Text>
                <Text style={styles.cardText}>Sube {admin.branchCount} | Antrenor {admin.trainerCount} | Ogrenci {admin.studentCount}</Text>
                <Text style={styles.cardText}>Odeme: ₺{admin.metrics.paidAmount.toFixed(2)} / ₺{admin.metrics.totalAmount.toFixed(2)}</Text>
              </Pressable>
            ))
          )}

          <SectionHeader title="Basvurular" caption="Bekleyen uye/admin adaylari" />
          {!applicationsQuery.data.filter((application) => application.status === 'pending').length ? (
            <EmptyState title="Bekleyen basvuru yok" description="Tum basvurular sonuclandirilmis." />
          ) : (
            applicationsQuery.data
              .filter((application) => application.status === 'pending')
              .map((application) => (
                <View key={application.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{application.name || 'Basvuru'}</Text>
                  <Text style={styles.cardText}>{application.email || '-'}</Text>
                  <Text style={styles.cardText}>{application.sportType || '-'} | {application.city || '-'} / {application.district || '-'}</Text>
                  <View style={styles.buttonRow}>
                    <ActionButton label="Forma aktar" variant="secondary" onPress={() => navigation.navigate('SAAdminForm', { application })} />
                    <ActionButton label="Onayla" onPress={() => applicationMutation.mutate({ applicationId: application.id, status: 'approved' })} />
                    <ActionButton label="Reddet" variant="secondary" onPress={() => applicationMutation.mutate({ applicationId: application.id, status: 'rejected' })} />
                  </View>
                </View>
              ))
          )}
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 6,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  cardText: {
    color: theme.colors.textMuted,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  badgeInfo: {
    backgroundColor: theme.colors.info,
  },
  badgeDanger: {
    backgroundColor: theme.colors.danger,
  },
  buttonRow: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pressed: {
    opacity: 0.88,
  },
});