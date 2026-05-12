import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SharedMarketExperience from '../../components/SharedMarketExperience';
import { buildReorderCartItems, toggleUserMarketFavorite } from '../../services/marketService';
import { getTrainerMarketOverview, submitTrainerMarketCheckout } from '../../services/trainerService';
import { useAuthStore } from '../../store/authStore';

function initialCardDetails() {
  return {
    holderName: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
  };
}

export default function TrainerShoppingOpsScreen() {
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();
  const marketQuery = useQuery({
    queryKey: ['tr-market', profile?.uid],
    queryFn: () => getTrainerMarketOverview(profile),
    enabled: Boolean(profile?.uid),
  });

  const [cartItems, setCartItems] = useState([]);
  const [buyerPhone, setBuyerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('credit');
  const [cardDetails, setCardDetails] = useState(initialCardDetails());
  const [orderNote, setOrderNote] = useState('');

  useEffect(() => {
    if (!marketQuery.data?.defaults) {
      return;
    }
    setBuyerPhone((current) => current || marketQuery.data.defaults.buyerPhone || '');
    setShippingAddress((current) => current || marketQuery.data.defaults.shippingAddress || '');
  }, [marketQuery.data?.defaults]);

  function invalidateMarket() {
    queryClient.invalidateQueries({ queryKey: ['tr-market', profile?.uid] });
    queryClient.invalidateQueries({ queryKey: ['tr-commerce', profile?.uid] });
    queryClient.invalidateQueries({ queryKey: ['tr-dashboard', profile?.uid] });
  }

  const favoriteMutation = useMutation({
    mutationFn: (product) => toggleUserMarketFavorite({ userId: profile.uid, product }),
    onSuccess: invalidateMarket,
    onError: (error) => Alert.alert('Favori', error.message || 'Favori guncellenemedi.'),
  });

  const checkoutMutation = useMutation({
    mutationFn: () => submitTrainerMarketCheckout({
      profile,
      items: cartItems,
      paymentMethod,
      cardDetails,
      buyerPhone,
      shippingAddress,
      note: orderNote,
    }),
    onSuccess: () => {
      setCartItems([]);
      setOrderNote('');
      setCardDetails(initialCardDetails());
      invalidateMarket();
      Alert.alert('Siparis olusturuldu', 'Antrenor sepetiniz tek sipariste sisteme iletildi.');
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
          creditCost: Number(product.creditCost || 0),
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
    return <LoadingBlock label="Antrenor marketi yukleniyor..." />;
  }

  if (marketQuery.isError || !marketQuery.data) {
    return (
      <ScreenLayout title="Alisveris" subtitle="Market verileri alinamadi.">
        <EmptyState title="Market acilamadi" description={marketQuery.error?.message || 'Antrenor market verileri okunamadi.'} />
        <ActionButton label="Tekrar Dene" onPress={() => marketQuery.refetch()} fullWidth />
      </ScreenLayout>
    );
  }

  const data = marketQuery.data;

  return (
    <SharedMarketExperience
      title="Alisveris"
      subtitle="Kulup urunleri, favoriler ve siparis takibini kredi/IBAN secenekleriyle ayri ekranda toplar."
      heroEyebrow="ANTRENOR MARKET"
      heroTitle="Krediyle hizli satin alma"
      heroText="Alisveris artik finans ekranindan ayrildi. Vitrin, sepet ve siparis durumu tek ekranda daha okunur hale getirildi."
      heroAccentLabel={`Mevcut bakiye: ${data.creditBalance} kredi`}
      data={data}
      headerStats={[
        { label: 'Kredi', value: data.creditBalance, tone: 'primary' },
        { label: 'Favori', value: data.favoriteProductIds.length, tone: 'success' },
        { label: 'Siparis', value: data.orders.length, tone: 'warning' },
      ]}
      cartItems={cartItems}
      favoriteIds={data.favoriteProductIds}
      buyerPhone={buyerPhone}
      setBuyerPhone={setBuyerPhone}
      shippingAddress={shippingAddress}
      setShippingAddress={setShippingAddress}
      paymentMethod={paymentMethod}
      setPaymentMethod={setPaymentMethod}
      paymentOptions={[
        { key: 'credit', label: 'Kredi' },
        { key: 'iban', label: 'IBAN' },
        { key: 'credit_card', label: 'Kredi Karti' },
      ]}
      bankSettings={data.bankSettings}
      cardDetails={cardDetails}
      setCardDetails={setCardDetails}
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
        `Bloke kredi: ${data.blockedCredits}`,
        paymentMethod === 'credit'
          ? 'Kredi odemesinde sepet kredi maliyeti de hesaplanir.'
          : paymentMethod === 'iban'
            ? 'IBAN seciminde banka bilgileri altta acilir ve siparis onay akisina girer.'
            : 'Kart seciminde kart sahibi, numara, son kullanma ve CVV bilgileri zorunlu olur.',
      ]}
    />
  );
}