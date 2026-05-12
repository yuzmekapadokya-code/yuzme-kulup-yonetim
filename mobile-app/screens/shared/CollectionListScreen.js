import NetInfo from '@react-native-community/netinfo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import { theme } from '../../config/theme';
import { createOrderForProduct, deleteFeatureItem, getFeatureItems, getFeatureSupportData } from '../../services/resourceService';
import { useAuthStore } from '../../store/authStore';
import { canCreateFeature, canDeleteFeature, canEditFeature, getFeatureConfig } from '../../utils/roleScreens';
import { queryKeys } from '../../utils/queryKeys';

export default function CollectionListScreen({ navigation, route }) {
  const { featureKey } = route.params;
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();
  const feature = getFeatureConfig(featureKey);

  const itemsQuery = useQuery({
    queryKey: queryKeys.featureItems(featureKey, profile.uid),
    queryFn: () => getFeatureItems(featureKey, profile),
  });

  useQuery({
    queryKey: queryKeys.featureSupport(featureKey, profile.uid),
    queryFn: () => getFeatureSupportData(featureKey, profile),
  });

  const deleteMutation = useMutation({
    mutationFn: (item) => deleteFeatureItem(featureKey, item, profile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.featureItems(featureKey, profile.uid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(profile.role, profile.uid) });
    },
  });

  const orderMutation = useMutation({
    mutationFn: (product) => createOrderForProduct(product, profile),
    onSuccess: () => {
      Alert.alert('Siparis alindi', 'Siparis kaydiniz basariyla olusturuldu.');
      queryClient.invalidateQueries({ queryKey: queryKeys.featureItems('orders', profile.uid) });
    },
  });

  if (itemsQuery.isLoading) {
    return <LoadingBlock label={`${feature.title} yukleniyor...`} />;
  }

  function handleDelete(item) {
    Alert.alert('Sil', 'Bu kaydi silmek istiyor musunuz?', [
      { text: 'Iptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(item),
      },
    ]);
  }

  async function handleOrder(product) {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      Alert.alert('Cevrimdisi', 'Siparis olusturmak icin internet baglantisi gerekli.');
      return;
    }
    orderMutation.mutate(product);
  }

  const isProductCatalog = featureKey === 'products';
  const isManagementMode = canEditFeature(feature, profile.role);

  return (
    <ScreenLayout
      title={feature.title}
      subtitle={isProductCatalog ? 'Sepet odakli vitrin, sade urun kartlari ve daha temiz satin alma akisi.' : 'Kayitlari inceleyin, filtreleyin ve rolunuze uygun islemleri mobilde yonetin.'}
      right={
        canCreateFeature(feature, profile.role) ? (
          <ActionButton
            label="Yeni"
            onPress={() => navigation.navigate('FeatureForm', { featureKey })}
            variant="primary"
          />
        ) : null
      }
    >
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={itemsQuery.isRefetching}
            onRefresh={() => itemsQuery.refetch()}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.list}>
          {isProductCatalog ? (
            <View style={styles.marketHero}>
              <View style={styles.marketHeroBadge}>
                <Ionicons name="bag-handle-outline" size={18} color="#ffffff" />
              </View>
              <View style={styles.marketHeroBody}>
                <Text style={styles.marketHeroTitle}>Daha net market akisi</Text>
                <Text style={styles.marketHeroText}>
                  Teknik alanlar yerine urun gorseli, fiyat, stok durumu ve hizli islem kartlari gosterilir.
                </Text>
              </View>
            </View>
          ) : null}
          {!itemsQuery.data?.length ? (
            <EmptyState title={`${feature.title} bos`} description="Uygun kayit bulunamadi." />
          ) : (
            itemsQuery.data.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [isProductCatalog ? styles.productCard : styles.card, pressed && styles.pressed]}
                onPress={() => {
                  if (canEditFeature(feature, profile.role)) {
                    navigation.navigate('FeatureForm', { featureKey, item });
                  }
                }}
              >
                {isProductCatalog ? (
                  <>
                    <View style={styles.productTopRow}>
                      <View style={styles.productImageWrap}>
                        {item.imageUrl ? (
                          <Image source={{ uri: item.imageUrl }} style={styles.productImage} resizeMode="cover" />
                        ) : (
                          <View style={styles.productFallback}>
                            <Ionicons name="image-outline" size={26} color={theme.colors.primaryDeep} />
                          </View>
                        )}
                      </View>
                      <View style={styles.productMain}>
                        <View style={styles.productHeaderRow}>
                          <Text style={styles.productTitle}>{item.name || item.productName || 'Urun'}</Text>
                          <View style={[styles.stockBadge, Number(item.stock || 0) > 0 ? styles.stockAvailable : styles.stockLimited]}>
                            <Text style={[styles.stockBadgeText, Number(item.stock || 0) > 0 ? styles.stockAvailableText : styles.stockLimitedText]}>
                              {Number(item.stock || 0) > 0 ? 'Hazir' : 'Sinirli'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.productDescription} numberOfLines={3}>
                          {item.description || 'Kulup kullanimi icin hazirlanan urun secenekleri tek kartta gosterilir.'}
                        </Text>
                        <View style={styles.productMetaRow}>
                          <Text style={styles.productPrice}>₺{Number(item.price || 0).toFixed(2)}</Text>
                          <Text style={styles.productMetaText}>
                            {Number.isFinite(Number(item.stock)) ? `${Math.max(0, Number(item.stock))} adet stok` : 'Stok bilgisi hazirlaniyor'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.productActions}>
                      {isManagementMode ? (
                        <ActionButton label="Duzenle" onPress={() => navigation.navigate('FeatureForm', { featureKey, item })} variant="primary" />
                      ) : (
                        <ActionButton label="Sepete Ekle" onPress={() => handleOrder(item)} variant="primary" />
                      )}
                      {canDeleteFeature(feature, profile.role) ? (
                        <ActionButton label="Sil" onPress={() => handleDelete(item)} variant="secondary" />
                      ) : null}
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle}>{item.name || item.title || item.fullName || item.code || item.productName || item.id}</Text>
                      {feature.listFields.map((fieldKey) => {
                        if (!item[fieldKey]) return null;
                        return (
                          <Text key={fieldKey} style={styles.cardText}>
                            {fieldKey}: {String(item[fieldKey])}
                          </Text>
                        );
                      })}
                    </View>
                    <View style={styles.actions}>
                      {featureKey === 'products' && profile.role !== 'superadmin' ? (
                        <ActionButton label="Siparis" onPress={() => handleOrder(item)} variant="secondary" />
                      ) : null}
                      {canDeleteFeature(feature, profile.role) ? (
                        <ActionButton label="Sil" onPress={() => handleDelete(item)} variant="secondary" />
                      ) : null}
                    </View>
                  </>
                )}
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
    paddingBottom: 24,
  },
  marketHero: {
    backgroundColor: '#10344f',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: '#25557c',
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  marketHeroBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#0f7abf',
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketHeroBody: {
    flex: 1,
    gap: 4,
  },
  marketHeroTitle: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 18,
  },
  marketHeroText: {
    color: '#c4dcf0',
    lineHeight: 20,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  pressed: {
    opacity: 0.9,
  },
  productCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 14,
    ...theme.shadow.card,
  },
  cardBody: {
    gap: 6,
  },
  cardTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
  cardText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  productTopRow: {
    flexDirection: 'row',
    gap: 14,
  },
  productImageWrap: {
    width: 92,
    height: 92,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dfeef8',
  },
  productMain: {
    flex: 1,
    gap: 10,
  },
  productHeaderRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  productTitle: {
    flex: 1,
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 17,
    lineHeight: 22,
  },
  stockBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stockAvailable: {
    backgroundColor: '#e6f8f0',
  },
  stockLimited: {
    backgroundColor: '#fff1e6',
  },
  stockBadgeText: {
    fontWeight: '800',
    fontSize: 11,
  },
  stockAvailableText: {
    color: '#157f5b',
  },
  stockLimitedText: {
    color: '#b85a1b',
  },
  productDescription: {
    color: theme.colors.textMuted,
    lineHeight: 20,
    fontSize: 13,
  },
  productMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  productPrice: {
    color: theme.colors.primaryDeep,
    fontWeight: '900',
    fontSize: 24,
  },
  productMetaText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  productActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
});