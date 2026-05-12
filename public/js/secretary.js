// Secretary Dashboard JavaScript

let currentSecretary = null;
let currentAdminId = null;
let allBranches = [];
let allSchedules = [];
let allStudents = [];
let allPrices = [];
let allTrainers = [];
let appliedDiscount = null; // Store applied discount info
let editingStudentId = null;
let currentPreRegistrationLink = '';
let currentPreRegistrationToken = '';
let currentPreRegistrationClubName = '';
let currentPreRegistrationShareText = '';
let allClubApplications = [];
let clubApplicationsUnsub = null;
let suppressRegistrationResetCleanup = false;

const CLUB_APPLICATIONS_COLLECTION = 'club_applications';
const CLUB_PROFILES_COLLECTION = 'clubProfiles';
const SECRETARY_SECONDARY_AUTH_APP = 'secretary-secondary-auth';

function useWindowScrollForSecretaryMobile() {
    return window.innerWidth <= 768 && document.body.classList.contains('secretary-page');
}

function getEditingStudentId() {
    const form = document.getElementById('registrationForm');
    return form?.dataset?.studentId || editingStudentId || null;
}

function getLeadApplicationId() {
    const form = document.getElementById('registrationForm');
    return form?.dataset?.leadApplicationId || null;
}

function getLeadGeneratedPassword() {
    const form = document.getElementById('registrationForm');
    return form?.dataset?.leadPassword || '';
}

function isLeadRegistrationMode() {
    return Boolean(getLeadApplicationId());
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatSecretaryDateTime(value) {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString('tr-TR');
}

function generateSecretToken(byteLength = 18) {
    const values = new Uint8Array(byteLength);
    window.crypto.getRandomValues(values);
    return Array.from(values, item => item.toString(16).padStart(2, '0')).join('');
}

function generateTemporaryParentPassword() {
    return `Veli${generateSecretToken(6).slice(0, 8)}!`;
}

function getHostedPreRegistrationOrigin() {
    const appOptions = window.firebaseApp?.options || {};
    const projectId = String(appOptions.projectId || '').trim();
    const authDomain = String(appOptions.authDomain || '').trim();
    const currentHost = String(window.location.hostname || '').toLowerCase();
    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(currentHost);

    if (!isLocalHost && window.location.origin) {
        return window.location.origin;
    }
    if (projectId) {
        return `https://${projectId}.web.app`;
    }
    if (authDomain && !/localhost|127\.0\.0\.1/i.test(authDomain)) {
        return `https://${authDomain}`;
    }
    return window.location.origin;
}

function buildPreRegistrationLink(token) {
    const url = new URL('/onkayit.html', `${getHostedPreRegistrationOrigin().replace(/\/+$/, '')}/`);
    url.searchParams.set('token', token);
    return url.toString();
}

function getInstallmentPreferenceLabel(value) {
    if (String(value || '').trim() === 'cash') {
        return 'Pesin / elden';
    }
    const installmentCount = Math.max(1, Number(value) || 1);
    return `${installmentCount} taksit`;
}

function buildPreRegistrationShareText() {
    if (!currentPreRegistrationLink) {
        return '';
    }

    const clubName = currentPreRegistrationClubName || 'Kulubumuz';
    return `${clubName} on kayit formu icin gizli baglanti:
${currentPreRegistrationLink}

Formu doldurdugunuzda basvurunuz dogrudan sekreter ekranimiza duser. Bunun icin bilgisayarimizin acik kalmasi gerekmez. Uygun ders grubu, antrenor ve odeme plani icin sizinle iletisime gececegiz.`;
}

function getScheduleDaysLabel(schedule) {
    const dayMap = {
        monday: 'Pzt',
        tuesday: 'Sal',
        wednesday: 'Çar',
        thursday: 'Per',
        friday: 'Cum',
        saturday: 'Cmt',
        sunday: 'Paz'
    };

    const days = Array.isArray(schedule?.days) ? schedule.days : [];
    return days.map(day => dayMap[day] || day).join(', ');
}

function getScheduleDisplayLabel(schedule) {
    if (!schedule) return 'Ders saati bulunamadı';
    const branch = allBranches.find(item => item.id === schedule.branchId);
    const daysLabel = getScheduleDaysLabel(schedule);
    const scheduleDisplayName = schedule.customName || branch?.name || 'Şube';
    const parts = [scheduleDisplayName, schedule.time || 'Saat yok'];
    if (daysLabel) {
        parts[1] = `${parts[1]} (${daysLabel})`;
    }
    return parts.join(' - ');
}

function getActiveLeadApplication() {
    const applicationId = getLeadApplicationId();
    return allClubApplications.find(item => item.id === applicationId) || null;
}

async function copyTextToClipboard(text) {
    if (!text) {
        throw new Error('Kopyalanacak metin bulunamadı.');
    }

    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const tempArea = document.createElement('textarea');
    tempArea.value = text;
    tempArea.setAttribute('readonly', 'readonly');
    tempArea.style.position = 'absolute';
    tempArea.style.left = '-9999px';
    document.body.appendChild(tempArea);
    tempArea.select();
    document.execCommand('copy');
    document.body.removeChild(tempArea);
}

function renderPreRegistrationAccessPanel(statusMessage = '') {
    const input = document.getElementById('preRegistrationLinkInput');
    const shareInput = document.getElementById('preRegistrationShareText');
    const status = document.getElementById('preRegistrationLinkStatus');

    if (input) {
        input.value = currentPreRegistrationLink || 'Link hazırlanıyor...';
    }
    if (shareInput) {
        shareInput.value = currentPreRegistrationShareText || 'Paylaşım mesajı hazırlanıyor...';
    }
    if (status) {
        status.textContent = statusMessage || (currentPreRegistrationLink
            ? `Link hazir. Bu baglanti ${getHostedPreRegistrationOrigin()} adresinde calisir; bilgisayarinizin acik kalmasi gerekmez.`
            : 'Gizli link hazırlanıyor...');
    }
}

async function ensurePreRegistrationLink(forceRotate = false) {
    if (!currentAdminId) {
        renderPreRegistrationAccessPanel('Ön kayıt linki için yönetici bilgisi bulunamadı.');
        return '';
    }

    const profileRef = db.collection(CLUB_PROFILES_COLLECTION).doc(currentAdminId);
    const profileDoc = await profileRef.get();
    const profileData = profileDoc.exists ? profileDoc.data() || {} : {};

    let token = String(profileData.leadFormToken || '').trim();
    if (!token || forceRotate) {
        token = generateSecretToken();
        await profileRef.set({
            leadFormToken: token,
            leadFormUpdatedAt: new Date().toISOString()
        }, { merge: true });
    }

    currentPreRegistrationToken = token;
    currentPreRegistrationClubName = String(profileData.name || 'Kulup').trim();
    currentPreRegistrationLink = buildPreRegistrationLink(token);
    currentPreRegistrationShareText = buildPreRegistrationShareText();
    renderPreRegistrationAccessPanel(forceRotate
        ? 'Yeni gizli link üretildi. Eski link artik kullanilmaz.'
        : 'Gizli on kayit linki hazir. Hazir mesaj metnini dogrudan veliye gonderebilirsiniz.');
    return currentPreRegistrationLink;
}

async function copyPreRegistrationLink() {
    try {
        if (!currentPreRegistrationLink) {
            await ensurePreRegistrationLink();
        }
        await copyTextToClipboard(currentPreRegistrationLink);
        renderPreRegistrationAccessPanel('Link panoya kopyalandı.');
    } catch (error) {
        alert('Link kopyalanamadı: ' + error.message);
    }
}

async function copyPreRegistrationShareMessage() {
    try {
        if (!currentPreRegistrationShareText) {
            await ensurePreRegistrationLink();
        }
        await copyTextToClipboard(currentPreRegistrationShareText);
        renderPreRegistrationAccessPanel('Hazir paylasim mesaji panoya kopyalandi.');
    } catch (error) {
        alert('Paylasim mesaji kopyalanamadi: ' + error.message);
    }
}

async function openPreRegistrationLink() {
    try {
        if (!currentPreRegistrationLink) {
            await ensurePreRegistrationLink();
        }
        window.open(currentPreRegistrationLink, '_blank', 'noopener');
        renderPreRegistrationAccessPanel('On kayit formu yeni sekmede acildi.');
    } catch (error) {
        alert('On kayit formu acilamadi: ' + error.message);
    }
}

async function rotatePreRegistrationLink() {
    if (!confirm('Yeni bir gizli link üretilirse eski link çalışmaz. Devam edilsin mi?')) {
        return;
    }

    try {
        await ensurePreRegistrationLink(true);
    } catch (error) {
        alert('Yeni link üretilemedi: ' + error.message);
    }
}

function populateLeadSchedulePicker(selectedScheduleId = '') {
    const picker = document.getElementById('leadSchedulePicker');
    if (!picker) return;

    const schedules = [...allSchedules].sort((left, right) => getScheduleDisplayLabel(left).localeCompare(getScheduleDisplayLabel(right), 'tr'));
    picker.innerHTML = '<option value="">-- Ders Saati Seçiniz --</option>';

    schedules.forEach(schedule => {
        const option = document.createElement('option');
        option.value = schedule.id;
        option.textContent = getScheduleDisplayLabel(schedule);
        picker.appendChild(option);
    });

    picker.value = selectedScheduleId || '';
}

function buildLeadSummaryHtml(application, generatedPassword = '', selectedSchedule = null) {
    if (!application) {
        return '';
    }

    const summaryItems = [
        {
            label: 'Veli sifresi',
            value: generatedPassword || '-'
        },
        {
            label: 'Odeme tercihi',
            value: application.paymentMethodPreference || '-'
        },
        {
            label: 'Odeme dusuncesi',
            value: getInstallmentPreferenceLabel(application.installmentPreference || application.installmentCount)
        },
        selectedSchedule ? {
            label: 'Secili ders saati',
            value: getScheduleDisplayLabel(selectedSchedule)
        } : null,
        application.note ? {
            label: 'Ek not',
            value: application.note
        } : null
    ].filter(Boolean);

    return `
        <div class="secretary-lead-summary-grid">
            ${summaryItems.map(item => `
                <div class="secretary-lead-summary-item">
                    <strong>${escapeHtml(item.label)}</strong>
                    ${escapeHtml(item.value).replace(/\n/g, '<br>')}
                </div>
            `).join('')}
        </div>
    `;
}

function refreshRegistrationFlowUi(activeApplication = null) {
    const isLeadMode = isLeadRegistrationMode();
    const isEditMode = Boolean(getEditingStudentId());
    const leadPanel = document.getElementById('leadAssignmentPanel');
    const leadSummary = document.getElementById('leadApplicationSummary');
    const passwordRow = document.getElementById('parentPasswordRow');
    const branchGroup = document.getElementById('studentBranchGroup');
    const scheduleGroup = document.getElementById('studentScheduleGroup');
    const startDateGroup = document.getElementById('studentStartDateGroup');
    const leadInfo = document.getElementById('registrationLeadInfo');
    const leadSchedulePicker = document.getElementById('leadSchedulePicker');
    const branchSelect = document.getElementById('studentBranch');
    const scheduleSelect = document.getElementById('studentSchedule');
    const startDateInput = document.getElementById('studentStartDate');
    const passwordInput = document.getElementById('parentPassword');
    const confirmInput = document.getElementById('parentPasswordConfirm');

    if (leadPanel) leadPanel.style.display = isLeadMode ? 'block' : 'none';
    if (passwordRow) passwordRow.style.display = '';
    if (branchGroup) branchGroup.style.display = isLeadMode ? 'none' : '';
    if (scheduleGroup) scheduleGroup.style.display = isLeadMode ? 'none' : '';
    if (startDateGroup) startDateGroup.style.display = isLeadMode ? 'none' : '';

    if (passwordInput) {
        passwordInput.required = !isEditMode;
        passwordInput.type = isLeadMode && !isEditMode ? 'text' : 'password';
        passwordInput.placeholder = isLeadMode && !isEditMode
            ? 'Veli giris sifresi'
            : (isEditMode ? 'Degistirmek istemiyorsaniz bos birakin' : 'Min. 6 karakter');
    }
    if (confirmInput) {
        confirmInput.required = !isEditMode;
        confirmInput.type = isLeadMode && !isEditMode ? 'text' : 'password';
        confirmInput.placeholder = isLeadMode && !isEditMode
            ? 'Veli giris sifresini tekrar gosterir'
            : (isEditMode ? 'Degistirmek istemiyorsaniz bos birakin' : 'Sifreyi tekrar girin');
    }
    if (branchSelect) branchSelect.required = !isLeadMode;
    if (scheduleSelect) scheduleSelect.required = !isLeadMode;
    if (startDateInput) startDateInput.required = !isLeadMode;
    if (leadSchedulePicker) leadSchedulePicker.required = isLeadMode;

    populateLeadSchedulePicker(scheduleSelect?.value || '');

    if (leadInfo) {
        if (isLeadMode) {
            const application = activeApplication || getActiveLeadApplication();
            const generatedPassword = getLeadGeneratedPassword();
            const schedule = scheduleSelect?.value ? allSchedules.find(item => item.id === scheduleSelect.value) : null;
            leadInfo.style.display = 'block';
            leadInfo.innerHTML = `
                <strong>Ön kayıt forma aktarıldı:</strong> ${escapeHtml(application?.studentName || '')} ${escapeHtml(application?.studentSurname || '')}<br>
                Veli sifresi otomatik geldi${generatedPassword ? ` (${escapeHtml(generatedPassword)})` : ''}. Isterseniz asagidan degistirebilirsiniz.<br>
                ${schedule ? `Secili ders saati: ${escapeHtml(getScheduleDisplayLabel(schedule))}<br>` : ''}
                Baslangic tarihi bugunun tarihi olarak kaydedilecektir.
            `;
            if (leadSummary) {
                leadSummary.style.display = 'block';
                leadSummary.innerHTML = buildLeadSummaryHtml(application, generatedPassword, schedule);
            }
        } else {
            leadInfo.style.display = 'none';
            leadInfo.textContent = '';
            if (leadSummary) {
                leadSummary.style.display = 'none';
                leadSummary.innerHTML = '';
            }
        }
    }
}

function clearLeadRegistrationContext() {
    const form = document.getElementById('registrationForm');
    if (form) {
        delete form.dataset.leadApplicationId;
        delete form.dataset.leadPassword;
    }

    const leadSchedulePicker = document.getElementById('leadSchedulePicker');
    if (leadSchedulePicker) {
        leadSchedulePicker.value = '';
    }

    const passwordInput = document.getElementById('parentPassword');
    const confirmInput = document.getElementById('parentPasswordConfirm');
    if (passwordInput) passwordInput.value = '';
    if (confirmInput) confirmInput.value = '';

    refreshRegistrationFlowUi();
}

async function handleLeadScheduleSelection() {
    const picker = document.getElementById('leadSchedulePicker');
    const selectedScheduleId = picker?.value || '';
    const branchSelect = document.getElementById('studentBranch');
    const scheduleSelect = document.getElementById('studentSchedule');
    const trainerSelect = document.getElementById('studentTrainer');

    if (!selectedScheduleId) {
        if (branchSelect) branchSelect.value = '';
        if (scheduleSelect) scheduleSelect.value = '';
        if (trainerSelect) trainerSelect.innerHTML = '<option value="">-- Antrenör Seçiniz --</option>';
        document.getElementById('monthlyPrice').value = '';
        document.getElementById('totalAmount').value = '';
        document.getElementById('installmentAmount').value = '';
        renderInstallmentPlanInputs();
        refreshRegistrationFlowUi();
        return;
    }

    const selectedSchedule = allSchedules.find(item => item.id === selectedScheduleId);
    if (!selectedSchedule) {
        alert('Seçilen ders saati bulunamadı.');
        return;
    }

    if (branchSelect) branchSelect.value = selectedSchedule.branchId || '';
    await updateSchedules();
    if (scheduleSelect) scheduleSelect.value = selectedScheduleId;
    await updatePriceAndTotal();
    updateInstallmentAmount();
    updateTrainers();

    if (trainerSelect && trainerSelect.options.length === 2) {
        trainerSelect.value = trainerSelect.options[1].value;
    }

    refreshRegistrationFlowUi();
}

function renderClubApplications() {
    const container = document.getElementById('clubApplicationsContainer');
    if (!container) return;

    const pendingApplications = [...allClubApplications]
        .filter(item => String(item.status || 'pending') === 'pending')
        .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));

    if (!pendingApplications.length) {
        container.innerHTML = '<div class="secretary-empty-state">Bekleyen ön kayıt bulunmuyor. Paylaşılan gizli linkten gelen başvurular burada görünecek.</div>';
        return;
    }

    container.innerHTML = `
        <div class="secretary-application-list">
            ${pendingApplications.map(application => {
                const noteHtml = application.note
                    ? `<div class="secretary-application-field"><strong>Not</strong>${escapeHtml(application.note).replace(/\n/g, '<br>')}</div>`
                    : '';
                const paymentMethodHtml = application.paymentMethodPreference
                    ? `<div class="secretary-application-field"><strong>Odeme tercihi</strong>${escapeHtml(application.paymentMethodPreference)}</div>`
                    : '';
                const paymentPlanHtml = (application.installmentPreference || application.installmentCount)
                    ? `<div class="secretary-application-field"><strong>Odeme dusuncesi</strong>${escapeHtml(getInstallmentPreferenceLabel(application.installmentPreference || application.installmentCount))}</div>`
                    : '';

                return `
                    <div class="secretary-application-card">
                        <div class="secretary-application-head">
                            <div>
                                <div class="secretary-application-title">${escapeHtml(application.studentName)} ${escapeHtml(application.studentSurname)}</div>
                                <div class="secretary-application-meta">${formatSecretaryDateTime(application.createdAt)} tarihinde gönderildi</div>
                            </div>
                            <div class="secretary-application-actions">
                                <button type="button" class="btn btn-success btn-sm" onclick="transferClubApplicationToForm('${application.id}')">Forma Aktar</button>
                                <button type="button" class="btn btn-danger btn-sm" onclick="rejectClubApplication('${application.id}')">Reddet</button>
                            </div>
                        </div>
                        <div class="secretary-application-grid">
                            <div class="secretary-application-field"><strong>Doğum yılı</strong>${escapeHtml(application.birthYear)}</div>
                            <div class="secretary-application-field"><strong>Cinsiyet</strong>${escapeHtml(application.gender)}</div>
                            <div class="secretary-application-field"><strong>Öğrenci telefonu</strong>${escapeHtml(application.studentPhone)}</div>
                            <div class="secretary-application-field"><strong>Veli</strong>${escapeHtml(application.parentName)}</div>
                            <div class="secretary-application-field"><strong>Veli e-mail</strong>${escapeHtml(application.parentEmail)}</div>
                            <div class="secretary-application-field"><strong>Veli telefonu</strong>${escapeHtml(application.parentPhone)}</div>
                            <div class="secretary-application-field"><strong>Adres</strong>${escapeHtml(application.address)}</div>
                            ${paymentMethodHtml}
                            ${paymentPlanHtml}
                            ${noteHtml}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function startClubApplicationsListener() {
    if (clubApplicationsUnsub) {
        clubApplicationsUnsub();
        clubApplicationsUnsub = null;
    }

    if (!currentAdminId) {
        const container = document.getElementById('clubApplicationsContainer');
        if (container) {
            container.innerHTML = '<div class="secretary-empty-state">Ön kayıtlar için yönetici bağlantısı bulunamadı.</div>';
        }
        return;
    }

    clubApplicationsUnsub = db.collection(CLUB_APPLICATIONS_COLLECTION)
        .where('adminId', '==', currentAdminId)
        .onSnapshot((snapshot) => {
            allClubApplications = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
            renderClubApplications();
        }, (error) => {
            console.error('Ön kayıtlar dinlenemedi:', error);
            const container = document.getElementById('clubApplicationsContainer');
            if (container) {
                container.innerHTML = '<div class="secretary-empty-state">Ön kayıtlar yüklenirken hata oluştu.</div>';
            }
        });
}

