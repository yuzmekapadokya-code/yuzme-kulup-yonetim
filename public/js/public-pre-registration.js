const PUBLIC_CLUB_PROFILES_COLLECTION = 'clubProfiles';
const PUBLIC_CLUB_APPLICATIONS_COLLECTION = 'club_applications';

let publicRegistrationContext = null;

function setPublicRegistrationStatus(message, type = 'info') {
    const status = document.getElementById('preRegistrationStatus');
    if (!status) return;
    status.className = `pre-registration-status ${type} visible`;
    status.textContent = message;
}

function getPublicRegistrationToken() {
    return new URLSearchParams(window.location.search).get('token') || '';
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
    return {
        adminId: profileDoc.id,
        clubName: profileData.name || 'Kulup on kayit formu',
        token
    };
}

function fillPublicRegistrationHeader() {
    if (!publicRegistrationContext) return;

    const title = document.getElementById('preRegistrationTitle');
    const description = document.getElementById('preRegistrationDescription');
    if (title) {
        title.textContent = `${publicRegistrationContext.clubName} on kayit formu`;
    }
    if (description) {
        description.textContent = 'Bilgilerinizi gonderin. Basvurunuz sekreter ekranina duser; uygun grup, odeme plani ve antrenor atamasi kulup ekibi tarafindan tamamlanir.';
    }
}

function getPublicRegistrationPayload() {
    const installmentPreference = document.getElementById('publicInstallmentCount').value;
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
        note: document.getElementById('publicApplicationNote').value.trim()
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
        setPublicRegistrationStatus('Form hazir. Bilgileri doldurup basvurunuzu gonderebilirsiniz.', 'info');
    } catch (error) {
        setPublicRegistrationStatus(error.message, 'error');
    }
}

window.addEventListener('load', initPublicPreRegistrationPage);