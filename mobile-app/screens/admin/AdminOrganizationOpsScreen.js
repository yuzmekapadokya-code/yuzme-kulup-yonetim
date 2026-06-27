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
  saveCustomEducationModels,
  saveTrainer,
} from '../../services/adminService';
import { slugifyEducationModelName } from '../../utils/clubProfileHelpers';
import { useAuthStore } from '../../store/authStore';

function initialBranchForm(models = []) {
  const lessonTypes = {};
  const perTrainerCapacity = {};
  (models || []).forEach((model) => {
    lessonTypes[model.id] = model.id === 'group';
    perTrainerCapacity[model.id] = String(model.defaultPerTrainerCapacity || (model.id === 'private' ? 1 : 8));
  });
  if (!Object.keys(lessonTypes).length) {
    lessonTypes.group = true;
    lessonTypes.private = false;
    perTrainerCapacity.group = '8';
    perTrainerCapacity.private = '1';
  }
  return {
    id: null,
    name: '',
    address: '',
    phone: '',
    lessonTypes,
    perTrainerCapacity,
  };
}

function initialEducationModelForm() {
  return { name: '', defaultPerTrainerCapacity: '8' };
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
  const [educationModelForm, setEducationModelForm] = useState(initialEducationModelForm());

  useEffect(() => {
    if (overviewQuery.data?.educationModels) {
      setBranchForm((current) => (current.id ? current : initialBranchForm(overviewQuery.data.educationModels)));
    }
  }, [overviewQuery.data?.educationModels]);

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
    mutationFn: () => saveBranch({
      adminId: profile.uid,
      branchId: branchForm.id,
      values: branchForm,
      currentAdminId: profile.uid,
      educationModels: overviewQuery.data?.educationModels || [],
    }),
    onSuccess: () => {
      setBranchForm(initialBranchForm(overviewQuery.data?.educationModels || []));
      invalidate();
    },
    onError: (error) => Alert.alert('Sube', error.message || 'Sube kaydedilemedi.'),
  });
  const deleteBranchMutation = useMutation({ mutationFn: deleteBranch, onSuccess: invalidate, onError: (error) => Alert.alert('Sube silme', error.message || 'Sube silinemedi.') });

  const educationModelMutation = useMutation({
    mutationFn: (nextCustomModels) => saveCustomEducationModels({
      adminId: profile.uid,
      customModels: nextCustomModels,
      currentAdminId: profile.uid,
    }),
    onSuccess: () => {
      setEducationModelForm(initialEducationModelForm());
      invalidate();
    },
    onError: (error) => Alert.alert('Egitim modeli', error.message || 'Kaydedilemedi.'),
  });

  function addEducationModel() {
    const name = String(educationModelForm.name || '').trim();
    if (!name) {
      Alert.alert('Egitim modeli', 'Lutfen model adi girin.');
      return;
    }
    const slug = slugifyEducationModelName(name);
    if (!slug) {
      Alert.alert('Egitim modeli', 'Lutfen daha aciklayici bir ad secin.');
      return;
    }
    const existing = overviewQuery.data?.educationModels || [];
    if (existing.some((item) => item.name.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'))) {
      Alert.alert('Egitim modeli', 'Bu isimde bir model zaten var.');
      return;
    }
    const newModel = {
      id: `em_${slug}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      defaultPerTrainerCapacity: Math.max(1, Math.min(50, Number(educationModelForm.defaultPerTrainerCapacity) || 8)),
      builtIn: false,
      removable: true,
    };
    const nextCustom = [...existing.filter((item) => !item.builtIn), newModel];
    educationModelMutation.mutate(nextCustom);
  }

  function removeEducationModel(modelId) {
    const existing = overviewQuery.data?.educationModels || [];
    const target = existing.find((item) => item.id === modelId);
    if (!target || target.builtIn) {
      Alert.alert('Egitim modeli', 'Sistem modelleri silinemez.');
      return;
    }
    const nextCustom = existing.filter((item) => !item.builtIn && item.id !== modelId);
    educationModelMutation.mutate(nextCustom);
  }

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

        <SectionHeader title="Egitim Modelleri" caption="Sube ders turlerini ozellestirin" />
        <View style={styles.card}>
          <Text style={styles.label}>Yeni model ekle</Text>
          <TextInput
            style={styles.input}
            placeholder="Orn: DP Grup Dersi"
            value={educationModelForm.name}
            onChangeText={(text) => setEducationModelForm((current) => ({ ...current, name: text }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Varsayilan kontenjan / antrenor (orn: 8)"
            keyboardType="numeric"
            value={String(educationModelForm.defaultPerTrainerCapacity || '')}
            onChangeText={(text) => setEducationModelForm((current) => ({ ...current, defaultPerTrainerCapacity: text }))}
          />
          <ActionButton
            label={educationModelMutation.isPending ? 'Ekleniyor...' : 'Yeni Egitim Modeli Ekle'}
            onPress={addEducationModel}
            fullWidth
          />

          {(data.educationModels || []).map((model) => (
            <View key={model.id} style={styles.itemCard}>
              <Text style={styles.itemTitle}>{model.name}</Text>
              <Text style={styles.itemText}>
                Varsayilan kontenjan: {model.defaultPerTrainerCapacity || 8} ogr./antrenor
              </Text>
              <Text style={[styles.itemText, { color: model.builtIn ? theme.colors.muted : theme.colors.primary }]}>
                {model.builtIn ? 'Sistem modeli (silinemez)' : 'Ozel model'}
              </Text>
              {!model.builtIn ? (
                <View style={styles.buttonRow}>
                  <ActionButton label="Sil" variant="secondary" onPress={() => removeEducationModel(model.id)} />
                </View>
              ) : null}
            </View>
          ))}
        </View>

        <SectionHeader title="Subeler" caption="Kulubun operasyon merkezleri" />
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Sube adi" value={branchForm.name} onChangeText={(text) => setBranchForm((current) => ({ ...current, name: text }))} />
          <TextInput style={[styles.input, styles.textarea]} placeholder="Adres" multiline value={branchForm.address} onChangeText={(text) => setBranchForm((current) => ({ ...current, address: text }))} />
          <TextInput style={styles.input} placeholder="Telefon" value={branchForm.phone} onChangeText={(text) => setBranchForm((current) => ({ ...current, phone: text }))} />

          <Text style={styles.label}>Bu subede yapilan ders turleri</Text>
          <View style={styles.chipRow}>
            {(data.educationModels || []).map((model) => {
              const isOn = Boolean(branchForm.lessonTypes?.[model.id]);
              return (
                <ActionButton
                  key={model.id}
                  label={isOn ? `✓ ${model.name}` : model.name}
                  variant={isOn ? 'primary' : 'secondary'}
                  onPress={() =>
                    setBranchForm((current) => ({
                      ...current,
                      lessonTypes: { ...current.lessonTypes, [model.id]: !current.lessonTypes?.[model.id] },
                      perTrainerCapacity: {
                        ...current.perTrainerCapacity,
                        [model.id]: current.perTrainerCapacity?.[model.id] ?? String(model.defaultPerTrainerCapacity || 8),
                      },
                    }))
                  }
                />
              );
            })}
          </View>

          {(data.educationModels || [])
            .filter((model) => branchForm.lessonTypes?.[model.id])
            .map((model) => (
              <View key={`quota-${model.id}`}>
                <Text style={styles.label}>{model.name} — antrenor basina kontenjan</Text>
                <TextInput
                  style={styles.input}
                  placeholder={`Orn: ${model.defaultPerTrainerCapacity || 8}`}
                  keyboardType="numeric"
                  value={String(branchForm.perTrainerCapacity?.[model.id] ?? '')}
                  onChangeText={(text) =>
                    setBranchForm((current) => ({
                      ...current,
                      perTrainerCapacity: { ...current.perTrainerCapacity, [model.id]: text },
                    }))
                  }
                />
              </View>
            ))}

          <ActionButton label={branchMutation.isPending ? 'Kaydediliyor...' : branchForm.id ? 'Subeyi Guncelle' : 'Sube Ekle'} onPress={() => branchMutation.mutate()} fullWidth />
          {data.branches.map((branch) => {
            const models = data.educationModels || [];
            const summaryParts = models
              .filter((model) => Boolean(branch?.lessonTypes?.[model.id]))
              .map((model) => {
                const quota = Number(branch?.perTrainerCapacity?.[model.id]) > 0
                  ? Math.floor(branch.perTrainerCapacity[model.id])
                  : (Number(model.defaultPerTrainerCapacity) || 8);
                return `${model.name} (${quota} ogr./antrenor)`;
              });
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
                    onPress={() => {
                      const lessonTypes = {};
                      const perTrainerCapacity = {};
                      models.forEach((model) => {
                        lessonTypes[model.id] = Boolean(branch?.lessonTypes?.[model.id]);
                        const quotaRaw = Number(branch?.perTrainerCapacity?.[model.id]);
                        perTrainerCapacity[model.id] = quotaRaw > 0
                          ? String(Math.floor(quotaRaw))
                          : String(Number(model.defaultPerTrainerCapacity) || 8);
                      });
                      setBranchForm({
                        id: branch.id,
                        name: branch.name || '',
                        address: branch.address || '',
                        phone: branch.phone || '',
                        lessonTypes,
                        perTrainerCapacity,
                      });
                    }}
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