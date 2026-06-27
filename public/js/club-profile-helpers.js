(function (global) {
    const DEFAULT_LEAD_FORM_SETTINGS = {
        eyebrowText: 'Ön kayıt formu',
        title: '',
        description: '',
        logoUrl: '',
        videoUrl: '',
        accentColor: '#0b7ea8'
    };

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
        getClubDisplayName,
        getClubLogoUrl,
        getLeadFormSettings,
        buildClubProfileWritePayload,
        parseVideoEmbedUrl,
        readImageFileAsDataUrl
    };
})(window);
