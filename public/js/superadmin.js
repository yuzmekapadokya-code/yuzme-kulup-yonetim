// Super Admin page logic

let currentSuperAdmin = null;
let allAdmins = [];
let currentPaymentAdmin = null;
let pendingApplicationToApprove = null;
let editingAdvertisementId = null;
let parsedStandardsPreview = [];
let parsedStandardsErrors = [];
let parsedRaceResults = [];
let raceResultReferenceData = null;
let latestRaceImportSummary = null;
let raceResultsFilterState = {
    pdfClub: '',
    systemClub: '',
    mismatchReason: ''
};
let currentTrainerCompensationContext = null;

window.getSuperAdminAiContext = function getSuperAdminAiContext() {
    return {
        currentSuperAdmin
    };
};

const raceMismatchReasonLabels = {
    pdf_club_missing: 'PDF kulübü okunamadı',
    system_club_not_found: 'Kulüp sistemde yok',
    club_has_no_students: 'Kulüpte kayıtlı sporcu yok',
    student_name_uncertain: 'Sporcu adı hatalı/eksik okunmuş olabilir',
    student_not_found: 'Kulüp bulundu, sporcu yok',
    matched: 'Eşleşti'
};

function scrollMainContentToTop(targetElement = null) {
    const scroller = document.querySelector('.main-content');
    if (scroller) {
        if (targetElement && typeof targetElement.getBoundingClientRect === 'function') {
            const scrollerRect = scroller.getBoundingClientRect();
            const targetRect = targetElement.getBoundingClientRect();
            const scrollTop = scroller.scrollTop + targetRect.top - scrollerRect.top - 12;
            scroller.scrollTo({ top: Math.max(0, scrollTop), left: 0, behavior: 'smooth' });
            return;
        }
        scroller.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        return;
    }
    if (targetElement && typeof targetElement.scrollIntoView === 'function') {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
}

window.addEventListener('load', async () => {
    const userId = sessionStorage.getItem('user_id');
    const role = sessionStorage.getItem('user_role');

    if (!userId || role !== 'superadmin') {
        window.location.href = '../index.html';
        return;
    }

    currentSuperAdmin = {
        id: userId,
        name: sessionStorage.getItem('user_name') || 'SuperAdmin',
        email: sessionStorage.getItem('user_email')
    };

    document.getElementById('saName').textContent = currentSuperAdmin.name;
    document.getElementById('userAvatar').textContent = currentSuperAdmin.name.charAt(0).toUpperCase();

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
            await auth.signOut();
            sessionStorage.clear();
            window.location.href = '../index.html';
        } catch (error) {
            alert('Çıkış yapılırken hata: ' + error.message);
        }
    });

    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            switchSuperAdminPage(page);
        });
    });

    document.getElementById('createAdminForm').addEventListener('submit', createAdmin);
    document.getElementById('paymentForm').addEventListener('submit', processPayment);
    document.getElementById('membershipApprovalForm').addEventListener('submit', approveApplication);
    document.getElementById('productForm').addEventListener('submit', addProduct);
    document.getElementById('creditForm').addEventListener('submit', addCredit);
    document.getElementById('advertisementForm').addEventListener('submit', addAdvertisement);
    if (window.superAdminAiPage && typeof window.superAdminAiPage.setup === 'function') {
        window.superAdminAiPage.setup();
    }
    const creditPurchaseBankForm = document.getElementById('creditPurchaseBankForm');
    if (creditPurchaseBankForm) {
        creditPurchaseBankForm.addEventListener('submit', saveCreditPurchaseBankSettings);
    }
    const raceResultsInput = document.getElementById('raceResultsPdfInput');
    if (raceResultsInput) {
        raceResultsInput.addEventListener('change', () => {
            resetRaceResultsState();
            if (raceResultsInput.files && raceResultsInput.files[0]) {
                analyzeRaceResultsPdf();
            }
        });
    }
    const analyzeRaceResultsBtn = document.getElementById('analyzeRaceResultsBtn');
    if (analyzeRaceResultsBtn) {
        analyzeRaceResultsBtn.addEventListener('click', analyzeRaceResultsPdf);
    }
    const saveRaceResultsBtn = document.getElementById('saveRaceResultsBtn');
    if (saveRaceResultsBtn) {
        saveRaceResultsBtn.addEventListener('click', saveMatchedRaceResults);
    }
    const pdfClubFilter = document.getElementById('raceResultsPdfClubFilter');
    if (pdfClubFilter) {
        pdfClubFilter.addEventListener('change', event => {
            raceResultsFilterState.pdfClub = event.target.value || '';
            renderRaceResults();
        });
    }
    const systemClubFilter = document.getElementById('raceResultsSystemClubFilter');
    if (systemClubFilter) {
        systemClubFilter.addEventListener('change', event => {
            raceResultsFilterState.systemClub = event.target.value || '';
            renderRaceResults();
        });
    }
    const reasonFilter = document.getElementById('raceResultsReasonFilter');
    if (reasonFilter) {
        reasonFilter.addEventListener('change', event => {
            raceResultsFilterState.mismatchReason = event.target.value || '';
            renderRaceResults();
        });
    }
    const resetRaceResultsFiltersBtn = document.getElementById('resetRaceResultsFiltersBtn');
    if (resetRaceResultsFiltersBtn) {
        resetRaceResultsFiltersBtn.addEventListener('click', resetRaceResultsFilters);
    }

    await Promise.all([
        loadAdmins(),
        loadApplications(),
        loadProducts(),
        loadOrders(),
        loadCreditPackagesAdmin(),
        loadCreditPurchaseBankSettings()
    ]);
});

async function loadAdmins() {
    try {
        const adminsSnap = await db.collection('users').where('role', '==', 'admin').get();
        allAdmins = adminsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        
        displayAdminList();
    } catch (error) {
        console.error('Yöneticiler yüklenirken hata:', error);
    }
}

