const PUBLIC_CLUB_PROFILES_COLLECTION = 'clubProfiles';
const PUBLIC_CLUB_APPLICATIONS_COLLECTION = 'club_applications';
const PUBLIC_BRANCHES_COLLECTION = 'branches';

let publicRegistrationContext = null;
let publicAvailableBranches = [];

function setPublicRegistrationStatus(message, type = 'info') {
    const status = document.getElementById('preRegistrationStatus');
    if (!status) return;
    status.className = `pre-registration-status ${type} visible`;
    status.textContent = message;
}

function getPublicRegistrationToken() {
    return new URLSearchParams(window.location.search).get('token') || '';
}

function getPublicClubHelpers() {
    return window.ClubProfileHelpers || null;
}

async function tryEnsureAnonymousAccess() {
    if (!window.auth || auth.currentUser) {
        return auth?.currentUser || null;
    }

    try {
        const credential = await auth.signInAnonymously();
        return credential.user;
    } catch (error) {
        console.warn('Anonymous access saglanamadi:', error);
        return null;
    }
}

async function loadPublicRegistrationContext(token) {
    const snapshot = await db.collection(PUBLIC_CLUB_PROFILES_COLLECTION)
        .where('leadFormToken', '==', token)
        .limit(1)
        .get();

    if (snapshot.empty) {
        throw new Error('Bu on kayit linki aktif degil veya suresi dolmus.');
    }

    const profileDoc = snapshot.docs[0];
    const profileData = profileDoc.data() || {};
    const helpers = getPublicClubHelpers();
    const settings = helpers?.getLeadFormSettings
        ? helpers.getLeadFormSettings(profileData)
        : (profileData.leadFormSettings || {});

    const clubName = helpers?.getClubDisplayName
        ? helpers.getClubDisplayName(profileData)
        : String(profileData.clubName || profileData.name || 'Kulup').trim();

    const fallbackLogo = helpers?.getClubLogoUrl
        ? helpers.getClubLogoUrl(profileData)
        : String(profileData.logoUrl || '').trim();

    return {
        adminId: profileDoc.id,
        clubName,
        token,
        settings,
        logoUrl: String(settings.logoUrl || fallbackLogo || '').trim(),
        videoEmbedUrl: String(settings.videoEmbedUrl || '').trim()
    };
}

function applyPublicRegistrationBranding() {
    if (!publicRegistrationContext) {
        return;
    }

    const settings = publicRegistrationContext.settings || {};
    const accent = settings.accentColor || '#0b7ea8';
    const root = document.documentElement;
    root.style.setProperty('--pre-reg-accent', accent);
    root.style.setProperty('--pre-reg-accent-soft', `${accent}1a`);

    const eyebrow = document.getElementById('preRegistrationEyebrow');
    const title = document.getElementById('preRegistrationTitle');
    const description = document.getElementById('preRegistrationDescription');
    const logoWrap = document.getElementById('preRegistrationLogoWrap');
    const logoImage = document.getElementById('preRegistrationLogo');
    const videoWrap = document.getElementById('preRegistrationVideoWrap');
    const videoFrame = document.getElementById('preRegistrationVideo');

    if (eyebrow) {
        eyebrow.textContent = settings.eyebrowText || 'On kayit formu';
    }

    const titleText = settings.title || `${publicRegistrationContext.clubName} on kayit formu`;
    if (title) {
        title.textContent = titleText;
    }

    if (description) {
        description.textContent = settings.description
            || 'Bilgilerinizi gonderin. Basvurunuz sekreter ekranina duser; uygun grup, odeme plani ve antrenor atamasi kulup ekibi tarafindan tamamlanir.';
    }

    if (logoWrap && logoImage) {
        if (publicRegistrationContext.logoUrl) {
            logoImage.src = publicRegistrationContext.logoUrl;
            logoWrap.style.display = 'flex';
        } else {
            logoWrap.style.display = 'none';
            logoImage.removeAttribute('src');
        }
    }

    if (videoWrap && videoFrame) {
        if (publicRegistrationContext.videoEmbedUrl) {
            videoFrame.src = publicRegistrationContext.videoEmbedUrl;
            videoWrap.style.display = 'block';
        } else {
            videoWrap.style.display = 'none';
            videoFrame.removeAttribute('src');
        }
    }
}

function fillPublicRegistrationHeader() {
    applyPublicRegistrationBranding();
}

