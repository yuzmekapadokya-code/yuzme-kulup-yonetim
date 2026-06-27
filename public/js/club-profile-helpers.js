(function (global) {
    const DEFAULT_LEAD_FORM_SETTINGS = {
        eyebrowText: 'Ön kayıt formu',
        title: '',
        description: '',
        logoUrl: '',
        videoUrl: '',
        accentColor: '#0b7ea8'
    };

    const BUILT_IN_EDUCATION_MODELS = [
        { id: 'group', name: 'Grup Dersi', defaultPerTrainerCapacity: 8, builtIn: true, removable: false },
        { id: 'private', name: 'Özel Ders', defaultPerTrainerCapacity: 1, builtIn: true, removable: false }
    ];

    function slugifyEducationModelName(name) {
        const value = String(name || '').trim().toLocaleLowerCase('tr');
        if (!value) return '';
        return value
            .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c')
            .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 60);
    }

    function normalizeEducationModelEntry(entry, options = {}) {
        if (!entry || typeof entry !== 'object') return null;
        const rawName = String(entry.name || '').trim();
        if (!rawName) return null;
        const builtInDefault = options.builtIn || Boolean(entry.builtIn);
        let id = String(entry.id || '').trim();
        if (!id) {
            const slug = slugifyEducationModelName(rawName);
            id = slug ? `em_${slug}_${Math.random().toString(36).slice(2, 7)}` : `em_${Date.now().toString(36)}`;
        }
        const capRaw = Number(entry.defaultPerTrainerCapacity);
        const defaultPerTrainerCapacity = Number.isFinite(capRaw) && capRaw > 0
            ? Math.max(1, Math.min(50, Math.floor(capRaw)))
            : 8;
        return {
            id,
            name: rawName,
            defaultPerTrainerCapacity,
            builtIn: builtInDefault,
            removable: builtInDefault ? false : (entry.removable !== false)
        };
    }

    function getEducationModels(profileData) {
        const customRaw = Array.isArray(profileData?.educationModels) ? profileData.educationModels : [];
        const seenIds = new Set();
        const models = [];
        BUILT_IN_EDUCATION_MODELS.forEach(item => {
            models.push({ ...item });
            seenIds.add(item.id);
        });
        customRaw.forEach(entry => {
            const normalized = normalizeEducationModelEntry(entry, { builtIn: Boolean(entry?.builtIn) });
            if (!normalized) return;
            if (seenIds.has(normalized.id)) return;
            seenIds.add(normalized.id);
            models.push(normalized);
        });
        return models;
    }

    function getEducationModelById(profileData, modelId) {
        const target = String(modelId || '').trim();
        if (!target) return null;
        return getEducationModels(profileData).find(item => item.id === target) || null;
    }

    function getEducationModelLabel(profileData, modelId) {
        const model = getEducationModelById(profileData, modelId);
        if (model) return model.name;
        if (modelId === 'private') return 'Özel Ders';
        if (modelId === 'group') return 'Grup Dersi';
        return String(modelId || 'Ders');
    }

    function getClubDisplayName(profileData) {
        return String(profileData?.clubName || profileData?.name || '').trim();
    }

    function getClubLogoUrl(profileData) {
        return String(profileData?.logoUrl || '').trim();
    }

    function getLeadFormSettings(profileData) {
        const stored = profileData?.leadFormSettings && typeof profileData.leadFormSettings === 'object'
            ? profileData.leadFormSettings
            : {};
        return {
            ...DEFAULT_LEAD_FORM_SETTINGS,
            ...stored
        };
    }

    function buildClubProfileWritePayload(options = {}) {
        const clubName = String(options.clubName || '').trim();
        const payload = {
            updatedAt: new Date().toISOString()
        };

        if (clubName) {
            payload.clubName = clubName;
            payload.name = clubName;
        }

        if (options.logoUrl !== undefined) {
            payload.logoUrl = options.logoUrl;
        }

        if (options.adminId) {
            payload.adminId = options.adminId;
        }

        if (options.leadFormSettings) {
            payload.leadFormSettings = options.leadFormSettings;
        }

        return payload;
    }

    function parseVideoEmbedUrl(rawUrl) {
        const value = String(rawUrl || '').trim();
        if (!value) {
            return '';
        }

        try {
            const url = new URL(value);
            const host = url.hostname.replace(/^www\./, '');

            if (host === 'youtu.be') {
                const videoId = url.pathname.replace('/', '');
                return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
            }

            if (host === 'youtube.com' || host === 'm.youtube.com') {
                const videoId = url.searchParams.get('v');
                if (videoId) {
                    return `https://www.youtube.com/embed/${videoId}`;
                }
                const shortsMatch = url.pathname.match(/\/shorts\/([^/]+)/);
                if (shortsMatch) {
                    return `https://www.youtube.com/embed/${shortsMatch[1]}`;
                }
            }

            if (host === 'vimeo.com') {
                const videoId = url.pathname.split('/').filter(Boolean)[0];
                return videoId ? `https://player.vimeo.com/video/${videoId}` : '';
            }
        } catch (error) {
            return '';
        }

        return '';
    }

    function readImageFileAsDataUrl(file, maxBytes) {
        return new Promise((resolve, reject) => {
            if (!file) {
                resolve('');
                return;
            }

            if (maxBytes && file.size > maxBytes) {
                reject(new Error(`Görsel en fazla ${Math.round(maxBytes / 1024 / 1024)} MB olabilir.`));
                return;
            }

            const reader = new FileReader();
            reader.onload = () => resolve(reader.result || '');
            reader.onerror = () => reject(new Error('Görsel okunamadı.'));
            reader.readAsDataURL(file);
        });
    }

    global.ClubProfileHelpers = {
        DEFAULT_LEAD_FORM_SETTINGS,
        BUILT_IN_EDUCATION_MODELS,
        getClubDisplayName,
        getClubLogoUrl,
        getLeadFormSettings,
        buildClubProfileWritePayload,
        parseVideoEmbedUrl,
        readImageFileAsDataUrl,
        getEducationModels,
        getEducationModelById,
        getEducationModelLabel,
        normalizeEducationModelEntry,
        slugifyEducationModelName
    };
})(window);