function displayAdminList() {
    const tbody = document.getElementById('adminListBody');
    tbody.innerHTML = '';

    if (allAdmins.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #95a5a6;">Henüz yönetici oluşturulmamış</td></tr>';
        return;
    }

    allAdmins.forEach(admin => {
        const membershipEnd = new Date(admin.membershipEnd);
        const today = new Date();
        const isExpired = membershipEnd < today;
        const daysLeft = Math.ceil((membershipEnd - today) / (1000 * 60 * 60 * 24));

        const totalAmount = admin.membershipPrice || 0;
        const installments = admin.membershipInstallments || 1;
        const installmentAmount = totalAmount / installments;
        const paidAmount = admin.membershipPaid || 0;
        const remainingAmount = totalAmount - paidAmount;

        let paymentStatus = 'Ödenmedi';
        let statusClass = 'status-pending';

        if (paidAmount >= totalAmount) {
            paymentStatus = 'Tamamen Ödendi';
            statusClass = 'status-paid';
        } else if (paidAmount > 0) {
            paymentStatus = `Kısmi (₺${paidAmount.toFixed(2)})`;
            statusClass = 'status-partial';
        }

        const membershipStatus = isExpired ? '❌ Sona Erdi' : `✓ Geçerli (${daysLeft} gün)`;
        const membershipStyle = isExpired ? 'color: #e74c3c; font-weight: bold;' : 'color: #27ae60;';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${admin.name}</strong></td>
            <td>${admin.email}</td>
            <td style="${membershipStyle}">${membershipStatus}</td>
            <td>
                <span class="payment-status ${statusClass}">${paymentStatus}</span>
            </td>
            <td>
                ${paidAmount < totalAmount && installments > 1 ? `<button class="btn btn-success btn-sm" onclick="openPaymentModal('${admin.id}')">Taksit Öde</button>` : ''}
                <button class="btn btn-info btn-sm" onclick="openDetailModal('${admin.id}')">Detay</button>
            </td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteAdmin('${admin.id}', '${admin.name}')">🗑️ Sil</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Delete admin from system (kalıcı silme)
async function deleteAdmin(adminId, adminName) {
    if (!confirm(`⚠️ UYARI: "${adminName}" isimli yöneticiyi ve tüm verilerini kalıcı olarak sileceksiniz. Bu işlem geri alınamaz.\n\nEmin misiniz?`)) {
        return;
    }

    try {
        const admin = allAdmins.find(a => a.id === adminId);
        if (!admin) {
            alert('Yönetici bulunamadı');
            return;
        }

        // Delete related branches, students and trainers if any
        try {
            // Delete branches belonging to this admin
            const branchesSnap = await db.collection('branches').where('adminId', '==', adminId).get();
            const branchIds = branchesSnap.docs.map(d => d.id);

            // Delete students under those branches
            for (const bId of branchIds) {
                const studentsSnap = await db.collection('students').where('branchId', '==', bId).get();
                const deleteStudents = studentsSnap.docs.map(s => db.collection('students').doc(s.id).delete());
                await Promise.all(deleteStudents);

                // Delete the branch document
                await db.collection('branches').doc(bId).delete();
            }

            // Optionally delete trainers associated with those branches (if stored with branch refs)
            try {
                const trainersSnap = await db.collection('users').where('role', '==', 'trainer').get();
                const trainersToDelete = trainersSnap.docs.filter(td => {
                    const data = td.data();
                    if (!data) return false;
                    if (Array.isArray(data.branches)) {
                        return data.branches.some(br => branchIds.includes(br));
                    }
                    return false;
                });
                const delTrainers = trainersToDelete.map(t => db.collection('users').doc(t.id).delete());
                if (delTrainers.length) await Promise.all(delTrainers);
            } catch (innerErr) {
                console.warn('Trainers deletion skipped or failed:', innerErr.message);
            }

            // Delete any admin-specific doc in 'admins' collection if exists
            try {
                const adminDocRef = db.collection('admins').doc(adminId);
                const adminDoc = await adminDocRef.get();
                if (adminDoc.exists) await adminDocRef.delete();
            } catch (innerErr) {
                console.warn('admins collection cleanup failed:', innerErr.message);
            }

            // Finally delete the user document from 'users' collection
            await db.collection('users').doc(adminId).delete();

            // Remove from local cache and UI
            allAdmins = allAdmins.filter(a => a.id !== adminId);
            displayAdminList();

            alert(`✓ "${adminName}" ve ilişkili verileri başarıyla silindi!`);
            return;
        } catch (error) {
            console.error('Yönetici silinirken hata (detaylı):', error);
            alert('Yönetici silinirken hata: ' + error.message);
            return;
        }
    } catch (error) {
        console.error('Yönetici silinirken hata:', error);
        alert('Hata: ' + error.message);
    }
}

async function openDetailModal(adminId) {
    const admin = allAdmins.find(a => a.id === adminId);
    if (!admin) return;

    try {
        // Şubeleri say
        const branchesSnap = await db.collection('branches').where('adminId', '==', adminId).get();
        const branchCount = branchesSnap.size;

        // Antrenörleri say (bu admin'in şubelerine ait)
        let trainerCount = 0;
        if (branchCount > 0) {
            const branchIds = branchesSnap.docs.map(doc => doc.id);
            const trainersSnap = await db.collection('trainers').where('branches', 'array-contains-any', branchIds).get();
            trainerCount = trainersSnap.size;
        }

        // Öğrencileri say
        const studentsSnap = await db.collection('students').get();
        let studentCount = 0;
        const branchIds = (await db.collection('branches').where('adminId', '==', adminId).get()).docs.map(doc => doc.id);
        studentsSnap.docs.forEach(doc => {
            if (branchIds.includes(doc.data().branchId)) {
                studentCount++;
            }
        });

        const totalAmount = admin.membershipPrice || 0;
        const paidAmount = admin.membershipPaid || 0;
        const remainingAmount = totalAmount - paidAmount;

        const detailContent = document.getElementById('detailContent');
        detailContent.innerHTML = `
            <div class="detail-item">
                <div class="detail-label">Ad Soyadı:</div>
                <div class="detail-value">${admin.name}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">E-mail:</div>
                <div class="detail-value">${admin.email}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Üyelik Başlangıç:</div>
                <div class="detail-value">${new Date(admin.membershipStart).toLocaleDateString('tr-TR')}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Üyelik Bitiş:</div>
                <div class="detail-value">${new Date(admin.membershipEnd).toLocaleDateString('tr-TR')}</div>
            </div>
            <hr style="margin: 20px 0;">
            <h3 style="color: #3498db; margin-bottom: 15px;">📊 İşletme Bilgileri</h3>
            <div class="detail-item">
                <div class="detail-label">🏊 Toplam Şube:</div>
                <div class="detail-value" style="font-size: 1.3em; color: #3498db; font-weight: bold;">${branchCount}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">👨‍🏫 Toplam Antrenör:</div>
                <div class="detail-value" style="font-size: 1.3em; color: #27ae60; font-weight: bold;">${trainerCount}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">👨‍👩‍👧 Toplam Sporcu:</div>
                <div class="detail-value" style="font-size: 1.3em; color: #9b59b6; font-weight: bold;">${studentCount}</div>
            </div>
            <hr style="margin: 20px 0;">
            <h3 style="color: #3498db; margin-bottom: 15px;">💰 Ödeme Bilgileri</h3>
            <div class="detail-item">
                <div class="detail-label">Toplam Ücret (₺):</div>
                <div class="detail-value">${totalAmount.toFixed(2)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Ödenen Tutar (₺):</div>
                <div class="detail-value" style="color: #27ae60; font-weight: bold;">${paidAmount.toFixed(2)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Kalan Tutar (₺):</div>
                <div class="detail-value" style="color: #e74c3c; font-weight: bold;">${remainingAmount.toFixed(2)}</div>
            </div>
        `;

        document.getElementById('detailModal').classList.add('active');
    } catch (error) {
        console.error('Detay yüklenirken hata:', error);
        alert('Detaylar yüklenirken hata oluştu: ' + error.message);
    }
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.remove('active');
}

async function openPaymentModal(adminId) {
    const admin = allAdmins.find(a => a.id === adminId);
    if (!admin) return;

    currentPaymentAdmin = admin;
    const installmentAmount = (admin.membershipPrice || 0) / (admin.membershipInstallments || 1);

    document.getElementById('paymentAdminName').textContent = admin.name;
    document.getElementById('paymentInstallmentAmount').textContent = installmentAmount.toFixed(2);
    document.getElementById('paymentAmount').value = installmentAmount.toFixed(2);
    document.getElementById('paymentDate').valueAsDate = new Date();

    document.getElementById('paymentModal').classList.add('active');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
    document.getElementById('paymentForm').reset();
    currentPaymentAdmin = null;
}

async function processPayment(e) {
    e.preventDefault();

    if (!currentPaymentAdmin) return;

    const paymentAmount = parseFloat(document.getElementById('paymentAmount').value);
    const paymentDate = document.getElementById('paymentDate').value;

    const totalAmount = currentPaymentAdmin.membershipPrice || 0;
    const currentPaid = currentPaymentAdmin.membershipPaid || 0;
    const newTotal = currentPaid + paymentAmount;

    if (newTotal > totalAmount) {
        alert(`Ödeme tutarı fazla! (Maksimum: ₺${(totalAmount - currentPaid).toFixed(2)})`);
        return;
    }

    try {
        await db.collection('users').doc(currentPaymentAdmin.id).update({
            membershipPaid: newTotal
        });

        // Ödeme geçmişine kaydet
        await db.collection('adminPayments').add({
            adminId: currentPaymentAdmin.id,
            adminName: currentPaymentAdmin.name,
            amount: paymentAmount,
            date: paymentDate,
            newBalance: newTotal,
            timestamp: new Date().toISOString()
        });

        alert(`✓ Ödeme başarıyla kaydedildi!\n\nYönetici: ${currentPaymentAdmin.name}\nÖdeme: ₺${paymentAmount.toFixed(2)}\nKalan: ₺${(totalAmount - newTotal).toFixed(2)}`);

        closePaymentModal();
        await loadAdmins();
    } catch (error) {
        alert('Ödeme kaydedilirken hata: ' + error.message);
        console.error('Payment error:', error);
    }
}

// ======================== MEMBERSHIP APPLICATIONS ========================

async function loadApplications() {
    try {
        const applicationsSnap = await db.collection('applications').where('status', '==', 'pending').get();
        let applications = applicationsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));

        // Sort by applicationDate desc if present
        applications.sort((a,b) => {
            const da = a.applicationDate ? new Date(a.applicationDate) : new Date(0);
            const dbd = b.applicationDate ? new Date(b.applicationDate) : new Date(0);
            return dbd - da;
        });

        displayApplications(applications);
    } catch (error) {
        console.error('Başvurular yüklenirken hata:', error);
        const tbody = document.getElementById('applicationsBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #95a5a6;">Başvurular yüklenirken hata oluştu</td></tr>';
    }
}

function displayApplications(applications) {
    const tbody = document.getElementById('applicationsBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!applications || applications.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #95a5a6;">Bekleyen başvuru yok</td></tr>';
        return;
    }

    applications.forEach(app => {
        const date = app.applicationDate ? new Date(app.applicationDate).toLocaleString('tr-TR') : '-';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${app.name}</strong></td>
            <td>${app.sportType || '-'}</td>
            <td>${(app.city || '-') + ' / ' + (app.district || '-')}</td>
            <td>${date}</td>
            <td>
                <button class="btn btn-info btn-sm" onclick="openMembershipApprovalModal('${app.id}')">Detay</button>
                <button class="btn btn-primary btn-sm" onclick="transferApplicationToCreateForm('${app.id}')">Forma Aktar</button>
                <button class="btn btn-danger btn-sm" onclick="rejectApplicationById('${app.id}')">Reddet</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function approveApplicationById(applicationId) {
    if (!confirm('Bu başvuruyu onaylamak istediğinize emin misiniz?')) return;
    try {
        await db.collection('applications').doc(applicationId).update({status: 'approved', reviewedAt: new Date().toISOString()});
        await loadApplications();
        alert('Başvuru onaylandı.');
    } catch (err) {
        console.error('Başvuru onaylanırken hata:', err);
        alert('Onaylama sırasında hata: ' + err.message);
    }
}

async function rejectApplicationById(applicationId) {
    if (!confirm('Bu başvuruyu reddetmek istediğinize emin misiniz?')) return;
    try {
        await db.collection('applications').doc(applicationId).update({status: 'rejected', reviewedAt: new Date().toISOString()});
        await loadApplications();
        alert('Başvuru reddedildi.');
    } catch (err) {
        console.error('Başvuru reddedilirken hata:', err);
        alert('Reddetme sırasında hata: ' + err.message);
    }
}

// Transfer application data into the admin creation form so superadmin can set dates and create
async function transferApplicationToCreateForm(applicationId) {
    try {
        const appDoc = await db.collection('applications').doc(applicationId).get();
        if (!appDoc.exists) {
            alert('Başvuru bulunamadı');
            return;
        }
        const app = {id: appDoc.id, ...appDoc.data()};


        // Fill the create admin form fields
        document.getElementById('adminName').value = app.name || '';
        if (document.getElementById('adminEmail')) document.getElementById('adminEmail').value = app.email || '';
        if (document.getElementById('adminPhone')) document.getElementById('adminPhone').value = app.phone || '';
        if (document.getElementById('adminClubAddress')) document.getElementById('adminClubAddress').value = app.clubAddress || app.clubAddress || '';

        // Use existing tempPassword from application if present, otherwise generate and save it to the application
        let tempPass = app.tempPassword;
        if (!tempPass) {
            tempPass = 'Tmp' + Math.random().toString(36).slice(-8) + '!';
            try {
                await db.collection('applications').doc(applicationId).update({tempPassword: tempPass});
            } catch (err) {
                console.warn('Başvuruya tempPassword eklenemedi:', err.message);
            }
        }
        if (document.getElementById('adminPassword')) document.getElementById('adminPassword').value = tempPass;

        // Store pending application id so createAdmin can mark it approved after creation
        pendingApplicationToApprove = applicationId;

        // Scroll to create admin form
        document.getElementById('adminName').scrollIntoView({behavior: 'smooth', block: 'center'});

        alert('Başvuru forma aktarıldı. Lütfen üyelik tarihlerini girip "Yönetici Oluştur" butonuna basın. Geçici şifre oluşturuldu: ' + tempPass);
    } catch (err) {
        console.error('Forma aktarma hatası:', err);
        alert('Forma aktarma sırasında hata: ' + err.message);
    }
}

async function openMembershipApprovalModal(applicationId) {
    try {
        const appDoc = await db.collection('applications').doc(applicationId).get();
        if (!appDoc.exists) {
            alert('Başvuru bulunamadı');
            return;
        }
        const app = {id: appDoc.id, ...appDoc.data()};
        const detailContent = document.getElementById('detailContent');
        detailContent.innerHTML = `
            <div class="detail-item"><div class="detail-label">Ad Soyad:</div><div class="detail-value">${app.name || '-'}</div></div>
            <div class="detail-item"><div class="detail-label">E-mail:</div><div class="detail-value">${app.email || '-'}</div></div>
            <div class="detail-item"><div class="detail-label">Telefon:</div><div class="detail-value">${app.phone || '-'}</div></div>
            <div class="detail-item"><div class="detail-label">Spor Branşı:</div><div class="detail-value">${app.sportType || '-'}</div></div>
            <div class="detail-item"><div class="detail-label">Adres:</div><div class="detail-value">${app.clubAddress || '-'}</div></div>
            <div class="detail-item"><div class="detail-label">Uygulama Tarihi:</div><div class="detail-value">${app.applicationDate ? new Date(app.applicationDate).toLocaleString('tr-TR') : '-'}</div></div>
            <div class="detail-item"><div class="detail-label">Geçici Şifre:</div><div class="detail-value">${app.tempPassword || '-'}</div></div>
            <div style="margin-top:15px; display:flex; gap:10px;">
                <button class="btn btn-primary btn-sm" onclick="transferApplicationToCreateForm('${applicationId}')">Forma Aktar</button>
                <button class="btn btn-success btn-sm" onclick="approveApplicationById('${applicationId}')">Onayla</button>
                <button class="btn btn-danger btn-sm" onclick="rejectApplicationById('${applicationId}')">Reddet</button>
            </div>
        `;
        document.getElementById('detailModal').classList.add('active');
    } catch (err) {
        console.error('openMembershipApprovalModal hata:', err);
        alert('Başvuru detayları yüklenirken hata: ' + err.message);
    }
}

function closeMembershipApprovalModal() {
    document.getElementById('membershipApprovalModal').classList.remove('active');
}

async function approveApplication(e) {
    e.preventDefault();
    // Placeholder implementation
    alert('Başvuru onay sistemi yakında aktifleştirilecek');
    closeMembershipApprovalModal();
}

async function rejectApplication() {
    // Placeholder implementation
    alert('Başvuru reddetme sistemi yakında aktifleştirilecek');
    closeMembershipApprovalModal();
}

// ======================== ADMIN CREATION ========================

async function createAdmin(e) {
    e.preventDefault();

    const name = document.getElementById('adminName').value.trim();
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    const phone = document.getElementById('adminPhone') ? document.getElementById('adminPhone').value.trim() : '';
    const clubAddress = document.getElementById('adminClubAddress') ? document.getElementById('adminClubAddress').value.trim() : '';
    const membershipStart = document.getElementById('membershipStart').value;
    const membershipEnd = document.getElementById('membershipEnd').value;
    const price = parseFloat(document.getElementById('membershipPrice').value);
    const installments = parseInt(document.getElementById('membershipInstallments').value, 10) || 1;

    const resultDiv = document.getElementById('resultMessage');
    resultDiv.textContent = 'Oluşturuluyor...';

    try {
        const userCred = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCred.user.uid;

        await db.collection('users').doc(uid).set({
            name: name,
            email: email,
            phone: phone || null,
            role: 'admin',
            membershipStart: membershipStart,
            membershipEnd: membershipEnd,
            membershipPrice: price,
            membershipInstallments: installments,
            membershipPaid: 0,
            frozen: false,
            createdBy: currentSuperAdmin.id,
            createdAt: new Date().toISOString()
        });

        await db.collection('admins').doc(uid).set({
            uid: uid,
            name: name,
            email: email,
            phone: phone || null,
            clubAddress: clubAddress || null,
            membershipStart: membershipStart,
            membershipEnd: membershipEnd,
            membershipPrice: price,
            membershipInstallments: installments,
            membershipPaid: 0,
            createdBy: currentSuperAdmin.id,
            createdAt: new Date().toISOString()
        });

        // If this admin creation was triggered from an application, mark it approved
        if (pendingApplicationToApprove) {
            try {
                await db.collection('applications').doc(pendingApplicationToApprove).update({
                    status: 'approved',
                    reviewedAt: new Date().toISOString(),
                    adminUid: uid,
                    approvedBy: currentSuperAdmin.id
                });
            } catch (err) {
                console.warn('Başvuru onay güncellemesi başarısız:', err.message);
            }
            pendingApplicationToApprove = null;
        }

        resultDiv.style.color = '#27ae60';
        resultDiv.textContent = `✓ Yönetici başarıyla oluşturuldu.`;

        document.getElementById('createAdminForm').reset();
        await loadAdmins();

        // Show created credentials so superadmin can forward to new admin
        try {
            alert(`Yeni yönetici oluşturuldu:\nİsim: ${name}\nE-mail: ${email}\nGeçici Şifre: ${password}${phone ? '\nTelefon: ' + phone : ''}`);
        } catch (e) {
            console.log('Credential alert failed:', e.message);
        }
    } catch (error) {
        console.error('createAdmin error', error);
        resultDiv.style.color = '#e74c3c';
        resultDiv.textContent = 'Hata: ' + error.message;
    }
}

// ======================== MARKET SYSTEM ========================

async function loadProducts() {
    try {
        const productsSnap = await db.collection('products').get();
        const products = productsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));

        displayProducts(products);
    } catch (error) {
        console.error('Ürünler yüklenirken hata:', error);
    }
}

function displayProducts(products) {
    const container = document.getElementById('productsContainer');
    container.innerHTML = '';

    if (products.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 40px;">Henüz ürün eklenmemiş</p>';
        return;
    }

    products.forEach(product => {
        const productCard = document.createElement('div');
        productCard.style.cssText = `
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            transition: transform 0.3s ease;
        `;

        productCard.innerHTML = `
            <div style="height: 200px; background: #f8f9fa; display: flex; align-items: center; justify-content: center;">
                ${product.imageUrl ? `<img src="${product.imageUrl}" style="max-width: 100%; max-height: 100%; object-fit: cover;" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22200%22%3E%3Crect fill=%22%23ddd%22 width=%22300%22 height=%22200%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-size=%2216%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22%3E📦%3C/text%3E%3C/svg%3E'">` : '<div style="font-size: 48px; color: #ddd;">📦</div>'}
            </div>
            <div style="padding: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #2c3e50;">${product.name}</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0;">
                    <div style="background: #f8f9fa; padding: 8px; border-radius: 5px;">
                        <small style="color: #7f8c8d;">Gerçek Fiyat</small>
                        <p style="color: #27ae60; font-size: 1.2em; font-weight: bold; margin: 5px 0;">₺${product.price.toFixed(2)}</p>
                    </div>
                    <div style="background: #f8f9fa; padding: 8px; border-radius: 5px;">
                        <small style="color: #7f8c8d;">Kredi Maliyeti</small>
                        <p style="color: #3498db; font-size: 1.2em; font-weight: bold; margin: 5px 0;">${product.creditCost || 0} 💳</p>
                    </div>
                </div>
                ${product.description ? `<p style="color: #666; margin: 10px 0; font-size: 0.9em;">${product.description}</p>` : ''}
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <button class="btn btn-info btn-sm" onclick="editProduct('${product.id}')">Düzenle</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteProduct('${product.id}')">Sil</button>
                </div>
            </div>
        `;

        container.appendChild(productCard);
    });
}

async function addProduct(e) {
    e.preventDefault();
    console.log('Ürün ekleme başladı...');

    const name = document.getElementById('productName').value.trim();
    const price = parseFloat(document.getElementById('productPrice').value);
    const creditCost = parseInt(document.getElementById('productCreditCost').value);
    const description = document.getElementById('productDescription').value.trim();
    const productImageInput = document.getElementById('productImage');

    console.log('Form verileri:', { name, price, creditCost });

    if (!name || !price || !creditCost) {
        alert('Lütfen tüm alanları doldurun!');
        return;
    }

    try {
        let imageUrl = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22200%22%3E%3Crect fill=%22%23ddd%22 width=%22300%22 height=%22200%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-size=%2216%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22%3E%F0%9F%93%A6%3C/text%3E%3C/svg%3E';
        const imageFile = productImageInput && productImageInput.files ? productImageInput.files[0] : null;

        if (imageFile) {
            imageUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('Ürün görseli okunamadı.'));
                reader.readAsDataURL(imageFile);
            });
        }

        console.log('Ürün kaydediliyor:', name);
        await db.collection('products').add({
            name: name,
            price: price,
            creditCost: creditCost,
            description: description,
            imageUrl: imageUrl,
            createdBy: currentSuperAdmin.id,
            createdAt: new Date().toISOString()
        });

        alert('✓ Ürün başarıyla eklendi!');
        closeProductModal();
        document.getElementById('productForm').reset();
        await loadProducts();
    } catch (error) {
        console.error('Ürün eklenirken hata:', error);
        alert('Hata: ' + error.message);
    }
}

async function deleteProduct(productId) {
    if (!confirm('Bu ürünü silmek istediğinizden emin misiniz?')) return;

    try {
        await db.collection('products').doc(productId).delete();
        alert('Ürün başarıyla silindi!');
        await loadProducts();
    } catch (error) {
        console.error('Ürün silinirken hata:', error);
        alert('Ürün silinirken hata oluştu: ' + error.message);
    }
}

function openProductModal() {
    document.getElementById('productModal').style.display = 'flex';
}

function closeProductModal() {
    document.getElementById('productModal').style.display = 'none';
    document.getElementById('productForm').reset();
}

// ======================== ORDERS SYSTEM ========================

function getOrderItems(order) {
    if (Array.isArray(order.items) && order.items.length) {
        return order.items.map((item, index) => ({
            id: item.id || item.productId || `${order.id || 'order'}_${index}`,
            productId: item.productId || item.id || '',
            productName: item.productName || item.name || 'Urun',
            quantity: Number(item.quantity || 1),
            unitPrice: Number(item.unitPrice || item.price || 0),
            unitCreditCost: Number(item.unitCreditCost || item.creditCost || 0),
            imageUrl: item.imageUrl || '',
        }));
    }

    return [{
        id: order.productId || order.id,
        productId: order.productId || '',
        productName: order.productName || order.packageName || 'Urun/Talep',
        quantity: Number(order.quantity || 1),
        unitPrice: Number(order.totalAmount || order.amount || 0),
        unitCreditCost: Number(order.totalCredits || 0),
        imageUrl: order.imageUrl || '',
    }];
}

function getOrderDisplayTitle(order) {
    if (order.orderTitle) return order.orderTitle;
    const items = getOrderItems(order);
    if (items.length === 1) return items[0].productName;
    return `${items.length} urunluk sepet`;
}

function getOrderItemCount(order) {
    return getOrderItems(order).reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0;
}

function getOrderPaymentLabel(paymentMethod) {
    if (paymentMethod === 'credit') return 'Kredi';
    if (paymentMethod === 'iban') return 'Havale / EFT';
    if (paymentMethod === 'credit_card') return 'Kredi Karti';
    if (paymentMethod === 'cash') return 'Nakit';
    return paymentMethod || '-';
}

function getOrderTotalLabel(order) {
    if (order.paymentMethod === 'credit') {
        return `${Number(order.totalCredits || 0)} kredi`;
    }
    return `₺${Number(order.totalAmount || order.amount || 0).toFixed(2)}`;
}

function hasOrderCardSnapshot(order) {
    return Boolean(
        order
        && order.paymentMethod === 'credit_card'
        && (order.cardHolderNameSnapshot || order.cardLast4Snapshot || order.cardExpirySnapshot || order.cardBrandSnapshot)
    );
}

function getOrderCardSnapshotSummary(order) {
    if (!hasOrderCardSnapshot(order)) {
        return '';
    }

    const parts = [];
    if (order.cardHolderNameSnapshot) {
        parts.push(order.cardHolderNameSnapshot);
    }

    const brandAndLast4 = [order.cardBrandSnapshot || '', order.cardLast4Snapshot ? `**** ${order.cardLast4Snapshot}` : '']
        .filter(Boolean)
        .join(' ')
        .trim();
    if (brandAndLast4) {
        parts.push(brandAndLast4);
    }

    if (order.cardExpirySnapshot) {
        parts.push(`SKT ${order.cardExpirySnapshot}`);
    }

    return parts.join(' / ');
}

function buildOrderCardSnapshotHtml(order) {
    if (!hasOrderCardSnapshot(order)) {
        return '';
    }

    return `
        <div class="detail-item">
            <div class="detail-label">Kart Ozeti:</div>
            <div class="detail-value">
                ${order.cardHolderNameSnapshot ? `<div>Kart sahibi: ${order.cardHolderNameSnapshot}</div>` : ''}
                ${(order.cardBrandSnapshot || order.cardLast4Snapshot) ? `<div>Kart: ${(order.cardBrandSnapshot || 'Kart')} ${order.cardLast4Snapshot ? `**** ${order.cardLast4Snapshot}` : ''}</div>` : ''}
                ${order.cardExpirySnapshot ? `<div>Son kullanma: ${order.cardExpirySnapshot}</div>` : ''}
                <div style="margin-top: 6px; color: #6f8091; font-size: 0.9em;">Tam kart numarasi ve CVV guvenlik nedeniyle saklanmaz.</div>
            </div>
        </div>
    `;
}

function renderOrderItemsHtml(order) {
    return getOrderItems(order).map((item) => `
        <div style="padding: 12px; border: 1px solid #e5ebf2; border-radius: 10px; background: #fbfdff; margin-top: 10px;">
            <div style="font-weight: 700; color: #22313f;">${item.productName}</div>
            <div style="margin-top: 6px; color: #6f8091; font-size: 0.92em;">Adet: ${Number(item.quantity || 1)}</div>
            <div style="margin-top: 4px; color: #6f8091; font-size: 0.92em;">Birim fiyat: ₺${Number(item.unitPrice || 0).toFixed(2)}</div>
            ${order.paymentMethod === 'credit' ? `<div style="margin-top: 4px; color: #6f8091; font-size: 0.92em;">Birim kredi: ${Number(item.unitCreditCost || 0)}</div>` : ''}
        </div>
    `).join('');
}

async function loadOrders() {
    try {
        const ordersSnap = await db.collection('orders').get();
        const orders = ordersSnap.docs
            .map(doc => ({id: doc.id, ...doc.data()}))
            .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));

        const tbody = document.getElementById('ordersTableBody');
        if (!tbody) return;

        if (!orders.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #95a5a6;">Sipariş bulunamadı.</td></tr>';
            return;
        }

        tbody.innerHTML = orders.map(order => `
            <tr>
                <td>${order.id.slice(0, 8).toUpperCase()}</td>
                <td>${order.buyerName || order.customerName || 'Bilinmiyor'}<br><small style="color:#7f8c8d;">${order.buyerRole || '-'}</small></td>
                <td>${getOrderDisplayTitle(order)}<br><small style="color:#7f8c8d;">${getOrderItemCount(order)} kalem</small></td>
                <td>${getOrderTotalLabel(order)}<br><small style="color:#7f8c8d;">${getOrderPaymentLabel(order.paymentMethod)}</small></td>
                <td>${order.status === 'confirmed' ? 'Onaylandı' : order.status === 'rejected' ? 'Reddedildi' : 'Bekliyor'}</td>
                <td>${order.createdAt ? new Date(order.createdAt).toLocaleDateString('tr-TR') : '-'}</td>
                <td>
                    <button class="btn btn-info btn-sm" onclick="openOrderModal('${order.id}')">Detay</button>
                    ${order.status === 'pending' ? `<button class="btn btn-success btn-sm" style="margin-left: 6px;" onclick="confirmOrder('${order.id}')">Onayla</button>` : ''}
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Siparişler yüklenirken hata:', error);
    }
}

async function openOrderModal(orderId) {
    try {
        window.currentOrderId = orderId;
        const orderDoc = await db.collection('orders').doc(orderId).get();
        if (!orderDoc.exists) {
            alert('Sipariş bulunamadı!');
            return;
        }

        const order = {id: orderDoc.id, ...orderDoc.data()};
        const paymentMethodLabel = getOrderPaymentLabel(order.paymentMethod);
        const orderItemsHtml = renderOrderItemsHtml(order);

        const orderDetails = document.getElementById('orderDetails');
        orderDetails.innerHTML = `
            <div class="detail-item">
                <div class="detail-label">Sipariş No:</div>
                <div class="detail-value">${order.id}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Müşteri Adı:</div>
                <div class="detail-value">${order.buyerName || order.customerName || 'Bilinmiyor'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Sipariş Başlığı:</div>
                <div class="detail-value">${getOrderDisplayTitle(order)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Toplam Kalem:</div>
                <div class="detail-value">${getOrderItemCount(order)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Toplam Tutar:</div>
                <div class="detail-value">${getOrderTotalLabel(order)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Ödeme Yöntemi:</div>
                <div class="detail-value">${paymentMethodLabel}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Sipariş Tarihi:</div>
                <div class="detail-value">${order.createdAt ? new Date(order.createdAt).toLocaleString('tr-TR') : 'Bilinmiyor'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Durum:</div>
                <div class="detail-value">${order.status === 'confirmed' ? 'Onaylandı' : order.status === 'pending' ? 'Bekliyor' : 'İptal'}</div>
            </div>
            ${order.buyerPhone ? `<div class="detail-item"><div class="detail-label">Telefon:</div><div class="detail-value">${order.buyerPhone}</div></div>` : ''}
            ${order.shippingAddress ? `<div class="detail-item"><div class="detail-label">Adres:</div><div class="detail-value">${order.shippingAddress}</div></div>` : ''}
            ${order.installmentPreference ? `<div class="detail-item"><div class="detail-label">Taksit Tercihi:</div><div class="detail-value">${order.installmentPreference}</div></div>` : ''}
            ${order.note ? `<div class="detail-item"><div class="detail-label">Not:</div><div class="detail-value">${order.note}</div></div>` : ''}
            ${order.ibanSnapshot ? `<div class="detail-item"><div class="detail-label">IBAN Bilgisi:</div><div class="detail-value">${order.bankNameSnapshot || '-'} / ${order.accountHolderSnapshot || '-'} / ${order.ibanSnapshot}</div></div>` : ''}
            ${buildOrderCardSnapshotHtml(order)}
            ${order.receiptDataUrl ? `<div class="detail-item"><div class="detail-label">Dekont:</div><div class="detail-value">${order.receiptMimeType === 'application/pdf' ? `<a href="${order.receiptDataUrl}" target="_blank">Dekont PDF'ini aç</a>` : `<img src="${order.receiptDataUrl}" alt="Dekont" style="max-width: 100%; border-radius: 8px; border: 1px solid #dfe6ee;">`}</div></div>` : ''}
            <div class="detail-item">
                <div class="detail-label">Sepet Kalemleri:</div>
                <div class="detail-value">${orderItemsHtml}</div>
            </div>
        `;

        // Set payment method
        const paymentMethodSelect = document.getElementById('paymentMethod');
        paymentMethodSelect.value = order.paymentMethod || '';

        // Show payment details if available
        const paymentDetails = document.getElementById('paymentDetails');
        if (order.paymentMethod) {
            let paymentInfo = '';
            if (order.paymentMethod === 'iban') {
                paymentInfo = order.ibanSnapshot ? `${order.bankNameSnapshot || ''} / ${order.accountHolderSnapshot || ''} / ${order.ibanSnapshot}` : 'IBAN ile ödeme';
            } else if (order.paymentMethod === 'credit_card') {
                paymentInfo = getOrderCardSnapshotSummary(order) || 'Kredi Karti ile odeme';
            } else if (order.paymentMethod === 'cash') {
                paymentInfo = 'Nakit ödeme';
            } else if (order.paymentMethod === 'credit') {
                paymentInfo = `${Number(order.totalCredits || 0)} kredi ile odeme`;
            }
            document.getElementById('paymentInfo').textContent = paymentInfo;
            paymentDetails.style.display = 'block';
        } else {
            paymentDetails.style.display = 'none';
        }

        document.getElementById('orderModal').style.display = 'flex';
    } catch (error) {
        console.error('Sipariş detayları yüklenirken hata:', error);
        alert('Sipariş detayları yüklenirken hata oluştu: ' + error.message);
    }
}

function closeOrderModal() {
    document.getElementById('orderModal').style.display = 'none';
    window.currentOrderId = null;
}

async function confirmOrder(orderId = window.currentOrderId) {
    if (!confirm('Bu siparişi onaylamak istediğinizden emin misiniz?')) return;

    try {
        const orderDoc = await db.collection('orders').doc(orderId).get();
        if (!orderDoc.exists) {
            alert('Sipariş bulunamadı.');
            return;
        }

        const order = {id: orderDoc.id, ...orderDoc.data()};
        if (order.type === 'credit_package_purchase' && order.buyerId && !order.creditsGrantedAt) {
            await addCreditToTrainer(order.buyerId, Number(order.packageCredit || 0), `Kredi paketi onayı: ${order.packageName || order.id}`);
        }

        await db.collection('orders').doc(orderId).update({
            status: 'confirmed',
            confirmedAt: new Date().toISOString(),
            confirmedBy: currentSuperAdmin.id,
            creditsGrantedAt: order.type === 'credit_package_purchase' ? new Date().toISOString() : null
        });

        alert('Sipariş başarıyla onaylandı!');
        await loadOrders();
    } catch (error) {
        console.error('Sipariş onaylanırken hata:', error);
        alert('Sipariş onaylanırken hata oluştu: ' + error.message);
    }
}

// ======================== PAGE NAVIGATION ========================

function switchSuperAdminPage(page) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');

    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

    // Show selected page and activate nav link
    let targetSection = null;

    if (page === 'dashboard') {
        // Dashboard is always visible, no specific page to show
        document.querySelector('[data-page="dashboard"]').classList.add('active');
        targetSection = document.getElementById('admins-section') || document.querySelector('.dashboard-grid') || document.body;
    } else if (page === 'admins') {
        // Admins section is always visible
        document.querySelector('[data-page="admins"]').classList.add('active');
        targetSection = document.getElementById('admins-section') || document.body;
    } else if (page === 'applications') {
        // Applications section is always visible
        document.querySelector('[data-page="applications"]').classList.add('active');
        targetSection = document.getElementById('applications-section') || document.body;
    } else if (page === 'credits') {
        document.getElementById('credits-page').style.display = 'block';
        document.querySelector('[data-page="credits"]').classList.add('active');
        targetSection = document.getElementById('credits-page');
        // Load credit data when credits page is opened
        loadCreditRequests();
        loadTrainerCredits();
    } else if (page === 'market') {
        document.getElementById('market-page').style.display = 'block';
        document.querySelector('[data-page="market"]').classList.add('active');
        targetSection = document.getElementById('market-page');
    } else if (page === 'advertisements') {
        document.getElementById('advertisements-page').style.display = 'block';
        document.querySelector('[data-page="advertisements"]').classList.add('active');
        targetSection = document.getElementById('advertisements-page');
        // Load advertisement data when advertisements page is opened
        loadAdvertisements();
    } else if (page === 'orders') {
        document.getElementById('orders-page').style.display = 'block';
        document.querySelector('[data-page="orders"]').classList.add('active');
        targetSection = document.getElementById('orders-page');
    } else if (page === 'credit-packages') {
        document.getElementById('credit-packages-page').style.display = 'block';
        document.querySelector('[data-page="credit-packages"]').classList.add('active');
        targetSection = document.getElementById('credit-packages-page');
        // Load credit packages data when credit packages page is opened
        loadCreditPackagesAdmin();
        loadCreditPurchaseBankSettings();
    } else if (page === 'chat') {
        document.getElementById('chat-page').style.display = 'block';
        document.querySelector('[data-page="chat"]').classList.add('active');
        targetSection = document.getElementById('chat-page');
        // Load chat data when chat page is opened
        loadSuperAdminChatList();
    } else if (page === 'standards') {
        document.getElementById('standards-page').style.display = 'block';
        document.querySelector('[data-page="standards"]').classList.add('active');
        targetSection = document.getElementById('standards-page');
        // Load standards data when standards page is opened
        loadStandardsSuperAdmin();
    } else if (page === 'race-results') {
        document.getElementById('race-results-page').style.display = 'block';
        document.querySelector('[data-page="race-results"]').classList.add('active');
        targetSection = document.getElementById('race-results-page');
    } else if (page === 'cash-withdrawal') {
        document.getElementById('cash-withdrawal-page').style.display = 'block';
        document.querySelector('[data-page="cash-withdrawal"]').classList.add('active');
        targetSection = document.getElementById('cash-withdrawal-page');
        // Load cash withdrawal data when page is opened
        loadExchangeRate();
        loadWithdrawalRequests();
    } else if (page === 'ai-knowledge') {
        document.getElementById('ai-knowledge-page').style.display = 'block';
        document.querySelector('[data-page="ai-knowledge"]').classList.add('active');
        targetSection = document.getElementById('ai-knowledge-page');
        if (window.superAdminAiPage && typeof window.superAdminAiPage.load === 'function') {
            window.superAdminAiPage.load();
        }
    }

    if (targetSection) {
        requestAnimationFrame(() => scrollMainContentToTop(targetSection));
    }
}

// ======================== CREDIT MANAGEMENT SYSTEM ========================

// Load credit requests
async function loadCreditRequests() {
    try {
        // Simplified query to avoid composite index - no orderBy with where
        const requestsSnap = await db.collection('credit_requests')
            .where('status', '==', 'pending')
            .get();

        let requests = requestsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        
        // Sort in JavaScript instead of using orderBy in Firestore
        requests.sort((a, b) => {
            const dateA = a.createdAt ? a.createdAt.toDate ? a.createdAt.toDate() : a.createdAt : new Date(0);
            const dateB = b.createdAt ? b.createdAt.toDate ? b.createdAt.toDate() : b.createdAt : new Date(0);
            return dateB - dateA; // Descending order
        });
        
        displayCreditRequests(requests);
    } catch (error) {
        console.error('Kredi talepleri yüklenirken hata:', error);
    }
}

// Display credit requests
function displayCreditRequests(requests) {
    const container = document.getElementById('creditRequestsContainer');
    container.innerHTML = '';

    if (requests.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 20px;">Bekleyen kredi talebi bulunmuyor.</p>';
        return;
    }

    requests.forEach(request => {
        const requestCard = document.createElement('div');
        requestCard.className = 'credit-request-card';
        requestCard.style.cssText = `
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 20px;
            margin-bottom: 15px;
            border-left: 4px solid #3498db;
        `;

        requestCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                    <h4 style="margin: 0 0 10px 0; color: #2c3e50;">${request.trainerName}</h4>
                    <p style="margin: 5px 0; color: #7f8c8d;">Talep Edilen: <strong>${request.amount} Kredi</strong></p>
                    <p style="margin: 5px 0; color: #7f8c8d;">Açıklama: ${request.description || 'Açıklama yok'}</p>
                    <p style="margin: 5px 0; color: #95a5a6; font-size: 0.9em;">${new Date(request.createdAt).toLocaleString('tr-TR')}</p>
                </div>
                <div>
                    <button class="btn btn-success btn-sm" onclick="approveCreditRequest('${request.id}')">Onayla</button>
                    <button class="btn btn-danger btn-sm" onclick="rejectCreditRequest('${request.id}')" style="margin-left: 5px;">Reddet</button>
                </div>
            </div>
        `;

        container.appendChild(requestCard);
    });
}

async function loadTrainerCredits() {
    try {
        const trainersSnap = await db.collection('users').where('role', '==', 'trainer').get();
        const trainers = trainersSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));

        const tbody = document.getElementById('trainerCreditsBody');
        tbody.innerHTML = '';

        if (trainers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #95a5a6;">Antrenör bulunamadı</td></tr>';
            return;
        }

        for (const trainer of trainers) {
            const creditDoc = await db.collection('user_credits').doc(trainer.id).get();
            const creditBalance = creditDoc.exists ? creditDoc.data().balance || 0 : 0;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${trainer.name}</td>
                <td>${trainer.email}</td>
                <td><strong>${creditBalance.toLocaleString('tr-TR')}</strong></td>
                <td>-</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="openCreditModal('${trainer.id}')">Kredi Ekle</button>
                </td>
            `;
            tbody.appendChild(row);
        }
    } catch (error) {
        console.error('Antrenör kredileri yüklenirken hata:', error);
    }
}

async function approveCreditRequest(requestId) {
    try {
        const requestDoc = await db.collection('credit_requests').doc(requestId).get();
        if (!requestDoc.exists) {
            alert('Talep bulunamadı!');
            return;
        }

        const request = requestDoc.data();

        await addCreditToTrainer(request.trainerId, request.amount, `Kredi talebi onaylandı: ${request.description}`);

        await db.collection('credit_requests').doc(requestId).update({
            status: 'approved',
            approvedAt: new Date().toISOString(),
            approvedBy: currentSuperAdmin.id
        });

        alert('Kredi talebi onaylandı!');
        loadCreditRequests();
        loadTrainerCredits();
    } catch (error) {
        console.error('Kredi talebi onaylanırken hata:', error);
        alert('Hata: ' + error.message);
    }
}

// Reject credit request
async function rejectCreditRequest(requestId) {
    try {
        await db.collection('credit_requests').doc(requestId).update({
            status: 'rejected',
            rejectedAt: new Date().toISOString(),
            rejectedBy: currentSuperAdmin.id
        });

        alert('Kredi talebi reddedildi!');
        loadCreditRequests();
    } catch (error) {
        console.error('Kredi talebi reddedilirken hata:', error);
        alert('Hata: ' + error.message);
    }
}

// Add credit to trainer
async function addCreditToTrainer(trainerId, amount, description) {
    try {
        // Get or create credit document
        const creditRef = db.collection('user_credits').doc(trainerId);
        const creditDoc = await creditRef.get();

        let currentBalance = 0;
        if (creditDoc.exists) {
            currentBalance = creditDoc.data().balance || 0;
        }

        const newBalance = currentBalance + amount;
        if (newBalance < 0) {
            throw new Error('Bu işlem sonucu bakiye negatife düşer.');
        }

        // Update credit balance
        await creditRef.set({
            balance: newBalance,
            lastUpdated: new Date().toISOString()
        }, { merge: true });

        // Add transaction record
        await db.collection('credit_transactions').add({
            userId: trainerId,
            amount: amount,
            type: amount >= 0 ? 'admin_added' : 'admin_removed',
            description: description,
            referenceId: null,
            timestamp: new Date().toISOString(),
            balanceAfter: newBalance
        });

        console.log(`Kredi eklendi: ${amount} -> ${trainerId}`);
    } catch (error) {
        console.error('Kredi eklenirken hata:', error);
        throw error;
    }
}

// Open credit modal
async function openCreditModal(trainerId = '') {
    await loadTrainersForCreditSelect(trainerId);
    document.getElementById('creditModal').style.display = 'flex';
}

// Close credit modal
function closeCreditModal() {
    document.getElementById('creditModal').style.display = 'none';
    document.getElementById('creditForm').reset();
}

// Load trainers for credit select
async function loadTrainersForCreditSelect(selectedTrainerId = '') {
    try {
        const trainersSnap = await db.collection('users').where('role', '==', 'trainer').get();
        const trainers = trainersSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));

        const select = document.getElementById('creditTrainerSelect');
        select.innerHTML = '<option value="">-- Antrenör Seçiniz --</option>';

        trainers.forEach(trainer => {
            const option = document.createElement('option');
            option.value = trainer.id;
            option.textContent = trainer.name;
            if (selectedTrainerId && trainer.id === selectedTrainerId) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        if (selectedTrainerId && !trainers.some(trainer => trainer.id === selectedTrainerId)) {
            select.value = '';
        }
    } catch (error) {
        console.error('Antrenörler yüklenirken hata:', error);
    }
}

// Add credit form handler
async function addCredit(e) {
    e.preventDefault();

    const trainerId = document.getElementById('creditTrainerSelect').value;
    const amount = parseInt(document.getElementById('creditAmount').value);
    const description = document.getElementById('creditDescription').value.trim();

    if (!trainerId || !amount) {
        alert('Lütfen tüm alanları doldurun!');
        return;
    }

    try {
        await addCreditToTrainer(trainerId, amount, description || (amount > 0 ? 'Super Admin tarafından kredi eklendi' : 'Super Admin tarafından kredi düşüldü'));
        alert(amount > 0 ? 'Kredi başarıyla eklendi!' : 'Kredi başarıyla düşüldü!');
        closeCreditModal();
        loadTrainerCredits();
    } catch (error) {
        console.error('Kredi eklenirken hata:', error);
        alert('Kredi eklenirken hata oluştu: ' + error.message);
    }
}

// ======================== ADVERTISEMENT MANAGEMENT SYSTEM ========================

// Load advertisements
async function loadAdvertisements() {
    try {
        const adsSnap = await db.collection('advertisements').get();
        const advertisements = adsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));

        displayAdvertisements(advertisements);
        setupDragAndDrop();
    } catch (error) {
        console.error('Reklamlar yüklenirken hata:', error);
    }
}

// Display advertisements
function displayAdvertisements(advertisements) {
    const container = document.getElementById('advertisementsContainer');
    container.innerHTML = '';

    if (advertisements.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 40px;">Henüz reklam eklenmemiş</p>';
        return;
    }

    advertisements.forEach(ad => {
        const adCard = document.createElement('div');
        adCard.className = 'advertisement-card';
        adCard.draggable = true;
        adCard.setAttribute('data-ad-id', ad.id);
        adCard.style.cssText = `
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            transition: transform 0.3s ease;
            cursor: move;
        `;

        adCard.innerHTML = `
            <div style="height: 150px; background: #f8f9fa; display: flex; align-items: center; justify-content: center;">
                ${ad.imageUrl ? `<img src="${ad.imageUrl}" style="max-width: 100%; max-height: 100%; object-fit: cover;" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22600%22 height=%22300%22%3E%3Crect fill=%22%23e8f4f8%22 width=%22600%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-size=%2224%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%233498db%22%3E📢 Reklam%3C/text%3E%3C/svg%3E'">` :
                  ad.videoUrl ? `<video src="${ad.videoUrl}" style="max-width: 100%; max-height: 100%; object-fit: cover;" controls></video>` :
                  '<div style="font-size: 36px; color: #ddd;">📢</div>'}
            </div>
            <div style="padding: 15px;">
                <h4 style="margin: 0 0 8px 0; color: #2c3e50;">${ad.title}</h4>
                <p style="color: #666; margin: 5px 0; font-size: 0.9em;">${ad.description || ''}</p>
                <small style="color: #95a5a6;">${new Date(ad.createdAt).toLocaleDateString('tr-TR')}</small>
                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    <button class="btn btn-info btn-sm" onclick="editAdvertisement('${ad.id}')">Düzenle</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteAdvertisement('${ad.id}')">Sil</button>
                </div>
            </div>
        `;

        container.appendChild(adCard);
    });
}

// Open advertisement modal
function openAdvertisementModal() {
    document.getElementById('advertisementModal').style.display = 'flex';
}

// Close advertisement modal
function closeAdvertisementModal() {
    document.getElementById('advertisementModal').style.display = 'none';
    document.getElementById('advertisementForm').reset();
    editingAdvertisementId = null;
    const submitBtn = document.querySelector('#advertisementForm button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Reklam Ekle';
}

// Edit advertisement: open modal and populate fields
async function editAdvertisement(adId) {
    try {
        const adDoc = await db.collection('advertisements').doc(adId).get();
        if (!adDoc.exists) return alert('Reklam bulunamadı');
        const ad = adDoc.data();

        // populate fields
        document.getElementById('adTitle').value = ad.title || '';
        if (document.getElementById('adDescription')) document.getElementById('adDescription').value = ad.description || '';
        if (document.getElementById('adLink')) document.getElementById('adLink').value = ad.link || '';
        // Note: file inputs cannot be prefilled for security reasons

        editingAdvertisementId = adId;
        const submitBtn = document.querySelector('#advertisementForm button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Güncelle';

        openAdvertisementModal();
    } catch (error) {
        console.error('Reklam düzenleme başlatılamadı:', error);
        alert('Reklam düzenleme başlatılamadı: ' + error.message);
    }
}

// Add advertisement
async function addAdvertisement(e) {
    e.preventDefault();

    const title = document.getElementById('adTitle').value.trim();
    const description = document.getElementById('adDescription').value.trim();
    const link = document.getElementById('adLink') ? document.getElementById('adLink').value.trim() : '';
    const imageFile = document.getElementById('adImage').files[0];
    const videoFile = document.getElementById('adVideo').files[0];

    if (!title) {
        alert('Reklam başlığı gereklidir!');
        return;
    }

    try {
        let imageUrl = null;
        let videoUrl = null;

        // In development (localhost) skip Storage uploads to avoid CORS issues
        const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

        if (isLocal) {
            // Local dev: convert image file to data-URL if provided
            if (imageFile) {
                console.warn('Local dev: converting image to data-URL');
                imageUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('Resim okunamadı'));
                    reader.readAsDataURL(imageFile);
                });
            }
            if (videoFile) console.warn('Local dev: videos not supported in local dev');
            videoUrl = null; // skip video on local dev
        } else {
            // Upload image if provided
            if (imageFile) {
                try {
                    imageUrl = await uploadFileToStorage(imageFile, 'advertisements/images/');
                } catch (uploadError) {
                    console.warn('Resim yükleme başarısız:', uploadError.message);
                    // Continue without image
                }
            }

            // Upload video if provided
            if (videoFile) {
                try {
                    videoUrl = await uploadFileToStorage(videoFile, 'advertisements/videos/');
                } catch (uploadError) {
                    console.warn('Video yükleme başarısız:', uploadError.message);
                    // Continue without video
                }
            }
        }

        if (editingAdvertisementId) {
            // Update existing advertisement
            await db.collection('advertisements').doc(editingAdvertisementId).update({
                title: title || '',
                description: description || '',
                link: link || '',
                // Only update image/video if new files were provided (otherwise keep existing URLs)
                ...(imageUrl ? { imageUrl } : {}),
                ...(videoUrl ? { videoUrl } : {}),
                updatedAt: new Date().toISOString(),
                updatedBy: currentSuperAdmin.id
            });

            alert('✓ Reklam başarıyla güncellendi!');
            editingAdvertisementId = null;
        } else {
            console.log('Adding new ad:', {title, description, link, imageUrl, videoUrl});
            await db.collection('advertisements').add({
                title: title || '',
                description: description || '',
                link: link || '',
                imageUrl: imageUrl,
                videoUrl: videoUrl,
                createdBy: currentSuperAdmin.id,
                createdAt: new Date().toISOString(),
                active: false
            });

            alert('✓ Reklam başarıyla eklendi!');
        }

        closeAdvertisementModal();
        await loadAdvertisements();
    } catch (error) {
        console.error('Reklam eklenirken hata:', error);
        alert('Hata: ' + error.message);
    }
}

// Delete advertisement
async function deleteAdvertisement(adId) {
    if (!confirm('Bu reklamı silmek istediğinizden emin misiniz?')) return;

    try {
        await db.collection('advertisements').doc(adId).delete();
        alert('Reklam başarıyla silindi!');
        await loadAdvertisements();
    } catch (error) {
        console.error('Reklam silinirken hata:', error);
        alert('Reklam silinirken hata oluştu: ' + error.message);
    }
}

// Setup drag and drop functionality
function setupDragAndDrop() {
    const adCards = document.querySelectorAll('.advertisement-card');
    const dropZone = document.getElementById('homepageAdSlot');

    adCards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', card.getAttribute('data-ad-id'));
            card.style.opacity = '0.5';
        });

        card.addEventListener('dragend', (e) => {
            card.style.opacity = '1';
        });
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.backgroundColor = '#e8f4f8';
        dropZone.style.borderColor = '#3498db';
    });

    dropZone.addEventListener('dragleave', (e) => {
        dropZone.style.backgroundColor = 'white';
        dropZone.style.borderColor = '#ddd';
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.style.backgroundColor = 'white';
        dropZone.style.borderColor = '#ddd';

        const adId = e.dataTransfer.getData('text/plain');
        if (adId) {
            await placeAdvertisementOnHomepage(adId);
        }
    });
}

// Place advertisement on homepage
async function placeAdvertisementOnHomepage(adId) {
    try {
        const adDoc = await db.collection('advertisements').doc(adId).get();
        if (!adDoc.exists) return;

        const ad = {id: adDoc.id, ...adDoc.data()};

        // Update advertisement as active
        await db.collection('advertisements').doc(adId).update({
            active: true,
            placedOnHomepage: true,
            placedAt: new Date().toISOString()
        });

        // Update homepage advertisement
        await db.collection('homepage_settings').doc('advertisement').set({
            advertisementId: adId,
            title: ad.title || '',
            description: ad.description || '',
            link: ad.link || '',
            imageUrl: ad.imageUrl || null,
            videoUrl: ad.videoUrl || null,
            updatedAt: new Date().toISOString(),
            updatedBy: currentSuperAdmin.id
        });

        alert('Reklam ana sayfaya yerleştirildi!');
        await loadAdvertisements();
        updateHomepageAdSlot(ad);
    } catch (error) {
        console.error('Reklam yerleştirilirken hata:', error);
        alert('Reklam yerleştirilirken hata oluştu: ' + error.message);
    }
}

// Update homepage ad slot display
function updateHomepageAdSlot(ad) {
    const slot = document.getElementById('homepageAdSlot');
    if (ad) {
        // Show only image or video; wrap in link if provided
        const media = ad.imageUrl ? `<img src="${ad.imageUrl}" style="max-width: 100%; max-height: 120px; object-fit: cover; margin: 5px 0;">` : (ad.videoUrl ? `<video src="${ad.videoUrl}" style="max-width: 100%; max-height: 120px; object-fit: cover; margin: 5px 0;" controls></video>` : '<div style="font-size:28px;color:#bbb;">Reklam</div>');
        const clickable = ad.link ? `<a href="${ad.link}" target="_blank" rel="noopener">${media}</a>` : media;
        slot.innerHTML = `
            <div style="text-align: center;">
                ${clickable}
                <small style="display:block;color:#27ae60;margin-top:6px;">Aktif Reklam</small>
                <button class="btn btn-danger btn-sm" onclick="deleteActiveAd()" style="margin-top: 10px;">Aktif Reklamı Sil</button>
            </div>
        `;
    } else {
        slot.innerHTML = 'Bu alana reklam verebilirsiniz';
    }
}

// Delete active advertisement
async function deleteActiveAd() {
    if (!confirm('Aktif reklamı silmek istediğinizden emin misiniz?')) return;

    try {
        // Remove from homepage settings
        await db.collection('homepage_settings').doc('advertisement').delete();

        // Update any active advertisement to inactive
        const adsSnap = await db.collection('advertisements').where('active', '==', true).get();
        const updatePromises = adsSnap.docs.map(doc =>
            db.collection('advertisements').doc(doc.id).update({
                active: false,
                removedAt: new Date().toISOString()
            })
        );
        if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
        }

        alert('Aktif reklam başarıyla silindi!');
        updateHomepageAdSlot(null); // Reset the slot display
        await loadAdvertisements(); // Refresh the advertisements list
    } catch (error) {
        console.error('Aktif reklam silinirken hata:', error);
        alert('Aktif reklam silinirken hata oluştu: ' + error.message);
    }
}

// Upload file to Firebase Storage
async function uploadFileToStorage(file, path) {
    try {
        const storage = window.firebaseApp.storage();
        const storageRef = storage.ref();
        const fileRef = storageRef.child(path + Date.now() + '_' + file.name);

        const snapshot = await fileRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();

        return downloadURL;
    } catch (error) {
        console.error('Dosya yükleme hatası:', error);
        throw error;
    }
}


// Mobile menu toggle
function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('mobile-hidden');
}

// Initialize mobile responsiveness
document.addEventListener('DOMContentLoaded', function() {
    const header = document.querySelector('.header');
    let mobileToggle = document.querySelector('.sidebar-toggle');
    if (!mobileToggle && header) {
        mobileToggle = document.createElement('button');
        mobileToggle.className = 'sidebar-toggle';
        mobileToggle.innerHTML = '☰';
        mobileToggle.onclick = toggleMobileMenu;
        header.insertBefore(mobileToggle, header.firstChild);
    }

    const sidebar = document.querySelector('.sidebar');
    if (window.innerWidth <= 768 && sidebar) {
        sidebar.classList.add('mobile-hidden');
    }

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
        const sidebar = document.querySelector('.sidebar');
        const toggle = document.querySelector('.sidebar-toggle');

        if (!sidebar || !toggle) {
            return;
        }

        if (window.innerWidth <= 768 &&
            !sidebar.contains(e.target) &&
            !toggle.contains(e.target) &&
            !sidebar.classList.contains('mobile-hidden')) {
            sidebar.classList.add('mobile-hidden');
        }
    });

    // Initialize page navigation
    switchSuperAdminPage('dashboard');
});

// --- KREDİ PAKETLERİ YÖNETİMİ --- //

// Kredi paketlerini yükle ve listele
async function loadCreditPackagesAdmin() {
    const listDiv = document.getElementById('creditPackagesList');
    listDiv.innerHTML = '<p style="color:#95a5a6;">Yükleniyor...</p>';
    try {
        const snap = await db.collection('credit_packages').orderBy('credit').get();
        const pkgs = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        if (pkgs.length === 0) {
            listDiv.innerHTML = '<p style="color:#95a5a6;">Henüz kredi paketi yok.</p>';
            return;
        }
        let html = '<table style="width:100%;border-collapse:collapse;"><thead><tr><th>Kredi</th><th>Fiyat (₺)</th><th></th></tr></thead><tbody>';
        pkgs.forEach(pkg => {
            html += `<tr><td style='padding:8px;'>${pkg.credit}</td><td style='padding:8px;'>${pkg.price}</td><td style='padding:8px;'><button class='btn btn-danger btn-sm' onclick="deleteCreditPackage('${pkg.id}')">Sil</button></td></tr>`;
        });
        html += '</tbody></table>';
        listDiv.innerHTML = html;
    } catch (err) {
        listDiv.innerHTML = '<p style="color:#e74c3c;">Kredi paketleri yüklenemedi.</p>';
    }
}

async function loadCreditPurchaseBankSettings() {
    try {
        const doc = await db.collection('app_settings').doc('credit_purchase_bank').get();
        const data = doc.exists ? doc.data() : null;
        document.getElementById('creditPurchaseBankName').value = data?.bankName || '';
        document.getElementById('creditPurchaseAccountHolder').value = data?.accountHolder || '';
        document.getElementById('creditPurchaseIban').value = data?.iban || '';
        document.getElementById('creditPurchaseBankNote').value = data?.note || '';
        document.getElementById('creditPurchaseBankMeta').textContent = data?.updatedAt
            ? `Son güncelleme: ${new Date(data.updatedAt).toLocaleString('tr-TR')}`
            : 'Henüz kayıt yok.';
    } catch (error) {
        console.error('Kredi satın alma banka bilgileri yüklenemedi:', error);
        document.getElementById('creditPurchaseBankMeta').textContent = 'Banka bilgileri yüklenemedi.';
    }
}

async function saveCreditPurchaseBankSettings(e) {
    e.preventDefault();

    const bankName = document.getElementById('creditPurchaseBankName').value.trim();
    const accountHolder = document.getElementById('creditPurchaseAccountHolder').value.trim();
    const iban = document.getElementById('creditPurchaseIban').value.trim();
    const note = document.getElementById('creditPurchaseBankNote').value.trim();

    if (!bankName || !accountHolder || !iban) {
        alert('Banka adı, hesap sahibi ve IBAN zorunludur.');
        return;
    }

    try {
        await db.collection('app_settings').doc('credit_purchase_bank').set({
            bankName,
            accountHolder,
            iban,
            note,
            updatedAt: new Date().toISOString(),
            updatedBy: currentSuperAdmin.id
        });
        alert('Kredi satın alma banka bilgileri kaydedildi.');
        await loadCreditPurchaseBankSettings();
    } catch (error) {
        console.error('Kredi satın alma banka bilgileri kaydedilemedi:', error);
        alert('Banka bilgileri kaydedilemedi: ' + error.message);
    }
}

// Kredi paketi ekleme modalı aç/kapat
function openCreditPackageModal() {
    document.getElementById('creditPackageModal').classList.add('active');
    document.getElementById('creditPackageForm').reset();
}
function closeCreditPackageModal() {
    document.getElementById('creditPackageModal').classList.remove('active');
}

// Kredi paketi ekle
async function submitCreditPackage(e) {
    e.preventDefault();
    const credit = parseInt(document.getElementById('packageCredit').value);
    const price = parseFloat(document.getElementById('packagePrice').value);
    if (!credit || !price) {
        alert('Lütfen tüm alanları doldurun!');
        return;
    }
    try {
        await db.collection('credit_packages').add({credit, price, createdAt: new Date().toISOString()});
        closeCreditPackageModal();
        loadCreditPackagesAdmin();
        alert('Kredi paketi eklendi!');
    } catch (err) {
        alert('Kredi paketi eklenemedi: ' + err.message);
    }
}

// Kredi paketi sil
async function deleteCreditPackage(id) {
    if (!confirm('Bu kredi paketini silmek istediğinize emin misiniz?')) return;
    try {
        await db.collection('credit_packages').doc(id).delete();
        loadCreditPackagesAdmin();
    } catch (err) {
        alert('Kredi paketi silinemedi: ' + err.message);
    }
}

document.getElementById('creditPackageForm').addEventListener('submit', submitCreditPackage);
window.openCreditPackageModal = openCreditPackageModal;
window.closeCreditPackageModal = closeCreditPackageModal;
window.deleteCreditPackage = deleteCreditPackage;

// ======================== SUPER ADMIN CHAT SYSTEM ========================

// Load super admin chat list
async function loadSuperAdminChatList() {
    const container = document.getElementById('superAdminChatListContainer');
    if (!container) return;
    container.innerHTML = '<p style="color: #95a5a6;">Yükleniyor...</p>';
    try {
        // Get all chats where super admin is involved
        const chatsSnap = await db.collection('chats')
            .where('userIds', 'array-contains', currentSuperAdmin.id)
            .get();
        if (chatsSnap.empty) {
            container.innerHTML = '<p style="color: #95a5a6; text-align: center;">Henüz sohbet yok.</p>';
            return;
        }
        let html = '<div style="display: grid; gap: 15px;">';
        chatsSnap.forEach(doc => {
            const chat = doc.data();
            const chatId = doc.id;
            let title = '';
            let otherUser = null;
            if (chat.type === 'group') {
                title = chat.groupName || 'Grup Sohbeti';
            } else if (chat.type === 'credit-purchase') {
                title = 'Kredi Satın Alma';
                // Find the other user (trainer)
                otherUser = chat.users[chat.userIds.find(uid => uid !== currentSuperAdmin.id)];
            } else {
                // Direct chat: find the other user
                otherUser = chat.users[chat.userIds.find(uid => uid !== currentSuperAdmin.id)];
                title = otherUser ? otherUser.name : 'Sohbet';
            }
            html += `<div class="chat-list-item" id="chat-item-${chatId}" style="padding:15px; border:1px solid #eee; border-radius:8px; cursor:pointer; background:#f9f9f9;" onclick="openSuperAdminChatView('${chatId}', '${title.replace(/'/g, '\\\'')}')">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="flex: 1;">
                        <strong>${title}</strong><br>
                        <small style="color:#666;">${chat.type === 'group' ? 'Grup' : (chat.type === 'credit-purchase' ? 'Kredi' : 'Birebir')}</small>
                        ${otherUser ? `<br><small style="color:#999;">${otherUser.email}</small>` : ''}
                    </div>
                    <div id="unread-${chatId}" class="unread-badge" style="display: none; background: #e74c3c; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">0</div>
                </div>
            </div>`;
        });
        html += '</div>';
        container.innerHTML = html;

        // Set up listeners for unread messages
        setupUnreadMessageListeners(chatsSnap.docs);
    } catch (error) {
        container.innerHTML = '<p style="color: #e74c3c;">Sohbetler yüklenemedi.</p>';
    }
}

// Setup listeners for unread messages
function setupUnreadMessageListeners(chatDocs) {
    chatDocs.forEach(doc => {
        const chatId = doc.id;
        const chat = doc.data();

        // Listen for new messages in this chat
        db.collection('chats').doc(chatId).collection('messages')
            .where('senderId', '!=', currentSuperAdmin.id)
            .onSnapshot((snapshot) => {
                const newMessages = snapshot.docChanges().filter(change =>
                    change.type === 'added' && change.doc.data().senderId !== currentSuperAdmin.id
                );

                if (newMessages.length > 0 && activeSuperAdminChatId !== chatId) {
                    // Show unread badge
                    const badge = document.getElementById(`unread-${chatId}`);
                    if (badge) {
                        badge.style.display = 'flex';
                        const currentCount = parseInt(badge.textContent) || 0;
                        badge.textContent = currentCount + newMessages.length;
                    }

                    // Highlight the chat item
                    const chatItem = document.getElementById(`chat-item-${chatId}`);
                    if (chatItem) {
                        chatItem.style.background = '#fff3cd';
                        chatItem.style.borderColor = '#ffc107';
                    }
                }
            });
    });
}

// Open chat view for super admin
function openSuperAdminChatView(chatId, title) {
    // Update the right side of the chat page instead of switching to full page
    const chatViewContainer = document.getElementById('superAdminChatViewContainer');
    if (!chatViewContainer) return;

    // Check if this is a group chat to show management button
    db.collection('chats').doc(chatId).get().then(doc => {
        const isGroup = doc.exists && doc.data().type === 'group';

        // Set up the chat UI structure
        chatViewContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h4 id="superAdminChatViewTitle">💬 ${title}</h4>
                <div style="display: flex; gap: 10px;">
                    ${isGroup ? '<button class="btn btn-info btn-sm" id="superAdminGroupManageBtn" onclick="openSuperAdminGroupManagement()">⚙️ Grup Yönetimi</button>' : ''}
                    <button class="btn btn-secondary btn-sm" onclick="closeSuperAdminChatView()">← Geri Dön</button>
                </div>
            </div>

            <div style="height: 400px; border: 1px solid #ddd; border-radius: 5px; padding: 15px; background: white; display: flex; flex-direction: column;">
                <div id="superAdminChatMessages" style="flex: 1; overflow-y: auto; margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 5px;">
                    <p style="color: #95a5a6; text-align: center;">Mesajlar yükleniyor...</p>
                </div>

                <form id="superAdminChatForm" style="display: flex; gap: 10px;">
                    <input type="text" id="superAdminChatMessageInput" placeholder="Mesajınızı yazın..." style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 5px;" required>
                    <button type="submit" class="btn btn-success">Gönder</button>
                </form>
            </div>
        `;

        activeSuperAdminChatId = chatId;

        // Load messages
        loadSuperAdminChatMessages(chatId);

        // Add event listener for the chat form
        const chatForm = document.getElementById('superAdminChatForm');
        if (chatForm) {
            chatForm.addEventListener('submit', sendSuperAdminChatMessage);
        }

        // Clear unread badge when opening chat
        const badge = document.getElementById(`unread-${chatId}`);
        if (badge) {
            badge.style.display = 'none';
            badge.textContent = '0';
        }

        // Reset chat item highlighting
        const chatItem = document.getElementById(`chat-item-${chatId}`);
        if (chatItem) {
            chatItem.style.background = '#f9f9f9';
            chatItem.style.borderColor = '#eee';
        }
    }).catch(error => {
        console.error('Chat verisi alınırken hata:', error);
    });
}