async function transferClubApplicationToForm(applicationId) {
    const application = allClubApplications.find(item => item.id === applicationId);
    if (!application) {
        alert('Ön kayıt bulunamadı.');
        return;
    }

    cancelEditStudent();
    appliedDiscount = null;
    suppressRegistrationResetCleanup = true;
    document.getElementById('registrationForm').reset();
    document.getElementById('discountInfo').style.display = 'none';

    document.getElementById('studentName').value = application.studentName || '';
    document.getElementById('studentSurname').value = application.studentSurname || '';
    document.getElementById('studentBirthYear').value = application.birthYear || '';
    document.getElementById('studentGender').value = application.gender || '';
    document.getElementById('studentPhone').value = application.studentPhone || '';
    document.getElementById('parentName').value = application.parentName || '';
    document.getElementById('parentEmail').value = application.parentEmail || '';
    document.getElementById('parentPhone').value = application.parentPhone || '';
    document.getElementById('studentAddress').value = application.address || '';
    document.getElementById('studentStartDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('installmentCount').value = Math.max(1, Number(application.installmentCount) || 1);

    const generatedPassword = application.requestedParentPassword || generateTemporaryParentPassword();
    const form = document.getElementById('registrationForm');
    form.dataset.leadApplicationId = application.id;
    form.dataset.leadPassword = generatedPassword;
    document.getElementById('parentPassword').value = generatedPassword;
    document.getElementById('parentPasswordConfirm').value = generatedPassword;

    document.getElementById('studentBranch').value = '';
    await updateSchedules();
    document.getElementById('studentSchedule').value = '';
    document.getElementById('studentTrainer').innerHTML = '<option value="">-- Antrenör Seçiniz --</option>';
    document.getElementById('monthlyPrice').value = '';
    document.getElementById('totalAmount').value = '';
    document.getElementById('installmentAmount').value = '';
    renderInstallmentPlanInputs();
    refreshRegistrationFlowUi(application);
    switchPage('registration');
    scrollMainContentToTop(document.getElementById('registrationForm'));
}

async function rejectClubApplication(applicationId) {
    if (!confirm('Bu ön kaydı reddetmek istediğinize emin misiniz?')) {
        return;
    }

    try {
        await db.collection(CLUB_APPLICATIONS_COLLECTION).doc(applicationId).set({
            status: 'rejected',
            requestedParentPassword: firebase.firestore.FieldValue.delete(),
            reviewedAt: new Date().toISOString(),
            reviewedBy: currentSecretary?.id || null,
            reviewedByName: currentSecretary?.name || 'Sekreter',
            updatedAt: new Date().toISOString()
        }, { merge: true });

        if (getLeadApplicationId() === applicationId) {
            clearLeadRegistrationContext();
        }
    } catch (error) {
        alert('Ön kayıt reddedilemedi: ' + error.message);
    }
}

async function markClubApplicationAsConverted(applicationId, studentId, studentData) {
    if (!applicationId) return;

    await db.collection(CLUB_APPLICATIONS_COLLECTION).doc(applicationId).set({
        status: 'converted',
        requestedParentPassword: firebase.firestore.FieldValue.delete(),
        convertedAt: new Date().toISOString(),
        convertedBy: currentSecretary?.id || null,
        convertedByName: currentSecretary?.name || 'Sekreter',
        studentId,
        selectedBranchId: studentData.branchId || '',
        selectedScheduleId: studentData.scheduleId || '',
        selectedTrainerId: studentData.trainerId || '',
        startDate: studentData.startDate || '',
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

function getSecondaryAuthInstance() {
    if (!window.firebaseApp?.options) {
        throw new Error('Firebase bağlantısı hazır değil. Sayfayı yenileyip tekrar deneyin.');
    }

    const existingApp = firebase.apps.find(app => app.name === SECRETARY_SECONDARY_AUTH_APP);
    const secondaryApp = existingApp || firebase.initializeApp(window.firebaseApp.options, SECRETARY_SECONDARY_AUTH_APP);
    return secondaryApp.auth();
}

async function createParentAccountSafely(studentData, parentPassword) {
    if (!studentData.parentEmail) {
        throw new Error('Veli e-mail alanı boş bırakılamaz.');
    }

    try {
        const secondaryAuth = getSecondaryAuthInstance();
        const parentCred = await secondaryAuth.createUserWithEmailAndPassword(studentData.parentEmail, parentPassword);
        const parentUid = parentCred.user.uid;

        await db.collection('users').doc(parentUid).set({
            name: studentData.parentName,
            email: studentData.parentEmail,
            role: 'parent',
            adminId: currentAdminId,
            studentId: null
        }, { merge: true });

        await secondaryAuth.signOut().catch(() => null);
        return parentUid;
    } catch (createError) {
        if (createError.code === 'auth/email-already-in-use' || /email.*already.*in use/i.test(createError.message || '')) {
            const existingUsers = await db.collection('users').where('email', '==', studentData.parentEmail).limit(1).get();
            if (!existingUsers.empty) {
                const userDoc = existingUsers.docs[0];
                await db.collection('users').doc(userDoc.id).set({
                    name: studentData.parentName,
                    phone: studentData.parentPhone,
                    adminId: currentAdminId
                }, { merge: true });
                return userDoc.id;
            }
        }

        throw createError;
    }
}

function scrollMainContentToTop(targetElement = null) {
    if (useWindowScrollForSecretaryMobile()) {
        if (targetElement && typeof targetElement.scrollIntoView === 'function') {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        return;
    }

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

// Check authentication
window.addEventListener('load', async () => {
    try {
        const userId = sessionStorage.getItem('user_id');
        const role = sessionStorage.getItem('user_role');
        
        if (!userId || role !== 'secretary') {
            window.location.href = '../index.html';
            return;
        }

        currentSecretary = {
            id: userId,
            name: sessionStorage.getItem('user_name') || 'Sekreter',
            email: sessionStorage.getItem('user_email') || ''
        };

        setupEventListeners();

        // Get admin ID from Firestore
        try {
            const secDoc = await db.collection('users').doc(userId).get();
            if (secDoc.exists) {
                currentAdminId = secDoc.data().adminId;
                currentSecretary.adminId = currentAdminId;
            }
        } catch (e) {
            console.error('Admin ID alınamadı:', e);
        }
        
        const userNameEl = document.getElementById('userName');
        const userAvatarEl = document.getElementById('userAvatar');
        if (userNameEl) userNameEl.textContent = currentSecretary.name;
        if (userAvatarEl) userAvatarEl.textContent = currentSecretary.name.charAt(0).toUpperCase();
        
        await loadAllData();
        await ensurePreRegistrationLink();
        startClubApplicationsListener();
    } catch (error) {
        console.error('Sekreter paneli baslatilamadi:', error);
    } finally {
        setStudentFormMode(false);
        clearLeadRegistrationContext();
        renderInstallmentPlanInputs();
    }
});

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            switchPage(page);
        });
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
            await auth.signOut();
            sessionStorage.clear();
            window.location.href = '../index.html';
        } catch (error) {
            alert('Çıkış yapılırken hata: ' + error.message);
        }
    });
    
    // Registration form
    document.getElementById('registrationForm').addEventListener('submit', saveStudent);
    document.getElementById('registrationForm').addEventListener('reset', () => {
        const shouldSuppressCleanup = suppressRegistrationResetCleanup;
        suppressRegistrationResetCleanup = false;
        window.setTimeout(() => {
            if (!shouldSuppressCleanup) {
                cancelEditStudent();
                clearLeadRegistrationContext();
            }
            const startDateInput = document.getElementById('studentStartDate');
            if (startDateInput) startDateInput.value = new Date().toISOString().split('T')[0];
        }, 0);
    });
    
    // Branch change
    document.getElementById('studentBranch').addEventListener('change', updateSchedules);
    
    // Schedule change
    document.getElementById('studentSchedule').addEventListener('change', async () => {
        await updatePriceAndTotal();
        updateInstallmentAmount();
        updateTrainers();
    });
    
    // Installment change
    document.getElementById('installmentCount').addEventListener('change', async () => {
    suppressRegistrationResetCleanup = true;
        await updatePriceAndTotal();
        updateInstallmentAmount();
    });

    const leadSchedulePicker = document.getElementById('leadSchedulePicker');
    if (leadSchedulePicker) {
        leadSchedulePicker.addEventListener('change', handleLeadScheduleSelection);
    }

    const startDateInput = document.getElementById('studentStartDate');
    if (startDateInput && !startDateInput.value) {
        startDateInput.value = new Date().toISOString().split('T')[0];
    }

    renderInstallmentPlanInputs();
}

