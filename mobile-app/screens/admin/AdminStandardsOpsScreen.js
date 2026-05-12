import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import { theme } from '../../config/theme';
import { deleteAdminStandard, getAdminStandardsOverview, saveAdminStandard } from '../../services/adminService';
import { useAuthStore } from '../../store/authStore';

function initialStandard() {
  return { id: null, name: '', birthYear: '', gender: 'Erkek', style: 'Serbest', distance: '50', time: '' };
}

export default function AdminStandardsOpsScreen() {
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();
  const [expandedGroupKey, setExpandedGroupKey] = useState('');
  const [standardValues, setStandardValues] = useState(initialStandard());

  const standardsQuery = useQuery({
    queryKey: ['ad-standards', profile?.uid],
    queryFn: () => getAdminStandardsOverview(profile.uid),
    enabled: Boolean(profile?.uid),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['ad-standards', profile.uid] });
  }

  const saveMutation = useMutation({
    mutationFn: () => saveAdminStandard({ adminId: profile.uid, standardId: standardValues.id, values: standardValues, currentAdminId: profile.uid }),
    onSuccess: () => {
      setStandardValues(initialStandard());
      invalidate();
    },
    onError: (error) => Alert.alert('Baraj', error.message || 'Baraj kaydedilemedi.'),
  });

  const deleteMutation = useMutation({ mutationFn: deleteAdminStandard, onSuccess: invalidate });

  if (standardsQuery.isLoading) {
    return <LoadingBlock label="Barajlar yukleniyor..." />;
  }

  if (standardsQuery.isError) {
    return (
      <ScreenLayout title="Barajlar" subtitle="Baraj verileri alinirken hata olustu.">
        <EmptyState title="Barajlar acilamadi" description={standardsQuery.error?.message || 'Baraj listesi okunurken hata olustu.'} />
      </ScreenLayout>
    );
  }

  const data = standardsQuery.data;

  return (
    <ScreenLayout title="Barajlar" subtitle="Yaris ve baraj kayitlari isim bazli gruplar halinde listelenir.">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.stack}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>YARIS VE BARAJ</Text>
          <Text style={styles.heroTitle}>Isim bazli grup gorunumu</Text>
          <Text style={styles.heroText}>Web panelindeki gibi once yarisi gor, sonra detaya tiklayinca o gruba ait tum barajlari ac.</Text>
        </View>

        <SectionHeader title="Baraj kaydi" caption="Kulube ozel baraj ekle veya duzenle" />
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Baraj adi" value={standardValues.name} onChangeText={(text) => setStandardValues((current) => ({ ...current, name: text }))} />
          <TextInput style={styles.input} placeholder="Dogum yili" keyboardType="numeric" value={standardValues.birthYear} onChangeText={(text) => setStandardValues((current) => ({ ...current, birthYear: text }))} />
          <TextInput style={styles.input} placeholder="Cinsiyet" value={standardValues.gender} onChangeText={(text) => setStandardValues((current) => ({ ...current, gender: text }))} />
          <TextInput style={styles.input} placeholder="Stil" value={standardValues.style} onChangeText={(text) => setStandardValues((current) => ({ ...current, style: text }))} />
          <TextInput style={styles.input} placeholder="Mesafe" keyboardType="numeric" value={standardValues.distance} onChangeText={(text) => setStandardValues((current) => ({ ...current, distance: text }))} />
          <TextInput style={styles.input} placeholder="Sure" value={standardValues.time} onChangeText={(text) => setStandardValues((current) => ({ ...current, time: text }))} />
          <ActionButton label={saveMutation.isPending ? 'Kaydediliyor...' : standardValues.id ? 'Baraji Guncelle' : 'Baraj Ekle'} onPress={() => saveMutation.mutate()} fullWidth />
        </View>

        <SectionHeader title="Gruplanmis barajlar" caption="Bir yarisa dokun, tum alt barajlari goster" />
        <View style={styles.stack}>
          {!data.groups.length ? (
            <EmptyState title="Baraj yok" description="Goruntulenecek baraj bulunmuyor." />
          ) : (
            data.groups.map((group) => {
              const expanded = expandedGroupKey === group.key;
              return (
                <View key={group.key} style={styles.groupCard}>
                  <Pressable onPress={() => setExpandedGroupKey(expanded ? '' : group.key)} style={({ pressed }) => [styles.groupHeader, pressed && styles.pressed]}>
                    <View style={styles.groupHeaderText}>
                      <Text style={styles.groupTitle}>{expanded ? '▼' : '▶'} {group.title}</Text>
                      <Text style={styles.groupMeta}>{group.meta} | {group.items.length} kayit</Text>
                    </View>
                    <Text style={styles.groupHint}>{expanded ? 'Detayi gizle' : 'Detayi ac'}</Text>
                  </Pressable>

                  {expanded ? (
                    <View style={styles.groupItems}>
                      {group.items.map((item) => (
                        <View key={item.id} style={styles.itemCard}>
                          <Text style={styles.itemTitle}>{item.style} {item.distance}m</Text>
                          <Text style={styles.itemText}>{item.birthYear} | {item.gender} | {item.time}</Text>
                          <Text style={styles.itemText}>{item.scopeType === 'global' ? 'Super Admin Baraji' : item.scopeType === 'admin' ? 'Kulup Baraji' : 'Antrenor Kaydi'}</Text>
                          {item.editable ? (
                            <View style={styles.buttonRow}>
                              <ActionButton label="Duzenle" variant="secondary" onPress={() => setStandardValues({ id: item.id, name: item.name || '', birthYear: String(item.birthYear || ''), gender: item.gender || 'Erkek', style: item.style || 'Serbest', distance: String(item.distance || '50'), time: item.time || '' })} />
                              <ActionButton label="Sil" variant="secondary" onPress={() => deleteMutation.mutate(item.id)} />
                            </View>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })
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
  heroCard: {
    backgroundColor: '#fff4df',
    borderColor: '#f3ddb1',
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: 8,
  },
  heroEyebrow: {
    color: '#8b5a00',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#7a4c00',
    fontSize: 22,
    fontWeight: '800',
  },
  heroText: {
    color: theme.colors.textMuted,
    lineHeight: 20,
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
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: theme.colors.text,
    backgroundColor: '#ffffff',
  },
  groupCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    padding: theme.spacing.md,
    backgroundColor: '#f9fbfd',
  },
  groupHeaderText: {
    flex: 1,
    gap: 4,
  },
  groupTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
  groupMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  groupHint: {
    color: theme.colors.primaryDeep,
    fontWeight: '700',
    fontSize: 12,
  },
  groupItems: {
    gap: 10,
    padding: theme.spacing.md,
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
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  pressed: {
    opacity: 0.88,
  },
});