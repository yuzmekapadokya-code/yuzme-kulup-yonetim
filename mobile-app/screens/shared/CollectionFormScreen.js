import NetInfo from '@react-native-community/netinfo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import ScreenLayout from '../../components/ScreenLayout';
import { theme } from '../../config/theme';
import { enqueueOfflineJob } from '../../services/offlineSyncService';
import { getFeatureSupportData, saveFeatureItem } from '../../services/resourceService';
import { useAuthStore } from '../../store/authStore';
import { getFeatureConfig } from '../../utils/roleScreens';
import { queryKeys } from '../../utils/queryKeys';

function buildInitialValues(feature, item) {
  const values = {};
  feature.fields.forEach((field) => {
    if (field.type === 'boolean') {
      values[field.key] = Boolean(item?.[field.key]);
    } else if (field.type === 'multiselect') {
      values[field.key] = item?.[field.key] || [];
    } else {
      values[field.key] = item?.[field.key] ?? '';
    }
  });
  return values;
}

export default function CollectionFormScreen({ navigation, route }) {
  const { featureKey, item } = route.params;
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();
  const feature = getFeatureConfig(featureKey);

  const supportQuery = useQuery({
    queryKey: queryKeys.featureSupport(featureKey, profile.uid),
    queryFn: () => getFeatureSupportData(featureKey, profile),
  });

  const [values, setValues] = useState(() => buildInitialValues(feature, item));

  const mutation = useMutation({
    mutationFn: (payload) => saveFeatureItem(featureKey, payload, profile, item || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.featureItems(featureKey, profile.uid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(profile.role, profile.uid) });
      navigation.goBack();
    },
  });

  const optionMap = useMemo(() => supportQuery.data || {}, [supportQuery.data]);

  function setFieldValue(key, nextValue) {
    setValues((current) => ({ ...current, [key]: nextValue }));
  }

  async function handleSave() {
    try {
      const state = await NetInfo.fetch();
      if (!state.isConnected) {
        await enqueueOfflineJob({ type: 'save', featureKey, values, profile, item: item || null });
        Alert.alert('Kuyruga alindi', 'Baglanti geldiginde kayit otomatik gonderilecek.');
        navigation.goBack();
        return;
      }

      mutation.mutate(values);
    } catch (error) {
      Alert.alert('Kaydedilemedi', error.message || 'Islem tamamlanamadi.');
    }
  }

  function renderSelect(field, multiple = false) {
    const sourceOptions = field.optionsSource
      ? optionMap[field.optionsSource] || []
      : (field.options || []).map((value) => ({ id: value, name: value, title: value }));

    return (
      <View style={styles.optionWrap}>
        {sourceOptions.map((option) => {
          const optionValue = option.id || option.value || option;
          const optionLabel = option.name || option.title || option.time || option.email || optionValue;
          const selected = multiple
            ? Array.isArray(values[field.key]) && values[field.key].includes(optionValue)
            : values[field.key] === optionValue;

          return (
            <Pressable
              key={optionValue}
              style={[styles.optionChip, selected && styles.optionChipSelected]}
              onPress={() => {
                if (multiple) {
                  const current = Array.isArray(values[field.key]) ? values[field.key] : [];
                  const next = current.includes(optionValue)
                    ? current.filter((entry) => entry !== optionValue)
                    : [...current, optionValue];
                  setFieldValue(field.key, next);
                  return;
                }

                setFieldValue(field.key, optionValue);
              }}
            >
              <Text style={selected ? styles.optionLabelSelected : styles.optionLabel}>{optionLabel}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <ScreenLayout
      title={item ? `${feature.title} Duzenle` : `${feature.title} Yeni Kayit`}
      subtitle={featureKey === 'products' ? 'Urun bilgilerini sade ve vitrin odakli bir sunumla guncelleyin.' : 'Alanlar veri modeline gore otomatik olusturuldu.'}
      scroll={false}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {feature.fields.length === 0 ? (
          <Text style={styles.noFormText}>Bu ekran su an listeleme amacli kullaniliyor.</Text>
        ) : null}
        {feature.fields.map((field) => {
          if (field.createOnly && item) {
            return null;
          }

          return (
            <View key={field.key} style={styles.fieldWrap}>
              <Text style={styles.label}>{field.label}</Text>
              {field.type === 'textarea' ? (
                <TextInput
                  style={[styles.input, styles.textarea]}
                  multiline
                  value={String(values[field.key] ?? '')}
                  onChangeText={(text) => setFieldValue(field.key, text)}
                />
              ) : null}
              {field.type === 'text' || field.type === 'number' || field.type === 'date' ? (
                <TextInput
                  style={styles.input}
                  value={String(values[field.key] ?? '')}
                  keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                  onChangeText={(text) => setFieldValue(field.key, text)}
                />
              ) : null}
              {field.type === 'select' ? renderSelect(field, false) : null}
              {field.type === 'multiselect' ? renderSelect(field, true) : null}
              {field.type === 'boolean' ? (
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>{values[field.key] ? 'Acik' : 'Kapali'}</Text>
                  <Switch value={Boolean(values[field.key])} onValueChange={(next) => setFieldValue(field.key, next)} />
                </View>
              ) : null}
            </View>
          );
        })}
        <ActionButton
          label={mutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
          onPress={handleSave}
          fullWidth
        />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    gap: 14,
  },
  fieldWrap: {
    gap: 8,
  },
  label: {
    fontWeight: '700',
    color: theme.colors.text,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  textarea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: theme.colors.surface,
  },
  optionChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  optionLabel: {
    color: theme.colors.text,
  },
  optionLabelSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  switchLabel: {
    color: theme.colors.textMuted,
  },
  noFormText: {
    color: theme.colors.textMuted,
  },
});