function setStudentFormMode(isEdit, student = null) {
    const form = document.getElementById('registrationForm');
    const submitBtn = document.getElementById('registrationSubmitBtn');
    const cancelBtn = document.getElementById('cancelEditStudentBtn');
    const info = document.getElementById('studentEditInfo');
    const passwordInput = document.getElementById('parentPassword');
    const confirmInput = document.getElementById('parentPasswordConfirm');
    const parentEmailInput = document.getElementById('parentEmail');

    if (form) {
        if (isEdit && student?.id) {
            form.dataset.studentId = student.id;
        } else {
            delete form.dataset.studentId;
        }
    }

    if (submitBtn) submitBtn.textContent = isEdit ? 'Güncellemeyi Kaydet' : 'Kayıt Oluştur';
    if (cancelBtn) cancelBtn.style.display = isEdit ? 'inline-flex' : 'none';

    if (passwordInput) {
        passwordInput.required = !isEdit;
        passwordInput.placeholder = isEdit ? 'Değiştirmek istemiyorsanız boş bırakın' : 'Min. 6 karakter';
        if (isEdit) passwordInput.value = '';
    }
    if (confirmInput) {
        confirmInput.required = !isEdit;
        confirmInput.placeholder = isEdit ? 'Değiştirmek istemiyorsanız boş bırakın' : 'Şifreyi tekrar girin';
        if (isEdit) confirmInput.value = '';
    }
    if (parentEmailInput) {
        parentEmailInput.readOnly = isEdit;
        parentEmailInput.style.background = isEdit ? '#f5f7fa' : '';
    }

    if (info) {
        if (isEdit && student) {
            info.style.display = 'block';
            info.textContent = `Düzenleme modu aktif: ${student.name} ${student.surname}. Bilgileri güncelleyip "Güncellemeyi Kaydet" butonuna basın.`;
        } else {
            info.style.display = 'none';
            info.textContent = '';
        }
    }

    refreshRegistrationFlowUi();
}

function cancelEditStudent() {
    editingStudentId = null;
    setStudentFormMode(false);
    refreshRegistrationFlowUi();
}

async function editStudent(studentId) {
    clearLeadRegistrationContext();

    const student = allStudents.find(item => item.id === studentId);
    if (!student) {
        alert('Öğrenci bulunamadı.');
        return;
    }

    editingStudentId = studentId;

    document.getElementById('studentName').value = student.name || '';
    document.getElementById('studentSurname').value = student.surname || '';
    document.getElementById('studentBirthYear').value = student.birthYear || '';
    document.getElementById('studentGender').value = student.gender || '';
    document.getElementById('studentPhone').value = student.phone || '';
    document.getElementById('parentName').value = student.parentName || '';
    document.getElementById('parentEmail').value = student.parentEmail || '';
    document.getElementById('parentPhone').value = student.parentPhone || '';
    document.getElementById('studentAddress').value = student.address || '';
    document.getElementById('studentStartDate').value = student.startDate || new Date().toISOString().split('T')[0];

    document.getElementById('studentBranch').value = student.branchId || '';
    await updateSchedules();
    document.getElementById('studentSchedule').value = student.scheduleId || '';
    await updatePriceAndTotal();
    updateInstallmentAmount();
    updateTrainers();
    document.getElementById('studentTrainer').value = student.trainerId || '';

    document.getElementById('installmentCount').value = student.installmentCount || 1;
    document.getElementById('totalAmount').value = Number(student.totalAmount || 0).toFixed(2);
    document.getElementById('monthlyPrice').value = Number(student.monthlyPrice || 0).toFixed(2);
    updateInstallmentAmount();
    fillInstallmentPlanInputs(student.installments, student.installmentCount || 1, student.totalAmount || 0);

    appliedDiscount = null;
    const discountInfo = document.getElementById('discountInfo');
    if (discountInfo) discountInfo.style.display = 'none';

    student.id = studentId;
    setStudentFormMode(true, student);
    switchPage('registration');
    scrollMainContentToTop(document.getElementById('registrationForm'));
}

// Taksit başına tutar hesaplama
function updateInstallmentAmount() {
    const totalAmount = parseFloat(document.getElementById('totalAmount').value) || 0;
    const installmentCount = parseInt(document.getElementById('installmentCount').value) || 1;
    
    const installmentAmount = totalAmount / installmentCount;
    document.getElementById('installmentAmount').value = installmentAmount.toFixed(2);
    renderInstallmentPlanInputs();
}

