import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import { createManagedAuthUser } from '../api/authApi';
import { db } from '../config/firebase';
import { getMarketStatusMeta, normalizeMarketOrder, updateMarketOrderStatus } from './marketService';
import { createAppNotification } from './notificationService';
import { nowIso, sortByDateDesc, todayIsoDate } from '../utils/date';

function toNumber(value, fallback = 0) {
  if (value === '' || value === null || typeof value === 'undefined') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildAdminStatus(admin) {
  const totalAmount = toNumber(admin.membershipPrice, 0);
  const paidAmount = toNumber(admin.membershipPaid, 0);
  const remainingAmount = Math.max(totalAmount - paidAmount, 0);
  const membershipEnd = admin.membershipEnd ? new Date(admin.membershipEnd) : null;
  const now = new Date();
  const isExpired = membershipEnd ? membershipEnd.getTime() < now.getTime() : false;
  const daysLeft = membershipEnd ? Math.ceil((membershipEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

  return {
    totalAmount,
    paidAmount,
    remainingAmount,
    isExpired,
    daysLeft,
    paymentStatus:
      paidAmount >= totalAmount && totalAmount > 0
        ? 'paid'
        : paidAmount > 0
          ? 'partial'
          : 'pending',
  };
}

function getOrderItems(order) {
  if (Array.isArray(order?.items) && order.items.length) {
    return order.items.map((item, index) => ({
      id: item.id || item.productId || `${order.id || 'order'}_${index}`,
      productId: item.productId || item.id || '',
      productName: item.productName || item.name || 'Urun',
      quantity: toNumber(item.quantity, 1),
      unitPrice: toNumber(item.unitPrice ?? item.price, 0),
      unitCreditCost: toNumber(item.unitCreditCost ?? item.creditCost, 0),
    }));
  }

  return [{
    id: order?.productId || order?.id || 'legacy',
    productId: order?.productId || '',
    productName: order?.productName || order?.packageName || 'Urun/Talep',
    quantity: toNumber(order?.quantity, 1),
    unitPrice: toNumber(order?.totalAmount ?? order?.amount, 0),
    unitCreditCost: toNumber(order?.totalCredits, 0),
  }];
}

function getOrderPaymentLabel(paymentMethod) {
  if (paymentMethod === 'credit') return 'Kredi';
  if (paymentMethod === 'iban') return 'Havale / EFT';
  if (paymentMethod === 'credit_card') return 'Kredi Karti';
  if (paymentMethod === 'cash') return 'Nakit';
  return paymentMethod || '-';
}

function normalizeOrder(order) {
  const items = getOrderItems(order);
  const itemCount = items.reduce((sum, item) => sum + toNumber(item.quantity, 0), 0) || 0;
  return {
    ...order,
    items,
    itemCount,
    orderTitle: order.orderTitle || (items.length === 1 ? items[0].productName : `${items.length} urunluk sepet`),
    paymentLabel: getOrderPaymentLabel(order.paymentMethod),
  };
}

async function listAll(collectionName, constraints = []) {
  const snapshot = constraints.length
    ? await getDocs(query(collection(db, collectionName), ...constraints))
    : await getDocs(collection(db, collectionName));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function addNotification(userId, title, message, type) {
  await createAppNotification({
    userId,
    title,
    message,
    type,
  });
}

export async function getSuperAdminDashboardData() {
  const [admins, applications, orders, creditRequests, withdrawals, ads] = await Promise.all([
    listAll('users', [where('role', '==', 'admin')]),
    listAll('applications'),
    listAll('orders'),
    listAll('credit_requests'),
    listAll('cash_withdrawal_requests'),
    listAll('advertisements'),
  ]);

  const normalizedAdmins = admins.map((admin) => ({ ...admin, metrics: buildAdminStatus(admin) }));

  return {
    stats: [
      { label: 'Toplam Admin', value: normalizedAdmins.length },
      { label: 'Bekleyen Basvuru', value: applications.filter((entry) => entry.status === 'pending').length },
      { label: 'Bekleyen Kredi Talebi', value: creditRequests.filter((entry) => entry.status === 'pending').length },
      { label: 'Bekleyen Siparis', value: orders.filter((entry) => entry.status === 'pending').length },
      { label: 'Bozdurma Talebi', value: withdrawals.filter((entry) => ['pending', 'processing'].includes(entry.status)).length },
      { label: 'Aktif Reklam', value: ads.filter((entry) => entry.active).length },
    ],
    pendingApplications: sortByDateDesc(applications.filter((entry) => entry.status === 'pending'), 'applicationDate').slice(0, 5),
    pendingOrders: sortByDateDesc(orders.filter((entry) => entry.status === 'pending')).slice(0, 5),
    adminAlerts: normalizedAdmins
      .filter((entry) => entry.metrics.isExpired || entry.metrics.paymentStatus !== 'paid')
      .slice(0, 6),
  };
}

export async function listAdminOverview() {
  const [admins, branches, trainers, students] = await Promise.all([
    listAll('users', [where('role', '==', 'admin')]),
    listAll('branches'),
    listAll('trainers'),
    listAll('students'),
  ]);

  return admins
    .map((admin) => {
      const adminBranches = branches.filter((branch) => branch.adminId === admin.id);
      const adminBranchIds = adminBranches.map((branch) => branch.id);
      const adminStudents = students.filter((student) => student.adminId === admin.id || adminBranchIds.includes(student.branchId));
      const adminTrainers = trainers.filter((trainer) => trainer.adminId === admin.id);

      return {
        ...admin,
        metrics: buildAdminStatus(admin),
        branchCount: adminBranches.length,
        trainerCount: adminTrainers.length,
        studentCount: adminStudents.length,
      };
    })
    .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'tr'));
}

export async function getAdminDetail(adminId) {
  const [userDoc, adminDoc, branches, trainers, students] = await Promise.all([
    getDoc(doc(db, 'users', adminId)),
    getDoc(doc(db, 'admins', adminId)),
    listAll('branches', [where('adminId', '==', adminId)]),
    listAll('trainers', [where('adminId', '==', adminId)]),
    listAll('students', [where('adminId', '==', adminId)]),
  ]);

  if (!userDoc.exists()) {
    throw new Error('Admin kaydi bulunamadi.');
  }

  const admin = {
    id: userDoc.id,
    ...userDoc.data(),
    adminProfile: adminDoc.exists() ? adminDoc.data() : null,
    branchCount: branches.length,
    trainerCount: trainers.length,
    studentCount: students.length,
    metrics: buildAdminStatus(userDoc.data()),
  };

  return admin;
}

export async function createOrUpdateAdmin({ values, currentSuperAdminId, existingAdminId = null, sourceApplicationId = null }) {
  const timestamp = nowIso();
  const payload = {
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
    phone: values.phone?.trim() || null,
    role: 'admin',
    membershipStart: values.membershipStart,
    membershipEnd: values.membershipEnd,
    membershipPrice: toNumber(values.membershipPrice),
    membershipInstallments: toNumber(values.membershipInstallments, 1),
    membershipPaid: toNumber(values.membershipPaid, 0),
    frozen: false,
  };

  if (existingAdminId) {
    await updateDoc(doc(db, 'users', existingAdminId), payload);
    await setDoc(
      doc(db, 'admins', existingAdminId),
      {
        uid: existingAdminId,
        ...payload,
        clubAddress: values.clubAddress?.trim() || null,
        updatedAt: timestamp,
        updatedBy: currentSuperAdminId,
      },
      { merge: true }
    );
    return existingAdminId;
  }

  const createdUser = await createManagedAuthUser({
    email: payload.email,
    password: values.password,
  });

  await setDoc(doc(db, 'users', createdUser.uid), {
    ...payload,
    createdAt: timestamp,
    createdBy: currentSuperAdminId,
  });

  await setDoc(doc(db, 'admins', createdUser.uid), {
    uid: createdUser.uid,
    ...payload,
    clubAddress: values.clubAddress?.trim() || null,
    createdAt: timestamp,
    createdBy: currentSuperAdminId,
  });

  if (sourceApplicationId) {
    await updateDoc(doc(db, 'applications', sourceApplicationId), {
      status: 'approved',
      reviewedAt: timestamp,
      approvedBy: currentSuperAdminId,
      adminUid: createdUser.uid,
    });
  }

  return createdUser.uid;
}

export async function deleteAdminCascade(adminId) {
  const [branches, trainers, students] = await Promise.all([
    listAll('branches', [where('adminId', '==', adminId)]),
    listAll('trainers', [where('adminId', '==', adminId)]),
    listAll('students', [where('adminId', '==', adminId)]),
  ]);

  for (const student of students) {
    await deleteDoc(doc(db, 'students', student.id)).catch(() => null);
  }

  for (const branch of branches) {
    await deleteDoc(doc(db, 'branches', branch.id)).catch(() => null);
  }

  for (const trainer of trainers) {
    if (trainer.uid) {
      await deleteDoc(doc(db, 'users', trainer.uid)).catch(() => null);
    }
    await deleteDoc(doc(db, 'trainers', trainer.id)).catch(() => null);
  }

  await deleteDoc(doc(db, 'admins', adminId)).catch(() => null);
  await deleteDoc(doc(db, 'users', adminId));
}

export async function processAdminPayment({ adminId, amount, paymentDate, currentSuperAdminId }) {
  const adminRef = doc(db, 'users', adminId);
  const adminDoc = await getDoc(adminRef);
  if (!adminDoc.exists()) {
    throw new Error('Admin kaydi bulunamadi.');
  }

  const admin = adminDoc.data();
  const totalAmount = toNumber(admin.membershipPrice, 0);
  const currentPaid = toNumber(admin.membershipPaid, 0);
  const nextPaid = currentPaid + toNumber(amount, 0);

  if (nextPaid > totalAmount) {
    throw new Error(`Odeme fazla. Kalan tutar: ₺${(totalAmount - currentPaid).toFixed(2)}`);
  }

  await updateDoc(adminRef, { membershipPaid: nextPaid });
  await addDoc(collection(db, 'adminPayments'), {
    adminId,
    adminName: admin.name,
    amount: toNumber(amount, 0),
    date: paymentDate || todayIsoDate(),
    newBalance: nextPaid,
    timestamp: nowIso(),
    recordedBy: currentSuperAdminId,
  });
}

export async function listApplicationsOverview() {
  const applications = await listAll('applications');
  return sortByDateDesc(applications, 'applicationDate');
}

export async function updateApplicationStatus({ applicationId, status, currentSuperAdminId, reason = '' }) {
  const payload = {
    status,
    reviewedAt: nowIso(),
    reviewedBy: currentSuperAdminId,
  };

  if (reason) {
    payload.rejectionReason = reason;
  }

  await updateDoc(doc(db, 'applications', applicationId), payload);
}

export async function listCreditRequestsOverview() {
  const requests = await listAll('credit_requests');
  return sortByDateDesc(requests, 'createdAt');
}

export async function listTrainerCreditBalances() {
  const [trainers, credits] = await Promise.all([
    listAll('users', [where('role', '==', 'trainer')]),
    listAll('user_credits'),
  ]);

  return trainers.map((trainer) => {
    const wallet = credits.find((entry) => entry.id === trainer.id);
    return {
      ...trainer,
      balance: toNumber(wallet?.balance, 0),
      blockedCredits: toNumber(wallet?.blockedCredits, 0),
      lastUpdated: wallet?.lastUpdated || null,
    };
  });
}

export async function addCreditToTrainer({ trainerId, amount, description, currentSuperAdminId }) {
  const walletRef = doc(db, 'user_credits', trainerId);
  const walletDoc = await getDoc(walletRef);
  const currentBalance = walletDoc.exists() ? toNumber(walletDoc.data().balance, 0) : 0;
  const nextBalance = currentBalance + toNumber(amount, 0);

  if (nextBalance < 0) {
    throw new Error('Bu islem bakiyeyi negatife dusurur.');
  }

  await setDoc(walletRef, { balance: nextBalance, lastUpdated: nowIso() }, { merge: true });
  await addDoc(collection(db, 'credit_transactions'), {
    userId: trainerId,
    amount: toNumber(amount, 0),
    type: toNumber(amount, 0) >= 0 ? 'admin_added' : 'admin_removed',
    description,
    balanceAfter: nextBalance,
    referenceId: null,
    timestamp: nowIso(),
    actorId: currentSuperAdminId,
  });
}

export async function approveCreditRequest({ requestId, currentSuperAdminId }) {
  const requestRef = doc(db, 'credit_requests', requestId);
  const requestDoc = await getDoc(requestRef);
  if (!requestDoc.exists()) {
    throw new Error('Kredi talebi bulunamadi.');
  }

  const request = requestDoc.data();
  await addCreditToTrainer({
    trainerId: request.trainerId,
    amount: request.amount,
    description: `Kredi talebi onaylandi: ${request.description || ''}`.trim(),
    currentSuperAdminId,
  });

  await updateDoc(requestRef, {
    status: 'approved',
    approvedAt: nowIso(),
    approvedBy: currentSuperAdminId,
  });
}

export async function rejectCreditRequest({ requestId, currentSuperAdminId }) {
  await updateDoc(doc(db, 'credit_requests', requestId), {
    status: 'rejected',
    rejectedAt: nowIso(),
    rejectedBy: currentSuperAdminId,
  });
}

export async function listProductsOverview() {
  const products = await listAll('products');
  return sortByDateDesc(products);
}

export async function saveProduct({ values, currentSuperAdminId, productId = null }) {
  const payload = {
    name: values.name.trim(),
    price: toNumber(values.price),
    creditCost: toNumber(values.creditCost),
    description: values.description?.trim() || '',
    imageUrl: values.imageUrl?.trim() || '',
  };

  if (productId) {
    await updateDoc(doc(db, 'products', productId), {
      ...payload,
      updatedAt: nowIso(),
      updatedBy: currentSuperAdminId,
    });
    return productId;
  }

  const created = await addDoc(collection(db, 'products'), {
    ...payload,
    createdAt: nowIso(),
    createdBy: currentSuperAdminId,
  });
  return created.id;
}

export async function deleteProduct(productId) {
  await deleteDoc(doc(db, 'products', productId));
}

export async function listOrdersOverview() {
  const orders = await listAll('orders');
  return sortByDateDesc(orders).map((order) => normalizeMarketOrder(normalizeOrder(order)));
}

export async function updateOrderFulfillmentStatus({
  orderId,
  nextStatus,
  note = '',
  shippingCarrier = '',
  trackingNumber = '',
  currentSuperAdminId,
}) {
  const orderRef = doc(db, 'orders', orderId);
  const orderDoc = await getDoc(orderRef);
  if (!orderDoc.exists()) {
    throw new Error('Siparis bulunamadi.');
  }

  const order = { id: orderDoc.id, ...orderDoc.data() };
  const shouldGrantCredits = nextStatus === 'confirmed'
    && order.type === 'credit_package_purchase'
    && order.buyerId
    && !order.creditsGrantedAt;
  const grantedAt = shouldGrantCredits ? nowIso() : '';

  if (shouldGrantCredits) {
    await addCreditToTrainer({
      trainerId: order.buyerId,
      amount: toNumber(order.packageCredit, 0),
      description: `Kredi paketi onayi: ${order.packageName || order.id}`,
      currentSuperAdminId,
    });
  }

  const updatedOrder = await updateMarketOrderStatus({
    orderId,
    nextStatus,
    currentUserId: currentSuperAdminId,
    currentUserRole: 'superadmin',
    note,
    shippingCarrier,
    trackingNumber,
  });

  if (grantedAt) {
    await updateDoc(orderRef, { creditsGrantedAt: grantedAt });
    return { ...updatedOrder, creditsGrantedAt: grantedAt };
  }

  return updatedOrder;
}

export async function confirmOrder({ orderId, currentSuperAdminId }) {
  return updateOrderFulfillmentStatus({
    orderId,
    nextStatus: 'confirmed',
    note: 'Siparis super admin tarafindan onaylandi.',
    currentSuperAdminId,
  });
}

export async function listCreditPackagesOverview() {
  const [packages, bankSettings] = await Promise.all([
    listAll('credit_packages'),
    getDoc(doc(db, 'app_settings', 'credit_purchase_bank')),
  ]);

  return {
    packages: packages.sort((left, right) => toNumber(left.credit) - toNumber(right.credit)),
    bankSettings: bankSettings.exists() ? bankSettings.data() : null,
  };
}

export async function saveCreditPackage({ credit, price }) {
  await addDoc(collection(db, 'credit_packages'), {
    credit: toNumber(credit),
    price: toNumber(price),
    createdAt: nowIso(),
  });
}

export async function deleteCreditPackage(packageId) {
  await deleteDoc(doc(db, 'credit_packages', packageId));
}

export async function saveCreditPurchaseBankSettings({ values, currentSuperAdminId }) {
  await setDoc(doc(db, 'app_settings', 'credit_purchase_bank'), {
    bankName: values.bankName.trim(),
    accountHolder: values.accountHolder.trim(),
    iban: values.iban.trim(),
    note: values.note?.trim() || '',
    updatedAt: nowIso(),
    updatedBy: currentSuperAdminId,
  });
}

export async function listAdvertisementsOverview() {
  const [ads, activeHomepage] = await Promise.all([
    listAll('advertisements'),
    getDoc(doc(db, 'homepage_settings', 'advertisement')),
  ]);

  return {
    ads: sortByDateDesc(ads),
    activeHomepageAd: activeHomepage.exists() ? activeHomepage.data() : null,
  };
}

export async function saveAdvertisement({ values, currentSuperAdminId, advertisementId = null }) {
  const payload = {
    title: values.title.trim(),
    description: values.description?.trim() || '',
    link: values.link?.trim() || '',
    imageUrl: values.imageUrl?.trim() || '',
    videoUrl: values.videoUrl?.trim() || '',
  };

  if (advertisementId) {
    await updateDoc(doc(db, 'advertisements', advertisementId), {
      ...payload,
      updatedAt: nowIso(),
      updatedBy: currentSuperAdminId,
    });
    return advertisementId;
  }

  const created = await addDoc(collection(db, 'advertisements'), {
    ...payload,
    active: false,
    createdAt: nowIso(),
    createdBy: currentSuperAdminId,
  });
  return created.id;
}

export async function deleteAdvertisement(advertisementId) {
  await deleteDoc(doc(db, 'advertisements', advertisementId));
}

export async function activateHomepageAdvertisement({ advertisementId, currentSuperAdminId }) {
  const adRef = doc(db, 'advertisements', advertisementId);
  const adDoc = await getDoc(adRef);
  if (!adDoc.exists()) {
    throw new Error('Reklam bulunamadi.');
  }

  const ad = adDoc.data();
  const ads = await listAll('advertisements', [where('active', '==', true)]);
  await Promise.all(
    ads.map((entry) => updateDoc(doc(db, 'advertisements', entry.id), { active: false, removedAt: nowIso() }))
  );

  await updateDoc(adRef, {
    active: true,
    placedOnHomepage: true,
    placedAt: nowIso(),
  });

  await setDoc(doc(db, 'homepage_settings', 'advertisement'), {
    advertisementId,
    title: ad.title || '',
    description: ad.description || '',
    link: ad.link || '',
    imageUrl: ad.imageUrl || null,
    videoUrl: ad.videoUrl || null,
    updatedAt: nowIso(),
    updatedBy: currentSuperAdminId,
  });
}

export async function clearHomepageAdvertisement() {
  const ads = await listAll('advertisements', [where('active', '==', true)]);
  await Promise.all(
    ads.map((entry) => updateDoc(doc(db, 'advertisements', entry.id), { active: false, removedAt: nowIso() }))
  );
  await deleteDoc(doc(db, 'homepage_settings', 'advertisement')).catch(() => null);
}

export async function listStandardsOverview() {
  const standards = await listAll('standards');
  return standards.sort((left, right) => {
    if (Number(left.birthYear || 0) !== Number(right.birthYear || 0)) {
      return Number(right.birthYear || 0) - Number(left.birthYear || 0);
    }
    return String(left.name || '').localeCompare(String(right.name || ''), 'tr');
  });
}

export async function saveStandard({ values, currentSuperAdminId, standardId = null }) {
  const payload = {
    name: values.name.trim(),
    birthYear: toNumber(values.birthYear),
    gender: values.gender,
    style: values.style,
    distance: toNumber(values.distance),
    time: String(values.time || '').trim().replace(/,/g, '.'),
    scopeType: 'global',
    adminId: null,
    sourceType: standardId ? 'manual-edit' : 'manual',
  };

  if (standardId) {
    await updateDoc(doc(db, 'standards', standardId), {
      ...payload,
      updatedAt: nowIso(),
      updatedBy: currentSuperAdminId,
    });
    return standardId;
  }

  const created = await addDoc(collection(db, 'standards'), {
    ...payload,
    createdAt: nowIso(),
    createdBy: currentSuperAdminId,
    createdByRole: 'superadmin',
  });
  return created.id;
}

export async function deleteStandard(standardId) {
  await deleteDoc(doc(db, 'standards', standardId));
}

export async function listRaceImportOverview() {
  const [imports, performances] = await Promise.all([
    listAll('race_result_imports'),
    listAll('performances'),
  ]);

  return {
    imports: sortByDateDesc(imports),
    latestPerformances: sortByDateDesc(performances).slice(0, 20),
  };
}

function normalizeBulkStandardTime(value) {
  return String(value || '').trim().replace(',', '.');
}

function parseBulkStandardRow(rawRow) {
  const text = String(rawRow || '').trim();
  if (!text || text.startsWith('#') || text.startsWith('//')) return null;
  const parts = text.split(/[\t;,|]\s*/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 5) {
    throw new Error('Beklenen format: Cinsiyet, Dogum Yili, Stil, Mesafe, Sure (opsiyonel Baraj Adi)');
  }
  const [genderRaw, birthYearRaw, styleRaw, distanceRaw, timeRaw, ...nameParts] = parts;
  const gender = /^(e|m|er)/i.test(genderRaw) ? 'Erkek' : /^(k|f|kı|ki)/i.test(genderRaw) ? 'Kiz' : genderRaw;
  const birthYear = toNumber(birthYearRaw);
  if (!birthYear || birthYear < 1980 || birthYear > 2040) {
    throw new Error(`Gecersiz dogum yili: ${birthYearRaw}`);
  }
  const distance = toNumber(distanceRaw);
  if (!distance) {
    throw new Error(`Gecersiz mesafe: ${distanceRaw}`);
  }
  const time = normalizeBulkStandardTime(timeRaw);
  if (!/^\d{1,2}:\d{2}\.\d{1,2}$/.test(time) && !/^\d{1,2}\.\d{1,2}$/.test(time)) {
    throw new Error(`Gecersiz sure: ${timeRaw}`);
  }
  return {
    name: nameParts.join(' ').trim() || 'Toplu Eklenen Baraj',
    birthYear,
    gender,
    style: styleRaw.trim() || 'Serbest',
    distance,
    time: time.includes(':') ? time : `0:${time.padStart(5, '0')}`,
  };
}

export function parseBulkStandardsText(text) {
  const preview = [];
  const errors = [];
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    try {
      const item = parseBulkStandardRow(trimmed);
      if (item) preview.push(item);
    } catch (error) {
      errors.push({ line: index + 1, reason: error.message, rawLine: trimmed });
    }
  });
  return { preview, errors };
}

