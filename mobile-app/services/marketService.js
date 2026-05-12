import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import { db } from '../config/firebase';
import { createAppNotification } from './notificationService';
import { nowIso, sortByDateDesc } from '../utils/date';

const marketStatusMetaMap = {
  pending: {
    label: 'Siparis alindi',
    shortLabel: 'Alindi',
    tone: 'warning',
    description: 'Siparisiniz sisteme dustu ve kontrol bekliyor.',
  },
  confirmed: {
    label: 'Onaylandi',
    shortLabel: 'Onay',
    tone: 'info',
    description: 'Siparis kontrol edildi ve isleme alindi.',
  },
  preparing: {
    label: 'Hazirlaniyor',
    shortLabel: 'Hazirlaniyor',
    tone: 'primary',
    description: 'Siparisiniz hazirlaniyor.',
  },
  shipped: {
    label: 'Kargoda',
    shortLabel: 'Kargo',
    tone: 'primary',
    description: 'Siparisiniz sevk edildi.',
  },
  delivered: {
    label: 'Teslim edildi',
    shortLabel: 'Teslim',
    tone: 'success',
    description: 'Siparisiniz teslim edildi.',
  },
  cancelled: {
    label: 'Iptal edildi',
    shortLabel: 'Iptal',
    tone: 'danger',
    description: 'Siparis iptal edildi.',
  },
};

