(function () {
    const ROLE_LABELS = {
        parent: 'Veli',
        trainer: 'Antrenör',
        admin: 'Kulüp Yöneticisi',
        superadmin: 'Süper Admin',
        secretary: 'Sekreter',
        student: 'Öğrenci',
        user: 'Kullanıcı'
    };

    const roleConfigs = [
        {
            listContainerId: 'superAdminChatListContainer',
            listPageId: 'chat-page',
            viewPageId: 'super-admin-chat-view-page',
            titleId: 'superAdminChatViewTitle',
            messagesId: 'superAdminChatMessages',
            formId: 'superAdminChatForm',
            inputId: 'superAdminChatMessageInput',
            newChatPageId: 'super-admin-new-chat-email-page',
            newChatFormId: 'superAdminNewChatEmailForm',
            newChatEmailId: 'superAdminChatEmailInput',
            newChatInfoId: 'superAdminChatEmailUserInfo',
            groupManageButtonId: 'superAdminGroupManageBtn',
            newGroupModalId: 'superAdminNewGroupChatModal',
            newGroupFormId: 'superAdminNewGroupChatForm',
            groupNameId: 'superAdminGroupChatName',
            groupEmailsId: 'superAdminGroupChatUserEmails',
            groupPhotoId: 'superAdminGroupChatPhoto',
            groupManagementModalId: 'superAdminGroupManagementModal',
            groupManagementFormId: 'superAdminGroupManagementForm',
            groupCurrentPhotoId: 'superAdminGroupCurrentPhoto',
            groupManageNameId: 'superAdminGroupManageName',
            groupManagePhotoId: 'superAdminGroupManagePhoto',
            groupAddMemberEmailId: 'superAdminGroupAddMemberEmail',
            groupMembersListId: 'superAdminGroupMembersList'
        },
        {
            listContainerId: 'adminChatListContainer',
            listPageId: 'chat-page',
            viewPageId: 'admin-chat-view-page',
            titleId: 'adminChatViewTitle',
            messagesId: 'adminChatMessages',
            formId: 'adminChatForm',
            inputId: 'adminChatMessageInput',
            newChatPageId: 'admin-new-chat-email-page',
            newChatFormId: 'adminNewChatEmailForm',
            newChatEmailId: 'adminChatEmailInput',
            newChatInfoId: 'adminChatEmailUserInfo',
            groupManageButtonId: 'adminGroupManageBtn',
            newGroupModalId: 'adminNewGroupChatModal',
            newGroupFormId: 'adminNewGroupChatForm',
            groupNameId: 'adminGroupChatName',
            groupEmailsId: 'adminGroupChatUserEmails',
            groupPhotoId: 'adminGroupChatPhoto',
            groupManagementModalId: 'adminGroupManagementModal',
            groupManagementFormId: 'adminGroupManagementForm',
            groupCurrentPhotoId: 'adminGroupCurrentPhoto',
            groupManageNameId: 'adminGroupManageName',
            groupManagePhotoId: 'adminGroupManagePhoto',
            groupAddMemberEmailId: 'adminGroupAddMemberEmail',
            groupMembersListId: 'adminGroupMembersList'
        },
        {
            listContainerId: 'chatListContainer',
            listPageId: 'chat-page',
            viewPageId: 'chat-view-page',
            titleId: 'chatViewTitle',
            messagesId: 'chatMessages',
            formId: 'chatForm',
            inputId: 'chatInput',
            newChatPageId: 'new-chat-email-page',
            newChatFormId: 'newChatEmailForm',
            newChatEmailId: 'chatEmailInput',
            newChatInfoId: 'chatEmailUserInfo',
            groupManageButtonId: 'groupManageBtn',
            newGroupModalId: 'newGroupChatModal',
            newGroupFormId: 'newGroupChatForm',
            groupNameId: 'groupChatName',
            groupEmailsId: 'groupChatUserEmails',
            groupPhotoId: 'groupChatPhoto',
            groupManagementModalId: 'groupManagementModal',
            groupManagementFormId: 'groupManagementForm',
            groupCurrentPhotoId: 'groupCurrentPhoto',
            groupManageNameId: 'groupManageName',
            groupManagePhotoId: 'groupManagePhoto',
            groupAddMemberEmailId: 'groupAddMemberEmail',
            groupMembersListId: 'groupMembersList'
        }
    ];

    let config = null;
    let activeChatId = null;
    let activeChatUnsub = null;
    let activeChatDocUnsub = null;
    let activeChatMessagesCache = [];
    let incomingCallUnsub = null;
    let chatCache = new Map();
    let selectedAttachment = null;
    let recorder = null;
    let recordedChunks = [];
    let voiceRecordingStream = null;
    let voiceRecordingContext = null;
    let voiceRecordingSource = null;
    let voiceRecordingProcessor = null;
    let voiceRecordingGain = null;
    let voiceRecordingBuffers = [];
    let isVoiceRecording = false;
    let voiceRecordingStartedAt = 0;
    let voiceRecordingTimer = null;
    let voiceRecordingAutoStopTimer = null;
    let activeGroupId = null;
    let currentCallDocId = null;
    let allDiscoverableUsers = [];
    let userProfileCache = new Map();
    let clubNameCache = new Map();
    let currentIdentity = null;
    let rtcPeerConnection = null;
    let rtcLocalStream = null;
    let rtcRemoteAudio = null;
    let callDocUnsub = null;
    let offerCandidatesUnsub = null;
    let answerCandidatesUnsub = null;
    let dismissedIncomingCallIds = new Set();
    let callListenerStartedAt = Date.now();
    let delegatedChatActionsBound = false;
    const MAX_VOICE_RECORDING_MS = 10 * 60 * 1000;
    const CALL_RING_TIMEOUT_MS = 2 * 60 * 1000;
    const chatCommonScriptUrl = document.currentScript ? document.currentScript.src : '';
    const GROUP_CREATE_DESCRIPTION_ID = 'chatGroupDescriptionInput';
    const GROUP_MANAGE_DESCRIPTION_ID = 'chatGroupDescriptionManage';
    const GROUP_INFO_BOX_ID = 'chatGroupInfoBox';
    const GROUP_ROLE_HINT_ID = 'chatGroupRoleHint';
    const GROUP_PHOTO_SECTION_ID = 'chatGroupPhotoSection';
    const GROUP_ADD_MEMBER_SECTION_ID = 'chatGroupAddMemberSection';
    const GROUP_CREATE_PERMISSION_SECTION_ID = 'chatGroupCreatePermissionSection';
    const GROUP_CREATE_SCHEDULE_SECTION_ID = 'chatGroupCreateScheduleSection';
    const GROUP_MANAGE_PERMISSION_SECTION_ID = 'chatGroupManagePermissionSection';
    const GROUP_MANAGE_SCHEDULE_SECTION_ID = 'chatGroupManageScheduleSection';
    const GROUP_DELETE_BUTTON_ID = 'chatDeleteManagedGroupButton';
    const GROUP_LEAVE_BUTTON_ID = 'leaveGroupButton';

    function getCurrentUser() {
        return {
            id: sessionStorage.getItem('user_id'),
            role: sessionStorage.getItem('user_role'),
            name: (currentIdentity && currentIdentity.fullName) || sessionStorage.getItem('user_name') || 'Kullanıcı',
            email: sessionStorage.getItem('user_email') || '',
            clubName: (currentIdentity && currentIdentity.clubName) || ''
        };
    }

    function ensureCss() {
        if (document.getElementById('chatModernCssLink')) return;
        const link = document.createElement('link');
        link.id = 'chatModernCssLink';
        link.rel = 'stylesheet';
        link.href = '../css/chat-modern.css';
        document.head.appendChild(link);
    }

    function detectConfig() {
        return roleConfigs.find(item => document.getElementById(item.listContainerId)) || null;
    }

    function ensureBaseChatModals() {
        if (!config) return;

        if (!document.getElementById(config.newGroupModalId)) {
            const newGroupModal = document.createElement('div');
            newGroupModal.id = config.newGroupModalId;
            newGroupModal.className = 'modal';
            newGroupModal.style.display = 'none';
            newGroupModal.innerHTML = '<div class="modal-content" style="max-width:500px;">'
                + '<div class="modal-header"><h2>Grup Sohbeti Başlat</h2><button class="close-btn" onclick="closeNewGroupChatModal()">&times;</button></div>'
                + '<div class="modal-body">'
                + '<form id="' + config.newGroupFormId + '">'
                + '<div class="form-group"><label>Grup Adı</label><input id="' + config.groupNameId + '" type="text" placeholder="Grup adı" required></div>'
                + '<div class="form-group"><label>Grup Profil Fotoğrafı</label><input id="' + config.groupPhotoId + '" type="file" accept="image/*"><small style="color:#666; display:block; margin-top:6px;">İsteğe bağlıdır.</small></div>'
                + '<div class="form-group"><label>Üye E-postaları</label><textarea id="' + config.groupEmailsId + '" rows="3" placeholder="uye1@email.com, uye2@email.com" required></textarea></div>'
                + '<div class="btn-group"><button type="submit" class="btn btn-success">Grup Oluştur</button><button type="button" class="btn btn-primary" onclick="closeNewGroupChatModal()">İptal</button></div>'
                + '</form></div></div>';
            document.body.appendChild(newGroupModal);
        }

        if (!document.getElementById(config.groupManagementModalId)) {
            const managementModal = document.createElement('div');
            managementModal.id = config.groupManagementModalId;
            managementModal.className = 'modal';
            managementModal.style.display = 'none';
            managementModal.innerHTML = '<div class="modal-content" style="max-width:560px;">'
                + '<div class="modal-header"><h2>Grup Ayarları</h2><button class="close-btn" onclick="closeGroupManagementModal()">&times;</button></div>'
                + '<div class="modal-body">'
                + '<div style="text-align:center; margin-bottom:18px;"><img id="' + config.groupCurrentPhotoId + '" src="" alt="Grup Fotoğrafı" style="width:96px; height:96px; border-radius:50%; object-fit:cover; border:3px solid #dde5ed; background:#f5f7fa;"></div>'
                + '<form id="' + config.groupManagementFormId + '">'
                + '<div class="form-group"><label>Grup Adı</label><input id="' + config.groupManageNameId + '" type="text" placeholder="Grup adı" required></div>'
                + '<div class="form-group"><label>Yeni Profil Fotoğrafı</label><input id="' + config.groupManagePhotoId + '" type="file" accept="image/*"><small style="color:#666; display:block; margin-top:6px;">Değiştirmek istemiyorsanız boş bırakın.</small></div>'
                + '<div class="form-group"><label>Yeni Üye Ekle (Email)</label><input id="' + config.groupAddMemberEmailId + '" type="email" placeholder="uye@email.com"><button type="button" class="btn btn-info btn-sm" onclick="addGroupMember()" style="margin-top:8px;">Üye Ekle</button></div>'
                + '<div class="form-group"><label>Mevcut Üyeler</label><div id="' + config.groupMembersListId + '" style="max-height:180px; overflow-y:auto; border:1px solid #dde5ed; border-radius:8px; padding:10px; background:#fff;"></div></div>'
                + '<div class="btn-group"><button type="submit" class="btn btn-success">Kaydet</button><button type="button" class="btn btn-danger" onclick="deleteGroup()">Grubu Sil</button><button type="button" class="btn btn-primary" onclick="closeGroupManagementModal()">İptal</button></div>'
                + '</form></div></div>';
            document.body.appendChild(managementModal);
        }

        const newGroupModal = document.getElementById(config.newGroupModalId);
        const managementModal = document.getElementById(config.groupManagementModalId);
        [newGroupModal, managementModal].forEach(modal => {
            if (!modal) return;
            modal.classList.add('chat-modal');
            const content = modal.querySelector('.modal-content');
            if (content) content.classList.add('chat-modal-content');
            const header = modal.querySelector('.modal-header');
            if (header) header.classList.add('chat-modal-header');
            const body = modal.querySelector('.modal-body');
            if (body) body.classList.add('chat-modal-body');
            const form = modal.querySelector('form');
            if (form) form.classList.add('chat-modal-form');
        });
    }

    function loadDismissedIncomingCallIds() {
        try {
            const value = sessionStorage.getItem('dismissed_incoming_call_ids');
            const parsed = value ? JSON.parse(value) : [];
            dismissedIncomingCallIds = new Set(Array.isArray(parsed) ? parsed : []);
        } catch (error) {
            dismissedIncomingCallIds = new Set();
        }
    }

    function persistDismissedIncomingCallIds() {
        try {
            sessionStorage.setItem('dismissed_incoming_call_ids', JSON.stringify(Array.from(dismissedIncomingCallIds).slice(-50)));
        } catch (error) {
            console.warn('Dismissed call IDs kaydedilemedi:', error.message);
        }
    }

    function suppressIncomingCall(callId) {
        if (!callId) return;
        dismissedIncomingCallIds.add(callId);
        persistDismissedIncomingCallIds();
        const modal = document.getElementById('chatIncomingCallModal');
        if (modal) modal.classList.remove('active');
        if (currentCallDocId === callId) currentCallDocId = null;
    }

    function unsuppressIncomingCall(callId) {
        if (!callId || !dismissedIncomingCallIds.has(callId)) return;
        dismissedIncomingCallIds.delete(callId);
        persistDismissedIncomingCallIds();
    }

    function setPageVisible(pageId, visible) {
        const page = document.getElementById(pageId);
        if (!page) return;
        page.style.display = visible ? 'block' : 'none';
        page.classList.toggle('active', visible);
    }

    function callsEnabledForCurrentRole() {
        return getCurrentUser().role !== 'secretary';
    }

    function getRoleLabel(role) {
        return ROLE_LABELS[role] || role || 'Kullanıcı';
    }

    async function getClubNameByAdminId(adminId) {
        if (!adminId) return '';
        if (clubNameCache.has(adminId)) return clubNameCache.get(adminId);
        try {
            const clubDoc = await db.collection('clubProfiles').doc(adminId).get();
            const clubName = clubDoc.exists ? String(clubDoc.data().clubName || '').trim() : '';
            clubNameCache.set(adminId, clubName);
            return clubName;
        } catch (error) {
            console.warn('Kulüp bilgisi alınamadı:', error.message);
            clubNameCache.set(adminId, '');
            return '';
        }
    }

    async function deriveClubNameForUser(userId, role, data) {
        if (!userId) return '';

        let adminId = data && data.adminId ? data.adminId : '';
        if (!adminId && role === 'admin') adminId = userId;

        if (!adminId && role === 'parent' && data && data.studentId) {
            const studentDoc = await db.collection('students').doc(data.studentId).get();
            if (studentDoc.exists) {
                adminId = studentDoc.data().adminId || '';
            }
        }

        return getClubNameByAdminId(adminId);
    }

    async function resolveCurrentUserIdentity() {
        const currentUser = getCurrentUser();
        if (!currentUser.id) return null;

        let data = null;
        try {
            const userDoc = await db.collection('users').doc(currentUser.id).get();
            if (userDoc.exists) data = userDoc.data() || {};
        } catch (error) {
            console.warn('Kullanıcı profili okunamadı:', error.message);
        }

        if (!data && currentUser.role === 'trainer') {
            try {
                const trainerDoc = await db.collection('trainers').doc(currentUser.id).get();
                if (trainerDoc.exists) data = trainerDoc.data() || {};
            } catch (error) {
                console.warn('Antrenör profili okunamadı:', error.message);
            }
        }

        data = data || {};
        currentIdentity = {
            fullName: String((data.chatProfile && data.chatProfile.fullName) || data.name || currentUser.name || '').trim(),
            clubName: String(await deriveClubNameForUser(currentUser.id, currentUser.role, data) || '').trim()
        };

        if (currentIdentity.fullName) {
            sessionStorage.setItem('user_name', currentIdentity.fullName);
        }

        userProfileCache.set(currentUser.id, {
            id: currentUser.id,
            name: currentIdentity.fullName || currentUser.name,
            role: currentUser.role,
            email: currentUser.email,
            photoUrl: data.photoUrl || data.profilePhoto || '',
            clubName: currentIdentity.clubName
        });

        return currentIdentity;
    }

    function normalizeFullName(value) {
        return String(value || '').replace(/[\s\u00A0\u2000-\u200B\u202F\u205F\u3000]+/g, ' ').trim();
    }

    function identityIsComplete() {
        if (!currentIdentity) return false;
        const normalized = normalizeFullName(currentIdentity.fullName || '');
        if (normalized.length < 3) return false;
        const nameParts = normalized.split(' ').filter(Boolean);
        return nameParts.length >= 2 || normalized.length >= 5;
    }

    function ensureIdentityModal() {
        if (document.getElementById('chatIdentityModal')) return;
        const modal = document.createElement('div');
        modal.id = 'chatIdentityModal';
        modal.className = 'modal';
        modal.innerHTML = '<div class="modal-content" style="max-width:520px;">'
            + '<div class="modal-header"><h2>Sohbet Profili</h2></div>'
            + '<form id="chatIdentityForm">'
            + '<div class="form-group"><label>Ad Soyad</label><input type="text" id="chatIdentityFullName" placeholder="Örn: Enes Aktürk" required></div>'
            + '<div class="form-group"><label>Kulüp</label><div id="chatIdentityClubName" style="padding:12px 14px; border:1px solid #d9e3ec; border-radius:10px; background:#f8fbfd; color:#34495e;">Kulüp yöneticisi panelinden alınır</div></div>'
            + '<div id="chatIdentityMessage" style="font-size:0.9em; color:#6b7b8b; margin-bottom:14px;">Kulüp adı adminin kulüp profilinden otomatik gelir. Burada sadece ad soyad doğrulanır.</div>'
            + '<div class="btn-group"><button type="submit" class="btn btn-success">Kaydet ve Devam Et</button></div>'
            + '</form></div>';
        document.body.appendChild(modal);
        document.getElementById('chatIdentityForm').addEventListener('submit', saveChatIdentityProfile);
    }

    function openIdentityModal() {
        ensureIdentityModal();
        document.getElementById('chatIdentityFullName').value = (currentIdentity && currentIdentity.fullName) || getCurrentUser().name || '';
        document.getElementById('chatIdentityClubName').textContent = (currentIdentity && currentIdentity.clubName) || 'Kulüp adı yönetici panelindeki kulüp profilinden alınacaktır';
        document.getElementById('chatIdentityModal').classList.add('active');
    }

    function closeIdentityModal() {
        const modal = document.getElementById('chatIdentityModal');
        if (modal) modal.classList.remove('active');
    }

    async function saveChatIdentityProfile(event) {
        event.preventDefault();
        const currentUser = getCurrentUser();
        const fullName = normalizeFullName(document.getElementById('chatIdentityFullName').value || '');
        const messageEl = document.getElementById('chatIdentityMessage');

        if (fullName.length < 3) {
            messageEl.textContent = 'Lutfen en az 3 karakterlik bir ad bilgisi girin.';
            messageEl.style.color = '#c0392b';
            return;
        }

        const chatProfile = {
            fullName,
            updatedAt: new Date().toISOString()
        };

        try {
            await db.collection('users').doc(currentUser.id).set({ name: fullName, chatProfile }, { merge: true });
            if (currentUser.role === 'trainer') {
                await db.collection('trainers').doc(currentUser.id).set({ name: fullName, chatProfile }, { merge: true });
            }
            currentIdentity = { fullName, clubName: (currentIdentity && currentIdentity.clubName) || '' };
            sessionStorage.setItem('user_name', fullName);
            userProfileCache.set(currentUser.id, {
                ...(userProfileCache.get(currentUser.id) || {}),
                id: currentUser.id,
                name: fullName,
                role: currentUser.role,
                email: currentUser.email,
                clubName: (currentIdentity && currentIdentity.clubName) || ''
            });
            closeIdentityModal();
            await loadChatList();
        } catch (error) {
            messageEl.textContent = 'Profil kaydedilemedi: ' + error.message;
            messageEl.style.color = '#c0392b';
        }
    }

    function getParticipantInfo(chat, userId) {
        const cached = userProfileCache.get(userId);
        if (chat.users && chat.users[userId]) {
            return {
                id: userId,
                name: (cached && cached.name) || chat.users[userId].name || 'Kullanıcı',
                role: (cached && cached.role) || chat.users[userId].role || 'user',
                email: (cached && cached.email) || chat.users[userId].email || '',
                photoUrl: (cached && cached.photoUrl) || chat.users[userId].photoUrl || '',
                clubName: (cached && cached.clubName) || chat.users[userId].clubName || ''
            };
        }
        return {
            id: userId,
            name: (cached && cached.name) || 'Kullanıcı',
            role: (cached && cached.role) || 'user',
            email: (cached && cached.email) || '',
            photoUrl: (cached && cached.photoUrl) || '',
            clubName: (cached && cached.clubName) || ''
        };
    }

    function renderAvatar(name, photoUrl) {
        if (photoUrl) {
            return '<span class="chat-avatar"><img src="' + photoUrl + '" alt="' + name + '"></span>';
        }
        return '<span class="chat-avatar">' + String(name || '?').charAt(0).toUpperCase() + '</span>';
    }

    function safeText(value) {
        return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    async function fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function sanitizeFileName(fileName) {
        return String(fileName || 'dosya')
            .replace(/[^a-zA-Z0-9._-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || 'dosya';
    }

    function getFileExtensionFromMimeType(mimeType, fallbackName) {
        if (fallbackName && String(fallbackName).includes('.')) {
            return '.' + String(fallbackName).split('.').pop().toLowerCase();
        }
        const normalized = String(mimeType || '').toLowerCase();
        if (normalized.includes('webm')) return '.webm';
        if (normalized.includes('ogg')) return '.ogg';
        if (normalized.includes('wav')) return '.wav';
        if (normalized.includes('mpeg')) return '.mp3';
        if (normalized.includes('mp4')) return '.mp4';
        if (normalized.includes('jpeg')) return '.jpg';
        if (normalized.includes('png')) return '.png';
        return '';
    }

    function encodeAudioBufferToWav(audioBuffer) {
        const channelData = audioBuffer.getChannelData(0);
        const buffer = new ArrayBuffer(44 + channelData.length * 2);
        const view = new DataView(buffer);

        function writeString(offset, value) {
            for (let index = 0; index < value.length; index += 1) {
                view.setUint8(offset + index, value.charCodeAt(index));
            }
        }

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + channelData.length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, audioBuffer.sampleRate, true);
        view.setUint32(28, audioBuffer.sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, channelData.length * 2, true);

        let offset = 44;
        for (let index = 0; index < channelData.length; index += 1) {
            const sample = Math.max(-1, Math.min(1, channelData[index]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
            offset += 2;
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    function mergeVoiceBuffers(buffers) {
        const totalLength = buffers.reduce((sum, item) => sum + item.length, 0);
        const merged = new Float32Array(totalLength);
        let offset = 0;
        buffers.forEach(item => {
            merged.set(item, offset);
            offset += item.length;
        });
        return merged;
    }

    function analyzeAudioSamples(samples, sampleRate) {
        let peak = 0;
        let squareSum = 0;

        for (let index = 0; index < samples.length; index += 1) {
            const value = samples[index];
            const absolute = Math.abs(value);
            if (absolute > peak) peak = absolute;
            squareSum += value * value;
        }

        const rms = samples.length ? Math.sqrt(squareSum / samples.length) : 0;
        const durationSeconds = sampleRate > 0 ? samples.length / sampleRate : 0;
        return {
            sampleCount: samples.length,
            sampleRate: sampleRate || 0,
            durationSeconds,
            peak,
            rms,
            wavBytes: 44 + samples.length * 2
        };
    }

    function normalizePcmSamples(samples, peak) {
        if (!samples.length || !(peak > 0)) return samples;

        const targetPeak = 0.82;
        const gain = Math.min(12, targetPeak / peak);
        if (gain <= 1.05) return samples;

        const normalized = new Float32Array(samples.length);
        for (let index = 0; index < samples.length; index += 1) {
            const value = samples[index] * gain;
            normalized[index] = Math.max(-1, Math.min(1, value));
        }
        return normalized;
    }

    function downsamplePcmSamples(samples, sourceRate, targetRate) {
        if (!samples.length || !sourceRate || !targetRate || targetRate >= sourceRate) {
            return samples;
        }

        const ratio = sourceRate / targetRate;
        const outputLength = Math.max(1, Math.round(samples.length / ratio));
        const result = new Float32Array(outputLength);
        let inputIndex = 0;

        for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
            const nextInputIndex = Math.min(samples.length, Math.round((outputIndex + 1) * ratio));
            let sum = 0;
            let count = 0;

            for (let index = inputIndex; index < nextInputIndex; index += 1) {
                sum += samples[index];
                count += 1;
            }

            result[outputIndex] = count ? (sum / count) : (samples[Math.min(inputIndex, samples.length - 1)] || 0);
            inputIndex = nextInputIndex;
        }

        return result;
    }

    function formatAudioDiagnostics(diagnostics) {
        if (!diagnostics) return '';
        if (diagnostics.summary) return diagnostics.summary;
        const seconds = diagnostics.durationSeconds || 0;
        const sizeKb = Math.round((diagnostics.fileSize || diagnostics.wavBytes || 0) / 1024);
        const rate = diagnostics.sampleRate ? Math.round(diagnostics.sampleRate / 100) / 10 : 0;
        const peakPercent = Math.round((diagnostics.peak || 0) * 100);
        const rmsPercent = Math.round((diagnostics.rms || 0) * 1000) / 10;
        return seconds.toFixed(1) + ' sn | ' + sizeKb + ' KB | ' + rate + ' kHz | peak %' + peakPercent + ' | rms %' + rmsPercent;
    }

    function formatDurationMs(durationMs) {
        const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    }

    function getChatMediaPreviewElement() {
        return document.getElementById('chatMediaPreview');
    }

    function updateRecordingPreviewText() {
        const preview = getChatMediaPreviewElement();
        if (!preview || !isVoiceRecording || !voiceRecordingStartedAt) return;
        const elapsedMs = Date.now() - voiceRecordingStartedAt;
        const remainingMs = Math.max(0, MAX_VOICE_RECORDING_MS - elapsedMs);
        preview.style.display = 'block';
        preview.textContent = 'Ses kaydı yapılıyor... ' + formatDurationMs(elapsedMs) + ' / 10:00. Bitirmek için tekrar mikrofona basın. Kalan: ' + formatDurationMs(remainingMs);
    }

    function clearVoiceRecordingTimers() {
        if (voiceRecordingTimer) {
            clearInterval(voiceRecordingTimer);
            voiceRecordingTimer = null;
        }
        if (voiceRecordingAutoStopTimer) {
            clearTimeout(voiceRecordingAutoStopTimer);
            voiceRecordingAutoStopTimer = null;
        }
        voiceRecordingStartedAt = 0;
    }

    function startVoiceRecordingTimers() {
        clearVoiceRecordingTimers();
        voiceRecordingStartedAt = Date.now();
        updateRecordingPreviewText();
        voiceRecordingTimer = window.setInterval(updateRecordingPreviewText, 1000);
        voiceRecordingAutoStopTimer = window.setTimeout(async () => {
            if (!isVoiceRecording) return;
            try {
                await stopVoiceRecording();
                const preview = getChatMediaPreviewElement();
                if (preview && selectedAttachment && selectedAttachment.kind === 'audio') {
                    preview.insertAdjacentHTML('afterbegin', '<div style="margin-bottom:6px; font-size:12px; color:#b9770e;">10 dakika dolduğu için kayıt otomatik durduruldu.</div>');
                }
            } catch (error) {
                console.error('Ses kaydı otomatik durdurulamadı:', error);
            }
        }, MAX_VOICE_RECORDING_MS);
    }

    function getCallTimestamp(call) {
        const value = call && (call.createdAt || call.updatedAt);
        let timestamp = 0;
        if (value && typeof value.toDate === 'function') {
            timestamp = value.toDate().getTime();
        } else if (typeof value === 'number') {
            timestamp = value;
        } else if (value && typeof value.seconds === 'number') {
            timestamp = value.seconds * 1000;
        } else if (value) {
            timestamp = new Date(value).getTime();
        }
        return Number.isFinite(timestamp) ? timestamp : 0;
    }

    function isInvalidRingingCall(call) {
        return !!call && call.status === 'ringing' && !getCallTimestamp(call);
    }

    function isCallTimedOut(call) {
        if (!call || call.status !== 'ringing') return false;
        const createdAt = getCallTimestamp(call);
        return !!createdAt && (Date.now() - createdAt) > CALL_RING_TIMEOUT_MS;
    }

    function isPreexistingIncomingCall(call, currentUserId) {
        if (!call || call.status !== 'ringing' || call.callerId === currentUserId) return false;
        const createdAt = getCallTimestamp(call);
        return !!createdAt && createdAt < (callListenerStartedAt - 5000);
    }

    async function markCallAsMissed(call, actorId, reason) {
        if (!call || !call.id || call.status !== 'ringing') return;
        const finalReason = reason || 'timeout';
        const updates = {
            status: 'missed',
            endedReason: finalReason,
            updatedAt: new Date().toISOString(),
            timedOutAt: new Date().toISOString(),
            timeoutActorId: actorId || ''
        };
        await db.collection('calls').doc(call.id).set(updates, { merge: true });
        if (call.chatId && !call.timeoutMessageSentAt) {
            await db.collection('chats').doc(call.chatId).collection('messages').add({
                senderId: call.callerId || actorId || 'system',
                senderName: call.callerName || 'Sistem',
                senderEmail: '',
                senderClubName: '',
                text: finalReason === 'stale' ? 'Eski arama kaydı kapatıldı.' : 'Arama cevaplanmadı.',
                type: 'call-event',
                callStatusText: finalReason === 'stale' ? 'Eski arama kaydı kapatıldı' : 'Arama cevaplanmadı',
                timestamp: new Date().toISOString()
            });
            await db.collection('calls').doc(call.id).set({ timeoutMessageSentAt: new Date().toISOString() }, { merge: true });
        }
    }

    function createAudioAttachmentFromFile(file, diagnostics) {
        clearAttachmentPreview();
        selectedAttachment = {
            file,
            previewUrl: URL.createObjectURL(file),
            mime: file.type,
            kind: 'audio',
            fileName: file.name,
            diagnostics: diagnostics || null
        };
        renderAttachmentPreview(selectedAttachment, (diagnostics && diagnostics.warning) || 'Ses kaydı hazır');
    }

    function encodePcmSamplesToWav(samples, sampleRate) {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);

        function writeString(offset, value) {
            for (let index = 0; index < value.length; index += 1) {
                view.setUint8(offset + index, value.charCodeAt(index));
            }
        }

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, samples.length * 2, true);

        let offset = 44;
        for (let index = 0; index < samples.length; index += 1) {
            const sample = Math.max(-1, Math.min(1, samples[index]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
            offset += 2;
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    async function convertAudioBlobToPlayableWav(blob) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return blob;

        const audioContext = new AudioContextClass();
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
            return encodeAudioBufferToWav(decoded);
        } catch (error) {
            console.warn('Ses kaydi WAV formatina donusturulemedi:', error.message);
            return blob;
        } finally {
            await audioContext.close().catch(() => {});
        }
    }

    function releaseAttachmentResources(attachment) {
        if (!attachment || !attachment.previewUrl) return;
        if (String(attachment.previewUrl).startsWith('blob:')) {
            URL.revokeObjectURL(attachment.previewUrl);
        }
    }

    function renderAttachmentPreview(attachment, label) {
        const preview = document.getElementById('chatMediaPreview');
        if (!preview) return;
        const sourceUrl = attachment.previewUrl || attachment.dataUrl || '';
        const safeLabel = safeText(label || attachment.fileName || 'Medya hazır');
        const diagnosticsHtml = attachment.diagnostics
            ? '<div style="margin-top:6px; font-size:12px; color:#5f6f81;">' + safeText(formatAudioDiagnostics(attachment.diagnostics)) + '</div>'
            : '';
        const warningHtml = attachment.diagnostics && attachment.diagnostics.warning
            ? '<div style="margin-top:6px; font-size:12px; color:#c0392b;">' + safeText(attachment.diagnostics.warning) + '</div>'
            : '';
        let mediaHtml = '';

        if (attachment.kind === 'audio' && sourceUrl) {
            mediaHtml = '<audio controls preload="metadata" src="' + sourceUrl + '" style="width:100%; margin-top:8px;"></audio>';
        } else if (attachment.kind === 'video' && sourceUrl) {
            mediaHtml = '<video controls style="width:100%; max-height:240px; margin-top:8px; border-radius:12px;"><source src="' + sourceUrl + '" type="' + safeText(attachment.mime || 'video/mp4') + '"></video>';
        } else if (attachment.kind === 'image' && sourceUrl) {
            mediaHtml = '<img src="' + sourceUrl + '" alt="Medya önizleme" style="width:100%; max-height:240px; object-fit:cover; margin-top:8px; border-radius:12px;">';
        }

        preview.style.display = 'block';
        preview.innerHTML = '<strong>' + safeLabel + '</strong>' + diagnosticsHtml + warningHtml + mediaHtml + '<div style="margin-top:8px;"><button type="button" class="chat-action-link" onclick="window.clearChatAttachment()">Kaldır</button></div>';
    }

    function isLocalDevelopmentOrigin() {
        const host = String(window.location.hostname || '').toLowerCase();
        return host === '127.0.0.1' || host === 'localhost';
    }

    async function requestMicrophoneStream() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Tarayıcı mikrofon erişimini desteklemiyor.');
        }

        const preferredConstraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1
            }
        };

        try {
            return await navigator.mediaDevices.getUserMedia(preferredConstraints);
        } catch (error) {
            console.warn('Gelismis mikrofon ayarlari kullanilamadi, varsayilana donuluyor:', error.message);
            return navigator.mediaDevices.getUserMedia({ audio: true });
        }
    }

    async function uploadChatAttachment(file, kind) {
        if (kind === 'audio' && isLocalDevelopmentOrigin()) {
            const dataUrl = await fileToDataUrl(file);
            const maxLocalAudioDataUrlLength = 980000;
            console.info('Ses dosyası yerel yükleme analizi:', {
                fileName: file.name,
                mime: file.type,
                fileSizeBytes: file.size,
                dataUrlLength: dataUrl.length,
                maxLocalAudioDataUrlLength
            });
            if (dataUrl.length > maxLocalAudioDataUrlLength) {
                throw new Error('Ses kaydi cok buyuk. Dosya boyutu yaklasik ' + Math.round(file.size / 1024) + ' KB. Yerel test modunda Firestore belge limitine takiliyor; kaydi biraz kisaltip tekrar deneyin.');
            }
            return dataUrl;
        }

        if (window.storage && typeof window.storage.ref === 'function') {
            try {
                const currentUser = getCurrentUser();
                const extension = getFileExtensionFromMimeType(file.type, file.name);
                const fileName = sanitizeFileName(file.name || (kind || 'media') + '-' + Date.now() + extension);
                const storageRef = window.storage.ref();
                const fileRef = storageRef.child('chat-media/' + (activeChatId || 'genel') + '/' + (currentUser.id || 'anonim') + '/' + Date.now() + '-' + fileName);
                const snapshot = await fileRef.put(file, file.type ? { contentType: file.type } : undefined);
                return snapshot.ref.getDownloadURL();
            } catch (error) {
                console.warn('Storage yuklemesi basarisiz, yerel mesaja donuluyor:', error.message);
            }
        }

        const dataUrl = await fileToDataUrl(file);
        if (dataUrl.length > 900000) {
            throw new Error('Ses dosyasi buyuk oldugu icin bu ortamda gonderilemedi. Dosyayi kisaltip tekrar deneyin.');
        }

        return dataUrl;
    }

    async function lookupUserByEmail(email) {
        const sources = [
            ['users', null],
            ['trainers', 'trainer'],
            ['admins', 'admin'],
            ['parents', 'parent'],
            ['secretaries', 'secretary'],
            ['superadmins', 'superadmin']
        ];
        for (const source of sources) {
            const snap = await db.collection(source[0]).where('email', '==', email).limit(1).get();
            if (!snap.empty) {
                const doc = snap.docs[0];
                const data = doc.data();
                const result = {
                    id: doc.id,
                    name: (data.chatProfile && data.chatProfile.fullName) || data.name || data.fullName || email,
                    role: source[1] || data.role || 'user',
                    email: data.email || email,
                    photoUrl: data.photoUrl || data.profilePhoto || '',
                    clubName: await deriveClubNameForUser(doc.id, source[1] || data.role || 'user', data || {})
                };
                userProfileCache.set(doc.id, result);
                return result;
            }
        }
        return null;
    }

    async function lookupUserById(userId) {
        if (userProfileCache.has(userId)) return userProfileCache.get(userId);
        const sources = ['users', 'trainers', 'admins', 'parents', 'secretaries', 'superadmins'];
        for (const source of sources) {
            const doc = await db.collection(source).doc(userId).get();
            if (doc.exists) {
                const data = doc.data();
                const result = {
                    id: doc.id,
                    name: (data.chatProfile && data.chatProfile.fullName) || data.name || data.fullName || 'Kullanıcı',
                    role: data.role || source.replace(/s$/, ''),
                    email: data.email || '',
                    photoUrl: data.photoUrl || data.profilePhoto || '',
                    clubName: await deriveClubNameForUser(doc.id, data.role || source.replace(/s$/, ''), data || {})
                };
                userProfileCache.set(doc.id, result);
                return result;
            }
        }
        return null;
    }

    async function collectAllUsers() {
        const currentUser = getCurrentUser();
        const sources = [
            ['users', null],
            ['trainers', 'trainer'],
            ['admins', 'admin'],
            ['parents', 'parent'],
            ['secretaries', 'secretary'],
            ['superadmins', 'superadmin']
        ];
        const byKey = new Map();

        for (const source of sources) {
            try {
                const snap = await db.collection(source[0]).get();
                snap.docs.forEach(doc => {
                    const data = doc.data() || {};
                    const email = String(data.email || '').trim().toLowerCase();
                    const key = email || doc.id;
                    if (!key || doc.id === currentUser.id || email === currentUser.email) return;
                    if (!byKey.has(key)) {
                        byKey.set(key, {
                            id: doc.id,
                            name: (data.chatProfile && data.chatProfile.fullName) || data.name || data.fullName || email || 'Kullanıcı',
                            role: source[1] || data.role || source[0].replace(/s$/, ''),
                            email,
                            photoUrl: data.photoUrl || data.profilePhoto || '',
                            clubName: ''
                        });
                    }
                });
            } catch (error) {
                console.warn('Kullanıcı listesi alınamadı:', source[0], error.message);
            }
        }

        allDiscoverableUsers = Array.from(byKey.values()).sort((left, right) => {
            const leftName = `${left.name} ${left.email}`.toLowerCase();
            const rightName = `${right.name} ${right.email}`.toLowerCase();
            return leftName.localeCompare(rightName, 'tr');
        });

        for (const user of allDiscoverableUsers) {
            if (!user.clubName) {
                const resolved = await lookupUserById(user.id);
                user.clubName = (resolved && resolved.clubName) || '';
            }
            userProfileCache.set(user.id, user);
        }
    }

    function renderUserDirectory(filterValue) {
        const container = document.getElementById('chatUserDirectoryList');
        if (!container) return;
        const term = String(filterValue || '').trim().toLowerCase();
        const filtered = allDiscoverableUsers.filter(user => {
            const haystack = `${user.name} ${user.email} ${user.clubName || ''} ${getRoleLabel(user.role)}`.toLowerCase();
            return !term || haystack.includes(term);
        });

        if (!filtered.length) {
            container.innerHTML = '<div class="chat-empty-state" style="padding:18px;">Eşleşen kullanıcı bulunamadı.</div>';
            return;
        }

        container.innerHTML = filtered.map(user => `
            <button type="button" class="chat-item" style="width:100%; text-align:left; border:none; background:transparent;" onclick="window.openChatWithUser('${user.id}')">
                <div>${renderAvatar(user.name, user.photoUrl)}</div>
                <div class="chat-item-main">
                    <div class="chat-item-title">${safeText(user.name)}</div>
                    <div class="chat-item-subtitle">${safeText(user.clubName || 'Kulüp bilgisi yok')}</div>
                    <div class="chat-item-meta">${safeText(getRoleLabel(user.role) + (user.email ? ' • ' + user.email : ''))}</div>
                </div>
                <div class="chat-status-pill">Sohbet Başlat</div>
            </button>
        `).join('');
    }

    async function loadUserDirectory() {
        const container = document.getElementById('chatUserDirectoryList');
        if (!container) return;
        container.innerHTML = '<div class="chat-empty-state" style="padding:18px;">Kullanıcılar yükleniyor...</div>';
        await collectAllUsers();
        renderUserDirectory(document.getElementById('chatUserDirectorySearch')?.value || '');
    }

    async function openChatWithUser(userId) {
        if (!userId) return;
        const user = allDiscoverableUsers.find(item => item.id === userId) || await lookupUserById(userId);
        if (!user) {
            alert('Kullanıcı bulunamadı.');
            return;
        }
        const chatId = await ensureDirectChat(user.id);
        closeNewChatEmailPage();
        await loadChatList();
        openChatView(chatId, user.name);
    }

    function getDisplayInfo(chat, currentUserId) {
        if (chat.type === 'group') {
            return {
                title: chat.groupName || 'Grup Sohbeti',
                subtitle: (chat.userIds || []).length + ' üye',
                meta: chat.groupSettings && chat.groupSettings.scheduledAt ? 'Planlı sohbet' : 'Grup sohbeti',
                photoUrl: chat.photoUrl || '',
                otherUserId: ''
            };
        }
        const otherUserId = (chat.userIds || []).find(id => id !== currentUserId) || currentUserId;
        const other = getParticipantInfo(chat, otherUserId);
        return {
            title: other.name,
            subtitle: other.clubName || 'Kulüp bilgisi yok',
            roleLabel: getRoleLabel(other.role),
            meta: chat.type === 'credit-purchase' ? 'Kredi satın alma görüşmesi' : 'Birebir sohbet',
            photoUrl: other.photoUrl,
            otherUserId
        };
    }

    function formatShortDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
    }

    function clearAttachmentPreview() {
        clearVoiceRecordingTimers();
        isVoiceRecording = false;
        releaseAttachmentResources(selectedAttachment);
        selectedAttachment = null;
        const preview = document.getElementById('chatMediaPreview');
        if (preview) {
            preview.style.display = 'none';
            preview.textContent = '';
        }
        const input = document.getElementById('chatMediaInput');
        if (input) input.value = '';
    }

    async function loadChatList() {
        const currentUser = getCurrentUser();
        const container = document.getElementById(config.listContainerId);
        if (!container || !currentUser.id) return;
        if (!identityIsComplete()) {
            openIdentityModal();
        }
        container.innerHTML = '<div class="chat-empty-state">Sohbetler yükleniyor...</div>';

        try {
            const snap = await db.collection('chats').where('userIds', 'array-contains', currentUser.id).get();
            const chats = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
            const visibleChats = chats.filter(chat => !isOneToOneChat(chat) || Boolean(chat.lastMessage));
            const uniqueUserIds = Array.from(new Set(chats.flatMap(chat => chat.userIds || [])));
            await Promise.all(uniqueUserIds.map(async userId => {
                if (!userProfileCache.has(userId)) {
                    await lookupUserById(userId);
                }
            }));
            chatCache = new Map(chats.map(chat => [chat.id, chat]));
            if (!visibleChats.length) {
                container.innerHTML = '<div class="chat-empty-state">Henüz sohbet bulunmuyor.</div>';
                return;
            }
            container.innerHTML = visibleChats.map(chat => {
                const info = getDisplayInfo(chat, currentUser.id);
                const unread = chat.unreadCounts && chat.unreadCounts[currentUser.id] ? chat.unreadCounts[currentUser.id] : 0;
                return '<div class="chat-item' + (activeChatId === chat.id ? ' is-active' : '') + '" onclick="window.openChatView(\'' + chat.id + '\', \'' + safeText(info.title) + '\')">'
                    + '<div onclick="event.stopPropagation(); window.openProfileChat(\'' + info.otherUserId + '\')">' + renderAvatar(info.title, info.photoUrl) + '</div>'
                    + '<div class="chat-item-main"><div class="chat-item-title">' + safeText(info.title) + '</div><div class="chat-item-subtitle">' + safeText(info.subtitle) + '</div><div class="chat-item-meta">' + safeText((info.roleLabel ? info.roleLabel + ' • ' : '') + info.meta) + '</div></div>'
                    + '<div style="text-align:right;"><div class="chat-item-meta">' + safeText(formatShortDate(chat.updatedAt || chat.createdAt)) + '</div>' + (unread ? '<div class="chat-status-pill" style="margin-top:6px; background:#dff5e6; color:#1f7a3e;">' + unread + '</div>' : '') + '</div></div>';
            }).join('');
        } catch (error) {
            console.error('Sohbet listesi yüklenemedi:', error);
            container.innerHTML = '<div class="chat-empty-state" style="color:#c0392b;">Sohbetler yüklenemedi.</div>';
        }
    }

    async function ensureDirectChat(otherUserId) {
        const currentUser = getCurrentUser();
        const existing = Array.from(chatCache.values()).find(chat => isOneToOneChat(chat) && Array.isArray(chat.userIds) && chat.userIds.length === 2 && chat.userIds.includes(currentUser.id) && chat.userIds.includes(otherUserId));
        if (existing) return existing.id;
        const other = await lookupUserById(otherUserId);
        if (!other) return null;
        const doc = await db.collection('chats').add({
            type: 'direct',
            userIds: [currentUser.id, other.id],
            users: {
                [currentUser.id]: { name: currentUser.name, role: currentUser.role, email: currentUser.email, clubName: currentUser.clubName || '' },
                [other.id]: { name: other.name, role: other.role, email: other.email, photoUrl: other.photoUrl || '', clubName: other.clubName || '' }
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            unreadCounts: {}
        });
        return doc.id;
    }

    async function openProfileChat(userId) {
        if (!userId) return;
        const chatId = await ensureDirectChat(userId);
        if (!chatId) return;
        await loadChatList();
        const chat = chatCache.get(chatId);
        const info = chat ? getDisplayInfo(chat, getCurrentUser().id) : { title: 'Sohbet' };
        openChatView(chatId, info.title);
    }

    async function markChatRead(chatId) {
        const currentUser = getCurrentUser();
        await db.collection('chats').doc(chatId).set({
            unreadCounts: { [currentUser.id]: 0 },
            lastReadAt: { [currentUser.id]: new Date().toISOString() }
        }, { merge: true });
    }

    function buildMessageMediaHtml(message) {
        if (message.deleted) {
            return '';
        }
        if (message.type === 'image' && message.mediaUrl) {
            return '<div style="margin-top:10px;"><img src="' + message.mediaUrl + '" alt="Görsel" style="max-width:260px; border-radius:12px;"></div>';
        }
        if (message.type === 'video' && message.mediaUrl) {
            return '<div style="margin-top:10px;"><video controls style="max-width:260px; border-radius:12px;"><source src="' + message.mediaUrl + '" type="' + (message.mediaMime || 'video/mp4') + '"></video></div>';
        }
        if (message.type === 'audio' && message.mediaUrl) {
            return '<div style="margin-top:10px;"><audio controls preload="metadata" src="' + message.mediaUrl + '" style="width:100%;"></audio><div style="margin-top:6px;"><a href="' + message.mediaUrl + '" download="' + safeText(message.text || 'ses-kaydi.wav') + '" class="chat-action-link">İndir</a></div></div>';
        }
        if (message.type === 'call-event') {
            return '<div style="margin-top:10px; color:#48627c;">' + safeText(message.callStatusText || 'Arama olayı') + '</div>';
        }
        return '';
    }

    function renderMessages(messages, chat) {
        const currentUser = getCurrentUser();
        const container = document.getElementById(config.messagesId);
        if (!container) return;
        const visibleMessages = messages.filter(message => !message.deletedByCleanup);
        if (!visibleMessages.length) {
            container.innerHTML = '<div class="chat-empty-state">Henüz mesaj yok.</div>';
            return;
        }
        let lastDay = '';
        container.innerHTML = visibleMessages.map(message => {
            const date = new Date(message.timestamp || message.createdAt || 0);
            const day = date.toLocaleDateString('tr-TR');
            const showDay = day !== lastDay;
            lastDay = day;
            const mine = message.senderId === currentUser.id;
            const sender = getParticipantInfo(chat, message.senderId);
            const messageBody = message.deleted ? '<em>Bu mesaj silindi</em>' : safeText(message.text || '');
            const messageActions = mine && !message.deleted
                ? '<div class="chat-message-actions"><button type="button" class="chat-action-link" onclick="window.editChatMessage(\'' + message.id + '\')">Düzenle</button><button type="button" class="chat-action-link" onclick="window.deleteChatMessage(\'' + message.id + '\')">Sil</button></div>'
                : '';
            return (showDay ? '<div class="chat-day-separator">' + safeText(day) + '</div>' : '')
                + '<div class="chat-message-row ' + (mine ? 'is-mine' : 'is-theirs') + '"><div class="chat-message-wrap"><div class="chat-message-meta">'
                + (!mine ? renderAvatar(sender.name, sender.photoUrl) : '')
                + '<span>' + safeText(sender.name) + '</span>'
                + (sender.clubName ? '<span>' + safeText(sender.clubName) + '</span>' : '')
                + '<span>' + safeText(getRoleLabel(sender.role)) + '</span>'
                + (sender.email ? '<span>' + safeText(sender.email) + '</span>' : '')
                + '<span>' + safeText(date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })) + (message.editedAt ? ' • düzenlendi' : '') + '</span></div>'
                + '<div class="chat-bubble"><div>' + messageBody + '</div>'
                + buildMessageMediaHtml(message)
                + messageActions
                + '</div></div></div>';
        }).join('');
        container.scrollTop = container.scrollHeight;
    }

    function getGroupCreatorId(chat) {
        if (!chat) return '';
        return chat.createdBy || chat.ownerId || (Array.isArray(chat.adminIds) && chat.adminIds.length ? chat.adminIds[0] : '') || '';
    }

    function ensureGroupAdminIds(chat) {
        const creatorId = getGroupCreatorId(chat);
        const nextAdmins = Array.from(new Set((chat && Array.isArray(chat.adminIds) ? chat.adminIds : []).filter(Boolean)));
        if (creatorId && !nextAdmins.includes(creatorId)) {
            nextAdmins.unshift(creatorId);
        }
        return nextAdmins;
    }

    function isGroupManager(chat, userId) {
        if (!chat || chat.type !== 'group' || !userId) return false;
        const creatorId = getGroupCreatorId(chat);
        return creatorId === userId || ensureGroupAdminIds(chat).includes(userId);
    }

    function getGroupRoleText(chat, userId) {
        if (!chat || !userId) return 'Uye';
        const creatorId = getGroupCreatorId(chat);
        if (creatorId === userId) return 'Kurucu Yonetici';
        if (ensureGroupAdminIds(chat).includes(userId)) return 'Yonetici';
        return 'Uye';
    }

    function isOneToOneChat(chat) {
        if (!chat) return false;
        if (chat.type === 'group') return false;
        const participantCount = Array.isArray(chat.userIds) ? chat.userIds.filter(Boolean).length : 0;
        return participantCount === 2 || chat.type === 'direct' || chat.type === 'credit-purchase';
    }

    function toggleElementVisibility(element, visible, displayValue) {
        if (!element) return;
        element.style.display = visible ? (displayValue || '') : 'none';
    }

    function setElementDisabled(element, disabled) {
        if (!element) return;
        element.disabled = !!disabled;
        element.style.background = disabled ? '#f5f7fa' : '';
        element.style.cursor = disabled ? 'not-allowed' : '';
    }
    function getChatValueTimestamp(value) {
        if (!value) return 0;
        if (typeof value.toDate === 'function') {
            const timestamp = value.toDate().getTime();
            return Number.isFinite(timestamp) ? timestamp : 0;
        }
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : 0;
        }
        if (value && typeof value.seconds === 'number') {
            return value.seconds * 1000;
        }
        const timestamp = new Date(value).getTime();
        return Number.isFinite(timestamp) ? timestamp : 0;
    }

    async function fetchChatById(chatId) {
        if (!chatId) return null;
        const doc = await db.collection('chats').doc(chatId).get();
        if (!doc.exists) return null;
        const chat = { id: doc.id, ...doc.data() };
        chatCache.set(chatId, chat);
        return chat;
    }

    async function handleExternalProfileUpdate(event) {
        const detail = event && event.detail ? event.detail : null;
        if (!detail || !detail.userId) return;
        const cached = userProfileCache.get(detail.userId) || {};
        userProfileCache.set(detail.userId, {
            ...cached,
            id: detail.userId,
            name: detail.name || cached.name || 'Kullanıcı',
            email: detail.email || cached.email || '',
            photoUrl: detail.photoUrl || '',
            clubName: cached.clubName || ''
        });

        if (detail.userId === getCurrentUser().id) {
            currentIdentity = {
                ...(currentIdentity || {}),
                fullName: detail.name || (currentIdentity && currentIdentity.fullName) || '',
                clubName: (currentIdentity && currentIdentity.clubName) || ''
            };
        }

        if (activeChatId) {
            await loadChatMessages(activeChatId);
        }
        await loadChatList();
        updateChatActionButtons();
    }

    function bindPersistentActionButton(button, actionName) {
        if (!button) return;
        button.type = 'button';
        button.dataset.chatAction = actionName;
        button.onclick = event => {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            if (actionName === 'cleanup-direct-chat') {
                openChatCleanupMenu();
            } else if (actionName === 'leave-group') {
                leaveActiveGroup();
            }
            return false;
        };
    }

    function bindDelegatedChatActions() {
        if (delegatedChatActionsBound) return;
        document.addEventListener('click', event => {
            const target = event.target && event.target.closest ? event.target.closest('[data-chat-action]') : null;
            if (!target) return;
            const actionName = target.dataset.chatAction;
            if (!actionName) return;
            event.preventDefault();
            event.stopPropagation();
            if (actionName === 'cleanup-direct-chat') {
                openChatCleanupMenu();
            } else if (actionName === 'leave-group') {
                leaveActiveGroup();
            }
        }, true);
        delegatedChatActionsBound = true;
    }

    function getGroupManagementModalTitle() {
        const modal = document.getElementById(config.groupManagementModalId);
        return modal ? modal.querySelector('.modal-header h2, .modal-header span') : null;
    }

    function getChatHeaderActionContainer() {
        if (!config || !config.titleId) return null;
        const titleEl = document.getElementById(config.titleId);
        if (!titleEl || !titleEl.parentElement) return null;
        const header = titleEl.parentElement;
        let actionsContainer = header.querySelector('[data-chat-actions="true"]');
        if (actionsContainer) return actionsContainer;

        const existingButtonWrapper = Array.from(header.children).find(child => {
            if (child === titleEl) return false;
            if (child.matches && child.matches('button')) return true;
            return !!child.querySelector && !!child.querySelector('button');
        });

        if (existingButtonWrapper && existingButtonWrapper !== titleEl) {
            if (existingButtonWrapper.matches && existingButtonWrapper.matches('button')) {
                actionsContainer = document.createElement('div');
                actionsContainer.style.display = 'flex';
                actionsContainer.style.gap = '10px';
                actionsContainer.style.alignItems = 'center';
                actionsContainer.dataset.chatActions = 'true';
                header.appendChild(actionsContainer);
                actionsContainer.appendChild(existingButtonWrapper);
                return actionsContainer;
            }
            existingButtonWrapper.dataset.chatActions = 'true';
            return existingButtonWrapper;
        }

        actionsContainer = document.createElement('div');
        actionsContainer.style.display = 'flex';
        actionsContainer.style.gap = '10px';
        actionsContainer.style.alignItems = 'center';
        actionsContainer.dataset.chatActions = 'true';
        header.appendChild(actionsContainer);
        return actionsContainer;
    }

    function ensureGroupManageButtonElement() {
        if (!config || !config.groupManageButtonId) return null;
        let button = document.getElementById(config.groupManageButtonId);
        const actionsContainer = getChatHeaderActionContainer();
        if (!actionsContainer) return button;

        if (!button) {
            button = document.createElement('button');
            button.id = config.groupManageButtonId;
            button.className = 'btn btn-info btn-sm';
            button.textContent = '⚙️ Grup Ayarlari';
            button.style.display = 'none';
            actionsContainer.insertBefore(button, actionsContainer.firstChild || null);
        } else if (button.parentElement !== actionsContainer) {
            actionsContainer.insertBefore(button, actionsContainer.firstChild || null);
        }

        button.type = 'button';
        button.onclick = event => {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            openGroupManagement();
            return false;
        };
        return button;
    }

    function updateGroupManagementUi(chat) {
        if (!chat || chat.type !== 'group') return;
        const currentUser = getCurrentUser();
        const isMember = (chat.userIds || []).includes(currentUser.id);
        const isCreator = getGroupCreatorId(chat) === currentUser.id;
        const canManage = isGroupManager(chat, currentUser.id);
        const canLeave = isMember && !isCreator;
        const nameInput = document.getElementById(config.groupManageNameId);
        const photoInput = document.getElementById(config.groupManagePhotoId);
        const descriptionInput = document.getElementById(GROUP_MANAGE_DESCRIPTION_ID);
        const addMemberInput = document.getElementById(config.groupAddMemberEmailId);
        const messagingModeSelect = document.getElementById('chatGroupMessagingModeManage');
        const scheduledInput = document.getElementById('chatGroupScheduledAtManage');
        const infoBox = document.getElementById(GROUP_INFO_BOX_ID);
        const roleHint = document.getElementById(GROUP_ROLE_HINT_ID);
        const leaveButton = document.getElementById(GROUP_LEAVE_BUTTON_ID);
        const deleteButton = document.getElementById(GROUP_DELETE_BUTTON_ID);
        const titleEl = getGroupManagementModalTitle();

        if (titleEl) titleEl.textContent = 'Grup Ayarlari';
        if (infoBox) {
            infoBox.innerHTML = '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px;">'
                + '<div style="padding:10px 12px; border:1px solid #e5ebf1; border-radius:10px; background:#fbfdff;"><div style="font-size:0.78rem; color:#708090;">Rolunuz</div><div style="font-weight:700; color:#22313f;">' + safeText(getGroupRoleText(chat, currentUser.id)) + '</div></div>'
                + '<div style="padding:10px 12px; border:1px solid #e5ebf1; border-radius:10px; background:#fbfdff;"><div style="font-size:0.78rem; color:#708090;">Uyeler</div><div style="font-weight:700; color:#22313f;">' + safeText(String((chat.userIds || []).length)) + '</div></div>'
                + '<div style="padding:10px 12px; border:1px solid #e5ebf1; border-radius:10px; background:#fbfdff;"><div style="font-size:0.78rem; color:#708090;">Mesajlasma</div><div style="font-weight:700; color:#22313f;">' + safeText(chat.groupSettings && chat.groupSettings.messagingMode === 'admins' ? 'Sadece yoneticiler' : 'Herkes') + '</div></div>'
                + '</div>';
        }
        if (roleHint) {
            roleHint.textContent = isCreator
                ? 'Gruptan ayrilmak icin once kuruculugu baska bir uyeye devretmelisiniz.'
                : (canManage ? 'Bu ekranda uye yonetimi ve grup ayarlari yapabilirsiniz.' : 'Bu ekranda grup bilgilerini gorebilir, alttan gruptan cikabilirsiniz.');
        }

        setElementDisabled(nameInput, !canManage);
        setElementDisabled(photoInput, !canManage);
        setElementDisabled(descriptionInput, !canManage);
        setElementDisabled(addMemberInput, !canManage);
        setElementDisabled(messagingModeSelect, !canManage);
        setElementDisabled(scheduledInput, !canManage);

        toggleElementVisibility(document.getElementById(GROUP_PHOTO_SECTION_ID), canManage, '');
        toggleElementVisibility(document.getElementById(GROUP_ADD_MEMBER_SECTION_ID), canManage, '');
        toggleElementVisibility(document.getElementById(GROUP_MANAGE_PERMISSION_SECTION_ID), canManage, '');
        toggleElementVisibility(document.getElementById(GROUP_MANAGE_SCHEDULE_SECTION_ID), canManage, '');
        toggleElementVisibility(deleteButton, canManage, '');
        toggleElementVisibility(leaveButton, canLeave, '');
    }

    function ensureDirectChatCleanupButton() {
        if (!config || !config.titleId) return null;
        const buttonId = config.titleId + 'CleanupBtn';
        let button = document.getElementById(buttonId);
        if (button) {
            bindPersistentActionButton(button, 'cleanup-direct-chat');
            return button;
        }

        const groupManageBtn = ensureGroupManageButtonElement();
        const actionsContainer = getChatHeaderActionContainer();
        if (!actionsContainer) return null;

        button = document.createElement('button');
        button.type = 'button';
        button.id = buttonId;
        button.className = 'btn btn-warning btn-sm';
        button.textContent = '🧹 Sohbeti Temizle';
        button.style.display = 'none';
        bindPersistentActionButton(button, 'cleanup-direct-chat');
        actionsContainer.insertBefore(button, groupManageBtn || actionsContainer.lastElementChild || null);
        return button;
    }

    function ensureLeaveGroupButton() {
        if (!config || !config.titleId) return null;
        const buttonId = config.titleId + 'LeaveGroupBtn';
        let button = document.getElementById(buttonId);
        if (button) {
            bindPersistentActionButton(button, 'leave-group');
            return button;
        }

        const groupManageBtn = ensureGroupManageButtonElement();
        const actionsContainer = getChatHeaderActionContainer();
        if (!actionsContainer) return null;

        button = document.createElement('button');
        button.type = 'button';
        button.id = buttonId;
        button.className = 'btn btn-secondary btn-sm';
        button.textContent = 'Gruptan Çık';
        button.style.display = 'none';
        bindPersistentActionButton(button, 'leave-group');
        actionsContainer.insertBefore(button, groupManageBtn || actionsContainer.lastElementChild || null);
        return button;
    }

    function updateChatActionButtons() {
        const groupButton = ensureGroupManageButtonElement();
        const clearButton = ensureDirectChatCleanupButton();
        const leaveButton = ensureLeaveGroupButton();
        const currentUser = getCurrentUser();
        const chat = activeChatId ? chatCache.get(activeChatId) : null;
        const isGroupMember = chat && chat.type === 'group' && (chat.userIds || []).includes(currentUser.id);

        if (groupButton) {
            groupButton.textContent = '⚙️ Grup Ayarlari';
            groupButton.style.display = isGroupMember ? '' : 'none';
        }

        if (clearButton) {
            clearButton.style.display = isOneToOneChat(chat) ? '' : 'none';
        }

        if (leaveButton) {
            leaveButton.style.display = 'none';
        }
    }

    async function loadChatMessages(chatId) {
        const container = document.getElementById(config.messagesId);
        if (!container) return;
        container.innerHTML = '<div class="chat-empty-state">Mesajlar yükleniyor...</div>';
        if (activeChatUnsub) activeChatUnsub();
        if (activeChatDocUnsub) activeChatDocUnsub();
        activeChatMessagesCache = [];
        activeChatDocUnsub = db.collection('chats').doc(chatId).onSnapshot(snapshot => {
            if (!snapshot.exists) return;
            const chat = { id: snapshot.id, ...snapshot.data() };
            chatCache.set(chatId, chat);
            renderMessages(activeChatMessagesCache, chat);
            updateGroupManageButton();
        }, error => {
            console.error('Sohbet bilgisi yüklenemedi:', error);
        });
        activeChatUnsub = db.collection('chats').doc(chatId).collection('messages').orderBy('timestamp').onSnapshot(async snapshot => {
            activeChatMessagesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const chat = chatCache.get(chatId) || await fetchChatById(chatId);
            if (!chat) return;
            renderMessages(activeChatMessagesCache, chat);
            await markChatRead(chatId);
            updateGroupManageButton();
        }, error => {
            console.error('Mesajlar yüklenemedi:', error);
            container.innerHTML = '<div class="chat-empty-state" style="color:#c0392b;">Mesajlar yüklenemedi.</div>';
        });
    }

    async function openChatView(chatId, title) {
        activeChatId = chatId;
        const chat = await fetchChatById(chatId);
        setPageVisible(config.listPageId, false);
        setPageVisible(config.viewPageId, true);
        const titleEl = document.getElementById(config.titleId);
        if (titleEl) titleEl.textContent = title || (chat ? getDisplayInfo(chat, getCurrentUser().id).title : 'Sohbet');
        updateChatActionButtons();
        await loadChatMessages(chatId);
        await loadChatList();
        updateChatActionButtons();
    }

    function closeChatView() {
        setPageVisible(config.viewPageId, false);
        setPageVisible(config.listPageId, true);
        if (activeChatUnsub) activeChatUnsub();
        if (activeChatDocUnsub) activeChatDocUnsub();
        activeChatUnsub = null;
        activeChatDocUnsub = null;
        activeChatMessagesCache = [];
        activeChatId = null;
        activeGroupId = null;
        updateGroupManageButton();
    }

    async function handleAttachmentSelection(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        clearAttachmentPreview();
        selectedAttachment = {
            file,
            previewUrl: URL.createObjectURL(file),
            mime: file.type,
            kind: file.type.startsWith('video/') ? 'video' : 'image',
            fileName: file.name
        };
        renderAttachmentPreview(selectedAttachment, file.name + ' hazır');
    }

    async function toggleVoiceRecording() {
        if (isVoiceRecording) {
            try {
                await stopVoiceRecording();
            } catch (error) {
                console.error('Ses kaydı durdurulamadı:', error);
                alert('Ses kaydı tamamlanamadı: ' + error.message);
                clearAttachmentPreview();
            }
            return;
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Ses kaydı desteklenmiyor.');
            return;
        }
        try {
            await startVoiceRecording();
        } catch (error) {
            console.error('Ses kaydı başlatılamadı:', error);
            alert('Ses kaydı başlatılamadı: ' + error.message);
        }
    }

    async function handleSendMessage(event) {
        event.preventDefault();
        const currentUser = getCurrentUser();
        const input = document.getElementById(config.inputId);
        const chat = activeChatId ? chatCache.get(activeChatId) : null;
        if (!chat) return;
        if (chat.type === 'group' && chat.groupSettings && chat.groupSettings.messagingMode === 'admins' && !ensureGroupAdminIds(chat).includes(currentUser.id)) {
            alert('Bu grupta yalnızca yöneticiler mesaj gönderebilir.');
            return;
        }
        const text = String(input ? input.value : '').trim();
        if (!text && !selectedAttachment) return;
        const payload = {
            senderId: currentUser.id,
            senderName: currentUser.name,
            senderEmail: currentUser.email,
            senderClubName: currentUser.clubName || '',
            text,
            timestamp: new Date().toISOString(),
            deleted: false,
            type: selectedAttachment ? selectedAttachment.kind : 'text'
        };
        try {
            if (selectedAttachment) {
                if (selectedAttachment.file) {
                    payload.mediaUrl = await uploadChatAttachment(selectedAttachment.file, selectedAttachment.kind);
                } else {
                    payload.mediaUrl = selectedAttachment.dataUrl;
                }
                payload.mediaMime = selectedAttachment.mime;
                if (!payload.text) payload.text = selectedAttachment.fileName || '';
            }
            await db.collection('chats').doc(activeChatId).collection('messages').add(payload);
        } catch (error) {
            console.error('Mesaj gönderilemedi:', error);
            alert('Mesaj gönderilemedi: ' + error.message);
            return;
        }
        const unreadCounts = {};
        (chat.userIds || []).forEach(id => {
            if (id !== currentUser.id) unreadCounts[id] = ((chat.unreadCounts && chat.unreadCounts[id]) || 0) + 1;
        });
        await db.collection('chats').doc(activeChatId).set({
            updatedAt: new Date().toISOString(),
            lastMessage: payload.text || payload.type,
            unreadCounts
        }, { merge: true });
        if (input) input.value = '';
        clearAttachmentPreview();
        await loadChatList();
    }

    async function editChatMessage(messageId) {
        if (!activeChatId) return;
        const doc = await db.collection('chats').doc(activeChatId).collection('messages').doc(messageId).get();
        if (!doc.exists) return;
        const newText = prompt('Mesajı düzenle:', doc.data().text || '');
        if (newText === null) return;
        await db.collection('chats').doc(activeChatId).collection('messages').doc(messageId).update({ text: newText, editedAt: new Date().toISOString() });
    }

    async function deleteChatMessage(messageId) {
        if (!activeChatId) return;
        await db.collection('chats').doc(activeChatId).collection('messages').doc(messageId).update({ text: '', deleted: true, deletedAt: new Date().toISOString(), mediaUrl: firebase.firestore.FieldValue.delete(), mediaMime: firebase.firestore.FieldValue.delete() });
    }

    async function chatEmailLookupUser(event) {
        const info = document.getElementById(config.newChatInfoId);
        const email = String(event.target.value || '').trim().toLowerCase();
        if (!info) return;
        if (!email) {
            info.textContent = '';
            return;
        }
        const user = await lookupUserByEmail(email);
        if (!user) {
            info.textContent = 'Kullanıcı bulunamadı';
            info.style.color = '#c0392b';
            return;
        }
        info.textContent = [user.name, user.clubName || 'Kulüp bilgisi yok', getRoleLabel(user.role)].join(' • ');
        info.style.color = '#2980b9';
    }

    function openNewChatEmailPage() {
        setPageVisible(config.listPageId, false);
        setPageVisible(config.newChatPageId, true);
        loadUserDirectory();
    }

    function closeNewChatEmailPage() {
        setPageVisible(config.newChatPageId, false);
        setPageVisible(config.listPageId, true);
    }

    async function submitNewChatByEmail(event) {
        event.preventDefault();
        const emailInput = document.getElementById(config.newChatEmailId);
        const email = String(emailInput ? emailInput.value : '').trim().toLowerCase();
        if (!email) return;
        const user = await lookupUserByEmail(email);
        if (!user) {
            alert('Kullanıcı bulunamadı.');
            return;
        }
        const chatId = await ensureDirectChat(user.id);
        closeNewChatEmailPage();
        await loadChatList();
        openChatView(chatId, user.name);
    }

    function openNewGroupChatModal() {
        const modal = document.getElementById(config.newGroupModalId);
        if (modal) modal.style.display = 'flex';
    }

    function closeNewGroupChatModal() {
        const modal = document.getElementById(config.newGroupModalId);
        const form = document.getElementById(config.newGroupFormId);
        if (modal) modal.style.display = 'none';
        if (form) form.reset();
    }

    function ensureFormExtras() {
        function findDirectChildAnchor(container, node) {
            let current = node || null;
            while (current && current.parentElement && current.parentElement !== container) {
                current = current.parentElement;
            }
            return current && current.parentElement === container ? current : null;
        }

        function insertBeforeLastChild(container, node) {
            const reference = container ? container.lastElementChild : null;
            if (!container) return;
            container.insertBefore(node, reference || null);
        }

        const groupForm = document.getElementById(config.newGroupFormId);
        if (groupForm && !groupForm.querySelector('#chatGroupPermissionSelect')) {
            const description = document.createElement('div');
            description.className = 'form-group';
            description.innerHTML = '<label>Grup Aciklamasi</label><textarea id="' + GROUP_CREATE_DESCRIPTION_ID + '" rows="3" placeholder="Bu grubun amaci veya kisa aciklamasi..."></textarea>';
            const permission = document.createElement('div');
            permission.id = GROUP_CREATE_PERMISSION_SECTION_ID;
            permission.className = 'form-group';
            permission.innerHTML = '<label>Mesajlaşma İzni</label><select id="chatGroupPermissionSelect"><option value="all">Herkes mesaj atabilir</option><option value="admins">Sadece yöneticiler mesaj atabilir</option></select>';
            const scheduled = document.createElement('div');
            scheduled.id = GROUP_CREATE_SCHEDULE_SECTION_ID;
            scheduled.className = 'form-group';
            scheduled.innerHTML = '<label>Planlı Başlangıç (opsiyonel)</label><input type="datetime-local" id="chatGroupScheduledAt">';
            insertBeforeLastChild(groupForm, description);
            insertBeforeLastChild(groupForm, permission);
            insertBeforeLastChild(groupForm, scheduled);
        }

        const manageForm = document.getElementById(config.groupManagementFormId);
        if (manageForm && !manageForm.querySelector('#chatGroupMessagingModeManage')) {
            const info = document.createElement('div');
            info.id = GROUP_INFO_BOX_ID;
            info.style.cssText = 'padding:12px; border:1px solid #dbe4ee; border-radius:12px; background:#f8fbff;';
            const roleHint = document.createElement('div');
            roleHint.id = GROUP_ROLE_HINT_ID;
            roleHint.style.cssText = 'margin-top:6px; font-size:0.9rem; color:#5e7286;';
            const nameInput = manageForm.querySelector('#' + config.groupManageNameId);
            const nameAnchor = findDirectChildAnchor(manageForm, nameInput);
            if (nameAnchor) {
                manageForm.insertBefore(info, nameAnchor);
                manageForm.insertBefore(roleHint, nameAnchor.nextSibling);
            } else {
                manageForm.insertBefore(info, manageForm.firstChild);
                manageForm.insertBefore(roleHint, info.nextSibling);
            }

            const description = document.createElement('div');
            description.className = 'form-group';
            description.innerHTML = '<label>Grup Aciklamasi</label><textarea id="' + GROUP_MANAGE_DESCRIPTION_ID + '" rows="3" placeholder="Bu grubun amaci veya kisa aciklamasi..."></textarea>';
            if (nameAnchor) {
                manageForm.insertBefore(description, nameAnchor.nextSibling);
            } else {
                manageForm.insertBefore(description, manageForm.firstChild);
            }

            const permission = document.createElement('div');
            permission.id = GROUP_MANAGE_PERMISSION_SECTION_ID;
            permission.className = 'form-group';
            permission.innerHTML = '<label>Mesajlaşma İzni</label><select id="chatGroupMessagingModeManage"><option value="all">Herkes mesaj atabilir</option><option value="admins">Sadece yöneticiler mesaj atabilir</option></select>';
            const scheduled = document.createElement('div');
            scheduled.id = GROUP_MANAGE_SCHEDULE_SECTION_ID;
            scheduled.className = 'form-group';
            scheduled.innerHTML = '<label>Planlı Başlangıç</label><input type="datetime-local" id="chatGroupScheduledAtManage">';
            insertBeforeLastChild(manageForm, permission);
            insertBeforeLastChild(manageForm, scheduled);
            const photoInput = manageForm.querySelector('#' + config.groupManagePhotoId);
            if (photoInput && photoInput.parentElement) photoInput.parentElement.id = GROUP_PHOTO_SECTION_ID;
            const addMemberInput = manageForm.querySelector('#' + config.groupAddMemberEmailId);
            if (addMemberInput && addMemberInput.parentElement) addMemberInput.parentElement.id = GROUP_ADD_MEMBER_SECTION_ID;
            const row = manageForm.querySelector('.btn-group') || manageForm.querySelector('div[style*="justify-content:flex-end"]');
            if (row) {
                let button = document.getElementById(GROUP_LEAVE_BUTTON_ID);
                if (!button) {
                    button = document.createElement('button');
                    button.id = GROUP_LEAVE_BUTTON_ID;
                    button.className = 'btn btn-warning';
                    button.textContent = 'Gruptan Çık';
                    button.style.display = 'none';
                    row.insertBefore(button, row.firstChild);
                }
                bindPersistentActionButton(button, 'leave-group');
            }
            if (row) {
                const deleteButton = row.querySelector('button.btn-danger');
                if (deleteButton) deleteButton.id = GROUP_DELETE_BUTTON_ID;
            }
        }

        if (manageForm) {
            const row = manageForm.querySelector('.btn-group') || manageForm.querySelector('div[style*="justify-content:flex-end"]');
            const existingLeaveButton = row ? row.querySelector('#' + GROUP_LEAVE_BUTTON_ID) : null;
            if (existingLeaveButton) {
                bindPersistentActionButton(existingLeaveButton, 'leave-group');
            }
        }
    }

    async function submitNewGroupChat(event) {
        event.preventDefault();
        const currentUser = getCurrentUser();
        const name = document.getElementById(config.groupNameId).value.trim();
        const description = document.getElementById(GROUP_CREATE_DESCRIPTION_ID) ? document.getElementById(GROUP_CREATE_DESCRIPTION_ID).value.trim() : '';
        const emails = document.getElementById(config.groupEmailsId).value.split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
        if (!name) {
            alert('Grup adı zorunludur.');
            return;
        }
        const permission = document.getElementById('chatGroupPermissionSelect') ? document.getElementById('chatGroupPermissionSelect').value : 'all';
        const scheduledAt = document.getElementById('chatGroupScheduledAt') ? document.getElementById('chatGroupScheduledAt').value : '';
        const photoInput = document.getElementById(config.groupPhotoId);
        const allEmails = Array.from(new Set([currentUser.email].concat(emails)));
        const users = {};
        const userIds = [];
        for (const email of allEmails) {
            const user = email === currentUser.email ? currentUser : await lookupUserByEmail(email);
            if (!user) {
                alert('Kullanıcı bulunamadı: ' + email);
                return;
            }
            if (!userIds.includes(user.id)) {
                userIds.push(user.id);
                users[user.id] = { name: user.name, role: user.role, email: user.email, photoUrl: user.photoUrl || '', clubName: user.clubName || '' };
            }
        }
        let photoUrl = '';
        if (photoInput && photoInput.files && photoInput.files[0]) {
            photoUrl = await fileToDataUrl(photoInput.files[0]);
        }
        const doc = await db.collection('chats').add({
            type: 'group',
            groupName: name,
            groupDescription: description,
            userIds,
            users,
            userEmails: allEmails,
            adminIds: [currentUser.id],
            createdBy: currentUser.id,
            photoUrl,
            groupSettings: { messagingMode: permission, scheduledAt: scheduledAt || null },
            status: scheduledAt ? 'planned' : 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            unreadCounts: {}
        });
        await db.collection('chats').doc(doc.id).collection('messages').add({ senderId: currentUser.id, senderName: currentUser.name, senderEmail: currentUser.email, senderClubName: currentUser.clubName || '', text: scheduledAt ? 'Grup sohbeti planlandı.' : 'Grup sohbeti oluşturuldu.', type: 'system', timestamp: new Date().toISOString() });
        closeNewGroupChatModal();
        await loadChatList();
        openChatView(doc.id, name);
    }

    function updateGroupManageButton() {
        updateChatActionButtons();
    }

    function renderGroupMembers(chat) {
        const list = document.getElementById(config.groupMembersListId);
        const currentUser = getCurrentUser();
        if (!list) return;
        const creatorId = getGroupCreatorId(chat);
        const normalizedAdmins = ensureGroupAdminIds(chat);
        const currentUserIsCreator = creatorId === currentUser.id;
        list.innerHTML = (chat.userIds || []).map(userId => {
            const info = getParticipantInfo(chat, userId);
            const isCreator = creatorId === userId;
            const isAdmin = normalizedAdmins.includes(userId);
            const canManage = isGroupManager(chat, currentUser.id) && userId !== currentUser.id && !isCreator;
            const canTransferOwnership = currentUserIsCreator && userId !== currentUser.id;
            return '<div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #eef2f6;">'
                + '<div><div style="font-weight:600;">' + safeText(info.name) + '</div><div style="font-size:0.82rem; color:#6f8091;">' + safeText([info.clubName || 'Kulüp bilgisi yok', getRoleLabel(info.role), info.email].filter(Boolean).join(' • ')) + '</div></div>'
                + '<div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;">'
                + '<span class="chat-member-badge">' + (isCreator ? 'Kurucu Yönetici' : (isAdmin ? 'Yönetici' : 'Üye')) + '</span>'
                + (canTransferOwnership ? '<button type="button" class="btn btn-warning btn-sm" onclick="window.transferGroupOwnership(\'' + userId + '\')">Kuruculugu Devret</button>' : '')
                + (canManage ? '<button type="button" class="btn btn-info btn-sm" onclick="window.toggleGroupAdmin(\'' + userId + '\')">' + (isAdmin ? 'Yetkiyi Al' : 'Yonetici Yap') + '</button><button type="button" class="btn btn-danger btn-sm" onclick="window.removeGroupMember(\'' + userId + '\')">Cikar</button>' : '')
                + '</div></div>';
        }).join('');
    }

    async function openGroupManagement(chatId) {
        if (chatId) {
            activeChatId = chatId;
        }
        if (!activeChatId) return;
        const modal = document.getElementById(config.groupManagementModalId);
        const doc = await db.collection('chats').doc(activeChatId).get();
        if (!doc.exists) return;
        const chat = { id: doc.id, ...doc.data() };
        if (chat.type !== 'group' || !(chat.userIds || []).includes(getCurrentUser().id)) {
            alert('Bu grup bilgilerine yalnizca grup uyeleri erisebilir.');
            return;
        }
        chatCache.set(chat.id, chat);
        activeGroupId = chat.id;
        if (modal) modal.dataset.chatId = chat.id;
        document.getElementById(config.groupManageNameId).value = chat.groupName || '';
        const descriptionField = document.getElementById(GROUP_MANAGE_DESCRIPTION_ID);
        if (descriptionField) descriptionField.value = chat.groupDescription || '';
        const currentPhoto = document.getElementById(config.groupCurrentPhotoId);
        if (currentPhoto) currentPhoto.src = chat.photoUrl || '';
        const mode = document.getElementById('chatGroupMessagingModeManage');
        if (mode) mode.value = chat.groupSettings && chat.groupSettings.messagingMode ? chat.groupSettings.messagingMode : 'all';
        const scheduled = document.getElementById('chatGroupScheduledAtManage');
        if (scheduled) scheduled.value = chat.groupSettings && chat.groupSettings.scheduledAt ? new Date(chat.groupSettings.scheduledAt).toISOString().slice(0, 16) : '';
        renderGroupMembers(chat);
        updateGroupManagementUi(chat);
        if (modal) modal.style.display = 'flex';
    }

    function closeGroupManagementModal() {
        const modal = document.getElementById(config.groupManagementModalId);
        if (modal) {
            modal.style.display = 'none';
            delete modal.dataset.chatId;
        }
        activeGroupId = null;
    }

    function getManagedGroupId() {
        const modal = document.getElementById(config.groupManagementModalId);
        const modalChatId = modal && modal.dataset ? modal.dataset.chatId : '';
        return modalChatId || activeGroupId || activeChatId || '';
    }

    async function saveGroupChanges(event) {
        event.preventDefault();
        if (!activeGroupId) return;
        const chat = chatCache.get(activeGroupId);
        if (!isGroupManager(chat, getCurrentUser().id)) {
            alert('Bu grubu yalnızca kurucu veya yönetici düzenleyebilir.');
            return;
        }
        const updates = {
            groupName: document.getElementById(config.groupManageNameId).value.trim(),
            groupDescription: document.getElementById(GROUP_MANAGE_DESCRIPTION_ID) ? document.getElementById(GROUP_MANAGE_DESCRIPTION_ID).value.trim() : '',
            updatedAt: new Date().toISOString(),
            groupSettings: {
                ...(chat && chat.groupSettings ? chat.groupSettings : {}),
                messagingMode: document.getElementById('chatGroupMessagingModeManage') ? document.getElementById('chatGroupMessagingModeManage').value : 'all',
                scheduledAt: document.getElementById('chatGroupScheduledAtManage') ? document.getElementById('chatGroupScheduledAtManage').value || null : null
            }
        };
        const photoInput = document.getElementById(config.groupManagePhotoId);
        if (photoInput && photoInput.files && photoInput.files[0]) {
            updates.photoUrl = await fileToDataUrl(photoInput.files[0]);
        }
        await db.collection('chats').doc(activeGroupId).set(updates, { merge: true });
        chatCache.set(activeGroupId, { ...(chat || {}), ...updates });
        closeGroupManagementModal();
        await loadChatList();
        if (activeChatId === activeGroupId) await loadChatMessages(activeGroupId);
    }

    async function transferGroupOwnership(userId) {
        if (!activeGroupId) return;
        const chat = chatCache.get(activeGroupId);
        const currentUser = getCurrentUser();
        if (!chat) return;
        if (getGroupCreatorId(chat) !== currentUser.id) {
            alert('Kuruculuk devrini sadece mevcut kurucu yapabilir.');
            return;
        }
        if (!(chat.userIds || []).includes(userId)) {
            alert('Secilen kullanici grupta bulunmuyor.');
            return;
        }
        if (userId === currentUser.id) {
            alert('Zaten grubun kurucususunuz.');
            return;
        }
        const targetInfo = getParticipantInfo(chat, userId);
        if (!confirm('Kuruculuk ' + (targetInfo.name || 'secilen uye') + ' kullanicisina devredilecek. Devam edilsin mi?')) {
            return;
        }

        const nextAdmins = Array.from(new Set([userId].concat(ensureGroupAdminIds(chat))));
        const updatedAt = new Date().toISOString();
        await db.collection('chats').doc(activeGroupId).set({
            createdBy: userId,
            ownerId: userId,
            adminIds: nextAdmins,
            updatedAt
        }, { merge: true });
        await db.collection('chats').doc(activeGroupId).collection('messages').add({
            senderId: currentUser.id,
            senderName: currentUser.name,
            senderEmail: currentUser.email,
            senderClubName: currentUser.clubName || '',
            text: (targetInfo.name || 'Secilen uye') + ' yeni kurucu olarak atandi.',
            type: 'system',
            timestamp: updatedAt
        });

        chat.createdBy = userId;
        chat.ownerId = userId;
        chat.adminIds = nextAdmins;
        chat.updatedAt = updatedAt;
        chatCache.set(activeGroupId, chat);
        renderGroupMembers(chat);
        updateGroupManagementUi(chat);
        updateChatActionButtons();
        await loadChatList();
    }

    async function removeGroupMember(userId) {
        if (!activeGroupId) return;
        const chatDoc = await db.collection('chats').doc(activeGroupId).get();
        if (!chatDoc.exists) {
            alert('Grup bulunamadi.');
            return;
        }
        const chat = { id: chatDoc.id, ...chatDoc.data() };
        chatCache.set(activeGroupId, chat);
        const currentUserId = getCurrentUser().id;
        const isSelfRemoval = userId === currentUserId;
        if (!isSelfRemoval && !isGroupManager(chat, currentUserId)) {
            alert('Bu işlem için grup yöneticisi olmalısınız.');
            return;
        }
        const creatorId = getGroupCreatorId(chat);
        if (userId === creatorId) {
            alert('Grubu kuran kullanıcı gruptan çıkarılamaz.');
            return;
        }
        const nextUserIds = (chat.userIds || []).filter(id => id !== userId);
        const nextUsers = Object.assign({}, chat.users || {});
        delete nextUsers[userId];
        const nextUserEmails = (chat.userEmails || []).filter(email => {
            const lowerEmail = String(email || '').trim().toLowerCase();
            const removedUser = chat.users && chat.users[userId] ? chat.users[userId] : null;
            const removedEmail = removedUser && removedUser.email ? String(removedUser.email).trim().toLowerCase() : '';
            return !removedEmail || lowerEmail !== removedEmail;
        });
        const nextUnreadCounts = Object.assign({}, chat.unreadCounts || {});
        delete nextUnreadCounts[userId];
        let nextAdmins = ensureGroupAdminIds(chat).filter(id => id !== userId && nextUserIds.includes(id));
        if (!nextAdmins.length && creatorId && nextUserIds.includes(creatorId)) nextAdmins = [creatorId];
        if (!nextAdmins.length && nextUserIds.length) nextAdmins = [nextUserIds[0]];
        await db.collection('chats').doc(activeGroupId).set({ userIds: nextUserIds, users: nextUsers, userEmails: nextUserEmails, unreadCounts: nextUnreadCounts, adminIds: nextAdmins, updatedAt: new Date().toISOString() }, { merge: true });
        chat.userIds = nextUserIds;
        chat.users = nextUsers;
        chat.userEmails = nextUserEmails;
        chat.unreadCounts = nextUnreadCounts;
        chat.adminIds = nextAdmins;
        chatCache.set(activeGroupId, chat);
        renderGroupMembers(chat);
        await loadChatList();
    }

    async function toggleGroupAdmin(userId) {
        if (!activeGroupId) return;
        const chat = chatCache.get(activeGroupId);
        if (!chat) return;
        if (!isGroupManager(chat, getCurrentUser().id)) {
            alert('Bu işlem için grup yöneticisi olmalısınız.');
            return;
        }
        const creatorId = getGroupCreatorId(chat);
        if (userId === creatorId) {
            alert('Grubu kuran kullanıcıdan yönetici yetkisi alınamaz.');
            return;
        }
        const adminIds = new Set(ensureGroupAdminIds(chat));
        if (adminIds.has(userId)) adminIds.delete(userId); else adminIds.add(userId);
        if (creatorId) adminIds.add(creatorId);
        if (!adminIds.size) {
            alert('En az bir yönetici kalmalıdır.');
            return;
        }
        const nextAdmins = Array.from(adminIds);
        await db.collection('chats').doc(activeGroupId).set({ adminIds: nextAdmins, updatedAt: new Date().toISOString() }, { merge: true });
        chat.adminIds = nextAdmins;
        renderGroupMembers(chat);
        updateGroupManageButton();
        await loadChatList();
    }

    async function addGroupMember() {
        if (!activeGroupId) return;
        const emailInput = document.getElementById(config.groupAddMemberEmailId);
        const email = String(emailInput ? emailInput.value : '').trim().toLowerCase();
        if (!email) return;
        const user = await lookupUserByEmail(email);
        if (!user) {
            alert('Kullanıcı bulunamadı.');
            return;
        }
        const chat = chatCache.get(activeGroupId);
        if (!isGroupManager(chat, getCurrentUser().id)) {
            alert('Bu işlem için grup yöneticisi olmalısınız.');
            return;
        }
        if (!chat || (chat.userIds || []).includes(user.id)) return;
        const nextUsers = Object.assign({}, chat.users || {}, { [user.id]: { name: user.name, role: user.role, email: user.email, photoUrl: user.photoUrl || '', clubName: user.clubName || '' } });
        const nextUserIds = (chat.userIds || []).concat(user.id);
        await db.collection('chats').doc(activeGroupId).set({ userIds: nextUserIds, users: nextUsers, updatedAt: new Date().toISOString() }, { merge: true });
        chat.userIds = nextUserIds;
        chat.users = nextUsers;
        renderGroupMembers(chat);
        updateGroupManagementUi(chat);
        if (emailInput) emailInput.value = '';
        await loadChatList();
    }

    async function leaveActiveGroup() {
        const currentUser = getCurrentUser();
        const targetGroupId = getManagedGroupId() || activeChatId;
        if (!targetGroupId) return;
        activeGroupId = targetGroupId;
        let chat = chatCache.get(targetGroupId);
        if (!chat) {
            const doc = await db.collection('chats').doc(targetGroupId).get();
            if (!doc.exists) {
                alert('Grup bulunamadi.');
                return;
            }
            chat = { id: doc.id, ...doc.data() };
            chatCache.set(targetGroupId, chat);
        }
        if (chat.type !== 'group' || !(chat.userIds || []).includes(currentUser.id)) {
            alert('Bu gruptan ayrilmak icin once grup uyesi olmalisiniz.');
            return;
        }
        if (getGroupCreatorId(chat) === currentUser.id) {
            alert('Kurucu gruptan ayrilmadan once kuruculugu baska bir uyeye devretmelidir.');
            return;
        }
        if (!confirm('Bu gruptan çıkmak istediğinize emin misiniz?')) {
            return;
        }
        await removeGroupMember(currentUser.id);
        closeGroupManagementModal();
        closeChatView();
        await loadChatList();
    }

    async function deleteManagedGroup() {
        const chatId = getManagedGroupId();
        if (!chatId) {
            alert('Silinecek grup secili degil.');
            return;
        }

        const chat = chatCache.get(chatId);
        if (!isGroupManager(chat, getCurrentUser().id)) {
            alert('Bu grup yalnızca kurucu veya yönetici tarafından silinebilir.');
            return;
        }

        if (!confirm('Bu grup sohbeti kalici olarak silinecek. Emin misiniz?')) return;

        try {
            await db.collection('chats').doc(chatId).delete();
            chatCache.delete(chatId);
            if (activeChatId === chatId) {
                closeChatView();
            }
            activeGroupId = null;
            closeGroupManagementModal();
            await loadChatList();
            alert('Grup silindi.');
        } catch (error) {
            console.error('Grup silinirken hata:', error);
            alert('Grup silinirken hata oluştu: ' + error.message);
        }
    }

    async function cleanupDirectChatMessages(maxAgeMs) {
        if (!activeChatId) return;
        const chat = chatCache.get(activeChatId) || await fetchChatById(activeChatId);
        if (!chat || chat.type !== 'direct') {
            alert('Sohbet temizleme yalnızca birebir sohbetlerde kullanılabilir.');
            return;
        }

        const cutoff = Date.now() - maxAgeMs;
        const snapshot = await db.collection('chats').doc(activeChatId).collection('messages').get();
        const visibleDocs = snapshot.docs.filter(doc => {
            const data = doc.data() || {};
            return !data.deleted;
        });
        let candidates = maxAgeMs === Number.MAX_SAFE_INTEGER
            ? visibleDocs
            : visibleDocs.filter(doc => {
                const data = doc.data() || {};
                const time = getChatValueTimestamp(data.timestamp || data.createdAt);
                return Number.isFinite(time) && time <= cutoff;
            });

        if (!candidates.length) {
            if (!visibleDocs.length) {
                alert('Bu sohbette temizlenecek mesaj bulunamadı.');
                return;
            }
            if (maxAgeMs !== Number.MAX_SAFE_INTEGER && confirm('Seçilen süre için eski mesaj bulunamadı. Görünen tüm mesajları temizlemek ister misiniz?')) {
                candidates = visibleDocs;
            } else {
                alert('Seçilen süre için temizlenecek mesaj bulunamadı.');
                return;
            }
        }

        for (let index = 0; index < candidates.length; index += 400) {
            const batch = db.batch();
            candidates.slice(index, index + 400).forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        }

        const remainingSnapshot = await db.collection('chats').doc(activeChatId).collection('messages').orderBy('timestamp').get();
        const remainingMessages = remainingSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(message => !message.deleted)
            .sort((left, right) => getChatValueTimestamp(left.timestamp || left.createdAt) - getChatValueTimestamp(right.timestamp || right.createdAt));
        const lastVisible = remainingMessages.length ? remainingMessages[remainingMessages.length - 1] : null;
        await db.collection('chats').doc(activeChatId).set({
            lastMessage: lastVisible ? (lastVisible.text || lastVisible.type || 'Mesaj') : '',
            updatedAt: new Date().toISOString()
        }, { merge: true });
        await loadChatList();
        alert(candidates.length + ' mesaj temizlendi.');
    }

    async function openChatCleanupMenu() {
        if (!activeChatId) return;
        const chat = chatCache.get(activeChatId) || await fetchChatById(activeChatId);
        if (!chat || chat.type !== 'direct') {
            alert('Sohbet temizleme yalnızca birebir sohbetlerde kullanılabilir.');
            return;
        }

        const selection = prompt('Temizleme süresini seçin:\n1. 24 saatten eski mesajlar\n2. 48 saatten eski mesajlar\n3. 1 haftadan eski mesajlar\n4. 3 aydan eski mesajlar\n5. Tum mesajlar', '1');
        if (selection === null) return;

        const options = {
            '1': { label: '24 saat', maxAgeMs: 24 * 60 * 60 * 1000 },
            '2': { label: '48 saat', maxAgeMs: 48 * 60 * 60 * 1000 },
            '3': { label: '1 hafta', maxAgeMs: 7 * 24 * 60 * 60 * 1000 },
            '4': { label: '3 ay', maxAgeMs: 90 * 24 * 60 * 60 * 1000 },
            '5': { label: 'tum mesajlar', maxAgeMs: Number.MAX_SAFE_INTEGER }
        };
        const chosen = options[String(selection).trim()];
        if (!chosen) {
            alert('Geçerli bir seçenek seçin.');
            return;
        }

        if (!confirm(chosen.label + ' süreden daha eski mesajlar temizlenecek. Devam edilsin mi?')) {
            return;
        }

        await cleanupDirectChatMessages(chosen.maxAgeMs);
    }

    function getSupportedAudioMimeType() {
        if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
        const candidates = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'];
        return candidates.find(candidate => MediaRecorder.isTypeSupported(candidate)) || '';
    }

    async function startVoiceRecording() {
        voiceRecordingStream = await requestMicrophoneStream();
        recordedChunks = [];

        const recorderMimeType = getSupportedAudioMimeType();
        if (window.MediaRecorder && recorderMimeType) {
            recorder = new MediaRecorder(voiceRecordingStream, {
                mimeType: recorderMimeType,
                audioBitsPerSecond: 8000
            });
            recorder.ondataavailable = event => {
                if (event.data && event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };
            recorder.start(250);
            isVoiceRecording = true;
            startVoiceRecordingTimers();
            console.info('Ses kaydı MediaRecorder ile başlatıldı:', { mimeType: recorderMimeType });
            return;
        }

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            throw new Error('Tarayıcı ses kaydını desteklemiyor.');
        }

        voiceRecordingContext = new AudioContextClass();
        await voiceRecordingContext.resume().catch(() => {});
        voiceRecordingSource = voiceRecordingContext.createMediaStreamSource(voiceRecordingStream);
        voiceRecordingGain = voiceRecordingContext.createGain();
        voiceRecordingGain.gain.value = 0;
        voiceRecordingBuffers = [];

        if (voiceRecordingContext.audioWorklet && chatCommonScriptUrl) {
            try {
                const workletUrl = new URL('./chat-audio-recorder-worklet.js', chatCommonScriptUrl).toString();
                await voiceRecordingContext.audioWorklet.addModule(workletUrl);
                voiceRecordingProcessor = new AudioWorkletNode(voiceRecordingContext, 'pcm-recorder-processor');
                voiceRecordingProcessor.port.onmessage = event => {
                    if (!isVoiceRecording || !event.data) return;
                    voiceRecordingBuffers.push(new Float32Array(event.data));
                };
            } catch (error) {
                console.warn('AudioWorklet baslatilamadi, ScriptProcessor fallback kullaniliyor:', error.message);
            }
        }

        if (!voiceRecordingProcessor) {
            voiceRecordingProcessor = voiceRecordingContext.createScriptProcessor(4096, 1, 1);
            voiceRecordingProcessor.onaudioprocess = event => {
                if (!isVoiceRecording) return;
                const input = event.inputBuffer.getChannelData(0);
                voiceRecordingBuffers.push(new Float32Array(input));
            };
        }

        voiceRecordingSource.connect(voiceRecordingProcessor);
        voiceRecordingProcessor.connect(voiceRecordingGain);
        voiceRecordingGain.connect(voiceRecordingContext.destination);
        isVoiceRecording = true;
        startVoiceRecordingTimers();
    }

    async function stopVoiceRecording() {
        if (!voiceRecordingStream) {
            throw new Error('Aktif bir ses kaydı bulunamadı.');
        }

        clearVoiceRecordingTimers();
        isVoiceRecording = false;

        if (recorder && recorder.state !== 'inactive') {
            const activeRecorder = recorder;
            const activeStream = voiceRecordingStream;
            const mimeType = activeRecorder.mimeType || 'audio/webm';

            const blob = await new Promise((resolve, reject) => {
                activeRecorder.onstop = () => {
                    try {
                        resolve(new Blob(recordedChunks, { type: mimeType }));
                    } catch (error) {
                        reject(error);
                    }
                };
                activeRecorder.onerror = event => {
                    reject((event && event.error) || new Error('Ses kaydı durdurulamadı.'));
                };
                activeRecorder.stop();
            });

            activeStream.getTracks().forEach(track => track.stop());
            voiceRecordingStream = null;
            recorder = null;

            if (!blob.size) {
                recordedChunks = [];
                throw new Error('Kaydedilen ses verisi bos geldi.');
            }

            const extension = getFileExtensionFromMimeType(mimeType, 'voice.webm');
            const file = new File([blob], 'voice-' + Date.now() + extension, { type: mimeType });
            const diagnostics = {
                fileSize: file.size,
                summary: Math.round(file.size / 1024) + ' KB | ' + mimeType,
                warning: ''
            };

            console.info('Ses kaydı MediaRecorder analizi:', {
                mimeType,
                fileSizeBytes: file.size,
                chunkCount: recordedChunks.length
            });

            recordedChunks = [];
            createAudioAttachmentFromFile(file, diagnostics);
            return;
        }

        if (!voiceRecordingContext) {
            throw new Error('Aktif bir ses kaydı bulunamadı.');
        }

        if (voiceRecordingSource) voiceRecordingSource.disconnect();
        if (voiceRecordingProcessor) voiceRecordingProcessor.disconnect();
        if (voiceRecordingGain) voiceRecordingGain.disconnect();

        voiceRecordingStream.getTracks().forEach(track => track.stop());

        const sampleRate = voiceRecordingContext.sampleRate || 44100;
        await voiceRecordingContext.close().catch(() => {});

        const mergedSamples = mergeVoiceBuffers(voiceRecordingBuffers);

        voiceRecordingStream = null;
        voiceRecordingContext = null;
        voiceRecordingSource = null;
        voiceRecordingProcessor = null;
        voiceRecordingGain = null;
        voiceRecordingBuffers = [];
        recorder = null;

        if (!mergedSamples.length) {
            recordedChunks = [];
            const preview = document.getElementById('chatMediaPreview');
            if (preview) {
                preview.style.display = 'block';
                preview.textContent = 'Ses kaydı alınamadı. Lütfen tekrar deneyin.';
            }
            return;
        }

        const rawAnalysis = analyzeAudioSamples(mergedSamples, sampleRate);
        const targetSampleRate = sampleRate > 16000 ? 16000 : sampleRate;
        const downsampledSamples = downsamplePcmSamples(mergedSamples, sampleRate, targetSampleRate);
        const downsampledAnalysis = analyzeAudioSamples(downsampledSamples, targetSampleRate);
        const normalizedSamples = normalizePcmSamples(downsampledSamples, downsampledAnalysis.peak);
        const finalAnalysis = analyzeAudioSamples(normalizedSamples, targetSampleRate);
        const normalizedBlob = encodePcmSamplesToWav(normalizedSamples, targetSampleRate);
        const mimeType = normalizedBlob.type || 'audio/wav';
        const extension = getFileExtensionFromMimeType(mimeType, 'voice');
        const file = new File([normalizedBlob], 'voice-' + Date.now() + extension, { type: mimeType });
        const diagnostics = {
            ...finalAnalysis,
            originalSampleRate: sampleRate,
            originalSampleCount: rawAnalysis.sampleCount,
            originalWavBytes: rawAnalysis.wavBytes,
            fileSize: file.size,
            warning: finalAnalysis.peak < 0.02
                ? 'Mikrofondan cok dusuk seviye yakalandi. Kayit neredeyse sessiz olabilir.'
                : ''
        };

        console.info('Ses kaydı analizi:', {
            original: rawAnalysis,
            downsampled: downsampledAnalysis,
            final: diagnostics
        });
        recordedChunks = [];
        createAudioAttachmentFromFile(file, diagnostics);
    }

    function ensureRemoteAudioElement() {
        if (rtcRemoteAudio) return rtcRemoteAudio;
        rtcRemoteAudio = document.createElement('audio');
        rtcRemoteAudio.id = 'chatRemoteAudio';
        rtcRemoteAudio.autoplay = true;
        rtcRemoteAudio.playsInline = true;
        rtcRemoteAudio.style.position = 'fixed';
        rtcRemoteAudio.style.width = '1px';
        rtcRemoteAudio.style.height = '1px';
        rtcRemoteAudio.style.opacity = '0.01';
        rtcRemoteAudio.style.pointerEvents = 'none';
        rtcRemoteAudio.controls = false;
        rtcRemoteAudio.volume = 1;
        document.body.appendChild(rtcRemoteAudio);
        return rtcRemoteAudio;
    }

    function cleanupRtcResources() {
        if (callDocUnsub) callDocUnsub();
        if (offerCandidatesUnsub) offerCandidatesUnsub();
        if (answerCandidatesUnsub) answerCandidatesUnsub();
        callDocUnsub = null;
        offerCandidatesUnsub = null;
        answerCandidatesUnsub = null;

        if (rtcPeerConnection) {
            rtcPeerConnection.close();
            rtcPeerConnection = null;
        }
        if (rtcLocalStream) {
            rtcLocalStream.getTracks().forEach(track => track.stop());
            rtcLocalStream = null;
        }
        if (rtcRemoteAudio) {
            rtcRemoteAudio.srcObject = null;
        }
    }

    async function createPeerConnection(callId, isCaller) {
        cleanupRtcResources();
        ensureRemoteAudioElement();
        rtcLocalStream = await requestMicrophoneStream();
        rtcPeerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });

        rtcLocalStream.getAudioTracks().forEach(track => {
            track.enabled = true;
            if ('contentHint' in track) track.contentHint = 'speech';
            rtcPeerConnection.addTrack(track, rtcLocalStream);
        });
        rtcPeerConnection.ontrack = event => {
            const audioEl = ensureRemoteAudioElement();
            audioEl.srcObject = event.streams[0];
            audioEl.play().catch(() => {
                showActiveCallBanner('Ses bağlantısı kuruldu. Tarayıcı sesi engellediyse sayfaya tıklayıp tekrar deneyin.', false);
            });
        };

        const targetCollection = db.collection('calls').doc(callId).collection(isCaller ? 'offerCandidates' : 'answerCandidates');
        rtcPeerConnection.onicecandidate = event => {
            if (event.candidate) {
                targetCollection.add(event.candidate.toJSON()).catch(error => console.error('ICE adayı kaydedilemedi:', error));
            }
        };

        return rtcPeerConnection;
    }

    async function setupCallerConnection(callId) {
        const connection = await createPeerConnection(callId, true);
        answerCandidatesUnsub = db.collection('calls').doc(callId).collection('answerCandidates').onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added' && rtcPeerConnection) {
                    rtcPeerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(error => console.error('Yanıt ICE eklenemedi:', error));
                }
            });
        });

        callDocUnsub = db.collection('calls').doc(callId).onSnapshot(async snapshot => {
            if (!snapshot.exists || !rtcPeerConnection) return;
            const data = snapshot.data();
            if (isCallTimedOut({ id: callId, ...data })) {
                await markCallAsMissed({ id: callId, ...data }, getCurrentUser().id).catch(error => console.error('Zaman aşımı işlenemedi:', error));
                return;
            }
            if (data.answer && !rtcPeerConnection.currentRemoteDescription) {
                await rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                showActiveCallBanner('Ses bağlantısı kuruldu.', false);
            }
            if (data.status === 'rejected') {
                showActiveCallBanner('Arama cevaplanmadı.', true);
                cleanupRtcResources();
                currentCallDocId = null;
            }
            if (data.status === 'missed' && data.endedReason === 'timeout') {
                showActiveCallBanner('2 dakika içinde cevap verilmedi.', true);
                cleanupRtcResources();
                currentCallDocId = null;
            }
            if (data.status === 'ended') {
                cleanupRtcResources();
                currentCallDocId = null;
                const banner = document.getElementById('chatActiveCallBanner');
                if (banner) banner.style.display = 'none';
            }
        });

        const offer = await connection.createOffer({ offerToReceiveAudio: true });
        await connection.setLocalDescription(offer);
        await db.collection('calls').doc(callId).set({ offer: { type: offer.type, sdp: offer.sdp }, updatedAt: new Date().toISOString() }, { merge: true });
    }

    async function setupReceiverConnection(callId) {
        const callDoc = await db.collection('calls').doc(callId).get();
        if (!callDoc.exists) return;
        const data = callDoc.data() || {};
        if (isCallTimedOut({ id: callId, ...data })) {
            await markCallAsMissed({ id: callId, ...data }, getCurrentUser().id).catch(error => console.error('Gecikmiş arama kapanamadı:', error));
            throw new Error('Bu arama zaman aşımına uğradı.');
        }
        const connection = await createPeerConnection(callId, false);

        offerCandidatesUnsub = db.collection('calls').doc(callId).collection('offerCandidates').onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added' && rtcPeerConnection) {
                    rtcPeerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(error => console.error('Teklif ICE eklenemedi:', error));
                }
            });
        });

        if (data.offer) {
            await connection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await connection.createAnswer();
            await connection.setLocalDescription(answer);
            await db.collection('calls').doc(callId).set({ answer: { type: answer.type, sdp: answer.sdp }, status: 'accepted', updatedAt: new Date().toISOString() }, { merge: true });
        }

        callDocUnsub = db.collection('calls').doc(callId).onSnapshot(snapshot => {
            if (!snapshot.exists) return;
            const nextData = snapshot.data();
            if (nextData.status === 'ended' || nextData.status === 'rejected' || nextData.status === 'missed') {
                cleanupRtcResources();
                currentCallDocId = null;
                const banner = document.getElementById('chatActiveCallBanner');
                if (banner) banner.style.display = 'none';
            }
        });
    }

    async function startVoiceCall() {
        const currentUser = getCurrentUser();
        if (!callsEnabledForCurrentRole()) {
            alert('Sekreter panelinde sesli arama kapalıdır.');
            return;
        }
        const chat = activeChatId ? chatCache.get(activeChatId) : null;
        if (!chat) return;
        try {
            const call = await db.collection('calls').add({ chatId: activeChatId, participants: chat.userIds || [], callerId: currentUser.id, callerName: currentUser.name, status: 'ringing', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
            unsuppressIncomingCall(call.id);
            currentCallDocId = call.id;
            await db.collection('chats').doc(activeChatId).collection('messages').add({ senderId: currentUser.id, senderName: currentUser.name, senderEmail: currentUser.email, senderClubName: currentUser.clubName || '', text: currentUser.name + ' sesli arama başlattı.', type: 'call-event', callStatusText: 'Sesli arama başlatıldı', timestamp: new Date().toISOString() });
            await setupCallerConnection(call.id);
            showActiveCallBanner('Arama başlatıldı. Karşı tarafın yanıtı bekleniyor...', true);
        } catch (error) {
            console.error('Arama başlatılamadı:', error);
            showActiveCallBanner('Arama başlatılamadı: ' + error.message, true);
            cleanupRtcResources();
            currentCallDocId = null;
        }
    }

    function showActiveCallBanner(text, pending) {
        const banner = document.getElementById('chatActiveCallBanner');
        if (!banner) return;
        banner.style.display = 'block';
        banner.innerHTML = safeText(text) + ' <button type="button" class="btn ' + (pending ? 'btn-danger' : 'btn-secondary') + ' btn-sm" onclick="window.endActiveCall()" style="margin-left:10px;">' + (pending ? 'İptal Et' : 'Aramayı Bitir') + '</button>';
    }

    async function listenIncomingCalls() {
        const currentUser = getCurrentUser();
        if (!currentUser.id) return;
        callListenerStartedAt = Date.now();
        incomingCallUnsub = db.collection('calls').where('participants', 'array-contains', currentUser.id).onSnapshot(snapshot => {
            const calls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            if (!callsEnabledForCurrentRole()) {
                calls.filter(call => call.status === 'ringing' && call.callerId !== currentUser.id).forEach(call => {
                    suppressIncomingCall(call.id);
                    markCallAsMissed(call, currentUser.id, 'stale').catch(error => console.error('Sekreter icin arama otomatik kapatilamadi:', error));
                });
                const modal = document.getElementById('chatIncomingCallModal');
                if (modal) modal.classList.remove('active');
                return;
            }
            calls.filter(call => isInvalidRingingCall(call)).forEach(call => {
                markCallAsMissed(call, currentUser.id, 'stale').catch(error => console.error('Bozuk eski arama kaydı kapatılamadı:', error));
            });
            calls.filter(call => isPreexistingIncomingCall(call, currentUser.id)).forEach(call => {
                markCallAsMissed(call, currentUser.id, 'stale').catch(error => console.error('Acilista bulunan eski arama kapatılamadı:', error));
            });
            calls.filter(call => isCallTimedOut(call)).forEach(call => {
                markCallAsMissed(call, currentUser.id).catch(error => console.error('Eski arama zaman aşımıyla kapatılamadı:', error));
            });
            const incoming = calls.find(call => call.status === 'ringing' && call.callerId !== currentUser.id && !isCallTimedOut(call) && !isInvalidRingingCall(call) && !isPreexistingIncomingCall(call, currentUser.id) && !dismissedIncomingCallIds.has(call.id));
            const active = calls.find(call => call.status === 'accepted');
            const rejected = calls.find(call => call.id === currentCallDocId && call.status === 'rejected');
            const missed = calls.find(call => call.id === currentCallDocId && call.status === 'missed');
            const modal = document.getElementById('chatIncomingCallModal');
            if (incoming && modal) {
                currentCallDocId = incoming.id;
                document.getElementById('incomingCallTitle').textContent = 'Gelen Sesli Arama';
                document.getElementById('incomingCallText').textContent = incoming.callerName + ' sizi arıyor.';
                modal.classList.add('active');
            } else if (modal) {
                modal.classList.remove('active');
            }
            if (active) {
                showActiveCallBanner(active.callerId === currentUser.id ? 'Arama devam ediyor.' : active.callerName + ' ile aramadasınız.', false);
            }
            if (rejected) {
                suppressIncomingCall(rejected.id);
                showActiveCallBanner('Arama cevaplanmadı.', true);
            }
            if (missed && missed.endedReason === 'timeout') {
                suppressIncomingCall(missed.id);
                showActiveCallBanner('2 dakika içinde cevap verilmedi.', true);
                if (currentCallDocId === missed.id) currentCallDocId = null;
            }
        });
    }

    async function answerIncomingCall() {
        if (!currentCallDocId) return;
        try {
            unsuppressIncomingCall(currentCallDocId);
            await setupReceiverConnection(currentCallDocId);
            document.getElementById('chatIncomingCallModal').classList.remove('active');
            showActiveCallBanner('Sesli arama oturumu aktif.', false);
        } catch (error) {
            console.error('Arama cevaplanamadı:', error);
            suppressIncomingCall(currentCallDocId);
            showActiveCallBanner('Arama cevaplanamadı: ' + error.message, true);
        }
    }

    async function rejectIncomingCall() {
        const currentUser = getCurrentUser();
        if (!currentCallDocId) return;
        const activeCallId = currentCallDocId;
        suppressIncomingCall(activeCallId);
        const callDoc = await db.collection('calls').doc(currentCallDocId).get();
        const call = callDoc.exists ? callDoc.data() : null;
        if (call && call.status && call.status !== 'ringing') {
            document.getElementById('chatIncomingCallModal').classList.remove('active');
            currentCallDocId = null;
            return;
        }
        try {
            await db.collection('calls').doc(activeCallId).set({ status: 'rejected', updatedAt: new Date().toISOString(), rejectedBy: currentUser.id }, { merge: true });
            document.getElementById('chatIncomingCallModal').classList.remove('active');
            if (call && call.chatId) {
                await db.collection('chats').doc(call.chatId).collection('messages').add({ senderId: currentUser.id, senderName: currentUser.name, senderEmail: currentUser.email, senderClubName: currentUser.clubName || '', text: currentUser.name + ' aramayı reddetti.', type: 'call-event', callStatusText: 'Arama cevaplanmadı', timestamp: new Date().toISOString() });
            }
        } catch (error) {
            console.error('Arama reddedilemedi, yerelde bastırıldı:', error);
        }
        cleanupRtcResources();
        currentCallDocId = null;
    }

    async function endActiveCall() {
        if (currentCallDocId) {
            await db.collection('calls').doc(currentCallDocId).set({ status: 'ended', updatedAt: new Date().toISOString() }, { merge: true });
        }
        cleanupRtcResources();
        currentCallDocId = null;
        const banner = document.getElementById('chatActiveCallBanner');
        if (banner) banner.style.display = 'none';
    }

    function ensureCallUi() {
        if (!callsEnabledForCurrentRole()) {
            const existingModal = document.getElementById('chatIncomingCallModal');
            if (existingModal) existingModal.remove();
            const existingBanner = document.getElementById('chatActiveCallBanner');
            if (existingBanner) existingBanner.remove();
            return;
        }
        if (!document.getElementById('chatIncomingCallModal')) {
            const modal = document.createElement('div');
            modal.id = 'chatIncomingCallModal';
            modal.className = 'modal chat-modal';
            modal.innerHTML = '<div class="modal-content" style="max-width:420px;"><div style="text-align:center; padding:28px;"><div style="font-size:3rem; margin-bottom:16px;">📞</div><h2 id="incomingCallTitle">Gelen Arama</h2><p id="incomingCallText" style="color:#66788a; margin:12px 0 22px;">Bir kullanıcı sizi arıyor.</p><div class="btn-group" style="justify-content:center;"><button type="button" class="btn btn-success" id="incomingCallAnswerBtn">Cevapla</button><button type="button" class="btn btn-danger" id="incomingCallRejectBtn">Reddet</button></div></div></div>';
            document.body.appendChild(modal);
            const content = modal.querySelector('.modal-content');
            if (content) content.classList.add('chat-modal-content', 'chat-call-modal-content');
            const answerBtn = document.getElementById('incomingCallAnswerBtn');
            const rejectBtn = document.getElementById('incomingCallRejectBtn');
            if (answerBtn) answerBtn.addEventListener('click', answerIncomingCall);
            if (rejectBtn) rejectBtn.addEventListener('click', rejectIncomingCall);
        }
        if (!document.getElementById('chatActiveCallBanner')) {
            const banner = document.createElement('div');
            banner.id = 'chatActiveCallBanner';
            banner.className = 'chat-call-banner';
            banner.style.display = 'none';
            document.body.appendChild(banner);
        }
    }

    function enhanceUi() {
        const listPage = document.getElementById(config.listPageId);
        const viewPage = document.getElementById(config.viewPageId);
        const listContainer = document.getElementById(config.listContainerId);
        const form = document.getElementById(config.formId);
        const input = document.getElementById(config.inputId);
        const messages = document.getElementById(config.messagesId);
        const newChatPage = document.getElementById(config.newChatPageId);
        const newGroupModal = document.getElementById(config.newGroupModalId);
        const managementModal = document.getElementById(config.groupManagementModalId);

        if (listPage) {
            listPage.classList.add('chat-page-surface');
            const card = listPage.querySelector('.card');
            if (card) card.classList.add('chat-stage-card');
            const toolbar = listPage.querySelector('.page-toolbar');
            if (toolbar) toolbar.classList.add('chat-stage-toolbar');
        }

        if (viewPage) {
            viewPage.classList.add('chat-view-surface');
            const card = viewPage.querySelector('.card');
            if (card) card.classList.add('chat-stage-card', 'chat-thread-card');
            const toolbar = viewPage.querySelector('.page-toolbar');
            if (toolbar) toolbar.classList.add('chat-stage-toolbar');
        }

        if (newChatPage) {
            newChatPage.classList.add('chat-directory-surface');
            const card = newChatPage.querySelector('.card');
            if (card) card.classList.add('chat-stage-card', 'chat-directory-card-shell');
        }

        [newGroupModal, managementModal].forEach(modal => {
            if (!modal) return;
            modal.classList.add('chat-modal');
            const content = modal.querySelector('.modal-content');
            if (content) content.classList.add('chat-modal-content');
            const header = modal.querySelector('.modal-header');
            if (header) header.classList.add('chat-modal-header');
            const body = modal.querySelector('.modal-body');
            if (body) body.classList.add('chat-modal-body');
            const modalForm = modal.querySelector('form');
            if (modalForm) modalForm.classList.add('chat-modal-form');
        });

        if (listPage) {
            const grid = listPage.querySelector('.panel-split') || listPage.querySelector('div[style*="grid-template-columns"]');
            if (grid) {
                grid.classList.add('chat-shell');
                if (grid.children[0]) grid.children[0].classList.add('chat-sidebar');
                if (grid.children[1]) grid.children[1].classList.add('chat-thread-panel');
                if (grid.children[0] && !document.getElementById('globalChatSearchInput')) {
                    const search = document.createElement('div');
                    search.className = 'chat-search-box';
                    search.innerHTML = '<input id="globalChatSearchInput" type="search" placeholder="Sohbet ara...">';
                    grid.children[0].insertBefore(search, listContainer);
                    search.querySelector('input').addEventListener('input', event => {
                        const term = String(event.target.value || '').trim().toLowerCase();
                        document.querySelectorAll('.chat-item').forEach(item => {
                            item.style.display = !term || item.textContent.toLowerCase().includes(term) ? '' : 'none';
                        });
                    });
                }
                if (listContainer) listContainer.classList.add('chat-list-scroll');
                if (grid.children[0] && grid.children[0].firstElementChild) grid.children[0].firstElementChild.classList.add('chat-sidebar-header');
                if (grid.children[1] && grid.children[1].firstElementChild) grid.children[1].firstElementChild.classList.add('chat-thread-header');
                if (grid.children[0]) grid.children[0].classList.add('chat-panel-glow');
                if (grid.children[1]) grid.children[1].classList.add('chat-panel-glow');
            }
        }
        if (messages) messages.classList.add('chat-thread');
        if (form) form.noValidate = true;
        if (input) {
            input.required = false;
            if (!input.placeholder || input.placeholder.toLowerCase().includes('mesaj')) {
                input.placeholder = 'Metin opsiyonel, isterseniz sadece ses kaydi gonderebilirsiniz...';
            }
        }
        if (newChatPage && !document.getElementById('chatUserDirectoryList')) {
            const form = document.getElementById(config.newChatFormId);
            if (form) {
                const directoryCard = document.createElement('div');
                directoryCard.className = 'chat-directory-card';
                directoryCard.innerHTML = `
                    <div class="chat-directory-panel">
                        <div class="chat-directory-header">
                            <h3>Tüm Kullanıcılar</h3>
                            <input type="search" id="chatUserDirectorySearch" placeholder="İsim, e-posta veya rol ara...">
                        </div>
                        <div id="chatUserDirectoryList" class="chat-directory-list"></div>
                    </div>
                `;
                form.insertAdjacentElement('afterend', directoryCard);
                directoryCard.querySelector('#chatUserDirectorySearch').addEventListener('input', event => renderUserDirectory(event.target.value));
            }
        }
        if (form && input) {
            const parent = form.parentNode;
            const clone = form.cloneNode(true);
            parent.replaceChild(clone, form);
            const newForm = document.getElementById(config.formId);
            const actions = document.createElement('div');
            actions.className = 'chat-composer-actions';
            actions.innerHTML = '<button type="button" class="chat-icon-btn" id="chatAttachmentBtn" title="Fotoğraf / Video">📎</button><button type="button" class="chat-icon-btn" id="chatVoiceRecordBtn" title="Ses kaydı">🎤</button>';
            newForm.classList.add('chat-composer');
            newForm.insertBefore(actions, newForm.firstElementChild);
            const fileInput = document.createElement('input');
            fileInput.id = 'chatMediaInput';
            fileInput.type = 'file';
            fileInput.accept = 'image/*,video/*';
            fileInput.style.display = 'none';
            newForm.appendChild(fileInput);
            const preview = document.createElement('div');
            preview.id = 'chatMediaPreview';
            preview.className = 'chat-media-preview';
            preview.style.display = 'none';
            newForm.parentNode.appendChild(preview);
            newForm.addEventListener('submit', handleSendMessage);
            fileInput.addEventListener('change', handleAttachmentSelection);
            document.getElementById('chatAttachmentBtn').addEventListener('click', () => fileInput.click());
            document.getElementById('chatVoiceRecordBtn').addEventListener('click', toggleVoiceRecording);
            const submitButton = newForm.querySelector('button[type="submit"]');
            if (submitButton) submitButton.textContent = 'Gönder';
        }
        if (viewPage && callsEnabledForCurrentRole() && !document.getElementById('chatCallActionBtn')) {
            const header = viewPage.querySelector('.card > div');
            const slot = header ? (header.querySelector('div:last-child') || header) : null;
            if (slot) {
                const button = document.createElement('button');
                button.id = 'chatCallActionBtn';
                button.type = 'button';
                button.className = 'btn btn-info btn-sm';
                button.textContent = '📞 Arama Başlat';
                button.addEventListener('click', startVoiceCall);
                slot.insertBefore(button, slot.firstChild);
            }
        }
        const existingCallBtn = document.getElementById('chatCallActionBtn');
        if (existingCallBtn && !callsEnabledForCurrentRole()) {
            existingCallBtn.remove();
        }
        ensureFormExtras();
        ensureCallUi();
    }

    function bindForms() {
        const newChatForm = document.getElementById(config.newChatFormId);
        if (newChatForm) {
            const parent = newChatForm.parentNode;
            const clone = newChatForm.cloneNode(true);
            parent.replaceChild(clone, newChatForm);
            document.getElementById(config.newChatFormId).addEventListener('submit', submitNewChatByEmail);
            const emailInput = document.getElementById(config.newChatEmailId);
            if (emailInput) emailInput.addEventListener('input', chatEmailLookupUser);
        }
        const groupForm = document.getElementById(config.newGroupFormId);
        if (groupForm) {
            const parent = groupForm.parentNode;
            const clone = groupForm.cloneNode(true);
            parent.replaceChild(clone, groupForm);
            ensureFormExtras();
            document.getElementById(config.newGroupFormId).addEventListener('submit', submitNewGroupChat);
        }
        const managementForm = document.getElementById(config.groupManagementFormId);
        if (managementForm) {
            const parent = managementForm.parentNode;
            const clone = managementForm.cloneNode(true);
            parent.replaceChild(clone, managementForm);
            ensureFormExtras();
            document.getElementById(config.groupManagementFormId).addEventListener('submit', saveGroupChanges);
        }
    }

    function exposeAliases() {
        window.loadChatList = loadChatList;
        window.loadChatMessages = loadChatMessages;
        window.openChatView = openChatView;
        window.closeChatView = closeChatView;
        window.sendChatMessage = handleSendMessage;
        window.openNewChatEmailPage = openNewChatEmailPage;
        window.closeNewChatEmailPage = closeNewChatEmailPage;
        window.chatEmailLookupUser = chatEmailLookupUser;
        window.submitNewChatByEmail = submitNewChatByEmail;
        window.openNewGroupChatModal = openNewGroupChatModal;
        window.closeNewGroupChatModal = closeNewGroupChatModal;
        window.submitNewGroupChat = submitNewGroupChat;
        window.openGroupManagement = openGroupManagement;
        window.closeGroupManagementModal = closeGroupManagementModal;
        window.addGroupMember = addGroupMember;
        window.removeGroupMember = removeGroupMember;
        window.toggleGroupAdmin = toggleGroupAdmin;
        window.transferGroupOwnership = transferGroupOwnership;
        window.editChatMessage = editChatMessage;
        window.deleteChatMessage = deleteChatMessage;
        window.openChatCleanupMenu = openChatCleanupMenu;
        window.clearChatAttachment = clearAttachmentPreview;
        window.startVoiceCall = startVoiceCall;
        window.answerIncomingCall = answerIncomingCall;
        window.rejectIncomingCall = rejectIncomingCall;
        window.endActiveCall = endActiveCall;
        window.openProfileChat = openProfileChat;
        window.openChatWithUser = openChatWithUser;
        window.leaveActiveGroup = leaveActiveGroup;
        window.deleteGroup = deleteManagedGroup;
        window.openIdentityModal = openIdentityModal;

        window.loadAdminChatList = loadChatList;
        window.openAdminChatView = openChatView;
        window.closeAdminChatView = closeChatView;
        window.loadAdminChatMessages = loadChatMessages;
        window.openAdminNewChatEmailPage = openNewChatEmailPage;
        window.closeAdminNewChatEmailPage = closeNewChatEmailPage;
        window.openAdminNewGroupChatModal = openNewGroupChatModal;
        window.closeAdminNewGroupChatModal = closeNewGroupChatModal;
        window.openAdminGroupManagement = openGroupManagement;
        window.closeAdminGroupManagementModal = closeGroupManagementModal;
        window.deleteAdminGroup = deleteManagedGroup;
        window.addAdminGroupMember = addGroupMember;

        window.loadSuperAdminChatList = loadChatList;
        window.openSuperAdminChatView = openChatView;
        window.closeSuperAdminChatView = closeChatView;
        window.loadSuperAdminChatMessages = loadChatMessages;
        window.openSuperAdminNewChatEmailPage = openNewChatEmailPage;
        window.closeSuperAdminNewChatEmailPage = closeNewChatEmailPage;
        window.openSuperAdminNewGroupChatModal = openNewGroupChatModal;
        window.closeSuperAdminNewGroupChatModal = closeNewGroupChatModal;
        window.openSuperAdminGroupManagement = openGroupManagement;
        window.closeSuperAdminGroupManagementModal = closeGroupManagementModal;
        window.deleteSuperAdminGroup = deleteManagedGroup;
        window.addSuperAdminGroupMember = addGroupMember;
    }

    function openNewGroupChatModal() {
        const modal = document.getElementById(config.newGroupModalId);
        if (modal) modal.style.display = 'flex';
    }

    async function init() {
        config = detectConfig();
        if (!config || !window.db) return;
        bindDelegatedChatActions();
        window.addEventListener('app-profile-updated', handleExternalProfileUpdate);
        loadDismissedIncomingCallIds();
        ensureCss();
        ensureBaseChatModals();
        await resolveCurrentUserIdentity();
        enhanceUi();
        bindForms();
        exposeAliases();
        if (!identityIsComplete()) {
            openIdentityModal();
        }
        listenIncomingCalls();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();