export async function bulkImportStandards({ items, currentSuperAdminId }) {
  if (!Array.isArray(items) || !items.length) {
    throw new Error('Kaydedilecek baraj bulunamadi.');
  }
  const importBatchId = `bulk-${Date.now()}`;
  let imported = 0;
  for (const item of items) {
    await addDoc(collection(db, 'standards'), {
      ...item,
      scopeType: 'global',
      adminId: null,
      sourceType: 'bulk-mobile',
      createdAt: nowIso(),
      createdBy: currentSuperAdminId,
      createdByRole: 'superadmin',
      importBatchId,
    });
    imported += 1;
  }
  return { imported, importBatchId };
}

export async function submitStandardsPdfUploadRequest({ fileName, fileSize, dataUrl, currentSuperAdminId }) {
  if (!dataUrl) {
    throw new Error('Yuklenecek PDF dosyasi bulunamadi.');
  }
  const created = await addDoc(collection(db, 'standards_pdf_uploads'), {
    fileName: fileName || 'baraj.pdf',
    fileSize: Number(fileSize || 0),
    dataUrl,
    status: 'pending-web-processing',
    submittedBy: currentSuperAdminId,
    submittedByRole: 'superadmin',
    submittedFrom: 'mobile',
    createdAt: nowIso(),
  });
  return { id: created.id };
}

