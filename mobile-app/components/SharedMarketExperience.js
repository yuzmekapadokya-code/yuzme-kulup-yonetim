import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import ActionButton from './ActionButton';
import EmptyState from './EmptyState';
import ScreenLayout from './ScreenLayout';
import SectionHeader from './SectionHeader';
import StatCard from './StatCard';
import { theme } from '../config/theme';
import { formatDateTime } from '../utils/date';

function formatMoney(value) {
  return `₺${Number(value || 0).toFixed(2)}`;
}

function getStatusPalette(statusMeta) {
  if (statusMeta?.tone === 'success') {
    return {
      bg: '#e6f7ef',
      text: '#1c8b63',
    };
  }
  if (statusMeta?.tone === 'danger') {
    return {
      bg: '#fdecea',
      text: '#c84d43',
    };
  }
  if (statusMeta?.tone === 'warning') {
    return {
      bg: '#fff2e4',
      text: '#b96a20',
    };
  }
  return {
    bg: '#e6f1f4',
    text: theme.colors.primaryDeep,
  };
}

function formatOrderTotal(order) {
  if (order.paymentMethod === 'credit' && Number(order.totalCredits || 0) > 0) {
    return `${Number(order.totalCredits || 0)} kredi${Number(order.totalAmount || 0) > 0 ? ` | ${formatMoney(order.totalAmount)}` : ''}`;
  }
  return formatMoney(order.totalAmount || 0);
}

function formatStockText(product) {
  if (Number.isFinite(Number(product?.stock))) {
    return Number(product.stock) > 0 ? `${Math.max(0, Number(product.stock))} adet stokta` : 'Stok sinirli';
  }
  return 'Hazir teslim secenekleri';
}

function normalizeCardNumberInput(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 19);
}

function formatCardNumberInput(value) {
  const digits = normalizeCardNumberInput(value);
  return digits.match(/.{1,4}/g)?.join(' ') || '';
}

function normalizeCardExpiryInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function normalizeCardCvvInput(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 4);
}

