import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import { theme } from '../../config/theme';
import {
  deleteSecretaryStudent,
  getSecretaryStudentOpsData,
  processSecretaryPayment,
} from '../../services/secretaryService';
import { useAuthStore } from '../../store/authStore';
import { formatDate, formatDateTime } from '../../utils/date';

function buildPaymentStatus(student) {
  if (student.remainingBalance <= 0.009) {
    return { label: 'Tamamen odendi', color: theme.colors.success };
  }
  if (student.totalPaid > 0) {
    return { label: `Kismi odeme ₺${student.totalPaid.toFixed(2)}`, color: theme.colors.warning };
  }
  return { label: 'Odenmedi', color: theme.colors.danger };
}

function defaultPaymentState(student) {
  const nextAmount = student?.nextPendingInstallment?.remainingAmount || student?.remainingBalance || 0;
  const current = new Date();
  return {
    amount: nextAmount ? nextAmount.toFixed(2) : '',
    method: 'cash',
    note: '',
    hour: String(current.getHours()).padStart(2, '0'),
    minute: String(current.getMinutes()).padStart(2, '0'),
    second: String(current.getSeconds()).padStart(2, '0'),
  };
}

export default function SecretaryStudentsOpsScreen({ navigation, route }) {
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [detailStudentId, setDetailStudentId] = useState(route?.params?.highlightedStudentId || '');
  const [paymentStudentId, setPaymentStudentId] = useState('');
  const [paymentForm, setPaymentForm] = useState(defaultPaymentState());
  const [attachmentAsset, setAttachmentAsset] = useState(null);

  const studentsQuery = useQuery({
    queryKey: ['sec-students', profile?.uid],
    queryFn: () => getSecretaryStudentOpsData(profile),
    enabled: Boolean(profile?.uid),
  });

  useEffect(() => {
    if (route?.params?.highlightedStudentId) {
      setDetailStudentId(route.params.highlightedStudentId);
    }
  }, [route?.params?.highlightedStudentId]);

  const filteredGroups = useMemo(() => {
    if (!studentsQuery.data) return [];
    const term = search.trim().toLowerCase();
    if (!term) return studentsQuery.data.groups;

    return studentsQuery.data.groups
      .map((group) => ({
        ...group,
        students: group.students.filter((student) => {
          return student.fullName.toLowerCase().includes(term)
            || student.parentName?.toLowerCase().includes(term)
            || student.parentPhone?.toLowerCase().includes(term);
        }),
      }))
      .filter((group) => group.students.length > 0);
  }, [studentsQuery.data, search]);

  const detailedStudent = useMemo(() => {
    return studentsQuery.data?.students.find((item) => item.id === detailStudentId) || null;
  }, [studentsQuery.data, detailStudentId]);

  const paymentStudent = useMemo(() => {
    return studentsQuery.data?.students.find((item) => item.id === paymentStudentId) || null;
  }, [studentsQuery.data, paymentStudentId]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['sec-students', profile.uid] });
    queryClient.invalidateQueries({ queryKey: ['sec-dashboard', profile.uid] });
    queryClient.invalidateQueries({ queryKey: ['sec-registration', profile.uid] });
  }

  async function pickAttachment() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: false,
    });

    if (!result.canceled && result.assets?.length) {
      setAttachmentAsset(result.assets[0]);
    }
  }

  const deleteMutation = useMutation({
    mutationFn: (studentId) => deleteSecretaryStudent({ profile, studentId }),
    onSuccess: () => {
      invalidate();
      setDetailStudentId('');
      setPaymentStudentId('');
    },
    onError: (error) => Alert.alert('Silme', error.message || 'Ogrenci silinemedi.'),
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!paymentStudent) throw new Error('Odeme icin ogrenci secilmedi.');

      let attachmentDataUrl = '';
      if (attachmentAsset?.uri) {
        const base64 = await FileSystem.readAsStringAsync(attachmentAsset.uri, { encoding: FileSystem.EncodingType.Base64 });
        const mimeType = attachmentAsset.mimeType || 'image/jpeg';
        attachmentDataUrl = `data:${mimeType};base64,${base64}`;
      }

      return processSecretaryPayment({
        profile,
        studentId: paymentStudent.id,
        values: {
          ...paymentForm,
          attachmentDataUrl,
          attachmentFileName: attachmentAsset?.fileName || 'odeme.jpg',
        },
      });
    },
    onSuccess: (result) => {
      invalidate();
      Alert.alert('Odeme kaydedildi', `Tahsilat tamamlandi. Kalan bakiye: ₺${result.remainingBalance.toFixed(2)}`);
      setAttachmentAsset(null);
      setPaymentStudentId('');
    },
    onError: (error) => Alert.alert('Odeme', error.message || 'Odeme kaydedilemedi.'),
  });

  if (studentsQuery.isLoading) {
    return <LoadingBlock label="Ogrenci ve odeme modulu yukleniyor..." />;
  }

  const data = studentsQuery.data;

  return (
    <ScreenLayout title="Ogrenci ve Odeme" subtitle="Gruplanmis ogrencileri incele, detay ac, taksit tahsil et veya kaydi temizle.">
      <View style={styles.card}>
        <TextInput style={styles.input} placeholder="Ogrenci, veli veya telefon ara" value={search} onChangeText={setSearch} />
      </View>

      <SectionHeader title="Gruplu ogrenci listesi" caption="Sube ve ders saati bazli operasyon gorunumu" />
      <View style={styles.stack}>
        {!filteredGroups.length ? (
          <EmptyState title="Ogrenci bulunamadi" description="Arama kriterinize uyan kayit yok." />
        ) : (
          filteredGroups.map((group) => (
            <View key={group.key} style={styles.card}>
              <Text style={styles.groupTitle}>{group.label}</Text>
              <Text style={styles.groupMeta}>{group.details}</Text>
              {group.students.map((student) => {
                const paymentStatus = buildPaymentStatus(student);
                return (
                  <View key={student.id} style={styles.studentRow}>
                    <View style={styles.studentHeader}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.itemTitle}>{student.fullName}</Text>
                        <Text style={styles.itemText}>{student.parentName} | {student.parentPhone || '-'}</Text>
                        <Text style={[styles.itemText, { color: paymentStatus.color }]}>{paymentStatus.label}</Text>
                      </View>
                    </View>
                    <View style={styles.actionWrap}>
                      <ActionButton label="Detay" variant="secondary" onPress={() => setDetailStudentId(student.id)} />
                      <ActionButton
                        label="Taksit"
                        onPress={() => {
                          setPaymentStudentId(student.id);
                          setAttachmentAsset(null);
                          setPaymentForm(defaultPaymentState(student));
                        }}
                      />
                      <ActionButton label="Duzenle" variant="secondary" onPress={() => navigation.navigate('SECRegistrationOps', { studentId: student.id })} />
                      <ActionButton
                        label="Sil"
                        variant="secondary"
                        onPress={() => {
                          Alert.alert('Ogrenciyi sil', 'Ogrenciyle bagli Firestore kayitlari da temizlenecek. Devam edilsin mi?', [
                            { text: 'Vazgec', style: 'cancel' },
                            { text: 'Sil', style: 'destructive', onPress: () => deleteMutation.mutate(student.id) },
                          ]);
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </View>

      {detailedStudent ? (
        <>
          <SectionHeader title="Ogrenci detayi" caption="Kayit, veli ve finans bilgileri" />
          <View style={styles.card}>
            <Text style={styles.itemTitle}>{detailedStudent.fullName}</Text>
            <Text style={styles.itemText}>{detailedStudent.branchName} | {detailedStudent.scheduleName}</Text>
            <Text style={styles.itemText}>Antrenor: {detailedStudent.trainerName}</Text>
            <Text style={styles.itemText}>Dogum yili: {detailedStudent.birthYear || '-'}</Text>
            <Text style={styles.itemText}>Cinsiyet: {detailedStudent.gender || '-'}</Text>
            <Text style={styles.itemText}>Ogrenci telefon: {detailedStudent.phone || '-'}</Text>
            <Text style={styles.itemText}>Adres: {detailedStudent.address || '-'}</Text>
            <Text style={styles.itemText}>Veli: {detailedStudent.parentName} | {detailedStudent.parentEmail}</Text>
            <Text style={styles.itemText}>Toplam tutar: ₺{detailedStudent.totalAmount.toFixed(2)}</Text>
            <Text style={styles.itemText}>Odenen: ₺{detailedStudent.totalPaid.toFixed(2)}</Text>
            <Text style={styles.itemText}>Kalan: ₺{detailedStudent.remainingBalance.toFixed(2)}</Text>
            {detailedStudent.discountCode ? <Text style={styles.itemText}>Indirim: {detailedStudent.discountCode} (%{detailedStudent.discountPercentage || 0})</Text> : null}
          </View>

          <SectionHeader title="Taksit plani" caption="Mevcut odeme dagilimi" />
          <View style={styles.card}>
            {detailedStudent.installments.map((installment) => (
              <View key={installment.installmentNumber} style={styles.installmentRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.itemTitle}>{installment.installmentNumber}. taksit</Text>
                  <Text style={styles.itemText}>{installment.dueDate || 'Vade yok'}{installment.lessonLabel ? ` | ${installment.lessonLabel}` : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.itemTitle}>₺{Number(installment.amount || 0).toFixed(2)}</Text>
                  <Text style={[styles.itemText, Number(installment.paidAmount || 0) + 0.009 >= Number(installment.amount || 0) ? styles.success : styles.warning]}>
                    {Number(installment.paidAmount || 0) + 0.009 >= Number(installment.amount || 0)
                      ? 'Odendi'
                      : `Kalan ₺${Math.max(0, Number(installment.amount || 0) - Number(installment.paidAmount || 0)).toFixed(2)}`}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <SectionHeader title="Odeme gecmisi" caption="Bu ogrenci icin kayitli tahsilatlar" />
          <View style={styles.card}>
            {!detailedStudent.paymentHistory.length ? (
              <EmptyState title="Odeme kaydi yok" description="Bu ogrenci icin henuz tahsilat kaydedilmemis." />
            ) : (
              detailedStudent.paymentHistory.map((payment) => (
                <View key={payment.id} style={styles.installmentRow}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.itemTitle}>₺{Number(payment.amount || 0).toFixed(2)}</Text>
                    <Text style={styles.itemText}>{payment.method || 'cash'} | {formatDateTime(payment.timestamp || payment.date)}</Text>
                    <Text style={styles.itemText}>{payment.note || payment.description}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </>
      ) : null}

      {paymentStudent ? (
        <>
          <SectionHeader title="Odeme al" caption="Nakit, transfer veya kredi karti ile taksit tahsilati" />
          <View style={styles.card}>
            <Text style={styles.itemTitle}>{paymentStudent.fullName}</Text>
            <Text style={styles.itemText}>Toplam ₺{paymentStudent.totalAmount.toFixed(2)} | Odenen ₺{paymentStudent.totalPaid.toFixed(2)} | Kalan ₺{paymentStudent.remainingBalance.toFixed(2)}</Text>
            <Text style={styles.itemText}>
              Sonraki taksit: {paymentStudent.nextPendingInstallment ? `${paymentStudent.nextPendingInstallment.installmentNumber}. taksit` : 'Bekleyen taksit yok'}
            </Text>
            <TextInput style={styles.input} placeholder="Odeme tutari" keyboardType="numeric" value={paymentForm.amount} onChangeText={(text) => setPaymentForm((current) => ({ ...current, amount: text }))} />
            <Text style={styles.label}>Odeme yontemi</Text>
            <View style={styles.actionWrap}>
              <ActionButton label="Nakit" variant={paymentForm.method === 'cash' ? 'primary' : 'secondary'} onPress={() => setPaymentForm((current) => ({ ...current, method: 'cash' }))} />
              <ActionButton label="Transfer" variant={paymentForm.method === 'transfer' ? 'primary' : 'secondary'} onPress={() => setPaymentForm((current) => ({ ...current, method: 'transfer' }))} />
              <ActionButton label="Kredi Karti" variant={paymentForm.method === 'credit' ? 'primary' : 'secondary'} onPress={() => setPaymentForm((current) => ({ ...current, method: 'credit' }))} />
            </View>

            {paymentForm.method === 'cash' ? (
              <View style={styles.timeRow}>
                <TextInput style={[styles.input, styles.timeInput]} placeholder="SS" keyboardType="numeric" value={paymentForm.hour} onChangeText={(text) => setPaymentForm((current) => ({ ...current, hour: text }))} />
                <TextInput style={[styles.input, styles.timeInput]} placeholder="DD" keyboardType="numeric" value={paymentForm.minute} onChangeText={(text) => setPaymentForm((current) => ({ ...current, minute: text }))} />
                <TextInput style={[styles.input, styles.timeInput]} placeholder="SN" keyboardType="numeric" value={paymentForm.second} onChangeText={(text) => setPaymentForm((current) => ({ ...current, second: text }))} />
              </View>
            ) : (
              <>
                <ActionButton label={attachmentAsset ? 'Belgeyi Degistir' : paymentForm.method === 'transfer' ? 'Dekont Sec' : 'Fis/Fatura Sec'} variant="secondary" onPress={pickAttachment} />
                {attachmentAsset ? <Text style={styles.itemText}>Secilen dosya: {attachmentAsset.fileName || attachmentAsset.uri}</Text> : null}
              </>
            )}

            <TextInput style={[styles.input, styles.textarea]} multiline placeholder="Not" value={paymentForm.note} onChangeText={(text) => setPaymentForm((current) => ({ ...current, note: text }))} />
            <View style={styles.actionWrap}>
              <ActionButton label={paymentMutation.isPending ? 'Kaydediliyor...' : 'Odemeyi Kaydet'} onPress={() => paymentMutation.mutate()} />
              <ActionButton label="Kapat" variant="secondary" onPress={() => { setPaymentStudentId(''); setAttachmentAsset(null); }} />
            </View>
          </View>
        </>
      ) : null}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 10,
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    color: theme.colors.text,
    backgroundColor: '#ffffff',
  },
  textarea: {
    minHeight: 100,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  groupTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
  groupMeta: {
    color: theme.colors.textMuted,
  },
  studentRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 10,
    gap: 10,
  },
  studentHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  itemTitle: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  itemText: {
    color: theme.colors.textMuted,
  },
  actionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  installmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 10,
  },
  success: {
    color: theme.colors.success,
  },
  warning: {
    color: theme.colors.warning,
  },
  label: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timeInput: {
    flex: 1,
  },
});