// Close chat view and return to chat list
function closeSuperAdminChatView() {
    document.getElementById('super-admin-chat-view-page').classList.remove('active');
    document.getElementById('chat-page').classList.add('active');

    if (superAdminChatUnsub) {
        superAdminChatUnsub();
        superAdminChatUnsub = null;
    }
    activeSuperAdminChatId = null;
}

// Load chat messages
async function loadSuperAdminChatMessages(chatId) {
    try {
        const messagesContainer = document.getElementById('superAdminChatMessages');
        messagesContainer.innerHTML = '<p style="color: #95a5a6; text-align: center;">Mesajlar yükleniyor...</p>';

        // Set up real-time listener for messages
        superAdminChatUnsub = db.collection('chats').doc(chatId).collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot((snapshot) => {
                const messages = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));

                if (messages.length === 0) {
                    messagesContainer.innerHTML = '<p style="color: #95a5a6; text-align: center;">Henüz mesaj yok.</p>';
                    return;
                }

                let html = '';
                messages.forEach(message => {
                    const isOwnMessage = message.senderId === currentSuperAdmin.id;
                    const messageTime = new Date(message.timestamp).toLocaleTimeString('tr-TR', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });

                    html += `
                        <div style="margin-bottom: 15px; ${isOwnMessage ? 'text-align: right;' : 'text-align: left;'}">
                            <div style="display: inline-block; max-width: 70%; padding: 10px 15px; border-radius: 15px; background: ${isOwnMessage ? '#007bff' : '#f1f1f1'}; color: ${isOwnMessage ? 'white' : '#333'};">
                                <div style="font-size: 0.9em; margin-bottom: 5px; font-weight: bold;">
                                    ${message.senderName}
                                </div>
                                <div>${message.text}</div>
                                <div style="font-size: 0.8em; opacity: 0.7; margin-top: 5px;">
                                    ${messageTime}
                                </div>
                            </div>
                        </div>
                    `;
                });

                messagesContainer.innerHTML = html;
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, (error) => {
                console.error('Mesajlar dinlenirken hata:', error);
                messagesContainer.innerHTML = '<p style="color: #e74c3c; text-align: center;">Mesajlar yüklenemedi.</p>';
            });

    } catch (error) {
        console.error('Mesajlar yüklenirken hata:', error);
        document.getElementById('superAdminChatMessages').innerHTML = '<p style="color: #e74c3c; text-align: center;">Mesajlar yüklenemedi.</p>';
    }
}