async function loadPublicRegistrationBranches(adminId) {
    if (!adminId || !window.db) {
        return [];
    }
    try {
        const snapshot = await db.collection(PUBLIC_BRANCHES_COLLECTION)
            .where('adminId', '==', adminId)
            .get();
        return snapshot.docs
            .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
            .filter(item => item && (item.name || item.title))
            .sort((left, right) => String(left.name || left.title || '').localeCompare(String(right.name || right.title || ''), 'tr'));
    } catch (error) {
        console.warn('On kayit subeleri yuklenemedi:', error);
        return [];
    }
}

function populatePublicBranchSelect(branches) {
    const select = document.getElementById('publicBranchSelect');
    const hint = document.getElementById('publicBranchHint');
    if (!select) {
        return;
    }

    select.innerHTML = '<option value="">-- Şube Seçiniz --</option>';

    if (!Array.isArray(branches) || branches.length === 0) {
        if (hint) {
            hint.textContent = 'Kulup henuz sube tanimlamadigi icin sube seciminden gecebilirsiniz. Kayit ekibi size en uygun yeri bildirecektir.';
        }
        return;
    }

    branches.forEach(branch => {
        const option = document.createElement('option');
        option.value = branch.id;
        const branchName = String(branch.name || branch.title || '').trim() || 'Sube';
        const district = String(branch.district || branch.city || '').trim();
        option.textContent = district ? `${branchName} – ${district}` : branchName;
        option.dataset.branchName = branchName;
        select.appendChild(option);
    });

    if (hint) {
        hint.textContent = 'Tercih ettiginiz subeyi seciniz. Kulup ekibi nihai onayi sizinle netlestirecektir.';
    }
}

function getSelectedPublicLessonType() {
    const checked = document.querySelector('input[name="publicLessonType"]:checked');
    return checked ? checked.value : 'group';
}

function applyPublicLessonTypeVisibility() {
    const lessonType = getSelectedPublicLessonType();
    const branchGroup = document.getElementById('publicBranchGroup');
    const branchSelect = document.getElementById('publicBranchSelect');
    const labels = document.querySelectorAll('#publicLessonTypeRow label[data-lesson-type]');

    labels.forEach(label => {
        label.classList.toggle('is-active', label.dataset.lessonType === lessonType);
    });

    if (branchGroup) {
        if (lessonType === 'group') {
            branchGroup.hidden = false;
        } else {
            branchGroup.hidden = true;
        }
    }

    if (branchSelect) {
        if (lessonType === 'group' && publicAvailableBranches.length > 0) {
            branchSelect.required = true;
        } else {
            branchSelect.required = false;
            if (lessonType !== 'group') {
                branchSelect.value = '';
            }
        }
    }
}

function bindPublicLessonTypeToggle() {
    const radios = document.querySelectorAll('input[name="publicLessonType"]');
    radios.forEach(radio => {
        radio.addEventListener('change', applyPublicLessonTypeVisibility);
    });
    applyPublicLessonTypeVisibility();
}

function getPublicRegistrationPayload() {
    const installmentPreference = document.getElementById('publicInstallmentCount').value;
    const lessonType = getSelectedPublicLessonType();
    const branchSelect = document.getElementById('publicBranchSelect');
    const selectedBranchId = lessonType === 'group' ? (branchSelect?.value || '') : '';
    const selectedBranchName = selectedBranchId
        ? (publicAvailableBranches.find(item => item.id === selectedBranchId)?.name || '')
        : '';

    return {
        studentName: document.getElementById('publicStudentName').value.trim(),
        studentSurname: document.getElementById('publicStudentSurname').value.trim(),
        birthYear: Number(document.getElementById('publicBirthYear').value || 0),
        gender: document.getElementById('publicGender').value,
        studentPhone: document.getElementById('publicStudentPhone').value.trim(),
        installmentPreference,
        installmentCount: installmentPreference === 'cash' ? 1 : Number(installmentPreference || 0),
        parentName: document.getElementById('publicParentName').value.trim(),
        parentEmail: document.getElementById('publicParentEmail').value.trim(),
        parentPhone: document.getElementById('publicParentPhone').value.trim(),
        requestedParentPassword: document.getElementById('publicParentPassword').value,
        address: document.getElementById('publicAddress').value.trim(),
        paymentMethodPreference: document.getElementById('publicPaymentMethodPreference').value,
        note: document.getElementById('publicApplicationNote').value.trim(),
        lessonType,
        lessonTypeLabel: lessonType === 'group' ? 'Grup Dersi' : 'Özel Ders',
        requestedBranchId: selectedBranchId,
        requestedBranchName: selectedBranchName
    };
}

