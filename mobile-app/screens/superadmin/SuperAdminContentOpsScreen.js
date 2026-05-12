import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import { theme } from '../../config/theme';
import {
  activateHomepageAdvertisement,
  clearHomepageAdvertisement,
  deleteAdvertisement,
  deleteProduct,
  deleteStandard,
  listAdvertisementsOverview,
  listProductsOverview,
  listRaceImportOverview,
  listStandardsOverview,
  saveAdvertisement,
  saveProduct,
  saveStandard,
} from '../../services/superAdminService';
import { useAuthStore } from '../../store/authStore';

const standardStyleOptions = ['Serbest', 'Kurbagalama', 'Sirtustu', 'Kelebekce', 'Karma'];
const genderOptions = ['Erkek', 'Kiz'];

function defaultProduct() {
  return { id: null, name: '', price: '', creditCost: '', description: '', imageUrl: '' };
}

function defaultAdvertisement() {
  return { id: null, title: '', description: '', link: '', imageUrl: '', videoUrl: '' };
}

function defaultStandard() {
  return { id: null, name: '', birthYear: '', gender: 'Erkek', style: 'Serbest', distance: '50', time: '' };
}

export default function SuperAdminContentOpsScreen() {
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();

  const productsQuery = useQuery({ queryKey: ['sa-products'], queryFn: listProductsOverview });
  const advertisementsQuery = useQuery({ queryKey: ['sa-advertisements'], queryFn: listAdvertisementsOverview });
  const standardsQuery = useQuery({ queryKey: ['sa-standards'], queryFn: listStandardsOverview });
  const raceQuery = useQuery({ queryKey: ['sa-race-imports'], queryFn: listRaceImportOverview });

  const [productForm, setProductForm] = useState(defaultProduct());
  const [adForm, setAdForm] = useState(defaultAdvertisement());
  const [standardForm, setStandardForm] = useState(defaultStandard());
  const [standardFilter, setStandardFilter] = useState({ name: '', gender: '', style: '', distance: '', birthYear: '' });

  function invalidateContent() {
    queryClient.invalidateQueries({ queryKey: ['sa-products'] });
    queryClient.invalidateQueries({ queryKey: ['sa-advertisements'] });
    queryClient.invalidateQueries({ queryKey: ['sa-standards'] });
    queryClient.invalidateQueries({ queryKey: ['sa-race-imports'] });
    queryClient.invalidateQueries({ queryKey: ['sa-dashboard'] });
  }

  const productMutation = useMutation({
    mutationFn: () => saveProduct({ values: productForm, currentSuperAdminId: profile.uid, productId: productForm.id }),
    onSuccess: () => {
      setProductForm(defaultProduct());
      invalidateContent();
    },
  });

  const adMutation = useMutation({
    mutationFn: () => saveAdvertisement({ values: adForm, currentSuperAdminId: profile.uid, advertisementId: adForm.id }),
    onSuccess: () => {
      setAdForm(defaultAdvertisement());
      invalidateContent();
    },
  });

  const standardMutation = useMutation({
    mutationFn: () => saveStandard({ values: standardForm, currentSuperAdminId: profile.uid, standardId: standardForm.id }),
    onSuccess: () => {
      setStandardForm(defaultStandard());
      invalidateContent();
    },
  });

  const activateAdMutation = useMutation({
    mutationFn: (advertisementId) => activateHomepageAdvertisement({ advertisementId, currentSuperAdminId: profile.uid }),
    onSuccess: invalidateContent,
  });

  const clearActiveAdMutation = useMutation({ mutationFn: clearHomepageAdvertisement, onSuccess: invalidateContent });
  const deleteProductMutation = useMutation({ mutationFn: deleteProduct, onSuccess: invalidateContent });
  const deleteAdMutation = useMutation({ mutationFn: deleteAdvertisement, onSuccess: invalidateContent });
  const deleteStandardMutation = useMutation({ mutationFn: deleteStandard, onSuccess: invalidateContent });

  const filteredStandards = useMemo(() => {
    const all = standardsQuery.data || [];
    return all.filter((item) => {
      const nameMatch = !standardFilter.name || String(item.name || '').toLowerCase().includes(standardFilter.name.toLowerCase());
      const genderMatch = !standardFilter.gender || item.gender === standardFilter.gender;
      const styleMatch = !standardFilter.style || item.style === standardFilter.style;
      const distanceMatch = !standardFilter.distance || String(item.distance) === standardFilter.distance;
      const yearMatch = !standardFilter.birthYear || String(item.birthYear) === standardFilter.birthYear;
      return nameMatch && genderMatch && styleMatch && distanceMatch && yearMatch;
    });
  }, [standardsQuery.data, standardFilter]);

  const isLoading = [productsQuery, advertisementsQuery, standardsQuery, raceQuery].some((entry) => entry.isLoading);
  if (isLoading) {
    return <LoadingBlock label="Icerik operasyonlari yukleniyor..." />;
  }

  return (
    <ScreenLayout title="Icerik Operasyonlari" subtitle="Market katalogu, aktif reklamlar, baraj listeleri ve yaris import izleme.">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.stack}>
        <SectionHeader title="Market urunleri" caption="Web market katalogunun mobil yonetimi" />
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Urun adi" value={productForm.name} onChangeText={(text) => setProductForm((current) => ({ ...current, name: text }))} />
          <TextInput style={styles.input} placeholder="Fiyat" keyboardType="numeric" value={productForm.price} onChangeText={(text) => setProductForm((current) => ({ ...current, price: text }))} />
          <TextInput style={styles.input} placeholder="Kredi maliyeti" keyboardType="numeric" value={productForm.creditCost} onChangeText={(text) => setProductForm((current) => ({ ...current, creditCost: text }))} />
          <TextInput style={[styles.input, styles.textarea]} multiline placeholder="Aciklama" value={productForm.description} onChangeText={(text) => setProductForm((current) => ({ ...current, description: text }))} />
          <ActionButton
            label={productForm.imageUrl ? 'Urun gorselini degistir' : 'Dosyalardan urun gorseli sec'}
            variant="secondary"
            onPress={async () => {
              try {
                const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!permission.granted) {
                  Alert.alert('Izin gerekli', 'Urun gorseli secmek icin galeri izni vermelisiniz.');
                  return;
                }
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  quality: 0.7,
                  base64: true,
                });
                if (result.canceled || !result.assets?.length) {
                  return;
                }
                const asset = result.assets[0];
                if (!asset.base64) {
                  Alert.alert('Gorsel okunamadi', 'Secilen dosya islenemedi.');
                  return;
                }
                setProductForm((current) => ({
                  ...current,
                  imageUrl: `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`,
                }));
              } catch (error) {
                Alert.alert('Gorsel secilemedi', error.message || 'Dosya secilirken hata olustu.');
              }
            }}
            fullWidth
          />
          {productForm.imageUrl ? (
            <View style={styles.imagePreviewCard}>
              <Image source={{ uri: productForm.imageUrl }} style={styles.imagePreview} resizeMode="cover" />
              <ActionButton label="Gorseli kaldir" variant="secondary" onPress={() => setProductForm((current) => ({ ...current, imageUrl: '' }))} />
            </View>
          ) : null}
          <ActionButton label={productMutation.isPending ? 'Kaydediliyor...' : productForm.id ? 'Urunu Guncelle' : 'Urun Ekle'} onPress={() => productMutation.mutate()} fullWidth />
          {productsQuery.data.map((product) => (
            <View key={product.id} style={styles.cardCompact}>
              <Text style={styles.cardTitle}>{product.name}</Text>
              <Text style={styles.cardText}>₺{product.price} | {product.creditCost || 0} kredi</Text>
              <Text style={styles.cardText}>{product.description || 'Aciklama yok'}</Text>
              <View style={styles.buttonRow}>
                <ActionButton
                  label="Duzenle"
                  variant="secondary"
                  onPress={() =>
                    setProductForm({
                      id: product.id,
                      name: product.name || '',
                      price: String(product.price || ''),
                      creditCost: String(product.creditCost || ''),
                      description: product.description || '',
                      imageUrl: product.imageUrl || '',
                    })
                  }
                />
                <ActionButton label="Sil" variant="secondary" onPress={() => deleteProductMutation.mutate(product.id)} />
              </View>
            </View>
          ))}
        </View>

        <SectionHeader title="Reklam yonetimi" caption="Aktif reklam ve ana sayfa slotu" />
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Baslik" value={adForm.title} onChangeText={(text) => setAdForm((current) => ({ ...current, title: text }))} />
          <TextInput style={[styles.input, styles.textarea]} multiline placeholder="Aciklama" value={adForm.description} onChangeText={(text) => setAdForm((current) => ({ ...current, description: text }))} />
          <TextInput style={styles.input} placeholder="Hedef link" value={adForm.link} onChangeText={(text) => setAdForm((current) => ({ ...current, link: text }))} />
          <TextInput style={styles.input} placeholder="Gorsel URL" value={adForm.imageUrl} onChangeText={(text) => setAdForm((current) => ({ ...current, imageUrl: text }))} />
          <TextInput style={styles.input} placeholder="Video URL" value={adForm.videoUrl} onChangeText={(text) => setAdForm((current) => ({ ...current, videoUrl: text }))} />
          <ActionButton label={adMutation.isPending ? 'Kaydediliyor...' : adForm.id ? 'Reklami Guncelle' : 'Reklam Ekle'} onPress={() => adMutation.mutate()} fullWidth />
          {advertisementsQuery.data.activeHomepageAd ? (
            <View style={styles.activeBanner}>
              <Text style={styles.activeBannerTitle}>Aktif ana sayfa reklami</Text>
              <Text style={styles.cardText}>{advertisementsQuery.data.activeHomepageAd.title || 'Reklam'}</Text>
              <ActionButton label="Aktif reklami kaldir" variant="secondary" onPress={() => clearActiveAdMutation.mutate()} fullWidth />
            </View>
          ) : null}
          {advertisementsQuery.data.ads.map((ad) => (
            <View key={ad.id} style={styles.cardCompact}>
              <Text style={styles.cardTitle}>{ad.title}</Text>
              <Text style={styles.cardText}>{ad.description || 'Aciklama yok'}</Text>
              <Text style={styles.cardText}>{ad.active ? 'Ana sayfada aktif' : 'Pasif reklam'}</Text>
              <View style={styles.buttonRow}>
                <ActionButton
                  label="Duzenle"
                  variant="secondary"
                  onPress={() =>
                    setAdForm({
                      id: ad.id,
                      title: ad.title || '',
                      description: ad.description || '',
                      link: ad.link || '',
                      imageUrl: ad.imageUrl || '',
                      videoUrl: ad.videoUrl || '',
                    })
                  }
                />
                <ActionButton label="Ana sayfaya al" onPress={() => activateAdMutation.mutate(ad.id)} />
                <ActionButton label="Sil" variant="secondary" onPress={() => deleteAdMutation.mutate(ad.id)} />
              </View>
            </View>
          ))}
        </View>

        <SectionHeader title="Barajlar" caption="Filtreleme, ekleme ve duzenleme" />
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Filtre: baraj adi" value={standardFilter.name} onChangeText={(text) => setStandardFilter((current) => ({ ...current, name: text }))} />
          <TextInput style={styles.input} placeholder="Filtre: dogum yili" keyboardType="numeric" value={standardFilter.birthYear} onChangeText={(text) => setStandardFilter((current) => ({ ...current, birthYear: text }))} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {['', ...genderOptions].map((gender) => (
              <ActionButton key={gender || 'all-gender'} label={gender || 'Tum cinsiyetler'} variant={standardFilter.gender === gender ? 'primary' : 'secondary'} onPress={() => setStandardFilter((current) => ({ ...current, gender }))} />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {['', ...standardStyleOptions].map((style) => (
              <ActionButton key={style || 'all-style'} label={style || 'Tum stiller'} variant={standardFilter.style === style ? 'primary' : 'secondary'} onPress={() => setStandardFilter((current) => ({ ...current, style }))} />
            ))}
          </ScrollView>

          <TextInput style={styles.input} placeholder="Baraj adi" value={standardForm.name} onChangeText={(text) => setStandardForm((current) => ({ ...current, name: text }))} />
          <TextInput style={styles.input} placeholder="Dogum yili" keyboardType="numeric" value={standardForm.birthYear} onChangeText={(text) => setStandardForm((current) => ({ ...current, birthYear: text }))} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {genderOptions.map((gender) => (
              <ActionButton key={gender} label={gender} variant={standardForm.gender === gender ? 'primary' : 'secondary'} onPress={() => setStandardForm((current) => ({ ...current, gender }))} />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {standardStyleOptions.map((style) => (
              <ActionButton key={style} label={style} variant={standardForm.style === style ? 'primary' : 'secondary'} onPress={() => setStandardForm((current) => ({ ...current, style }))} />
            ))}
          </ScrollView>
          <TextInput style={styles.input} placeholder="Mesafe" keyboardType="numeric" value={standardForm.distance} onChangeText={(text) => setStandardForm((current) => ({ ...current, distance: text }))} />
          <TextInput style={styles.input} placeholder="Baraj suresi (00:28.50)" value={standardForm.time} onChangeText={(text) => setStandardForm((current) => ({ ...current, time: text }))} />
          <ActionButton label={standardMutation.isPending ? 'Kaydediliyor...' : standardForm.id ? 'Baraji Guncelle' : 'Baraj Ekle'} onPress={() => standardMutation.mutate()} fullWidth />
          {!filteredStandards.length ? (
            <EmptyState title="Filtreye uygun baraj yok" description="Filtreleri temizleyin veya yeni kayit ekleyin." />
          ) : (
            filteredStandards.slice(0, 60).map((standard) => (
              <View key={standard.id} style={styles.cardCompact}>
                <Text style={styles.cardTitle}>{standard.name}</Text>
                <Text style={styles.cardText}>{standard.birthYear} | {standard.gender} | {standard.style} | {standard.distance}m</Text>
                <Text style={styles.cardText}>Sure: {standard.time}</Text>
                <View style={styles.buttonRow}>
                  <ActionButton
                    label="Duzenle"
                    variant="secondary"
                    onPress={() =>
                      setStandardForm({
                        id: standard.id,
                        name: standard.name || '',
                        birthYear: String(standard.birthYear || ''),
                        gender: standard.gender || 'Erkek',
                        style: standard.style || 'Serbest',
                        distance: String(standard.distance || '50'),
                        time: standard.time || '',
                      })
                    }
                  />
                  <ActionButton label="Sil" variant="secondary" onPress={() => deleteStandardMutation.mutate(standard.id)} />
                </View>
              </View>
            ))
          )}
        </View>

        <SectionHeader title="Yaris sonucu import izleme" caption="PDF analizinden sonra olusan import ve performans kayitlari" />
        <View style={styles.card}>
          {!raceQuery.data.imports.length ? (
            <EmptyState title="Import kaydi yok" description="Henuz race_result_imports koleksiyonunda veri bulunmuyor." />
          ) : (
            raceQuery.data.imports.slice(0, 10).map((item) => (
              <View key={item.id} style={styles.cardCompact}>
                <Text style={styles.cardTitle}>{item.fileName || item.id}</Text>
                <Text style={styles.cardText}>Eslesen: {item.matchedCount || 0} | Eslesmeyen: {item.unmatchedCount || 0}</Text>
                <Text style={styles.cardText}>{item.createdAt || '-'}</Text>
              </View>
            ))
          )}
          <SectionHeader title="Son performans kayitlari" />
          {raceQuery.data.latestPerformances.slice(0, 12).map((performance) => (
            <View key={performance.id} style={styles.cardCompact}>
              <Text style={styles.cardTitle}>{performance.studentName || performance.studentId || 'Sporcu'}</Text>
              <Text style={styles.cardText}>{performance.style || '-'} | {performance.distance || '-'}m | {performance.timing || performance.time || '-'}</Text>
              <Text style={styles.cardText}>{performance.eventDate || performance.createdAt || '-'}</Text>
            </View>
          ))}
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
  cardCompact: {
    backgroundColor: '#fbfdff',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 4,
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
  chipRow: {
    gap: 8,
    paddingRight: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  cardText: {
    color: theme.colors.textMuted,
  },
  activeBanner: {
    backgroundColor: '#edf7ff',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 6,
  },
  activeBannerTitle: {
    color: theme.colors.primaryDeep,
    fontWeight: '800',
  },
  imagePreviewCard: {
    gap: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: '#fbfdff',
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#eef3f8',
  },
});