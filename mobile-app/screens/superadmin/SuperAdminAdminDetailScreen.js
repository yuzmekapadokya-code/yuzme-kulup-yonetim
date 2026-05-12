import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import { theme } from '../../config/theme';
import { deleteAdminCascade, getAdminDetail, processAdminPayment } from '../../services/superAdminService';
import { useAuthStore } from '../../store/authStore';

export default function SuperAdminAdminDetailScreen({ navigation, route }) {
  const { adminId } = route.params;
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');

  const detailQuery = useQuery({
    queryKey: ['sa-admin-detail', adminId],
    queryFn: () => getAdminDetail(adminId),
  });

  const paymentMutation = useMutation({
    mutationFn: () => processAdminPayment({ adminId, amount: paymentAmount, paymentDate, currentSuperAdminId: profile.uid }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sa-admin-detail', adminId] });
      queryClient.invalidateQueries({ queryKey: ['sa-admins'] });
      queryClient.invalidateQueries({ queryKey: ['sa-dashboard'] });
      setPaymentAmount('');
      Alert.alert('Kaydedildi', 'Odeme kaydi basariyla olusturuldu.');
    },
    onError: (error) => Alert.alert('Odeme hatasi', error.message || 'Odeme kaydi olusturulamadi.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAdminCascade(adminId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sa-admins'] });
      queryClient.invalidateQueries({ queryKey: ['sa-dashboard'] });
      navigation.goBack();
    },
    onError: (error) => Alert.alert('Silinemedi', error.message || 'Admin silinemedi.'),
  });

  if (detailQuery.isLoading) {
    return <LoadingBlock label="Admin detaylari yukleniyor..." />;
  }

  const admin = detailQuery.data;

  return (
    <ScreenLayout title={admin.name} subtitle="Uyelik, odeme ve bagli isletme sayilari.">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.heading}>Genel bilgiler</Text>
          <Text style={styles.line}>E-posta: {admin.email}</Text>
          <Text style={styles.line}>Telefon: {admin.phone || '-'}</Text>
          <Text style={styles.line}>Uyelik bitis: {admin.membershipEnd || '-'}</Text>
          <Text style={styles.line}>Sube: {admin.branchCount}</Text>
          <Text style={styles.line}>Antrenor: {admin.trainerCount}</Text>
          <Text style={styles.line}>Ogrenci: {admin.studentCount}</Text>
          <Text style={styles.line}>Toplam uyelik: ₺{admin.metrics.totalAmount.toFixed(2)}</Text>
          <Text style={styles.line}>Odenen: ₺{admin.metrics.paidAmount.toFixed(2)}</Text>
          <Text style={styles.line}>Kalan: ₺{admin.metrics.remainingAmount.toFixed(2)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Odeme islemi</Text>
          <TextInput style={styles.input} placeholder="Odeme tutari" keyboardType="numeric" value={paymentAmount} onChangeText={setPaymentAmount} />
          <TextInput style={styles.input} placeholder="Tarih (YYYY-MM-DD)" value={paymentDate} onChangeText={setPaymentDate} />
          <ActionButton label={paymentMutation.isPending ? 'Kaydediliyor...' : 'Odemeyi Kaydet'} onPress={() => paymentMutation.mutate()} fullWidth />
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Islemler</Text>
          <ActionButton label="Admini Duzenle" onPress={() => navigation.navigate('SAAdminForm', { admin })} fullWidth />
          <ActionButton
            label={deleteMutation.isPending ? 'Siliniyor...' : 'Admini ve bagli kayitlari sil'}
            variant="secondary"
            fullWidth
            onPress={() =>
              Alert.alert('Dikkat', 'Bu islem geri alinmaz. Devam edilsin mi?', [
                { text: 'Iptal', style: 'cancel' },
                { text: 'Sil', style: 'destructive', onPress: () => deleteMutation.mutate() },
              ])
            }
          />
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    gap: 8,
  },
  heading: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 4,
  },
  line: {
    color: theme.colors.textMuted,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: theme.colors.text,
  },
});