function roundCurrency(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function buildInstallmentAmounts(totalAmount, installmentCount) {
    const count = Math.max(1, Number(installmentCount) || 1);
    const total = roundCurrency(totalAmount);
    if (!total || total <= 0) {
        return Array.from({ length: count }, () => 0);
    }

    const baseAmount = roundCurrency(total / count);
    const amounts = [];
    let distributed = 0;

    for (let index = 0; index < count; index += 1) {
        const nextAmount = index === count - 1 ? roundCurrency(total - distributed) : baseAmount;
        amounts.push(nextAmount);
        distributed = roundCurrency(distributed + nextAmount);
    }

    return amounts;
}

function formatInstallmentDateValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function buildDefaultInstallmentDate(index) {
    const date = new Date();
    date.setMonth(date.getMonth() + index);
    return formatInstallmentDateValue(date);
}

function getExistingInstallmentPlanDraft() {
    return Array.from(document.querySelectorAll('.installment-plan-row')).map(row => ({
        dueDate: row.querySelector('.installment-due-date')?.value || '',
        lessonLabel: row.querySelector('.installment-lesson-label')?.value || ''
    }));
}

function renderInstallmentPlanInputs() {
    const container = document.getElementById('installmentPlanContainer');
    if (!container) return;

    const installmentCount = Math.max(1, parseInt(document.getElementById('installmentCount').value, 10) || 1);
    const totalAmount = parseFloat(document.getElementById('totalAmount').value) || 0;
    const existingDraft = getExistingInstallmentPlanDraft();
    const installmentAmounts = buildInstallmentAmounts(totalAmount, installmentCount);

    container.innerHTML = Array.from({ length: installmentCount }, (_, index) => {
        const draft = existingDraft[index] || {};
        const defaultDate = draft.dueDate || buildDefaultInstallmentDate(index);
        const lessonLabel = draft.lessonLabel || '';
        const amount = installmentAmounts[index] || 0;
        return `
            <div class="installment-plan-row" data-index="${index}" style="display:grid; grid-template-columns: 120px 160px 1fr 140px; gap:12px; align-items:end; padding:12px; border:1px solid #e5e9ef; border-radius:8px; margin-bottom:10px; background:#fff;">
                <div>
                    <label style="display:block; margin-bottom:6px; font-weight:600;">${index + 1}. taksit</label>
                    <input type="text" value="₺${amount.toFixed(2)}" readonly style="width:100%; padding:10px; background:#f3f6f9; border:1px solid #d7dee7; border-radius:6px;">
                </div>
                <div>
                    <label style="display:block; margin-bottom:6px;">Vade tarihi</label>
                    <input type="date" class="installment-due-date" value="${defaultDate}" style="width:100%; padding:10px; border:1px solid #d7dee7; border-radius:6px;">
                </div>
                <div>
                    <label style="display:block; margin-bottom:6px;">Ders zamanı / not</label>
                    <input type="text" class="installment-lesson-label" value="${lessonLabel.replace(/"/g, '&quot;')}" placeholder="örn: Pazartesi 19:00 dersi çıkışı" style="width:100%; padding:10px; border:1px solid #d7dee7; border-radius:6px;">
                </div>
                <div style="font-size:0.85em; color:#6b7b8b; padding-bottom:10px;">Tarih veya ders notundan en az biri dolu olmalı.</div>
            </div>
        `;
    }).join('');
}

function fillInstallmentPlanInputs(installments = [], installmentCount = 1, totalAmount = 0) {
    document.getElementById('installmentCount').value = Math.max(1, Number(installmentCount) || 1);
    document.getElementById('totalAmount').value = Number(totalAmount || 0).toFixed(2);
    renderInstallmentPlanInputs();

    const rows = Array.from(document.querySelectorAll('.installment-plan-row'));
    rows.forEach((row, index) => {
        const item = Array.isArray(installments) ? installments[index] : null;
        if (!item) return;
        const dueDateInput = row.querySelector('.installment-due-date');
        const lessonLabelInput = row.querySelector('.installment-lesson-label');
        if (dueDateInput) dueDateInput.value = item.dueDate || '';
        if (lessonLabelInput) lessonLabelInput.value = item.lessonLabel || '';
    });
}

function buildInstallmentPlanFromForm(existingInstallments = []) {
    const totalAmount = parseFloat(document.getElementById('totalAmount').value) || 0;
    const installmentCount = Math.max(1, parseInt(document.getElementById('installmentCount').value, 10) || 1);
    const installmentAmounts = buildInstallmentAmounts(totalAmount, installmentCount);
    const rows = Array.from(document.querySelectorAll('.installment-plan-row'));
    const existingMap = new Map(
        (Array.isArray(existingInstallments) ? existingInstallments : []).map((item, index) => [
            Number(item?.installmentNumber || index + 1),
            item || {}
        ])
    );

    return rows.map((row, index) => {
        const dueDate = row.querySelector('.installment-due-date')?.value || '';
        const lessonLabel = String(row.querySelector('.installment-lesson-label')?.value || '').trim();
        const installmentNumber = index + 1;
        const existing = existingMap.get(installmentNumber) || {};
        const amount = installmentAmounts[index] || 0;
        const paidAmount = Math.min(roundCurrency(existing.paidAmount || 0), roundCurrency(amount));

        if (!dueDate && !lessonLabel) {
            throw new Error(`${index + 1}. taksit için vade tarihi veya ders notu girilmelidir.`);
        }

        return {
            installmentNumber,
            amount,
            dueDate: dueDate || null,
            lessonLabel,
            paid: paidAmount + 0.009 >= roundCurrency(amount),
            paidAmount,
            paidAt: existing.paidAt || null
        };
    });
}

function getStudentInstallments(student) {
    if (Array.isArray(student?.installments) && student.installments.length) {
        return student.installments.map(item => ({ ...item }));
    }

    const installmentCount = Math.max(1, Number(student?.installmentCount) || 1);
    const amounts = buildInstallmentAmounts(Number(student?.totalAmount) || 0, installmentCount);
    return amounts.map((amount, index) => ({
        installmentNumber: index + 1,
        amount,
        dueDate: null,
        lessonLabel: '',
        paid: false,
        paidAmount: 0,
        paidAt: null
    }));
}

function getNextPendingInstallment(student) {
    const installments = getStudentInstallments(student);
    return installments.find(item => roundCurrency(item.paidAmount || 0) + 0.009 < roundCurrency(item.amount || 0)) || null;
}

function renderPaymentInstallmentPlan(student) {
    const container = document.getElementById('paymentInstallmentPlan');
    if (!container) return;

    const installments = getStudentInstallments(student);
    if (!installments.length) {
        container.innerHTML = '<div style="color:#95a5a6;">Kayıtlı taksit planı yok.</div>';
        return;
    }

    container.innerHTML = installments.map(item => {
        const installmentAmount = roundCurrency(item.amount || 0);
        const paidAmount = roundCurrency(item.paidAmount || 0);
        const remainingAmount = Math.max(0, roundCurrency(installmentAmount - paidAmount));
        const status = remainingAmount <= 0.009 ? 'Ödendi' : (paidAmount > 0 ? 'Kısmi ödendi' : 'Bekliyor');
        const statusColor = remainingAmount <= 0.009 ? '#27ae60' : (paidAmount > 0 ? '#f39c12' : '#7f8c8d');
        const meta = [item.dueDate || '', item.lessonLabel || ''].filter(Boolean).join(' • ');
        return `
            <div style="display:flex; justify-content:space-between; gap:12px; padding:10px 0; border-bottom:1px solid #eef2f6;">
                <div>
                    <div style="font-weight:600; color:#2c3e50;">${item.installmentNumber}. taksit</div>
                    <div style="font-size:0.85em; color:#6f8091; margin-top:4px;">${meta || 'Plan bilgisi girilmedi'}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:600; color:#2c3e50;">₺${installmentAmount.toFixed(2)}</div>
                    <div style="font-size:0.82em; color:${statusColor}; margin-top:4px;">${status}${remainingAmount > 0.009 ? ` • Kalan ₺${remainingAmount.toFixed(2)}` : ''}</div>
                </div>
            </div>
        `;
    }).join('');
}

function applyPaymentToInstallments(student, paymentAmount, paymentTimestamp) {
    const installments = getStudentInstallments(student);
    let remainingPayment = roundCurrency(paymentAmount);
    const allocations = [];

    installments.forEach(item => {
        if (remainingPayment <= 0) return;
        const totalAmount = roundCurrency(item.amount || 0);
        const alreadyPaid = roundCurrency(item.paidAmount || 0);
        const remainingInstallment = Math.max(0, roundCurrency(totalAmount - alreadyPaid));

        if (remainingInstallment <= 0.009) return;

        const appliedAmount = Math.min(remainingPayment, remainingInstallment);
        if (appliedAmount <= 0) return;

        item.paidAmount = roundCurrency(alreadyPaid + appliedAmount);
        item.paid = item.paidAmount + 0.009 >= totalAmount;
        if (item.paid) {
            item.paidAt = paymentTimestamp;
        }
        remainingPayment = roundCurrency(remainingPayment - appliedAmount);
        allocations.push({
            installmentNumber: item.installmentNumber,
            appliedAmount,
            dueDate: item.dueDate || null,
            lessonLabel: item.lessonLabel || ''
        });
    });

    return { installments, allocations };
}

// Load all data from Firestore
async function loadAllData() {
    try {
        const adminKey = currentAdminId || (currentSecretary && currentSecretary.adminId) || '';

        if (!adminKey) {
            console.error('Admin ID bulunamadı. Sekreter hesabı doğru admin atamasına sahip olmalı.');
            alert('Hata: Sekreter hesabı için yönetici (admin) bilgisi eksik. Lütfen yönetici ayarlarını kontrol edin.');
            return;
        }

        const [branchesSnap, schedulesSnap, trainersSnap, studentsSnap, pricesSnap] = await Promise.all([
            db.collection('branches').where('adminId', '==', adminKey).get(),
            db.collection('schedules').where('adminId', '==', adminKey).get(),
            db.collection('trainers').where('adminId', '==', adminKey).get(),
            db.collection('students').where('adminId', '==', adminKey).get(),
            db.collection('prices').where('adminId', '==', adminKey).get()
        ]);

        allBranches = branchesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        allSchedules = schedulesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        allTrainers = trainersSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        allStudents = studentsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        allPrices = [];
        pricesSnap.docs.forEach(doc => {
            allPrices.push({key: doc.id, ...doc.data()});
        });
        
        // Update branch select
        updateBranchSelect();
        populateLeadSchedulePicker(document.getElementById('studentSchedule')?.value || '');
        refreshRegistrationFlowUi();
        loadStudents();
    } catch (error) {
        console.error('Veri yüklenirken hata:', error);
    }
}

// Switch page
function switchPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
    });
    
    // Remove active from nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected page
    const pageElement = document.getElementById(pageName + '-page');
    if (pageElement) {
        pageElement.classList.add('active');
        requestAnimationFrame(() => scrollMainContentToTop(pageElement));
    }
    
    // Add active to nav link
    const activeNavLink = document.querySelector(`[data-page="${pageName}"]`);
    if (activeNavLink) activeNavLink.classList.add('active');
    
    // Update title
    const titles = {
        'registration': 'Öğrenci Kayıt',
        'students': 'Kayıtlı Öğrenciler',
        'chat': '💬 Mesajlaşma'
    };

    document.getElementById('pageTitle').textContent = titles[pageName] || 'Sekreter';

    if (pageName === 'students') {
        loadStudents();
    } else if (pageName === 'chat') {
        loadChatList();
    }
}

// Update branch select
function updateBranchSelect() {
    const select = document.getElementById('studentBranch');
    select.innerHTML = '<option value="">-- Şube Seçiniz --</option>';
    allBranches.forEach(branch => {
        const option = document.createElement('option');
        option.value = branch.id;
        option.textContent = branch.name;
        select.appendChild(option);
    });
}

// Update schedules based on branch
async function updateSchedules() {
    const branchId = document.getElementById('studentBranch').value;
    const scheduleSelect = document.getElementById('studentSchedule');
    scheduleSelect.innerHTML = '<option value="">-- Ders Saati Seçiniz --</option>';
    
    if (!branchId) return;
    
    const branchSchedules = allSchedules.filter(s => s.branchId === branchId);
    branchSchedules.forEach(schedule => {
        const option = document.createElement('option');
        option.value = schedule.id;
        const days = Array.isArray(schedule.days) && schedule.days.length ? schedule.days : [];
        const dayLabels = days.map(day => ({
            monday: 'Pzt',
            tuesday: 'Sal',
            wednesday: 'Çar',
            thursday: 'Per',
            friday: 'Cum',
            saturday: 'Cmt',
            sunday: 'Paz'
        }[day] || day));
        option.textContent = dayLabels.length ? `${schedule.time} (${dayLabels.join(', ')})` : schedule.time;
        scheduleSelect.appendChild(option);
    });
    
    // Clear price
    document.getElementById('monthlyPrice').value = '';
    document.getElementById('totalAmount').value = '';
    document.getElementById('installmentAmount').value = '';
    
    // Clear trainers
    updateTrainers();
}

// Update trainers based on schedule
function updateTrainers() {
    const scheduleId = document.getElementById('studentSchedule').value;
    const trainerSelect = document.getElementById('studentTrainer');
    trainerSelect.innerHTML = '<option value="">-- Antrenör Seçiniz --</option>';
    
    if (!scheduleId) return;
    
    const schedule = allSchedules.find(s => s.id === scheduleId);
    if (!schedule) return;

    const assignments = Array.isArray(schedule.trainerAssignments) && schedule.trainerAssignments.length
        ? schedule.trainerAssignments
        : (schedule.trainerId ? [{ trainerId: schedule.trainerId, trainerDocId: schedule.trainerDocId || '', role: 'head' }] : []);

    assignments.forEach(assignment => {
        const trainer = allTrainers.find(t => t.id === assignment.trainerId || t.uid === assignment.trainerId || t.id === assignment.trainerDocId);
        if (!trainer) return;
        const option = document.createElement('option');
        option.value = trainer.id;
        option.textContent = `${trainer.name}${assignment.role === 'assistant' ? ' (Yardımcı)' : ' (Baş)'}`;
        trainerSelect.appendChild(option);
    });
}

// Update price and total
async function updatePriceAndTotal() {
    const scheduleId = document.getElementById('studentSchedule').value;
    const installmentCount = parseInt(document.getElementById('installmentCount').value) || 1;

    if (!scheduleId) {
        document.getElementById('monthlyPrice').value = '';
        document.getElementById('totalAmount').value = '';
        return;
    }

    const schedule = allSchedules.find(s => s.id === scheduleId);
    if (!schedule) return;

    const priceKey = `${schedule.branchId}_${schedule.time}`;
    const priceObj = allPrices.find(p => p.key === priceKey);

    if (priceObj && priceObj.price) {
        const totalPrice = priceObj.price; // Toplam tutar değişmez!
        document.getElementById('monthlyPrice').value = priceObj.price.toFixed(2);
        document.getElementById('totalAmount').value = totalPrice.toFixed(2);

        // Reset discount when price changes
        if (appliedDiscount) {
            appliedDiscount = null;
            document.getElementById('discountInfo').style.display = 'none';
            document.getElementById('discountCode').value = '';
        }

        updateInstallmentAmount();
    }
}