// Send chat message
async function sendSuperAdminChatMessage(e) {
    e.preventDefault();
    console.log('sendSuperAdminChatMessage called');

    const messageInput = document.getElementById('superAdminChatMessageInput');
    const messageText = messageInput.value.trim();

    console.log('Message text:', messageText);
    console.log('Active chat ID:', activeSuperAdminChatId);

    if (!messageText || !activeSuperAdminChatId) {
        console.log('Missing message text or active chat ID');
        return;
    }

    try {
        console.log('Sending message to Firestore...');
        await db.collection('chats').doc(activeSuperAdminChatId).collection('messages').add({
            text: messageText,
            senderId: currentSuperAdmin.id,
            senderName: currentSuperAdmin.name,
            timestamp: new Date().toISOString()
        });

        console.log('Message sent successfully');
        messageInput.value = '';
    } catch (error) {
        console.error('Mesaj gönderilirken hata:', error);
        alert('Mesaj gönderilemedi: ' + error.message);
    }
}

// Open new chat email page
function openNewChatEmailPage() {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.getElementById('super-admin-new-chat-email-page').classList.add('active');

    document.getElementById('superAdminNewChatEmailForm').addEventListener('submit', submitSuperAdminNewChatByEmail);
    document.getElementById('superAdminChatEmailInput').addEventListener('input', superAdminChatEmailLookupUser);
}

// Close new chat email page
function closeSuperAdminNewChatEmailPage() {
    document.getElementById('super-admin-new-chat-email-page').classList.remove('active');
    document.getElementById('chat-page').classList.add('active');

    document.getElementById('superAdminNewChatEmailForm').reset();
    document.getElementById('superAdminChatEmailUserInfo').textContent = '';
}

// Email lookup for new chat
async function superAdminChatEmailLookupUser(e) {
    const email = e.target.value.trim().toLowerCase();
    const infoDiv = document.getElementById('superAdminChatEmailUserInfo');
    infoDiv.textContent = '';

    if (!email) return;

    // Lookup user by email (trainers, admins, parents, secretaries)
    let userDoc = null, userName = null, userRole = null;
    const collections = [
        { col: 'trainers', role: 'Antrenör' },
        { col: 'admins', role: 'Yönetici' },
        { col: 'parents', role: 'Veli' },
        { col: 'users', role: 'Sekreter' } // secretaries are stored in users collection
    ];

    for (const { col, role } of collections) {
        const snap = await db.collection(col).where('email', '==', email).limit(1).get();
        if (!snap.empty) {
            userDoc = snap.docs[0];
            const data = userDoc.data();
            userName = data.name || data.fullName || email;
            userRole = role;
            break;
        }
    }

    if (userDoc) {
        infoDiv.textContent = `${userName} (${userRole})`;
        infoDiv.style.color = '#2980b9';
    } else {
        infoDiv.textContent = 'Kullanıcı bulunamadı';
        infoDiv.style.color = '#e74c3c';
    }
}

// Submit new chat by email
async function submitSuperAdminNewChatByEmail(e) {
    e.preventDefault();

    const email = document.getElementById('superAdminChatEmailInput').value.trim().toLowerCase();
    if (!email) {
        alert('Lütfen bir e-posta giriniz!');
        return;
    }

    // Lookup user by email
    let userDoc = null, userId = null, userName = null, userRole = null;
    const collections = [
        { col: 'trainers', role: 'trainer' },
        { col: 'admins', role: 'admin' },
        { col: 'parents', role: 'parent' },
        { col: 'users', role: 'secretary' }
    ];

    for (const { col, role } of collections) {
        const snap = await db.collection(col).where('email', '==', email).limit(1).get();
        if (!snap.empty) {
            userDoc = snap.docs[0];
            const data = userDoc.data();
            userId = userDoc.id;
            userName = data.name || data.fullName || email;
            userRole = role;
            break;
        }
    }

    if (!userId) {
        alert('Kullanıcı bulunamadı!');
        return;
    }

    // Check if chat already exists
    let chatId = null;
    const chatQuery = await db.collection('chats')
        .where('type', '==', 'direct')
        .where('userIds', 'array-contains', currentSuperAdmin.id)
        .get();

    if (!chatQuery.empty) {
        // Find chat with both users
        chatQuery.forEach(doc => {
            const data = doc.data();
            if (data.userIds.includes(userId) && data.userIds.length === 2) {
                chatId = doc.id;
            }
        });
    }

    if (!chatId) {
        // Create new chat
        const chatDoc = await db.collection('chats').add({
            userIds: [currentSuperAdmin.id, userId],
            users: {
                [currentSuperAdmin.id]: { name: currentSuperAdmin.name, role: 'superadmin' },
                [userId]: { name: userName, role: userRole }
            },
            type: 'direct',
            createdAt: new Date().toISOString()
        });
        chatId = chatDoc.id;
    }

    closeSuperAdminNewChatEmailPage();
    openSuperAdminChatView(chatId, userName);
}

// Open new group chat modal
function openNewGroupChatModal() {
    document.getElementById('superAdminNewGroupChatModal').style.display = 'flex';
    document.getElementById('superAdminNewGroupChatForm').addEventListener('submit', submitSuperAdminNewGroupChat);
}

// Close new group chat modal
function closeSuperAdminNewGroupChatModal() {
    document.getElementById('superAdminNewGroupChatModal').style.display = 'none';
    document.getElementById('superAdminNewGroupChatForm').reset();
}

// Submit new group chat
async function submitSuperAdminNewGroupChat(e) {
    e.preventDefault();

    const groupName = document.getElementById('superAdminGroupChatName').value.trim();
    const emailsRaw = document.getElementById('superAdminGroupChatUserEmails').value.trim();

    if (!groupName || !emailsRaw) {
        alert('Lütfen grup adı ve e-posta adreslerini giriniz!');
        return;
    }

    // Parse emails
    const emails = emailsRaw.split(',').map(e => e.trim().toLowerCase()).filter(e => e);
    if (emails.length === 0) {
        alert('En az bir e-posta adresi giriniz!');
        return;
    }

    // Add current super admin's email if not present
    if (!emails.includes(currentSuperAdmin.email)) {
        emails.push(currentSuperAdmin.email);
    }

    // Lookup all users by email
    const userIds = [];
    const users = {};

    for (const email of emails) {
        let found = false;
        for (const { col, role } of [
            { col: 'trainers', role: 'trainer' },
            { col: 'admins', role: 'admin' },
            { col: 'parents', role: 'parent' },
            { col: 'users', role: 'secretary' }
        ]) {
            const snap = await db.collection(col).where('email', '==', email).limit(1).get();
            if (!snap.empty) {
                const doc = snap.docs[0];
                userIds.push(doc.id);
                users[doc.id] = {
                    name: doc.data().name || doc.data().fullName || email,
                    role,
                    email
                };
                found = true;
                break;
            }
        }
        if (!found) {
            alert(`Kullanıcı bulunamadı: ${email}`);
            return;
        }
    }

    // Create group chat
    try {
        const chatDoc = await db.collection('chats').add({
            userIds,
            userEmails: emails,
            users,
            type: 'group',
            groupName,
            createdBy: currentSuperAdmin.id,
            createdAt: new Date().toISOString()
        });

        closeSuperAdminNewGroupChatModal();
        openSuperAdminChatView(chatDoc.id, groupName);
        loadSuperAdminChatList(); // Refresh chat list
    } catch (error) {
        console.error('Grup sohbeti oluşturulurken hata:', error);
        alert('Grup sohbeti oluşturulamadı: ' + error.message);
    }
}

// ======================== GROUP MANAGEMENT FUNCTIONS ========================

let currentManagedGroupId = null;

// Open group management modal
function openSuperAdminGroupManagement() {
    if (!activeSuperAdminChatId) return;

    // Get chat data
    db.collection('chats').doc(activeSuperAdminChatId).get().then(doc => {
        if (!doc.exists) return;

        const chat = doc.data();
        if (chat.type !== 'group') return;

        currentManagedGroupId = activeSuperAdminChatId;

        // Populate form
        document.getElementById('superAdminGroupManageName').value = chat.groupName || '';

        // Set current photo
        const photoElement = document.getElementById('superAdminGroupCurrentPhoto');
        if (chat.groupPhoto) {
            photoElement.src = chat.groupPhoto;
        } else {
            photoElement.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23ddd%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-size=%2224%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22%3E👥%3C/text%3E%3C/svg%3E';
        }

        // Load members list
        loadSuperAdminGroupMembers(chat.userIds, chat.users);

        // Show modal
        document.getElementById('superAdminGroupManagementModal').classList.add('active');
    }).catch(error => {
        console.error('Grup verisi alınırken hata:', error);
        alert('Grup verisi yüklenirken hata oluştu');
    });
}

// Close group management modal
function closeSuperAdminGroupManagementModal() {
    document.getElementById('superAdminGroupManagementModal').classList.remove('active');
    document.getElementById('superAdminGroupManagementForm').reset();
    currentManagedGroupId = null;
}

// Load group members list
function loadSuperAdminGroupMembers(userIds, users) {
    const container = document.getElementById('superAdminGroupMembersList');
    container.innerHTML = '';

    if (!userIds || !users) return;

    userIds.forEach(userId => {
        const user = users[userId];
        if (user) {
            const memberDiv = document.createElement('div');
            memberDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee;';
            memberDiv.innerHTML = `
                <span>${user.name} (${user.role})</span>
                ${userId !== currentSuperAdmin.id ? `<button class="btn btn-danger btn-sm" onclick="removeSuperAdminGroupMember('${userId}')">Çıkar</button>` : '<span style="color: #666; font-size: 0.9em;">(Siz)</span>'}
            `;
            container.appendChild(memberDiv);
        }
    });
}

// Add new member to group
async function addSuperAdminGroupMember() {
    const emailInput = document.getElementById('superAdminGroupAddMemberEmail');
    const email = emailInput.value.trim().toLowerCase();

    if (!email) {
        alert('Lütfen bir email adresi girin!');
        return;
    }

    try {
        // Lookup user by email
        let userDoc = null, userId = null, userName = null, userRole = null;
        const collections = [
            { col: 'trainers', role: 'trainer' },
            { col: 'admins', role: 'admin' },
            { col: 'parents', role: 'parent' },
            { col: 'users', role: 'secretary' }
        ];

        for (const { col, role } of collections) {
            const snap = await db.collection(col).where('email', '==', email).limit(1).get();
            if (!snap.empty) {
                userDoc = snap.docs[0];
                const data = userDoc.data();
                userId = userDoc.id;
                userName = data.name || data.fullName || email;
                userRole = role;
                break;
            }
        }

        if (!userId) {
            alert('Kullanıcı bulunamadı!');
            return;
        }

        // Check if user is already in group
        const chatDoc = await db.collection('chats').doc(currentManagedGroupId).get();
        if (!chatDoc.exists) return;

        const chat = chatDoc.data();
        if (chat.userIds.includes(userId)) {
            alert('Bu kullanıcı zaten grupta!');
            return;
        }

        // Add user to group
        const updatedUserIds = [...chat.userIds, userId];
        const updatedUsers = {
            ...chat.users,
            [userId]: { name: userName, role: userRole, email }
        };

        await db.collection('chats').doc(currentManagedGroupId).update({
            userIds: updatedUserIds,
            users: updatedUsers,
            userEmails: [...(chat.userEmails || []), email]
        });

        // Reload members list
        loadSuperAdminGroupMembers(updatedUserIds, updatedUsers);

        // Clear input
        emailInput.value = '';

        alert('Üye başarıyla eklendi!');
    } catch (error) {
        console.error('Üye eklenirken hata:', error);
        alert('Üye eklenirken hata oluştu: ' + error.message);
    }
}

// Remove member from group
async function removeSuperAdminGroupMember(userId) {
    if (!confirm('Bu üyeyi gruptan çıkarmak istediğinize emin misiniz?')) return;

    try {
        const chatDoc = await db.collection('chats').doc(currentManagedGroupId).get();
        if (!chatDoc.exists) return;

        const chat = chatDoc.data();
        const updatedUserIds = chat.userIds.filter(id => id !== userId);
        const updatedUsers = { ...chat.users };
        delete updatedUsers[userId];

        const userEmail = chat.users[userId]?.email;
        const updatedUserEmails = chat.userEmails ? chat.userEmails.filter(email => email !== userEmail) : [];

        await db.collection('chats').doc(currentManagedGroupId).update({
            userIds: updatedUserIds,
            users: updatedUsers,
            userEmails: updatedUserEmails
        });

        // Reload members list
        loadSuperAdminGroupMembers(updatedUserIds, updatedUsers);

        alert('Üye gruptan çıkarıldı!');
    } catch (error) {
        console.error('Üye çıkarılırken hata:', error);
        alert('Üye çıkarılırken hata oluştu: ' + error.message);
    }
}

// Save group changes
async function saveSuperAdminGroupChanges(e) {
    e.preventDefault();

    const newName = document.getElementById('superAdminGroupManageName').value.trim();
    const newPhotoFile = document.getElementById('superAdminGroupManagePhoto').files[0];

    if (!newName) {
        alert('Grup adı zorunludur!');
        return;
    }

    try {
        const updateData = { groupName: newName };

        // Handle photo upload
        if (newPhotoFile) {
            try {
                const photoUrl = await uploadFileToStorage(newPhotoFile, 'group-photos/');
                updateData.groupPhoto = photoUrl;
            } catch (uploadError) {
                console.warn('Fotoğraf yükleme başarısız:', uploadError.message);
                // Continue without photo
            }
        }

        await db.collection('chats').doc(currentManagedGroupId).update(updateData);

        // Update chat title if changed
        if (document.getElementById('superAdminChatViewTitle')) {
            document.getElementById('superAdminChatViewTitle').textContent = `💬 ${newName}`;
        }

        alert('Grup bilgileri güncellendi!');
        closeSuperAdminGroupManagementModal();

        // Refresh chat list
        loadSuperAdminChatList();
    } catch (error) {
        console.error('Grup güncellenirken hata:', error);
        alert('Grup güncellenirken hata oluştu: ' + error.message);
    }
}

