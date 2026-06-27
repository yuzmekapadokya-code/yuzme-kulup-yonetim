import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import ActionButton from '../../components/ActionButton';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import { theme } from '../../config/theme';
import {
  buildPreRegistrationShareText,
  ensurePreRegistrationLink,
  getPreRegistrationCustomizeData,
  savePreRegistrationCustomizeData,
} from '../../services/preRegistrationService';
import { getAdminScope } from '../../services/roleService';
import { useAuthStore } from '../../store/authStore';

function initialCustomizeForm(settings = {}) {
  return {
    eyebrowText: settings.eyebrowText || 'Ön kayıt formu',
    title: settings.title || '',
    description: settings.description || '',
    accentColor: settings.accentColor || '#0b7ea8',
    videoUrl: settings.videoUrl || '',
    logoUrl: settings.logoUrl || '',
  };
}

export default function SecretaryPreRegistrationOpsScreen() {
  const profile = useAuthStore((state) => state.profile);
  const adminId = getAdminScope(profile);
  const queryClient = useQueryClient();

  const linkQuery = useQuery({
    queryKey: ['sec-pre-reg-link', adminId],
    queryFn: () => ensurePreRegistrationLink(adminId),
    enabled: Boolean(adminId),
  });

  const customizeQuery = useQuery({
    queryKey: ['sec-pre-reg-customize', adminId],
    queryFn: () => getPreRegistrationCustomizeData(adminId),
    enabled: Boolean(adminId),
  });

  const [customizeForm, setCustomizeForm] = useState(initialCustomizeForm());

  useEffect(() => {
    if (customizeQuery.data?.settings) {
      setCustomizeForm(initialCustomizeForm({
        ...customizeQuery.data.settings,
        logoUrl: customizeQuery.data.settings.logoUrl || customizeQuery.data.fallbackLogoUrl || '',
      }));
    }
  }, [customizeQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => savePreRegistrationCustomizeData(adminId, customizeForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sec-pre-reg-customize', adminId] });
      queryClient.invalidateQueries({ queryKey: ['sec-pre-reg-link', adminId] });
      Alert.alert('Ön kayıt', 'Sayfa görünümü kaydedildi.');
    },
    onError: (error) => Alert.alert('Ön kayıt', error.message || 'Kaydedilemedi.'),
  });

  async function shareLink() {
    const link = linkQuery.data?.link;
    if (!link) return;
    await Share.share({
      message: linkQuery.data?.shareText || buildPreRegistrationShareText(linkQuery.data?.clubName, link),
    });
  }

  async function pickLogo() {
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
    setCustomizeForm((current) => ({ ...current, logoUrl: dataUrl }));
  }

  if (linkQuery.isLoading || customizeQuery.isLoading) {
    return <LoadingBlock label="Ön kayıt modülü yükleniyor..." />;
  }

  const linkData = linkQuery.data;

  return (
    <ScreenLayout title="Ön Kayıt Linki" subtitle="Her kulüp için tek kalıcı bağlantı. Veliler bu formu doldurunca başvurular sekreter listesine düşer.">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.stack}>
        <SectionHeader title="Kalıcı link" caption="Yeni link üretme yok — aynı bağlantıyı paylaşın" />
        <View style={styles.card}>
          <Text style={styles.linkText} selectable>{linkData?.link || 'Link hazırlanıyor...'}</Text>
          <View style={styles.buttonRow}>
            <ActionButton label="Paylaş" onPress={shareLink} />
            <ActionButton label="Formu Aç" variant="secondary" onPress={() => linkData?.link && Linking.openURL(linkData.link)} />
          </View>
          <Text style={styles.helper}>Kulüp: {linkData?.clubName || '-'}</Text>
        </View>

        <SectionHeader title="Sayfa görünümü" caption="Logo, video ve metinleri özelleştirin" />
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Üst etiket" value={customizeForm.eyebrowText} onChangeText={(text) => setCustomizeForm((c) => ({ ...c, eyebrowText: text }))} />
          <TextInput style={styles.input} placeholder="Başlık (boşsa kulüp adı)" value={customizeForm.title} onChangeText={(text) => setCustomizeForm((c) => ({ ...c, title: text }))} />
          <TextInput style={[styles.input, styles.textarea]} placeholder="Açıklama" multiline value={customizeForm.description} onChangeText={(text) => setCustomizeForm((c) => ({ ...c, description: text }))} />
          <TextInput style={styles.input} placeholder="Tema rengi (#0b7ea8)" value={customizeForm.accentColor} onChangeText={(text) => setCustomizeForm((c) => ({ ...c, accentColor: text }))} />
          <TextInput style={styles.input} placeholder="YouTube / Vimeo linki" value={customizeForm.videoUrl} onChangeText={(text) => setCustomizeForm((c) => ({ ...c, videoUrl: text }))} autoCapitalize="none" />
          <ActionButton label="Galeriden Logo Seç" variant="secondary" onPress={pickLogo} fullWidth />
          {customizeForm.logoUrl ? <Text style={styles.helper}>Logo seçildi.</Text> : null}
          <ActionButton label={saveMutation.isPending ? 'Kaydediliyor...' : 'Görünümü Kaydet'} onPress={() => saveMutation.mutate()} fullWidth />
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16, paddingBottom: 32 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  linkText: { fontSize: 13, color: theme.colors.text, lineHeight: 20 },
  helper: { fontSize: 12, color: theme.colors.muted },
});