function buildLessonGroupChatId(adminId, branchId, scheduleId) {
    return ['lesson-group', adminId || 'global', branchId || 'unknown', scheduleId || 'unknown']
        .join('_')
        .replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function ensureLessonGroupChat(studentId, studentData, parentUid) {
    if (!studentData?.branchId || !studentData?.scheduleId || !currentAdminId) return;

    const branch = allBranches.find(item => item.id === studentData.branchId);
    const schedule = allSchedules.find(item => item.id === studentData.scheduleId);
    const trainer = allTrainers.find(item => item.id === studentData.trainerId || item.uid === studentData.trainerId || item.id === schedule?.trainerId || item.uid === schedule?.trainerId);
    const trainerUserId = trainer?.uid || trainer?.id || schedule?.trainerId || '';

    if (!branch || !schedule || !trainerUserId || !parentUid) return;

    const groupRef = db.collection('chats').doc(buildLessonGroupChatId(currentAdminId, branch.id, schedule.id));
    const existingDoc = await groupRef.get();
    const existingData = existingDoc.exists ? existingDoc.data() || {} : {};

    const [adminDoc, trainerUserDoc] = await Promise.all([
        db.collection('users').doc(currentAdminId).get().catch(() => null),
        db.collection('users').doc(trainerUserId).get().catch(() => null)
    ]);

    const adminData = adminDoc && adminDoc.exists ? adminDoc.data() || {} : {};
    const trainerUserData = trainerUserDoc && trainerUserDoc.exists ? trainerUserDoc.data() || {} : {};
    const participantMap = {
        [currentAdminId]: {
            name: adminData.name || 'Kulüp Yöneticisi',
            role: adminData.role || 'admin',
            email: adminData.email || ''
        },
        [currentSecretary.id]: {
            name: currentSecretary.name || 'Sekreter',
            role: 'secretary',
            email: currentSecretary.email || ''
        },
        [trainerUserId]: {
            name: trainer?.name || trainerUserData.name || 'Antrenör',
            role: trainerUserData.role || 'trainer',
            email: trainer?.email || trainerUserData.email || ''
        },
        [parentUid]: {
            name: studentData.parentName || 'Veli',
            role: 'parent',
            email: studentData.parentEmail || ''
        }
    };

    const participantIds = Array.from(new Set(Object.keys(participantMap).filter(Boolean)));
    const nextUsers = { ...(existingData.users || {}) };
    participantIds.forEach(userId => {
        nextUsers[userId] = {
            ...(nextUsers[userId] || {}),
            ...(participantMap[userId] || {})
        };
    });

    await groupRef.set({
        type: 'group',
        lessonGroup: true,
        adminId: currentAdminId,
        branchId: branch.id,
        scheduleId: schedule.id,
        trainerId: trainerUserId,
        studentIds: Array.from(new Set((existingData.studentIds || []).concat(studentId).filter(Boolean))),
        groupName: `${branch.name || 'Şube'} - ${schedule.time || 'Saat'}`,
        userIds: Array.from(new Set((existingData.userIds || []).concat(participantIds))),
        userEmails: Array.from(new Set((existingData.userEmails || []).concat(participantIds.map(userId => participantMap[userId]?.email).filter(Boolean)))),
        users: nextUsers,
        adminIds: Array.from(new Set((existingData.adminIds || []).concat([currentAdminId, currentSecretary.id]).filter(Boolean))),
        createdBy: existingData.createdBy || currentSecretary.id,
        createdAt: existingData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'active',
        groupSettings: {
            ...(existingData.groupSettings || {}),
            messagingMode: 'all',
            autoCreated: true
        },
        unreadCounts: existingData.unreadCounts || {}
    }, { merge: true });

    if (!existingDoc.exists) {
        await groupRef.collection('messages').add({
            senderId: currentSecretary.id,
            senderName: currentSecretary.name,
            senderEmail: currentSecretary.email || '',
            text: `${studentData.name} ${studentData.surname} öğrencisi için ders grubu oluşturuldu.`,
            type: 'system',
            timestamp: new Date().toISOString()
        });
    }
}

async function cleanupLessonGroupChatIfEmpty(studentData) {
    if (!studentData?.branchId || !studentData?.scheduleId || !currentAdminId) return;

    const remainingStudentsSnap = await db.collection('students')
        .where('adminId', '==', currentAdminId)
        .where('branchId', '==', studentData.branchId)
        .where('scheduleId', '==', studentData.scheduleId)
        .get();

    const remainingStudents = remainingStudentsSnap.docs
        .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
        .filter(student => String(student.status || 'active') !== 'inactive' && String(student.status || 'active') !== 'deleted');

    if (remainingStudents.length > 0) return;

    const groupId = buildLessonGroupChatId(currentAdminId, studentData.branchId, studentData.scheduleId);
    const groupRef = db.collection('chats').doc(groupId);
    const groupDoc = await groupRef.get();
    if (!groupDoc.exists) return;

    await groupRef.delete();
}

async function deleteSecretaryDocumentsByField(collectionName, fieldName, value) {
    if (!value) {
        return 0;
    }

    const snap = await db.collection(collectionName).where(fieldName, '==', value).get();
    if (snap.empty) {
        return 0;
    }

    await Promise.all(snap.docs.map(doc => doc.ref.delete()));
    return snap.size;
}

async function cleanupOrphanParentFirestoreUser(parentUid, excludedStudentId = '') {
    if (!parentUid || !currentAdminId) {
        return;
    }

    const remainingStudentsSnap = await db.collection('students')
        .where('adminId', '==', currentAdminId)
        .where('parentUid', '==', parentUid)
        .get();

    const hasRemainingStudent = remainingStudentsSnap.docs.some(doc => doc.id !== excludedStudentId);
    if (!hasRemainingStudent) {
        await db.collection('users').doc(parentUid).delete().catch(() => null);
    }
}

async function cleanupStudentFirestoreRecords(studentId, studentData = {}) {
    await Promise.all([
        deleteSecretaryDocumentsByField('payments', 'studentId', studentId),
        deleteSecretaryDocumentsByField('attendance', 'studentId', studentId),
        deleteSecretaryDocumentsByField('performances', 'studentId', studentId),
        deleteSecretaryDocumentsByField('lesson_comments', 'studentId', studentId),
        deleteSecretaryDocumentsByField('trainer_reviews', 'studentId', studentId),
        deleteSecretaryDocumentsByField('student_workouts', 'studentId', studentId)
    ]);

    await db.collection('students').doc(studentId).delete();
    await cleanupOrphanParentFirestoreUser(studentData.parentUid || '', studentId);
    await cleanupLessonGroupChatIfEmpty(studentData);
}

// Save student
async function saveStudent(e) {
    e.preventDefault();
    
    const leadApplicationId = getLeadApplicationId();
    const leadPassword = getLeadGeneratedPassword();
    const parentPassword = document.getElementById('parentPassword').value || leadPassword;
    const parentPasswordConfirm = document.getElementById('parentPasswordConfirm').value || leadPassword;

    const activeEditingStudentId = getEditingStudentId();
    const isEditMode = Boolean(activeEditingStudentId);
    const existingStudent = isEditMode ? allStudents.find(item => item.id === activeEditingStudentId) : null;

    if (isLeadRegistrationMode() && !document.getElementById('leadSchedulePicker').value) {
        alert('Lütfen ön kayıt için önce ders saatini seçiniz!');
        return;
    }
    
    // Şifre doğrulama
    if (!isEditMode && parentPassword.length < 6) {
        alert('Şifre en az 6 karakter olmalıdır!');
        return;
    }
    
    if (!isEditMode && parentPassword !== parentPasswordConfirm) {
        alert('Şifreler eşleşmiyor!');
        return;
    }
    
    const birthYear = parseInt(document.getElementById('studentBirthYear').value, 10);
    if (!birthYear || birthYear < 1990 || birthYear > 2035) {
        alert('Lütfen geçerli bir doğum yılı giriniz!');
        return;
    }

    const studentGender = document.getElementById('studentGender').value;
    if (!studentGender) {
        alert('Lütfen öğrencinin cinsiyetini seçiniz!');
        return;
    }

    const studentData = {
        name: document.getElementById('studentName').value,
        surname: document.getElementById('studentSurname').value,
        birthYear: birthYear,
        gender: studentGender,
        phone: document.getElementById('studentPhone').value,
        parentName: document.getElementById('parentName').value,
        parentEmail: document.getElementById('parentEmail').value,
        parentPhone: document.getElementById('parentPhone').value,
        address: document.getElementById('studentAddress').value,
        branchId: document.getElementById('studentBranch').value,
        scheduleId: document.getElementById('studentSchedule').value,
        trainerId: document.getElementById('studentTrainer').value,
        startDate: document.getElementById('studentStartDate').value || new Date().toISOString().split('T')[0],
        monthlyPrice: parseFloat(document.getElementById('monthlyPrice').value),
        installmentCount: parseInt(document.getElementById('installmentCount').value),
        totalAmount: parseFloat(document.getElementById('totalAmount').value),
        totalPaid: Number(existingStudent?.totalPaid || 0),
        attendedClasses: Number(existingStudent?.attendedClasses || 0),
        missedClasses: Number(existingStudent?.missedClasses || 0),
        status: existingStudent?.status || 'active',
        adminId: currentAdminId,
        createdAt: existingStudent?.createdAt || new Date().toISOString()
    };

    const activeLeadApplication = leadApplicationId ? getActiveLeadApplication() : null;
    if (activeLeadApplication) {
        studentData.preRegistrationId = leadApplicationId;
        studentData.preRegistrationSource = activeLeadApplication.source || 'hidden-link-form';
        studentData.paymentPreference = activeLeadApplication.paymentMethodPreference || '';
        studentData.requestedInstallmentCount = Math.max(1, Number(activeLeadApplication.installmentCount) || 1);
        studentData.requestedInstallmentPreference = activeLeadApplication.installmentPreference || '';
        studentData.preRegistrationNote = activeLeadApplication.note || '';
    }

    const selectedSchedule = allSchedules.find(schedule => schedule.id === studentData.scheduleId);
    if (!selectedSchedule) {
        alert('Lütfen geçerli bir ders saati seçiniz!');
        return;
    }

    const scheduleCapacity = Math.max(0, parseInt(selectedSchedule.capacity, 10) || 0);
    if (scheduleCapacity > 0) {
        const studentsSnap = await db.collection('students')
            .where('adminId', '==', currentAdminId)
            .where('scheduleId', '==', studentData.scheduleId)
            .get();

        const activeStudentsInSchedule = studentsSnap.docs
            .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
            .filter(student => !activeEditingStudentId || student.id !== activeEditingStudentId)
            .filter(student => String(student.status || 'active') !== 'inactive' && String(student.status || 'active') !== 'deleted');

        if (activeStudentsInSchedule.length >= scheduleCapacity) {
            alert(`Bu ders saatinin kapasitesi dolu. Kapasite: ${scheduleCapacity}, kayıtlı öğrenci: ${activeStudentsInSchedule.length}`);
            return;
        }
    }

    studentData.installments = buildInstallmentPlanFromForm(existingStudent?.installments || []);

    // Add discount information if applied
    if (appliedDiscount) {
        studentData.discountCode = appliedDiscount.code;
        studentData.discountPercentage = appliedDiscount.percentage;
        studentData.originalAmount = parseFloat(document.getElementById('monthlyPrice').value);
    }
    
    try {
        if (isEditMode) {
            const existingDoc = await db.collection('students').doc(activeEditingStudentId).get();
            const existingData = existingDoc.exists ? existingDoc.data() || {} : {};
            const preservedInstallments = buildInstallmentPlanFromForm(existingData.installments || []);

            await db.collection('students').doc(activeEditingStudentId).update({
                ...studentData,
                totalPaid: Number(existingData.totalPaid || 0),
                attendedClasses: Number(existingData.attendedClasses || 0),
                missedClasses: Number(existingData.missedClasses || 0),
                status: existingData.status || studentData.status || 'active',
                installments: preservedInstallments,
                createdAt: existingData.createdAt || studentData.createdAt,
                parentUid: existingData.parentUid || null,
                updatedAt: new Date().toISOString()
            });

            if (existingData.parentUid) {
                await db.collection('users').doc(existingData.parentUid).set({
                    name: studentData.parentName,
                    phone: studentData.parentPhone,
                    adminId: currentAdminId
                }, { merge: true });
                await ensureLessonGroupChat(activeEditingStudentId, studentData, existingData.parentUid);
            }

            if (existingData && (existingData.branchId !== studentData.branchId || existingData.scheduleId !== studentData.scheduleId)) {
                await cleanupLessonGroupChatIfEmpty(existingData);
            }

            alert('Öğrenci bilgileri güncellendi!');
            document.getElementById('registrationForm').reset();
            const startDateInput = document.getElementById('studentStartDate');
            if (startDateInput) startDateInput.value = new Date().toISOString().split('T')[0];
            cancelEditStudent();
            await loadAllData();
            loadStudents();
            return;
        }

        // Create parent account with Firebase Auth - sekreter belirlenmiş şifre ile
        const parentUid = await createParentAccountSafely(studentData, parentPassword);

        // Save student
        const docRef = await db.collection('students').add({
            ...studentData,
            parentUid
        });
        
        // Update parent user with student ID
        await db.collection('users').doc(parentUid).update({
            studentId: docRef.id
        });

        await ensureLessonGroupChat(docRef.id, studentData, parentUid);

        // Increment discount usage count if discount was applied
        if (appliedDiscount) {
            await db.collection('discounts').doc(appliedDiscount.id).update({
                usageCount: (appliedDiscount.usageCount || 0) + 1
            });
        }

        if (leadApplicationId) {
            await markClubApplicationAsConverted(leadApplicationId, docRef.id, studentData);
        }

        alert(`Öğrenci başarıyla kaydedildi!\n\nVeli Giriş Bilgileri:\nE-mail: ${studentData.parentEmail}\nŞifre: ${parentPassword}`);
        document.getElementById('registrationForm').reset();
        const startDateInput = document.getElementById('studentStartDate');
        if (startDateInput) {
            startDateInput.value = new Date().toISOString().split('T')[0];
        }

        // Reset discount
        appliedDiscount = null;
        document.getElementById('discountInfo').style.display = 'none';

        await loadAllData();
        loadStudents();
    } catch (error) {
        alert('Hata: ' + error.message);
        console.error('Save error:', error);
    }
}

// Load students list
async function loadStudents() {
    const container = document.getElementById('studentsGroupContainer');
    container.innerHTML = '';
    
    // Grup oluştur: schedule + branch kombinasyonuna göre
    const groups = {};
    
    allStudents.forEach(student => {
        const schedule = allSchedules.find(s => s.id === student.scheduleId);
        const branch = allBranches.find(b => b.id === student.branchId);
        
        const key = `${student.branchId}_${student.scheduleId}`;
        const label = `${branch ? branch.name : 'Bilinmiyor'} - ${schedule ? schedule.time : 'Bilinmiyor'} (${schedule?.lessonsCount || 1} Ders)`;
        
        if (!groups[key]) {
            groups[key] = {
                label,
                students: []
            };
        }
        groups[key].students.push(student);
    });
    
    // Grupları sırala
    const sortedKeys = Object.keys(groups).sort();
    
    sortedKeys.forEach((key, index) => {
        const group = groups[key];
        const groupId = `group-${index}`;
        
        const groupDiv = document.createElement('div');
        groupDiv.style.marginBottom = '20px';
        groupDiv.style.border = '1px solid #ddd';
        groupDiv.style.borderRadius = '5px';
        groupDiv.style.overflow = 'hidden';
        
        // Başlık (tıklanabilir)
        const header = document.createElement('div');
        header.style.backgroundColor = '#007bff';
        header.style.color = 'white';
        header.style.padding = '12px 15px';
        header.style.cursor = 'pointer';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.innerHTML = `
            <span>${group.label} <strong>(${group.students.length} Öğrenci)</strong></span>
            <span style="font-size: 18px;">▼</span>
        `;
        
        // İçerik
        const content = document.createElement('div');
        content.id = groupId;
        content.style.display = 'none';
        content.style.padding = '15px';
        content.style.backgroundColor = '#f9f9f9';
        
        // Tablo
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.innerHTML = `
            <thead style="background-color: #f0f0f0; border-bottom: 2px solid #ddd;">
                <tr>
                    <th style="padding: 10px; text-align: left;">Adı Soyadı</th>
                    <th style="padding: 10px; text-align: left;">Veli</th>
                    <th style="padding: 10px; text-align: left;">Telefon</th>
                    <th style="padding: 10px; text-align: left;">Ödeme Durumu</th>
                    <th style="padding: 10px; text-align: center;">İşlemler</th>
                </tr>
            </thead>
            <tbody id="tbody-${key}"></tbody>
        `;
        
        const tbody = table.getElementsByTagName('tbody')[0];
        group.students.forEach(student => {
            // Payment status hesaplama
            const totalAmount = student.totalAmount || 0;
            const paidAmount = student.totalPaid || 0;
            let paymentStatus = 'Ödenmedi';
            let paymentStatusClass = 'unpaid';
            
            if (paidAmount >= totalAmount) {
                paymentStatus = 'Tamamen Ödendi';
                paymentStatusClass = 'paid';
            } else if (paidAmount > 0) {
                paymentStatus = `Kısmi (₺${paidAmount.toFixed(2)})`;
                paymentStatusClass = 'partial';
            }
            
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid #ddd';
            row.innerHTML = `
                <td style="padding: 10px;">${student.name} ${student.surname}</td>
                <td style="padding: 10px;">${student.parentName}</td>
                <td style="padding: 10px;">${student.parentPhone}</td>
                <td style="padding: 10px;"><span class="payment-status ${paymentStatusClass}">${paymentStatus}</span></td>
                <td style="padding: 10px; text-align: center;">
                    <button class="btn btn-success btn-sm" onclick="openPaymentModal('${student.id}')" style="margin-right: 5px;">Taksit</button>
                    <button class="btn btn-info btn-sm" onclick="editStudent('${student.id}')" style="margin-right: 5px;">Düzenle</button>
                    <button class="btn btn-info btn-sm" onclick="viewStudent('${student.id}')" style="margin-right: 5px;">Görüntüle</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteStudent('${student.id}')">Sil</button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        content.appendChild(table);
        
        // Tıklama olayı
        header.onclick = () => {
            const isVisible = content.style.display !== 'none';
            content.style.display = isVisible ? 'none' : 'block';
            header.querySelector('span:last-child').style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
            header.querySelector('span:last-child').style.transition = 'transform 0.3s';
        };
        
        groupDiv.appendChild(header);
        groupDiv.appendChild(content);
        container.appendChild(groupDiv);
    });
    
    // Search functionality ekle
    setupSearch();
    
    // Export dropdown'ını populate et
    populateStudentExportScheduleFilter();
}

// Dropdown'ı schedule'larla populate et
function populateStudentExportScheduleFilter() {
    const selectElement = document.getElementById('studentExportScheduleFilter');
    if (!selectElement) return;
    
    // Mevcut options'ı temizle (first option hariç)
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }
    
    // Schedule'ları alphabetically sort et
    const sortedSchedules = [...allSchedules].sort((a, b) => {
        const aLabel = getScheduleDisplayLabel(a);
        const bLabel = getScheduleDisplayLabel(b);
        return aLabel.localeCompare(bLabel, 'tr');
    });
    
    // Her schedule için option ekle
    sortedSchedules.forEach(schedule => {
        const option = document.createElement('option');
        option.value = schedule.id;
        option.textContent = getScheduleDisplayLabel(schedule);
        selectElement.appendChild(option);
    });
}

// Export students by selected schedule as CSV
async function exportStudentsBySchedule() {
    try {
        const scheduleFilter = document.getElementById('studentExportScheduleFilter');
        if (!scheduleFilter) {
            alert('Export dropdown bulunamadı');
            return;
        }
        
        const selectedScheduleId = scheduleFilter.value;
        
        // Öğrencileri filtrele
        let filteredStudents = allStudents;
        if (selectedScheduleId) {
            filteredStudents = allStudents.filter(s => s.scheduleId === selectedScheduleId);
        }
        
        if (filteredStudents.length === 0) {
            alert('Bu saate ait öğrenci bulunamadı');
            return;
        }
        
        // CSV başlıkları
        const headers = ['Adı', 'Soyadı', 'Telefon', 'Ders Saati', 'Kalan Ders'];
        const rows = [];
        
        // Her öğrenci için satır oluştur
        filteredStudents.forEach(student => {
            const schedule = allSchedules.find(s => s.id === student.scheduleId);
            const scheduleLabel = schedule ? getScheduleDisplayLabel(schedule) : 'Bilinmiyor';
            
            // Kalan ders sayısını hesapla
            const totalLessons = schedule?.lessonsCount || 1;
            const attendedLessons = student.attendedClasses || 0;
            const missedLessons = student.missedClasses || 0;
            const remainingLessons = Math.max(0, totalLessons - attendedLessons - missedLessons);
            
            rows.push([
                student.name || '',
                student.surname || '',
                student.parentPhone || '',
                scheduleLabel,
                remainingLessons
            ]);
        });
        
        // CSV metni oluştur
        const csvContent = [
            headers.map(h => `"${h}"`).join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        // CSV dosyasını indir
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const filename = selectedScheduleId 
            ? `students_${allSchedules.find(s => s.id === selectedScheduleId)?.id || 'export'}_${new Date().toISOString().split('T')[0]}.csv`
            : `students_all_${new Date().toISOString().split('T')[0]}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log(`${filteredStudents.length} öğrenci başarıyla indirildi`);
    } catch (error) {
        console.error('Öğrenci export hatası:', error);
        alert('Öğrenci indirme başarısız: ' + error.message);
    }
}

async function viewStudent(studentId) {
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;

    const currentYear = new Date().getFullYear();
    const studentBirthYear = student.birthYear || (student.age ? currentYear - Number(student.age) : '-');
    const studentAge = student.birthYear ? currentYear - Number(student.birthYear) : (student.age || '-');
    
    alert(`
ÖĞRENCI DETAYLARI

Ad Soyad: ${student.name} ${student.surname}
Doğum Yılı: ${studentBirthYear}
Yaş: ${studentAge}
Cinsiyet: ${student.gender || '-'}
Telefon: ${student.phone}
Adres: ${student.address}

VELİ BİLGİLERİ
Ad Soyad: ${student.parentName}
E-mail: ${student.parentEmail}
Telefon: ${student.parentPhone}

KAYIT BİLGİLERİ
Aylık Ücret: ₺${student.monthlyPrice?.toFixed(2) || '0.00'}
Taksit Sayısı: ${student.installmentCount || '-'}
Toplam Tutar: ₺${student.totalAmount?.toFixed(2) || '0.00'}
Ödenen Tutar: ₺${student.totalPaid?.toFixed(2) || '0.00'}
    `);
}

async function deleteStudent(studentId) {
    if (!confirm('Bu öğrenciyi silmek istediğinize emin misiniz?')) return;
    
    try {
        const studentDoc = await db.collection('students').doc(studentId).get();
        const studentData = studentDoc.exists ? studentDoc.data() || {} : null;
        if (studentData) {
            await cleanupStudentFirestoreRecords(studentId, studentData);
        } else {
            await db.collection('students').doc(studentId).delete();
        }
        await loadAllData();
        loadStudents();
        alert('Öğrenci ve ilişkili Firestore kayıtları silindi!');
    } catch (error) {
        alert('Hata: ' + error.message);
    }
}

// Payment Modal Functions
let currentPaymentStudent = null;

async function openPaymentModal(studentId) {
    currentPaymentStudent = allStudents.find(s => s.id === studentId);
    if (!currentPaymentStudent) return;

    // Modal'ı doldur
    document.getElementById('paymentStudentName').textContent =
        `${currentPaymentStudent.name} ${currentPaymentStudent.surname}`;

    const totalAmount = currentPaymentStudent.totalAmount || 0;
    const paidAmount = currentPaymentStudent.totalPaid || 0;
    const remainingAmount = totalAmount - paidAmount;
    const nextPendingInstallment = getNextPendingInstallment(currentPaymentStudent);
    const installmentAmount = nextPendingInstallment
        ? Math.max(0, roundCurrency((nextPendingInstallment.amount || 0) - (nextPendingInstallment.paidAmount || 0)))
        : (currentPaymentStudent.installmentCount > 0 ? totalAmount / currentPaymentStudent.installmentCount : 0);

    document.getElementById('paymentTotalAmount').textContent = totalAmount.toFixed(2);
    document.getElementById('paymentPaidAmount').textContent = paidAmount.toFixed(2);
    document.getElementById('paymentRemainingAmount').textContent = remainingAmount.toFixed(2);
    document.getElementById('paymentInstallmentAmount').textContent = installmentAmount.toFixed(2);
    document.getElementById('paymentNextInstallmentInfo').textContent = nextPendingInstallment
        ? `${nextPendingInstallment.installmentNumber}. taksit • ${nextPendingInstallment.dueDate || 'Tarih yok'}${nextPendingInstallment.lessonLabel ? ` • ${nextPendingInstallment.lessonLabel}` : ''}`
        : 'Bekleyen taksit yok';
    renderPaymentInstallmentPlan(currentPaymentStudent);

    // Default değer olarak taksit tutarını ata (otomatik düş)
    document.getElementById('paymentAmount').value = Math.min(installmentAmount, remainingAmount).toFixed(2);
    document.getElementById('paymentAmount').max = remainingAmount.toFixed(2);

    // Ödeme yöntemini sıfırla ve event listener ekle
    document.getElementById('paymentMethod').value = 'cash';
    togglePaymentMethodFields();

    // Modal'ı aç
    document.getElementById('paymentModal').style.display = 'flex';
}

// Toggle payment method fields
function togglePaymentMethodFields() {
    const method = document.getElementById('paymentMethod').value;
    const receiptUploadDiv = document.getElementById('receiptUploadDiv');
    const receiptPhotoDiv = document.getElementById('receiptPhotoDiv');
    const cashTimeFieldsDiv = document.getElementById('cashTimeFieldsDiv');

    // Hide all additional fields first
    if (receiptUploadDiv) receiptUploadDiv.style.display = 'none';
    if (receiptPhotoDiv) receiptPhotoDiv.style.display = 'none';
    if (cashTimeFieldsDiv) cashTimeFieldsDiv.style.display = 'none';

    // Show relevant fields based on payment method
    if (method === 'transfer') {
        if (receiptUploadDiv) receiptUploadDiv.style.display = 'block';
    } else if (method === 'credit') {
        if (receiptPhotoDiv) receiptPhotoDiv.style.display = 'block';
    } else if (method === 'cash') {
        if (cashTimeFieldsDiv) cashTimeFieldsDiv.style.display = 'grid';
    }
}

function setCurrentTime() {
    const now = new Date();
    document.getElementById('paymentHour').value = String(now.getHours()).padStart(2, '0');
    document.getElementById('paymentMinute').value = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('paymentSecond').value = String(now.getSeconds()).padStart(2, '0');
}

function closePaymentModal() {
    document.getElementById('paymentModal').style.display = 'none';
    document.getElementById('paymentAmount').value = '';
    document.getElementById('paymentMethod').value = 'cash';
    document.getElementById('paymentNote').value = '';
    document.getElementById('paymentHour').value = '';
    document.getElementById('paymentMinute').value = '';
    document.getElementById('paymentSecond').value = '';
    document.getElementById('paymentNextInstallmentInfo').textContent = 'Plan bulunamadı';
    document.getElementById('paymentInstallmentPlan').innerHTML = '';

    // Clear file inputs
    const receiptFile = document.getElementById('receiptFile');
    const receiptPhoto = document.getElementById('receiptPhoto');
    if (receiptFile) receiptFile.value = '';
    if (receiptPhoto) receiptPhoto.value = '';

    currentPaymentStudent = null;
}

async function processPayment() {
    if (!currentPaymentStudent) return;

    const paymentAmount = parseFloat(document.getElementById('paymentAmount').value);
    const paymentMethod = document.getElementById('paymentMethod').value;
    const paymentNote = document.getElementById('paymentNote').value;

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
        alert('Lütfen geçerli bir ödeme tutarı girin!');
        return;
    }

    const totalAmount = currentPaymentStudent.totalAmount || 0;
    const currentPaid = currentPaymentStudent.totalPaid || 0;
    const newTotal = currentPaid + paymentAmount;

    if (newTotal > totalAmount) {
        alert(`Ödeme tutarı fazla! (Maksimum: ₺${(totalAmount - currentPaid).toFixed(2)})`);
        return;
    }

    // Ödeme yöntemi kontrolü
    if (paymentMethod === 'transfer') {
        const receiptFile = document.getElementById('receiptFile');
        if (!receiptFile || !receiptFile.files || receiptFile.files.length === 0) {
            alert('EFT ödemesi için dekont yüklemeniz zorunludur!');
            return;
        }
    } else if (paymentMethod === 'credit') {
        const receiptPhoto = document.getElementById('receiptPhoto');
        if (!receiptPhoto || !receiptPhoto.files || receiptPhoto.files.length === 0) {
            alert('Kredi kartı ödemesi için fatura fotoğrafı yüklemeniz zorunludur!');
            return;
        }
    }

    try {
        // Nakit saati bilgisini ekle (eğer nakit ise)
        let paymentTimestamp = new Date().toISOString();
        if (paymentMethod === 'cash') {
            const hour = document.getElementById('paymentHour').value || new Date().getHours();
            const minute = document.getElementById('paymentMinute').value || new Date().getMinutes();
            const second = document.getElementById('paymentSecond').value || new Date().getSeconds();

            const now = new Date();
            const customTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, second);
            paymentTimestamp = customTime.toISOString();
        }

        const installmentPayment = applyPaymentToInstallments(currentPaymentStudent, paymentAmount, paymentTimestamp);

        // Öğrenci kaydını güncelle
        await db.collection('students').doc(currentPaymentStudent.id).update({
            totalPaid: newTotal,
            installments: installmentPayment.installments
        });

        // Açıklama formatını standardize et
        const standardDescription = `${currentSecretary.name} sekreteri, ${currentPaymentStudent.name} ${currentPaymentStudent.surname} öğrencisinden taksit ödemesi aldı`;

        // Ödeme işlemini ödeme geçmişine kaydet
        const paymentData = {
            studentId: currentPaymentStudent.id,
            studentName: `${currentPaymentStudent.name} ${currentPaymentStudent.surname}`,
            branchId: currentPaymentStudent.branchId || '',
            scheduleId: currentPaymentStudent.scheduleId || '',
            trainerId: currentPaymentStudent.trainerId || '',
            amount: paymentAmount,
            method: paymentMethod,
            note: paymentNote,
            description: standardDescription,
            previousBalance: currentPaid,
            newBalance: newTotal,
            date: paymentTimestamp.split('T')[0],
            timestamp: paymentTimestamp,
            createdBy: currentSecretary.id,
            createdByName: currentSecretary.name,
            adminId: currentAdminId,
            installmentAllocations: installmentPayment.allocations
        };

        // Nakit ödemesi için detaylı saat bilgisi
        if (paymentMethod === 'cash') {
            paymentData.paymentTime = {
                hour: document.getElementById('paymentHour').value || new Date().getHours(),
                minute: document.getElementById('paymentMinute').value || new Date().getMinutes(),
                second: document.getElementById('paymentSecond').value || new Date().getSeconds()
            };
        }

        // Dosya yükleme işlemi (varsa)
        if (paymentMethod === 'transfer' && document.getElementById('receiptFile').files.length > 0) {
            const file = document.getElementById('receiptFile').files[0];
            const reader = new FileReader();
            reader.onload = async (event) => {
                paymentData.receiptData = event.target.result;
                paymentData.receiptFileName = file.name;
                await savePaymentRecord(paymentData);
            };
            reader.readAsDataURL(file);
            return;
        } else if (paymentMethod === 'credit' && document.getElementById('receiptPhoto').files.length > 0) {
            const file = document.getElementById('receiptPhoto').files[0];
            const reader = new FileReader();
            reader.onload = async (event) => {
                paymentData.invoiceData = event.target.result;
                paymentData.invoiceFileName = file.name;
                await savePaymentRecord(paymentData);
            };
            reader.readAsDataURL(file);
            return;
        } else {
            await savePaymentRecord(paymentData);
        }
    } catch (error) {
        alert('Ödeme kaydedilirken hata: ' + error.message);
        console.error('Payment error:', error);
    }
}

// Yardımcı fonksiyon: Ödeme kaydını kaydet
async function savePaymentRecord(paymentData) {
    try {
        await db.collection('payments').add(paymentData);

        const totalAmount = currentPaymentStudent.totalAmount || 0;
        const newTotal = paymentData.newBalance;

        // Başarı mesajı
        alert(`✓ Ödeme başarıyla kaydedildi!\n\nÖğrenci: ${currentPaymentStudent.name} ${currentPaymentStudent.surname}\nÖdeme: ₺${paymentData.amount.toFixed(2)}\nKalan: ₺${(totalAmount - newTotal).toFixed(2)}`);

        // Modal'ı kapat ve listeyi yenile
        closePaymentModal();
        await loadAllData();
        loadStudents();
    } catch (error) {
        alert('Ödeme kaydedilirken hata: ' + error.message);
        console.error('Payment save error:', error);
    }
}

// İndirim kodu uygulama fonksiyonu
async function applyDiscount() {
    const discountCode = document.getElementById('discountCode').value.trim().toUpperCase();

    if (!discountCode) {
        alert('Lütfen indirim kodu girin!');
        return;
    }

    try {
        // Check if discount code exists and is valid
        const discountSnap = await db.collection('discounts')
            .where('code', '==', discountCode)
            .where('adminId', '==', currentAdminId)
            .get();

        if (discountSnap.empty) {
            alert('Geçersiz indirim kodu!');
            return;
        }

        const discountDoc = discountSnap.docs[0];
        const discount = { id: discountDoc.id, ...discountDoc.data() };

        // Check if discount is expired
        const now = new Date();
        const expiryDate = new Date(discount.expiryDate);
        if (expiryDate < now) {
            alert('Bu indirim kodunun süresi dolmuş!');
            return;
        }

        // Check usage limit
        if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
            alert('Bu indirim kodu kullanım limiti dolmuş!');
            return;
        }

        // Get current price
        const monthlyPrice = parseFloat(document.getElementById('monthlyPrice').value);
        if (!monthlyPrice || monthlyPrice <= 0) {
            alert('Önce şube ve ders saati seçin!');
            return;
        }

        // Calculate discounted price
        const discountAmount = (monthlyPrice * discount.percentage) / 100;
        const discountedPrice = monthlyPrice - discountAmount;

        // Update total amount
        document.getElementById('totalAmount').value = discountedPrice.toFixed(2);

        // Update installment amount
        const installmentCount = parseInt(document.getElementById('installmentCount').value) || 1;
        const installmentAmount = discountedPrice / installmentCount;
        document.getElementById('installmentAmount').value = installmentAmount.toFixed(2);
        renderInstallmentPlanInputs();

        // Store discount info
        appliedDiscount = discount;

        // Show discount info
        const discountInfo = document.getElementById('discountInfo');
        const discountDetails = document.getElementById('discountDetails');
        discountDetails.innerHTML = `
            <strong>${discount.code}</strong> - %${discount.percentage} indirim uygulandı.<br>
            Orijinal fiyat: ₺${monthlyPrice.toFixed(2)}<br>
            İndirim: ₺${discountAmount.toFixed(2)}<br>
            Yeni fiyat: ₺${discountedPrice.toFixed(2)}
        `;
        discountInfo.style.display = 'block';

        alert(`✓ İndirim uygulandı! Yeni toplam tutar: ₺${discountedPrice.toFixed(2)}`);

    } catch (error) {
        alert('İndirim kodu kontrol edilirken hata: ' + error.message);
        console.error('Discount apply error:', error);
    }
}

// Arama fonksiyonu
function setupSearch() {
    const searchInput = document.getElementById('studentSearchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const groups = document.querySelectorAll('[id^="group-"]');
        let visibleGroupCount = 0;

        groups.forEach(groupDiv => {
            const rows = groupDiv.parentElement.querySelectorAll('tbody tr');
            let visibleRows = 0;

            rows.forEach(row => {
                const studentName = row.cells[0].textContent.toLowerCase();

                if (searchTerm === '' || studentName.includes(searchTerm)) {
                    row.style.display = '';
                    visibleRows++;
                } else {
                    row.style.display = 'none';
                }
            });

            // Grup başlığını göster/gizle
            const header = groupDiv.previousElementSibling;
            if (visibleRows > 0) {
                header.style.display = '';
                groupDiv.style.display = '';
                visibleGroupCount++;
            } else {
                header.style.display = 'none';
                groupDiv.style.display = 'none';
            }
        });

        // Eğer hiç sonuç yoksa mesaj göster
        if (visibleGroupCount === 0 && searchTerm !== '') {
            const container = document.getElementById('studentsGroupContainer');
            if (!document.getElementById('noResultsMessage')) {
                const msg = document.createElement('div');
                msg.id = 'noResultsMessage';
                msg.style.padding = '20px';
                msg.style.textAlign = 'center';
                msg.style.color = '#666';
                msg.innerHTML = '<p>Arama sonucu bulunamadı.</p>';
                container.appendChild(msg);
            }
        } else {
            const msg = document.getElementById('noResultsMessage');
            if (msg) msg.remove();
        }
    });
}