// Delete group
async function deleteSuperAdminGroup() {
    if (!confirm('Bu grubu silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) return;

    try {
        await db.collection('chats').doc(currentManagedGroupId).delete();

        alert('Grup silindi!');
        closeSuperAdminGroupManagementModal();

        // Close chat view and go back to chat list
        closeSuperAdminChatView();
        loadSuperAdminChatList();
    } catch (error) {
        console.error('Grup silinirken hata:', error);
        alert('Grup silinirken hata oluştu: ' + error.message);
    }
}

// Update group creation to include photo
async function submitSuperAdminNewGroupChat(e) {
    e.preventDefault();

    const groupName = document.getElementById('superAdminGroupChatName').value.trim();
    const emailsRaw = document.getElementById('superAdminGroupChatUserEmails').value.trim();
    const photoFile = document.getElementById('superAdminGroupChatPhoto').files[0];

    if (!groupName || !emailsRaw) {
        alert('Lütfen grup adı ve e-posta adreslerini giriniz!');
        return;
    }

    // Parse emails
    const emails = emailsRaw.split(',').map(e => e.trim().toLowerCase()).filter(e => e);
    if (emails.length === 0) {
        alert('En az bir e-posta adresi giriniz!');
        return;
    }

    // Add current super admin's email if not present
    if (!emails.includes(currentSuperAdmin.email)) {
        emails.push(currentSuperAdmin.email);
    }

    // Lookup all users by email
    const userIds = [];
    const users = {};

    for (const email of emails) {
        let found = false;
        for (const { col, role } of [
            { col: 'trainers', role: 'trainer' },
            { col: 'admins', role: 'admin' },
            { col: 'parents', role: 'parent' },
            { col: 'users', role: 'secretary' }
        ]) {
            const snap = await db.collection(col).where('email', '==', email).limit(1).get();
            if (!snap.empty) {
                const doc = snap.docs[0];
                userIds.push(doc.id);
                users[doc.id] = {
                    name: doc.data().name || doc.data().fullName || email,
                    role,
                    email
                };
                found = true;
                break;
            }
        }
        if (!found) {
            alert(`Kullanıcı bulunamadı: ${email}`);
            return;
        }
    }

    try {
        const groupData = {
            userIds,
            userEmails: emails,
            users,
            type: 'group',
            groupName,
            createdAt: new Date().toISOString()
        };

        // Handle photo upload
        if (photoFile) {
            try {
                const photoUrl = await uploadFileToStorage(photoFile, 'group-photos/');
                groupData.groupPhoto = photoUrl;
            } catch (uploadError) {
                console.warn('Grup fotoğrafı yüklenemedi:', uploadError.message);
                // Continue without photo
            }
        }

        const chatDoc = await db.collection('chats').add(groupData);

        closeSuperAdminNewGroupChatModal();
        openSuperAdminChatView(chatDoc.id, groupName);
        loadSuperAdminChatList(); // Refresh chat list
    } catch (error) {
        console.error('Grup sohbeti oluşturulurken hata:', error);
        alert('Grup sohbeti oluşturulamadı: ' + error.message);
    }
}

// Show/hide group management button based on chat type
function updateSuperAdminGroupManagementButton(chatId) {
    const manageBtn = document.getElementById('superAdminGroupManageBtn');

    db.collection('chats').doc(chatId).get().then(doc => {
        if (doc.exists && doc.data().type === 'group') {
            manageBtn.style.display = 'inline-block';
        } else {
            manageBtn.style.display = 'none';
        }
    }).catch(error => {
        console.error('Chat type kontrolü hatası:', error);
        manageBtn.style.display = 'none';
    });
}

// Add event listeners for chat forms
document.addEventListener('DOMContentLoaded', () => {
    // Other form listeners can be added here if needed
    // Super admin chat form is handled dynamically in openSuperAdminChatView

    // Group management form
    const groupManageForm = document.getElementById('superAdminGroupManagementForm');
    if (groupManageForm) {
        groupManageForm.addEventListener('submit', saveSuperAdminGroupChanges);
    }

    // Standards form listeners
    const addStandardForm = document.getElementById('addStandardForm');
    if (addStandardForm) {
        addStandardForm.addEventListener('submit', addStandard);
    }

    const editStandardForm = document.getElementById('editStandardForm');
    if (editStandardForm) {
        editStandardForm.addEventListener('submit', updateStandard);
    }

    const bulkEditStandardForm = document.getElementById('bulkEditStandardGroupForm');
    if (bulkEditStandardForm) {
        bulkEditStandardForm.addEventListener('submit', updateStandardGroupBulk);
    }

    // Cash withdrawal form listeners
    const exchangeRateForm = document.getElementById('exchangeRateForm');
    if (exchangeRateForm) {
        exchangeRateForm.addEventListener('submit', saveExchangeRate);
    }
});

// ==================== KREDI BOZDURMA YÖNETİMİ ====================

// Bozdurma oranını yükle
async function loadExchangeRate() {
    try {
        const rateSnap = await db.collection('app_settings')
            .doc('credit_exchange_rate')
            .get();

        if (rateSnap.exists) {
            const data = rateSnap.data();
            document.getElementById('creditAmount').value = data.creditAmount || 100;
            document.getElementById('turAmount').value = data.turAmount || 50;
            updateExchangeRateDisplay(data.creditAmount, data.turAmount);
        } else {
            // Varsayılan oran oluştur
            await db.collection('app_settings').doc('credit_exchange_rate').set({
                creditAmount: 100,
                turAmount: 50,
                updatedAt: new Date().toISOString()
            });
            document.getElementById('creditAmount').value = 100;
            document.getElementById('turAmount').value = 50;
            updateExchangeRateDisplay(100, 50);
        }
    } catch (error) {
        console.error('Bozdurma oranı yüklenirken hata:', error);
        document.getElementById('currentExchangeRate').textContent = 'Yüklenemedi';
    }
}

// Bozdurma oranını göster
function updateExchangeRateDisplay(credits, tl) {
    const rate = (tl / credits).toFixed(2);
    document.getElementById('currentExchangeRate').textContent = 
        `${credits} Kredi = ${tl} TL (1 Kredi = ${rate} TL)`;
}

// Bozdurma oranını kaydet
async function saveExchangeRate(e) {
    e.preventDefault();

    const creditAmount = Number(document.getElementById('creditAmount').value);
    const turAmount = Number(document.getElementById('turAmount').value);

    if (creditAmount <= 0 || turAmount <= 0) {
        alert('Lütfen geçerli değerler giriniz.');
        return;
    }

    try {
        await db.collection('app_settings').doc('credit_exchange_rate').set({
            creditAmount: creditAmount,
            turAmount: turAmount,
            updatedAt: new Date().toISOString(),
            updatedBy: currentSuperAdmin.id
        });

        alert('Bozdurma oranı başarıyla kaydedildi!');
        updateExchangeRateDisplay(creditAmount, turAmount);
    } catch (error) {
        console.error('Bozdurma oranı kaydedilirken hata:', error);
        alert('Hata: ' + error.message);
    }
}

// Bozdurma taleplerini yükle
async function loadWithdrawalRequests() {
    try {
        const requestsSnap = await db.collection('cash_withdrawal_requests')
            .where('status', 'in', ['pending', 'processing'])
            .orderBy('createdAt', 'desc')
            .get();

        const requests = requestsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        displayWithdrawalRequests(requests);
    } catch (error) {
        console.error('Bozdurma talepleri yüklenirken hata:', error);
        document.getElementById('withdrawalRequestsTableBody').innerHTML = 
            '<tr><td colspan="7" style="padding: 20px; text-align: center; color: #e74c3c;">Talepler yüklenemedi.</td></tr>';
    }
}

// Bozdurma taleplerini göster
function displayWithdrawalRequests(requests) {
    const tbody = document.getElementById('withdrawalRequestsTableBody');

    if (requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center; color: #95a5a6;">Bekleyen talep yok.</td></tr>';
        return;
    }

    let html = '';
    requests.forEach(req => {
        const statusColor = req.status === 'pending' ? '#f39c12' : '#3498db';
        const statusText = req.status === 'pending' ? 'Beklemede' : 'İşlemde';
        const paymentMethod = req.paymentMethod === 'crypto' ? '🔐 Kripto' : '🏦 EFT';
        const createdDate = new Date(req.createdAt).toLocaleDateString('tr-TR');

        html += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px;">${req.trainerName}</td>
                <td style="padding: 12px;">💳 ${req.creditAmount}</td>
                <td style="padding: 12px; font-weight: 600; color: #27ae60;">₺${req.turAmount.toFixed(2)}</td>
                <td style="padding: 12px;">${paymentMethod}</td>
                <td style="padding: 12px;"><span style="background: ${statusColor}; color: white; padding: 4px 8px; border-radius: 3px; font-size: 0.85em;">${statusText}</span></td>
                <td style="padding: 12px;">${createdDate}</td>
                <td style="padding: 12px; text-align: center;">
                    <button class="btn btn-success btn-sm" onclick="approveWithdrawalRequest('${req.id}')">Onayla</button>
                    <button class="btn btn-danger btn-sm" onclick="rejectWithdrawalRequest('${req.id}')">Reddet</button>
                    <button class="btn btn-info btn-sm" onclick="viewWithdrawalDetails('${req.id}')">Detay</button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// Bozdurma talebini onayla
async function approveWithdrawalRequest(requestId) {
    if (!confirm('Bu bozdurma talebini onaylamak istediğinize emin misiniz?')) {
        return;
    }

    try {
        const requestDoc = await db.collection('cash_withdrawal_requests').doc(requestId).get();
        const request = requestDoc.data();

        // Antrenörü al
        const trainerDoc = await db.collection('users').doc(request.trainerId).get();
        const trainer = trainerDoc.data();

        // Talep durumunu "processing" olarak güncelle
        await db.collection('cash_withdrawal_requests').doc(requestId).update({
            status: 'processing',
            approvedAt: new Date().toISOString(),
            approvedBy: currentSuperAdmin.id
        });

        // Antrenöre bildirim gönder
        await sendNotificationToTrainer(
            request.trainerId,
            'Kredi Bozdurma Talebiniz Onaylandı',
            'Ödeme 40 dakika içinde yapılacaktır.',
            'cash_withdrawal'
        );

        alert('Talep onaylandı! Antrenöre bildirim gönderildi.');
        loadWithdrawalRequests();
    } catch (error) {
        console.error('Talep onaylanırken hata:', error);
        alert('Hata: ' + error.message);
    }
}

// Bozdurma talebini reddet
async function rejectWithdrawalRequest(requestId) {
    const reason = prompt('Reddetme nedenini giriniz:');
    if (!reason) return;

    try {
        const requestDoc = await db.collection('cash_withdrawal_requests').doc(requestId).get();
        const request = requestDoc.data();

        const creditRef = db.collection('user_credits').doc(request.trainerId);
        await db.runTransaction(async transaction => {
            const creditDoc = await transaction.get(creditRef);
            const creditData = creditDoc.exists ? creditDoc.data() : {};
            const balance = Number(creditData.balance || 0);
            const blockedCredits = Number(creditData.blockedCredits || 0);
            transaction.set(creditRef, {
                balance: balance + Number(request.creditAmount || 0),
                blockedCredits: Math.max(0, blockedCredits - Number(request.creditAmount || 0)),
                lastUpdated: new Date().toISOString()
            }, { merge: true });
        });

        await db.collection('credit_transactions').add({
            userId: request.trainerId,
            amount: Number(request.creditAmount || 0),
            type: 'cash_withdrawal_release',
            description: `Bozdurma talebi reddedildi: ${reason}`,
            referenceId: requestId,
            timestamp: new Date().toISOString()
        });

        // Talep durumunu "rejected" olarak güncelle
        await db.collection('cash_withdrawal_requests').doc(requestId).update({
            status: 'rejected',
            rejectionReason: reason,
            rejectedAt: new Date().toISOString(),
            rejectedBy: currentSuperAdmin.id
        });

        // Antrenöre bildirim gönder
        await sendNotificationToTrainer(
            request.trainerId,
            'Kredi Bozdurma Talebiniz Reddedildi',
            `Nedenler: ${reason}`,
            'cash_withdrawal_rejected'
        );

        alert('Talep reddedildi! Antrenöre bildirim gönderildi.');
        loadWithdrawalRequests();
    } catch (error) {
        console.error('Talep reddedilirken hata:', error);
        alert('Hata: ' + error.message);
    }
}

// Bozdurma detaylarını görüntüle
async function viewWithdrawalDetails(requestId) {
    try {
        const requestDoc = await db.collection('cash_withdrawal_requests').doc(requestId).get();
        const request = requestDoc.data();

        let details = `
BOZDURMA TALEBİ DETAYLARI
========================

Antrenör: ${request.trainerName}
Kredi Miktarı: ${request.creditAmount} kredi
TL Tutarı: ₺${request.turAmount.toFixed(2)}
Durum: ${request.status === 'pending' ? 'Beklemede' : request.status === 'processing' ? 'İşlemde' : 'Tamamlandı'}

Ödeme Yöntemi: ${request.paymentMethod === 'crypto' ? 'Kripto Para' : 'EFT'}
`;

        if (request.paymentMethod === 'crypto') {
            details += `
Kripto Ağı: ${request.network}
Kripto Cüzdan: ${request.walletAddress}
Coin Türü: ${request.coinType}
`;
        } else {
            details += `
IBAN: ${request.iban}
Sahip Adı: ${request.accountName}
`;
        }

        details += `
Talep Tarihi: ${new Date(request.createdAt).toLocaleString('tr-TR')}
`;
        
        alert(details);
    } catch (error) {
        console.error('Detaylar yüklenirken hata:', error);
        alert('Detaylar yüklenemedi.');
    }
}

// Antrenöre bildirim gönder (yardımcı fonksiyon)
async function sendNotificationToTrainer(trainerId, title, message, type) {
    try {
        await db.collection('notifications').add({
            userId: trainerId,
            title: title,
            message: message,
            type: type,
            read: false,
            createdAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Bildirim gönderilemedi:', error);
    }
}

// ==================== BARAJ (STANDARDS) YÖNETİMİ ====================

let allStandardsSuperAdmin = [];
let expandedStandardGroups = new Set();
let standardGroupsIndex = new Map();

function cleanStandardDocumentTitle(value) {
    const rawTitle = String(value || '').trim();
    if (!rawTitle) return 'BARAJ';

    const upperTitle = rawTitle.toLocaleUpperCase('tr-TR')
        .replace(/\b\d{1,2}\s*[-–]\s*\d{1,2}\s+[A-ZÇĞİÖŞÜ]+\s+20\d{2}\b/g, ' ')
        .replace(/\b\d{1,2}\s+[A-ZÇĞİÖŞÜ]+\s+20\d{2}\b/g, ' ')
        .replace(/\b20\d{2}\b/g, ' ')
        .replace(/\bTÜRKİYE\s+YÜZME\s+FEDERASYONU\b/g, ' ')
        .replace(/\bTURKIYE\s+YUZME\s+FEDERASYONU\b/g, ' ')
        .replace(/\b\d{1,2}\s*[-/]\s*\d{1,2}\s*YAŞ\b/g, ' ')
        .replace(/\b\d{1,2}\s+\d{1,2}\s*YAŞ\b/g, ' ')
        .replace(/\b[A-ZÇĞİÖŞÜ]+\s+ANISINA\b/g, ' ')
        .replace(/\bARENA\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const priorityMarkers = [
        'ULUSAL GELİŞİM LİGİ',
        'TÜRKİYE FİNALİ',
        'TURKIYE FINALI',
        'ANALİG',
        'ANALIG',
        'OKUL SPORLARI',
        'MİLLİ TAKIM',
        'MILLI TAKIM'
    ];

    const foundIndexes = priorityMarkers
        .map(marker => upperTitle.indexOf(marker))
        .filter(index => index >= 0)
        .sort((left, right) => left - right);

    const normalizedTitle = foundIndexes.length ? upperTitle.slice(foundIndexes[0]).trim() : upperTitle;
    return normalizedTitle.replace(/\s+/g, ' ').trim() || 'BARAJ';
}

function buildReadableStandardGroupTitle(standard) {
    const year = standard.birthYear ? String(standard.birthYear) : '';
    const eventTitle = cleanStandardDocumentTitle(standard.name || standard.groupLabel || '');
    const poolLabel = standard.poolType ? `${standard.poolType} metre` : '';
    const categoryLabel = standard.category ? String(standard.category).toLocaleLowerCase('tr-TR') : '';
    return [year, eventTitle, poolLabel, categoryLabel].filter(Boolean).join(' ').trim();
}

function buildReadableStandardSubtitle(standard) {
    const scopeLabel = standard.scopeType === 'admin' ? 'Kulüp barajı' : 'Genel baraj';
    return scopeLabel;
}

// Barajları yükle
async function loadStandardsSuperAdmin() {
    try {
        const standardsSnap = await db.collection('standards')
            .orderBy('name')
            .get();

        allStandardsSuperAdmin = standardsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        displayStandardsSuperAdmin(allStandardsSuperAdmin);
    } catch (error) {
        console.error('Barajlar yüklenirken hata:', error);
        document.getElementById('standardsTableBody').innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center; color: #e74c3c;">Barajlar yüklenemedi.</td></tr>';
    }
}

// Barajları göster
function displayStandardsSuperAdmin(standards) {
    const tbody = document.getElementById('standardsTableBody');
    
    if (standards.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center; color: #95a5a6;">Henüz baraj tanımlanmadı.</td></tr>';
        return;
    }

    const groupedStandards = new Map();
    standards.forEach(standard => {
        const title = buildReadableStandardGroupTitle(standard);
        const subtitle = buildReadableStandardSubtitle(standard);
        const groupKey = [standard.birthYear || '', cleanStandardDocumentTitle(standard.name || standard.groupLabel || ''), standard.poolType || '', standard.category || '', standard.adminId || '', standard.scopeType || 'global'].join('|');
        if (!groupedStandards.has(groupKey)) {
            groupedStandards.set(groupKey, {
                key: groupKey,
                title,
                subtitle,
                items: []
            });
        }
        groupedStandards.get(groupKey).items.push(standard);
    });

    standardGroupsIndex = groupedStandards;

    let html = '';
    Array.from(groupedStandards.values())
        .sort((left, right) => Number(right.items[0]?.birthYear || 0) - Number(left.items[0]?.birthYear || 0)
            || String(left.title || '').localeCompare(String(right.title || ''), 'tr')
            || String(left.subtitle || '').localeCompare(String(right.subtitle || ''), 'tr'))
        .forEach(group => {
        const isExpanded = expandedStandardGroups.has(group.key);
        html += `
            <tr style="background:#f7fafc; border-bottom:1px solid #dfe7ef; cursor:pointer;" onclick="toggleStandardGroup('${escapeStandardText(group.key)}')">
                <td colspan="7" style="padding: 14px 12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
                        <div>
                            <div style="font-weight:700; color:#22313f;">${isExpanded ? '▼' : '►'} ${escapeStandardText(group.title)}</div>
                            <div style="margin-top:4px; font-size:0.85em; color:#6f8091;">${escapeStandardText(group.subtitle)} • ${group.items.length} kayıt</div>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openBulkEditStandardGroupModal('${encodeURIComponent(group.key)}')">Toplu Düzelt</button>
                            <div style="font-size:0.82em; color:#8aa0b2;">Detayları ${isExpanded ? 'gizle' : 'göster'}</div>
                        </div>
                    </div>
                </td>
            </tr>
        `;

        if (isExpanded) {
            group.items
                .sort((left, right) => {
                    if (left.birthYear !== right.birthYear) return Number(left.birthYear || 0) - Number(right.birthYear || 0);
                    if ((left.gender || '') !== (right.gender || '')) return String(left.gender || '').localeCompare(String(right.gender || ''), 'tr');
                    if ((left.style || '') !== (right.style || '')) return String(left.style || '').localeCompare(String(right.style || ''), 'tr');
                    return Number(left.distance || 0) - Number(right.distance || 0);
                })
                .forEach(standard => {
                    html += `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 12px;">
                                <div style="font-weight: 600; color: #2c3e50;">${escapeStandardText(standard.name)}</div>
                                <div style="margin-top: 4px; font-size: 0.82em; color: #7f8c8d;">${escapeStandardText([standard.gender, standard.poolType ? standard.poolType + 'm' : '', standard.category].filter(Boolean).join(' • '))}</div>
                            </td>
                            <td style="padding: 12px;">${standard.birthYear}</td>
                            <td style="padding: 12px;">${escapeStandardText(standard.gender)}</td>
                            <td style="padding: 12px;">${escapeStandardText(standard.style)}</td>
                            <td style="padding: 12px;">${escapeStandardText(standard.distance)}m</td>
                            <td style="padding: 12px; text-align: center; font-weight: 600; color: #2980b9;">${escapeStandardText(standard.time)}</td>
                            <td style="padding: 12px; text-align: center;">
                                <button class="btn btn-info btn-sm" onclick="event.stopPropagation(); openEditStandardModal('${standard.id}')">Düzenle</button>
                                <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteStandard('${standard.id}')">Sil</button>
                            </td>
                        </tr>
                    `;
                });
        }
    });

    tbody.innerHTML = html;
}

function toggleStandardGroup(groupKey) {
    if (expandedStandardGroups.has(groupKey)) {
        expandedStandardGroups.delete(groupKey);
    } else {
        expandedStandardGroups.add(groupKey);
    }
    filterStandardsSuperAdmin();
}

// Baraj ekleme modal'ını aç
function openAddStandardModal() {
    document.getElementById('addStandardModal').style.display = 'block';
    document.getElementById('addStandardForm').reset();
}

// Baraj ekleme modal'ını kapat
function closeAddStandardModal() {
    document.getElementById('addStandardModal').style.display = 'none';
}

// Baraj düzenleme modal'ını aç
function openEditStandardModal(standardId) {
    const standard = allStandardsSuperAdmin.find(s => s.id === standardId);
    if (!standard) {
        alert('Baraj bulunamadı.');
        return;
    }

    document.getElementById('editStandardId').value = standard.id;
    document.getElementById('editStandardName').value = standard.name;
    document.getElementById('editStandardBirthYear').value = standard.birthYear;
    document.getElementById('editStandardGender').value = standard.gender;
    document.getElementById('editStandardStyle').value = standard.style;
    document.getElementById('editStandardDistance').value = standard.distance;
    document.getElementById('editStandardTime').value = standard.time;

    document.getElementById('editStandardModal').style.display = 'block';
}

// Baraj düzenleme modal'ını kapat
function closeEditStandardModal() {
    document.getElementById('editStandardModal').style.display = 'none';
}

function parseBulkBirthYearCorrections(value) {
    const mappings = new Map();
    String(value || '')
        .split(/\r?\n|,|;/)
        .map(line => line.trim())
        .filter(Boolean)
        .forEach(line => {
            const match = line.match(/^(\d{4})\s*(?:=|:|->)\s*(\d{4})$/);
            if (!match) {
                throw new Error(`Geçersiz doğum yılı eşleme satırı: ${line}`);
            }
            mappings.set(Number(match[1]), Number(match[2]));
        });
    return mappings;
}

function openBulkEditStandardGroupModal(encodedGroupKey) {
    const groupKey = decodeURIComponent(String(encodedGroupKey || ''));
    const group = standardGroupsIndex.get(groupKey);
    if (!group || !group.items?.length) {
        alert('Toplu düzenlenecek grup bulunamadı.');
        return;
    }

    const firstItem = group.items[0] || {};
    document.getElementById('bulkEditStandardGroupKey').value = groupKey;
    document.getElementById('bulkEditStandardName').value = firstItem.name || '';
    document.getElementById('bulkEditBirthYearMap').value = '';
    document.getElementById('bulkEditStandardSummary').textContent = `${group.items.length} kayıt seçildi: ${group.title}`;
    document.getElementById('bulkEditStandardGroupModal').style.display = 'block';
}

function closeBulkEditStandardGroupModal() {
    document.getElementById('bulkEditStandardGroupModal').style.display = 'none';
}

async function updateStandardGroupBulk(e) {
    e.preventDefault();

    const groupKey = document.getElementById('bulkEditStandardGroupKey').value;
    const group = standardGroupsIndex.get(groupKey);
    if (!group || !group.items?.length) {
        alert('Toplu düzenlenecek kayıt bulunamadı.');
        return;
    }

    const newName = document.getElementById('bulkEditStandardName').value.trim();
    const yearMapRaw = document.getElementById('bulkEditBirthYearMap').value;

    let yearCorrections;
    try {
        yearCorrections = parseBulkBirthYearCorrections(yearMapRaw);
    } catch (error) {
        alert(error.message);
        return;
    }

    if (!newName && yearCorrections.size === 0) {
        alert('En az bir güncelleme girin: baraj adı veya doğum yılı eşleme.');
        return;
    }

    const docsToUpdate = [];
    group.items.forEach(item => {
        const updateData = {
            updatedAt: new Date().toISOString(),
            updatedBy: currentSuperAdmin.id,
            updatedByRole: 'superadmin'
        };
        let hasChange = false;

        if (newName && newName !== String(item.name || '')) {
            updateData.name = newName;
            hasChange = true;
        }

        const currentBirthYear = Number(item.birthYear || 0);
        if (yearCorrections.has(currentBirthYear)) {
            const mappedYear = Number(yearCorrections.get(currentBirthYear));
            if (Number.isFinite(mappedYear) && mappedYear !== currentBirthYear) {
                updateData.birthYear = mappedYear;
                hasChange = true;
            }
        }

        if (hasChange) {
            docsToUpdate.push({ id: item.id, data: updateData });
        }
    });

    if (!docsToUpdate.length) {
        alert('Seçilen grupta güncellenecek kayıt bulunamadı.');
        return;
    }

    if (!confirm(`${docsToUpdate.length} baraj kaydı toplu güncellenecek. Devam edilsin mi?`)) {
        return;
    }

    try {
        const chunkSize = 400;
        for (let index = 0; index < docsToUpdate.length; index += chunkSize) {
            const chunk = docsToUpdate.slice(index, index + chunkSize);
            const batch = db.batch();
            chunk.forEach(entry => {
                batch.update(db.collection('standards').doc(entry.id), entry.data);
            });
            await batch.commit();
        }

        alert(`${docsToUpdate.length} kayıt güncellendi.`);
        closeBulkEditStandardGroupModal();
        await loadStandardsSuperAdmin();
        filterStandardsSuperAdmin();
    } catch (error) {
        console.error('Toplu baraj güncelleme hatası:', error);
        alert('Toplu güncelleme sırasında hata: ' + error.message);
    }
}

// Baraj ekle
async function addStandard(e) {
    e.preventDefault();

    const standardData = {
        name: document.getElementById('standardName').value.trim(),
        birthYear: Number(document.getElementById('standardBirthYear').value),
        gender: document.getElementById('standardGender').value,
        style: document.getElementById('standardStyle').value,
        distance: Number(document.getElementById('standardDistance').value),
        time: normalizeStandardTime(document.getElementById('standardTime').value),
        scopeType: 'global',
        adminId: null,
        sourceType: 'manual',
        createdAt: new Date().toISOString(),
        createdBy: currentSuperAdmin.id,
        createdByRole: 'superadmin'
    };

    try {
        await db.collection('standards').add(standardData);
        alert('Baraj başarıyla kaydedildi!');
        closeAddStandardModal();
        loadStandardsSuperAdmin();
    } catch (error) {
        console.error('Baraj kaydedilirken hata:', error);
        alert('Baraj kaydedilirken hata: ' + error.message);
    }
}

// Barajı güncelle
async function updateStandard(e) {
    e.preventDefault();

    const standardId = document.getElementById('editStandardId').value;
    const standardData = {
        name: document.getElementById('editStandardName').value.trim(),
        birthYear: Number(document.getElementById('editStandardBirthYear').value),
        gender: document.getElementById('editStandardGender').value,
        style: document.getElementById('editStandardStyle').value,
        distance: Number(document.getElementById('editStandardDistance').value),
        time: normalizeStandardTime(document.getElementById('editStandardTime').value),
        updatedAt: new Date().toISOString(),
        updatedBy: currentSuperAdmin.id,
        updatedByRole: 'superadmin'
    };

    try {
        await db.collection('standards').doc(standardId).update(standardData);
        alert('Baraj başarıyla güncellendi!');
        closeEditStandardModal();
        loadStandardsSuperAdmin();
    } catch (error) {
        console.error('Baraj güncellenirken hata:', error);
        alert('Baraj güncellenirken hata: ' + error.message);
    }
}

// Barajı sil
async function deleteStandard(standardId) {
    if (!confirm('Bu barajı silmek istediğinize emin misiniz?')) {
        return;
    }

    try {
        await db.collection('standards').doc(standardId).delete();
        alert('Baraj başarıyla silindi!');
        loadStandardsSuperAdmin();
    } catch (error) {
        console.error('Baraj silinirken hata:', error);
        alert('Baraj silinirken hata: ' + error.message);
    }
}

// Barajları filtrele
function filterStandardsSuperAdmin() {
    const nameFilter = document.getElementById('standardNameFilter').value.toLowerCase();
    const genderFilter = document.getElementById('standardGenderFilter').value;
    const styleFilter = document.getElementById('standardStyleFilter').value;
    const distanceFilter = document.getElementById('standardDistanceFilter').value;
    const birthYearFilter = document.getElementById('standardBirthYearFilter').value;

    const filtered = allStandardsSuperAdmin.filter(std => {
        const matchName = (std.name || '').toLowerCase().includes(nameFilter);
        const matchGender = !genderFilter || std.gender === genderFilter;
        const matchStyle = !styleFilter || std.style === styleFilter;
        const matchDistance = !distanceFilter || std.distance.toString() === distanceFilter;
        const matchBirthYear = !birthYearFilter || std.birthYear.toString() === birthYearFilter;

        return matchName && matchGender && matchStyle && matchDistance && matchBirthYear;
    });

    displayStandardsSuperAdmin(filtered);
}

function escapeStandardText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeStandardTime(value) {
    return String(value || '').trim().replace(/,/g, '.');
}

function normalizePdfParsingText(value) {
    let normalized = String(value || '').toUpperCase();
    const replacements = [
        ['M�SABAKA', 'MUSABAKA'],
        ['T�RK�YE', 'TURKIYE'],
        ['VED�A', 'VEDIA'],
        ['N�L', 'NIL'],
        ['YA�', 'YAS'],
        ['GEL���M', 'GELISIM'],
        ['F�NAL�', 'FINALI'],
        ['SIRT�ST�', 'SIRTUSTU'],
        ['KURBA�ALAMA', 'KURBAGALAMA'],
        ['KARI�IK', 'KARISIK'],
        ['KELEBEKÇE', 'KELEBEKCE'],
        ['M³SABAKA', 'MUSABAKA'],
        ['M▄SABAKA', 'MUSABAKA'],
        ['T▄RK¦YE', 'TURKIYE'],
        ['YAÌ', 'YAS'],
        ['YAŞ', 'YAS'],
        ['S²RT³ST³', 'SIRTUSTU'],
        ['KAR²■²K', 'KARISIK'],
        ['KURBAºALAMA', 'KURBAGALAMA'],
        ['İ', 'I'],
        ['İ', 'I'],
        ['Ş', 'S'],
        ['Ğ', 'G'],
        ['Ü', 'U'],
        ['Ö', 'O'],
        ['Ç', 'C'],
        ['²', 'I'],
        ['³', 'U'],
        ['■', 'S'],
        ['º', 'G'],
        [';', ',']
    ];

    replacements.forEach(([from, to]) => {
        normalized = normalized.split(from).join(to);
    });

    return normalized.replace(/\s+/g, ' ').trim();
}

function makePdfTitleReadable(value) {
    let readable = String(value || 'Baraj İçe Aktarımı').trim();
    const replacements = [
        ['T�RK�YE', 'Türkiye'],
        ['VED�A', 'Vedia'],
        ['N�L', 'Nil'],
        ['YA�', 'Yaş'],
        ['GEL���M', 'Gelişim'],
        ['F�NAL�', 'Finali'],
        ['ARENA', 'Arena']
    ];

    replacements.forEach(([from, to]) => {
        readable = readable.split(from).join(to);
    });

    return readable.replace(/\s+/g, ' ').trim();
}

function normalizeCompetitionCoreTitle(value) {
    const normalized = normalizePdfParsingText(value)
        .replace(/\b\d{1,2}\s*[-–]\s*\d{1,2}\s+[A-Z]+\s+20\d{2}\b/g, ' ')
        .replace(/\b\d{1,2}\s+[A-Z]+\s+20\d{2}\b/g, ' ')
        .replace(/\b20\d{2}\b/g, ' ')
        .replace(/\bTURKIYE\s+YUZME\s+FEDERASYONU\b/g, ' ')
        .replace(/\bVEDIA\s+NIL\s+APAK\s+ANISINA\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const priorityTokens = [
        'KISA KULVAR',
        'UZUN KULVAR',
        'YILDIZ',
        'GENC',
        'ACIK YAS',
        'ULUSAL GELISIM LIGI',
        'MILLI TAKIM SECMESI',
        'YUZME SAMPIYONASI',
        'TURKIYE FINALI'
    ];

    const startIndexes = priorityTokens
        .map(token => normalized.indexOf(token))
        .filter(index => index >= 0)
        .sort((a, b) => a - b);

    const selected = startIndexes.length ? normalized.slice(startIndexes[0]) : normalized;
    return makePdfTitleReadable(selected || value || 'Baraj İçe Aktarımı');
}

function normalizePdfStyle(styleToken) {
    const normalized = normalizePdfParsingText(styleToken);
    const compact = normalized.replace(/[^A-Z0-9]/g, '');
    if (compact.includes('SERBEST') || compact.includes('FREE')) return 'Serbest';
    if (/S.RT.?ST/.test(compact) || (compact.includes('SIRT') && compact.includes('UST'))) return 'Sırtüstü';
    if (/KURBA.?ALAMA/.test(compact) || compact.includes('KURBAG')) return 'Kurbağalama';
    if (/KELEBEK/.test(compact)) return 'Kelebekçe';
    if (/KAR.*IK|KAR.*SIK|KARMA|MEDLEY/.test(compact) || compact.includes('KARISIK')) return 'Karma';
    return null;
}

function buildPdfDocumentTitleFromFileName(fileName) {
    return String(fileName || '')
        .replace(/\.pdf$/i, '')
        .replace(/^\d+\s*[-_ ]+/, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractPdfDocumentTitle(lines, fileName) {
    const fileTitle = normalizeCompetitionCoreTitle(buildPdfDocumentTitleFromFileName(fileName));
    const normalizedFileTitle = normalizePdfParsingText(fileTitle);
    if (normalizedFileTitle && normalizedFileTitle.length >= 18 && !normalizedFileTitle.includes('BARAJ')) {
        return fileTitle;
    }

    const candidate = lines.slice(0, 24).find(line => {
        const normalized = normalizePdfParsingText(line);
        if (!normalized || normalized.length < 12) return false;
        if (normalized.includes('BARAJ') || normalized.includes('KURAL') || normalized.includes('BILGI')) return false;
        const hasCoreWord = normalized.includes('TURKIYE') || normalized.includes('ARENA') || normalized.includes('GELISIM') || normalized.includes('FINAL');
        const hasContextWord = normalized.includes('YAS') || normalized.includes('LIG') || normalized.includes('SAMPIYONA');
        return hasCoreWord && hasContextWord;
    });

    if (candidate) {
        return normalizeCompetitionCoreTitle(candidate);
    }

    return fileTitle || fileName.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ');
}

function extractPdfCompetitionYear(lines, fileName) {
    const lineYears = [];
    lines.slice(0, 40).forEach(source => {
        const matches = String(source || '').match(/\b(20\d{2})\b/g) || [];
        matches.forEach(item => {
            const parsed = Number(item);
            if (Number.isFinite(parsed)) {
                lineYears.push(parsed);
            }
        });
    });

    if (lineYears.length) {
        return Math.max(...lineYears);
    }

    const fileMatch = String(fileName || '').match(/\b(20\d{2})\b/);
    if (fileMatch) {
        return Number(fileMatch[1]);
    }

    return new Date().getFullYear();
}

function parseSectionDemographics(headerLines, competitionYear) {
    const normalizedText = normalizePdfParsingText(headerLines.join(' '));
    const tokens = normalizedText.split(/\s+/).filter(Boolean);
    const demographics = [];

    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index];
        if (!['ERKEK', 'ERKEKLER', 'KADIN', 'KADINLAR', 'KIZ', 'KIZLAR'].includes(token)) {
            continue;
        }

        const gender = token.startsWith('ERKEK') ? 'Erkek' : 'Kız';
        let age = null;
        let birthYear = null;
        const ages = [];

        for (let offset = index + 1; offset < Math.min(index + 6, tokens.length); offset += 1) {
            const lookahead = tokens[offset];

            if (['ERKEK', 'ERKEKLER', 'KADIN', 'KADINLAR', 'KIZ', 'KIZLAR'].includes(lookahead)) {
                break;
            }

            if (/^\d{1,2}$/.test(lookahead) && age === null) {
                age = Number(lookahead);
                ages.push(Number(lookahead));
                continue;
            }

            if (/^(\d{1,2})-(\d{1,2})$/.test(lookahead)) {
                const [, startAge, endAge] = lookahead.match(/^(\d{1,2})-(\d{1,2})$/);
                ages.push(Number(startAge), Number(endAge));
                if (age === null) {
                    age = Number(endAge);
                }
                continue;
            }

            if (/^\d{4}$/.test(lookahead) && birthYear === null) {
                birthYear = Number(lookahead);
            }
        }

        if (age !== null && birthYear === null && competitionYear) {
            birthYear = competitionYear - age;
        }

        if (age !== null && birthYear !== null) {
            const alreadyAdded = demographics.some(item => item.gender === gender && item.age === age && item.birthYear === birthYear);
            if (!alreadyAdded) {
                demographics.push({ gender, age, birthYear });
            }
        }

        if (ages.length > 1 && competitionYear) {
            [...new Set(ages)].forEach(candidateAge => {
                const candidateBirthYear = competitionYear - candidateAge;
                const alreadyAdded = demographics.some(item => item.gender === gender && item.age === candidateAge && item.birthYear === candidateBirthYear);
                if (!alreadyAdded) {
                    demographics.push({ gender, age: candidateAge, birthYear: candidateBirthYear });
                }
            });
        }
    }

    if (demographics.length === 0) {
        const years = [...new Set(tokens.filter(token => /^\d{4}$/.test(token)).map(Number))].sort();
        const ages = [...new Set(tokens.filter(token => /^\d{1,2}$/.test(token)).map(Number))].sort((a, b) => a - b);

        if (years.length >= 2 && ages.length >= 2) {
            return [
                { gender: 'Erkek', age: ages[1], birthYear: years[0] },
                { gender: 'Erkek', age: ages[0], birthYear: years[1] },
                { gender: 'Kız', age: ages[0], birthYear: years[1] },
                { gender: 'Kız', age: ages[1], birthYear: years[0] }
            ];
        }

        if (competitionYear && ages.length >= 2) {
            return ages.flatMap(age => ([
                { gender: 'Erkek', age, birthYear: competitionYear - age },
                { gender: 'Kız', age, birthYear: competitionYear - age }
            ]));
        }
    }

    return demographics;
}

function mapStandardRowTimesToDemographics(times, demographics) {
    if (times.length === demographics.length) {
        return demographics.map((demographic, index) => ({
            demographic,
            time: times[index]
        }));
    }

    if (times.length === 2 && demographics.length === 4) {
        const targetDemographics = demographics.filter(item => item.age === 12);
        if (targetDemographics.length === 2) {
            return targetDemographics.map((demographic, index) => ({
                demographic,
                time: times[index]
            }));
        }
    }

    return [];
}

function extractStandardTimes(normalizedLine) {
    return (normalizedLine.match(/\d{1,2}:\d{2}[\.,;:]\d{2}|\d{1,2}:\d{2}|\d{1,2}[\.,;]\d{2}/g) || [])
        .map(value => {
            const sanitized = value.replace(/;/g, ',');
            if (/^\d{1,2}[\.,]\d{2}$/.test(sanitized)) {
                const normalized = sanitized.replace(',', '.');
                const [seconds, decimals] = normalized.split('.');
                return `00:${String(seconds).padStart(2, '0')},${decimals}`;
            }
            if (/^\d{1,2}:\d{2}$/.test(sanitized)) {
                const [minutes, seconds] = sanitized.split(':');
                return `${String(minutes).padStart(2, '0')}:${seconds},00`;
            }
            return sanitized.replace('.', ',');
        })
        .slice(0, 16);
}

function parseStandardRowLine(line) {
    const normalized = normalizePdfParsingText(line);
    const times = extractStandardTimes(normalized);
    if (times.length < 2) {
        return null;
    }

    const distanceMatch = normalized.match(/(?:^|\s)(\d{2,4})\s*M(?:\s|$)|(?:^|\s)(\d{2,4})M(?:\s|$)/);
    if (!distanceMatch) {
        return null;
    }

    const styleCandidates = ['SERBEST', 'SIRTUSTU', 'KURBAGALAMA', 'KELEBEKCE', 'KELEBEK', 'KARISIK'];
    const styleToken = styleCandidates.find(candidate => normalized.includes(candidate));
    const style = styleToken ? normalizePdfStyle(styleToken) : null;
    if (!style) {
        return null;
    }

    return {
        times,
        distance: Number(distanceMatch[1] || distanceMatch[2]),
        style
    };
}

function tokenizePdfHeaderDescriptorText(value) {
    return normalizePdfParsingText(value)
        .replace(/(\d{1,2}\+?)YAS\b/g, '$1 YAS')
        .replace(/(\d{1,2}(?:-\d{1,2})+)YAS\b/g, '$1 YAS')
        .split(/\s+/)
        .filter(Boolean);
}

function isAgeToken(token, nextToken = '') {
    if (!token) return false;
    if (/^\d{1,2}\+$/.test(token)) return true;
    if (/^\d{1,2}(?:-\d{1,2})+$/.test(token)) return true;
    if (/^\d{1,2}$/.test(token) && nextToken === 'YAS') return true;
    return false;
}

function deriveBirthYearsFromAgeToken(ageToken, competitionYear) {
    if (!competitionYear || !ageToken) return [];

    if (/^\d{1,2}\+$/.test(ageToken)) {
        return [competitionYear - Number(ageToken.replace('+', ''))];
    }

    if (/^\d{1,2}(?:-\d{1,2})+$/.test(ageToken)) {
        return ageToken
            .split('-')
            .map(Number)
            .filter(Number.isFinite)
            .map(age => competitionYear - age);
    }

    if (/^\d{1,2}$/.test(ageToken)) {
        return [competitionYear - Number(ageToken)];
    }

    return [];
}

function parseAgeColumnDescriptors(tokens, competitionYear) {
    const columns = [];
    const expandedTokens = tokenizePdfHeaderDescriptorText(tokens.join(' '));

    for (let index = 0; index < expandedTokens.length; index += 1) {
        const token = expandedTokens[index];
        const nextToken = expandedTokens[index + 1] || '';
        if (!isAgeToken(token, nextToken)) {
            continue;
        }

        const ageToken = token;
        let scanIndex = index + (nextToken === 'YAS' ? 2 : 1);
        const yearTokens = [];

        while (scanIndex < expandedTokens.length) {
            const scanToken = expandedTokens[scanIndex];
            const lookahead = expandedTokens[scanIndex + 1] || '';

            if (isAgeToken(scanToken, lookahead)) {
                break;
            }

            if (/^\d{4}\+?$/.test(scanToken)) {
                yearTokens.push(scanToken);
            }

            scanIndex += 1;
        }

        const birthYears = yearTokens.length
            ? yearTokens.map(item => Number(String(item).replace('+', ''))).filter(Number.isFinite)
            : deriveBirthYearsFromAgeToken(ageToken, competitionYear);

        if (birthYears.length) {
            columns.push({ ageToken, birthYears });
        }

        index = scanIndex - 1;
    }

    return columns;
}

function buildSymmetricAdvancedColumns(headerLines, competitionYear) {
    const normalizedLines = headerLines
        .map(line => normalizePdfParsingText(line))
        .filter(Boolean);
    const ageLine = normalizedLines.find(line => /\b(25|50)M\b/.test(line) && line.includes('YAS'));

    if (!ageLine) {
        return null;
    }

    const expandedAgeLine = tokenizePdfHeaderDescriptorText(ageLine).join(' ');
    const splitMatch = expandedAgeLine.match(/^(.*?)(25M|50M)(.*)$/);
    if (!splitMatch) {
        return null;
    }

    const supplementalYearRows = normalizedLines
        .map(line => line.match(/^\s*(\d{4}\+?)\s+(\d{4}\+?)\s*$/))
        .filter(Boolean)
        .map(match => ({
            left: Number(String(match[1]).replace('+', '')),
            right: Number(String(match[2]).replace('+', ''))
        }))
        .filter(item => Number.isFinite(item.left) && Number.isFinite(item.right));

    const supplementalLeftYears = supplementalYearRows.map(item => item.left);
    const supplementalRightYears = supplementalYearRows.map(item => item.right);

    const buildSideColumns = (sideText, supplementalYears = []) => {
        const sideTokens = tokenizePdfHeaderDescriptorText(sideText);
        const descriptors = [];

        for (let index = 0; index < sideTokens.length; index += 1) {
            const token = sideTokens[index];
            const nextToken = sideTokens[index + 1] || '';

            if (isAgeToken(token, nextToken)) {
                descriptors.push({ type: 'age', value: token });
                if (nextToken === 'YAS') {
                    index += 1;
                }
                continue;
            }

            if (/^\d{4}\+?$/.test(token)) {
                descriptors.push({ type: 'year', value: token });
            }
        }

        const columns = descriptors.map(descriptor => {
            if (descriptor.type === 'age') {
                return {
                    ageToken: descriptor.value,
                    birthYears: deriveBirthYearsFromAgeToken(descriptor.value, competitionYear)
                };
            }

            const birthYears = /^\d{4}\+?$/.test(descriptor.value)
                ? [Number(String(descriptor.value).replace('+', ''))]
                : [];

            return {
                ageToken: descriptor.value,
                birthYears: birthYears.filter(Number.isFinite)
            };
        }).filter(column => column.birthYears.length);

        if (supplementalYears.length) {
            const targetIndex = columns.findIndex(column =>
                /^\d{4}$/.test(String(column.ageToken || '')) && column.birthYears.length === 1
            );

            if (targetIndex >= 0) {
                const merged = [...new Set([
                    ...columns[targetIndex].birthYears,
                    ...supplementalYears.filter(Number.isFinite)
                ])].sort((a, b) => a - b);
                columns[targetIndex].birthYears = merged;
            }
        }

        return columns;
    };

    const maleColumns = buildSideColumns(splitMatch[1], supplementalLeftYears);
    const femaleColumns = buildSideColumns(splitMatch[3], supplementalRightYears);

    if (!maleColumns.length || !femaleColumns.length) {
        return null;
    }

    return { maleColumns, femaleColumns };
}

function extractAdvancedSectionColumns(headerLines, competitionYear) {
    const normalizedHeader = normalizePdfParsingText(headerLines.join(' '));
    if (!normalizedHeader) {
        return null;
    }

    const splitMatch = normalizedHeader.match(/\bKADINLAR\b|\bKADIN\b/);
    if (!splitMatch) {
        return null;
    }

    const splitIndex = splitMatch.index;
    const maleTokens = normalizedHeader.slice(0, splitIndex).split(/\s+/).filter(Boolean);
    const femaleTokens = normalizedHeader.slice(splitIndex).split(/\s+/).filter(Boolean);

    const maleColumns = parseAgeColumnDescriptors(maleTokens, competitionYear);
    const femaleColumns = parseAgeColumnDescriptors(femaleTokens, competitionYear);

    if (!maleColumns.length || !femaleColumns.length) {
        return buildSymmetricAdvancedColumns(headerLines, competitionYear);
    }

    return { maleColumns, femaleColumns };
}

function mapCombinedTimesToAdvancedColumns(times, advancedColumns) {
    if (!advancedColumns?.maleColumns?.length || !advancedColumns?.femaleColumns?.length) {
        return { malePairs: [], femalePairs: [] };
    }

    const maleCount = advancedColumns.maleColumns.length;
    const femaleCount = advancedColumns.femaleColumns.length;
    if (times.length < maleCount + femaleCount) {
        return { malePairs: [], femalePairs: [] };
    }

    const maleTimes = times.slice(0, maleCount);
    const femaleTimes = times.slice(times.length - femaleCount);

    return {
        malePairs: mapTimesToColumnBirthYears(maleTimes, advancedColumns.maleColumns, 'Erkek'),
        femalePairs: mapTimesToColumnBirthYears(femaleTimes, advancedColumns.femaleColumns, 'Kız')
    };
}

function mapTimesToColumnBirthYears(times, columns, gender) {
    const pairs = [];
    const length = Math.min(times.length, columns.length);

    for (let index = 0; index < length; index += 1) {
        const time = times[index];
        columns[index].birthYears.forEach(birthYear => {
            const ageToken = String(columns[index].ageToken || '').trim();
            pairs.push({
                demographic: {
                    gender,
                    birthYear,
                    ageGroupToken: ageToken,
                    isOpenAgeGroup: ageToken.endsWith('+')
                },
                time
            });
        });
    }

    return pairs;
}

function extractDistanceFromLine(line) {
    const normalized = normalizePdfParsingText(line);
    const distanceMatch = normalized.match(/(?:^|\s)(\d{2,4})\s*M(?:\s|$)|(?:^|\s)(\d{2,4})M(?:\s|$)/);
    if (!distanceMatch) {
        return null;
    }
    return Number(distanceMatch[1] || distanceMatch[2]);
}

function appendStandardPreview(preview, section, documentTitle, fileName, demographicTimePairs, style, distance) {
    demographicTimePairs.forEach(({ demographic, time }) => {
        preview.push({
            name: documentTitle,
            groupLabel: section.label,
            poolType: section.poolType,
            category: section.category,
            birthYear: demographic.birthYear,
            gender: demographic.gender,
            ageGroupToken: demographic.ageGroupToken || '',
            isOpenAgeGroup: Boolean(demographic.isOpenAgeGroup),
            style,
            distance,
            time: normalizeStandardTime(time),
            scopeType: 'global',
            sourceType: 'pdf',
            sourceDocument: fileName
        });
    });
}

function detectSectionFromLine(normalizedLine, pendingSectionCategory = '') {
    const normalizedCompact = normalizePdfParsingText(normalizedLine).replace(/[^A-Z0-9]/g, '');
    const categoryMatch = normalizedLine.match(/\b(KATILIM|HARCIRAH)\s+BARAJ(?:LARI|LAR|I)?\b/)
        || (normalizedCompact.includes('KATILIMBARAJ') ? ['KATILIM BARAJ', 'KATILIM'] : null)
        || (normalizedCompact.includes('HARCIRAHBARAJ') ? ['HARCIRAH BARAJ', 'HARCIRAH'] : null);
    if (!categoryMatch) {
        return null;
    }

    const poolMatch = normalizedLine.match(/\b(25|50)\s*M\b|\b(25|50)M\b/)
        || normalizedCompact.match(/(25|50)M/);
    if (!poolMatch) {
        return null;
    }

    const categoryRaw = categoryMatch[1] || pendingSectionCategory || 'KATILIM';
    const category = categoryRaw === 'HARCIRAH' ? 'Harcırah' : 'Katılım';
    const poolType = Number(poolMatch[1] || poolMatch[2]);

    if (!Number.isFinite(poolType)) {
        return null;
    }

    return {
        poolType,
        category,
        label: `${poolType}m ${category}`
    };
}

function detectSectionFromWindow(lines, lineIndex, pendingSectionCategory = '') {
    const windowLines = [
        lines[lineIndex - 1] || '',
        lines[lineIndex] || '',
        lines[lineIndex + 1] || '',
        lines[lineIndex + 2] || ''
    ]
        .map(value => normalizePdfParsingText(String(value || '').replace(/\s+/g, ' ').trim()))
        .filter(Boolean);

    if (!windowLines.length) {
        return null;
    }

    const combined = windowLines.join(' ');
    return detectSectionFromLine(combined, pendingSectionCategory);
}

function parseStandardsFromPdfLines(lines, fileName) {
    const preview = [];
    const errors = [];
    const diagnostics = {
        lineCount: lines.length,
        sectionHits: 0,
        parsedRowHits: 0,
        advancedRowHits: 0,
        pendingRowsSeen: 0
    };
    const documentTitle = extractPdfDocumentTitle(lines, fileName);
    const competitionYear = extractPdfCompetitionYear(lines, fileName);
    let currentSection = null;
    let headerBuffer = [];
    let pendingSectionCategory = '';
    let advancedColumns = null;
    let pendingStyle = null;
    let pendingDistance = null;
    let pendingTimes = [];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const rawLine = lines[lineIndex];
        const line = rawLine.replace(/\s+/g, ' ').trim();
        if (!line) continue;

        const normalized = normalizePdfParsingText(line);

        const sectionOnlyMatch = normalized.match(/^MUSABAKA\s+(KATILIM|HARCIRAH)\s+BARAJ(?:LARI|LAR|I)?$/);
        if (sectionOnlyMatch) {
            pendingSectionCategory = sectionOnlyMatch[1] === 'HARCIRAH' ? 'Harcırah' : 'Katılım';
            continue;
        }

        const normalizedPendingCategory = pendingSectionCategory === 'Harcırah' ? 'HARCIRAH' : 'KATILIM';
        const detectedSection = detectSectionFromLine(normalized, normalizedPendingCategory)
            || detectSectionFromWindow(lines, lineIndex, normalizedPendingCategory);
        if (detectedSection) {
            diagnostics.sectionHits += 1;
            currentSection = {
                poolType: detectedSection.poolType,
                category: detectedSection.category,
                label: detectedSection.label,
                demographics: []
            };
            headerBuffer = [];
            advancedColumns = null;
            pendingStyle = null;
            pendingSectionCategory = currentSection.category;
            continue;
        }

        const sectionMatch = normalized.match(/^(25|50)\s*M(?:\s*\([^)]*\))?\s+(KATILIM|HARCIRAH)\s+BARAJ(?:LARI|LAR|I)?(?:\s+.*)?$/);
        if (sectionMatch) {
            diagnostics.sectionHits += 1;
            currentSection = {
                poolType: Number(sectionMatch[1]),
                category: sectionMatch[2] === 'HARCIRAH' ? 'Harcırah' : 'Katılım',
                label: `${sectionMatch[1]}m ${sectionMatch[2] === 'HARCIRAH' ? 'Harcırah' : 'Katılım'}`,
                demographics: []
            };
            headerBuffer = [];
            advancedColumns = null;
            pendingSectionCategory = currentSection.category;
            continue;
        }

        const poolOnlyMatch = normalized.match(/^(25|50)\s*M(?:\s*\([^)]*\))?\s+(KATILIM|HARCIRAH)?\s*BARAJ(?:LARI|LAR|I)?(?:\s+.*)?$/);
        if (poolOnlyMatch && !currentSection && pendingSectionCategory) {
            diagnostics.sectionHits += 1;
            const category = poolOnlyMatch[2]
                ? (poolOnlyMatch[2] === 'HARCIRAH' ? 'Harcırah' : 'Katılım')
                : pendingSectionCategory;

            currentSection = {
                poolType: Number(poolOnlyMatch[1]),
                category,
                label: `${poolOnlyMatch[1]}m ${category}`,
                demographics: []
            };
            headerBuffer = [];
            advancedColumns = null;
            continue;
        }

        const embeddedPoolMatch = normalized.match(/\b(25|50)M\b/);
        if (!currentSection && pendingSectionCategory && embeddedPoolMatch && normalized.includes('YAS')) {
            diagnostics.sectionHits += 1;
            currentSection = {
                poolType: Number(embeddedPoolMatch[1]),
                category: pendingSectionCategory,
                label: `${embeddedPoolMatch[1]}m ${pendingSectionCategory}`,
                demographics: []
            };
            headerBuffer = [line];
            advancedColumns = null;
            pendingStyle = null;
            pendingDistance = null;
            pendingTimes = [];
            continue;
        }

        if (!currentSection) {
            continue;
        }

        const style = normalizePdfStyle(normalized);
        const lineTimes = extractStandardTimes(normalized);
        const distanceOnLine = extractDistanceFromLine(line);
        const previousLine = lineIndex > 0 ? String(lines[lineIndex - 1] || '').replace(/\s+/g, ' ').trim() : '';
        const twoLinesBack = lineIndex > 1 ? String(lines[lineIndex - 2] || '').replace(/\s+/g, ' ').trim() : '';

        if (!style && !lineTimes.length && distanceOnLine && /^\d{2,4}\s*M?$/i.test(line)) {
            pendingDistance = distanceOnLine;
            continue;
        }

        if (!style && lineTimes.length >= 2 && pendingDistance) {
            diagnostics.pendingRowsSeen += 1;
            pendingTimes = lineTimes;
            continue;
        }

        if (style && lineTimes.length < 2 && pendingDistance && pendingTimes.length >= 2) {
            if (!advancedColumns) {
                advancedColumns = extractAdvancedSectionColumns(headerBuffer, competitionYear);
            }

            const { malePairs, femalePairs } = mapCombinedTimesToAdvancedColumns(pendingTimes, advancedColumns);
            if (malePairs.length || femalePairs.length) {
                diagnostics.advancedRowHits += 1;
                if (malePairs.length) {
                    appendStandardPreview(preview, currentSection, documentTitle, fileName, malePairs, style, pendingDistance);
                }
                if (femalePairs.length) {
                    appendStandardPreview(preview, currentSection, documentTitle, fileName, femalePairs, style, pendingDistance);
                }
                pendingDistance = null;
                pendingTimes = [];
                pendingStyle = null;
                continue;
            }
        }

        if (style && lineTimes.length < 2) {
            pendingStyle = style;
            headerBuffer.push(line);
            continue;
        }

        const effectiveStyle = style || pendingStyle;
        if (effectiveStyle && lineTimes.length >= 2 && pendingStyle) {
            pendingStyle = null;
        }

        // Advanced layout: [female times line] + [distance line] + [style + male times line]
        if (effectiveStyle && lineTimes.length >= 2) {
            const distanceFromPrev = extractDistanceFromLine(previousLine);
            if (distanceFromPrev) {
                if (!advancedColumns) {
                    advancedColumns = extractAdvancedSectionColumns(headerBuffer, competitionYear);
                }

                if (advancedColumns?.maleColumns?.length && advancedColumns?.femaleColumns?.length) {
                    const femaleTimes = extractStandardTimes(normalizePdfParsingText(twoLinesBack));
                    const malePairs = mapTimesToColumnBirthYears(lineTimes, advancedColumns.maleColumns, 'Erkek');
                    const femalePairs = mapTimesToColumnBirthYears(femaleTimes, advancedColumns.femaleColumns, 'Kız');

                    if (malePairs.length || femalePairs.length) {
                        appendStandardPreview(preview, currentSection, documentTitle, fileName, malePairs, effectiveStyle, distanceFromPrev);
                        appendStandardPreview(preview, currentSection, documentTitle, fileName, femalePairs, effectiveStyle, distanceFromPrev);
                        continue;
                    }
                }
            }
        }

        const parsedRow = parseStandardRowLine(line);
        if (!parsedRow) {
            headerBuffer.push(line);
            if (currentSection.demographics.length === 0) {
                currentSection.demographics = parseSectionDemographics(headerBuffer, competitionYear);
            }
            continue;
        }

        diagnostics.parsedRowHits += 1;

        if (currentSection.demographics.length === 0) {
            currentSection.demographics = parseSectionDemographics(headerBuffer, competitionYear);
        }

        const demographicTimePairs = mapStandardRowTimesToDemographics(parsedRow.times, currentSection.demographics);

        if (!currentSection.demographics.length || demographicTimePairs.length === 0) {
            errors.push({ reason: 'Satırdaki süre sayısı kolon yapısıyla eşleşmiyor', rawLine: line });
            continue;
        }

        appendStandardPreview(preview, currentSection, documentTitle, fileName, demographicTimePairs, parsedRow.style, parsedRow.distance);
        pendingDistance = null;
        pendingTimes = [];
    }

    return { preview, errors, diagnostics };
}

function updateStandardImportStatus(message, color = '#7f8c8d') {
    const status = document.getElementById('standardImportStatus');
    if (status) {
        status.textContent = message;
        status.style.color = color;
    }
}

function renderStandardsImportPreview() {
    const summary = document.getElementById('standardImportSummary');
    const previewContainer = document.getElementById('standardImportPreviewContainer');
    const previewBody = document.getElementById('standardImportPreviewBody');
    const errorsContainer = document.getElementById('standardImportErrorsContainer');
    const errorsBox = document.getElementById('standardImportErrors');
    const importButton = document.getElementById('importParsedStandardsBtn');

    if (!summary || !previewContainer || !previewBody || !errorsContainer || !errorsBox || !importButton) {
        return;
    }

    summary.style.display = 'block';
    summary.innerHTML = `
        <div style="display: flex; gap: 15px; flex-wrap: wrap;">
            <div style="padding: 12px 14px; background: #eefaf0; border: 1px solid #cdeccd; border-radius: 8px; color: #1e8449; font-weight: 600;">Hazır Kayıt: ${parsedStandardsPreview.length}</div>
            <div style="padding: 12px 14px; background: #fff7e6; border: 1px solid #f6d8a8; border-radius: 8px; color: #b9770e; font-weight: 600;">İnceleme Gereken Satır: ${parsedStandardsErrors.length}</div>
        </div>
    `;

    previewContainer.style.display = parsedStandardsPreview.length ? 'block' : 'none';
    previewBody.innerHTML = parsedStandardsPreview.map(item => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px;">${escapeStandardText(item.name)}</td>
            <td style="padding: 10px;">${escapeStandardText(item.groupLabel)}</td>
            <td style="padding: 10px;">${escapeStandardText(item.birthYear)}</td>
            <td style="padding: 10px;">${escapeStandardText(item.gender)}</td>
            <td style="padding: 10px;">${escapeStandardText(item.style)}</td>
            <td style="padding: 10px;">${escapeStandardText(item.distance)}m</td>
            <td style="padding: 10px; text-align: center; font-weight: 600; color: #2980b9;">${escapeStandardText(item.time)}</td>
        </tr>
    `).join('');

    errorsContainer.style.display = parsedStandardsErrors.length ? 'block' : 'none';
    errorsBox.innerHTML = parsedStandardsErrors.map(error => `
        <div style="padding: 10px 0; border-bottom: 1px solid #f1c4c4;">
            <div style="font-weight: 600; color: #c0392b; margin-bottom: 4px;">${escapeStandardText(error.reason)}</div>
            <div style="font-family: monospace; font-size: 0.9em; color: #6c757d; word-break: break-word;">${escapeStandardText(error.rawLine)}</div>
        </div>
    `).join('');

    importButton.disabled = parsedStandardsPreview.length === 0;
}

function resetStandardsImportModal() {
    parsedStandardsPreview = [];
    parsedStandardsErrors = [];

    const fileInput = document.getElementById('standardsPdfFile');
    if (fileInput) fileInput.value = '';

    const summary = document.getElementById('standardImportSummary');
    const previewContainer = document.getElementById('standardImportPreviewContainer');
    const errorsContainer = document.getElementById('standardImportErrorsContainer');
    const previewBody = document.getElementById('standardImportPreviewBody');
    const errorsBox = document.getElementById('standardImportErrors');
    const importButton = document.getElementById('importParsedStandardsBtn');

    if (summary) summary.style.display = 'none';
    if (previewContainer) previewContainer.style.display = 'none';
    if (errorsContainer) errorsContainer.style.display = 'none';
    if (previewBody) previewBody.innerHTML = '';
    if (errorsBox) errorsBox.innerHTML = '';
    if (importButton) importButton.disabled = true;

    updateStandardImportStatus('Henüz dosya seçilmedi.');
}

function openBulkStandardImportModal() {
    document.getElementById('bulkStandardImportModal').style.display = 'block';
    resetStandardsImportModal();
}

function closeBulkStandardImportModal() {
    document.getElementById('bulkStandardImportModal').style.display = 'none';
}

async function parseStandardsPdf() {
    const fileInput = document.getElementById('standardsPdfFile');
    const files = Array.from(fileInput?.files || []).filter(file => /\.pdf$/i.test(file.name));

    if (!files.length) {
        updateStandardImportStatus('Lütfen en az bir PDF dosyası seçin.', '#c0392b');
        return;
    }

    updateStandardImportStatus(`${files.length} PDF okunuyor, lütfen bekleyin...`, '#2980b9');

    try {
        const mergedPreview = [];
        const mergedErrors = [];

        for (let index = 0; index < files.length; index += 1) {
            const file = files[index];
            updateStandardImportStatus(`PDF işleniyor (${index + 1}/${files.length}): ${file.name}`, '#2980b9');

            const lines = await extractPdfLines(file);
            let result = parseStandardsFromPdfLines(lines, file.name);

            if (result.preview.length === 0 || result.errors.length > Math.max(8, result.preview.length * 2)) {
                updateStandardImportStatus(`OCR denemesi (${index + 1}/${files.length}): ${file.name}`, '#b9770e');
                const pages = await extractRacePdfPages(file, {
                    enableOcr: true,
                    onProgress: (pageNumber, totalPages, message) => {
                        updateStandardImportStatus(message || `OCR uygulanıyor (${pageNumber}/${totalPages}) - ${file.name}`, '#b9770e');
                    }
                });
                const ocrLines = pages.flatMap(page => page.lines || []);
                const ocrResult = parseStandardsFromPdfLines(ocrLines, file.name);
                if (ocrResult.preview.length > result.preview.length) {
                    result = ocrResult;
                }
            }

            mergedPreview.push(...result.preview);
            mergedErrors.push(...result.errors.map(error => ({
                ...error,
                reason: `[${file.name}] ${error.reason}`
            })));

            if (result.preview.length === 0 && result.errors.length === 0) {
                const diagnostics = result.diagnostics || {};
                mergedErrors.push({
                    reason: `[${file.name}] PDF okundu ancak kayıt üretilemedi (section: ${diagnostics.sectionHits || 0}, satır: ${diagnostics.parsedRowHits || 0}, gelişmiş satır: ${diagnostics.advancedRowHits || 0}, bekleyen: ${diagnostics.pendingRowsSeen || 0}, toplam satır: ${diagnostics.lineCount || 0})`,
                    rawLine: 'Başlık/kolon yapısı bu PDF için farklı olabilir; parse kuralları genişletilmelidir.'
                });
            }
        }

        parsedStandardsPreview = mergedPreview;
        parsedStandardsErrors = mergedErrors;

        renderStandardsImportPreview();
        updateStandardImportStatus(`${files.length} PDF okundu. ${parsedStandardsPreview.length} kayıt ön izlemeye hazır.`, '#27ae60');
    } catch (error) {
        console.error('PDF ayrıştırılırken hata:', error);
        parsedStandardsPreview = [];
        parsedStandardsErrors = [];
        renderStandardsImportPreview();
        updateStandardImportStatus('PDF okunamadı: ' + error.message, '#c0392b');
    }
}

function buildStandardIdentityKey(standard) {
    return [
        (standard.name || '').trim().toLowerCase(),
        standard.groupLabel || '',
        standard.birthYear || '',
        (standard.gender || '').trim().toLowerCase(),
        (standard.style || '').trim().toLowerCase(),
        standard.distance || '',
        normalizeStandardTime(standard.time),
        standard.scopeType || 'global',
        standard.adminId || ''
    ].join('::');
}

async function importParsedStandards() {
    if (!parsedStandardsPreview.length) {
        alert('Kaydedilecek ön izleme kaydı yok.');
        return;
    }

    updateStandardImportStatus('Kayıtlar veritabanına yazılıyor...', '#2980b9');

    try {
        const existingSnap = await db.collection('standards').get();
        const existingKeys = new Set(existingSnap.docs.map(doc => buildStandardIdentityKey(doc.data())));
        const importBatchId = `pdf-${Date.now()}`;

        let batch = db.batch();
        let operationCount = 0;
        let importedCount = 0;
        let skippedCount = 0;

        for (const preview of parsedStandardsPreview) {
            const standardData = {
                ...preview,
                createdAt: new Date().toISOString(),
                createdBy: currentSuperAdmin.id,
                createdByRole: 'superadmin',
                scopeType: 'global',
                adminId: null,
                importBatchId
            };

            const identityKey = buildStandardIdentityKey(standardData);
            if (existingKeys.has(identityKey)) {
                skippedCount += 1;
                continue;
            }

            existingKeys.add(identityKey);
            const docRef = db.collection('standards').doc();
            batch.set(docRef, standardData);
            importedCount += 1;
            operationCount += 1;

            if (operationCount === 450) {
                await batch.commit();
                batch = db.batch();
                operationCount = 0;
            }
        }

        if (operationCount > 0) {
            await batch.commit();
        }

        await loadStandardsSuperAdmin();
        updateStandardImportStatus(`İçe aktarma tamamlandı. ${importedCount} kayıt eklendi, ${skippedCount} kayıt atlandı.`, '#27ae60');
        alert(`PDF içe aktarma tamamlandı.\nEklenen kayıt: ${importedCount}\nAtlanan kayıt: ${skippedCount}`);
    } catch (error) {
        console.error('Baraj içe aktarma hatası:', error);
        updateStandardImportStatus('İçe aktarma başarısız: ' + error.message, '#c0392b');
        alert('Baraj içe aktarma sırasında hata oluştu: ' + error.message);
    }
}

function updateRaceResultsStatus(message, color = '#5f6c7b') {
    const status = document.getElementById('raceResultsStatus');
    if (!status) return;
    status.textContent = message;
    status.style.color = color;
}

function updateRaceResultsSummaryBadge(message, tone) {
    const badge = document.getElementById('raceResultsSummaryBadge');
    if (!badge) return;
    const themes = {
        idle: { background: '#eef6ff', color: '#2c5d8a' },
        success: { background: '#eaf8ef', color: '#237746' },
        warning: { background: '#fff4e5', color: '#b86a18' },
        error: { background: '#fdeeee', color: '#c0392b' }
    };
    const palette = themes[tone] || themes.idle;
    badge.textContent = message;
    badge.style.background = palette.background;
    badge.style.color = palette.color;
}

function setRaceResultsProgress(visible, percent = 0, text = '') {
    const wrapper = document.getElementById('raceResultsProgress');
    const bar = document.getElementById('raceResultsProgressBar');
    const label = document.getElementById('raceResultsProgressText');
    if (!wrapper || !bar || !label) return;
    wrapper.style.display = visible ? 'block' : 'none';
    bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    label.textContent = text || 'Hazırlanıyor...';
}

function resetRaceResultsState() {
    parsedRaceResults = [];
    latestRaceImportSummary = null;
    raceResultsFilterState = { pdfClub: '', systemClub: '', mismatchReason: '' };
    const saveButton = document.getElementById('saveRaceResultsBtn');
    if (saveButton) saveButton.disabled = true;

    const matchedContainer = document.getElementById('matchedRaceResults');
    const unmatchedContainer = document.getElementById('unmatchedRaceResults');
    const matchedCount = document.getElementById('matchedResultsCount');
    const unmatchedCount = document.getElementById('unmatchedResultsCount');
    const meta = document.getElementById('raceResultsMeta');
    const filterSummary = document.getElementById('raceResultsFilterSummary');
    const pdfClubFilter = document.getElementById('raceResultsPdfClubFilter');
    const systemClubFilter = document.getElementById('raceResultsSystemClubFilter');
    const reasonFilter = document.getElementById('raceResultsReasonFilter');

    if (matchedContainer) {
        matchedContainer.innerHTML = '<div style="padding:18px; border:1px dashed #d9e3ec; border-radius:10px; color:#8a97a6; text-align:center;">Henüz eşleşen kayıt yok.</div>';
    }
    if (unmatchedContainer) {
        unmatchedContainer.innerHTML = '<div style="padding:18px; border:1px dashed #d9e3ec; border-radius:10px; color:#8a97a6; text-align:center;">Henüz eşleşmeyen kayıt yok.</div>';
    }
    if (matchedCount) matchedCount.textContent = '0 kayıt';
    if (unmatchedCount) unmatchedCount.textContent = '0 kayıt';
    if (meta) {
        meta.textContent = 'PDF analizi sonrasında eşleşen ve eşleşmeyen kayıt özetini burada göreceksiniz.';
    }
    if (filterSummary) {
        filterSummary.textContent = 'Henüz filtre uygulanmadı.';
    }
    if (pdfClubFilter) {
        pdfClubFilter.innerHTML = '<option value="">-- Tüm PDF Kulüpleri --</option>';
        pdfClubFilter.value = '';
    }
    if (systemClubFilter) {
        systemClubFilter.innerHTML = '<option value="">-- Tüm Sistem Kulüpleri --</option>';
        systemClubFilter.value = '';
    }
    if (reasonFilter) {
        reasonFilter.innerHTML = '<option value="">-- Tüm Nedenler --</option>';
        reasonFilter.value = '';
    }
    updateRaceResultsStatus('Sonuç dosyası bekleniyor.');
    updateRaceResultsSummaryBadge('Henüz analiz yapılmadı', 'idle');
    setRaceResultsProgress(false);
}

function resetRaceResultsFilters() {
    raceResultsFilterState = { pdfClub: '', systemClub: '', mismatchReason: '' };
    const pdfClubFilter = document.getElementById('raceResultsPdfClubFilter');
    const systemClubFilter = document.getElementById('raceResultsSystemClubFilter');
    const reasonFilter = document.getElementById('raceResultsReasonFilter');
    if (pdfClubFilter) pdfClubFilter.value = '';
    if (systemClubFilter) systemClubFilter.value = '';
    if (reasonFilter) reasonFilter.value = '';
    renderRaceResults();
}

function normalizeClubLookupText(value) {
    return normalizePdfParsingText(value)
        .replace(/[^A-Z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function prettifyPdfClubName(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
        .map(token => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
        .join(' ');
}

function looksLikePdfClubName(rawLine) {
    const normalized = normalizeClubLookupText(rawLine);
    if (!normalized || /\d/.test(normalized)) return false;
    if (!/(KULUB|SPOR|GENCLIK|BELEDIYE|YILDIZ|AKADEMI|ENKA|FENERBAHCE|GALATASARAY|GOZTEPE|TED|TOHUM|YUZME)/.test(normalized)) {
        return false;
    }
    if (/(SERBEST|KARISIK|KURBAGA|KELEBEK|SIRT|MUSABAKA|FINALI|KULVAR|SIRA|RANK|PUAN)/.test(normalized)) {
        return false;
    }
    return normalized.split(' ').length >= 2;
}

function extractPdfClubName(rawLine) {
    const normalized = normalizeClubLookupText(rawLine);
    if (!looksLikePdfClubName(normalized)) return '';

    const cleaned = normalized
        .replace(/\b(TURKIYE|FINALI|MUSABAKA|YILDIZLAR|GENCLER|ACIKYAS|KUCUKLER|BUYUKLER|FERDI|TAKIM|TOPLAM|PUAN)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return prettifyPdfClubName(cleaned);
}

function normalizePersonLookup(value) {
    return normalizeClubLookupText(value)
        .replace(/\b(DNS|DSQ|DNF|NT|TOPLAM|YUZME|KULUBU|KULUBU DERNEGI|SPOR KULUBU|SPORCULARI|KULVAR|SIRA|RANK|PUAN)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function toTitleCase(value) {
    return String(value || '')
        .toLowerCase()
        .split(' ')
        .filter(Boolean)
        .map(token => token.charAt(0).toUpperCase() + token.slice(1))
        .join(' ');
}

function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildPdfPageLines(textContent) {
    const rows = [];

    textContent.items.forEach(item => {
        const y = Number(item.transform?.[5] || 0);
        const x = Number(item.transform?.[4] || 0);
        const text = String(item.str || '').trim();

        if (!text) return;

        let row = rows.find(entry => Math.abs(entry.y - y) <= 2.5);
        if (!row) {
            row = { y, items: [] };
            rows.push(row);
        }

        row.items.push({ x, text });
    });

    return rows
        .sort((left, right) => right.y - left.y)
        .map(row => row.items
            .sort((left, right) => left.x - right.x)
            .map(item => item.text)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim())
        .filter(Boolean);
}

async function extractPdfLines(file) {
    if (!window.pdfjsLib) {
        throw new Error('PDF okuyucu yüklenemedi. Sayfayı yenileyip tekrar deneyin.');
    }

    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

    const pdfData = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: pdfData }).promise;
    const lines = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        lines.push(...buildPdfPageLines(textContent));
    }

    return lines;
}

async function extractPdfPageLinesWithOcr(page, pageNumber, totalPages, progressCallback) {
    if (!window.Tesseract) {
        return [];
    }

    progressCallback?.(pageNumber, totalPages, `OCR uygulanıyor (${pageNumber}/${totalPages})`);
    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: context, viewport }).promise;

    const result = await window.Tesseract.recognize(canvas, 'tur+eng');
    return String(result?.data?.text || '')
        .split(/\r?\n/)
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
}

async function extractRacePdfPages(file, options = {}) {
    if (!window.pdfjsLib) {
        throw new Error('PDF okuyucu yüklenemedi. Sayfayı yenileyip tekrar deneyin.');
    }

    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    const pdfData = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: pdfData }).promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        options.onProgress?.(pageNumber, pdf.numPages, `PDF okunuyor (${pageNumber}/${pdf.numPages})`);
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        let lines = buildPdfPageLines(textContent);
        let source = 'text';

        if ((!lines.length || lines.join(' ').length < 24) && options.enableOcr) {
            const ocrLines = await extractPdfPageLinesWithOcr(page, pageNumber, pdf.numPages, options.onProgress);
            if (ocrLines.length) {
                lines = ocrLines;
                source = 'ocr';
            }
        }

        pages.push({ pageNumber, source, lines });
    }

    return pages;
}

function normalizeRaceResultStyle(styleToken) {
    const normalized = normalizePdfParsingText(styleToken);
    if (normalized.includes('SERBEST') || normalized.includes('FREE')) return 'Serbest';
    if (normalized.includes('SIRT')) return 'Sırt';
    if (normalized.includes('KURBAG')) return 'Kurbağa';
    if (normalized.includes('KELEBEK')) return 'Kelebek';
    if (normalized.includes('KARISIK') || normalized.includes('KARMA') || normalized.includes('MEDLEY')) return 'Karışık';
    return null;
}

function normalizeRaceResultTime(value) {
    let time = String(value || '').trim().replace(/,/g, '.');
    if (!time) return null;
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(time)) {
        const parts = time.split(':');
        time = `${Number(parts[0])}:${parts[1]}.${parts[2]}`;
    } else if (/^\d{1,2}\.\d{2}\.\d{2}$/.test(time)) {
        const parts = time.split('.');
        time = `${Number(parts[0])}:${parts[1]}.${parts[2]}`;
    } else if (/^\d{1,2}\.\d{2}$/.test(time)) {
        const seconds = time.split('.')[0].padStart(2, '0');
        time = `0:${seconds}.${time.split('.')[1]}`;
    }

    if (/^\d{1,2}:\d{2}\.\d{2}$/.test(time)) {
        return `${Number(time.split(':')[0])}:${time.split(':')[1]}`;
    }

    return null;
}

function extractRaceTime(rawLine) {
    const candidates = String(rawLine || '').match(/\b(?:\d{1,2}:\d{2}[\.,:]\d{2}|\d{1,2}[\.,]\d{2}|\d{1,2}[\.]\d{2}[\.]\d{2}|\d{1,2}:\d{2}:\d{2})\b/g) || [];
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
        const normalized = normalizeRaceResultTime(candidates[index]);
        if (normalized) {
            return { raw: candidates[index], normalized };
        }
    }
    return null;
}

function extractRaceEventInfo(rawLine) {
    const normalized = normalizePdfParsingText(rawLine);
    const match = normalized.match(/(\d{2,4})\s*M\s+(SERBEST|SIRTUSTU|SIRT|KURBAGALAMA|KURBAGA|KELEBEKCE|KELEBEK|KARISIK|KARMA|MEDLEY)/);
    if (!match) return null;
    const style = normalizeRaceResultStyle(match[2]);
    if (!style) return null;
    const distance = Number(match[1]);
    return {
        distance,
        style,
        eventName: `${distance}m ${style}`
    };
}

function looksLikePossibleAthleteName(rawLine) {
    const normalized = normalizePersonLookup(rawLine);
    if (!normalized || /\d/.test(normalized)) return false;
    if (normalized.split(' ').length < 2) return false;
    if (/(KULUBU|MUSABAKA|FINALI|SERBEST|KARISIK|KURBAGA|KELEBEK|SIRT|RANK|SIRA|PUAN)/.test(normalized)) return false;
    return true;
}

function cleanupAthleteName(rawLine, entryContext) {
    let normalized = normalizePersonLookup(rawLine);
    if (entryContext?.clubName) {
        normalized = normalized.replace(new RegExp(`\\b${escapeRegExp(normalizeClubLookupText(entryContext.clubName))}\\b`, 'g'), ' ');
    }
    if (entryContext?.timeRaw) {
        normalized = normalized.replace(new RegExp(escapeRegExp(normalizeClubLookupText(entryContext.timeRaw)), 'g'), ' ');
    }
    if (entryContext?.eventName) {
        normalized = normalized.replace(new RegExp(`\\b${escapeRegExp(normalizeClubLookupText(entryContext.eventName).replace(/\s+/g, ' '))}\\b`, 'g'), ' ');
    }
    normalized = normalized
        .replace(/\b(19|20)\d{2}\b/g, ' ')
        .replace(/\b\d{1,3}\b/g, ' ')
        .replace(/\b(ERKEK|KIZ|KADIN|GENEL|SERI|FINALI|MUSABAKA|TOPLAM|PUAN|KULVAR|SIRA|RANK|DNS|DSQ|DNF|NT)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!normalized) return '';
    const tokens = normalized.split(' ').filter(token => token.length > 1);
    if (tokens.length < 2) return '';
    return toTitleCase(tokens.join(' '));
}

async function loadRaceResultReferenceData() {
    if (raceResultReferenceData) {
        return raceResultReferenceData;
    }

    const [clubSnap, studentsSnap] = await Promise.all([
        db.collection('clubProfiles').get(),
        db.collection('students').get()
    ]);

    const clubs = clubSnap.docs
        .map(doc => ({
            adminId: doc.id,
            clubName: String(doc.data()?.clubName || '').trim(),
            normalizedClubName: normalizeClubLookupText(doc.data()?.clubName || '')
        }))
        .filter(club => club.clubName && club.normalizedClubName)
        .sort((left, right) => right.normalizedClubName.length - left.normalizedClubName.length);

    const students = studentsSnap.docs.map(doc => {
        const data = doc.data() || {};
        const fullName = [data.name, data.surname].filter(Boolean).join(' ').trim() || data.name || '';
        return {
            id: doc.id,
            adminId: data.adminId || '',
            trainerId: data.trainerId || '',
            name: data.name || '',
            surname: data.surname || '',
            fullName,
            normalizedFullName: normalizePersonLookup(fullName),
            normalizedCompactName: normalizePersonLookup(fullName).replace(/\s+/g, ''),
            data
        };
    });

    raceResultReferenceData = { clubs, students };
    return raceResultReferenceData;
}

function findClubMatch(rawClubName, rawLine, referenceData) {
    const requested = normalizeClubLookupText(rawClubName || '');
    const lineText = normalizeClubLookupText(rawLine || '');

    if (requested) {
        const exact = referenceData.clubs.find(club => club.normalizedClubName === requested);
        if (exact) return exact;

        const partialMatches = referenceData.clubs.filter(club => club.normalizedClubName.includes(requested) || requested.includes(club.normalizedClubName));
        if (partialMatches.length === 1) return partialMatches[0];
    }

    return referenceData.clubs.find(club => lineText.includes(club.normalizedClubName)) || null;
}

function scoreStudentName(candidateName, student) {
    const normalizedCandidate = normalizePersonLookup(candidateName);
    if (!normalizedCandidate || !student?.normalizedFullName) return 0;
    if (normalizedCandidate === student.normalizedFullName) return 1;
    if (normalizedCandidate.replace(/\s+/g, '') === student.normalizedCompactName) return 0.98;

    const candidateTokens = normalizedCandidate.split(' ').filter(Boolean);
    const studentTokens = student.normalizedFullName.split(' ').filter(Boolean);
    const intersection = candidateTokens.filter(token => studentTokens.includes(token));
    if (!intersection.length) return 0;
    const overlap = intersection.length / Math.max(candidateTokens.length, studentTokens.length);
    const bonus = intersection.length >= 2 ? 0.15 : 0;
    return overlap + bonus;
}

function findBestStudentMatch(athleteName, adminId, referenceData) {
    const pool = referenceData.students.filter(student => !adminId || student.adminId === adminId);
    let best = null;
    let bestScore = 0;
    let secondScore = 0;

    pool.forEach(student => {
        const score = scoreStudentName(athleteName, student);
        if (score > bestScore) {
            secondScore = bestScore;
            bestScore = score;
            best = student;
        } else if (score > secondScore) {
            secondScore = score;
        }
    });

    if (!best || bestScore < 0.82 || bestScore - secondScore < 0.05) {
        return null;
    }

    return best;
}

function getMismatchReasonLabel(reasonCode) {
    return raceMismatchReasonLabels[reasonCode] || 'İnceleme gerekli';
}

function diagnoseRaceResultMismatch(baseData, clubMatch, studentMatch, referenceData) {
    if (clubMatch && studentMatch) {
        return {
            code: 'matched',
            label: getMismatchReasonLabel('matched'),
            detail: 'Kulüp ve sporcu başarıyla eşleşti.'
        };
    }

    const rawPdfClubName = String(baseData.rawPdfClubName || baseData.rawClubName || '').trim();
    if (!rawPdfClubName) {
        return {
            code: 'pdf_club_missing',
            label: getMismatchReasonLabel('pdf_club_missing'),
            detail: 'PDF satırında kulüp adı okunamadı veya ayrıştırılamadı.'
        };
    }

    if (!clubMatch) {
        return {
            code: 'system_club_not_found',
            label: getMismatchReasonLabel('system_club_not_found'),
            detail: `PDF kulübü "${rawPdfClubName}" sistemde kayıtlı kulüplerle eşleşmedi.`
        };
    }

    const clubStudents = (referenceData?.students || []).filter(student => student.adminId === clubMatch.adminId);
    if (!clubStudents.length) {
        return {
            code: 'club_has_no_students',
            label: getMismatchReasonLabel('club_has_no_students'),
            detail: `"${clubMatch.clubName}" kulübü bulundu fakat bu kulüpte kayıtlı sporcu görünmüyor.`
        };
    }

    let bestScore = 0;
    clubStudents.forEach(student => {
        bestScore = Math.max(bestScore, scoreStudentName(baseData.athleteName, student));
    });

    if (bestScore >= 0.45) {
        return {
            code: 'student_name_uncertain',
            label: getMismatchReasonLabel('student_name_uncertain'),
            detail: `Kulüp doğru görünüyor ancak sporcu adı düşük benzerlikle okundu. En iyi benzerlik skoru: ${bestScore.toFixed(2)}.`
        };
    }

    return {
        code: 'student_not_found',
        label: getMismatchReasonLabel('student_not_found'),
        detail: `Kulüp bulundu fakat "${baseData.athleteName}" adına yakın bir sporcu bulunamadı.`
    };
}

function normalizeRaceDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const numericMatch = raw.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (numericMatch) {
        const day = numericMatch[1].padStart(2, '0');
        const month = numericMatch[2].padStart(2, '0');
        const year = numericMatch[3];
        return `${year}-${month}-${day}`;
    }

    const monthMap = {
        OCAK: '01', SUBAT: '02', MART: '03', NISAN: '04', MAYIS: '05', HAZIRAN: '06', TEMMUZ: '07', AGUSTOS: '08', EYLUL: '09', EKIM: '10', KASIM: '11', ARALIK: '12'
    };
    const normalized = normalizePdfParsingText(raw);
    const monthMatch = normalized.match(/(\d{1,2})\s+(OCAK|SUBAT|MART|NISAN|MAYIS|HAZIRAN|TEMMUZ|AGUSTOS|EYLUL|EKIM|KASIM|ARALIK)\s+(\d{4})/);
    if (monthMatch) {
        return `${monthMatch[3]}-${monthMap[monthMatch[2]]}-${monthMatch[1].padStart(2, '0')}`;
    }

    return '';
}

function extractRaceDocumentDate(lines) {
    for (const line of lines) {
        const value = normalizeRaceDate(line);
        if (value) return value;
    }
    return new Date().toISOString().slice(0, 10);
}

function extractRaceDocumentName(lines, fileName) {
    const candidate = lines.find(line => {
        const normalized = normalizePdfParsingText(line);
        return /(MUSABAKA|SAMPIYONA|FINALI|YUZME|KUPA|LIG|SAMPIYONASI|TROFE|TURNUVA)/.test(normalized);
    });
    return candidate ? candidate.replace(/\s+/g, ' ').trim() : fileName.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ');
}

function createRaceResultEntry(baseData, referenceData) {
    const clubMatch = findClubMatch(baseData.rawClubName, `${baseData.rawLine || ''} ${baseData.rawClubName || ''}`, referenceData);
    const studentMatch = findBestStudentMatch(baseData.athleteName, clubMatch?.adminId || '', referenceData);
    const mismatch = diagnoseRaceResultMismatch(baseData, clubMatch, studentMatch, referenceData);
    return {
        ...baseData,
        rawPdfClubName: baseData.rawPdfClubName || baseData.rawClubName || '',
        clubMatch,
        studentMatch,
        mismatchReason: mismatch.code,
        mismatchReasonLabel: mismatch.label,
        mismatchDetail: mismatch.detail,
        matchedAdminId: clubMatch?.adminId || '',
        matchedStudentId: studentMatch?.id || '',
        saved: false,
        saveState: ''
    };
}

function parseRaceResultsFromPages(pages, fileName, referenceData) {
    const allLines = pages.flatMap(page => page.lines);
    const raceName = extractRaceDocumentName(allLines, fileName);
    const raceDate = extractRaceDocumentDate(allLines);
    const entries = [];
    const issues = [];
    let currentEvent = null;
    let bufferedAthleteName = '';
    let bufferedClubName = '';
    let bufferedPdfClubName = '';

    pages.forEach(page => {
        page.lines.forEach(rawLine => {
            const line = String(rawLine || '').replace(/\s+/g, ' ').trim();
            if (!line) return;

            const eventInfo = extractRaceEventInfo(line);
            const timeInfo = extractRaceTime(line);
            const lineClubMatch = findClubMatch('', line, referenceData);
            const rawPdfClubName = extractPdfClubName(line);

            if (eventInfo && !timeInfo) {
                currentEvent = eventInfo;
                return;
            }

            if (!timeInfo && rawPdfClubName) {
                bufferedPdfClubName = rawPdfClubName;
                if (!bufferedClubName) {
                    bufferedClubName = rawPdfClubName;
                }
                if (lineClubMatch && !bufferedClubName) {
                    bufferedClubName = lineClubMatch.clubName;
                }
                return;
            }

            if (!timeInfo && lineClubMatch && normalizeClubLookupText(line) === lineClubMatch.normalizedClubName) {
                bufferedClubName = lineClubMatch.clubName;
                return;
            }

            if (!timeInfo && looksLikePossibleAthleteName(line)) {
                bufferedAthleteName = cleanupAthleteName(line, {});
                return;
            }

            if (!timeInfo || !(eventInfo || currentEvent)) {
                return;
            }

            const activeEvent = eventInfo || currentEvent;
            const pdfClubName = rawPdfClubName || bufferedPdfClubName || '';
            const clubName = lineClubMatch?.clubName || bufferedClubName || pdfClubName || '';
            const athleteName = cleanupAthleteName(line, {
                clubName,
                timeRaw: timeInfo.raw,
                eventName: activeEvent.eventName
            }) || bufferedAthleteName;

            if (!athleteName) {
                issues.push({ reason: 'Sporcu adı çözümlenemedi', rawLine: line, pageNumber: page.pageNumber });
                bufferedAthleteName = '';
                bufferedClubName = '';
                return;
            }

            const entry = createRaceResultEntry({
                athleteName,
                rawClubName: clubName,
                rawPdfClubName: pdfClubName,
                style: activeEvent.style,
                distance: activeEvent.distance,
                eventName: activeEvent.eventName,
                time: timeInfo.normalized,
                raceName,
                raceDate,
                sourceDocument: fileName,
                sourcePage: page.pageNumber,
                sourceMethod: page.source,
                rawLine: line,
                autoImported: true
            }, referenceData);

            entries.push(entry);
            bufferedAthleteName = '';
            bufferedClubName = '';
            bufferedPdfClubName = '';
        });
    });

    const uniqueEntries = [];
    const seen = new Set();
    entries.forEach(entry => {
        const identity = [
            normalizePersonLookup(entry.athleteName),
            normalizeClubLookupText(entry.rawClubName || entry.clubMatch?.clubName || ''),
            entry.eventName,
            entry.time,
            entry.raceDate,
            entry.sourcePage
        ].join('::');
        if (seen.has(identity)) return;
        seen.add(identity);
        uniqueEntries.push(entry);
    });

    return { entries: uniqueEntries, issues, raceName, raceDate, pageCount: pages.length };
}

function buildRaceResultMeta(summary) {
    const matched = parsedRaceResults.filter(entry => entry.studentMatch);
    const unmatched = parsedRaceResults.filter(entry => !entry.studentMatch);
    return `Toplam kayıt: ${parsedRaceResults.length} • Eşleşen: ${matched.length} • Eşleşmeyen: ${unmatched.length} • İnceleme gereken satır: ${summary.issues.length} • Yarış: ${summary.raceName} • Tarih: ${summary.raceDate || '-'}`;
}

function populateRaceResultFilters() {
    const pdfClubFilter = document.getElementById('raceResultsPdfClubFilter');
    const systemClubFilter = document.getElementById('raceResultsSystemClubFilter');
    const reasonFilter = document.getElementById('raceResultsReasonFilter');
    if (!pdfClubFilter || !systemClubFilter || !reasonFilter) return;

    const pdfClubs = [...new Set(parsedRaceResults.map(entry => String(entry.rawPdfClubName || entry.rawClubName || '').trim()).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right, 'tr'));
    const systemClubs = [...new Map((raceResultReferenceData?.clubs || [])
        .filter(club => club.adminId && club.clubName)
        .map(club => [club.adminId, club.clubName]))
        .entries()]
        .sort((left, right) => left[1].localeCompare(right[1], 'tr'));
    const mismatchReasons = [...new Set(parsedRaceResults
        .filter(entry => !entry.studentMatch)
        .map(entry => entry.mismatchReason)
        .filter(Boolean))];

    const currentPdf = raceResultsFilterState.pdfClub || '';
    const currentSystem = raceResultsFilterState.systemClub || '';
    const currentReason = raceResultsFilterState.mismatchReason || '';

    pdfClubFilter.innerHTML = '<option value="">-- Tüm PDF Kulüpleri --</option>'
        + pdfClubs.map(club => `<option value="${escapeStandardText(club)}">${escapeStandardText(club)}</option>`).join('');
    systemClubFilter.innerHTML = '<option value="">-- Tüm Sistem Kulüpleri --</option>'
        + systemClubs.map(([adminId, clubName]) => `<option value="${escapeStandardText(adminId)}">${escapeStandardText(clubName)}</option>`).join('');
    reasonFilter.innerHTML = '<option value="">-- Tüm Nedenler --</option>'
        + mismatchReasons.map(reason => `<option value="${escapeStandardText(reason)}">${escapeStandardText(getMismatchReasonLabel(reason))}</option>`).join('');

    pdfClubFilter.value = pdfClubs.includes(currentPdf) ? currentPdf : '';
    systemClubFilter.value = systemClubs.some(([adminId]) => adminId === currentSystem) ? currentSystem : '';
    reasonFilter.value = mismatchReasons.includes(currentReason) ? currentReason : '';
    raceResultsFilterState.pdfClub = pdfClubFilter.value;
    raceResultsFilterState.systemClub = systemClubFilter.value;
    raceResultsFilterState.mismatchReason = reasonFilter.value;
}

function getVisibleRaceResults() {
    return parsedRaceResults.filter(entry => {
        if (raceResultsFilterState.pdfClub) {
            if (String(entry.rawPdfClubName || entry.rawClubName || '').trim() !== raceResultsFilterState.pdfClub) {
                return false;
            }
        }

        if (raceResultsFilterState.systemClub) {
            if ((entry.clubMatch?.adminId || '') !== raceResultsFilterState.systemClub) {
                return false;
            }
        }

        if (raceResultsFilterState.mismatchReason) {
            if ((entry.mismatchReason || '') !== raceResultsFilterState.mismatchReason) {
                return false;
            }
        }

        return true;
    });
}

function updateRaceResultsFilterSummary(visibleEntries) {
    const filterSummary = document.getElementById('raceResultsFilterSummary');
    if (!filterSummary) return;

    const pdfLabel = raceResultsFilterState.pdfClub || 'Tümü';
    let systemLabel = 'Tümü';
    if (raceResultsFilterState.systemClub) {
        const match = (raceResultReferenceData?.clubs || []).find(club => club.adminId === raceResultsFilterState.systemClub);
        systemLabel = match?.clubName || 'Seçili';
    }
    const reasonLabel = raceResultsFilterState.mismatchReason ? getMismatchReasonLabel(raceResultsFilterState.mismatchReason) : 'Tümü';

    filterSummary.textContent = `Gösterilen kayıt: ${visibleEntries.length} • PDF kulübü: ${pdfLabel} • Sistem kulübü: ${systemLabel} • Neden: ${reasonLabel}`;
}

function buildMatchedRaceResultCard(entry) {
    const studentName = entry.studentMatch?.fullName || entry.athleteName;
    const stateBadge = entry.saveState === 'saved'
        ? '<span style="padding:4px 8px; border-radius:999px; background:#eaf8ef; color:#237746; font-size:0.82em; font-weight:600;">Kaydedildi</span>'
        : entry.saveState === 'skipped'
            ? '<span style="padding:4px 8px; border-radius:999px; background:#fff4e5; color:#b86a18; font-size:0.82em; font-weight:600;">Zaten vardı</span>'
            : '<span style="padding:4px 8px; border-radius:999px; background:#eef6ff; color:#2c5d8a; font-size:0.82em; font-weight:600;">Kayda hazır</span>';

    return `
        <div style="padding:14px; border:1px solid #dce6f0; border-radius:10px; background:#fbfdff;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
                <div>
                    <div style="font-weight:700; color:#2c3e50;">${escapeStandardText(studentName)}</div>
                    <div style="font-size:0.9em; color:#6c7a89; margin-top:4px;">${escapeStandardText(entry.clubMatch?.clubName || entry.rawClubName || 'Kulüp eşleşti')}</div>
                </div>
                ${stateBadge}
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px; font-size:0.92em; color:#455565;">
                <div><strong>Branş:</strong> ${escapeStandardText(entry.eventName)}</div>
                <div><strong>Derece:</strong> ${escapeStandardText(entry.time)}</div>
                <div><strong>Yarış:</strong> ${escapeStandardText(entry.raceName || '-')}</div>
                <div><strong>Tarih:</strong> ${escapeStandardText(entry.raceDate || '-')}</div>
            </div>
        </div>
    `;
}

function buildUnmatchedRaceResultCard(entry, index) {
    const clubs = raceResultReferenceData?.clubs || [];
    const students = raceResultReferenceData?.students || [];
    const availableStudents = students.filter(student => !entry.matchedAdminId || student.adminId === entry.matchedAdminId);

    const clubOptions = ['<option value="">Kulüp seçiniz</option>']
        .concat(clubs.map(club => `<option value="${escapeStandardText(club.adminId)}" ${club.adminId === entry.matchedAdminId ? 'selected' : ''}>${escapeStandardText(club.clubName)}</option>`))
        .join('');

    const studentOptions = ['<option value="">Sporcu seçiniz</option>']
        .concat(availableStudents.map(student => `<option value="${escapeStandardText(student.id)}" ${student.id === entry.matchedStudentId ? 'selected' : ''}>${escapeStandardText(student.fullName)}</option>`))
        .join('');

    return `
        <div style="padding:14px; border:1px solid #f0d8bf; border-radius:10px; background:#fffaf4;">
            <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
                <div>
                    <div style="font-weight:700; color:#2c3e50;">${escapeStandardText(entry.athleteName)}</div>
                    <div style="font-size:0.9em; color:#8a6d3b; margin-top:4px;">PDF Kulübü: ${escapeStandardText(entry.rawPdfClubName || entry.rawClubName || 'Bulunamadı')}</div>
                    <div style="font-size:0.9em; color:#6c7a89; margin-top:4px;">Sistem Kulübü: ${escapeStandardText(entry.clubMatch?.clubName || 'Bulunamadı')}</div>
                </div>
                <span style="padding:4px 8px; border-radius:999px; background:#fff1df; color:#b86a18; font-size:0.82em; font-weight:600;">${escapeStandardText(entry.mismatchReasonLabel || 'Manuel eşleme gerekli')}</span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:10px; margin-bottom:12px; font-size:0.92em; color:#455565;">
                <div><strong>Branş:</strong> ${escapeStandardText(entry.eventName)}</div>
                <div><strong>Derece:</strong> ${escapeStandardText(entry.time)}</div>
                <div><strong>Yarış:</strong> ${escapeStandardText(entry.raceName || '-')}</div>
                <div><strong>Tarih:</strong> ${escapeStandardText(entry.raceDate || '-')}</div>
            </div>
            <div style="margin-bottom:12px; padding:10px 12px; border-radius:8px; background:#fff7ec; color:#8a5a14; font-size:0.9em; border:1px solid #f0d8bf;">
                <strong>Neden eşleşmedi?</strong> ${escapeStandardText(entry.mismatchDetail || 'Sistem bu kaydı otomatik eşleştiremedi.')}
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px; align-items:end;">
                <div>
                    <label style="display:block; font-weight:600; margin-bottom:6px;">Kulüp</label>
                    <select onchange="updateRaceResultClubSelection(${index}, this.value)" style="width:100%; padding:9px 10px; border:1px solid #d7dee8; border-radius:8px;">
                        ${clubOptions}
                    </select>
                </div>
                <div>
                    <label style="display:block; font-weight:600; margin-bottom:6px;">Sporcu</label>
                    <select onchange="updateRaceResultStudentSelection(${index}, this.value)" style="width:100%; padding:9px 10px; border:1px solid #d7dee8; border-radius:8px;">
                        ${studentOptions}
                    </select>
                </div>
                <div>
                    <button type="button" class="btn btn-success" onclick="saveSingleRaceResult(${index})" ${entry.matchedStudentId ? '' : 'disabled'}>Eşleştir ve Kaydet</button>
                </div>
            </div>
        </div>
    `;
}

function renderRaceResults() {
    const matchedContainer = document.getElementById('matchedRaceResults');
    const unmatchedContainer = document.getElementById('unmatchedRaceResults');
    const matchedCount = document.getElementById('matchedResultsCount');
    const unmatchedCount = document.getElementById('unmatchedResultsCount');
    const meta = document.getElementById('raceResultsMeta');
    const saveButton = document.getElementById('saveRaceResultsBtn');

    populateRaceResultFilters();
    const visibleEntries = getVisibleRaceResults();
    const matched = visibleEntries.filter(entry => entry.studentMatch);
    const unmatched = visibleEntries.filter(entry => !entry.studentMatch);
    updateRaceResultsFilterSummary(visibleEntries);

    if (matchedContainer) {
        matchedContainer.innerHTML = matched.length
            ? matched.map(buildMatchedRaceResultCard).join('')
            : '<div style="padding:18px; border:1px dashed #d9e3ec; border-radius:10px; color:#8a97a6; text-align:center;">Henüz eşleşen kayıt yok.</div>';
    }

    if (unmatchedContainer) {
        unmatchedContainer.innerHTML = unmatched.length
            ? unmatched.map((entry, index) => buildUnmatchedRaceResultCard(entry, parsedRaceResults.indexOf(entry))).join('')
            : '<div style="padding:18px; border:1px dashed #d9e3ec; border-radius:10px; color:#8a97a6; text-align:center;">Eşleşmeyen sporcu kalmadı.</div>';
    }

    if (matchedCount) matchedCount.textContent = `${matched.length} kayıt`;
    if (unmatchedCount) unmatchedCount.textContent = `${unmatched.length} kayıt`;
    if (meta && latestRaceImportSummary) meta.textContent = buildRaceResultMeta(latestRaceImportSummary);
    if (saveButton) saveButton.disabled = matched.filter(entry => !entry.saved && entry.saveState !== 'skipped').length === 0;

    if (!latestRaceImportSummary) {
        updateRaceResultsSummaryBadge('Henüz analiz yapılmadı', 'idle');
    } else if (unmatched.length) {
        updateRaceResultsSummaryBadge(`${matched.length} eşleşti, ${unmatched.length} manuel bekliyor`, 'warning');
    } else {
        updateRaceResultsSummaryBadge(`${matched.length} kayıt kayda hazır`, 'success');
    }
}

function updateRaceResultClubSelection(index, adminId) {
    const entry = parsedRaceResults[index];
    if (!entry || !raceResultReferenceData) return;
    const club = raceResultReferenceData.clubs.find(item => item.adminId === adminId) || null;
    entry.clubMatch = club;
    entry.matchedAdminId = club?.adminId || '';
    entry.studentMatch = findBestStudentMatch(entry.athleteName, entry.matchedAdminId, raceResultReferenceData);
    const mismatch = diagnoseRaceResultMismatch(entry, entry.clubMatch, entry.studentMatch, raceResultReferenceData);
    entry.mismatchReason = mismatch.code;
    entry.mismatchReasonLabel = mismatch.label;
    entry.mismatchDetail = mismatch.detail;
    entry.matchedStudentId = entry.studentMatch?.id || '';
    entry.saved = false;
    entry.saveState = '';
    renderRaceResults();
}

function updateRaceResultStudentSelection(index, studentId) {
    const entry = parsedRaceResults[index];
    if (!entry || !raceResultReferenceData) return;
    const student = raceResultReferenceData.students.find(item => item.id === studentId) || null;
    entry.studentMatch = student;
    entry.matchedStudentId = student?.id || '';
    entry.matchedAdminId = student?.adminId || entry.matchedAdminId || '';
    const mismatch = diagnoseRaceResultMismatch(entry, entry.clubMatch, entry.studentMatch, raceResultReferenceData);
    entry.mismatchReason = mismatch.code;
    entry.mismatchReasonLabel = mismatch.label;
    entry.mismatchDetail = mismatch.detail;
    entry.saved = false;
    entry.saveState = '';
    renderRaceResults();
}

function buildRacePerformanceIdentityKey(performance) {
    return [
        performance.studentId || '',
        normalizePersonLookup(performance.style || ''),
        performance.distance || '',
        normalizeRaceResultTime(performance.time || '') || performance.time || '',
        performance.date || '',
        normalizeClubLookupText(performance.competitionName || '')
    ].join('::');
}

function buildPerformanceFromRaceEntry(entry, importBatchId) {
    const student = entry.studentMatch;
    return {
        studentId: student.id,
        trainerId: student.trainerId || '',
        adminId: student.adminId || entry.matchedAdminId || '',
        style: entry.style,
        distance: Number(entry.distance),
        time: entry.time,
        type: 'competition',
        date: entry.raceDate || new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
        competitionName: entry.raceName || '',
        sourceDocument: entry.sourceDocument || '',
        sourcePage: entry.sourcePage || null,
        importBatchId,
        autoImported: true,
        importSource: 'pdf',
        importMethod: entry.sourceMethod || 'text',
        rawAthleteName: entry.athleteName,
        rawClubName: entry.rawClubName || '',
        autoAddedBy: currentSuperAdmin.id
    };
}

async function fetchExistingRacePerformanceKeys(entries) {
    const studentIds = [...new Set(entries.map(entry => entry.studentMatch?.id).filter(Boolean))];
    const keys = new Set();

    for (let index = 0; index < studentIds.length; index += 10) {
        const chunk = studentIds.slice(index, index + 10);
        if (!chunk.length) continue;
        const snap = await db.collection('performances').where('studentId', 'in', chunk).get();
        snap.docs.forEach(doc => keys.add(buildRacePerformanceIdentityKey(doc.data() || {})));
    }

    return keys;
}

async function persistRaceResults(entriesToSave) {
    const validEntries = entriesToSave.filter(entry => entry.studentMatch && !entry.saved);
    if (!validEntries.length) {
        return { savedCount: 0, skippedCount: 0 };
    }

    const importBatchId = `race-pdf-${Date.now()}`;
    const existingKeys = await fetchExistingRacePerformanceKeys(validEntries);
    let batch = db.batch();
    let operationCount = 0;
    let savedCount = 0;
    let skippedCount = 0;

    for (const entry of validEntries) {
        const performance = buildPerformanceFromRaceEntry(entry, importBatchId);
        const key = buildRacePerformanceIdentityKey(performance);
        if (existingKeys.has(key)) {
            entry.saved = true;
            entry.saveState = 'skipped';
            skippedCount += 1;
            continue;
        }

        existingKeys.add(key);
        batch.set(db.collection('performances').doc(), performance);
        operationCount += 1;
        savedCount += 1;
        entry.saved = true;
        entry.saveState = 'saved';

        if (operationCount === 400) {
            await batch.commit();
            batch = db.batch();
            operationCount = 0;
        }
    }

    if (operationCount > 0) {
        await batch.commit();
    }

    await db.collection('race_result_imports').add({
        fileName: latestRaceImportSummary?.fileName || '',
        raceName: latestRaceImportSummary?.raceName || '',
        raceDate: latestRaceImportSummary?.raceDate || '',
        totalParsed: parsedRaceResults.length,
        savedCount,
        skippedCount,
        unmatchedCount: parsedRaceResults.filter(entry => !entry.studentMatch).length,
        createdAt: new Date().toISOString(),
        createdBy: currentSuperAdmin.id
    });

    return { savedCount, skippedCount };
}

async function saveSingleRaceResult(index) {
    const entry = parsedRaceResults[index];
    if (!entry || !entry.studentMatch) {
        alert('Önce sporcu eşleştirmesi yapın.');
        return;
    }

    try {
        updateRaceResultsStatus('Seçilen kayıt kaydediliyor...', '#2980b9');
        const result = await persistRaceResults([entry]);
        renderRaceResults();
        updateRaceResultsStatus(`Kayıt tamamlandı. Eklenen: ${result.savedCount}, atlanan: ${result.skippedCount}.`, '#27ae60');
    } catch (error) {
        console.error('Tekil yarış sonucu kaydedilemedi:', error);
        updateRaceResultsStatus('Kayıt başarısız: ' + error.message, '#c0392b');
        alert('Yarış sonucu kaydedilemedi: ' + error.message);
    }
}

async function saveMatchedRaceResults() {
    const matchedEntries = parsedRaceResults.filter(entry => entry.studentMatch && !entry.saved);
    if (!matchedEntries.length) {
        alert('Kaydedilecek eşleşmiş kayıt bulunamadı.');
        return;
    }

    try {
        updateRaceResultsStatus('Eşleşen sonuçlar veritabanına yazılıyor...', '#2980b9');
        const result = await persistRaceResults(matchedEntries);
        renderRaceResults();
        updateRaceResultsStatus(`İçe aktarma tamamlandı. Eklenen: ${result.savedCount}, zaten var olduğu için atlanan: ${result.skippedCount}.`, '#27ae60');
        updateRaceResultsSummaryBadge(`${result.savedCount} kayıt eklendi`, 'success');
        alert(`Yarış sonuçları kaydedildi.\nEklenen kayıt: ${result.savedCount}\nAtlanan kayıt: ${result.skippedCount}`);
    } catch (error) {
        console.error('Yarış sonuçları kaydedilemedi:', error);
        updateRaceResultsStatus('Kayıt başarısız: ' + error.message, '#c0392b');
        alert('Yarış sonuçları kaydedilirken hata oluştu: ' + error.message);
    }
}

async function analyzeRaceResultsPdf() {
    const fileInput = document.getElementById('raceResultsPdfInput');
    const file = fileInput?.files?.[0];
    if (!file) {
        updateRaceResultsStatus('Lütfen önce bir PDF dosyası seçin.', '#c0392b');
        return;
    }

    try {
        resetRaceResultsState();
        updateRaceResultsStatus('Referans veriler hazırlanıyor...', '#2980b9');
        setRaceResultsProgress(true, 2, 'Referans kulüp ve sporcu listesi alınıyor...');
        const referenceData = await loadRaceResultReferenceData();
        const enableOcr = Boolean(document.getElementById('raceResultsEnableOcr')?.checked);

        const pages = await extractRacePdfPages(file, {
            enableOcr,
            onProgress: (pageNumber, totalPages, text) => {
                const percent = Math.round((pageNumber / Math.max(totalPages, 1)) * 100);
                setRaceResultsProgress(true, percent, text);
            }
        });

        latestRaceImportSummary = {
            ...parseRaceResultsFromPages(pages, file.name, referenceData),
            fileName: file.name
        };
        parsedRaceResults = latestRaceImportSummary.entries;
        renderRaceResults();
        setRaceResultsProgress(false);

        if (!parsedRaceResults.length) {
            updateRaceResultsStatus('PDF okundu fakat kayda uygun sonuç satırı bulunamadı. OCR açık ise farklı bir PDF ile tekrar deneyin.', '#c0392b');
            updateRaceResultsSummaryBadge('Kayıt bulunamadı', 'error');
            return;
        }

        updateRaceResultsStatus(`Analiz tamamlandı. ${parsedRaceResults.length} sonuç bulundu.`, '#27ae60');
    } catch (error) {
        console.error('Yarış sonucu PDF analizi başarısız:', error);
        parsedRaceResults = [];
        latestRaceImportSummary = null;
        renderRaceResults();
        setRaceResultsProgress(false);
        updateRaceResultsStatus('PDF analizi başarısız: ' + error.message, '#c0392b');
        updateRaceResultsSummaryBadge('Analiz başarısız', 'error');
    }
}

window.updateRaceResultClubSelection = updateRaceResultClubSelection;
window.updateRaceResultStudentSelection = updateRaceResultStudentSelection;
window.saveSingleRaceResult = saveSingleRaceResult;