export default function SharedMarketExperience({
  title,
  subtitle,
  heroEyebrow,
  heroTitle,
  heroText,
  heroAccentLabel,
  data,
  headerStats = [],
  cartItems,
  favoriteIds = [],
  buyerPhone,
  setBuyerPhone,
  shippingAddress,
  setShippingAddress,
  paymentMethod,
  setPaymentMethod,
  paymentOptions = [],
  bankSettings,
  cardDetails,
  setCardDetails,
  installmentPreference,
  setInstallmentPreference,
  installmentOptions = [],
  orderNote,
  setOrderNote,
  onAddProduct,
  onUpdateQuantity,
  onRemoveProduct,
  onToggleFavorite,
  onCheckout,
  onReorderOrder,
  isCheckoutPending = false,
  cartAssistLines = [],
  canManageCampaigns = false,
  campaignForm,
  setCampaignForm,
  onSaveCampaign,
  onDeleteCampaign,
  isCampaignPending = false,
  modulesAction,
}) {
  const favoriteSet = useMemo(() => new Set(Array.isArray(favoriteIds) ? favoriteIds : []), [favoriteIds]);
  const cartSummary = useMemo(() => ({
    itemCount: (Array.isArray(cartItems) ? cartItems : []).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    totalAmount: (Array.isArray(cartItems) ? cartItems : []).reduce(
      (sum, item) => sum + ((Number(item.price || item.unitPrice || 0) * Number(item.quantity || 0)) || 0),
      0,
    ),
    totalCredits: (Array.isArray(cartItems) ? cartItems : []).reduce(
      (sum, item) => sum + ((Number(item.creditCost || item.unitCreditCost || 0) * Number(item.quantity || 0)) || 0),
      0,
    ),
  }), [cartItems]);

  const favoriteProducts = useMemo(
    () => (Array.isArray(data?.products) ? data.products.filter((product) => favoriteSet.has(product.id)) : []),
    [data?.products, favoriteSet],
  );
  const hasBankSettings = Boolean(
    bankSettings?.bankName
    || bankSettings?.accountHolder
    || bankSettings?.iban
    || bankSettings?.note,
  );

  return (
    <ScreenLayout title={title} subtitle={subtitle} scroll={false}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!!headerStats.length ? (
          <View style={styles.statsGrid}>
            {headerStats.map((item) => (
              <StatCard key={item.label} label={item.label} value={item.value} tone={item.tone || 'primary'} />
            ))}
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>{heroEyebrow}</Text>
          <Text style={styles.heroTitle}>{heroTitle}</Text>
          <Text style={styles.heroText}>{heroText}</Text>
          {heroAccentLabel ? <Text style={styles.heroAccent}>{heroAccentLabel}</Text> : null}
        </View>

        {canManageCampaigns && campaignForm && setCampaignForm ? (
          <>
            <SectionHeader title="Kampanya Modulu" caption="Market vitrinine cikacak kampanyalari hizli yonet" />
            <View style={styles.formCard}>
              <TextInput
                style={styles.input}
                placeholder="Kampanya basligi"
                value={campaignForm.title}
                onChangeText={(text) => setCampaignForm((current) => ({ ...current, title: text }))}
              />
              <View style={styles.formRow}>
                <TextInput
                  style={[styles.input, styles.formHalf]}
                  placeholder="Rozet"
                  value={campaignForm.badge}
                  onChangeText={(text) => setCampaignForm((current) => ({ ...current, badge: text }))}
                />
                <TextInput
                  style={[styles.input, styles.formHalf]}
                  placeholder="Kod"
                  autoCapitalize="characters"
                  value={campaignForm.code}
                  onChangeText={(text) => setCampaignForm((current) => ({ ...current, code: text }))}
                />
              </View>
              <View style={styles.formRow}>
                <TextInput
                  style={[styles.input, styles.formHalf]}
                  placeholder="Indirim %"
                  keyboardType="numeric"
                  value={campaignForm.discountPercent}
                  onChangeText={(text) => setCampaignForm((current) => ({ ...current, discountPercent: text }))}
                />
                <TextInput
                  style={[styles.input, styles.formHalf]}
                  placeholder="Bitis (YYYY-MM-DD)"
                  value={campaignForm.endsAt}
                  onChangeText={(text) => setCampaignForm((current) => ({ ...current, endsAt: text }))}
                />
              </View>
              <TextInput
                style={[styles.input, styles.textarea]}
                multiline
                placeholder="Kampanya aciklamasi"
                value={campaignForm.description}
                onChangeText={(text) => setCampaignForm((current) => ({ ...current, description: text }))}
              />
              <ActionButton
                label={isCampaignPending ? 'Kaydediliyor...' : 'Kampanyayi Kaydet'}
                onPress={onSaveCampaign}
                fullWidth
              />
            </View>
          </>
        ) : null}

        <SectionHeader title="Kampanyalar" caption="Market vitrininde one cikan firsatlar" />
        {!data?.campaigns?.length ? (
          <View style={styles.softCard}>
            <Text style={styles.softCardTitle}>Aktif kampanya yok</Text>
            <Text style={styles.softCardText}>Yeni kampanya tanimlandiginda bu alan vitrinde otomatik gosterilir.</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.campaignRow}>
            {data.campaigns.map((campaign) => (
              <View key={campaign.id} style={styles.campaignCard}>
                <View style={styles.campaignBadgeRow}>
                  <Text style={styles.campaignBadge}>{campaign.badge}</Text>
                  {campaign.code ? <Text style={styles.campaignCode}>{campaign.code}</Text> : null}
                </View>
                <Text style={styles.campaignTitle}>{campaign.title}</Text>
                <Text style={styles.campaignText}>{campaign.description}</Text>
                <Text style={styles.campaignHighlight}>{campaign.highlightText}</Text>
                {campaign.endsAt ? <Text style={styles.campaignDate}>Bitis: {campaign.endsAt}</Text> : null}
                {canManageCampaigns ? (
                  <ActionButton label="Sil" variant="secondary" onPress={() => onDeleteCampaign?.(campaign.id)} />
                ) : null}
              </View>
            ))}
          </ScrollView>
        )}

        {favoriteProducts.length ? (
          <>
            <SectionHeader title="Favoriler" caption="Tekrar baktiginiz urunler" />
            <View style={styles.stack}>
              {favoriteProducts.slice(0, 4).map((product) => (
                <View key={`favorite-${product.id}`} style={styles.favoriteCard}>
                  <Text style={styles.favoriteTitle}>{product.name}</Text>
                  <Text style={styles.favoriteText}>{formatMoney(product.price || 0)}</Text>
                  <ActionButton label="Sepete Ekle" onPress={() => onAddProduct(product)} />
                </View>
              ))}
            </View>
          </>
        ) : null}

        <SectionHeader title="Market Vitrini" caption="Teknik alanlardan arindirilmis urun deneyimi" />
        <View style={styles.stack}>
          {!data?.products?.length ? (
            <EmptyState title="Urun bulunmuyor" description="Market koleksiyonunda urun olmadigi icin vitrin gosterilemiyor." />
          ) : (
            data.products.map((product) => {
              const isFavorite = favoriteSet.has(product.id);
              const inCart = cartItems.find((item) => item.id === product.id || item.productId === product.id);
              return (
                <View key={product.id} style={styles.productCard}>
                  <View style={styles.productTopRow}>
                    <View style={styles.productImageWrap}>
                      {product.imageUrl ? (
                        <Image source={{ uri: product.imageUrl }} style={styles.productImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.productFallback}>
                          <Ionicons name="bag-handle-outline" size={28} color={theme.colors.primaryDeep} />
                        </View>
                      )}
                    </View>
                    <View style={styles.productMain}>
                      <View style={styles.productTitleRow}>
                        <Text style={styles.productTitle}>{product.name || 'Urun'}</Text>
                        <Pressable onPress={() => onToggleFavorite?.(product)} style={styles.favoriteButton}>
                          <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={20} color={isFavorite ? '#d55252' : theme.colors.textMuted} />
                        </Pressable>
                      </View>
                      <Text style={styles.productDescription} numberOfLines={3}>{product.description || 'Kulup vitrini icin hazirlanan urun secenegi.'}</Text>
                      <View style={styles.productInfoRow}>
                        <Text style={styles.productPrice}>{formatMoney(product.price || 0)}</Text>
                        {Number(product.creditCost || 0) > 0 ? <Text style={styles.productCredit}>{Number(product.creditCost || 0)} kredi</Text> : null}
                      </View>
                      <Text style={styles.productStock}>{formatStockText(product)}</Text>
                      {inCart ? <Text style={styles.productStock}>Sepette: {inCart.quantity} adet</Text> : null}
                    </View>
                  </View>
                  <View style={styles.productActionRow}>
                    <ActionButton label="Sepete Ekle" onPress={() => onAddProduct(product)} />
                    {inCart ? (
                      <ActionButton label="Cikar" variant="secondary" onPress={() => onRemoveProduct(product.id)} />
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>

        <SectionHeader title="Sepet ve Teslimat" caption="Siparisi tek akista tamamla" />
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Sepet ozeti</Text>
          <Text style={styles.formText}>{cartSummary.itemCount} urun | {formatMoney(cartSummary.totalAmount)}</Text>
          {cartSummary.totalCredits > 0 ? <Text style={styles.formText}>Toplam kredi: {cartSummary.totalCredits}</Text> : null}
          {cartAssistLines.map((line) => (
            <Text key={line} style={styles.helperText}>{line}</Text>
          ))}
          {!cartItems.length ? (
            <Text style={styles.helperText}>Sepetiniz bos. Vitrinden urun ekleyerek devam edin.</Text>
          ) : (
            cartItems.map((item) => (
              <View key={`cart-${item.id || item.productId}`} style={styles.cartRow}>
                <View style={styles.cartMeta}>
                  <Text style={styles.cartTitle}>{item.name || item.productName}</Text>
                  <Text style={styles.cartText}>{formatMoney(item.price || item.unitPrice || 0)} x {item.quantity}</Text>
                </View>
                <View style={styles.cartActions}>
                  <ActionButton label="-" variant="secondary" onPress={() => onUpdateQuantity(item.id || item.productId, -1)} />
                  <ActionButton label="+" variant="secondary" onPress={() => onUpdateQuantity(item.id || item.productId, 1)} />
                  <ActionButton label="Sil" variant="secondary" onPress={() => onRemoveProduct(item.id || item.productId)} />
                </View>
              </View>
            ))
          )}
          <TextInput style={styles.input} placeholder="Telefon" value={buyerPhone} onChangeText={setBuyerPhone} keyboardType="phone-pad" />
          <TextInput style={[styles.input, styles.textarea]} placeholder="Teslimat adresi" value={shippingAddress} onChangeText={setShippingAddress} multiline />
          <View style={styles.optionWrap}>
            {paymentOptions.map((option) => (
              <ActionButton
                key={option.key}
                label={option.label}
                variant={paymentMethod === option.key ? 'primary' : 'secondary'}
                onPress={() => setPaymentMethod(option.key)}
              />
            ))}
          </View>
          {paymentMethod === 'iban' && hasBankSettings ? (
            <View style={styles.bankInfoCard}>
              <Text style={styles.bankInfoTitle}>IBAN ile odeme bilgileri</Text>
              {bankSettings.bankName ? <Text style={styles.bankInfoText}>Banka: {bankSettings.bankName}</Text> : null}
              {bankSettings.accountHolder ? <Text style={styles.bankInfoText}>Hesap sahibi: {bankSettings.accountHolder}</Text> : null}
              {bankSettings.iban ? <Text style={styles.bankInfoValue}>IBAN: {bankSettings.iban}</Text> : null}
              {bankSettings.note ? <Text style={styles.bankInfoText}>{bankSettings.note}</Text> : null}
            </View>
          ) : null}
          {paymentMethod === 'credit_card' && cardDetails && setCardDetails ? (
            <View style={styles.bankInfoCard}>
              <Text style={styles.bankInfoTitle}>Kredi karti bilgileri</Text>
              <TextInput
                style={styles.input}
                placeholder="Kart uzerindeki ad soyad"
                autoCapitalize="words"
                value={cardDetails.holderName || ''}
                onChangeText={(text) => setCardDetails((current) => ({ ...current, holderName: text }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Kart numarasi"
                keyboardType="number-pad"
                value={formatCardNumberInput(cardDetails.cardNumber || '')}
                onChangeText={(text) => setCardDetails((current) => ({ ...current, cardNumber: normalizeCardNumberInput(text) }))}
              />
              <View style={styles.formRow}>
                <TextInput
                  style={[styles.input, styles.formHalf]}
                  placeholder="AA/YY"
                  keyboardType="number-pad"
                  value={normalizeCardExpiryInput(cardDetails.expiry || '')}
                  onChangeText={(text) => setCardDetails((current) => ({ ...current, expiry: normalizeCardExpiryInput(text) }))}
                />
                <TextInput
                  style={[styles.input, styles.formHalf]}
                  placeholder="CVV"
                  keyboardType="number-pad"
                  secureTextEntry
                  value={cardDetails.cvv || ''}
                  onChangeText={(text) => setCardDetails((current) => ({ ...current, cvv: normalizeCardCvvInput(text) }))}
                />
              </View>
              <Text style={styles.cardPrivacyText}>CVV ve tam kart numarasi siparis kaydina yazilmaz; sadece son 4 hane ve kart son kullanma tarihi ozetlenir.</Text>
            </View>
          ) : null}
          {installmentOptions.length && setInstallmentPreference ? (
            <View style={styles.optionWrap}>
              {installmentOptions.map((option) => (
                <ActionButton
                  key={option.key}
                  label={option.label}
                  variant={installmentPreference === option.key ? 'primary' : 'secondary'}
                  onPress={() => setInstallmentPreference(option.key)}
                />
              ))}
            </View>
          ) : null}
          <TextInput style={[styles.input, styles.textarea]} placeholder="Siparis notu" value={orderNote} onChangeText={setOrderNote} multiline />
          <ActionButton label={isCheckoutPending ? 'Siparis gonderiliyor...' : 'Siparisi Tamamla'} onPress={onCheckout} fullWidth disabled={!cartItems.length} />
        </View>

        <SectionHeader title="Siparis Gecmisi" caption="Durum, teslimat ve tekrar siparis bilgileri" />
        <View style={styles.stack}>
          {!data?.orders?.length ? (
            <EmptyState title="Siparis yok" description="Henuz olusturulmus market siparisi bulunmuyor." />
          ) : (
            data.orders.map((order) => {
              const palette = getStatusPalette(order.statusMeta);
              return (
                <View key={order.id} style={styles.orderCard}>
                  <View style={styles.orderHeader}>
                    <View style={styles.orderHeaderBody}>
                      <Text style={styles.orderTitle}>{order.orderTitle || 'Siparis'}</Text>
                      <Text style={styles.orderSubText}>{formatDateTime(order.createdAt)}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: palette.bg }]}>
                      <Text style={[styles.statusPillText, { color: palette.text }]}>{order.statusMeta?.label || order.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.orderSubText}>Odeme: {order.paymentLabel || order.paymentMethod || '-'}</Text>
                  <Text style={styles.orderSubText}>Toplam: {formatOrderTotal(order)}</Text>
                  {order.shippingCarrier ? <Text style={styles.orderSubText}>Kargo: {order.shippingCarrier}</Text> : null}
                  {order.trackingNumber ? <Text style={styles.orderSubText}>Takip no: {order.trackingNumber}</Text> : null}
                  <View style={styles.timelineWrap}>
                    {order.statusHistory?.map((item, index) => (
                      <View key={`${order.id}-timeline-${index}`} style={styles.timelineItem}>
                        <View style={styles.timelineDot} />
                        <View style={styles.timelineBody}>
                          <Text style={styles.timelineTitle}>{item.label || item.status}</Text>
                          <Text style={styles.timelineText}>{formatDateTime(item.createdAt)}</Text>
                          {item.note ? <Text style={styles.timelineText}>{item.note}</Text> : null}
                        </View>
                      </View>
                    ))}
                  </View>
                  <View style={styles.orderItemList}>
                    {order.items?.map((item) => (
                      <View key={`${order.id}-${item.id}`} style={styles.orderItemCard}>
                        <Text style={styles.orderItemTitle}>{item.productName}</Text>
                        <Text style={styles.orderSubText}>Adet: {item.quantity}</Text>
                        <Text style={styles.orderSubText}>{formatMoney(item.unitPrice || 0)}</Text>
                      </View>
                    ))}
                  </View>
                  <ActionButton label="Tekrar Siparis Ver" variant="secondary" onPress={() => onReorderOrder(order)} fullWidth />
                </View>
              );
            })
          )}
        </View>

        {modulesAction ? <ActionButton label={modulesAction.label} variant="secondary" onPress={modulesAction.onPress} fullWidth /> : null}
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  heroCard: {
    backgroundColor: '#14364f',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#2e5f82',
    padding: theme.spacing.lg,
    gap: 8,
  },
  heroEyebrow: {
    color: '#b7dbf2',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
  },
  heroText: {
    color: '#d5e8f5',
    lineHeight: 21,
  },
  heroAccent: {
    color: '#ffd3a8',
    fontWeight: '700',
  },
  softCard: {
    backgroundColor: '#fbf7f2',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: 6,
  },
  softCardTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
  softCardText: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  campaignRow: {
    gap: 12,
    paddingRight: 12,
  },
  campaignCard: {
    width: 250,
    backgroundColor: '#fff8ee',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#eed5b2',
    padding: theme.spacing.md,
    gap: 8,
  },
  campaignBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  campaignBadge: {
    backgroundColor: '#f3a34f',
    color: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
    fontWeight: '800',
    fontSize: 11,
  },
  campaignCode: {
    color: theme.colors.primaryDeep,
    fontWeight: '800',
  },
  campaignTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
  campaignText: {
    color: theme.colors.textMuted,
    lineHeight: 19,
  },
  campaignHighlight: {
    color: '#af5d19',
    fontWeight: '800',
  },
  campaignDate: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: 10,
  },
  formTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 17,
  },
  formText: {
    color: theme.colors.textMuted,
  },
  helperText: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formHalf: {
    flex: 1,
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
  textarea: {
    minHeight: 86,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  stack: {
    gap: 12,
  },
  favoriteCard: {
    backgroundColor: '#fff8f4',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#f3d8c4',
    padding: theme.spacing.md,
    gap: 6,
  },
  favoriteTitle: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  favoriteText: {
    color: '#a85d1e',
    fontWeight: '700',
  },
  productCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: 12,
    ...theme.shadow.card,
  },
  productTopRow: {
    flexDirection: 'row',
    gap: 14,
  },
  productImageWrap: {
    width: 88,
    height: 88,
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
    backgroundColor: '#e7f2f7',
  },
  productMain: {
    flex: 1,
    gap: 8,
  },
  productTitleRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  productTitle: {
    flex: 1,
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 17,
  },
  favoriteButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7f3ee',
  },
  productDescription: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  productInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  productPrice: {
    color: theme.colors.primaryDeep,
    fontWeight: '900',
    fontSize: 23,
  },
  productCredit: {
    color: '#9c5a18',
    fontWeight: '700',
  },
  productStock: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  productActionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bankInfoCard: {
    backgroundColor: '#f7fbff',
    borderWidth: 1,
    borderColor: '#c9ddef',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 4,
  },
  bankInfoTitle: {
    color: theme.colors.primaryDeep,
    fontWeight: '800',
    fontSize: 15,
  },
  bankInfoText: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  bankInfoValue: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  cardPrivacyText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  cartRow: {
    backgroundColor: '#fbf9f6',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
    gap: 8,
  },
  cartMeta: {
    gap: 4,
  },
  cartTitle: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  cartText: {
    color: theme.colors.textMuted,
  },
  cartActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  orderCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: 10,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  orderHeaderBody: {
    flex: 1,
    gap: 4,
  },
  orderTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
  orderSubText: {
    color: theme.colors.textMuted,
    lineHeight: 19,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusPillText: {
    fontWeight: '800',
    fontSize: 11,
  },
  timelineWrap: {
    gap: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
    backgroundColor: theme.colors.primary,
  },
  timelineBody: {
    flex: 1,
    gap: 2,
  },
  timelineTitle: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  timelineText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  orderItemList: {
    gap: 8,
  },
  orderItemCard: {
    backgroundColor: '#fcfaf7',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    gap: 4,
  },
  orderItemTitle: {
    color: theme.colors.text,
    fontWeight: '700',
  },
});