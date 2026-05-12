import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import ScreenLayout from '../../components/ScreenLayout';
import { theme } from '../../config/theme';
import { createOrUpdateAdmin } from '../../services/superAdminService';
import { useAuthStore } from '../../store/authStore';

function buildInitialValues(params) {
  const admin = params?.admin || null;
  const application = params?.application || null;
  return {
    name: admin?.name || application?.name || '',
    email: admin?.email || application?.email || '',
    password: '',
    phone: admin?.phone || application?.phone || '',
    clubAddress: admin?.adminProfile?.clubAddress || application?.clubAddress || '',
    membershipStart: admin?.membershipStart || '',
    membershipEnd: admin?.membershipEnd || '',
    membershipPrice: String(admin?.membershipPrice || ''),
    membershipInstallments: String(admin?.membershipInstallments || 1),
    membershipPaid: String(admin?.membershipPaid || 0),
  };
}

export default function SuperAdminAdminFormScreen({ navigation, route }) {
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);
  const { admin = null, application = null } = route.params || {};
  const [values, setValues] = useState(() => buildInitialValues(route.params));

  const screenTitle = useMemo(() => {
    if (admin) return 'Admin Duzenle';
    if (application) return 'Basvurudan Admin Olustur';
    return 'Yeni Admin';
  }, [admin, application]);

  const saveMutation = useMutation({
    mutationFn: () =>
      createOrUpdateAdmin({
        values,
        currentSuperAdminId: profile.uid,
        existingAdminId: admin?.id || null,
        sourceApplicationId: application?.id || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sa-admins'] });
      queryClient.invalidateQueries({ queryKey: ['sa-applications'] });
      queryClient.invalidateQueries({ queryKey: ['sa-dashboard'] });
      navigation.goBack();
    },
    onError: (error) => Alert.alert('Kaydedilemedi', error.message || 'Islem tamamlanamadi.'),
  });

  function updateField(key, nextValue) {
    setValues((current) => ({ ...current, [key]: nextValue }));
  }

  return (
    <ScreenLayout title={screenTitle} subtitle="Web panelindeki admin olusturma ve duzenleme akisi mobilde burada yonetilir." scroll={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.label}>Ad Soyad</Text>
          <TextInput style={styles.input} value={values.name} onChangeText={(text) => updateField('name', text)} />

          <Text style={styles.label}>E-posta</Text>
          <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" value={values.email} onChangeText={(text) => updateField('email', text)} />

          {!admin ? (
            <>
              <Text style={styles.label}>Sifre</Text>
              <TextInput style={styles.input} secureTextEntry value={values.password} onChangeText={(text) => updateField('password', text)} />
            </>
          ) : null}

          <Text style={styles.label}>Telefon</Text>
          <TextInput style={styles.input} value={values.phone} onChangeText={(text) => updateField('phone', text)} />

          <Text style={styles.label}>Kulup Adresi</Text>
          <TextInput style={[styles.input, styles.textarea]} multiline value={values.clubAddress} onChangeText={(text) => updateField('clubAddress', text)} />

          <Text style={styles.label}>Uyelik Baslangic</Text>
          <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={values.membershipStart} onChangeText={(text) => updateField('membershipStart', text)} />

          <Text style={styles.label}>Uyelik Bitis</Text>
          <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={values.membershipEnd} onChangeText={(text) => updateField('membershipEnd', text)} />

          <Text style={styles.label}>Uyelik Ucreti</Text>
          <TextInput style={styles.input} keyboardType="numeric" value={values.membershipPrice} onChangeText={(text) => updateField('membershipPrice', text)} />

          <Text style={styles.label}>Taksit Sayisi</Text>
          <TextInput style={styles.input} keyboardType="numeric" value={values.membershipInstallments} onChangeText={(text) => updateField('membershipInstallments', text)} />

          {admin ? (
            <>
              <Text style={styles.label}>Odenmis Tutar</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={values.membershipPaid} onChangeText={(text) => updateField('membershipPaid', text)} />
            </>
          ) : null}

          <ActionButton label={saveMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'} onPress={() => saveMutation.mutate()} fullWidth />
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    gap: 8,
  },
  label: {
    marginTop: 8,
    color: theme.colors.text,
    fontWeight: '700',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.text,
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});