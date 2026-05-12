(function () {
    let profileModalReady = false;
    let loadedProfile = null;

    function getCurrentSessionUser() {
        return {
            id: sessionStorage.getItem('user_id') || '',
            role: sessionStorage.getItem('user_role') || '',
            name: sessionStorage.getItem('user_name') || 'Kullanıcı',
            email: sessionStorage.getItem('user_email') || ''
        };
    }

    function getRoleLabel(role) {
        const labels = {
            parent: 'Veli',
            trainer: 'Antrenör',
            admin: 'Yönetici',
            superadmin: 'Süper Admin',
            secretary: 'Sekreter'
        };
        return labels[role] || 'Kullanıcı';
    }

    function normalizeEmail(value) {
        return String(value || '').trim().toLowerCase();
    }

    function getDeleteFieldValue() {
        return firebase && firebase.firestore && firebase.firestore.FieldValue
            ? firebase.firestore.FieldValue.delete()
            : undefined;
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function ensureProfileButton() {
        const userInfo = document.querySelector('.user-info');
        if (!userInfo || document.getElementById('profileSettingsBtn')) return;
        const button = document.createElement('button');
        button.id = 'profileSettingsBtn';
        button.type = 'button';
        button.className = 'btn btn-info btn-sm';
        button.textContent = 'Profil Ayarları';
        button.style.marginRight = '10px';
        button.addEventListener('click', () => openProfileSettingsModal());
        const avatar = document.getElementById('userAvatar');
        userInfo.insertBefore(button, avatar || userInfo.lastElementChild || null);
    }

    function renderHeaderAvatar(name, photoUrl) {
        const avatar = document.getElementById('userAvatar');
        if (!avatar) return;
        avatar.style.overflow = 'hidden';
        avatar.style.display = 'flex';
        avatar.style.alignItems = 'center';
        avatar.style.justifyContent = 'center';
        if (photoUrl) {
            avatar.innerHTML = '<img src="' + escapeHtml(photoUrl) + '" alt="' + escapeHtml(name || 'Profil') + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
        } else {
            avatar.textContent = String(name || '?').charAt(0).toUpperCase();
        }
    }

    async function loadCurrentProfile() {
        const currentUser = getCurrentSessionUser();
        if (!currentUser.id || !window.db) return null;

        let data = {};
        const userDoc = await db.collection('users').doc(currentUser.id).get();
        if (userDoc.exists) {
            data = userDoc.data() || {};
        }

        if ((!data || !Object.keys(data).length) && currentUser.role === 'trainer') {
            const trainerDoc = await db.collection('trainers').doc(currentUser.id).get();
            if (trainerDoc.exists) {
                data = trainerDoc.data() || {};
            }
        }

        loadedProfile = {
            id: currentUser.id,
            role: currentUser.role,
            name: data.name || currentUser.name,
            email: data.email || currentUser.email,
            photoUrl: data.photoUrl || data.profilePhoto || '',
            profilePhoto: data.profilePhoto || data.photoUrl || '',
            pendingEmail: data.pendingEmail || ''
        };
        return loadedProfile;
    }

    function setProfileMessage(message, tone) {
        const box = document.getElementById('profileSettingsMessage');
        if (!box) return;
        box.textContent = message || '';
        box.style.color = tone === 'error' ? '#c0392b' : (tone === 'success' ? '#1f7a3e' : '#5f6c7b');
    }

    function fillProfileModal(profile) {
        if (!profile) return;
        const preview = document.getElementById('profileSettingsPhotoPreview');
        const nameEl = document.getElementById('profileSettingsName');
        const emailEl = document.getElementById('profileSettingsCurrentEmail');
        const roleEl = document.getElementById('profileSettingsRole');
        const newEmailInput = document.getElementById('profileSettingsNewEmail');
        const fileInput = document.getElementById('profileSettingsPhotoInput');

        if (preview) {
            preview.innerHTML = profile.photoUrl
                ? '<img src="' + escapeHtml(profile.photoUrl) + '" alt="Profil" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'
                : '<span style="font-size:40px; font-weight:700; color:#274057;">' + escapeHtml(String(profile.name || '?').charAt(0).toUpperCase()) + '</span>';
        }
        if (nameEl) nameEl.textContent = profile.name || '-';
        if (emailEl) emailEl.textContent = profile.email || '-';
        if (roleEl) roleEl.textContent = getRoleLabel(profile.role);
        if (newEmailInput) newEmailInput.value = profile.email || '';
        if (fileInput) fileInput.value = '';
        ['profileSettingsEmailPassword', 'profileSettingsCurrentPassword', 'profileSettingsNewPassword', 'profileSettingsConfirmPassword'].forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });
        setProfileMessage('');
    }

    function ensureProfileModal() {
        if (profileModalReady) return;
        const modal = document.createElement('div');
        modal.id = 'profileSettingsModal';
        modal.className = 'modal';
        modal.style.display = 'none';
        modal.innerHTML = ''
            + '<div class="modal-content" style="max-width:760px;">'
            + '<div class="modal-header"><h2>Profil Ayarları</h2><button class="close-btn" type="button" onclick="closeProfileSettingsModal()">&times;</button></div>'
            + '<div style="display:grid; grid-template-columns: minmax(220px, 260px) 1fr; gap:20px;">'
            + '<div style="padding:16px; border:1px solid #d8e2eb; border-radius:14px; background:#f9fbfd;">'
            + '<div id="profileSettingsPhotoPreview" style="width:120px; height:120px; border-radius:50%; overflow:hidden; background:#e8eef5; margin:0 auto 16px; display:flex; align-items:center; justify-content:center;"></div>'
            + '<div style="text-align:center; margin-bottom:8px; font-weight:700; color:#274057;" id="profileSettingsName">-</div>'
            + '<div style="text-align:center; color:#607080; margin-bottom:6px;" id="profileSettingsCurrentEmail">-</div>'
            + '<div style="text-align:center; color:#607080; margin-bottom:16px;" id="profileSettingsRole">-</div>'
            + '<div class="form-group"><label>Profil Fotoğrafı</label><input type="file" id="profileSettingsPhotoInput" accept="image/*"></div>'
            + '<button type="button" class="btn btn-success" id="profileSettingsSavePhotoBtn" style="width:100%;">Fotoğrafı Güncelle</button>'
            + '</div>'
            + '<div style="display:flex; flex-direction:column; gap:18px;">'
            + '<div style="padding:16px; border:1px solid #d8e2eb; border-radius:14px; background:#fff;">'
            + '<h3 style="margin-top:0;">E-posta Değiştir</h3>'
            + '<div class="form-group"><label>Yeni E-posta</label><input type="email" id="profileSettingsNewEmail"></div>'
            + '<div class="form-group"><label>Mevcut Şifre</label><input type="password" id="profileSettingsEmailPassword"></div>'
            + '<button type="button" class="btn btn-info" id="profileSettingsSaveEmailBtn">E-postayı Güncelle</button>'
            + '</div>'
            + '<div style="padding:16px; border:1px solid #d8e2eb; border-radius:14px; background:#fff;">'
            + '<h3 style="margin-top:0;">Şifre Değiştir</h3>'
            + '<div class="form-group"><label>Mevcut Şifre</label><input type="password" id="profileSettingsCurrentPassword"></div>'
            + '<div class="form-group"><label>Yeni Şifre</label><input type="password" id="profileSettingsNewPassword" minlength="6"></div>'
            + '<div class="form-group"><label>Yeni Şifre Tekrar</label><input type="password" id="profileSettingsConfirmPassword" minlength="6"></div>'
            + '<button type="button" class="btn btn-info" id="profileSettingsSavePasswordBtn">Şifreyi Güncelle</button>'
            + '</div>'
            + '<div id="profileSettingsMessage" style="font-size:0.95rem; min-height:24px; color:#5f6c7b;"></div>'
            + '</div>'
            + '</div>'
            + '</div>';
        document.body.appendChild(modal);

        modal.addEventListener('click', event => {
            if (event.target === modal) {
                closeProfileSettingsModal();
            }
        });

        document.getElementById('profileSettingsSavePhotoBtn').addEventListener('click', saveProfilePhoto);
        document.getElementById('profileSettingsSaveEmailBtn').addEventListener('click', saveProfileEmail);
        document.getElementById('profileSettingsSavePasswordBtn').addEventListener('click', saveProfilePassword);
        document.getElementById('profileSettingsPhotoInput').addEventListener('change', previewSelectedPhoto);
        profileModalReady = true;
    }

    function previewSelectedPhoto(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const preview = document.getElementById('profileSettingsPhotoPreview');
            if (preview) {
                preview.innerHTML = '<img src="' + escapeHtml(reader.result) + '" alt="Profil" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
            }
        };
        reader.readAsDataURL(file);
    }

    async function getAuthenticatedUser(passwordForFallback) {
        const authInstance = window.auth || auth;
        if (!authInstance) {
            throw new Error('Kimlik doğrulama servisi hazır değil.');
        }
        if (authInstance.currentUser) {
            return authInstance.currentUser;
        }

        const sessionUser = getCurrentSessionUser();
        if (sessionUser.email && passwordForFallback) {
            try {
                const credential = await authInstance.signInWithEmailAndPassword(sessionUser.email, passwordForFallback);
                if (credential && credential.user) {
                    return credential.user;
                }
            } catch (error) {
                console.warn('Fallback sign-in başarısız:', error.message);
            }
        }

        return new Promise((resolve, reject) => {
            let settled = false;
            const timeoutId = window.setTimeout(() => {
                if (settled) return;
                settled = true;
                if (typeof unsubscribe === 'function') unsubscribe();
                reject(new Error('Aktif kullanıcı oturumu bulunamadı. Lütfen sayfayı yenileyip tekrar deneyin.'));
            }, 5000);

            const unsubscribe = authInstance.onAuthStateChanged(user => {
                if (settled || !user) return;
                settled = true;
                window.clearTimeout(timeoutId);
                unsubscribe();
                resolve(user);
            }, error => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeoutId);
                reject(error);
            });
        });
    }

    async function reauthenticateUser(password) {
        const user = await getAuthenticatedUser(password);
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
        await user.reauthenticateWithCredential(credential);
        return user;
    }

    async function updateRoleCollectionProfile(profileData) {
        const currentUser = getCurrentSessionUser();
        if (currentUser.role === 'trainer') {
            await db.collection('trainers').doc(currentUser.id).set(profileData, { merge: true });
        }
    }

    async function persistVerifiedEmail(profile, previousEmail) {
        const currentUser = getCurrentSessionUser();
        const deleteField = getDeleteFieldValue();
        const userUpdate = {
            email: profile.email,
            emailChangeRequestedAt: deleteField,
            updatedAt: new Date().toISOString()
        };
        if (deleteField !== undefined) {
            userUpdate.pendingEmail = deleteField;
        }
        await db.collection('users').doc(currentUser.id).set(userUpdate, { merge: true });
        await updateRoleCollectionProfile(userUpdate);
        await syncProfileIntoChats(profile, previousEmail);
        applySessionProfile(profile);
    }

    async function reconcileEmailAfterVerification(profile) {
        const authInstance = window.auth || auth;
        const authUser = authInstance && authInstance.currentUser ? authInstance.currentUser : null;
        if (!profile || !authUser || !normalizeEmail(authUser.email)) {
            return profile;
        }

        const currentEmail = normalizeEmail(profile.email);
        const verifiedEmail = normalizeEmail(authUser.email);
        const pendingEmail = normalizeEmail(profile.pendingEmail);
        if (verifiedEmail === currentEmail && (!pendingEmail || pendingEmail === currentEmail)) {
            return profile;
        }

        const nextProfile = {
            ...profile,
            email: authUser.email,
            pendingEmail: ''
        };
        await persistVerifiedEmail(nextProfile, profile.email || currentEmail);
        return nextProfile;
    }

    async function syncProfileIntoChats(nextProfile, previousEmail) {
        const currentUser = getCurrentSessionUser();
        if (!currentUser.id) return;
        const snapshot = await db.collection('chats').where('userIds', 'array-contains', currentUser.id).get();
        if (snapshot.empty) return;

        for (let index = 0; index < snapshot.docs.length; index += 250) {
            const batch = db.batch();
            snapshot.docs.slice(index, index + 250).forEach(doc => {
                const data = doc.data() || {};
                const nextEmails = Array.isArray(data.userEmails)
                    ? data.userEmails.map(email => String(email || '').trim().toLowerCase() === String(previousEmail || '').trim().toLowerCase() ? nextProfile.email : email)
                    : undefined;
                const updates = {
                    [`users.${currentUser.id}.name`]: nextProfile.name,
                    [`users.${currentUser.id}.email`]: nextProfile.email,
                    [`users.${currentUser.id}.photoUrl`]: nextProfile.photoUrl || '',
                    updatedAt: new Date().toISOString()
                };
                if (nextEmails) {
                    updates.userEmails = Array.from(new Set(nextEmails.filter(Boolean)));
                }
                batch.set(doc.ref, updates, { merge: true });
            });
            await batch.commit();
        }
    }

    function applySessionProfile(nextProfile) {
        if (!nextProfile) return;
        sessionStorage.setItem('user_email', nextProfile.email || '');
        sessionStorage.setItem('user_name', nextProfile.name || 'Kullanıcı');
        loadedProfile = nextProfile;
        renderHeaderAvatar(nextProfile.name, nextProfile.photoUrl);
        const nameTargets = ['userName', 'saName', 'profileName'];
        nameTargets.forEach(id => {
            const element = document.getElementById(id);
            if (element && nextProfile.name) element.textContent = nextProfile.name;
        });
        const profileEmail = document.getElementById('profileEmail');
        if (profileEmail) profileEmail.textContent = nextProfile.email || '-';
        fillProfileModal(nextProfile);
        window.dispatchEvent(new CustomEvent('app-profile-updated', {
            detail: {
                userId: nextProfile.id,
                name: nextProfile.name,
                email: nextProfile.email,
                photoUrl: nextProfile.photoUrl || ''
            }
        }));
    }

    async function saveProfilePhoto() {
        try {
            const currentUser = getCurrentSessionUser();
            const input = document.getElementById('profileSettingsPhotoInput');
            const file = input && input.files ? input.files[0] : null;
            if (!file) {
                setProfileMessage('Lütfen bir profil fotoğrafı seçin.', 'error');
                return;
            }
            setProfileMessage('Profil fotoğrafı güncelleniyor...');
            const photoUrl = await fileToDataUrl(file);
            const nextProfile = {
                ...(loadedProfile || await loadCurrentProfile()),
                id: currentUser.id,
                photoUrl,
                profilePhoto: photoUrl
            };
            await db.collection('users').doc(currentUser.id).set({ photoUrl, profilePhoto: photoUrl }, { merge: true });
            await updateRoleCollectionProfile({ photoUrl, profilePhoto: photoUrl });
            await syncProfileIntoChats(nextProfile, nextProfile.email);
            applySessionProfile(nextProfile);
            setProfileMessage('Profil fotoğrafı güncellendi.', 'success');
        } catch (error) {
            console.error('Profil fotoğrafı güncellenemedi:', error);
            setProfileMessage('Profil fotoğrafı güncellenemedi: ' + error.message, 'error');
        }
    }

    async function saveProfileEmail() {
        try {
            const currentUser = getCurrentSessionUser();
            const nextEmail = normalizeEmail(document.getElementById('profileSettingsNewEmail').value);
            const password = String(document.getElementById('profileSettingsEmailPassword').value || '');
            if (!nextEmail) {
                setProfileMessage('Yeni e-posta adresi girin.', 'error');
                return;
            }
            if (!password) {
                setProfileMessage('E-posta değişikliği için mevcut şifrenizi girin.', 'error');
                return;
            }
            if (nextEmail === normalizeEmail((loadedProfile && loadedProfile.email) || currentUser.email)) {
                setProfileMessage('Yeni e-posta mevcut adresle aynı olamaz.', 'error');
                return;
            }
            setProfileMessage('Doğrulama e-postası hazırlanıyor...');
            const user = await reauthenticateUser(password);
            const previousEmail = user.email || currentUser.email;
            const requestedAt = new Date().toISOString();
            if (typeof user.verifyBeforeUpdateEmail === 'function') {
                await user.verifyBeforeUpdateEmail(nextEmail);
                await db.collection('users').doc(currentUser.id).set({
                    pendingEmail: nextEmail,
                    emailChangeRequestedAt: requestedAt,
                    updatedAt: requestedAt
                }, { merge: true });
                await updateRoleCollectionProfile({
                    pendingEmail: nextEmail,
                    emailChangeRequestedAt: requestedAt,
                    updatedAt: requestedAt
                });
                loadedProfile = {
                    ...(loadedProfile || await loadCurrentProfile()),
                    id: currentUser.id,
                    pendingEmail: nextEmail
                };
                setProfileMessage('Yeni e-posta adresine doğrulama bağlantısı gönderildi. Bağlantıyı onayladıktan sonra tekrar giriş yaptığınızda adresiniz otomatik güncellenecek.', 'success');
                return;
            }

            await user.updateEmail(nextEmail);
            const nextProfile = {
                ...(loadedProfile || await loadCurrentProfile()),
                id: currentUser.id,
                email: nextEmail,
                pendingEmail: ''
            };
            await persistVerifiedEmail(nextProfile, previousEmail);
            setProfileMessage('E-posta adresi güncellendi.', 'success');
        } catch (error) {
            console.error('E-posta güncellenemedi:', error);
            if (error && error.code === 'auth/operation-not-allowed') {
                setProfileMessage('Bu projede e-posta değişimi doğrulama bağlantısı ile yapılıyor. Yeni adrese gelen doğrulama postasını onaylayıp tekrar giriş yapın.', 'error');
                return;
            }
            setProfileMessage('E-posta güncellenemedi: ' + error.message, 'error');
        }
    }

    async function saveProfilePassword() {
        try {
            const currentPassword = String(document.getElementById('profileSettingsCurrentPassword').value || '');
            const newPassword = String(document.getElementById('profileSettingsNewPassword').value || '');
            const confirmPassword = String(document.getElementById('profileSettingsConfirmPassword').value || '');
            if (!currentPassword) {
                setProfileMessage('Mevcut şifrenizi girin.', 'error');
                return;
            }
            if (!newPassword || newPassword.length < 6) {
                setProfileMessage('Yeni şifre en az 6 karakter olmalıdır.', 'error');
                return;
            }
            if (newPassword !== confirmPassword) {
                setProfileMessage('Yeni şifre ve tekrar alanı aynı olmalıdır.', 'error');
                return;
            }
            setProfileMessage('Şifre güncelleniyor...');
            const user = await reauthenticateUser(currentPassword);
            await user.updatePassword(newPassword);
            document.getElementById('profileSettingsCurrentPassword').value = '';
            document.getElementById('profileSettingsNewPassword').value = '';
            document.getElementById('profileSettingsConfirmPassword').value = '';
            setProfileMessage('Şifre güncellendi.', 'success');
        } catch (error) {
            console.error('Şifre güncellenemedi:', error);
            setProfileMessage('Şifre güncellenemedi: ' + error.message, 'error');
        }
    }

    async function openProfileSettingsModal(section) {
        ensureProfileModal();
        const profile = await loadCurrentProfile();
        fillProfileModal(profile);
        const modal = document.getElementById('profileSettingsModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
        }
        if (section === 'photo') {
            document.getElementById('profileSettingsPhotoInput')?.focus();
        } else if (section === 'email') {
            document.getElementById('profileSettingsNewEmail')?.focus();
        } else if (section === 'password') {
            document.getElementById('profileSettingsCurrentPassword')?.focus();
        }
    }

    function closeProfileSettingsModal() {
        const modal = document.getElementById('profileSettingsModal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
    }

    async function initProfileSettings() {
        if (!window.db || !window.auth) {
            setTimeout(initProfileSettings, 120);
            return;
        }
        const currentUser = getCurrentSessionUser();
        if (!currentUser.id) return;
        ensureProfileButton();
        ensureProfileModal();
        const profile = await reconcileEmailAfterVerification(await loadCurrentProfile());
        applySessionProfile(profile);
    }

    window.openProfileSettingsModal = openProfileSettingsModal;
    window.closeProfileSettingsModal = closeProfileSettingsModal;

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeProfileSettingsModal();
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initProfileSettings);
    } else {
        initProfileSettings();
    }
})();