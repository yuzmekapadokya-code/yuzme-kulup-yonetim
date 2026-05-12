import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import { theme } from '../../config/theme';
import {
  buildSecretaryInstallmentPlanDraft,
  getSecretaryRegistrationData,
  resolveSecretarySchedulePrice,
  saveSecretaryStudent,
  validateSecretaryDiscount,
} from '../../services/secretaryService';
import { useAuthStore } from '../../store/authStore';
import { todayIsoDate } from '../../utils/date';

const emptyForm = {
  name: '',
  surname: '',
  birthYear: '',
  gender: '',
  phone: '',
  parentName: '',
  parentEmail: '',
  parentPhone: '',
  parentPassword: '',
  parentPasswordConfirm: '',
  address: '',
  branchId: '',
  scheduleId: '',
  trainerId: '',
  startDate: todayIsoDate(),
  monthlyPrice: '',
  installmentCount: '1',
  totalAmount: '',
  discountCode: '',
};

const genderOptions = [
  { key: 'male', label: 'Erkek' },
  { key: 'female', label: 'Kadin' },
];

function toTextNumber(value) {
  if (value === null || typeof value === 'undefined' || value === '') return '';
  return String(value);
}

function getAssignments(schedule) {
  if (Array.isArray(schedule?.trainerAssignments) && schedule.trainerAssignments.length) {
    return schedule.trainerAssignments;
  }

  if (!schedule?.trainerId && !schedule?.trainerDocId) return [];
  return [{ trainerId: schedule?.trainerId || '', trainerDocId: schedule?.trainerDocId || '', role: 'head' }];
}

