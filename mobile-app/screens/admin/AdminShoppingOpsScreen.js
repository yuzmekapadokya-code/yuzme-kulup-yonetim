import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SharedMarketExperience from '../../components/SharedMarketExperience';
import { deleteMarketCampaign, saveMarketCampaign, toggleUserMarketFavorite, buildReorderCartItems } from '../../services/marketService';
import { getAdminMarketOverview, submitAdminMarketCheckout } from '../../services/adminService';
import { useAuthStore } from '../../store/authStore';

function initialCardDetails() {
  return {
    holderName: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
  };
}

function initialCampaignForm() {
  return {
    title: '',
    badge: 'One Cikan',
    code: '',
    discountPercent: '',
    endsAt: '',
    description: '',
  };
}

export default function AdminShoppingOpsScreen() {
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();
  const marketQuery = useQuery({
    queryKey: ['ad-market', profile?.uid],
    queryFn: () => getAdminMarketOverview(profile),
    enabled: Boolean(profile?.uid),
  });

  const [cartItems, setCartItems] = useState([]);
  const [buyerPhone, setBuyerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('iban');
  const [cardDetails, setCardDetails] = useState(initialCardDetails());
  const [installmentPreference, setInstallmentPreference] = useState('tek_cekim');
  const [orderNote, setOrderNote] = useState('');
  const [campaignForm, setCampaignForm] = useState(initialCampaignForm());

  useEffect(() => {
    if (!marketQuery.data?.defaults) {
      return;
    }
    setBuyerPhone((current) => current || marketQuery.data.defaults.buyerPhone || '');
    setShippingAddress((current) => current || marketQuery.data.defaults.shippingAddress || '');
  }, [marketQuery.data?.defaults]);

  function invalidateMarket() {
    queryClient.invalidateQueries({ queryKey: ['ad-market', profile?.uid] });
  }

  const favoriteMutation = useMutation({
    mutationFn: (product) => toggleUserMarketFavorite({ userId: profile.uid, product }),
    onSuccess: invalidateMarket,
    onError: (error) => Alert.alert('Favori', error.message || 'Favori guncellenemedi.'),
  });

  const checkoutMutation = useMutation({
    mutationFn: () => submitAdminMarketCheckout({
      profile,
      items: cartItems,
      buyerPhone,
      shippingAddress,
      paymentMethod,
      cardDetails,
      installmentPreference,
      note: orderNote,
    }),
    onSuccess: () => {
      setCartItems([]);
      setOrderNote('');
      setCardDetails(initialCardDetails());
      invalidateMarket();
      Alert.alert('Siparis olusturuldu', 'Admin sepetiniz tek siparis olarak kaydedildi.');
    },
    onError: (error) => Alert.alert('Market', error.message || 'Siparis gonderilemedi.'),
  });

  const campaignMutation = useMutation({
    mutationFn: () => saveMarketCampaign({
      adminId: profile.uid,
      values: campaignForm,
      currentUserId: profile.uid,
      currentUserRole: 'admin',
    }),
    onSuccess: () => {
      setCampaignForm(initialCampaignForm());
      invalidateMarket();
      Alert.alert('Kampanya', 'Kampanya vitrine eklendi.');
    },
    onError: (error) => Alert.alert('Kampanya', error.message || 'Kampanya kaydedilemedi.'),
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: (campaignId) => deleteMarketCampaign(campaignId),
    onSuccess: invalidateMarket,
    onError: (error) => Alert.alert('Kampanya', error.message || 'Kampanya silinemedi.'),
  });

  function addProductToCart(product) {
    setCartItems((current) => {
      const existing = current.find((item) => item.id === product.id || item.productId === product.id);
      if (existing) {
        return current.map((item) => (
          item.id === product.id || item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      }
      return [
        ...current,
        {
          id: product.id,
          productId: product.id,
          name: product.name,
          price: Number(product.price || 0),
          quantity: 1,
        },
      ];
    });
  }

  function updateCartQuantity(productId, delta) {
    setCartItems((current) => current
      .map((item) => (
        item.id === productId || item.productId === productId
          ? { ...item, quantity: Math.max(0, item.quantity + delta) }
          : item
      ))
      .filter((item) => item.quantity > 0));
  }

  function removeCartItem(productId) {
    setCartItems((current) => current.filter((item) => item.id !== productId && item.productId !== productId));
  }

  function reorderOrder(order) {
    setCartItems(buildReorderCartItems(order));
    Alert.alert('Sepet hazir', 'Secilen siparis yeniden sepete eklendi.');
  }

  if (marketQuery.isLoading) {
    return <LoadingBlock label="Admin alisveris ekrani yukleniyor..." />;
  }

  if (marketQuery.isError || !marketQuery.data) {
    return (
      <ScreenLayout title="Alisveris" subtitle="Market verileri alinamadi.">
        <EmptyState title="Market acilamadi" description={marketQuery.error?.message || 'Admin market verileri okunamadi.'} />
        <ActionButton label="Tekrar Dene" onPress={() => marketQuery.refetch()} fullWidth />
      </ScreenLayout>
    );
  }

  const data = marketQuery.data;

  return (
    <SharedMarketExperience
      title="Admin Alisveris"
      subtitle="Market vitrinini, sepet akisini ve kampanya yonetimini ayri ekranda toplar."
      heroEyebrow="ADMIN MARKET"
      heroTitle="Vitrin ve siparis akisi"
      heroText="Alisveris artik finans ekranina gomulu degil. Vitrin, kampanya ve siparis akislari ayri bir ekrana tasindi."
      heroAccentLabel="Programlama ve finans arasinda kaybolmadan marketi yonetin."
      data={data}
      headerStats={[
        { label: 'Siparis', value: data.orders.length, tone: 'primary' },
        { label: 'Kampanya', value: data.campaigns.length, tone: 'warning' },
        { label: 'Favori', value: data.favoriteProductIds.length, tone: 'success' },
      ]}
      cartItems={cartItems}
      favoriteIds={data.favoriteProductIds}
      buyerPhone={buyerPhone}
      setBuyerPhone={setBuyerPhone}
      shippingAddress={shippingAddress}
      setShippingAddress={setShippingAddress}
      paymentMethod={paymentMethod}
      setPaymentMethod={setPaymentMethod}
      cardDetails={cardDetails}
      setCardDetails={setCardDetails}
      paymentOptions={[
        { key: 'iban', label: 'IBAN' },
        { key: 'credit_card', label: 'Kredi Karti' },
        { key: 'cash', label: 'Nakit' },
      ]}
      bankSettings={data.bankSettings}
      installmentPreference={installmentPreference}
      setInstallmentPreference={setInstallmentPreference}
      installmentOptions={[
        { key: 'tek_cekim', label: 'Tek cekim' },
        { key: 'taksitli', label: 'Taksitli' },
      ]}
      orderNote={orderNote}
      setOrderNote={setOrderNote}
      onAddProduct={addProductToCart}
      onUpdateQuantity={updateCartQuantity}
      onRemoveProduct={removeCartItem}
      onToggleFavorite={(product) => favoriteMutation.mutate(product)}
      onCheckout={() => checkoutMutation.mutate()}
      onReorderOrder={reorderOrder}
      isCheckoutPending={checkoutMutation.isPending}
      canManageCampaigns
      campaignForm={campaignForm}
      setCampaignForm={setCampaignForm}
      onSaveCampaign={() => campaignMutation.mutate()}
      onDeleteCampaign={(campaignId) => deleteCampaignMutation.mutate(campaignId)}
      isCampaignPending={campaignMutation.isPending}
      cartAssistLines={[
        'Sepet tek sipariste super admin tarafina iletilir.',
        paymentMethod === 'iban'
          ? 'IBAN seciminde kulubun hesap bilgileri asagida gosterilir.'
          : paymentMethod === 'credit_card'
            ? 'Kart seciminde kart sahibi, numara, son kullanma ve CVV bilgileri istenir.'
            : 'Kampanya kartlari vitrinde otomatik gosterilir.',
      ]}
    />
  );
}