// ======================== CHAT FUNCTIONS ========================

let activeChatId = null;
let chatUnsub = null;

// Load chat list
async function loadChatList() {
    const container = document.getElementById('chatListContainer');
    if (!container) return;
    container.innerHTML = '<p style="color: #95a5a6;">Yükleniyor...</p>';
    try {
        // Kullanıcının dahil olduğu sohbetleri çek
        const chatsSnap = await db.collection('chats')
            .where('userIds', 'array-contains', currentSecretary.id)
            .get();

        const chats = chatsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));

        if (chats.length === 0) {
            container.innerHTML = '<p style="color: #95a5a6; text-align: center;">Henüz sohbet yok.</p>';
            return;
        }

        let html = '';
        chats.forEach(chat => {
            const chatId = chat.id;
            let title = '';
            let subtitle = '';

            if (chat.type === 'group') {
                title = chat.groupName || 'Grup Sohbeti';
                subtitle = `${chat.userIds.length} üye`;
            } else if (chat.type === 'credit-purchase') {
                // Kredi satın alma sohbeti
                title = 'Kredi Satın Alma';
                subtitle = 'Sistem';
            } else {
                // Direct chat: diğer kullanıcının adını bul
                const otherId = chat.userIds.find(uid => uid !== currentSecretary.id);
                if (chat.users && chat.users[otherId]) {
                    title = chat.users[otherId].name;
                    subtitle = chat.users[otherId].role === 'admin' ? 'Yönetici' :
                              chat.users[otherId].role === 'parent' ? 'Veli' :
                              chat.users[otherId].role === 'trainer' ? 'Antrenör' : 'Kullanıcı';
                } else {
                    title = 'Birebir Sohbet';
                    subtitle = 'Kullanıcı';
                }
            }

            let gearIcon = '';
            if (chat.type === 'group' && (!chat.createdBy || chat.createdBy === currentSecretary.id)) {
                gearIcon = `<button class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation(); openGroupManagement('${chatId}')" style="margin-left: 5px; padding: 2px 6px; font-size: 12px;" title="Grup Yönetimi">⚙️</button>`;
            }

            html += `<div class="chat-list-item" style="padding:12px; border-bottom:1px solid #eee; cursor:pointer; transition: background 0.2s;" onclick="openChatView('${chatId}', '${title.replace(/'/g, '\\\'')}')">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <strong style="color: #2c3e50;">${title}</strong>${gearIcon}<br>
                        <small style="color: #7f8c8d;">${subtitle}</small>
                    </div>
                    <div style="font-size: 12px; color: #95a5a6;">
                        ${new Date(chat.createdAt).toLocaleDateString('tr-TR')}
                    </div>
                </div>
            </div>`;
        });

        container.innerHTML = html;
    } catch (error) {
        console.error('Sohbetler yüklenirken hata:', error);
        container.innerHTML = '<p style="color: #e74c3c;">Sohbetler yüklenemedi.</p>';
    }
}

