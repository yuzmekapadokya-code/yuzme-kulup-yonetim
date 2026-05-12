import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SharedMarketExperience from '../../components/SharedMarketExperience';
import { buildReorderCartItems, toggleUserMarketFavorite } from '../../services/marketService';
import { getParentMarketOverview, submitParentMarketCheckout } from '../../services/parentService';
import { useAuthStore } from '../../store/authStore';

function initialCardDetails() {
  return {
    holderName: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
  };
}

export default function ParentShoppingOpsScreen() {
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();
  const marketQuery = useQuery({
    queryKey: ['pr-market', profile?.uid],
    queryFn: () => getParentMarketOverview(profile),
    enabled: Boolean(profile?.uid),
  });

  const [cartItems, setCartItems] = useState([]);
  const [buyerPhone, setBuyerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('iban');
  const [cardDetails, setCardDetails] = useState(initialCardDetails());
  const [installmentPreference, setInstallmentPreference] = useState('tek_cekim');
  const [orderNote, setOrderNote] = useState('');

  useEffect(() => {
    if (!marketQuery.data?.defaults) {
      return;
    }
    setBuyerPhone((current) => current || marketQuery.data.defaults.buyerPhone || '');
    setShippingAddress((current) => current || marketQuery.data.defaults.shippingAddress || '');
  }, [marketQuery.data?.defaults]);

  function invalidateMarket() {
    queryClient.invalidateQueries({ queryKey: ['pr-market', profile?.uid] });
    queryClient.invalidateQueries({ queryKey: ['pr-dashboard', profile?.uid] });
  }

  const favoriteMutation = useMutation({
    mutationFn: (product) => toggleUserMarketFavorite({ userId: profile.uid, product }),
    onSuccess: invalidateMarket,
    onError: (error) => Alert.alert('Favori', error.message || 'Favori guncellenemedi.'),
  });

  const checkoutMutation = useMutation({
    mutationFn: () => submitParentMarketCheckout({
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
      Alert.alert('Siparis alindi', 'Sepetiniz tek sipariste super admin tarafina iletildi.');
    },
    onError: (error) => Alert.alert('Market', error.message || 'Siparis gonderilemedi.'),
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
    return <LoadingBlock label="Veli marketi yukleniyor..." />;
  }

  if (marketQuery.isError || !marketQuery.data) {
    return (
      <ScreenLayout title="Alisveris" subtitle="Market verileri alinamadi.">
        <EmptyState title="Market acilamadi" description={marketQuery.error?.message || 'Veli market verileri okunamadi.'} />
        <ActionButton label="Tekrar Dene" onPress={() => marketQuery.refetch()} fullWidth />
      </ScreenLayout>
    );
  }

  const data = marketQuery.data;

  return (
    <SharedMarketExperience
      title="Alisveris"
      subtitle="Kulup urunleri, sepet ve siparis takibini ayri vitrin ekraninda toplar."
      heroEyebrow="VELI MARKET"
      heroTitle="Sepet ve siparis takibi"
      heroText="Gunluk yasam ekranindan ayrilan market akisi daha sade, daha anlasilir ve tekrar siparise uygun hale getirildi."
      heroAccentLabel="En sik kullandiginiz urunler, favoriler ve siparis durumu ayni vitrinde."
      data={data}
      headerStats={[
        { label: 'Kampanya', value: data.campaigns.length, tone: 'warning' },
        { label: 'Favori', value: data.favoriteProductIds.length, tone: 'primary' },
        { label: 'Siparis', value: data.orders.length, tone: 'success' },
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
      cartAssistLines={[
        'Siparis durumunuz onay, hazirlama, kargo ve teslim adimlariyla gorulur.',
        paymentMethod === 'iban'
          ? 'IBAN secildiginde banka bilgileri siparis formunda acilir.'
          : paymentMethod === 'credit_card'
            ? 'Kart secildiginde kart sahibi, numara, son kullanma ve CVV alanlari zorunlu olur.'
            : 'Kart ve nakit secenekleriyle siparis verebilirsiniz.',
      ]}
    />
  );
}