function toNumber(value, fallback = 0) {
  if (value === '' || value === null || typeof value === 'undefined') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function roundCurrency(value) {
  return Math.round(toNumber(value, 0) * 100) / 100;
}

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeCardExpiry(value) {
  const digits = normalizeDigits(value).slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function detectCardBrand(cardNumber) {
  const digits = normalizeDigits(cardNumber);
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'American Express';
  if (/^6(?:011|5)/.test(digits)) return 'Discover';
  return 'Bilinmiyor';
}

function isExpiredCardExpiry(expiry) {
  const normalized = normalizeCardExpiry(expiry);
  const [monthText, yearText] = normalized.split('/');
  const month = Number(monthText || 0);
  const yearSuffix = Number(yearText || 0);
  if (!month || !yearSuffix) {
    return true;
  }

  const fullYear = yearSuffix < 100 ? 2000 + yearSuffix : yearSuffix;
  const expiryDate = new Date(fullYear, month, 0, 23, 59, 59, 999);
  return Number.isNaN(expiryDate.getTime()) || expiryDate.getTime() < Date.now();
}

async function listAll(collectionName, constraints = []) {
  const snapshot = constraints.length
    ? await getDocs(query(collection(db, collectionName), ...constraints))
    : await getDocs(collection(db, collectionName));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export function getMarketStatusMeta(status) {
  return marketStatusMetaMap[status] || marketStatusMetaMap.pending;
}

export function normalizeCreditCardDetails(details = {}) {
  return {
    holderName: normalizeText(details.holderName || details.cardHolderName || '').replace(/\s+/g, ' '),
    cardNumber: normalizeDigits(details.cardNumber).slice(0, 19),
    expiry: normalizeCardExpiry(details.expiry || details.cardExpiry || ''),
    cvv: normalizeDigits(details.cvv).slice(0, 4),
  };
}

export function validateCreditCardDetails(details = {}) {
  const normalized = normalizeCreditCardDetails(details);

  if (!normalized.holderName) {
    throw new Error('Kart uzerindeki ad soyad gerekli.');
  }
  if (normalized.cardNumber.length < 13 || normalized.cardNumber.length > 19) {
    throw new Error('Gecerli bir kart numarasi girin.');
  }
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(normalized.expiry)) {
    throw new Error('Son kullanma tarihini AA/YY formatinda girin.');
  }
  if (isExpiredCardExpiry(normalized.expiry)) {
    throw new Error('Kartin son kullanma tarihi gecmis gorunuyor.');
  }
  if (normalized.cvv.length < 3 || normalized.cvv.length > 4) {
    throw new Error('Gecerli bir CVV girin.');
  }

  return normalized;
}

export function buildCreditCardSnapshot(details = {}) {
  const normalized = validateCreditCardDetails(details);
  return {
    cardHolderNameSnapshot: normalized.holderName,
    cardLast4Snapshot: normalized.cardNumber.slice(-4),
    cardExpirySnapshot: normalized.expiry,
    cardBrandSnapshot: detectCardBrand(normalized.cardNumber),
  };
}

function normalizeOrderItems(order) {
  if (Array.isArray(order?.items) && order.items.length) {
    return order.items.map((item, index) => {
      const quantity = Math.max(1, toNumber(item.quantity, 1));
      const unitPrice = roundCurrency(item.unitPrice ?? item.price ?? 0);
      const unitCreditCost = toNumber(
        item.unitCreditCost ?? item.unitCredits ?? item.unitCreditsCost ?? item.creditCost ?? 0,
        0,
      );

      return {
        id: item.id || item.productId || `${order?.id || 'order'}_${index}`,
        productId: item.productId || item.id || '',
        productName: normalizeText(item.productName || item.name || 'Urun') || 'Urun',
        quantity,
        unitPrice,
        unitCreditCost,
        unitCredits: unitCreditCost,
        lineTotal: roundCurrency(item.lineTotal ?? unitPrice * quantity),
        lineCredits: toNumber(item.lineCredits ?? unitCreditCost * quantity, 0),
      };
    });
  }

  const legacyProductName = normalizeText(order?.productName || order?.packageName || order?.name || 'Urun');
  const legacyQuantity = Math.max(1, toNumber(order?.quantity, 1));
  const legacyTotalAmount = roundCurrency(order?.totalAmount ?? order?.amount ?? order?.productPrice ?? 0);
  const legacyTotalCredits = toNumber(order?.totalCredits, 0);

  return [{
    id: order?.productId || order?.id || 'legacy',
    productId: order?.productId || '',
    productName: legacyProductName || 'Urun',
    quantity: legacyQuantity,
    unitPrice: legacyQuantity > 0 ? roundCurrency(legacyTotalAmount / legacyQuantity) : legacyTotalAmount,
    unitCreditCost: legacyQuantity > 0 ? Math.round(legacyTotalCredits / legacyQuantity) : legacyTotalCredits,
    unitCredits: legacyQuantity > 0 ? Math.round(legacyTotalCredits / legacyQuantity) : legacyTotalCredits,
    lineTotal: legacyTotalAmount,
    lineCredits: legacyTotalCredits,
  }];
}

export function getMarketPaymentLabel(paymentMethod) {
  if (paymentMethod === 'credit') return 'Kredi';
  if (paymentMethod === 'iban') return 'Havale / EFT';
  if (paymentMethod === 'credit_card') return 'Kredi Karti';
  if (paymentMethod === 'cash') return 'Nakit';
  return normalizeText(paymentMethod) || '-';
}

export function buildInitialMarketStatusHistory({ actorId = '', actorRole = '', createdAt = '' } = {}) {
  const timestamp = createdAt || nowIso();
  return [{
    status: 'pending',
    label: getMarketStatusMeta('pending').label,
    createdAt: timestamp,
    actorId,
    actorRole,
    note: 'Siparis olusturuldu.',
  }];
}

function ensureStatusHistory(order) {
  if (Array.isArray(order?.statusHistory) && order.statusHistory.length) {
    return order.statusHistory.map((entry) => ({
      ...entry,
      label: normalizeText(entry.label) || getMarketStatusMeta(entry.status).label,
      createdAt: entry.createdAt || order.createdAt || nowIso(),
    }));
  }

  return buildInitialMarketStatusHistory({
    actorId: order?.buyerId || '',
    actorRole: order?.buyerRole || '',
    createdAt: order?.createdAt || nowIso(),
  });
}

export function normalizeMarketOrder(order) {
  const items = normalizeOrderItems(order);
  const itemCount = items.reduce((sum, item) => sum + toNumber(item.quantity, 0), 0);
  const totalAmount = roundCurrency(
    order?.totalAmount ?? items.reduce((sum, item) => sum + toNumber(item.lineTotal, 0), 0),
  );
  const totalCredits = toNumber(
    order?.totalCredits ?? items.reduce((sum, item) => sum + toNumber(item.lineCredits, 0), 0),
    0,
  );
  const status = normalizeText(order?.status) || 'pending';
  const statusHistory = ensureStatusHistory({ ...order, status });

  return {
    ...order,
    items,
    itemCount,
    totalAmount,
    totalCredits,
    orderTitle: normalizeText(order?.orderTitle)
      || (items.length === 1 ? items[0].productName : `${items.length} urunluk sepet`),
    paymentLabel: getMarketPaymentLabel(order?.paymentMethod),
    status,
    statusMeta: getMarketStatusMeta(status),
    statusHistory,
  };
}

export function buildReorderCartItems(order) {
  const normalized = normalizeMarketOrder(order);
  return normalized.items.map((item) => ({
    id: item.productId || item.id,
    productId: item.productId || item.id,
    name: item.productName,
    productName: item.productName,
    price: toNumber(item.unitPrice, 0),
    unitPrice: toNumber(item.unitPrice, 0),
    creditCost: toNumber(item.unitCreditCost, 0),
    unitCreditCost: toNumber(item.unitCreditCost, 0),
    quantity: Math.max(1, toNumber(item.quantity, 1)),
  }));
}

function isCampaignActive(campaign) {
  if (campaign?.active === false) {
    return false;
  }

  const startsAt = campaign?.startsAt ? new Date(campaign.startsAt).getTime() : 0;
  const endsAt = campaign?.endsAt ? new Date(campaign.endsAt).getTime() : Number.POSITIVE_INFINITY;
  const now = Date.now();
  return (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now);
}

function normalizeCampaign(campaign) {
  return {
    ...campaign,
    title: normalizeText(campaign?.title) || 'Kampanya',
    description: normalizeText(campaign?.description) || 'Market vitrini icin kampanya duyurusu.',
    badge: normalizeText(campaign?.badge) || 'Kampanya',
    code: normalizeText(campaign?.code),
    highlightText: normalizeText(campaign?.highlightText)
      || (toNumber(campaign?.discountPercent, 0) > 0 ? `%${toNumber(campaign.discountPercent, 0)} avantaj` : 'Sinirli sure'),
    imageUrl: normalizeText(campaign?.imageUrl),
  };
}

export async function listVisibleMarketCampaigns({ adminId = '' } = {}) {
  const campaigns = await listAll('market_campaigns').catch(() => []);
  return sortByDateDesc(
    campaigns
      .filter((campaign) => {
        if (!isCampaignActive(campaign)) {
          return false;
        }
        const scopeType = normalizeText(campaign.scopeType || 'admin') || 'admin';
        if (scopeType === 'global') {
          return true;
        }
        return !campaign.adminId || campaign.adminId === adminId;
      })
      .map(normalizeCampaign),
    'updatedAt',
  );
}

export async function saveMarketCampaign({
  adminId,
  values,
  currentUserId,
  currentUserRole,
  campaignId = null,
}) {
  const title = normalizeText(values?.title);
  if (!title) {
    throw new Error('Kampanya basligi gerekli.');
  }

  const payload = {
    adminId: normalizeText(adminId),
    scopeType: normalizeText(values?.scopeType || 'admin') || 'admin',
    title,
    description: normalizeText(values?.description),
    badge: normalizeText(values?.badge),
    code: normalizeText(values?.code).toUpperCase(),
    highlightText: normalizeText(values?.highlightText),
    imageUrl: normalizeText(values?.imageUrl),
    discountPercent: toNumber(values?.discountPercent, 0),
    startsAt: normalizeText(values?.startsAt),
    endsAt: normalizeText(values?.endsAt),
    active: values?.active !== false,
    updatedAt: nowIso(),
    updatedBy: currentUserId,
    updatedByRole: currentUserRole,
  };

  if (campaignId) {
    await updateDoc(doc(db, 'market_campaigns', campaignId), payload);
    return campaignId;
  }

  const created = await addDoc(collection(db, 'market_campaigns'), {
    ...payload,
    createdAt: nowIso(),
    createdBy: currentUserId,
    createdByRole: currentUserRole,
  });
  return created.id;
}

export async function deleteMarketCampaign(campaignId) {
  await deleteDoc(doc(db, 'market_campaigns', campaignId));
}

export async function listUserMarketFavorites(userId) {
  if (!userId) {
    return [];
  }
  return listAll('market_favorites', [where('userId', '==', userId)]).catch(() => []);
}

export async function toggleUserMarketFavorite({ userId, product }) {
  if (!userId || !product?.id) {
    throw new Error('Favori icin kullanici ve urun gerekli.');
  }

  const favoriteRef = doc(db, 'market_favorites', `${userId}_${product.id}`);
  const snapshot = await getDoc(favoriteRef);
  if (snapshot.exists()) {
    await deleteDoc(favoriteRef);
    return false;
  }

  await setDoc(favoriteRef, {
    userId,
    productId: product.id,
    productName: normalizeText(product.name || product.productName || 'Urun') || 'Urun',
    imageUrl: normalizeText(product.imageUrl),
    createdAt: nowIso(),
  });
  return true;
}

export async function updateMarketOrderStatus({
  orderId,
  nextStatus,
  currentUserId,
  currentUserRole,
  note = '',
  shippingCarrier = '',
  trackingNumber = '',
}) {
  const orderRef = doc(db, 'orders', orderId);
  const snapshot = await getDoc(orderRef);
  if (!snapshot.exists()) {
    throw new Error('Siparis bulunamadi.');
  }

  const currentOrder = normalizeMarketOrder({ id: snapshot.id, ...snapshot.data() });
  const cleanStatus = normalizeText(nextStatus) || currentOrder.status;
  const cleanNote = normalizeText(note);
  const cleanCarrier = normalizeText(shippingCarrier);
  const cleanTracking = normalizeText(trackingNumber);

  const payload = {
    status: cleanStatus,
    statusHistory: [
      ...currentOrder.statusHistory,
      {
        status: cleanStatus,
        label: getMarketStatusMeta(cleanStatus).label,
        createdAt: nowIso(),
        actorId: currentUserId,
        actorRole: currentUserRole,
        note: cleanNote,
        shippingCarrier: cleanCarrier,
        trackingNumber: cleanTracking,
      },
    ],
    updatedAt: nowIso(),
    updatedBy: currentUserId,
    updatedByRole: currentUserRole,
  };

  if (cleanCarrier) {
    payload.shippingCarrier = cleanCarrier;
  }
  if (cleanTracking) {
    payload.trackingNumber = cleanTracking;
  }
  if (cleanStatus === 'confirmed') {
    payload.confirmedAt = nowIso();
    payload.confirmedBy = currentUserId;
  }
  if (cleanStatus === 'preparing') {
    payload.preparingAt = nowIso();
  }
  if (cleanStatus === 'shipped') {
    payload.shippedAt = nowIso();
    payload.shippedBy = currentUserId;
  }
  if (cleanStatus === 'delivered') {
    payload.deliveredAt = nowIso();
    payload.deliveredBy = currentUserId;
  }

  await updateDoc(orderRef, payload);

  if (currentOrder.buyerId) {
    await createAppNotification({
      userId: currentOrder.buyerId,
      title: 'Siparis durumu guncellendi',
      message: `${currentOrder.orderTitle || 'Siparisiniz'} icin yeni durum: ${getMarketStatusMeta(cleanStatus).label}.`,
      type: 'market_order_status',
      data: {
        orderId,
        status: cleanStatus,
      },
    }).catch(() => null);
  }

  return normalizeMarketOrder({ ...currentOrder, ...payload });
}