import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import StatCard from '../../components/StatCard';
import { theme } from '../../config/theme';
import {
	getTrainerCommerceOverview,
	submitCreditRequest,
	submitManualCreditPurchase,
	submitWithdrawalRequest,
} from '../../services/trainerService';
import { useAuthStore } from '../../store/authStore';

export default function TrainerFinanceOpsScreen({ navigation }) {
	const profile = useAuthStore((state) => state.profile);
	const queryClient = useQueryClient();
	const commerceQuery = useQuery({
		queryKey: ['tr-commerce', profile?.uid],
		queryFn: () => getTrainerCommerceOverview(profile),
		enabled: Boolean(profile?.uid),
	});

	const [creditAmount, setCreditAmount] = useState('');
	const [creditDescription, setCreditDescription] = useState('');
	const [selectedPackageId, setSelectedPackageId] = useState('');
	const [purchaseNote, setPurchaseNote] = useState('');
	const [receiptAsset, setReceiptAsset] = useState(null);
	const [withdrawAmount, setWithdrawAmount] = useState('');
	const [paymentMethod, setPaymentMethod] = useState('eft');
	const [iban, setIban] = useState('');
	const [accountName, setAccountName] = useState('');
	const [walletAddress, setWalletAddress] = useState('');
	const [network, setNetwork] = useState('');
	const [coinType, setCoinType] = useState('');

	function invalidate() {
		queryClient.invalidateQueries({ queryKey: ['tr-commerce', profile.uid] });
		queryClient.invalidateQueries({ queryKey: ['tr-dashboard', profile.uid] });
	}

	async function pickReceipt() {
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			quality: 0.7,
			base64: false,
		});

		if (!result.canceled && result.assets?.length) {
			setReceiptAsset(result.assets[0]);
		}
	}

	const creditRequestMutation = useMutation({
		mutationFn: () => submitCreditRequest({ profile, amount: creditAmount, description: creditDescription }),
		onSuccess: () => {
			setCreditAmount('');
			setCreditDescription('');
			invalidate();
		},
		onError: (error) => Alert.alert('Kredi talebi', error.message || 'Talep kaydedilemedi.'),
	});

	const purchaseMutation = useMutation({
		mutationFn: async () => {
			const packageItem = commerceQuery.data.creditPackages.find((item) => item.id === selectedPackageId);
			if (!packageItem) throw new Error('Kredi paketi secilmedi.');
			if (!receiptAsset?.uri) throw new Error('Dekont secilmedi.');
			const base64 = await FileSystem.readAsStringAsync(receiptAsset.uri, { encoding: FileSystem.EncodingType.Base64 });
			return submitManualCreditPurchase({
				profile,
				packageItem,
				note: purchaseNote,
				receiptBase64: base64,
				receiptMimeType: receiptAsset.mimeType || 'image/jpeg',
				receiptFileName: receiptAsset.fileName || 'dekont.jpg',
			});
		},
		onSuccess: () => {
			setPurchaseNote('');
			setReceiptAsset(null);
			invalidate();
		},
		onError: (error) => Alert.alert('Kredi satin alma', error.message || 'Talep gonderilemedi.'),
	});

	const withdrawalMutation = useMutation({
		mutationFn: () => submitWithdrawalRequest({
			profile,
			amount: withdrawAmount,
			paymentMethod,
			iban,
			accountName,
			walletAddress,
			network,
			coinType,
		}),
		onSuccess: () => {
			setWithdrawAmount('');
			setIban('');
			setAccountName('');
			setWalletAddress('');
			setNetwork('');
			setCoinType('');
			invalidate();
		},
		onError: (error) => Alert.alert('Bozdurma', error.message || 'Bozdurma talebi gonderilemedi.'),
	});

	if (commerceQuery.isLoading) {
		return <LoadingBlock label="Kredi ve finans modulu yukleniyor..." />;
	}

	if (commerceQuery.isError || !commerceQuery.data) {
		return (
			<ScreenLayout title="Kredi ve Finans" subtitle="Veri alinirken hata olustu.">
				<EmptyState
					title="Finans modulu acilamadi"
					description={commerceQuery.error?.message || 'Kredi ve finans verileri okunurken hata olustu.'}
				/>
				<ActionButton label="Tekrar Dene" onPress={() => commerceQuery.refetch()} fullWidth />
			</ScreenLayout>
		);
	}

	const data = commerceQuery.data;
	const selectedPackage = data.creditPackages.find((item) => item.id === selectedPackageId) || null;
	const rateLabel = data.exchangeRate
		? `${data.exchangeRate.creditAmount} kredi = ${data.exchangeRate.turAmount} TL`
		: 'Tanimli oran yok';
	const withdrawPreview = data.exchangeRate
		? ((Number(withdrawAmount || 0) * Number(data.exchangeRate.turAmount || 0)) / Math.max(Number(data.exchangeRate.creditAmount || 1), 1)).toFixed(2)
		: '0.00';
	const shoppableOrderCount = data.orders.filter((item) => item.type !== 'credit_package_purchase').length;
	const activeOrderCount = data.orders.filter((item) => ['pending', 'confirmed', 'preparing', 'shipped'].includes(item.status)).length;
	const latestShopOrder = data.orders.find((item) => item.type !== 'credit_package_purchase') || null;

	return (
		<ScreenLayout title="Kredi ve Finans" subtitle="Kredi talepleri, EFT ile paket satin alma, alisveris yonlendirmesi ve bozdurma akislarini yonet.">
			<View style={styles.statsGrid}>
				<StatCard label="Kredi" value={data.creditBalance} />
				<StatCard label="Bloke kredi" value={data.blockedCredits} />
				<StatCard label="Bekleyen talepler" value={data.creditRequests.filter((item) => item.status === 'pending').length} />
				<StatCard label="Bekleyen bozdurma" value={data.withdrawals.filter((item) => item.status === 'pending').length} />
			</View>

			<SectionHeader title="Alisveris" caption="Market artik ayri vitrinde yonetiliyor" />
			<View style={styles.card}>
				<Text style={styles.itemTitle}>Magaza artik ayri bir ekranda</Text>
				<Text style={styles.itemText}>{data.products.length} urun vitrinde yayinda.</Text>
				<Text style={styles.itemText}>{shoppableOrderCount ? `${shoppableOrderCount} alisveris siparisiniz var.` : 'Henuz alisveris siparisiniz yok.'}</Text>
				{activeOrderCount ? <Text style={styles.itemText}>Aktif siparis: {activeOrderCount}</Text> : null}
				{latestShopOrder ? (
					<View style={styles.subCard}>
						<Text style={styles.itemTitle}>{latestShopOrder.orderTitle || latestShopOrder.productName || 'Son siparis'}</Text>
						<Text style={styles.itemText}>Durum: {latestShopOrder.status || 'pending'}</Text>
						<Text style={styles.itemText}>Toplam: ₺{Number(latestShopOrder.totalAmount || 0).toFixed(2)} {latestShopOrder.totalCredits ? `| ${latestShopOrder.totalCredits} kredi` : ''}</Text>
					</View>
				) : null}
				<ActionButton label="Alisverise Git" onPress={() => navigation.navigate('TRShoppingOps')} fullWidth />
			</View>

			<SectionHeader title="Kredi talebi" caption="Super admin onayina duser" />
			<View style={styles.card}>
				<TextInput style={styles.input} placeholder="Talep edilen kredi" keyboardType="numeric" value={creditAmount} onChangeText={setCreditAmount} />
				<TextInput style={[styles.input, styles.textarea]} multiline placeholder="Aciklama" value={creditDescription} onChangeText={setCreditDescription} />
				<ActionButton label={creditRequestMutation.isPending ? 'Gonderiliyor...' : 'Kredi Talebi Gonder'} onPress={() => creditRequestMutation.mutate()} fullWidth />
				{data.creditRequests.map((item) => (
					<View key={item.id} style={styles.subCard}>
						<Text style={styles.itemTitle}>{item.amount} kredi</Text>
						<Text style={styles.itemText}>{item.description}</Text>
						<Text style={styles.itemText}>Durum: {item.status}</Text>
					</View>
				))}
			</View>

			<SectionHeader title="Kredi paketi satin alma" caption="Dekont ile EFT siparisi olustur" />
			<View style={styles.card}>
				<Text style={styles.bankInfoTitle}>Banka bilgileri</Text>
				<Text style={styles.itemText}>Banka: {data.creditPurchaseSettings?.bankName || '-'}</Text>
				<Text style={styles.itemText}>Hesap sahibi: {data.creditPurchaseSettings?.accountHolder || '-'}</Text>
				<Text style={styles.itemText}>IBAN: {data.creditPurchaseSettings?.iban || '-'}</Text>
				{data.creditPurchaseSettings?.note ? <Text style={styles.itemText}>{data.creditPurchaseSettings.note}</Text> : null}
				<Text style={styles.label}>Paket sec</Text>
				<View style={styles.chipRow}>
					{data.creditPackages.map((item) => (
						<ActionButton key={item.id} label={`${item.credit} kredi | ${item.price} TL`} variant={selectedPackageId === item.id ? 'primary' : 'secondary'} onPress={() => setSelectedPackageId(item.id)} />
					))}
				</View>
				{selectedPackage ? <Text style={styles.itemText}>Secilen paket: {selectedPackage.credit} kredi | {selectedPackage.price} TL</Text> : null}
				<TextInput style={[styles.input, styles.textarea]} multiline placeholder="Aciklama / EFT notu" value={purchaseNote} onChangeText={setPurchaseNote} />
				<ActionButton label={receiptAsset ? 'Dekontu Degistir' : 'Dekont Sec'} variant="secondary" onPress={pickReceipt} />
				{receiptAsset ? <Text style={styles.itemText}>Secilen dosya: {receiptAsset.fileName || receiptAsset.uri}</Text> : null}
				<ActionButton label={purchaseMutation.isPending ? 'Gonderiliyor...' : 'EFT Siparisini Gonder'} onPress={() => purchaseMutation.mutate()} fullWidth />
				{data.orders.filter((item) => item.type === 'credit_package_purchase').map((item) => (
					<View key={item.id} style={styles.subCard}>
						<Text style={styles.itemTitle}>{item.packageName}</Text>
						<Text style={styles.itemText}>{item.totalAmount} TL | Durum: {item.status}</Text>
						<Text style={styles.itemText}>{item.note}</Text>
					</View>
				))}
			</View>

			<SectionHeader title="Kredi bozdurma" caption="TL veya kripto odemesi icin talep ac" />
			<View style={styles.card}>
				<Text style={styles.itemText}>Guncel oran: {rateLabel}</Text>
				<TextInput style={styles.input} placeholder="Bozdurulacak kredi" keyboardType="numeric" value={withdrawAmount} onChangeText={setWithdrawAmount} />
				<Text style={styles.itemText}>Tahmini odeme: {withdrawPreview} TL</Text>
				<View style={styles.chipRow}>
					<ActionButton label="EFT" variant={paymentMethod === 'eft' ? 'primary' : 'secondary'} onPress={() => setPaymentMethod('eft')} />
					<ActionButton label="Kripto" variant={paymentMethod === 'crypto' ? 'primary' : 'secondary'} onPress={() => setPaymentMethod('crypto')} />
				</View>
				{paymentMethod === 'eft' ? (
					<>
						<TextInput style={styles.input} placeholder="IBAN" value={iban} onChangeText={setIban} />
						<TextInput style={styles.input} placeholder="Hesap sahibi" value={accountName} onChangeText={setAccountName} />
					</>
				) : (
					<>
						<TextInput style={styles.input} placeholder="Cuzdan adresi" value={walletAddress} onChangeText={setWalletAddress} />
						<TextInput style={styles.input} placeholder="Ag" value={network} onChangeText={setNetwork} />
						<TextInput style={styles.input} placeholder="Coin tipi" value={coinType} onChangeText={setCoinType} />
					</>
				)}
				<ActionButton label={withdrawalMutation.isPending ? 'Gonderiliyor...' : 'Bozdurma Talebi Ac'} onPress={() => withdrawalMutation.mutate()} fullWidth />
				{data.withdrawals.map((item) => (
					<View key={item.id} style={styles.subCard}>
						<Text style={styles.itemTitle}>{item.creditAmount} kredi | {Number(item.turAmount || 0).toFixed(2)} TL</Text>
						<Text style={styles.itemText}>Odeme yontemi: {item.paymentMethod}</Text>
						<Text style={styles.itemText}>Durum: {item.status}</Text>
					</View>
				))}
			</View>
		</ScreenLayout>
	);
}

const styles = StyleSheet.create({
	statsGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 12,
	},
	card: {
		backgroundColor: theme.colors.surface,
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.md,
		padding: theme.spacing.md,
		gap: 10,
	},
	subCard: {
		backgroundColor: '#fbfdff',
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.md,
		padding: theme.spacing.md,
		gap: 4,
	},
	orderRow: {
		paddingTop: 10,
		borderTopWidth: 1,
		borderTopColor: theme.colors.border,
		gap: 4,
	},
	cartRow: {
		gap: 8,
		paddingVertical: 8,
		borderTopWidth: 1,
		borderTopColor: theme.colors.border,
	},
	cartMeta: {
		gap: 4,
	},
	chipRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
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
		minHeight: 90,
		paddingVertical: 12,
		textAlignVertical: 'top',
	},
	label: {
		color: theme.colors.text,
		fontWeight: '700',
	},
	itemTitle: {
		color: theme.colors.text,
		fontWeight: '800',
		fontSize: 15,
	},
	itemText: {
		color: theme.colors.textMuted,
	},
	bankInfoTitle: {
		color: theme.colors.primaryDeep,
		fontWeight: '800',
	},
});