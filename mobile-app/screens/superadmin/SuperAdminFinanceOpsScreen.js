import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import { theme } from '../../config/theme';
import {
  addCreditToTrainer,
  approveCreditRequest,
  approveWithdrawalRequest,
  deleteCreditPackage,
  getExchangeRateSettings,
  listCreditPackagesOverview,
  listCreditRequestsOverview,
  listOrdersOverview,
  listTrainerCreditBalances,
  listWithdrawalRequestsOverview,
  rejectCreditRequest,
  rejectWithdrawalRequest,
  saveCreditPackage,
  saveCreditPurchaseBankSettings,
  saveExchangeRateSettings,
  updateOrderFulfillmentStatus,
} from '../../services/superAdminService';
import { useAuthStore } from '../../store/authStore';
import { formatDate } from '../../utils/date';

function getOrderActions(order) {
  const status = String(order?.status || 'pending');
  const isShippable = order?.type !== 'credit_package_purchase';

  if (status === 'cancelled' || status === 'delivered') {
    return [];
  }

  if (!isShippable) {
    if (status === 'pending') {
      return [
        { nextStatus: 'confirmed', label: 'Onayla' },
        { nextStatus: 'cancelled', label: 'Iptal Et', variant: 'secondary' },
      ];
    }
    if (status === 'confirmed') {
      return [{ nextStatus: 'delivered', label: 'Tamamlandi' }];
    }
    return [];
  }

  if (status === 'pending') {
    return [
      { nextStatus: 'confirmed', label: 'Onayla' },
      { nextStatus: 'cancelled', label: 'Iptal Et', variant: 'secondary' },
    ];
  }
  if (status === 'confirmed') {
    return [
      { nextStatus: 'preparing', label: 'Hazirlaniyor' },
      { nextStatus: 'cancelled', label: 'Iptal Et', variant: 'secondary' },
    ];
  }
  if (status === 'preparing') {
    return [
      { nextStatus: 'shipped', label: 'Kargoya Ver' },
      { nextStatus: 'cancelled', label: 'Iptal Et', variant: 'secondary' },
    ];
  }
  if (status === 'shipped') {
    return [{ nextStatus: 'delivered', label: 'Teslim Edildi' }];
  }

  return [];
}

function hasCreditCardSnapshot(order) {
  return Boolean(
    order
    && order.paymentMethod === 'credit_card'
    && (order.cardHolderNameSnapshot || order.cardLast4Snapshot || order.cardExpirySnapshot || order.cardBrandSnapshot)
  );
}

function getCreditCardSnapshotLines(order) {
  if (!hasCreditCardSnapshot(order)) {
    return [];
  }

  const lines = [];
  if (order.cardHolderNameSnapshot) {
    lines.push(`Kart sahibi: ${order.cardHolderNameSnapshot}`);
  }

  if (order.cardBrandSnapshot || order.cardLast4Snapshot) {
    lines.push(`Kart: ${order.cardBrandSnapshot || 'Kart'}${order.cardLast4Snapshot ? ` **** ${order.cardLast4Snapshot}` : ''}`);
  }

  if (order.cardExpirySnapshot) {
    lines.push(`Son kullanma: ${order.cardExpirySnapshot}`);
  }

  lines.push('Tam kart numarasi ve CVV siparis kaydina yazilmaz.');
  return lines;
}