// Open chat view
function openChatView(chatId, title) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.getElementById('chat-view-page').classList.add('active');
    document.getElementById('chatViewTitle').textContent = title || 'Sohbet';
    activeChatId = chatId;
    loadChatMessages(chatId);
    document.getElementById('chatForm').onsubmit = sendChatMessage;
}

// Close chat view
function closeChatView() {
    document.getElementById('chat-view-page').classList.remove('active');
    document.getElementById('chatMessages').innerHTML = '';
    activeChatId = null;
    if (chatUnsub) chatUnsub();
    switchPage('chat');
}

// Load chat messages
async function loadChatMessages(chatId) {
    try {
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.innerHTML = '<p style="color: #95a5a6; text-align: center;">Mesajlar yükleniyor...</p>';

        // Set up real-time listener for messages
        chatUnsub = db.collection('chats').doc(chatId).collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot((snapshot) => {
                const messages = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));

                if (messages.length === 0) {
                    messagesContainer.innerHTML = '<p style="color: #95a5a6; text-align: center;">Henüz mesaj yok.</p>';
                    return;
                }

                let html = '';
                messages.forEach(message => {
                    const isOwnMessage = message.senderId === currentSecretary.id;
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
        document.getElementById('chatMessages').innerHTML = '<p style="color: #e74c3c; text-align: center;">Mesajlar yüklenemedi.</p>';
    }
}

// Send chat message
async function sendChatMessage(e) {
    e.preventDefault();

    const messageInput = document.getElementById('chatInput');
    const messageText = messageInput.value.trim();

    if (!messageText || !activeChatId) return;

    try {
        await db.collection('chats').doc(activeChatId).collection('messages').add({
            text: messageText,
            senderId: currentSecretary.id,
            senderName: currentSecretary.name,
            timestamp: new Date().toISOString()
        });

        messageInput.value = '';
    } catch (error) {
        console.error('Mesaj gönderilirken hata:', error);
        alert('Mesaj gönderilemedi: ' + error.message);
    }
}

// Open new chat email page
function openNewChatEmailPage() {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.getElementById('new-chat-email-page').classList.add('active');
    document.getElementById('newChatEmailForm').onsubmit = submitNewChatByEmail;
    document.getElementById('chatEmailInput').oninput = chatEmailLookupUser;
    document.getElementById('chatEmailUserInfo').textContent = '';
}

// Close new chat email page
function closeNewChatEmailPage() {
    document.getElementById('new-chat-email-page').classList.remove('active');
    document.getElementById('newChatEmailForm').reset();
    document.getElementById('chatEmailUserInfo').textContent = '';
    switchPage('chat');
}

// Chat email lookup user
async function chatEmailLookupUser(e) {
    const email = e.target.value.trim().toLowerCase();
    const infoDiv = document.getElementById('chatEmailUserInfo');
    infoDiv.textContent = '';
    if (!email) return;
    // Lookup user by email (trainers, admins, parents)
    let userDoc = null, userName = null, userRole = null;
    const collections = [
        { col: 'trainers', role: 'Antrenör' },
        { col: 'admins', role: 'Yönetici' },
        { col: 'parents', role: 'Veli' }
    ];
    for (const { col, role } of collections) {
        const snap = await db.collection(col).where('email', '==', email).limit(1).get();
        if (!snap.empty) {
            userDoc = snap.docs[0];
            userName = userDoc.data().name || userDoc.data().fullName || email;
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
async function submitNewChatByEmail(e) {
    if (e) e.preventDefault();
    const emailInput = document.getElementById('chatEmailInput');
    const email = emailInput.value.trim().toLowerCase();
    if (!email) {
        alert('Lütfen bir e-posta giriniz!');
        return;
    }
    // Lookup user by email (trainers, admins, parents)
    let userDoc = null, userId = null, userName = null, userRole = null;
    const collections = [
        { col: 'trainers', role: 'trainer' },
        { col: 'admins', role: 'admin' },
        { col: 'parents', role: 'parent' }
    ];
    for (const { col, role } of collections) {
        const snap = await db.collection(col).where('email', '==', email).limit(1).get();
        if (!snap.empty) {
            userDoc = snap.docs[0];
            userId = userDoc.id;
            userName = userDoc.data().name || userDoc.data().fullName || email;
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
        .where('userIds', 'array-contains', currentSecretary.id)
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
            userIds: [currentSecretary.id, userId],
            users: {
                [currentSecretary.id]: { name: currentSecretary.name, role: 'secretary' },
                [userId]: { name: userName, role: userRole }
            },
            type: 'direct',
            createdAt: new Date().toISOString()
        });
        chatId = chatDoc.id;
    }
    openChatView(chatId, userName);
}

// Open new group chat modal
function openNewGroupChatModal() {
    // Show the group chat modal
    document.getElementById('newGroupChatModal').style.display = 'flex';
    document.getElementById('newGroupChatForm').onsubmit = submitNewGroupChat;
}

// Close new group chat modal
function closeNewGroupChatModal() {
    document.getElementById('newGroupChatModal').style.display = 'none';
    document.getElementById('newGroupChatForm').reset();
}

// Submit new group chat
async function submitNewGroupChat(e) {
    e.preventDefault();
    const groupNameInput = document.getElementById('groupChatName');
    const userEmailsInput = document.getElementById('groupChatUserEmails') || document.getElementById('groupChatUserIds');
    const groupName = groupNameInput.value.trim();
    const emailsRaw = userEmailsInput.value.trim();
    if (!groupName || !emailsRaw) {
        alert('Lütfen grup adı ve e-posta adreslerini giriniz!');
        return;
    }
    // E-posta adreslerini ayıkla ve doğrula
    const emails = emailsRaw.split(',').map(e=>e.trim().toLowerCase()).filter(e=>e);
    if (emails.length === 0) {
        alert('En az bir e-posta adresi giriniz!');
        return;
    }
    // Kendi e-postanızı da ekleyin
    if (!emails.includes(currentSecretary.email)) emails.push(currentSecretary.email);
    // Her e-posta için Firestore'dan kullanıcıyı bul
    const userIds = [];
    const users = {};
    for (const email of emails) {
        let found = false;
        for (const { col, role } of [
            { col: 'trainers', role: 'trainer' },
            { col: 'admins', role: 'admin' },
            { col: 'parents', role: 'parent' }
        ]) {
            const snap = await db.collection(col).where('email', '==', email).limit(1).get();
            if (!snap.empty) {
                const doc = snap.docs[0];
                userIds.push(doc.id);
                users[doc.id] = { name: doc.data().name || doc.data().fullName || email, role, email };
                found = true;
                break;
            }
        }
        if (!found) {
            alert(`Kullanıcı bulunamadı: ${email}`);
            return;
        }
    }
    // Grup sohbeti oluştur
    const chatDoc = await db.collection('chats').add({
        userIds,
        userEmails: emails,
        users,
        type: 'group',
        groupName,
        createdBy: currentSecretary.id,
        createdAt: new Date().toISOString()
    });
    closeNewGroupChatModal();
    openChatView(chatDoc.id, groupName);
}

// Group management functions (simplified for secretary)
function openGroupManagement() {
    // For now, just alert - can be expanded later
    alert('Grup yönetimi özelliği yakında eklenecek.');
}

window.addEventListener('beforeunload', () => {
    if (clubApplicationsUnsub) {
        try {
            clubApplicationsUnsub();
        } catch (error) {
            console.warn('Ön kayıt dinleyicisi kapatılamadı:', error);
        }
        clubApplicationsUnsub = null;
    }
});

// Make functions global
window.copyPreRegistrationLink = copyPreRegistrationLink;
window.copyPreRegistrationShareMessage = copyPreRegistrationShareMessage;
window.openPreRegistrationLink = openPreRegistrationLink;
window.rotatePreRegistrationLink = rotatePreRegistrationLink;
window.transferClubApplicationToForm = transferClubApplicationToForm;
window.rejectClubApplication = rejectClubApplication;
window.loadChatList = loadChatList;
window.openChatView = openChatView;
window.closeChatView = closeChatView;
window.loadChatMessages = loadChatMessages;
window.sendChatMessage = sendChatMessage;
window.openNewChatEmailPage = openNewChatEmailPage;
window.closeNewChatEmailPage = closeNewChatEmailPage;
window.chatEmailLookupUser = chatEmailLookupUser;
window.submitNewChatByEmail = submitNewChatByEmail;
window.openNewGroupChatModal = openNewGroupChatModal;
window.closeNewGroupChatModal = closeNewGroupChatModal;
window.submitNewGroupChat = submitNewGroupChat;
window.openGroupManagement = openGroupManagement;