function validatePublicRegistrationPayload(payload) {
    if (!payload.studentName || !payload.studentSurname) {
        throw new Error('Ogrenci adi ve soyadi zorunludur.');
    }
    if (!payload.birthYear || payload.birthYear < 1990 || payload.birthYear > 2035) {
        throw new Error('Lutfen gecerli bir dogum yili giriniz.');
    }
    if (!payload.gender) {
        throw new Error('Lutfen cinsiyet seciniz.');
    }
    if (!payload.parentEmail) {
        throw new Error('Veli e-mail alani zorunludur.');
    }
    if (!payload.requestedParentPassword || payload.requestedParentPassword.length < 6) {
        throw new Error('Veli sifresi en az 6 karakter olmalidir.');
    }
    if (payload.requestedParentPassword !== document.getElementById('publicParentPasswordConfirm').value) {
        throw new Error('Veli sifre alanlari eslesmiyor.');
    }
    if (!payload.paymentMethodPreference) {
        throw new Error('Lutfen odeme tercihini seciniz.');
    }
    if (!payload.installmentPreference) {
        throw new Error('Lutfen odeme dusuncenizi seciniz.');
    }
    if (payload.lessonType !== 'group' && payload.lessonType !== 'private') {
        throw new Error('Lutfen ders turunu (Grup ya da Ozel) seciniz.');
    }
    if (payload.lessonType === 'group' && publicAvailableBranches.length > 0 && !payload.requestedBranchId) {
        throw new Error('Grup dersi icin lutfen tercih ettiginiz subeyi seciniz.');
    }
}

async function submitPublicPreRegistration(event) {
    event.preventDefault();

    const submitButton = document.getElementById('publicPreRegistrationSubmit');
    const form = document.getElementById('publicPreRegistrationForm');

    try {
        if (!publicRegistrationContext) {
            throw new Error('On kayit formu henuz hazir degil.');
        }

        const payload = getPublicRegistrationPayload();
        validatePublicRegistrationPayload(payload);
        submitButton.disabled = true;
        setPublicRegistrationStatus('Basvurunuz gonderiliyor...', 'info');

        await tryEnsureAnonymousAccess();

        await db.collection(PUBLIC_CLUB_APPLICATIONS_COLLECTION).add({
            ...payload,
            adminId: publicRegistrationContext.adminId,
            clubName: publicRegistrationContext.clubName,
            status: 'pending',
            source: 'hidden-link-form',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        form.reset();
        setPublicRegistrationStatus('Basvurunuz alindi. Kulup ekibi inceleyip sizinle iletisime gececektir.', 'success');
    } catch (error) {
        const isPermissionError = error?.code === 'permission-denied' || error?.code === 'auth/operation-not-allowed';
        setPublicRegistrationStatus(
            isPermissionError
                ? 'Basvuru gonderilemedi. Firebase tarafinda anonim erisim veya bu forma yazma izni acik olmalidir.'
                : `Basvuru gonderilemedi: ${error.message}`,
            'error'
        );
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
        }
    }
}

async function initPublicPreRegistrationPage() {
    const token = getPublicRegistrationToken().trim();
    const form = document.getElementById('publicPreRegistrationForm');

    if (!token) {
        setPublicRegistrationStatus('Bu on kayit linki gecersiz. Linkte token bilgisi bulunamadi.', 'error');
        return;
    }

    try {
        setPublicRegistrationStatus('Kulup bilgileri kontrol ediliyor...', 'info');
        publicRegistrationContext = await loadPublicRegistrationContext(token);
        fillPublicRegistrationHeader();
        form.style.display = 'block';
        form.addEventListener('submit', submitPublicPreRegistration);
        bindPublicLessonTypeToggle();
        setPublicRegistrationStatus('Subeler yukleniyor...', 'info');

        // Subeleri okumak icin anonim oturum gerekebilir.
        await tryEnsureAnonymousAccess();
        publicAvailableBranches = await loadPublicRegistrationBranches(publicRegistrationContext.adminId);
        populatePublicBranchSelect(publicAvailableBranches);
        applyPublicLessonTypeVisibility();

        setPublicRegistrationStatus('Form hazir. Bilgileri doldurup basvurunuzu gonderebilirsiniz.', 'info');
    } catch (error) {
        setPublicRegistrationStatus(error.message, 'error');
    }
}

window.addEventListener('load', initPublicPreRegistrationPage);