export default function SuperAdminFinanceOpsScreen() {
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();

  const creditRequestsQuery = useQuery({ queryKey: ['sa-credit-requests'], queryFn: listCreditRequestsOverview });
  const trainerCreditsQuery = useQuery({ queryKey: ['sa-trainer-credits'], queryFn: listTrainerCreditBalances });
  const creditPackagesQuery = useQuery({ queryKey: ['sa-credit-packages'], queryFn: listCreditPackagesOverview });
  const withdrawalQuery = useQuery({ queryKey: ['sa-withdrawals'], queryFn: listWithdrawalRequestsOverview });
  const ordersQuery = useQuery({ queryKey: ['sa-orders'], queryFn: listOrdersOverview });
  const exchangeRateQuery = useQuery({ queryKey: ['sa-exchange-rate'], queryFn: getExchangeRateSettings });

  const [selectedTrainerId, setSelectedTrainerId] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDescription, setCreditDescription] = useState('');
  const [packageCredit, setPackageCredit] = useState('');
  const [packagePrice, setPackagePrice] = useState('');
  const [bankValues, setBankValues] = useState({ bankName: '', accountHolder: '', iban: '', note: '' });
  const [rateValues, setRateValues] = useState({ creditAmount: '100', turAmount: '50' });
  const [orderDrafts, setOrderDrafts] = useState({});

  useEffect(() => {
    if (creditPackagesQuery.data?.bankSettings) {
      setBankValues({
        bankName: creditPackagesQuery.data.bankSettings.bankName || '',
        accountHolder: creditPackagesQuery.data.bankSettings.accountHolder || '',
        iban: creditPackagesQuery.data.bankSettings.iban || '',
        note: creditPackagesQuery.data.bankSettings.note || '',
      });
    }
  }, [creditPackagesQuery.data]);

  useEffect(() => {
    if (exchangeRateQuery.data) {
      setRateValues({
        creditAmount: String(exchangeRateQuery.data.creditAmount || '100'),
        turAmount: String(exchangeRateQuery.data.turAmount || '50'),
      });
    }
  }, [exchangeRateQuery.data]);

  function invalidateFinance() {
    queryClient.invalidateQueries({ queryKey: ['sa-credit-requests'] });
    queryClient.invalidateQueries({ queryKey: ['sa-trainer-credits'] });
    queryClient.invalidateQueries({ queryKey: ['sa-credit-packages'] });
    queryClient.invalidateQueries({ queryKey: ['sa-withdrawals'] });
    queryClient.invalidateQueries({ queryKey: ['sa-orders'] });
    queryClient.invalidateQueries({ queryKey: ['sa-exchange-rate'] });
    queryClient.invalidateQueries({ queryKey: ['sa-dashboard'] });
  }

  const addCreditMutation = useMutation({
    mutationFn: () => {
      if (!selectedTrainerId) {
        throw new Error('Lutfen bir antrenor secin.');
      }
      return addCreditToTrainer({
        trainerId: selectedTrainerId,
        amount: Number(creditAmount),
        description: creditDescription,
        currentSuperAdminId: profile.uid,
      });
    },
    onSuccess: () => {
      setCreditAmount('');
      setCreditDescription('');
      invalidateFinance();
    },
    onError: (error) => Alert.alert('Kredi hatasi', error.message || 'Kredi guncellenemedi.'),
  });

  const creditRequestMutation = useMutation({
    mutationFn: ({ requestId, action }) =>
      action === 'approve'
        ? approveCreditRequest({ requestId, currentSuperAdminId: profile.uid })
        : rejectCreditRequest({ requestId, currentSuperAdminId: profile.uid }),
    onSuccess: invalidateFinance,
    onError: (error) => Alert.alert('Talep hatasi', error.message || 'Talep guncellenemedi.'),
  });

  const savePackageMutation = useMutation({
    mutationFn: () => saveCreditPackage({ credit: packageCredit, price: packagePrice }),
    onSuccess: () => {
      setPackageCredit('');
      setPackagePrice('');
      invalidateFinance();
    },
  });

  const deletePackageMutation = useMutation({
    mutationFn: (packageId) => deleteCreditPackage(packageId),
    onSuccess: invalidateFinance,
  });

  const saveBankMutation = useMutation({
    mutationFn: () => saveCreditPurchaseBankSettings({ values: bankValues, currentSuperAdminId: profile.uid }),
    onSuccess: invalidateFinance,
  });

  const saveRateMutation = useMutation({
    mutationFn: () => saveExchangeRateSettings({ ...rateValues, currentSuperAdminId: profile.uid }),
    onSuccess: invalidateFinance,
  });

  const withdrawalMutation = useMutation({
    mutationFn: ({ requestId, action }) =>
      action === 'approve'
        ? approveWithdrawalRequest({ requestId, currentSuperAdminId: profile.uid })
        : rejectWithdrawalRequest({ requestId, reason: 'Mobil panelden reddedildi', currentSuperAdminId: profile.uid }),
    onSuccess: invalidateFinance,
    onError: (error) => Alert.alert('Talep hatasi', error.message || 'Bozdurma talebi guncellenemedi.'),
  });

  const orderMutation = useMutation({
    mutationFn: ({ orderId, nextStatus, note = '', shippingCarrier = '', trackingNumber = '' }) => updateOrderFulfillmentStatus({
      orderId,
      nextStatus,
      note,
      shippingCarrier,
      trackingNumber,
      currentSuperAdminId: profile.uid,
    }),
    onSuccess: (_, variables) => {
      if (variables?.orderId) {
        setOrderDrafts((current) => ({
          ...current,
          [variables.orderId]: {
            ...current[variables.orderId],
            note: '',
          },
        }));
      }
      invalidateFinance();
    },
    onError: (error) => Alert.alert('Siparis', error.message || 'Siparis durumu guncellenemedi.'),
  });

  function updateOrderDraft(orderId, patch) {
    setOrderDrafts((current) => ({
      ...current,
      [orderId]: {
        ...current[orderId],
        ...patch,
      },
    }));
  }

  function getOrderDraft(order) {
    return {
      shippingCarrier: orderDrafts[order.id]?.shippingCarrier ?? order.shippingCarrier ?? '',
      trackingNumber: orderDrafts[order.id]?.trackingNumber ?? order.trackingNumber ?? '',
      note: orderDrafts[order.id]?.note ?? '',
    };
  }

  const isLoading = [
    creditRequestsQuery,
    trainerCreditsQuery,
    creditPackagesQuery,
    withdrawalQuery,
    ordersQuery,
    exchangeRateQuery,
  ].some((queryState) => queryState.isLoading);

  if (isLoading) {
    return <LoadingBlock label="Finans operasyonlari yukleniyor..." />;
  }

  return (
    <ScreenLayout title="Finans Operasyonlari" subtitle="Kredi, siparis, bozdurma ve paket yonetimi ayni panelde.">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.stack}>
        <SectionHeader title="Manuel kredi islemi" caption="Antrenor bakiyesi artir veya azalt" />
        <View style={styles.card}>
          <Text style={styles.label}>Antrenor sec</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {trainerCreditsQuery.data.map((trainer) => (
              <ActionButton key={trainer.id} label={trainer.name} variant={selectedTrainerId === trainer.id ? 'primary' : 'secondary'} onPress={() => setSelectedTrainerId(trainer.id)} />
            ))}
          </ScrollView>
          <TextInput style={styles.input} placeholder="Miktar (+/-)" keyboardType="numeric" value={creditAmount} onChangeText={setCreditAmount} />
          <TextInput style={styles.input} placeholder="Aciklama" value={creditDescription} onChangeText={setCreditDescription} />
          <ActionButton label={addCreditMutation.isPending ? 'Guncelleniyor...' : 'Kredi Islemini Uygula'} onPress={() => addCreditMutation.mutate()} fullWidth />
        </View>

        <SectionHeader title="Bekleyen kredi talepleri" caption="Antrenor talep akislarini sonuclandir" />
        {!creditRequestsQuery.data.filter((item) => item.status === 'pending').length ? (
          <EmptyState title="Bekleyen kredi talebi yok" description="Tum kredi talepleri sonuclandirilmis." />
        ) : (
          creditRequestsQuery.data.filter((item) => item.status === 'pending').map((request) => (
            <View key={request.id} style={styles.card}>
              <Text style={styles.cardTitle}>{request.trainerName || request.trainerId}</Text>
              <Text style={styles.cardText}>Talep: {request.amount} kredi</Text>
              <Text style={styles.cardText}>{request.description || 'Aciklama yok'}</Text>
              <View style={styles.buttonRow}>
                <ActionButton label="Onayla" onPress={() => creditRequestMutation.mutate({ requestId: request.id, action: 'approve' })} />
                <ActionButton label="Reddet" variant="secondary" onPress={() => creditRequestMutation.mutate({ requestId: request.id, action: 'reject' })} />
              </View>
            </View>
          ))
        )}

        <SectionHeader title="Antrenor kredi bakiyeleri" caption="Cuzdan ozeti" />
        <View style={styles.stack}>
          {trainerCreditsQuery.data.map((trainer) => (
            <View key={trainer.id} style={styles.cardCompact}>
              <Text style={styles.cardTitle}>{trainer.name}</Text>
              <Text style={styles.cardText}>{trainer.email}</Text>
              <Text style={styles.cardText}>Bakiye: {trainer.balance} | Bloke: {trainer.blockedCredits}</Text>
            </View>
          ))}
        </View>

        <SectionHeader title="Kredi paketleri" caption="Banka ayarlari ve paket tanimlari" />
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Banka adi" value={bankValues.bankName} onChangeText={(text) => setBankValues((current) => ({ ...current, bankName: text }))} />
          <TextInput style={styles.input} placeholder="Hesap sahibi" value={bankValues.accountHolder} onChangeText={(text) => setBankValues((current) => ({ ...current, accountHolder: text }))} />
          <TextInput style={styles.input} placeholder="IBAN" value={bankValues.iban} onChangeText={(text) => setBankValues((current) => ({ ...current, iban: text }))} />
          <TextInput style={[styles.input, styles.textarea]} multiline placeholder="Not" value={bankValues.note} onChangeText={(text) => setBankValues((current) => ({ ...current, note: text }))} />
          <ActionButton label={saveBankMutation.isPending ? 'Kaydediliyor...' : 'Banka Ayarlarini Kaydet'} onPress={() => saveBankMutation.mutate()} fullWidth />
          <TextInput style={styles.input} placeholder="Paket kredisi" keyboardType="numeric" value={packageCredit} onChangeText={setPackageCredit} />
          <TextInput style={styles.input} placeholder="Paket fiyati" keyboardType="numeric" value={packagePrice} onChangeText={setPackagePrice} />
          <ActionButton label={savePackageMutation.isPending ? 'Ekleniyor...' : 'Kredi Paketi Ekle'} onPress={() => savePackageMutation.mutate()} fullWidth />
          {creditPackagesQuery.data.packages.map((pkg) => (
            <View key={pkg.id} style={styles.inlineRow}>
              <Text style={styles.cardText}>{pkg.credit} kredi - ₺{pkg.price}</Text>
              <ActionButton label="Sil" variant="secondary" onPress={() => deletePackageMutation.mutate(pkg.id)} />
            </View>
          ))}
        </View>

        <SectionHeader title="Bozdurma orani ve talepler" caption="Kredi-TL cevrimi ve iade akisi" />
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Kredi miktari" keyboardType="numeric" value={rateValues.creditAmount} onChangeText={(text) => setRateValues((current) => ({ ...current, creditAmount: text }))} />
          <TextInput style={styles.input} placeholder="TL tutari" keyboardType="numeric" value={rateValues.turAmount} onChangeText={(text) => setRateValues((current) => ({ ...current, turAmount: text }))} />
          <ActionButton label={saveRateMutation.isPending ? 'Kaydediliyor...' : 'Orani Kaydet'} onPress={() => saveRateMutation.mutate()} fullWidth />
          {withdrawalQuery.data.length ? withdrawalQuery.data.map((request) => (
            <View key={request.id} style={styles.cardCompact}>
              <Text style={styles.cardTitle}>{request.trainerName || request.trainerId}</Text>
              <Text style={styles.cardText}>{request.creditAmount} kredi -> ₺{request.turAmount?.toFixed?.(2) || request.turAmount}</Text>
              <Text style={styles.cardText}>{request.paymentMethod === 'crypto' ? 'Kripto' : 'EFT'} | {request.status}</Text>
              <View style={styles.buttonRow}>
                <ActionButton label="Onayla" onPress={() => withdrawalMutation.mutate({ requestId: request.id, action: 'approve' })} />
                <ActionButton label="Reddet" variant="secondary" onPress={() => withdrawalMutation.mutate({ requestId: request.id, action: 'reject' })} />
              </View>
            </View>
          )) : <EmptyState title="Bekleyen bozdurma talebi yok" />}
        </View>

        <SectionHeader title="Siparisler" caption="Bekleyen siparisleri sonuclandir" />
        {!ordersQuery.data.length ? (
          <EmptyState title="Siparis yok" description="Sistemde kayitli siparis bulunmuyor." />
        ) : (
          ordersQuery.data.slice(0, 20).map((order) => {
            const orderDraft = getOrderDraft(order);
            const orderActions = getOrderActions(order);
            const showShippingInputs = order.type !== 'credit_package_purchase'
              && ['confirmed', 'preparing', 'shipped'].includes(order.status);

            return (
              <View key={order.id} style={styles.card}>
                <Text style={styles.cardTitle}>{order.orderTitle || order.productName || order.packageName || order.id}</Text>
                <Text style={styles.cardText}>{order.buyerName || order.customerName || 'Bilinmiyor'} | {order.buyerRole || order.userRole || '-'}</Text>
                <Text style={styles.cardText}>Durum: {order.statusMeta?.label || order.status || 'pending'}</Text>
                <Text style={styles.cardText}>Kalem: {order.itemCount || order.quantity || 1}</Text>
                <Text style={styles.cardText}>Odeme: {order.paymentLabel || order.paymentMethod || '-'}</Text>
                <Text style={styles.cardText}>Tutar: {order.paymentMethod === 'credit' ? `${order.totalCredits || 0} kredi` : `₺${Number(order.totalAmount || 0).toFixed(2)}`}</Text>
                {order.buyerPhone ? <Text style={styles.cardText}>Telefon: {order.buyerPhone}</Text> : null}
                {order.shippingAddress ? <Text style={styles.cardText}>Adres: {order.shippingAddress}</Text> : null}
                {order.installmentPreference ? <Text style={styles.cardText}>Taksit: {order.installmentPreference}</Text> : null}
                {order.note ? <Text style={styles.cardText}>Siparis notu: {order.note}</Text> : null}
                {getCreditCardSnapshotLines(order).map((line) => (
                  <Text key={`${order.id}_${line}`} style={styles.cardText}>{line}</Text>
                ))}
                <View style={styles.orderItemList}>
                  {order.items?.map((item) => (
                    <View key={item.id} style={styles.orderItemCard}>
                      <Text style={styles.orderItemTitle}>{item.productName}</Text>
                      <Text style={styles.cardText}>Adet: {item.quantity}</Text>
                      <Text style={styles.cardText}>Birim fiyat: ₺{Number(item.unitPrice || 0).toFixed(2)}</Text>
                      {order.paymentMethod === 'credit' ? <Text style={styles.cardText}>Birim kredi: {Number(item.unitCreditCost || 0)}</Text> : null}
                    </View>
                  ))}
                </View>
                {showShippingInputs || order.shippingCarrier || order.trackingNumber ? (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="Kargo firmasi"
                      value={orderDraft.shippingCarrier}
                      onChangeText={(text) => updateOrderDraft(order.id, { shippingCarrier: text })}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Takip numarasi"
                      value={orderDraft.trackingNumber}
                      onChangeText={(text) => updateOrderDraft(order.id, { trackingNumber: text })}
                    />
                  </>
                ) : null}
                <TextInput
                  style={[styles.input, styles.textarea]}
                  multiline
                  placeholder="Durum notu"
                  value={orderDraft.note}
                  onChangeText={(text) => updateOrderDraft(order.id, { note: text })}
                />
                {order.statusHistory?.length ? (
                  <View style={styles.orderTimeline}>
                    {order.statusHistory.slice().reverse().map((entry, index) => (
                      <View key={`${order.id}_${entry.status}_${entry.createdAt}_${index}`} style={styles.timelineItem}>
                        <Text style={styles.timelineTitle}>{entry.label || entry.status}</Text>
                        {entry.note ? <Text style={styles.cardText}>{entry.note}</Text> : null}
                        {entry.shippingCarrier || entry.trackingNumber ? (
                          <Text style={styles.cardText}>Kargo: {entry.shippingCarrier || '-'}{entry.trackingNumber ? ` | Takip: ${entry.trackingNumber}` : ''}</Text>
                        ) : null}
                        <Text style={styles.timelineMeta}>{formatDate(entry.createdAt)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {orderActions.length ? (
                  <View style={styles.buttonRow}>
                    {orderActions.map((action) => (
                      <ActionButton
                        key={`${order.id}_${action.nextStatus}`}
                        label={action.label}
                        variant={action.variant || 'primary'}
                        onPress={() => orderMutation.mutate({
                          orderId: order.id,
                          nextStatus: action.nextStatus,
                          note: orderDraft.note,
                          shippingCarrier: orderDraft.shippingCarrier,
                          trackingNumber: orderDraft.trackingNumber,
                        })}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
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
  cardTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  cardText: {
    color: theme.colors.textMuted,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  orderItemList: {
    gap: 8,
  },
  orderItemCard: {
    backgroundColor: '#fbfdff',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    gap: 2,
  },
  orderItemTitle: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  orderTimeline: {
    gap: 8,
  },
  timelineItem: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
    paddingLeft: 10,
    gap: 2,
  },
  timelineTitle: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  timelineMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
});