export async function getExchangeRateSettings() {
  const snapshot = await getDoc(doc(db, 'app_settings', 'credit_exchange_rate'));
  if (!snapshot.exists()) {
    return {
      creditAmount: 100,
      turAmount: 50,
    };
  }

  return snapshot.data();
}

export async function saveExchangeRateSettings({ creditAmount, turAmount, currentSuperAdminId }) {
  await setDoc(doc(db, 'app_settings', 'credit_exchange_rate'), {
    creditAmount: toNumber(creditAmount),
    turAmount: toNumber(turAmount),
    updatedAt: nowIso(),
    updatedBy: currentSuperAdminId,
  });
}

export async function listWithdrawalRequestsOverview() {
  const requests = await listAll('cash_withdrawal_requests');
  return sortByDateDesc(requests).filter((entry) => ['pending', 'processing'].includes(entry.status));
}

export async function approveWithdrawalRequest({ requestId, currentSuperAdminId }) {
  const requestRef = doc(db, 'cash_withdrawal_requests', requestId);
  const requestDoc = await getDoc(requestRef);
  if (!requestDoc.exists()) {
    throw new Error('Talep bulunamadi.');
  }

  const request = requestDoc.data();
  await updateDoc(requestRef, {
    status: 'processing',
    approvedAt: nowIso(),
    approvedBy: currentSuperAdminId,
  });

  await addNotification(
    request.trainerId,
    'Kredi Bozdurma Talebiniz Onaylandi',
    'Odeme 40 dakika icinde yapilacaktir.',
    'cash_withdrawal'
  );
}