export default function SecretaryRegistrationOpsScreen({ navigation, route }) {
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [installments, setInstallments] = useState(buildSecretaryInstallmentPlanDraft({ totalAmount: 0, installmentCount: 1 }));
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [hydratedStudentId, setHydratedStudentId] = useState('');

  const registrationQuery = useQuery({
    queryKey: ['sec-registration', profile?.uid],
    queryFn: () => getSecretaryRegistrationData(profile),
    enabled: Boolean(profile?.uid),
  });

  const activeStudentId = route?.params?.studentId || '';
  const editingStudent = useMemo(() => {
    return registrationQuery.data?.students.find((item) => item.id === activeStudentId) || null;
  }, [registrationQuery.data, activeStudentId]);

  const filteredSchedules = useMemo(() => {
    if (!registrationQuery.data || !form.branchId) return [];
    return registrationQuery.data.schedules.filter((item) => item.branchId === form.branchId);
  }, [registrationQuery.data, form.branchId]);

  const selectedSchedule = useMemo(() => {
    return registrationQuery.data?.schedules.find((item) => item.id === form.scheduleId) || null;
  }, [registrationQuery.data, form.scheduleId]);

  const trainerOptions = useMemo(() => {
    if (!selectedSchedule || !registrationQuery.data) return [];
    const assignments = getAssignments(selectedSchedule);
    return assignments
      .map((assignment) => {
        const trainer = registrationQuery.data.trainers.find((item) => {
          return item.id === assignment.trainerId || item.uid === assignment.trainerId || item.id === assignment.trainerDocId;
        });
        if (!trainer) return null;
        return {
          id: trainer.id,
          label: `${trainer.name}${assignment.role === 'assistant' ? ' (Yardimci)' : ' (Bas)'}`,
        };
      })
      .filter(Boolean);
  }, [registrationQuery.data, selectedSchedule]);

  useEffect(() => {
    setInstallments((current) => buildSecretaryInstallmentPlanDraft({
      totalAmount: form.totalAmount,
      installmentCount: form.installmentCount,
      previousInstallments: current,
    }));
  }, [form.totalAmount, form.installmentCount]);

  useEffect(() => {
    if (!registrationQuery.data) return;

    if (editingStudent && editingStudent.id !== hydratedStudentId) {
      setForm({
        name: editingStudent.name || '',
        surname: editingStudent.surname || '',
        birthYear: toTextNumber(editingStudent.birthYear),
        gender: editingStudent.gender || '',
        phone: editingStudent.phone || '',
        parentName: editingStudent.parentName || '',
        parentEmail: editingStudent.parentEmail || '',
        parentPhone: editingStudent.parentPhone || '',
        parentPassword: '',
        parentPasswordConfirm: '',
        address: editingStudent.address || '',
        branchId: editingStudent.branchId || '',
        scheduleId: editingStudent.scheduleId || '',
        trainerId: editingStudent.trainerId || '',
        startDate: editingStudent.startDate || todayIsoDate(),
        monthlyPrice: toTextNumber(editingStudent.monthlyPrice),
        installmentCount: toTextNumber(editingStudent.installmentCount || 1),
        totalAmount: toTextNumber(editingStudent.totalAmount),
        discountCode: editingStudent.discountCode || '',
      });
      setInstallments(editingStudent.installments?.length ? editingStudent.installments : buildSecretaryInstallmentPlanDraft({
        totalAmount: editingStudent.totalAmount,
        installmentCount: editingStudent.installmentCount,
      }));
      setAppliedDiscount(editingStudent.discountCode ? {
        code: editingStudent.discountCode,
        percentage: editingStudent.discountPercentage,
      } : null);
      setHydratedStudentId(editingStudent.id);
    }

    if (!editingStudent && hydratedStudentId) {
      handleReset();
    }
  }, [editingStudent, hydratedStudentId, registrationQuery.data]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['sec-registration', profile.uid] });
    queryClient.invalidateQueries({ queryKey: ['sec-dashboard', profile.uid] });
    queryClient.invalidateQueries({ queryKey: ['sec-students', profile.uid] });
  }

  function handleReset() {
    setForm(emptyForm);
    setInstallments(buildSecretaryInstallmentPlanDraft({ totalAmount: 0, installmentCount: 1 }));
    setAppliedDiscount(null);
    setHydratedStudentId('');
    navigation.setParams?.({ studentId: undefined });
  }

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateSchedulePricing(branchId, scheduleId) {
    if (!registrationQuery.data || !scheduleId) return;
    const price = resolveSecretarySchedulePrice({
      prices: registrationQuery.data.prices,
      schedules: registrationQuery.data.schedules,
      branchId,
      scheduleId,
    });

    setAppliedDiscount(null);
    setForm((current) => ({
      ...current,
      monthlyPrice: price ? price.toFixed(2) : '',
      totalAmount: price ? price.toFixed(2) : '',
      discountCode: '',
    }));
  }

  function handleBranchSelect(branchId) {
    setAppliedDiscount(null);
    setForm((current) => ({
      ...current,
      branchId,
      scheduleId: '',
      trainerId: '',
      monthlyPrice: '',
      totalAmount: '',
      discountCode: '',
    }));
  }

  function handleScheduleSelect(scheduleId) {
    const schedule = registrationQuery.data?.schedules.find((item) => item.id === scheduleId);
    const assignments = getAssignments(schedule);
    const defaultTrainer = assignments[0]?.trainerId || assignments[0]?.trainerDocId || '';

    setForm((current) => ({
      ...current,
      scheduleId,
      trainerId: defaultTrainer,
    }));
    updateSchedulePricing(form.branchId, scheduleId);
  }

  function handleInstallmentChange(index, key, value) {
    setInstallments((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      return { ...item, [key]: value };
    }));
  }

  const discountMutation = useMutation({
    mutationFn: () => validateSecretaryDiscount({ profile, code: form.discountCode, baseAmount: form.monthlyPrice }),
    onSuccess: (discount) => {
      setAppliedDiscount(discount);
      setForm((current) => ({ ...current, totalAmount: discount.discountedAmount.toFixed(2) }));
    },
    onError: (error) => Alert.alert('Indirim', error.message || 'Indirim kodu uygulanamadi.'),
  });

  const saveMutation = useMutation({
    mutationFn: () => saveSecretaryStudent({
      profile,
      studentId: activeStudentId,
      values: {
        ...form,
        installments,
        discount: appliedDiscount,
      },
    }),
    onSuccess: (studentId) => {
      invalidate();
      Alert.alert(
        activeStudentId ? 'Ogrenci guncellendi' : 'Ogrenci kaydedildi',
        activeStudentId ? 'Kayit ve grup sohbeti bilgileri guncellendi.' : 'Veli hesabi, taksit plani ve grup sohbeti olusturuldu.'
      );
      handleReset();
      navigation.navigate('SECStudentsOps', { highlightedStudentId: studentId });
    },
    onError: (error) => Alert.alert('Kayit', error.message || 'Kayit tamamlanamadi.'),
  });

  if (registrationQuery.isLoading) {
    return <LoadingBlock label="Kayit formu yukleniyor..." />;
  }

  const data = registrationQuery.data;

  return (
    <ScreenLayout
      title={activeStudentId ? 'Ogrenci Duzenle' : 'Ogrenci Kayit'}
      subtitle="Veli hesabi, ders grubu, indirim ve taksit planiyla birlikte sekreter kaydini olusturur."
      right={activeStudentId ? <ActionButton label="Yeni Kayit" variant="secondary" onPress={handleReset} /> : null}
    >
      <SectionHeader title="Ogrenci bilgileri" caption="Kimlik ve iletisim alanlari" />
      <View style={styles.card}>
        <TextInput style={styles.input} placeholder="Ad" value={form.name} onChangeText={(text) => updateForm('name', text)} />
        <TextInput style={styles.input} placeholder="Soyad" value={form.surname} onChangeText={(text) => updateForm('surname', text)} />
        <TextInput style={styles.input} placeholder="Dogum yili" keyboardType="numeric" value={form.birthYear} onChangeText={(text) => updateForm('birthYear', text)} />
        <Text style={styles.label}>Cinsiyet</Text>
        <View style={styles.chipRow}>
          {genderOptions.map((option) => (
            <ActionButton
              key={option.key}
              label={option.label}
              variant={form.gender === option.key ? 'primary' : 'secondary'}
              onPress={() => updateForm('gender', option.key)}
            />
          ))}
        </View>
        <TextInput style={styles.input} placeholder="Ogrenci telefon" keyboardType="phone-pad" value={form.phone} onChangeText={(text) => updateForm('phone', text)} />
        <TextInput style={[styles.input, styles.textarea]} multiline placeholder="Adres" value={form.address} onChangeText={(text) => updateForm('address', text)} />
      </View>

      <SectionHeader title="Veli bilgileri" caption="Yeni kayitta veli auth hesabi da olusur" />
      <View style={styles.card}>
        <TextInput style={styles.input} placeholder="Veli ad soyad" value={form.parentName} onChangeText={(text) => updateForm('parentName', text)} />
        <TextInput
          style={[styles.input, activeStudentId ? styles.readonlyInput : null]}
          placeholder="Veli e-posta"
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!activeStudentId}
          value={form.parentEmail}
          onChangeText={(text) => updateForm('parentEmail', text)}
        />
        <TextInput style={styles.input} placeholder="Veli telefon" keyboardType="phone-pad" value={form.parentPhone} onChangeText={(text) => updateForm('parentPhone', text)} />
        {!activeStudentId ? (
          <>
            <TextInput style={styles.input} placeholder="Veli sifresi" secureTextEntry value={form.parentPassword} onChangeText={(text) => updateForm('parentPassword', text)} />
            <TextInput style={styles.input} placeholder="Veli sifre tekrar" secureTextEntry value={form.parentPasswordConfirm} onChangeText={(text) => updateForm('parentPasswordConfirm', text)} />
          </>
        ) : (
          <Text style={styles.helper}>Duzenleme modunda veli e-postasi ve auth sifresi korunur.</Text>
        )}
      </View>

      <SectionHeader title="Program ve fiyat" caption="Sube, saat, antrenor ve taksit plani" />
      <View style={styles.card}>
        <Text style={styles.label}>Sube sec</Text>
        <View style={styles.chipRow}>
          {data.branches.map((branch) => (
            <ActionButton
              key={branch.id}
              label={branch.name}
              variant={form.branchId === branch.id ? 'primary' : 'secondary'}
              onPress={() => handleBranchSelect(branch.id)}
            />
          ))}
        </View>

        <Text style={styles.label}>Ders saati</Text>
        {!form.branchId ? (
          <Text style={styles.helper}>Once sube secin.</Text>
        ) : !filteredSchedules.length ? (
          <EmptyState title="Program yok" description="Secilen sube icin schedule kaydi bulunmuyor." />
        ) : (
          <View style={styles.chipColumn}>
            {filteredSchedules.map((schedule) => (
              <Pressable
                key={schedule.id}
                onPress={() => handleScheduleSelect(schedule.id)}
                style={({ pressed }) => [styles.selectCard, form.scheduleId === schedule.id && styles.selectCardActive, pressed && styles.pressed]}
              >
                <Text style={[styles.selectTitle, form.scheduleId === schedule.id && styles.selectTitleActive]}>{schedule.time}</Text>
                <Text style={styles.selectCaption}>{Array.isArray(schedule.days) && schedule.days.length ? schedule.days.join(', ') : 'Gun tanimi yok'}</Text>
                <Text style={styles.selectCaption}>Kapasite: {schedule.capacity || '-'}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.label}>Antrenor sec</Text>
        <View style={styles.chipRow}>
          {trainerOptions.map((trainer) => (
            <ActionButton
              key={trainer.id}
              label={trainer.label}
              variant={form.trainerId === trainer.id ? 'primary' : 'secondary'}
              onPress={() => updateForm('trainerId', trainer.id)}
            />
          ))}
        </View>

        <TextInput style={styles.input} placeholder="Baslangic tarihi (YYYY-AA-GG)" value={form.startDate} onChangeText={(text) => updateForm('startDate', text)} />
        <TextInput style={[styles.input, styles.readonlyInput]} editable={false} placeholder="Aylik ucret" value={form.monthlyPrice ? `₺${form.monthlyPrice}` : ''} />
        <TextInput style={styles.input} placeholder="Taksit sayisi" keyboardType="numeric" value={form.installmentCount} onChangeText={(text) => updateForm('installmentCount', text || '1')} />
        <TextInput style={[styles.input, styles.readonlyInput]} editable={false} placeholder="Toplam tutar" value={form.totalAmount ? `₺${form.totalAmount}` : ''} />
      </View>

      <SectionHeader title="Indirim" caption="Admin kapsamindaki kuponu dogrula ve uygula" />
      <View style={styles.card}>
        <TextInput style={styles.input} placeholder="Indirim kodu" autoCapitalize="characters" value={form.discountCode} onChangeText={(text) => updateForm('discountCode', text.toUpperCase())} />
        <View style={styles.actionRow}>
          <ActionButton label={discountMutation.isPending ? 'Kontrol ediliyor...' : 'Indirimi Uygula'} onPress={() => discountMutation.mutate()} />
          <ActionButton
            label="Temizle"
            variant="secondary"
            onPress={() => {
              setAppliedDiscount(null);
              setForm((current) => ({ ...current, discountCode: '', totalAmount: current.monthlyPrice }));
            }}
          />
        </View>
        {appliedDiscount ? (
          <View style={styles.discountBox}>
            <Text style={styles.discountTitle}>{appliedDiscount.code} uygulandi</Text>
            <Text style={styles.discountText}>Yuzde: %{appliedDiscount.percentage}</Text>
            <Text style={styles.discountText}>Yeni toplam: ₺{appliedDiscount.discountedAmount.toFixed(2)}</Text>
          </View>
        ) : null}
      </View>

      <SectionHeader title="Taksit plani" caption="Her taksit icin vade veya ders notu gerekir" />
      <View style={styles.card}>
        {installments.map((installment, index) => (
          <View key={installment.installmentNumber} style={styles.installmentCard}>
            <Text style={styles.installmentTitle}>{installment.installmentNumber}. taksit | ₺{Number(installment.amount || 0).toFixed(2)}</Text>
            <TextInput
              style={styles.input}
              placeholder="Vade tarihi (YYYY-AA-GG)"
              value={installment.dueDate || ''}
              onChangeText={(text) => handleInstallmentChange(index, 'dueDate', text)}
            />
            <TextInput
              style={styles.input}
              placeholder="Ders zamani veya not"
              value={installment.lessonLabel || ''}
              onChangeText={(text) => handleInstallmentChange(index, 'lessonLabel', text)}
            />
            {installment.paid ? <Text style={styles.paidText}>Bu taksit odendi.</Text> : null}
          </View>
        ))}
      </View>

      <ActionButton
        label={saveMutation.isPending ? 'Kaydediliyor...' : activeStudentId ? 'Kaydi Guncelle' : 'Kaydi Olustur'}
        onPress={() => saveMutation.mutate()}
        fullWidth
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipColumn: {
    gap: 10,
  },
  label: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  helper: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  selectCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fbfdff',
    padding: theme.spacing.md,
    gap: 4,
  },
  selectCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#eef8ff',
  },
  selectTitle: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  selectTitleActive: {
    color: theme.colors.primaryDeep,
  },
  selectCaption: {
    color: theme.colors.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  discountBox: {
    backgroundColor: '#eef8f3',
    borderWidth: 1,
    borderColor: '#bfe7d1',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 4,
  },
  discountTitle: {
    color: theme.colors.success,
    fontWeight: '800',
  },
  discountText: {
    color: theme.colors.textMuted,
  },
  installmentCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fbfdff',
    padding: theme.spacing.md,
    gap: 8,
  },
  installmentTitle: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  paidText: {
    color: theme.colors.success,
    fontWeight: '700',
  },
  readonlyInput: {
    backgroundColor: '#f3f6f9',
  },
  pressed: {
    opacity: 0.88,
  },
});