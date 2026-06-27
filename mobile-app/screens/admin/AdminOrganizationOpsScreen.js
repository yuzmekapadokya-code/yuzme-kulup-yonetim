import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import { theme } from '../../config/theme';
import {
  createSecretary,
  deleteBranch,
  deleteSecretary,
  deleteTrainer,
  getAdminOrganizationOverview,
  saveBranch,
  saveClubProfile,
  saveTrainer,
} from '../../services/adminService';
import { useAuthStore } from '../../store/authStore';

function initialBranchForm() {
  return {
    id: null,
    name: '',
    address: '',
    phone: '',
    lessonTypes: { group: true, private: false },
    perTrainerCapacity: { group: '8', private: '1' },
  };
}

function initialTrainerForm() {
  return { id: null, name: '', email: '', password: '', branches: [] };
}

export default function AdminOrganizationOpsScreen() {
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();
  const overviewQuery = useQuery({
    queryKey: ['ad-organization', profile?.uid],
    queryFn: () => getAdminOrganizationOverview(profile.uid),
    enabled: Boolean(profile?.uid),
  });

  const [clubValues, setClubValues] = useState({ clubName: '', logoUrl: '' });
  const [secretaryValues, setSecretaryValues] = useState({ name: '', email: '', password: '' });
  const [branchForm, setBranchForm] = useState(initialBranchForm());
  const [trainerForm, setTrainerForm] = useState(initialTrainerForm());

  useEffect(() => {
    if (overviewQuery.data?.clubProfile) {
      setClubValues({
        clubName: overviewQuery.data.clubProfile.clubName || overviewQuery.data.clubProfile.name || '',
        logoUrl: overviewQuery.data.clubProfile.logoUrl || '',
      });
    }
  }, [overviewQuery.data]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['ad-organization', profile.uid] });
    queryClient.invalidateQueries({ queryKey: ['ad-dashboard', profile.uid] });
  }

  const clubMutation = useMutation({
    mutationFn: () => saveClubProfile({ adminId: profile.uid, values: clubValues, currentAdminId: profile.uid }),
    onSuccess: invalidate,
    onError: (error) => Alert.alert('Kulup profili', error.message || 'Kayit tamamlanamadi.'),
  });

  const secretaryMutation = useMutation({
    mutationFn: () => createSecretary({ adminId: profile.uid, values: secretaryValues }),
    onSuccess: () => {
      setSecretaryValues({ name: '', email: '', password: '' });
      invalidate();
    },
    onError: (error) => Alert.alert('Sekreter', error.message || 'Sekreter olusturulamadi.'),
  });

  const deleteSecretaryMutation = useMutation({ mutationFn: deleteSecretary, onSuccess: invalidate });
  const branchMutation = useMutation({
    mutationFn: () => saveBranch({ adminId: profile.uid, branchId: branchForm.id, values: branchForm, currentAdminId: profile.uid }),
    onSuccess: () => {
      setBranchForm(initialBranchForm());
      invalidate();
    },
    onError: (error) => Alert.alert('Sube', error.message || 'Sube kaydedilemedi.'),
  });
  const deleteBranchMutation = useMutation({ mutationFn: deleteBranch, onSuccess: invalidate, onError: (error) => Alert.alert('Sube silme', error.message || 'Sube silinemedi.') });

  const trainerMutation = useMutation({
    mutationFn: () => saveTrainer({ adminId: profile.uid, trainerId: trainerForm.id, values: trainerForm, currentAdminId: profile.uid }),
    onSuccess: () => {
      setTrainerForm(initialTrainerForm());
      invalidate();
    },
    onError: (error) => Alert.alert('Antrenor', error.message || 'Antrenor kaydedilemedi.'),
  });
  const deleteTrainerMutation = useMutation({ mutationFn: deleteTrainer, onSuccess: invalidate, onError: (error) => Alert.alert('Antrenor silme', error.message || 'Antrenor silinemedi.') });

  async function pickClubLogo() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Logo', 'Galeri izni gerekli.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const dataUrl = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
    setClubValues((current) => ({ ...current, logoUrl: dataUrl }));
  }

  if (overviewQuery.isLoading) {
    return <LoadingBlock label="Organizasyon modulu yukleniyor..." />;
  }

  const data = overviewQuery.data;

  return (
    <ScreenLayout title="Organizasyon" subtitle="Kulup profili, ekip kurulumu ve temel yapilanma.">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.stack}>
        <SectionHeader title="Kulup profili" caption="Kulup adi ve logo" />
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Kulup adi" value={clubValues.clubName} onChangeText={(text) => setClubValues((current) => ({ ...current, clubName: text }))} />
          {clubValues.logoUrl ? <Image source={{ uri: clubValues.logoUrl }} style={styles.logoPreview} resizeMode="contain" /> : null}
          <ActionButton label="Logodan Sec" variant="secondary" onPress={pickClubLogo} fullWidth />
          <TextInput style={styles.input} placeholder="Logo URL (istege bagli)" value={clubValues.logoUrl} onChangeText={(text) => setClubValues((current) => ({ ...current, logoUrl: text }))} />
          <ActionButton label={clubMutation.isPending ? 'Kaydediliyor...' : 'Kulup Profilini Kaydet'} onPress={() => clubMutation.mutate()} fullWidth />
        </View>

        <SectionHeader title="Sekreterler" caption="Sekreter kullanicisi olustur ve yonet" />
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Ad Soyad" value={secretaryValues.name} onChangeText={(text) => setSecretaryValues((current) => ({ ...current, name: text }))} />
          <TextInput style={styles.input} placeholder="E-posta" autoCapitalize="none" keyboardType="email-address" value={secretaryValues.email} onChangeText={(text) => setSecretaryValues((current) => ({ ...current, email: text }))} />
          <TextInput style={styles.input} placeholder="Sifre" secureTextEntry value={secretaryValues.password} onChangeText={(text) => setSecretaryValues((current) => ({ ...current, password: text }))} />
          <ActionButton label={secretaryMutation.isPending ? 'Olusturuluyor...' : 'Sekreter Olustur'} onPress={() => secretaryMutation.mutate()} fullWidth />
          {!data.secretaries.length ? (
            <EmptyState title="Sekreter yok" description="Henuz sekreter tanimlanmamis." />
          ) : (
            data.secretaries.map((secretary) => (
              <View key={secretary.id} style={styles.itemCard}>
                <Text style={styles.itemTitle}>{secretary.name}</Text>
                <Text style={styles.itemText}>{secretary.email}</Text>
                <ActionButton label="Sil" variant="secondary" onPress={() => deleteSecretaryMutation.mutate(secretary.id)} />
              </View>
            ))
          )}
        </View>

        <SectionHeader title="Subeler" caption="Kulubun operasyon merkezleri" />
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Sube adi" value={branchForm.name} onChangeText={(text) => setBranchForm((current) => ({ ...current, name: text }))} />
          <TextInput style={[styles.input, styles.textarea]} placeholder="Adres" multiline value={branchForm.address} onChangeText={(text) => setBranchForm((current) => ({ ...current, address: text }))} />
          <TextInput style={styles.input} placeholder="Telefon" value={branchForm.phone} onChangeText={(text) => setBranchForm((current) => ({ ...current, phone: text }))} />

          <Text style={styles.label}>Bu subede yapilan ders turleri</Text>
          <View style={styles.chipRow}>
            <ActionButton
              label={branchForm.lessonTypes.group ? '✓ Grup Dersi' : 'Grup Dersi'}
              variant={branchForm.lessonTypes.group ? 'primary' : 'secondary'}
              onPress={() =>
                setBranchForm((current) => ({
                  ...current,
                  lessonTypes: { ...current.lessonTypes, group: !current.lessonTypes.group },
                }))
              }
            />
            <ActionButton
              label={branchForm.lessonTypes.private ? '✓ Ozel Ders' : 'Ozel Ders'}
              variant={branchForm.lessonTypes.private ? 'primary' : 'secondary'}
              onPress={() =>
                setBranchForm((current) => ({
                  ...current,
                  lessonTypes: { ...current.lessonTypes, private: !current.lessonTypes.private },
                }))
              }
            />
          </View>

          {branchForm.lessonTypes.group ? (
            <>
              <Text style={styles.label}>Grup Dersi — antrenor basina kontenjan</Text>
              <TextInput
                style={styles.input}
                placeholder="Orn: 8"
                keyboardType="numeric"
                value={String(branchForm.perTrainerCapacity.group)}
                onChangeText={(text) =>
                  setBranchForm((current) => ({
                    ...current,
                    perTrainerCapacity: { ...current.perTrainerCapacity, group: text },
                  }))
                }
              />
            </>
          ) : null}

          {branchForm.lessonTypes.private ? (
            <>
              <Text style={styles.label}>Ozel Ders — antrenor basina kontenjan</Text>
              <TextInput
                style={styles.input}
                placeholder="Orn: 1"
                keyboardType="numeric"
                value={String(branchForm.perTrainerCapacity.private)}
                onChangeText={(text) =>
                  setBranchForm((current) => ({
                    ...current,
                    perTrainerCapacity: { ...current.perTrainerCapacity, private: text },
                  }))
                }
              />
            </>
          ) : null}

          <ActionButton label={branchMutation.isPending ? 'Kaydediliyor...' : branchForm.id ? 'Subeyi Guncelle' : 'Sube Ekle'} onPress={() => branchMutation.mutate()} fullWidth />
          {data.branches.map((branch) => {
            const types = branch.lessonTypes && typeof branch.lessonTypes === 'object'
              ? { group: branch.lessonTypes.group !== false, private: Boolean(branch.lessonTypes.private) }
              : { group: true, private: false };
            const quotaGroup = Number(branch?.perTrainerCapacity?.group) > 0 ? Math.floor(branch.perTrainerCapacity.group) : 8;
            const quotaPrivate = Number(branch?.perTrainerCapacity?.private) > 0 ? Math.floor(branch.perTrainerCapacity.private) : 1;
            const summaryParts = [];
            if (types.group) summaryParts.push(`Grup (${quotaGroup} ogr./antrenor)`);
            if (types.private) summaryParts.push(`Ozel (${quotaPrivate} ogr./antrenor)`);
            return (
              <View key={branch.id} style={styles.itemCard}>
                <Text style={styles.itemTitle}>{branch.name}</Text>
                <Text style={styles.itemText}>{branch.address}</Text>
                <Text style={styles.itemText}>{branch.phone}</Text>
                {summaryParts.length ? <Text style={[styles.itemText, { color: theme.colors.primary }]}>{summaryParts.join(' • ')}</Text> : null}
                <View style={styles.buttonRow}>
                  <ActionButton
                    label="Duzenle"
                    variant="secondary"
                    onPress={() =>
                      setBranchForm({
                        id: branch.id,
                        name: branch.name || '',
                        address: branch.address || '',
                        phone: branch.phone || '',
                        lessonTypes: { group: types.group, private: types.private },
                        perTrainerCapacity: { group: String(quotaGroup), private: String(quotaPrivate) },
                      })
                    }
                  />
                  <ActionButton label="Sil" variant="secondary" onPress={() => deleteBranchMutation.mutate(branch.id)} />
                </View>
              </View>
            );
          })}
        </View>

        <SectionHeader title="Antrenorler" caption="Coklu sube ve yorum ortalamasi ile" />
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Ad Soyad" value={trainerForm.name} onChangeText={(text) => setTrainerForm((current) => ({ ...current, name: text }))} />
          <TextInput style={styles.input} placeholder="E-posta" autoCapitalize="none" keyboardType="email-address" value={trainerForm.email} onChangeText={(text) => setTrainerForm((current) => ({ ...current, email: text }))} />
          {!trainerForm.id ? <TextInput style={styles.input} placeholder="Sifre" secureTextEntry value={trainerForm.password} onChangeText={(text) => setTrainerForm((current) => ({ ...current, password: text }))} /> : null}
          <Text style={styles.label}>Sube secimi</Text>
          <View style={styles.chipRow}>
            {data.branches.map((branch) => {
              const selected = trainerForm.branches.includes(branch.id);
              return (
                <ActionButton
                  key={branch.id}
                  label={branch.name}
                  variant={selected ? 'primary' : 'secondary'}
                  onPress={() =>
                    setTrainerForm((current) => ({
                      ...current,
                      branches: selected ? current.branches.filter((item) => item !== branch.id) : [...current.branches, branch.id],
                    }))
                  }
                />
              );
            })}
          </View>
          <ActionButton label={trainerMutation.isPending ? 'Kaydediliyor...' : trainerForm.id ? 'Antrenoru Guncelle' : 'Antrenor Ekle'} onPress={() => trainerMutation.mutate()} fullWidth />
          {!data.trainers.length ? (
            <EmptyState title="Antrenor yok" description="Henuz antrenor eklenmemis." />
          ) : (
            data.trainers.map((trainer) => (
              <View key={trainer.id} style={styles.itemCard}>
                <Text style={styles.itemTitle}>{trainer.name}</Text>
                <Text style={styles.itemText}>{trainer.email}</Text>
                <Text style={styles.itemText}>{trainer.branchesLabel || '-'}</Text>
                <Text style={styles.itemText}>
                  {trainer.reviewStats.average ? `${trainer.reviewStats.average.toFixed(1)} / 5` : 'Puan yok'} | {trainer.reviewStats.count} degerlendirme
                </Text>
                <View style={styles.buttonRow}>
                  <ActionButton label="Duzenle" variant="secondary" onPress={() => setTrainerForm({ id: trainer.id, name: trainer.name || '', email: trainer.email || '', password: '', branches: trainer.branches || [] })} />
                  <ActionButton label="Sil" variant="secondary" onPress={() => deleteTrainerMutation.mutate(trainer.id)} />
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
    gap: 10,
  },
  itemCard: {
    backgroundColor: '#fbfdff',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 4,
  },
  itemTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  itemText: {
    color: theme.colors.textMuted,
  },
  logoPreview: {
    width: '100%',
    height: 120,
    borderRadius: theme.radius.md,
    backgroundColor: '#f4f7fb',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: theme.colors.text,
  },
  textarea: {
    minHeight: 88,
    textAlignVertical: 'top',
    paddingVertical: 12,
  },
  label: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
});