export async function rejectWithdrawalRequest({ requestId, reason, currentSuperAdminId }) {
  const requestRef = doc(db, 'cash_withdrawal_requests', requestId);
  const requestDoc = await getDoc(requestRef);
  if (!requestDoc.exists()) {
    throw new Error('Talep bulunamadi.');
  }

  const request = requestDoc.data();
  const walletRef = doc(db, 'user_credits', request.trainerId);

  await runTransaction(db, async (transaction) => {
    const walletDoc = await transaction.get(walletRef);
    const balance = walletDoc.exists() ? toNumber(walletDoc.data().balance, 0) : 0;
    const blockedCredits = walletDoc.exists() ? toNumber(walletDoc.data().blockedCredits, 0) : 0;

    transaction.set(
      walletRef,
      {
        balance: balance + toNumber(request.creditAmount, 0),
        blockedCredits: Math.max(0, blockedCredits - toNumber(request.creditAmount, 0)),
        lastUpdated: nowIso(),
      },
      { merge: true }
    );
  });

  await addDoc(collection(db, 'credit_transactions'), {
    userId: request.trainerId,
    amount: toNumber(request.creditAmount, 0),
    type: 'cash_withdrawal_release',
    description: `Bozdurma talebi reddedildi: ${reason}`,
    referenceId: requestId,
    timestamp: nowIso(),
  });

  await updateDoc(requestRef, {
    status: 'rejected',
    rejectionReason: reason,
    rejectedAt: nowIso(),
    rejectedBy: currentSuperAdminId,
  });

  await addNotification(
    request.trainerId,
    'Kredi Bozdurma Talebiniz Reddedildi',
    `Neden: ${reason}`,
    'cash_withdrawal_rejected'
  );
}