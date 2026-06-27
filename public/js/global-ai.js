(function initGlobalAiAssistant() {
    const AI_SOURCES_COLLECTION = 'ai_knowledge_sources';
    const AI_CHUNKS_COLLECTION = 'ai_knowledge_chunks';
    const AI_GENERATED_COLLECTION = 'ai_generated_workouts';
    const AI_FEEDS_COLLECTION = 'ai_source_feeds';
    const GLOBAL_SCOPE = 'global';
    const CHUNK_SIZE = 850;
    const CHUNK_OVERLAP = 140;
    const MAX_CHUNKS_FOR_SEARCH = 1800;
    const MAX_FETCH_RECORDS = 500;
    const MAX_SEARCH_RESULTS = 8;
    const TRANSLATION_SEGMENT_LIMIT = 900;
    const TRANSLATION_ENDPOINT = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=tr&dt=t&q=';
    const REMOTE_TEXT_PROXY_ENDPOINT = 'https://api.allorigins.win/raw?url=';
    const REMOTE_TEXT_READABLE_ENDPOINT = 'https://r.jina.ai/http://';
    const REMOTE_TEXT_PRIMARY_TIMEOUT_MS = 15000;
    const REMOTE_TEXT_FALLBACK_TIMEOUT_MS = 7000;
    const CURATED_WORKOUT_LIBRARY_SOURCE_ID = 'seed_curated_swim_workouts_v1';
    const CURATED_WORKOUT_LIBRARY_TEXT = `
GLOBAL YUZME WORKOUT KUTUPHANESI - SISTEM BASLANGIC PAKETI

Bu kaynak ortak AI havuzu icin hazirlanmis bir temel antrenman kutuphanesidir. Hedef; yas grubu, seviye, stil ve odaga gore daha zengin eslesme alani saglamaktir.

1. 6-8 YAS BASLANGIC / SUYA UYUM / 45 DAKIKA
Toplam hedef: 700-900 metre
Odak: nefes ritmi, su ustunde denge, kayma ve temel ayak vurusu.
Ornek akis:
- 4x25 kolay serbest + sirtustu donusu
- 4x25 tahta ile ayak, her tekrar sonunda 10 saniye dinlenme
- 6x25 tek kol serbest teknik, diger kol onde uzun kayma
- 4x25 sirtustu denge, kalca yuksek pozisyon
- 4x25 kolay oyun ritminde yuzme
Koc notu: cocuk sporcularda komutlar kisa, tekrar sayisi dusuk, teknik geribildirim net olmali.

2. 8-10 YAS SERBEST TEKNIK / 60 DAKIKA
Toplam hedef: 1200-1600 metre
Odak: uzun kulac, nefes zamani, su cekisi.
Ornek akis:
- 200 kolay isinma
- 6x50 serbest drill-swim by 25, 15 saniye dinlenme
- 8x25 yuksek dirsek yakalama hissi
- 4x50 pull ile ritim kontrolu
- 4x50 negatif split serbest
- 100 kolay soguma

3. 9-11 YAS AYAK KUVVETI VE KOORDINASYON / 55 DAKIKA
Toplam hedef: 1300-1700 metre
Odak: core stabilitesi, ayak temposu, board ve streamline kontrolu.
Ornek akis:
- 300 karisik kolay
- 8x25 streamline dolphin kick veya flutter kick
- 6x50 tahta ile progressive kick
- 4x50 yan pozisyonda kick ve rotasyon
- 8x25 hizli ayak + 15 metre kolay tamamla
- 200 kolay

4. 10-12 YAS SIRTUSTU TEKNIK / 60 DAKIKA
Toplam hedef: 1400-1800 metre
Odak: kalca yuksekligi, omuz rotasyonu, cikis sonrasi duzenli ritim.
Ornek akis:
- 200 yuzme + 200 kick
- 6x50 sirtustu tek kol teknik
- 4x50 6 kick 1 switch drill
- 6x50 sirtustu orta tempo, 20 saniye dinlenme
- 4x25 cikis ve 10-15 metre su alti kontrolu
- 100 kolay

5. 11-13 YAS KARMA GIRIS / 70 DAKIKA
Toplam hedef: 1800-2200 metre
Odak: stil gecisleri, donus disiplini, teknik bozulmadan tempo koruma.
Ornek akis:
- 400 karisik isinma
- 8x50 drill by style: kelebek, sirtustu, kurbaga, serbest
- 4x100 IM build 1-4
- 8x25 donus cikis odakli tekrarlar
- 4x50 serbest rahatlatma

6. 12-14 YAS SPRINT / 70 DAKIKA
Toplam hedef: 1700-2200 metre
Odak: hizli cikis, yuksek frekans, tam dinlenmeli hiz tekrarlar.
Ornek akis:
- 300 kolay + 4x50 build
- 8x25 sprint, 30-40 saniye dinlenme
- 6x50 25 hizli / 25 kolay
- 4x25 su alti + cikis reaksiyonu
- 8x15 metre patlayici baslangic
- 200 soguma
Koc notu: sprint setlerinde teknik bozulursa tekrar yerine dinlenmeyi artir.

7. 13-15 YAS DAYANIKLILIK / 75 DAKIKA
Toplam hedef: 2400-3200 metre
Odak: aerobik kapasite, tempo devamliligi, duzenli pacing.
Ornek akis:
- 500 kolay karisik
- 5x200 threshold altinda sabit tempo
- 8x50 teknik toparlama
- 4x100 pull paddles hafif kontrol
- 6x50 son 15 metre hizli
- 200 kolay

8. PERFORMANS GRUBU YARIS PACE / 90 DAKIKA
Toplam hedef: 3200-4200 metre
Odak: yaris temposu, laktat toleransi, cikis ve donus kalitesi.
Ornek akis:
- 800 progresif isinma
- 12x50 yaris pace, grup hedef suresi ile
- 6x100 75 kontrollu + 25 hizli
- 8x25 blok veya duvardan reaksiyon cikisi
- 4x100 aktif toparlama
- 8x50 teknik kalite koruma
- 300 kolay

9. KELEBEK TEKNIK GELISIM / 60 DAKIKA
Toplam hedef: 1400-1800 metre
Odak: kalca dalgasi, iki vurus bir kulac ritmi, nefes zamanlamasi.
Ornek akis:
- 200 kolay + 4x25 dolphin kick
- 6x25 tek kol kelebek
- 4x50 3 sol 3 sag 3 tam kulac kombinasyonu
- 6x25 kelebek nefes kontrolu
- 4x50 serbest toparlama
- 100 kolay

10. KURBAGALAMA ZAMANLAMA / 60 DAKIKA
Toplam hedef: 1300-1700 metre
Odak: cekis-vurus-kayma sirasi ve diz acisi.
Ornek akis:
- 300 kolay
- 8x25 kurbaga kick board ile
- 6x50 pullout ve kayma vurgulu drill
- 4x50 kurbaga orta tempo, uzun kayma
- 4x25 hizli kurbaga bitiris
- 100 kolay

11. ACIK SU VE UZUN SET MANTIGI / 80 DAKIKA
Toplam hedef: 2600-3400 metre
Odak: ritim koruma, sighting benzeri bas kontrolu, uzun tekrar psikolojisi.
Ornek akis:
- 600 rahat isinma
- 3x400 sabit tempo
- 8x50 her 4 kulacta bir bas kontrol benzetimi
- 6x100 negatif split
- 200 kolay

12. TOPARLAMA VE TEKNIK GUNU / 45-60 DAKIKA
Toplam hedef: 1000-1600 metre
Odak: dusuk nabiz, mobilite hissi, teknik temizlik.
Ornek akis:
- 300 kolay
- 8x50 drill secmeli
- 4x100 kolay pull veya snorkel destekli teknik
- 4x25 hiz hissi acma ama tam yuklenmeme
- 200 kolay soguma

Genel kocluk ilkeleri:
- Yas kuculdukce teknik kalite, eglence ve gorev kisa tutma onceliklidir.
- Sprint gunu ile yuksek hacim gunu arka arkaya binmemelidir.
- Yarisa yakin donemde toplam hacim kademeli azalirken yaris hizi korunur.
- Teknik bozuluyorsa set yogunlugu veya tekrar suresi yeniden ayarlanmalidir.
- Kelebek ve kurbaga gunlerinde omuz ve diz yuku dikkatle izlenmelidir.
`;
    const STOP_WORDS = new Set([
        've', 'veya', 'ile', 'icin', 'bir', 'bu', 'da', 'de', 'mi', 'mu', 'mu', 'mu', 'gibi', 'daha', 'cok', 'az', 'olan',
        'olarak', 'icin', 'ama', 'fakat', 'gore', 'gibi', 'ya', 'yas', 'yuzme', 'antrenman', 'sporcu', 'sporcular', 'icin',
        'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'your', 'have', 'will'
    ]);
    const TURKISH_DETECTION_WORDS = new Set([
        've', 'ile', 'icin', 'olarak', 'ama', 'fakat', 'daha', 'cok', 'sporcu', 'yuzme', 'antrenman', 'teknik', 'set', 'sure', 'yas'
    ]);
    const ENGLISH_DETECTION_WORDS = new Set([
        'the', 'and', 'for', 'with', 'from', 'that', 'this', 'swim', 'swimming', 'training', 'workout', 'stroke', 'freestyle', 'breathing'
    ]);
    const LEVEL_LABELS = {
        beginner: 'Baslangic',
        intermediate: 'Orta',
        advanced: 'Ileri',
        performance: 'Performans'
    };
    const GOAL_LABELS = {
        genel: 'Genel gelisim',
        teknik: 'Teknik',
        sprint: 'Sprint',
        dayaniklilik: 'Dayaniklilik',
        yaris: 'Yaris hazirlik',
        ayak: 'Ayak vurusu'
    };
    const STYLE_ALIASES = {
        serbest: 'Serbest',
        free: 'Serbest',
        freestyle: 'Serbest',
        sirtustu: 'Sirtustu',
        sirt: 'Sirtustu',
        backstroke: 'Sirtustu',
        kurbagalama: 'Kurbagalama',
        kurbaga: 'Kurbagalama',
        breaststroke: 'Kurbagalama',
        kelebekce: 'Kelebekce',
        kelebek: 'Kelebekce',
        butterfly: 'Kelebekce',
        karma: 'Karma',
        medley: 'Karma'
    };
    const QUICK_CHAT_PROMPTS = [
        'Grubum icin olimpiyat seviyesinde teknik antrenman, sure 60 dakika',
        'Yas grubu 9-10 yas, seviye orta, hedef teknik, sure 60 dakika, odak serbest nefes ritmi',
        '12-13 yas, ileri seviye, hedef sprint, sure 75 dakika, odak cikis ve hizlanma',
        'Performans grubu, hedef yaris, sure 90 dakika, odak yaris temposu ve donus kalitesi'
    ];
    const OLYMPIC_COACH_LIVE_RESEARCH_URLS = [
        { label: 'Yuzme sporu referansi', url: 'https://en.wikipedia.org/wiki/Swimming_(sport)' },
        { label: 'Antrenman periodizasyonu', url: 'https://en.wikipedia.org/wiki/Periodization_(training)' },
        { label: 'Serbest stil teknik', url: 'https://en.wikipedia.org/wiki/Freestyle_swimming' },
        { label: 'Sprint antrenmani', url: 'https://en.wikipedia.org/wiki/Sprint_(running)' }
    ];
    const OLYMPIC_COACH_SEED_FEEDS = [
        { label: 'World Aquatics haber', url: 'https://www.worldaquatics.com/news', intervalHours: 24 },
        { label: 'Swimming World antrenman', url: 'https://www.swimmingworldmagazine.com/category/training/', intervalHours: 48 },
        { label: 'USA Swimming teknik', url: 'https://www.usaswimming.org/news', intervalHours: 48 }
    ];
    const STRUCTURED_PROMPT_TEMPLATE = [
        'Yas grubu: 9-10 yas',
        'Seviye: orta',
        'Hedef: teknik',
        'Sure: 60 dakika',
        'Stil / odak: serbest nefes ritmi',
        'Ek not: varsa ekipman, seviye farki veya istedigin özel vurgu'
    ].join('\n');

    const cacheState = {
        sources: null,
        chunks: null,
        feeds: null,
        workoutSales: null,
        workouts: null,
        insights: null,
        backfillDone: false,
        backfillPromise: null
    };

    const trainerUiState = {
        initialized: false,
        messages: [],
        profile: {},
        lastPlan: null,
        loading: false,
        groupContext: null,
        selectedScheduleId: ''
    };

    const superAdminUiState = {
        initialized: false,
        syncingFeedIds: new Set()
    };

    function q(id) {
        return document.getElementById(id);
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function sanitizeForPath(value) {
        return String(value || 'source')
            .replace(/[^a-zA-Z0-9._-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 120) || 'source';
    }

    function normalizeUrl(value) {
        const rawValue = String(value || '').trim();
        if (!rawValue) {
            return '';
        }

        const candidate = /^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`;
        let parsed;
        try {
            parsed = new URL(candidate);
        } catch (error) {
            throw new Error('Gecerli bir web adresi gir.');
        }

        if (!/^https?:$/i.test(parsed.protocol)) {
            throw new Error('Sadece http veya https linkleri kullanilabilir.');
        }

        return parsed.toString();
    }

    function buildMonitoredFeedId(url) {
        return `feed_${hashString(normalizeUrl(url))}`;
    }

    function buildMonitoredFeedSourceId(feedId) {
        return `feed_source_${sanitizeForPath(feedId)}`;
    }

    function calculateNextSyncAt(intervalHours, baseValue = new Date()) {
        const baseDate = typeof baseValue === 'string'
            ? new Date(baseValue)
            : (baseValue?.toDate ? baseValue.toDate() : new Date(baseValue));
        const safeBase = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
        const safeInterval = Math.max(1, Number(intervalHours || 24));
        return new Date(safeBase.getTime() + safeInterval * 60 * 60 * 1000).toISOString();
    }

    function formatSyncInterval(intervalHours) {
        const safeInterval = Math.max(1, Number(intervalHours || 24));
        if (safeInterval % 24 === 0) {
            return `${safeInterval / 24} gunde bir`;
        }
        return `${safeInterval} saatte bir`;
    }

    function isFeedDue(feed) {
        if (!feed?.enabled) {
            return false;
        }
        if (!feed.nextSyncAt) {
            return true;
        }

        const nextDate = new Date(feed.nextSyncAt);
        return Number.isNaN(nextDate.getTime()) || nextDate.getTime() <= Date.now();
    }

    function looksLikeHtml(content, contentType = '') {
        const normalizedType = String(contentType || '').toLowerCase();
        if (normalizedType.includes('html') || normalizedType.includes('xml')) {
            return true;
        }

        return /<(html|body|head|main|article|section|div|p|h1|h2|h3|title|meta)\b/i.test(String(content || '').slice(0, 1600));
    }

    function looksLikeJson(content) {
        const trimmed = String(content || '').trim();
        return trimmed.startsWith('{') || trimmed.startsWith('[');
    }

    function replaceTurkishChars(value) {
        return String(value || '')
            .replace(/ı/g, 'i')
            .replace(/İ/g, 'i')
            .replace(/ğ/g, 'g')
            .replace(/Ğ/g, 'g')
            .replace(/ş/g, 's')
            .replace(/Ş/g, 's')
            .replace(/ç/g, 'c')
            .replace(/Ç/g, 'c')
            .replace(/ö/g, 'o')
            .replace(/Ö/g, 'o')
            .replace(/ü/g, 'u')
            .replace(/Ü/g, 'u');
    }

    function normalizeText(value) {
        return replaceTurkishChars(value)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function tokenize(value) {
        return normalizeText(value)
            .split(' ')
            .map(token => token.trim())
            .filter(token => token && token.length > 1 && !STOP_WORDS.has(token));
    }

    function uniq(values) {
        return Array.from(new Set((values || []).filter(Boolean)));
    }

    function hashString(value) {
        let hash = 0;
        const content = String(value || '');
        for (let index = 0; index < content.length; index += 1) {
            hash = ((hash << 5) - hash) + content.charCodeAt(index);
            hash |= 0;
        }
        return Math.abs(hash).toString(36);
    }

    function roundToNearest50(value) {
        return Math.max(200, Math.round(Number(value || 0) / 50) * 50);
    }

    function roundBlockDistance(value, min = 50) {
        return Math.max(min, Math.round(Number(value || 0) / 50) * 50);
    }

    function formatRelativeDate(value) {
        if (!value) {
            return 'Tarih yok';
        }

        const date = typeof value === 'string' ? new Date(value) : (value.toDate ? value.toDate() : new Date(value));
        if (Number.isNaN(date.getTime())) {
            return 'Tarih yok';
        }
        return date.toLocaleString('tr-TR');
    }

    function getTrainerContext() {
        if (typeof window.getTrainerAiContext === 'function') {
            return window.getTrainerAiContext() || {};
        }
        return {};
    }

    function getSuperAdminContext() {
        if (typeof window.getSuperAdminAiContext === 'function') {
            return window.getSuperAdminAiContext() || {};
        }
        return {};
    }

    function getCurrentTrainer() {
        return getTrainerContext().currentTrainer || null;
    }

    function getCurrentSuperAdmin() {
        return getSuperAdminContext().currentSuperAdmin || null;
    }

    function isLocalDevelopmentOrigin() {
        const hostname = String(window.location.hostname || '').toLowerCase();
        return window.location.protocol === 'file:'
            || hostname === '127.0.0.1'
            || hostname === 'localhost'
            || hostname === '::1';
    }

    function buildStorageUploadWarning(error) {
        const message = String(error?.message || '').toLowerCase();
        if (message.includes('cors') || message.includes('xmlhttprequest') || message.includes('preflight')) {
            return 'Storage kopyasi CORS nedeniyle yuklenemedi; belge metni yine de AI havuzuna eklendi.';
        }
        return 'Storage kopyasi yuklenemedi; belge metni yine de AI havuzuna eklendi.';
    }

    function invalidateKnowledgeCache() {
        cacheState.sources = null;
        cacheState.chunks = null;
        cacheState.insights = null;
    }

    function invalidateFeedCache() {
        cacheState.feeds = null;
    }

    function invalidateLearningCache() {
        cacheState.workoutSales = null;
        cacheState.workouts = null;
        cacheState.insights = null;
        invalidateKnowledgeCache();
    }

    function ensurePdfWorkerConfigured() {
        if (!window.pdfjsLib || !window.pdfjsLib.GlobalWorkerOptions) {
            return;
        }
        if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        }
        if (window.pdfjsLib.VerbosityLevel) {
            window.pdfjsLib.verbosity = window.pdfjsLib.VerbosityLevel.ERRORS;
        }
    }

    async function readFileAsText(file) {
        return file.text();
    }

    async function extractPdfText(file) {
        if (!window.pdfjsLib) {
            throw new Error('PDF motoru yuklenmedi.');
        }

        ensurePdfWorkerConfigured();
        const buffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({
            data: buffer,
            verbosity: window.pdfjsLib.VerbosityLevel ? window.pdfjsLib.VerbosityLevel.ERRORS : 0
        }).promise;
        let fullText = '';
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str || '').join(' ');
            fullText += `\n${pageText}`;
        }
        return fullText.trim();
    }

    function htmlToText(content) {
        if (!content) {
            return '';
        }
        try {
            const parser = new DOMParser();
            const documentNode = parser.parseFromString(content, 'text/html');
            documentNode.querySelectorAll('script, style, noscript, iframe, svg, canvas').forEach(node => node.remove());

            const bodyClone = (documentNode.body || documentNode.documentElement).cloneNode(true);
            bodyClone.querySelectorAll('br').forEach(node => node.replaceWith(documentNode.createTextNode('\n')));
            bodyClone.querySelectorAll('p, div, section, article, header, footer, li, h1, h2, h3, h4, h5, h6, tr, td, th, blockquote, pre').forEach(node => {
                node.appendChild(documentNode.createTextNode('\n'));
            });

            const title = documentNode.querySelector('title')?.textContent || '';
            const metaDescription = documentNode.querySelector('meta[name="description"]')?.getAttribute('content') || '';
            const combinedText = [title, metaDescription, bodyClone.textContent || '']
                .filter(Boolean)
                .join('\n\n');

            return combinedText
                .replace(/\u00a0/g, ' ')
                .replace(/[ \t]+\n/g, '\n')
                .replace(/\n[ \t]+/g, '\n')
                .replace(/\n{3,}/g, '\n\n')
                .replace(/[ \t]{2,}/g, ' ')
                .trim();
        } catch (error) {
            return String(content || '').replace(/<[^>]+>/g, ' ');
        }
    }

    function detectPrimaryDocumentLanguage(text) {
        const sample = String(text || '').slice(0, 5000);
        if (!sample.trim()) {
            return 'unknown';
        }
        if (/[ğıüşöçİĞÜŞÖÇ]/.test(sample)) {
            return 'tr';
        }

        const tokens = normalizeText(sample).split(' ').filter(Boolean);
        let turkishScore = 0;
        let englishScore = 0;
        tokens.forEach(token => {
            if (TURKISH_DETECTION_WORDS.has(token)) {
                turkishScore += 1;
            }
            if (ENGLISH_DETECTION_WORDS.has(token)) {
                englishScore += 1;
            }
        });

        if (turkishScore >= Math.max(2, englishScore + 1)) {
            return 'tr';
        }
        if (englishScore >= Math.max(2, turkishScore + 1)) {
            return 'en';
        }
        return 'unknown';
    }

    function hasTranslatableText(text) {
        const letters = String(text || '').match(/[A-Za-z\u00C0-\u024F]/g);
        return Array.isArray(letters) && letters.length >= 30;
    }

    function splitLongSegment(segment, maxChars) {
        const chunks = [];
        let remaining = String(segment || '').trim();
        while (remaining.length > maxChars) {
            let splitIndex = remaining.lastIndexOf(' ', maxChars);
            if (splitIndex < Math.floor(maxChars * 0.5)) {
                splitIndex = maxChars;
            }
            chunks.push(remaining.slice(0, splitIndex).trim());
            remaining = remaining.slice(splitIndex).trim();
        }
        if (remaining) {
            chunks.push(remaining);
        }
        return chunks;
    }

    function splitTextForTranslation(text, maxChars = TRANSLATION_SEGMENT_LIMIT) {
        const paragraphs = String(text || '')
            .replace(/\r/g, '')
            .split(/\n+/)
            .map(paragraph => paragraph.trim())
            .filter(Boolean);

        const segments = [];
        let current = '';

        const commitCurrent = () => {
            if (current.trim()) {
                segments.push(current.trim());
                current = '';
            }
        };

        paragraphs.forEach(paragraph => {
            if (paragraph.length > maxChars) {
                commitCurrent();
                splitLongSegment(paragraph, maxChars).forEach(item => segments.push(item));
                return;
            }

            const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
            if (candidate.length > maxChars) {
                commitCurrent();
                current = paragraph;
                return;
            }
            current = candidate;
        });

        commitCurrent();
        return segments.length ? segments : splitLongSegment(String(text || '').trim(), maxChars);
    }

    function extractTranslatedTextFromResponse(payload) {
        if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
            return '';
        }
        return payload[0].map(part => Array.isArray(part) ? part[0] || '' : '').join('').trim();
    }

    async function translateSegmentToTurkish(segment) {
        const response = await fetch(`${TRANSLATION_ENDPOINT}${encodeURIComponent(segment)}`);
        if (!response.ok) {
            throw new Error(`Ceviri servisi ${response.status} dondu.`);
        }
        const payload = await response.json();
        const translated = extractTranslatedTextFromResponse(payload);
        if (!translated) {
            throw new Error('Ceviri servisi bos sonuc dondurdu.');
        }
        return translated;
    }

    async function maybeTranslateTextToTurkish(text) {
        const originalText = String(text || '').trim();
        const sourceLanguage = detectPrimaryDocumentLanguage(originalText);

        if (!originalText) {
            return {
                text: '',
                sourceLanguage,
                translationApplied: false,
                translationStatus: 'empty',
                note: ''
            };
        }

        if (sourceLanguage === 'tr' || !hasTranslatableText(originalText)) {
            return {
                text: originalText,
                sourceLanguage,
                translationApplied: false,
                translationStatus: sourceLanguage === 'tr' ? 'skipped-turkish' : 'skipped-nontext',
                note: ''
            };
        }

        try {
            const segments = splitTextForTranslation(originalText);
            const translatedSegments = [];
            for (const segment of segments) {
                translatedSegments.push(await translateSegmentToTurkish(segment));
            }

            const translatedText = translatedSegments.join('\n\n').trim();
            if (!translatedText) {
                throw new Error('Ceviri sonucu bos geldi.');
            }

            return {
                text: translatedText,
                sourceLanguage,
                translationApplied: true,
                translationStatus: 'translated-to-tr',
                note: 'Yabanci belge otomatik Turkceye cevrildi ve Turkce icerikle indekslendi.'
            };
        } catch (error) {
            console.warn('Document translation skipped:', error);
            return {
                text: originalText,
                sourceLanguage,
                translationApplied: false,
                translationStatus: 'translation-failed',
                note: `Ceviri basarisiz oldu, orijinal metinle devam edildi: ${error.message}`
            };
        }
    }

    function flattenJsonValue(value, path = '') {
        if (value === null || value === undefined) {
            return [];
        }

        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return [`${path}: ${String(value)}`.trim()];
        }

        if (Array.isArray(value)) {
            return value.flatMap((item, index) => flattenJsonValue(item, `${path}[${index}]`));
        }

        if (typeof value === 'object') {
            return Object.entries(value).flatMap(([key, nested]) => flattenJsonValue(nested, path ? `${path}.${key}` : key));
        }

        return [];
    }

    async function extractDocumentText(file) {
        const extension = String(file.name || '').split('.').pop().toLowerCase();
        if (extension === 'pdf') {
            return extractPdfText(file);
        }

        const rawText = await readFileAsText(file);
        if (extension === 'html' || extension === 'htm') {
            return htmlToText(rawText);
        }
        if (extension === 'json') {
            try {
                return flattenJsonValue(JSON.parse(rawText)).join('\n');
            } catch (error) {
                return rawText;
            }
        }
        return rawText;
    }

    function extractRemoteTextPayload(rawText, contentType = '') {
        if (looksLikeHtml(rawText, contentType)) {
            return htmlToText(rawText);
        }

        if (String(contentType || '').toLowerCase().includes('json') || looksLikeJson(rawText)) {
            try {
                return flattenJsonValue(JSON.parse(rawText)).join('\n');
            } catch (error) {
                return String(rawText || '').trim();
            }
        }

        return String(rawText || '').trim();
    }

    function buildReadableMirrorUrl(url) {
        const normalizedUrl = normalizeUrl(url).replace(/^https?:\/\//i, '');
        return `${REMOTE_TEXT_READABLE_ENDPOINT}${normalizedUrl
            .replace(/\?/g, '%3F')
            .replace(/#/g, '%23')
            .replace(/&/g, '%26')
            .replace(/=/g, '%3D')}`;
    }

    function shouldAttemptDirectRemoteFetch(url) {
        try {
            const parsedUrl = new URL(normalizeUrl(url));
            return parsedUrl.origin === window.location.origin;
        } catch (error) {
            return false;
        }
    }

    async function fetchWithTimeout(url, timeoutMs) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs || 0)));

        try {
            return await fetch(url, {
                signal: controller.signal,
                cache: 'no-store'
            });
        } catch (error) {
            if (error?.name === 'AbortError') {
                throw new Error('Kaynak yanit vermedi veya zaman asimina ugradi.');
            }
            throw error;
        } finally {
            window.clearTimeout(timeoutId);
        }
    }

    function buildRemoteKnowledgeFetchAttempts(normalizedUrl) {
        const attempts = [
            {
                strategy: 'readable-mirror',
                requestUrl: buildReadableMirrorUrl(normalizedUrl),
                timeoutMs: REMOTE_TEXT_PRIMARY_TIMEOUT_MS
            },
            {
                strategy: 'cors-proxy',
                requestUrl: `${REMOTE_TEXT_PROXY_ENDPOINT}${encodeURIComponent(normalizedUrl)}`,
                timeoutMs: REMOTE_TEXT_FALLBACK_TIMEOUT_MS
            }
        ];

        if (shouldAttemptDirectRemoteFetch(normalizedUrl)) {
            attempts.push({
                strategy: 'direct',
                requestUrl: normalizedUrl,
                timeoutMs: REMOTE_TEXT_FALLBACK_TIMEOUT_MS
            });
        }

        return attempts;
    }

    async function fetchRemoteKnowledgeText(url) {
        const normalizedUrl = normalizeUrl(url);
        const attempts = buildRemoteKnowledgeFetchAttempts(normalizedUrl);

        let lastError = null;
        for (const attempt of attempts) {
            try {
                const response = await fetchWithTimeout(attempt.requestUrl, attempt.timeoutMs);
                if (!response.ok) {
                    throw new Error(`Kaynak ${response.status} dondu.`);
                }

                const rawText = await response.text();
                const contentType = response.headers.get('content-type') || '';
                const extractedText = extractRemoteTextPayload(rawText, contentType);
                if (!extractedText || extractedText.trim().length < 80) {
                    throw new Error('Linkte yeterli okunabilir metin bulunamadi.');
                }

                return {
                    text: extractedText,
                    fetchStrategy: attempt.strategy,
                    contentType,
                    fetchedUrl: response.url || attempt.requestUrl,
                    rawLength: rawText.length
                };
            } catch (error) {
                lastError = error;
            }
        }

        throw new Error(lastError?.message || 'Link kaynagi okunamadi. Site tarayiciya kapaliysa icerigi dosya veya toplu metin olarak ekleyin.');
    }

    function buildTextChunks(text, metadata) {
        const cleanedText = String(text || '').replace(/\s+/g, ' ').trim();
        if (!cleanedText) {
            return [];
        }

        const chunks = [];
        let cursor = 0;
        let index = 0;

        while (cursor < cleanedText.length) {
            const end = Math.min(cleanedText.length, cursor + CHUNK_SIZE);
            const chunkText = cleanedText.slice(cursor, end).trim();
            if (chunkText) {
                chunks.push({
                    id: `${metadata.sourceId}_${index}`,
                    sourceId: metadata.sourceId,
                    scopeType: GLOBAL_SCOPE,
                    index,
                    text: chunkText,
                    normalizedText: normalizeText(chunkText),
                    tokens: uniq(tokenize(chunkText)).slice(0, 80),
                    sourceType: metadata.sourceType,
                    sourceName: metadata.sourceName,
                    ageTags: metadata.ageTags || [],
                    styleTags: metadata.styleTags || [],
                    goalTags: metadata.goalTags || [],
                    createdAt: metadata.createdAt,
                    ownerRole: metadata.ownerRole || 'system',
                    ownerId: metadata.ownerId || ''
                });
                index += 1;
            }

            if (end >= cleanedText.length) {
                break;
            }
            cursor = Math.max(0, end - CHUNK_OVERLAP);
        }

        return chunks;
    }

    async function deleteExistingSourceArtifacts(sourceId) {
        const existingChunksSnap = await db.collection(AI_CHUNKS_COLLECTION)
            .where('sourceId', '==', sourceId)
            .get();

        if (!existingChunksSnap.empty) {
            let chunkBatch = db.batch();
            let chunkCount = 0;
            for (const chunkDoc of existingChunksSnap.docs) {
                chunkBatch.delete(chunkDoc.ref);
                chunkCount += 1;
                if (chunkCount === 350) {
                    await chunkBatch.commit();
                    chunkBatch = db.batch();
                    chunkCount = 0;
                }
            }
            if (chunkCount > 0) {
                await chunkBatch.commit();
            }
        }

        await db.collection(AI_SOURCES_COLLECTION).doc(sourceId).delete().catch(() => {});
    }

    async function writeSourceAndChunks(payload) {
        await deleteExistingSourceArtifacts(payload.sourceId);

        const sourceDoc = {
            sourceId: payload.sourceId,
            sourceName: payload.sourceName,
            sourceType: payload.sourceType,
            scopeType: GLOBAL_SCOPE,
            ownerRole: payload.ownerRole || 'system',
            ownerId: payload.ownerId || '',
            uploadedByName: payload.uploadedByName || '',
            uploadedByEmail: payload.uploadedByEmail || '',
            fileName: payload.fileName || payload.sourceName,
            fileUrl: payload.fileUrl || '',
            chunkCount: payload.chunks.length,
            charCount: String(payload.text || '').length,
            ageTags: payload.ageTags || [],
            styleTags: payload.styleTags || [],
            goalTags: payload.goalTags || [],
            referenceLinks: payload.referenceLinks || [],
            sourceLabel: payload.sourceLabel || '',
            metadata: payload.metadata || {},
            createdAt: payload.createdAt,
            updatedAt: payload.createdAt,
            sampleText: String(payload.text || '').slice(0, 260)
        };

        await db.collection(AI_SOURCES_COLLECTION).doc(payload.sourceId).set(sourceDoc);

        let batch = db.batch();
        let operationCount = 0;
        for (const chunk of payload.chunks) {
            const chunkRef = db.collection(AI_CHUNKS_COLLECTION).doc(chunk.id);
            batch.set(chunkRef, chunk);
            operationCount += 1;
            if (operationCount === 350) {
                await batch.commit();
                batch = db.batch();
                operationCount = 0;
            }
        }
        if (operationCount > 0) {
            await batch.commit();
        }

        invalidateKnowledgeCache();
    }

    async function uploadSourceFileToStorage(file, sourceId) {
        if (isLocalDevelopmentOrigin()) {
            return {
                fileUrl: '',
                status: 'skipped-local-dev',
                warning: 'Local gelistirme origininde Storage arsiv kopyasi atlandi; belge metni AI havuzuna eklendi.'
            };
        }

        try {
            const safeName = sanitizeForPath(file.name || sourceId);
            const ref = storage.ref().child(`ai-knowledge/${GLOBAL_SCOPE}/${sourceId}_${safeName}`);
            await ref.put(file);
            return {
                fileUrl: await ref.getDownloadURL(),
                status: 'uploaded',
                warning: ''
            };
        } catch (error) {
            console.warn('AI source storage upload skipped:', error);
            return {
                fileUrl: '',
                status: 'failed',
                warning: buildStorageUploadWarning(error)
            };
        }
    }

    async function ingestTextAsKnowledge(input) {
        const createdAt = new Date().toISOString();
        const chunks = buildTextChunks(input.text, {
            sourceId: input.sourceId,
            sourceName: input.sourceName,
            sourceType: input.sourceType,
            ageTags: input.ageTags || [],
            styleTags: input.styleTags || [],
            goalTags: input.goalTags || [],
            createdAt,
            ownerRole: input.ownerRole,
            ownerId: input.ownerId
        });

        await writeSourceAndChunks({
            sourceId: input.sourceId,
            sourceName: input.sourceName,
            sourceType: input.sourceType,
            fileName: input.fileName,
            fileUrl: input.fileUrl,
            text: input.text,
            chunks,
            ageTags: input.ageTags || [],
            styleTags: input.styleTags || [],
            goalTags: input.goalTags || [],
            referenceLinks: input.referenceLinks || [],
            sourceLabel: input.sourceLabel || '',
            metadata: input.metadata || {},
            createdAt,
            ownerRole: input.ownerRole,
            ownerId: input.ownerId,
            uploadedByName: input.uploadedByName || '',
            uploadedByEmail: input.uploadedByEmail || ''
        });
    }

    async function fetchKnowledgeSources(forceRefresh = false) {
        if (!forceRefresh && Array.isArray(cacheState.sources)) {
            return cacheState.sources;
        }

        const snap = await db.collection(AI_SOURCES_COLLECTION)
            .where('scopeType', '==', GLOBAL_SCOPE)
            .get();

        cacheState.sources = snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((left, right) => String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || '')));

        return cacheState.sources;
    }

    async function fetchMonitoredFeeds(forceRefresh = false) {
        if (!forceRefresh && Array.isArray(cacheState.feeds)) {
            return cacheState.feeds;
        }

        const snap = await db.collection(AI_FEEDS_COLLECTION)
            .where('scopeType', '==', GLOBAL_SCOPE)
            .get();

        cacheState.feeds = snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((left, right) => String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || '')));

        return cacheState.feeds;
    }

    async function createOrUpdateMonitoredFeed(input) {
        const actor = getCurrentSuperAdmin();
        if (!actor?.id) {
            throw new Error('Super Admin bilgisi bulunamadi.');
        }

        const normalizedUrl = normalizeUrl(input.url);
        const feedId = buildMonitoredFeedId(normalizedUrl);
        const intervalHours = Math.max(1, Number(input.intervalHours || 24));
        const now = new Date().toISOString();
        const docRef = db.collection(AI_FEEDS_COLLECTION).doc(feedId);
        const existingDoc = await docRef.get();
        const existingData = existingDoc.exists ? existingDoc.data() : null;

        await docRef.set({
            feedId,
            scopeType: GLOBAL_SCOPE,
            url: normalizedUrl,
            label: String(input.label || '').trim(),
            notes: String(input.notes || '').trim(),
            intervalHours,
            enabled: true,
            createdAt: existingData?.createdAt || now,
            updatedAt: now,
            nextSyncAt: existingData?.nextSyncAt || now,
            lastSyncStatus: existingData?.lastSyncStatus || 'pending',
            lastError: existingData?.lastError || '',
            lastSyncedAt: existingData?.lastSyncedAt || '',
            lastAttemptAt: existingData?.lastAttemptAt || '',
            lastContentHash: existingData?.lastContentHash || '',
            lastSourceId: existingData?.lastSourceId || '',
            ownerRole: 'superadmin',
            ownerId: actor.id,
            uploadedByName: actor.name || 'Super Admin',
            uploadedByEmail: actor.email || ''
        }, { merge: true });

        invalidateFeedCache();
        return {
            feedId,
            existed: !!existingData,
            url: normalizedUrl
        };
    }

    async function updateMonitoredFeed(feedId, payload) {
        await db.collection(AI_FEEDS_COLLECTION).doc(feedId).set({
            ...payload,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        invalidateFeedCache();
    }

    async function removeMonitoredFeed(feedId) {
        await deleteExistingSourceArtifacts(buildMonitoredFeedSourceId(feedId));
        await db.collection(AI_FEEDS_COLLECTION).doc(feedId).delete();
        invalidateFeedCache();
        invalidateKnowledgeCache();
    }

    async function setMonitoredFeedEnabled(feedId, enabled) {
        const feedDoc = await db.collection(AI_FEEDS_COLLECTION).doc(feedId).get();
        if (!feedDoc.exists) {
            throw new Error('Izlenen link bulunamadi.');
        }

        const feed = feedDoc.data() || {};
        await updateMonitoredFeed(feedId, {
            enabled: !!enabled,
            nextSyncAt: enabled ? new Date().toISOString() : (feed.nextSyncAt || ''),
            lastError: enabled ? '' : (feed.lastError || '')
        });
    }

    async function syncMonitoredFeed(feedInput, options = {}) {
        const feed = typeof feedInput === 'string'
            ? await (async () => {
                const feedDoc = await db.collection(AI_FEEDS_COLLECTION).doc(feedInput).get();
                if (!feedDoc.exists) {
                    throw new Error('Izlenen link bulunamadi.');
                }
                return { id: feedDoc.id, ...feedDoc.data() };
            })()
            : feedInput;

        const feedId = feed.feedId || feed.id;
        if (!feedId) {
            throw new Error('Feed kimligi eksik.');
        }
        if (!feed.enabled && !options.force) {
            return { feedId, status: 'disabled' };
        }

        const now = new Date().toISOString();
        const nextSyncAt = calculateNextSyncAt(feed.intervalHours || 24, now);

        try {
            const remoteResult = await fetchRemoteKnowledgeText(feed.url);
            const translationResult = await maybeTranslateTextToTurkish(remoteResult.text);
            const normalizedText = String(translationResult.text || '').trim();
            if (!normalizedText) {
                throw new Error('Linkten okunabilir icerik cikarilamadi.');
            }

            const contentHash = hashString(normalizedText);
            if (!options.force && feed.lastContentHash && feed.lastContentHash === contentHash) {
                await updateMonitoredFeed(feedId, {
                    lastAttemptAt: now,
                    lastSyncedAt: now,
                    nextSyncAt,
                    lastSyncStatus: 'unchanged',
                    lastError: '',
                    lastContentHash: contentHash
                });

                return {
                    feedId,
                    status: 'unchanged',
                    fetchStrategy: remoteResult.fetchStrategy,
                    translationApplied: translationResult.translationApplied
                };
            }

            const sourceId = buildMonitoredFeedSourceId(feedId);
            await ingestTextAsKnowledge({
                sourceId,
                sourceName: feed.label || feed.url,
                sourceType: 'monitored-link',
                fileName: `${sanitizeForPath(feed.label || feed.url || feedId)}.txt`,
                fileUrl: feed.url,
                text: normalizedText,
                ageTags: [],
                styleTags: [],
                goalTags: [],
                referenceLinks: uniq([feed.url]),
                sourceLabel: feed.label || 'Izlenen link',
                ownerRole: 'superadmin',
                ownerId: feed.ownerId || '',
                uploadedByName: feed.uploadedByName || 'Super Admin',
                uploadedByEmail: feed.uploadedByEmail || '',
                metadata: {
                    importedFrom: 'monitored-link',
                    feedId,
                    originalUrl: feed.url,
                    fetchStrategy: remoteResult.fetchStrategy,
                    fetchedUrl: remoteResult.fetchedUrl,
                    contentType: remoteResult.contentType,
                    rawLength: remoteResult.rawLength,
                    sourceLanguage: translationResult.sourceLanguage || 'unknown',
                    translationApplied: translationResult.translationApplied,
                    translationStatus: translationResult.translationStatus,
                    translatedTo: translationResult.translationApplied ? 'tr' : '',
                    contentHash
                }
            });

            await updateMonitoredFeed(feedId, {
                lastAttemptAt: now,
                lastSyncedAt: now,
                nextSyncAt,
                lastSyncStatus: 'synced',
                lastError: '',
                lastContentHash: contentHash,
                lastSourceId: sourceId,
                lastFetchStrategy: remoteResult.fetchStrategy,
                lastSourceLanguage: translationResult.sourceLanguage || 'unknown',
                lastTranslationStatus: translationResult.translationStatus,
                lastContentSample: normalizedText.slice(0, 220)
            });

            return {
                feedId,
                status: 'synced',
                fetchStrategy: remoteResult.fetchStrategy,
                translationApplied: translationResult.translationApplied
            };
        } catch (error) {
            await updateMonitoredFeed(feedId, {
                lastAttemptAt: now,
                nextSyncAt,
                lastSyncStatus: 'failed',
                lastError: error.message || 'Link senkronize edilemedi.'
            });

            return {
                feedId,
                status: 'failed',
                error: error.message || 'Link senkronize edilemedi.'
            };
        }
    }

    async function syncDueMonitoredFeeds(options = {}) {
        const feeds = await fetchMonitoredFeeds(!!options.forceRefresh);
        const candidates = feeds.filter(feed => feed.enabled && (options.forceAll || isFeedDue(feed)));
        const summary = {
            processed: candidates.length,
            synced: 0,
            unchanged: 0,
            failed: 0,
            skipped: Math.max(0, feeds.length - candidates.length),
            results: []
        };

        for (const feed of candidates) {
            const result = await syncMonitoredFeed(feed, { force: !!options.forceAll });
            summary.results.push(result);
            if (result.status === 'synced') {
                summary.synced += 1;
            } else if (result.status === 'unchanged') {
                summary.unchanged += 1;
            } else if (result.status === 'failed') {
                summary.failed += 1;
            }
        }

        return summary;
    }

    async function fetchKnowledgeChunks(forceRefresh = false) {
        if (!forceRefresh && Array.isArray(cacheState.chunks)) {
            return cacheState.chunks;
        }

        const snap = await db.collection(AI_CHUNKS_COLLECTION)
            .where('scopeType', '==', GLOBAL_SCOPE)
            .limit(MAX_CHUNKS_FOR_SEARCH)
            .get();

        cacheState.chunks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return cacheState.chunks;
    }

    async function fetchGlobalWorkoutSales(forceRefresh = false) {
        if (!forceRefresh && Array.isArray(cacheState.workoutSales)) {
            return cacheState.workoutSales;
        }

        const snap = await db.collection('workout_sales').limit(MAX_FETCH_RECORDS).get();
        cacheState.workoutSales = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return cacheState.workoutSales;
    }

    async function fetchGlobalWorkouts(forceRefresh = false) {
        if (!forceRefresh && Array.isArray(cacheState.workouts)) {
            return cacheState.workouts;
        }

        const snap = await db.collection('workouts').limit(MAX_FETCH_RECORDS).get();
        cacheState.workouts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return cacheState.workouts;
    }

    function normalizeLevelKey(value) {
        const normalized = normalizeText(value);
        if (!normalized) {
            return '';
        }
        if (normalized.includes('baslang')) {
            return 'beginner';
        }
        if (normalized.includes('orta') || normalized.includes('intermediate')) {
            return 'intermediate';
        }
        if (normalized.includes('ileri') || normalized.includes('advanced')) {
            return 'advanced';
        }
        if (normalized.includes('perform')) {
            return 'performance';
        }
        return '';
    }

    function normalizeGoalKey(value) {
        const normalized = normalizeText(value);
        if (!normalized) {
            return '';
        }
        if (normalized.includes('teknik')) {
            return 'teknik';
        }
        if (normalized.includes('sprint') || normalized.includes('hiz')) {
            return 'sprint';
        }
        if (normalized.includes('dayanik') || normalized.includes('aerob')) {
            return 'dayaniklilik';
        }
        if (normalized.includes('yaris') || normalized.includes('pace')) {
            return 'yaris';
        }
        if (normalized.includes('ayak') || normalized.includes('kick')) {
            return 'ayak';
        }
        if (normalized.includes('genel')) {
            return 'genel';
        }
        return '';
    }

    function normalizeStyleKey(value) {
        const normalized = normalizeText(value);
        if (!normalized) {
            return '';
        }

        for (const [alias, canonical] of Object.entries(STYLE_ALIASES)) {
            if (normalized.includes(alias)) {
                return canonical;
            }
        }
        return '';
    }

    function getAgeBucket(age) {
        const numericAge = Number(age);
        if (!Number.isFinite(numericAge) || numericAge <= 0) {
            return '';
        }
        if (numericAge <= 8) {
            return '7-8 yas';
        }
        if (numericAge <= 10) {
            return '9-10 yas';
        }
        if (numericAge <= 12) {
            return '11-12 yas';
        }
        if (numericAge <= 14) {
            return '13-14 yas';
        }
        if (numericAge <= 16) {
            return '15-16 yas';
        }
        return '17+ yas';
    }

    function extractAgeProfile(text) {
        const normalized = normalizeText(text);
        let match = normalized.match(/(\d{1,2})\s*[- ]\s*(\d{1,2})\s*yas/);
        if (!match) {
            match = normalized.match(/(\d{1,2})\s*(\d{1,2})\s*yas/);
        }
        if (match) {
            const startAge = Number(match[1]);
            const endAge = Number(match[2]);
            if (Number.isFinite(startAge) && Number.isFinite(endAge)) {
                return {
                    age: Math.round((startAge + endAge) / 2),
                    ageGroupLabel: `${startAge}-${endAge} yas`
                };
            }
        }

        match = normalized.match(/(\d{1,2})\s*yas/);
        if (match) {
            const age = Number(match[1]);
            if (Number.isFinite(age)) {
                return {
                    age,
                    ageGroupLabel: `${age} yas`
                };
            }
        }

        return {};
    }

    function extractSlotsFromText(text) {
        const rawText = String(text || '').trim();
        const normalized = normalizeText(rawText);
        const ageProfile = extractAgeProfile(rawText);
        const levelKey = normalizeLevelKey(rawText);
        const goalKey = normalizeGoalKey(rawText);
        const focusStyle = normalizeStyleKey(rawText);
        const durationMatch = normalized.match(/(\d{2,3})\s*dak/);
        const weeklyMatch = normalized.match(/haftada\s*(\d{1,2})|(?:^|\s)(\d{1,2})\s*(?:gun|antrenman)/);
        const targetDistanceMatch = normalized.match(/(\d{3,4})\s*m/);

        const slots = {
            notes: rawText
        };

        if (Number.isFinite(Number(ageProfile.age))) {
            slots.age = Number(ageProfile.age);
            slots.ageGroupLabel = ageProfile.ageGroupLabel || getAgeBucket(ageProfile.age);
        }
        if (levelKey) {
            slots.levelKey = levelKey;
        }
        if (goalKey) {
            slots.goalKey = goalKey;
        }
        if (focusStyle) {
            slots.focusStyle = focusStyle;
        }
        if (durationMatch) {
            slots.sessionDuration = Number(durationMatch[1]);
        }
        if (weeklyMatch) {
            slots.weeklySessions = Number(weeklyMatch[1] || weeklyMatch[2]);
        }
        if (targetDistanceMatch) {
            const targetDistance = Number(targetDistanceMatch[1]);
            if (Number.isFinite(targetDistance) && targetDistance >= 200) {
                slots.targetDistance = targetDistance;
            }
        }

        return slots;
    }

    function mergeProfile(currentProfile, nextProfile) {
        const mergedNotes = [currentProfile.notes, nextProfile.notes]
            .map(item => String(item || '').trim())
            .filter(Boolean)
            .join(' | ');

        const merged = {
            ...currentProfile,
            ...nextProfile,
            notes: mergedNotes
        };

        if (!merged.ageGroupLabel && Number.isFinite(Number(merged.age))) {
            merged.ageGroupLabel = getAgeBucket(merged.age);
        }
        return merged;
    }

    function getMissingProfileFields(profile) {
        const missing = [];
        if (!Number.isFinite(Number(profile.age))) {
            missing.push('age');
        }
        if (!profile.levelKey) {
            missing.push('level');
        }
        if (!profile.goalKey) {
            missing.push('goal');
        }
        if (!Number.isFinite(Number(profile.sessionDuration))) {
            missing.push('duration');
        }
        return missing;
    }

    function getTrainerFieldPromptLabel(field) {
        const fieldMap = {
            age: 'Yas grubu',
            level: 'Seviye',
            goal: 'Hedef',
            duration: 'Sure',
            style: 'Stil / odak'
        };

        return fieldMap[field] || field;
    }

    function buildMissingInfoHtml(missingFields) {
        const fieldMap = {
            age: 'Yas grubu: ornek 9-10 yas',
            level: 'Seviye: baslangic, orta, ileri ya da performans',
            goal: 'Hedef: teknik, sprint, dayaniklilik, yaris, ayak veya genel',
            duration: 'Ders suresi: ornek 60 dakika'
        };

        const listHtml = missingFields
            .map(field => `<li style="margin-bottom:6px;">${escapeHtml(fieldMap[field] || field)}</li>`)
            .join('');

        return `
            <div style="font-weight:700; margin-bottom:8px; color:#2c3e50;">Plan cikarmam icin su bilgileri netlestir:</div>
            <ul style="margin:0; padding-left:18px; color:#5f6c7b; line-height:1.6;">${listHtml}</ul>
            <div style="margin-top:10px; padding:10px 12px; border-radius:10px; background:#eef6ff; color:#35516e; line-height:1.6;">
                Ornek tek mesaj: <strong>Yas grubu: 9-10 yas, seviye: orta, hedef: teknik, sure: 60 dakika, stil/odak: serbest nefes ritmi</strong>
            </div>
        `;
    }

    function buildTrainerChecklistItems(profile) {
        return [
            {
                key: 'age',
                label: profile.ageGroupLabel || getTrainerFieldPromptLabel('age'),
                done: Number.isFinite(Number(profile.age))
            },
            {
                key: 'level',
                label: profile.levelKey ? (LEVEL_LABELS[profile.levelKey] || profile.levelKey) : getTrainerFieldPromptLabel('level'),
                done: Boolean(profile.levelKey)
            },
            {
                key: 'goal',
                label: profile.goalKey ? (GOAL_LABELS[profile.goalKey] || profile.goalKey) : getTrainerFieldPromptLabel('goal'),
                done: Boolean(profile.goalKey)
            },
            {
                key: 'duration',
                label: Number.isFinite(Number(profile.sessionDuration)) ? `${profile.sessionDuration} dakika` : getTrainerFieldPromptLabel('duration'),
                done: Number.isFinite(Number(profile.sessionDuration))
            },
            {
                key: 'style',
                label: profile.focusStyle || getTrainerFieldPromptLabel('style'),
                done: Boolean(profile.focusStyle)
            }
        ];
    }

    function renderTrainerInputGuidance(text = '') {
        const checklist = q('trainerAiPromptChecklist');
        const summary = q('trainerAiDetectedSummary');
        if (!checklist && !summary) {
            return;
        }

        const previewProfile = mergeProfile(trainerUiState.profile, extractSlotsFromText(text));
        const checklistItems = buildTrainerChecklistItems(previewProfile);
        const missingFields = getMissingProfileFields(previewProfile);

        if (checklist) {
            checklist.innerHTML = checklistItems.map(item => `
                <div class="trainer-ai-check-item ${item.done ? 'is-done' : ''}">
                    <span class="trainer-ai-check-mark">${item.done ? 'Tamam' : 'Bekleniyor'}</span>
                    <strong>${escapeHtml(item.label)}</strong>
                </div>
            `).join('');
        }

        if (!summary) {
            return;
        }

        if (!String(text || '').trim() && !trainerUiState.profile.notes) {
            summary.innerHTML = 'Mesaj yazdikca sistem yas, seviye, hedef ve sureyi otomatik algilar. Istiyorsan "Taslak Ekle" ile hazir metni doldur.';
            return;
        }

        const detectedHtml = checklistItems
            .filter(item => item.done)
            .map(item => `<span class="trainer-ai-detected-chip">${escapeHtml(item.label)}</span>`)
            .join('');
        const missingHtml = missingFields.length
            ? missingFields.map(field => `<span class="trainer-ai-missing-chip">${escapeHtml(getTrainerFieldPromptLabel(field))}</span>`).join('')
            : '<span class="trainer-ai-ready-chip">Plan cikarmak icin veri yeterli.</span>';

        summary.innerHTML = `
            <div class="trainer-ai-summary-row">
                <strong>Algilanan:</strong>
                ${detectedHtml || '<span>Henuz net alan yok.</span>'}
            </div>
            <div class="trainer-ai-summary-row">
                <strong>Eksik kalan:</strong>
                ${missingHtml}
            </div>
        `;
    }

    function insertTrainerPromptTemplate() {
        const input = q('trainerAiChatInput');
        if (!input) {
            return;
        }

        input.value = STRUCTURED_PROMPT_TEMPLATE;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        renderTrainerInputGuidance(input.value);
    }

    function buildSearchProfile(input, groupContext = null) {
        const text = [
            input.ageGroupLabel,
            input.goalKey ? GOAL_LABELS[input.goalKey] : '',
            input.focusStyle,
            input.levelKey ? LEVEL_LABELS[input.levelKey] : '',
            input.notes,
            groupContext?.performanceSearchText || '',
            groupContext?.trainingSummaryText || '',
            groupContext?.competitionSummaryText || ''
        ].filter(Boolean).join(' ');

        return {
            rawText: text,
            tokens: uniq(tokenize(text)),
            ageTags: input.ageGroupLabel ? [normalizeText(input.ageGroupLabel)] : [],
            styleTags: input.focusStyle ? [normalizeText(input.focusStyle)] : [],
            goalTags: input.goalKey ? [normalizeText(input.goalKey)] : []
        };
    }

    function getStudentAgeLocal(student) {
        if (!student) {
            return null;
        }
        if (typeof window.getStudentAge === 'function') {
            return window.getStudentAge(student);
        }
        const birthYear = Number(student.birthYear);
        if (Number.isFinite(birthYear) && birthYear > 1950) {
            return new Date().getFullYear() - birthYear;
        }
        const age = Number(student.age);
        return Number.isFinite(age) ? age : null;
    }

    function parsePerformanceTimeToSeconds(timeValue) {
        const raw = String(timeValue || '').trim();
        const match = raw.match(/^(\d{1,2}):(\d{2})\.(\d{1,2})$/);
        if (!match) {
            return null;
        }
        return (Number(match[1]) * 60) + Number(match[2]) + (Number(match[3]) / 100);
    }

    function formatPerformanceTime(seconds) {
        if (!Number.isFinite(seconds) || seconds <= 0) {
            return '-';
        }
        const minutes = Math.floor(seconds / 60);
        const remainder = seconds - (minutes * 60);
        const wholeSeconds = Math.floor(remainder);
        const hundredths = Math.round((remainder - wholeSeconds) * 100);
        return `${minutes}:${String(wholeSeconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
    }

    function buildAgeGroupLabelFromAges(ages) {
        const validAges = (ages || []).filter(age => Number.isFinite(age));
        if (!validAges.length) {
            return '';
        }
        const minAge = Math.min(...validAges);
        const maxAge = Math.max(...validAges);
        if (minAge === maxAge) {
            return `${minAge} yas`;
        }
        return `${minAge}-${maxAge} yas`;
    }

    function summarizePerformanceRows(performances, typeLabel) {
        const grouped = {};
        performances.forEach(performance => {
            const style = performance.style || 'Karma';
            const distance = Number(performance.distance) || 0;
            const seconds = parsePerformanceTimeToSeconds(performance.time);
            if (!distance || !Number.isFinite(seconds)) {
                return;
            }
            const key = `${style}_${distance}`;
            if (!grouped[key] || seconds < grouped[key].bestSeconds) {
                grouped[key] = {
                    style,
                    distance,
                    bestSeconds: seconds,
                    bestTime: performance.time,
                    typeLabel
                };
            }
        });

        return Object.values(grouped)
            .sort((left, right) => left.distance - right.distance || left.bestSeconds - right.bestSeconds)
            .slice(0, 6);
    }

    function inferLevelKeyFromGroupContext(groupContext) {
        if (!groupContext) {
            return '';
        }
        const avgAge = Number(groupContext.averageAge);
        const competitionRows = groupContext.competitionRows || [];
        const trainingRows = groupContext.trainingRows || [];

        if (competitionRows.some(row => row.distance >= 100 && row.bestSeconds <= 75)) {
            return 'performance';
        }
        if (competitionRows.length >= 2 || trainingRows.length >= 4) {
            return 'advanced';
        }
        if (Number.isFinite(avgAge) && avgAge <= 9) {
            return 'beginner';
        }
        if (Number.isFinite(avgAge) && avgAge <= 11) {
            return 'intermediate';
        }
        return 'intermediate';
    }

    async function fetchPerformancesForStudents(studentIds) {
        if (!Array.isArray(studentIds) || !studentIds.length || typeof db === 'undefined') {
            return [];
        }

        const performances = [];
        for (let index = 0; index < studentIds.length; index += 10) {
            const batch = studentIds.slice(index, index + 10);
            const snapshot = await db.collection('performances').where('studentId', 'in', batch).get();
            snapshot.forEach(doc => {
                performances.push({ id: doc.id, ...doc.data() });
            });
        }

        return performances.sort((left, right) => String(right.date || right.createdAt || '').localeCompare(String(left.date || left.createdAt || '')));
    }

    async function buildGroupPerformanceContext(scheduleId) {
        const context = getTrainerContext();
        const students = (context.allStudents || []).filter(student => student.scheduleId === scheduleId);
        if (!students.length) {
            return null;
        }

        const schedule = (context.allSchedules || []).find(item => item.id === scheduleId);
        const branch = (context.allBranches || []).find(item => item.id === schedule?.branchId);
        const performances = await fetchPerformancesForStudents(students.map(student => student.id));
        const ages = students.map(student => getStudentAgeLocal(student)).filter(age => Number.isFinite(age));
        const trainingPerformances = performances.filter(item => item.type === 'training');
        const competitionPerformances = performances.filter(item => item.type === 'competition');
        const trainingRows = summarizePerformanceRows(trainingPerformances, 'Antrenman derecesi');
        const competitionRows = summarizePerformanceRows(competitionPerformances, 'Yaris derecesi');
        const averageAge = ages.length
            ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length)
            : null;
        const ageGroupLabel = buildAgeGroupLabelFromAges(ages) || (Number.isFinite(averageAge) ? getAgeBucket(averageAge) : '');
        const trainingSummaryText = trainingRows.map(row => `${row.style} ${row.distance}m antrenman ${row.bestTime}`).join(' | ');
        const competitionSummaryText = competitionRows.map(row => `${row.style} ${row.distance}m yaris ${row.bestTime}`).join(' | ');

        return {
            scheduleId,
            scheduleLabel: `${branch?.name || 'Sube'} - ${schedule?.customName || schedule?.time || 'Ders'}`,
            studentCount: students.length,
            studentNames: students.map(student => `${student.name || ''} ${student.surname || ''}`.trim()).filter(Boolean).slice(0, 8),
            ages,
            averageAge,
            ageGroupLabel,
            suggestedLevelKey: inferLevelKeyFromGroupContext({ averageAge, trainingRows, competitionRows }),
            trainingRows,
            competitionRows,
            trainingSummaryText,
            competitionSummaryText,
            performanceSearchText: [
                ageGroupLabel,
                trainingSummaryText,
                competitionSummaryText,
                schedule?.lessonType === 'private' ? 'ozel ders' : 'grup dersi'
            ].filter(Boolean).join(' ')
        };
    }

    function autoFillProfileFromGroupContext(profile, groupContext) {
        if (!groupContext) {
            return { ...profile };
        }

        const nextProfile = { ...profile };
        if (!Number.isFinite(Number(nextProfile.age)) && Number.isFinite(Number(groupContext.averageAge))) {
            nextProfile.age = Number(groupContext.averageAge);
        }
        if (!nextProfile.ageGroupLabel && groupContext.ageGroupLabel) {
            nextProfile.ageGroupLabel = groupContext.ageGroupLabel;
        }
        if (!nextProfile.levelKey && groupContext.suggestedLevelKey) {
            nextProfile.levelKey = groupContext.suggestedLevelKey;
        }
        if (!nextProfile.focusStyle && groupContext.trainingRows?.[0]?.style) {
            nextProfile.focusStyle = groupContext.trainingRows[0].style;
        }
        if (!nextProfile.notes) {
            nextProfile.notes = [
                groupContext.trainingSummaryText ? `Antrenman dereceleri: ${groupContext.trainingSummaryText}` : '',
                groupContext.competitionSummaryText ? `Yaris dereceleri: ${groupContext.competitionSummaryText}` : ''
            ].filter(Boolean).join(' | ');
        } else {
            nextProfile.notes = [
                nextProfile.notes,
                groupContext.trainingSummaryText ? `Antrenman dereceleri: ${groupContext.trainingSummaryText}` : '',
                groupContext.competitionSummaryText ? `Yaris dereceleri: ${groupContext.competitionSummaryText}` : ''
            ].filter(Boolean).join(' | ');
        }
        return nextProfile;
    }

    function buildLiveResearchUrlList(profile, groupContext) {
        const styleToken = normalizeStyleKey(profile.focusStyle || groupContext?.trainingRows?.[0]?.style || 'serbest') || 'serbest';
        const goalToken = profile.goalKey || 'genel';
        const prioritized = [
            OLYMPIC_COACH_LIVE_RESEARCH_URLS[goalToken === 'sprint' || goalToken === 'yaris' ? 3 : 0],
            OLYMPIC_COACH_LIVE_RESEARCH_URLS[1],
            OLYMPIC_COACH_LIVE_RESEARCH_URLS[styleToken === 'serbest' ? 2 : 0]
        ].filter(Boolean);

        return uniqByUrl([
            ...prioritized,
            ...OLYMPIC_COACH_LIVE_RESEARCH_URLS
        ]).slice(0, 3);
    }

    function uniqByUrl(items) {
        const seen = new Set();
        return items.filter(item => {
            if (!item?.url || seen.has(item.url)) {
                return false;
            }
            seen.add(item.url);
            return true;
        });
    }

    async function researchWorkoutKnowledgeLive(profile, groupContext) {
        const urls = buildLiveResearchUrlList(profile, groupContext);
        const snippets = [];

        for (const item of urls) {
            try {
                const remoteResult = await fetchRemoteKnowledgeText(item.url);
                const translationResult = await maybeTranslateTextToTurkish(remoteResult.text);
                const text = String(translationResult.text || '').trim().slice(0, 5000);
                if (!text) {
                    continue;
                }
                snippets.push({
                    label: item.label,
                    url: item.url,
                    text,
                    sets: parseWorkoutSetsFromKnowledgeText(text)
                });
            } catch (error) {
                snippets.push({
                    label: item.label,
                    url: item.url,
                    text: '',
                    error: error.message || 'Kaynak okunamadi',
                    sets: []
                });
            }
        }

        return {
            snippets,
            sourceCount: snippets.filter(item => item.text).length
        };
    }

    function parseWorkoutSetsFromKnowledgeText(text) {
        const sets = [];
        const sourceText = String(text || '');
        const regex = /(\d{1,2})\s*[x×]\s*(\d{2,4})\s*(?:m\b)?(?:\s*(serbest|sirtustu|sirt|kurbaga|kelebek|karma))?/gi;
        let match;

        while ((match = regex.exec(sourceText)) !== null && sets.length < 8) {
            const repeat = Math.max(1, Number(match[1]) || 1);
            const distance = Math.max(25, Number(match[2]) || 50);
            const nearbyText = sourceText.slice(match.index, match.index + 140);
            const restMatch = nearbyText.match(/(\d{1,3})\s*(?:sn|saniye|sec|dinlen)/i);
            const style = parseStyleFromWorkoutText(match[3] || '') || 'Karma';
            sets.push(createRepeatedSet(
                repeat,
                distance,
                style,
                restMatch ? Number(restMatch[1]) : 20,
                'Kanit havuzu / canli arastirma'
            ));
        }

        return sets;
    }

    function augmentBlocksWithKnowledge(blocks, knowledgeSets) {
        if (!Array.isArray(blocks) || !knowledgeSets.length) {
            return blocks;
        }

        const mainBlock = blocks.find(block => block.title === 'Ana set');
        if (!mainBlock) {
            return blocks;
        }

        const curatedSets = knowledgeSets
            .filter(set => Number(set.distance) >= 25 && Number(set.repeat) >= 1)
            .slice(0, 3);

        if (!curatedSets.length) {
            return blocks;
        }

        mainBlock.sets = [
            ...curatedSets,
            ...mainBlock.sets.slice(0, Math.max(1, mainBlock.sets.length - 1))
        ];
        mainBlock.focus = 'Olimpiyat seviyesi kanit havuzu ve guncel arastirma ile desteklenen ana yuklenme.';
        return blocks;
    }

    function estimateSetSwimSeconds(distance, levelKey) {
        const pacePer100 = {
            beginner: 125,
            intermediate: 108,
            advanced: 95,
            performance: 82
        }[levelKey] || 108;
        return Math.max(20, Math.round((Number(distance) / 100) * pacePer100));
    }

    function applySessionTimeline(blocks, profile) {
        const sessionDuration = Number(profile.sessionDuration) || 60;
        let usedMinutes = 0;

        blocks.forEach(block => {
            let blockSwimSeconds = 0;
            let blockRestSeconds = 0;

            block.sets.forEach(set => {
                const repeat = Math.max(1, Number(set.repeat) || 1);
                const swimSeconds = estimateSetSwimSeconds(set.distance, profile.levelKey) * repeat;
                const restSeconds = Math.max(0, Number(set.restSeconds) || 15) * Math.max(0, repeat - 1);
                set.estimatedSwimSeconds = swimSeconds;
                set.estimatedRestSeconds = restSeconds;
                set.estimatedTotalSeconds = swimSeconds + restSeconds;
                set.estimatedMinutes = Math.max(1, Math.ceil(set.estimatedTotalSeconds / 60));
                blockSwimSeconds += swimSeconds;
                blockRestSeconds += restSeconds;
            });

            block.estimatedSwimMinutes = Math.max(1, Math.ceil(blockSwimSeconds / 60));
            block.estimatedRestMinutes = Math.max(0, Math.ceil(blockRestSeconds / 60));
            block.estimatedMinutes = Math.max(1, block.estimatedSwimMinutes + block.estimatedRestMinutes);
            block.startMinute = usedMinutes;
            block.endMinute = usedMinutes + block.estimatedMinutes;
            usedMinutes = block.endMinute;
        });

        const scaleFactor = usedMinutes > sessionDuration + 8
            ? (sessionDuration / usedMinutes)
            : 1;

        if (scaleFactor < 1) {
            blocks.forEach(block => {
                block.estimatedMinutes = Math.max(1, Math.round(block.estimatedMinutes * scaleFactor));
                block.sets.forEach(set => {
                    set.estimatedMinutes = Math.max(1, Math.round((set.estimatedMinutes || 1) * scaleFactor));
                });
            });
            usedMinutes = blocks.reduce((sum, block) => sum + Number(block.estimatedMinutes || 0), 0);
        }

        return {
            plannedMinutes: usedMinutes,
            targetMinutes: sessionDuration,
            fitsSession: usedMinutes <= sessionDuration + 5
        };
    }

    function rebuildExercisesFromBlocks(blocks) {
        const exercises = [];
        blocks.forEach(block => {
            block.sets.forEach(set => {
                const repeatCount = Math.max(1, Number(set.repeat) || 1);
                for (let index = 0; index < repeatCount; index += 1) {
                    exercises.push({
                        distance: Number(set.distance) || 50,
                        style: set.style || 'Karma',
                        restSeconds: Number(set.restSeconds) || 15,
                        estimatedMinutes: set.estimatedMinutes || 1,
                        focus: block.title,
                        note: set.note || block.focus
                    });
                }
            });
        });
        return exercises;
    }

    function buildOlympicCoachingNotes(profile, groupContext, research, timeline) {
        return [
            'Olimpiyat seviyesi yuzme koçu modu: kanit havuzu + canli arastirma + grup performans verisi birlestirildi.',
            groupContext
                ? `Secilen grup: ${groupContext.scheduleLabel} | ${groupContext.studentCount} sporcu | ${groupContext.ageGroupLabel || 'yas grubu belirleniyor'}`
                : 'Grup secilmedi: genel plan uretildi.',
            groupContext?.trainingRows?.length
                ? `Antrenman derecesi ozeti: ${groupContext.trainingRows.map(row => `${row.style} ${row.distance}m ${row.bestTime}`).join(', ')}`
                : '',
            groupContext?.competitionRows?.length
                ? `Yaris derecesi ozeti: ${groupContext.competitionRows.map(row => `${row.style} ${row.distance}m ${row.bestTime}`).join(', ')}`
                : '',
            research?.sourceCount
                ? `Canli arastirma: ${research.sourceCount} kaynak tarandi, bulgular ana sete yansitildi.`
                : 'Canli arastirma: kaynaklar sinirli; mevcut bilgi bankasi agirlikli kullanildi.',
            timeline
                ? `Sure plani: ${timeline.plannedMinutes} dk / hedef ${timeline.targetMinutes} dk`
                : '',
            profile.notes ? `Ek not: ${profile.notes}` : ''
        ].filter(Boolean);
    }

    async function ensureOlympicCoachFeedsSeeded() {
        if (typeof db === 'undefined') {
            return { seeded: 0 };
        }

        let seeded = 0;
        for (const feed of OLYMPIC_COACH_SEED_FEEDS) {
            const feedId = buildMonitoredFeedId(normalizeUrl(feed.url));
            const docRef = db.collection(AI_FEEDS_COLLECTION).doc(feedId);
            const existingDoc = await docRef.get();
            if (existingDoc.exists) {
                continue;
            }

            await docRef.set({
                feedId,
                scopeType: GLOBAL_SCOPE,
                url: normalizeUrl(feed.url),
                label: feed.label,
                notes: 'Olimpiyat seviyesi AI koç havuzu',
                intervalHours: feed.intervalHours || 24,
                enabled: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                nextSyncAt: new Date().toISOString(),
                lastSyncStatus: 'pending',
                ownerRole: 'system',
                ownerId: 'olympic-coach-seed',
                uploadedByName: 'AI Olympic Coach'
            }, { merge: true });
            seeded += 1;
        }

        invalidateFeedCache();
        return { seeded };
    }

    function scoreChunkAgainstProfile(chunk, profile) {
        let score = 0;
        const chunkTokenSet = new Set(chunk.tokens || []);
        (profile.tokens || []).forEach(token => {
            if (chunkTokenSet.has(token)) {
                score += 5;
            }
            if ((chunk.normalizedText || '').includes(token)) {
                score += 2;
            }
        });

        (profile.ageTags || []).forEach(tag => {
            if ((chunk.ageTags || []).map(normalizeText).includes(tag)) {
                score += 12;
            }
        });
        (profile.styleTags || []).forEach(tag => {
            if ((chunk.styleTags || []).map(normalizeText).includes(tag)) {
                score += 12;
            }
        });
        (profile.goalTags || []).forEach(tag => {
            if ((chunk.goalTags || []).map(normalizeText).includes(tag)) {
                score += 12;
            }
        });

        if (chunk.sourceType === 'workout-sale-example') {
            score += 6;
        }
        if (chunk.sourceType === 'trainer-workout-example' || chunk.sourceType === 'ai-generated-workout-example') {
            score += 5;
        }
        if (chunk.sourceType === 'superadmin-upload') {
            score += 4;
        }

        return score;
    }

    async function getRankedKnowledgeMatches(profileInput, limit = MAX_SEARCH_RESULTS) {
        const chunks = await fetchKnowledgeChunks();
        if (!chunks.length) {
            return [];
        }

        const profile = profileInput?.tokens
            ? profileInput
            : buildSearchProfile(profileInput, trainerUiState.groupContext);
        return chunks
            .map(chunk => ({
                ...chunk,
                score: scoreChunkAgainstProfile(chunk, profile)
            }))
            .filter(chunk => chunk.score > 0)
            .sort((left, right) => right.score - left.score)
            .slice(0, limit);
    }

    function buildFrequencyMap(values) {
        return (values || []).reduce((accumulator, value) => {
            const key = String(value || '').trim();
            if (!key) {
                return accumulator;
            }
            accumulator[key] = (accumulator[key] || 0) + 1;
            return accumulator;
        }, {});
    }

    function getTopFrequencyValue(values) {
        const frequencyMap = buildFrequencyMap(values);
        return Object.entries(frequencyMap)
            .sort((left, right) => right[1] - left[1])[0] || ['', 0];
    }

    function parseGoalFromWorkoutText(value) {
        return normalizeGoalKey(value) || 'genel';
    }

    function parseStyleFromWorkoutText(value) {
        return normalizeStyleKey(value) || 'Karma';
    }

    function describeExercise(exercise, index) {
        const distance = Number(exercise?.distance) || 0;
        const style = exercise?.style || 'Karma';
        const restSeconds = Number(exercise?.restSeconds) || 15;
        const note = exercise?.note || exercise?.focus || '';
        return `${index + 1}. ${distance}m ${style} | ${restSeconds}sn dinlenme${note ? ` | ${note}` : ''}`;
    }

    function buildWorkoutKnowledgeText(workout, actorMeta) {
        const exerciseLines = Array.isArray(workout?.exercises)
            ? workout.exercises.map((exercise, index) => describeExercise(exercise, index)).join('\n')
            : '';
        const blockLines = Array.isArray(workout?.workoutBlocks)
            ? workout.workoutBlocks.map(block => {
                const setSummary = Array.isArray(block?.sets)
                    ? block.sets.map(set => `${set.repeat || 1} x ${set.distance || 0}m ${set.style || ''} (${set.restSeconds || 0}sn)`).join(', ')
                    : '';
                return `${block.title || 'Bolum'}: ${setSummary}`;
            }).join('\n')
            : '';
        return [
            `Antrenor: ${actorMeta.trainerName || ''}`,
            `Workout: ${workout?.name || ''}`,
            `Yayinlandi: ${workout?.published ? 'evet' : 'hayir'}`,
            `AI etiketleri: ${workout?.aiAgeGroup || ''} | ${workout?.aiGoalKey || ''} | ${workout?.aiFocusStyle || ''}`,
            blockLines,
            exerciseLines
        ].filter(Boolean).join('\n');
    }

    function buildWorkoutSaleKnowledgeText(sale, actorMeta) {
        const exerciseLines = Array.isArray(sale?.exercises)
            ? sale.exercises.map((exercise, index) => describeExercise(exercise, index)).join('\n')
            : '';
        return [
            `Satisa cikmis workout`,
            `Satici: ${actorMeta.trainerName || sale?.sellerName || ''}`,
            `Baslik: ${sale?.name || ''}`,
            `Yas grubu: ${sale?.ageGroup || ''}`,
            `Hedef: ${sale?.target || ''}`,
            `Stil: ${sale?.style || ''}`,
            `Mesafe: ${sale?.distance || ''}`,
            `Aciklama: ${sale?.description || ''}`,
            exerciseLines
        ].filter(Boolean).join('\n');
    }

    async function syncWorkoutKnowledge(workout, actorMeta = {}) {
        if (!workout?.id || !Array.isArray(workout.exercises) || !workout.exercises.length) {
            return;
        }

        const sourceId = `workout_${workout.id}`;
        await ingestTextAsKnowledge({
            sourceId,
            sourceName: workout.name || `Workout ${workout.id}`,
            sourceType: workout.aiGenerated ? 'ai-generated-workout-example' : 'trainer-workout-example',
            fileName: `${sanitizeForPath(workout.name || sourceId)}.txt`,
            text: buildWorkoutKnowledgeText(workout, actorMeta),
            ageTags: workout.aiAgeGroup ? [workout.aiAgeGroup] : [],
            styleTags: workout.aiFocusStyle ? [workout.aiFocusStyle] : [parseStyleFromWorkoutText(workout.name)],
            goalTags: workout.aiGoalKey ? [workout.aiGoalKey] : [parseGoalFromWorkoutText(workout.name)],
            sourceLabel: workout.aiGenerated ? 'AI uretimi antrenman ornegi' : 'Antrenor antrenman ornegi',
            ownerRole: 'trainer',
            ownerId: actorMeta.trainerId || workout.trainerId || '',
            uploadedByName: actorMeta.trainerName || '',
            uploadedByEmail: actorMeta.trainerEmail || '',
            metadata: {
                workoutId: workout.id,
                trainerId: workout.trainerId || actorMeta.trainerId || '',
                adminId: workout.adminId || actorMeta.adminId || '',
                published: !!workout.published,
                aiGenerated: !!workout.aiGenerated
            }
        });
    }

    async function syncWorkoutSaleKnowledge(sale, actorMeta = {}) {
        if (!sale?.id) {
            return;
        }

        const sourceId = `sale_${sale.id}`;
        await ingestTextAsKnowledge({
            sourceId,
            sourceName: sale.name || `Workout sale ${sale.id}`,
            sourceType: 'workout-sale-example',
            fileName: `${sanitizeForPath(sale.name || sourceId)}.txt`,
            text: buildWorkoutSaleKnowledgeText(sale, actorMeta),
            ageTags: sale.ageGroup ? [sale.ageGroup] : [],
            styleTags: sale.style ? [sale.style] : [],
            goalTags: sale.target ? [sale.target] : [],
            sourceLabel: 'Satisa cikarilan workout ornegi',
            ownerRole: 'trainer',
            ownerId: actorMeta.trainerId || sale.sellerId || '',
            uploadedByName: actorMeta.trainerName || sale.sellerName || '',
            uploadedByEmail: actorMeta.trainerEmail || sale.sellerEmail || '',
            metadata: {
                saleId: sale.id,
                sellerId: sale.sellerId || actorMeta.trainerId || '',
                adminId: sale.adminId || actorMeta.adminId || '',
                credit: sale.credit || 0
            }
        });
    }

    async function buildGlobalLearningInsights(forceRefresh = false) {
        if (!forceRefresh && cacheState.insights) {
            return cacheState.insights;
        }

        const [sources, workoutSales, workouts, feeds] = await Promise.all([
            fetchKnowledgeSources(forceRefresh),
            fetchGlobalWorkoutSales(forceRefresh),
            fetchGlobalWorkouts(forceRefresh),
            fetchMonitoredFeeds(forceRefresh)
        ]);

        const [topAge, topAgeCount] = getTopFrequencyValue(workoutSales.map(sale => sale.ageGroup));
        const [topGoal, topGoalCount] = getTopFrequencyValue(workoutSales.map(sale => sale.target || sale.goal));
        const [topStyle, topStyleCount] = getTopFrequencyValue(workoutSales.map(sale => sale.style));
        const manualSourceCount = sources.filter(source => source.sourceType === 'superadmin-upload').length;
        const manualTextCount = sources.filter(source => source.sourceType === 'manual-text-import').length;
        const workoutExampleCount = sources.filter(source => source.sourceType === 'trainer-workout-example').length;
        const saleExampleCount = sources.filter(source => source.sourceType === 'workout-sale-example').length;
        const aiExampleCount = sources.filter(source => source.sourceType === 'ai-generated-workout-example').length;
        const monitoredSourceCount = sources.filter(source => source.sourceType === 'monitored-link').length;
        const seededSourceCount = sources.filter(source => source.sourceType === 'seeded-workout-library').length;
        const enabledFeedCount = feeds.filter(feed => feed.enabled).length;
        const dueFeedCount = feeds.filter(feed => isFeedDue(feed)).length;

        cacheState.insights = {
            totalSources: sources.length,
            totalChunks: sources.reduce((sum, source) => sum + Number(source.chunkCount || 0), 0),
            totalWorkoutSales: workoutSales.length,
            totalWorkouts: workouts.length,
            manualSourceCount,
            manualTextCount,
            workoutExampleCount,
            saleExampleCount,
            aiExampleCount,
            monitoredSourceCount,
            seededSourceCount,
            totalFeeds: feeds.length,
            enabledFeedCount,
            dueFeedCount,
            topAge,
            topAgeCount,
            topGoal,
            topGoalCount,
            topStyle,
            topStyleCount
        };
        return cacheState.insights;
    }

    async function ensureLearningExamplesBackfilled() {
        if (cacheState.backfillDone) {
            return 0;
        }
        if (cacheState.backfillPromise) {
            return cacheState.backfillPromise;
        }

        cacheState.backfillPromise = (async () => {
            let importedCount = 0;
            const sources = await fetchKnowledgeSources();
            const knownSourceIds = new Set(sources.map(source => source.sourceId || source.id));
            const [workoutSales, workouts] = await Promise.all([
                fetchGlobalWorkoutSales(),
                fetchGlobalWorkouts()
            ]);

            for (const sale of workoutSales) {
                const sourceId = `sale_${sale.id}`;
                if (knownSourceIds.has(sourceId)) {
                    continue;
                }
                await syncWorkoutSaleKnowledge(sale, {
                    trainerId: sale.sellerId || '',
                    trainerName: sale.sellerName || '',
                    trainerEmail: sale.sellerEmail || '',
                    adminId: sale.adminId || ''
                });
                knownSourceIds.add(sourceId);
                importedCount += 1;
            }

            for (const workout of workouts) {
                const sourceId = `workout_${workout.id}`;
                if (knownSourceIds.has(sourceId) || !Array.isArray(workout.exercises) || !workout.exercises.length) {
                    continue;
                }
                await syncWorkoutKnowledge(workout, {
                    trainerId: workout.trainerId || '',
                    trainerName: workout.trainerName || '',
                    trainerEmail: workout.trainerEmail || '',
                    adminId: workout.adminId || ''
                });
                knownSourceIds.add(sourceId);
                importedCount += 1;
            }

            cacheState.backfillDone = true;
            cacheState.backfillPromise = null;
            return importedCount;
        })().catch(error => {
            cacheState.backfillPromise = null;
            throw error;
        });

        return cacheState.backfillPromise;
    }

    async function ensureCuratedWorkoutLibrarySeeded(forceRefresh = false) {
        const sources = await fetchKnowledgeSources(forceRefresh);
        const sourceExists = sources.some(source => (source.sourceId || source.id) === CURATED_WORKOUT_LIBRARY_SOURCE_ID);
        if (sourceExists && !forceRefresh) {
            return false;
        }

        await ingestTextAsKnowledge({
            sourceId: CURATED_WORKOUT_LIBRARY_SOURCE_ID,
            sourceName: 'Sistem baslangic workout kutuphanesi',
            sourceType: 'seeded-workout-library',
            fileName: 'system-swim-library.txt',
            fileUrl: '',
            text: CURATED_WORKOUT_LIBRARY_TEXT,
            ageTags: ['6-8', '8-10', '10-12', '12-14', 'performans'],
            styleTags: ['Serbest', 'Sirtustu', 'Kurbagalama', 'Kelebekce', 'Karma'],
            goalTags: ['teknik', 'sprint', 'dayaniklilik', 'yaris'],
            referenceLinks: [],
            sourceLabel: 'Sistem seed kutuphanesi',
            ownerRole: 'system',
            ownerId: 'global-ai',
            uploadedByName: 'Global AI',
            uploadedByEmail: '',
            metadata: {
                importedFrom: 'system-seed',
                version: '2026.04'
            }
        });

        return true;
    }

    function buildKnowledgeBadgeText(insights) {
        if (!insights || !insights.totalSources) {
            return 'Bilgi bankasi hazirlaniyor';
        }
        return `${insights.totalSources} kaynak, ${insights.totalChunks} parcali veri`; 
    }

    function renderKnowledgeSummaryCards(insights) {
        const cards = [
            { label: 'Manuel belge', value: insights.manualSourceCount },
            { label: 'Toplu metin', value: insights.manualTextCount },
            { label: 'Izlenen link', value: insights.monitoredSourceCount },
            { label: 'Seed kutuphane', value: insights.seededSourceCount },
            { label: 'Workout ornegi', value: insights.workoutExampleCount },
            { label: 'Satis ornegi', value: insights.saleExampleCount },
            { label: 'AI geri besleme', value: insights.aiExampleCount }
        ];

        return `
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-top:14px;">
                ${cards.map(card => `
                    <div style="padding:16px; border-radius:12px; border:1px solid #dbe7f3; background:#fff;">
                        <div style="font-size:0.9em; color:#6f8091; margin-bottom:6px;">${escapeHtml(card.label)}</div>
                        <div style="font-size:1.4em; font-weight:700; color:#2c3e50;">${escapeHtml(card.value)}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function summarizeEvidence(matches) {
        if (!matches.length) {
            return 'Bilgi bankasinda birebir eslesen belge az oldugu icin genel yuzme prensipleri ve platformdaki workout ornekleriyle plan olusturuldu.';
        }

        return matches
            .slice(0, 3)
            .map(match => `${match.sourceName || 'Kaynak'} (${match.sourceType || 'bilgi'}, skor ${match.score})`)
            .join(' | ');
    }

    function estimateTargetDistance(profile) {
        if (Number.isFinite(Number(profile.targetDistance)) && Number(profile.targetDistance) >= 200) {
            return roundToNearest50(profile.targetDistance);
        }

        const age = Number(profile.age) || 12;
        const duration = Number(profile.sessionDuration) || 60;
        const levelKey = profile.levelKey || 'intermediate';
        const goalKey = profile.goalKey || 'genel';

        let baseDistance;
        if (age <= 8) {
            baseDistance = 850;
        } else if (age <= 10) {
            baseDistance = 1150;
        } else if (age <= 12) {
            baseDistance = 1500;
        } else if (age <= 14) {
            baseDistance = 2000;
        } else if (age <= 16) {
            baseDistance = 2400;
        } else {
            baseDistance = 2800;
        }

        const levelMultiplier = {
            beginner: 0.8,
            intermediate: 1,
            advanced: 1.12,
            performance: 1.25
        }[levelKey] || 1;

        const goalMultiplier = {
            teknik: 0.88,
            sprint: 0.94,
            dayaniklilik: 1.15,
            yaris: 1.08,
            ayak: 0.84,
            genel: 1
        }[goalKey] || 1;

        return roundToNearest50(baseDistance * (duration / 60) * levelMultiplier * goalMultiplier);
    }

    function createRepeatedSet(repeat, distance, style, restSeconds, note) {
        return {
            repeat,
            distance,
            style,
            restSeconds,
            note
        };
    }

    function chooseSupportStyle(focusStyle) {
        if (!focusStyle || focusStyle === 'Karma') {
            return 'Karma';
        }
        if (focusStyle === 'Serbest') {
            return 'Sirtustu';
        }
        if (focusStyle === 'Sirtustu') {
            return 'Serbest';
        }
        return 'Serbest';
    }

    function buildWorkoutBlocks(profile, insights, options = {}) {
        const focusStyle = profile.focusStyle || (insights.topStyle ? parseStyleFromWorkoutText(insights.topStyle) : 'Karma') || 'Karma';
        const supportStyle = chooseSupportStyle(focusStyle);
        const goalKey = profile.goalKey || 'genel';
        const totalDistance = estimateTargetDistance(profile);
        const warmupDistance = roundBlockDistance(totalDistance * 0.18, 100);
        const techniqueDistance = roundBlockDistance(totalDistance * (goalKey === 'teknik' ? 0.28 : 0.18), 100);
        const mainDistance = roundBlockDistance(totalDistance * (goalKey === 'sprint' ? 0.38 : goalKey === 'dayaniklilik' ? 0.44 : 0.4), 150);
        const supportDistance = roundBlockDistance(totalDistance * 0.14, 100);
        const cooldownDistance = Math.max(150, totalDistance - warmupDistance - techniqueDistance - mainDistance - supportDistance);
        const levelKey = profile.levelKey || 'intermediate';
        const fastRest = levelKey === 'performance' ? 20 : 25;
        const aerobicRest = levelKey === 'beginner' ? 25 : 20;
        const kickRest = levelKey === 'beginner' ? 20 : 15;

        let mainSets;
        if (goalKey === 'sprint') {
            mainSets = [
                createRepeatedSet(Math.max(4, Math.round(mainDistance / 100)), 50, focusStyle, fastRest + 5, '1 kolay / 1 hizli ritim'),
                createRepeatedSet(4, 25, focusStyle, 30, 'Maksimum hiz, cikis ve su alti disiplini')
            ];
        } else if (goalKey === 'dayaniklilik') {
            mainSets = [
                createRepeatedSet(Math.max(4, Math.round(mainDistance / 200)), 100, focusStyle, aerobicRest, 'Sabit tempo, negatif split bitir'),
                createRepeatedSet(4, 50, supportStyle, 20, 'Teknigi dagitmadan toparla')
            ];
        } else if (goalKey === 'yaris') {
            mainSets = [
                createRepeatedSet(4, 50, focusStyle, 35, 'Yaris temposu + ilk 15m sert cikis'),
                createRepeatedSet(Math.max(4, Math.round(mainDistance / 100)), 75, focusStyle, 25, 'Pace koru, son 25m ivmelen')
            ];
        } else if (goalKey === 'ayak') {
            mainSets = [
                createRepeatedSet(Math.max(6, Math.round(mainDistance / 50)), 50, focusStyle, kickRest, 'Board ile ayak ritmi ve su ustu denge'),
                createRepeatedSet(4, 25, supportStyle, 20, 'Ayak bitisinde hizli toparlama')
            ];
        } else if (goalKey === 'teknik') {
            mainSets = [
                createRepeatedSet(6, 50, focusStyle, 20, 'Drill + yuzus kombinasyonu'),
                createRepeatedSet(Math.max(4, Math.round(mainDistance / 100)), 75, focusStyle, 25, 'Uzun kulac, ritim ve nefes zamani')
            ];
        } else {
            mainSets = [
                createRepeatedSet(Math.max(4, Math.round(mainDistance / 100)), 100, focusStyle, aerobicRest, 'Kontrollu tempo ve duzenli cikis'),
                createRepeatedSet(4, 50, supportStyle, 20, 'Ritim bozmadan teknik odak')
            ];
        }

        let blocks = [
            {
                title: 'Isinma',
                focus: 'Nabzi ac, eklemleri hazirla ve ilk teknik temaslari oturt.',
                sets: [
                    createRepeatedSet(Math.max(2, Math.round(warmupDistance / 200)), 100, focusStyle === 'Karma' ? 'Serbest' : focusStyle, 15, 'Rahat tempo, uzun kulac'),
                    createRepeatedSet(2, 50, supportStyle, 15, 'Sirt pozisyonu ve omuz acisi')
                ]
            },
            {
                title: 'Teknik blok',
                focus: goalKey === 'sprint' ? 'Teknigi hiz bozulmadan tut.' : 'Temel teknik dokunuşlari duzelt ve verimliligi artir.',
                sets: [
                    createRepeatedSet(Math.max(4, Math.round(techniqueDistance / 100)), 50, focusStyle, 20, 'Drill ve farkindalik odagi'),
                    createRepeatedSet(4, 25, focusStyle, 20, 'Kayis ve su tutusu')
                ]
            },
            {
                title: 'Ana set',
                focus: goalKey === 'dayaniklilik' ? 'Uzayan setlerde tempo kaybetme.' : goalKey === 'sprint' ? 'Kisa mesafede kalite ve cikis gucu.' : 'Ana hedefe gore yuklenme.',
                sets: mainSets
            },
            {
                title: 'Destek seti',
                focus: goalKey === 'ayak' ? 'Ayak vurusu ve core dengeyi bir arada tut.' : 'Yorgunluk altinda teknigi koru.',
                sets: [
                    createRepeatedSet(Math.max(4, Math.round(supportDistance / 100)), 50, supportStyle, kickRest, goalKey === 'ayak' ? 'Kick baskin' : 'Teknik dengeleme'),
                    createRepeatedSet(2, 50, 'Karma', 20, 'Kontrollu gecis')
                ]
            },
            {
                title: 'Soguma',
                focus: 'Nabzi indir, hareket araligini koru ve seansi toparla.',
                sets: [
                    createRepeatedSet(Math.max(2, Math.round(cooldownDistance / 100)), 50, supportStyle, 15, 'Rahat tempo'),
                    createRepeatedSet(2, 25, 'Serbest', 15, 'Uzun nefes ve gevseme')
                ]
            }
        ];

        blocks = augmentBlocksWithKnowledge(blocks, options.knowledgeSets || []);
        const timeline = applySessionTimeline(blocks, profile);
        const exercises = rebuildExercisesFromBlocks(blocks);

        return {
            blocks,
            exercises,
            totalDistance: exercises.reduce((sum, exercise) => sum + Number(exercise.distance || 0), 0),
            focusStyle,
            timeline
        };
    }

    function buildWorkoutName(profile, focusStyle) {
        const ageLabel = profile.ageGroupLabel || getAgeBucket(profile.age) || 'karma';
        const goalLabel = GOAL_LABELS[profile.goalKey] || 'Genel';
        return `${ageLabel} ${focusStyle || 'Karma'} ${goalLabel} antrenmani`;
    }

    async function generateWorkoutPlan(profile, options = {}) {
        const scheduleId = options.scheduleId || trainerUiState.selectedScheduleId || '';
        let groupContext = options.groupContext || trainerUiState.groupContext || null;
        if (scheduleId && !groupContext) {
            groupContext = await buildGroupPerformanceContext(scheduleId);
            trainerUiState.groupContext = groupContext;
        }

        const enrichedProfile = autoFillProfileFromGroupContext({ ...profile }, groupContext);

        const [matches, insights, research] = await Promise.all([
            getRankedKnowledgeMatches(enrichedProfile, MAX_SEARCH_RESULTS),
            buildGlobalLearningInsights(),
            researchWorkoutKnowledgeLive(enrichedProfile, groupContext).catch(() => ({ snippets: [], sourceCount: 0 }))
        ]);

        const knowledgeSets = [
            ...matches.flatMap(match => parseWorkoutSetsFromKnowledgeText(match.text || '')),
            ...(research.snippets || []).flatMap(item => item.sets || [])
        ].slice(0, 8);

        const { blocks, exercises, totalDistance, focusStyle, timeline } = buildWorkoutBlocks(enrichedProfile, insights, { knowledgeSets });
        const researchMatches = (research.snippets || [])
            .filter(item => item.text)
            .map(item => ({
                sourceName: item.label,
                text: item.text,
                sourceId: item.url,
                sourceType: 'live-research'
            }));

        return {
            name: buildWorkoutName(enrichedProfile, focusStyle),
            createdAt: new Date().toISOString(),
            profile: {
                ...enrichedProfile,
                focusStyle
            },
            groupContext,
            totalDistance,
            exercises,
            workoutBlocks: blocks,
            sessionTimeline: timeline,
            evidenceMatches: [...matches, ...researchMatches].slice(0, MAX_SEARCH_RESULTS),
            evidenceSummary: summarizeEvidence([...matches, ...researchMatches]),
            researchSummary: research,
            insights,
            coachingNotes: buildOlympicCoachingNotes(enrichedProfile, groupContext, research, timeline)
        };
    }

    function renderPlanCard(plan) {
        if (!plan) {
            return '<div class="trainer-ai-empty-result">Chatten gerekli bilgileri tamamladiginda detayli workout burada olusacak.</div>';
        }

        const blocksHtml = plan.workoutBlocks.map(block => {
            const setsHtml = block.sets.map(set => `
                <li style="margin-bottom:8px; color:#445566; line-height:1.55;">
                    <strong>${set.repeat} x ${set.distance}m ${escapeHtml(set.style)}</strong>
                    <span style="color:#6f8091;"> | ${set.restSeconds}sn dinlenme</span>
                    <span style="color:#1b7f5c; font-weight:600;"> | ~${set.estimatedMinutes || 1} dk</span>
                    <div style="font-size:0.92em; color:#607080; margin-top:4px;">${escapeHtml(set.note || '')}</div>
                </li>
            `).join('');

            return `
                <div style="padding:16px; border:1px solid #dbe7f3; border-radius:12px; background:#fff; margin-bottom:14px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:10px;">
                        <div>
                            <div style="font-weight:700; color:#2c3e50;">${escapeHtml(block.title)}</div>
                            <div style="font-size:0.92em; color:#6f8091; margin-top:4px;">${escapeHtml(block.focus)}</div>
                            <div style="font-size:0.88em; color:#1b7f5c; margin-top:4px;">Blok suresi: ~${block.estimatedMinutes || 1} dk${Number.isFinite(block.startMinute) ? ` | ${block.startMinute}-${block.endMinute}. dk` : ''}</div>
                        </div>
                    </div>
                    <ul style="margin:0; padding-left:18px;">${setsHtml}</ul>
                </div>
            `;
        }).join('');

        const evidenceHtml = (plan.evidenceMatches || []).length
            ? `
                <div style="padding:14px; border-radius:12px; background:#f8fbff; border:1px solid #dbe7f3; margin-top:16px;">
                    <div style="font-weight:700; color:#2c3e50; margin-bottom:8px;">Plani destekleyen kaynaklar</div>
                    ${(plan.evidenceMatches || []).slice(0, 3).map(match => `
                        <div style="padding:10px 0; border-top:1px solid #e6edf5;">
                            <div style="font-weight:600; color:#35516e;">${escapeHtml(match.sourceName || 'Kaynak')}</div>
                            <div style="font-size:0.92em; color:#6f8091; margin-top:4px;">${escapeHtml(String(match.text || '').slice(0, 190))}...</div>
                        </div>
                    `).join('')}
                </div>
            `
            : '';

        return `
            <div class="trainer-ai-plan-shell" style="padding:22px; border-radius:16px; background:#f8fbff; border:1px solid #dbe7f3;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; margin-bottom:16px;">
                    <div>
                        <h3 style="margin:0 0 8px; color:#2c3e50;">${escapeHtml(plan.name)}</h3>
                        <div style="display:flex; gap:10px; flex-wrap:wrap; color:#5f6c7b; font-size:0.95em;">
                            <span>${escapeHtml(plan.profile.ageGroupLabel || getAgeBucket(plan.profile.age))}</span>
                            <span>${escapeHtml(LEVEL_LABELS[plan.profile.levelKey] || plan.profile.levelKey)}</span>
                            <span>${escapeHtml(GOAL_LABELS[plan.profile.goalKey] || plan.profile.goalKey)}</span>
                            <span>${escapeHtml(plan.profile.focusStyle || 'Karma')}</span>
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <div style="padding:10px 14px; border-radius:999px; background:#fff; border:1px solid #dbe7f3; color:#2c3e50; font-weight:700;">${plan.totalDistance}m toplam</div>
                        ${plan.sessionTimeline ? `<div style="padding:10px 14px; border-radius:999px; background:#eaf7ef; border:1px solid #b8edd8; color:#14543f; font-weight:700;">~${plan.sessionTimeline.plannedMinutes} dk</div>` : ''}
                    </div>
                </div>
                ${blocksHtml}
                <div style="padding:14px; border-radius:12px; background:#fff; border:1px solid #dbe7f3;">
                    <div style="font-weight:700; color:#2c3e50; margin-bottom:8px;">Koç notlari</div>
                    <ul style="margin:0; padding-left:18px; color:#5f6c7b; line-height:1.6;">
                        ${plan.coachingNotes.map(note => `<li style="margin-bottom:6px;">${escapeHtml(note)}</li>`).join('')}
                    </ul>
                </div>
                ${evidenceHtml}
            </div>
        `;
    }

    function appendTrainerMessage(role, content, isHtml) {
        trainerUiState.messages.push({ role, content, isHtml: !!isHtml });
        renderTrainerChatMessages();
    }

    function renderTrainerChatMessages() {
        const container = q('trainerAiChatMessages');
        if (!container) {
            return;
        }

        container.innerHTML = trainerUiState.messages.map(message => {
            const isUser = message.role === 'user';
            const contentHtml = message.isHtml
                ? message.content
                : escapeHtml(message.content).replace(/\n/g, '<br>');

            return `
                <div class="trainer-ai-message-row ${isUser ? 'is-user' : 'is-assistant'}">
                    <div class="trainer-ai-message-bubble ${isUser ? 'is-user' : 'is-assistant'}">
                        ${contentHtml}
                    </div>
                </div>
            `;
        }).join('');

        container.scrollTop = container.scrollHeight;
    }

    function renderTrainerQuickPrompts() {
        const container = q('trainerAiQuickPrompts');
        if (!container) {
            return;
        }

        container.innerHTML = QUICK_CHAT_PROMPTS.map(prompt => `
            <button type="button" class="btn btn-secondary btn-sm" data-ai-prompt="${escapeHtml(prompt)}" style="white-space:nowrap;">${escapeHtml(prompt)}</button>
        `).join('');

        container.querySelectorAll('[data-ai-prompt]').forEach(button => {
            button.addEventListener('click', () => {
                const input = q('trainerAiChatInput');
                if (!input) {
                    return;
                }
                input.value = button.dataset.aiPrompt || '';
                input.focus();
                renderTrainerInputGuidance(input.value);
            });
        });
    }

    function resetTrainerConversation() {
        trainerUiState.messages = [];
        trainerUiState.profile = {};
        trainerUiState.lastPlan = null;
        appendTrainerMessage('assistant', `
            <div style="font-weight:700; margin-bottom:8px;">Olimpiyat seviyesi yuzme kocun hazir.</div>
            <div style="line-height:1.6; color:#5f6c7b;">
                Once ders grubunu sec; grubun antrenman ve yaris derecelerini otomatik okurum. Sonra hedef ve sureyi yaz.
                Internetten guncel antrenman bilgisi tarar, bilgi bankasini kullanir ve sureli (dakika bazli) plan cikaririm.
            </div>
        `, true);
        renderTrainerPlan();
        renderTrainerInputGuidance('');
    }

    function renderTrainerPlan() {
        const resultContainer = q('trainerAiResult');
        const savePanel = q('trainerAiSavePanel');
        if (resultContainer) {
            resultContainer.innerHTML = renderPlanCard(trainerUiState.lastPlan);
        }
        if (savePanel) {
            savePanel.style.display = trainerUiState.lastPlan ? 'block' : 'none';
        }
    }

    function getScheduleOptionLabel(schedule, branch) {
        const customName = String(schedule?.customName || '').trim();
        const timeLabel = schedule?.time || '';
        const dayLabel = Array.isArray(schedule?.days) ? schedule.days.join(', ') : (schedule?.day || '');
        const title = customName ? `${customName} (${timeLabel})` : `${dayLabel} ${timeLabel}`.trim();
        return `${branch ? branch.name : 'Sube'} - ${title || 'Ders grubu'}`;
    }

    async function handleTrainerScheduleContextChange() {
        const select = q('trainerAiSchedule');
        const scheduleId = select?.value || '';
        trainerUiState.selectedScheduleId = scheduleId;

        if (!scheduleId) {
            trainerUiState.groupContext = null;
            renderTrainerGroupContext(null);
            return;
        }

        const status = q('trainerAiChatStatus');
        if (status) {
            status.innerHTML = 'Grup sporcu ve derece verileri okunuyor...';
        }

        try {
            const groupContext = await buildGroupPerformanceContext(scheduleId);
            trainerUiState.groupContext = groupContext;
            trainerUiState.profile = autoFillProfileFromGroupContext(trainerUiState.profile, groupContext);
            renderTrainerGroupContext(groupContext);
            renderTrainerInputGuidance(String(q('trainerAiChatInput')?.value || ''));
            if (status) {
                status.innerHTML = groupContext
                    ? `${groupContext.studentCount} sporcu icin antrenman/yaris dereceleri yuklendi.`
                    : 'Bu grupta sporcu bulunamadi.';
            }
        } catch (error) {
            if (status) {
                status.innerHTML = `Grup verisi okunamadi: ${escapeHtml(error.message)}`;
            }
        }
    }

    function renderTrainerGroupContext(groupContext) {
        const container = q('trainerAiGroupContext');
        if (!container) {
            return;
        }

        if (!groupContext) {
            container.innerHTML = '<div class="trainer-ai-group-empty">Ders grubu secildiginde antrenman ve yaris dereceleri burada gorunur.</div>';
            return;
        }

        const trainingHtml = groupContext.trainingRows.length
            ? groupContext.trainingRows.map(row => `<li>${escapeHtml(row.style)} ${row.distance}m: ${escapeHtml(row.bestTime)}</li>`).join('')
            : '<li>Antrenman derecesi kaydi yok</li>';
        const competitionHtml = groupContext.competitionRows.length
            ? groupContext.competitionRows.map(row => `<li>${escapeHtml(row.style)} ${row.distance}m: ${escapeHtml(row.bestTime)}</li>`).join('')
            : '<li>Yaris derecesi kaydi yok</li>';

        container.innerHTML = `
            <div class="trainer-ai-group-card">
                <strong>${escapeHtml(groupContext.scheduleLabel)}</strong>
                <div class="trainer-ai-group-meta">${groupContext.studentCount} sporcu | ${escapeHtml(groupContext.ageGroupLabel || 'yas grubu belirleniyor')} | onerilen seviye: ${escapeHtml(LEVEL_LABELS[groupContext.suggestedLevelKey] || '-')}</div>
                <div class="trainer-ai-group-columns">
                    <div>
                        <div class="trainer-ai-group-title">Antrenman dereceleri</div>
                        <ul>${trainingHtml}</ul>
                    </div>
                    <div>
                        <div class="trainer-ai-group-title">Yaris dereceleri</div>
                        <ul>${competitionHtml}</ul>
                    </div>
                </div>
            </div>
        `;
    }

    function renderTrainerScheduleOptions() {
        const select = q('trainerAiSchedule');
        if (!select) {
            return;
        }

        const context = getTrainerContext();
        const schedules = Array.isArray(context.allSchedules) ? context.allSchedules : [];
        const branches = Array.isArray(context.allBranches) ? context.allBranches : [];
        const previousValue = select.value;
        select.innerHTML = '<option value="">-- Ders grubu seciniz --</option>';

        schedules.forEach(schedule => {
            const branch = branches.find(item => item.id === schedule.branchId);
            const option = document.createElement('option');
            option.value = schedule.id;
            option.textContent = getScheduleOptionLabel(schedule, branch);
            select.appendChild(option);
        });

        if (previousValue) {
            select.value = previousValue;
        }
    }

    async function refreshTrainerKnowledgeSummary() {
        const badge = q('trainerAiKnowledgeBadge');
        const summary = q('trainerAiKnowledgeSummary');
        if (!badge || !summary) {
            return;
        }

        try {
            const insights = await buildGlobalLearningInsights();
            badge.textContent = buildKnowledgeBadgeText(insights);
            summary.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap;">
                    <div style="max-width:760px; color:#5f6c7b; line-height:1.6;">
                        Bu asistana Super Admin tarafindan yuklenen belgeler ile platform genelindeki workout ve workout satis ornekleri ayni havuzdan beslenir.
                        En cok calisilan yas grubu: <strong>${escapeHtml(insights.topAge || 'veri birikiyor')}</strong>. 
                        En cok satilan hedef: <strong>${escapeHtml(insights.topGoal || 'veri birikiyor')}</strong>.
                    </div>
                </div>
                ${renderKnowledgeSummaryCards(insights)}
            `;
        } catch (error) {
            badge.textContent = 'Bilgi bankasi okunamadi';
            summary.innerHTML = `<div style="color:#c0392b;">Ortak AI ozeti yuklenemedi: ${escapeHtml(error.message)}</div>`;
        }
    }

    async function handleTrainerChatSubmit(event) {
        event.preventDefault();
        const input = q('trainerAiChatInput');
        const status = q('trainerAiChatStatus');
        const text = String(input?.value || '').trim();
        if (!text || trainerUiState.loading) {
            return;
        }

        input.value = '';
        appendTrainerMessage('user', text, false);
        trainerUiState.profile = mergeProfile(trainerUiState.profile, extractSlotsFromText(text));
        renderTrainerInputGuidance('');

        const missingFields = getMissingProfileFields(trainerUiState.profile);
        if (missingFields.length) {
            if (status) {
                status.innerHTML = 'Eksik alanlar istendi.';
            }
            appendTrainerMessage('assistant', buildMissingInfoHtml(missingFields), true);
            return;
        }

        const scheduleSelect = q('trainerAiSchedule');
        trainerUiState.selectedScheduleId = scheduleSelect?.value || trainerUiState.selectedScheduleId || '';

        if (status) {
            status.innerHTML = 'Grup dereceleri, bilgi bankasi ve internet kaynaklari taraniyor...';
        }

        trainerUiState.loading = true;
        try {
            const plan = await generateWorkoutPlan(trainerUiState.profile, {
                scheduleId: trainerUiState.selectedScheduleId
            });
            trainerUiState.lastPlan = plan;
            trainerUiState.profile = plan.profile;
            renderTrainerPlan();
            renderTrainerGroupContext(plan.groupContext);
            appendTrainerMessage('assistant', `
                <div style="font-weight:700; margin-bottom:8px;">Olimpiyat seviyesi plan hazir.</div>
                <div style="line-height:1.6; color:#5f6c7b; margin-bottom:6px;">${escapeHtml(plan.evidenceSummary)}</div>
                <div style="line-height:1.6; color:#5f6c7b;">Asagida detayli plani ve kaydetme panelini aciyorum. Ders grubunu secip kaydedersen bu workout, sen manuel yazmis gibi sisteme eklenir ve ogrencilere dagitilir.</div>
            `, true);
            if (status) {
                status.innerHTML = `Plan hazirlandi. ${plan.totalDistance}m | ~${plan.sessionTimeline?.plannedMinutes || plan.profile.sessionDuration || '-'} dk.`;
            }
        } catch (error) {
            console.error('AI workout generation error:', error);
            appendTrainerMessage('assistant', `<div style="color:#c0392b;">Plan uretilemedi: ${escapeHtml(error.message)}</div>`, true);
            if (status) {
                status.innerHTML = `Plan uretilemedi: ${escapeHtml(error.message)}`;
            }
        } finally {
            trainerUiState.loading = false;
            renderTrainerInputGuidance('');
        }
    }

    async function saveTrainerGeneratedWorkout() {
        const plan = trainerUiState.lastPlan;
        const select = q('trainerAiSchedule');
        const status = q('trainerAiChatStatus');
        if (!plan) {
            if (status) {
                status.innerHTML = 'Kaydedilecek bir plan yok.';
            }
            return;
        }
        if (!select || !select.value) {
            if (status) {
                status.innerHTML = 'Kaydetmeden once bir ders grubu sec.';
            }
            return;
        }
        if (typeof window.createTrainerWorkoutRecord !== 'function') {
            if (status) {
                status.innerHTML = 'Workout kayit motoru bulunamadi.';
            }
            return;
        }

        const saveButton = q('trainerAiSaveBtn');
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent = 'Kaydediliyor...';
        }

        try {
            const workoutRecord = await window.createTrainerWorkoutRecord({
                name: plan.name,
                exercises: plan.exercises,
                workoutBlocks: plan.workoutBlocks,
                scheduleId: select.value
            }, {
                published: true,
                shareToStudents: true,
                extraFields: {
                    aiGenerated: true,
                    aiAgeGroup: plan.profile.ageGroupLabel || getAgeBucket(plan.profile.age),
                    aiGoalKey: plan.profile.goalKey || '',
                    aiFocusStyle: plan.profile.focusStyle || '',
                    aiNotes: plan.profile.notes || '',
                    aiEvidenceSourceIds: (plan.evidenceMatches || []).map(match => match.sourceId)
                }
            });

            await db.collection(AI_GENERATED_COLLECTION).add({
                createdAt: new Date().toISOString(),
                trainerId: getCurrentTrainer()?.id || '',
                scheduleId: select.value,
                workoutId: workoutRecord.id,
                profile: plan.profile,
                evidenceSourceIds: (plan.evidenceMatches || []).map(match => match.sourceId),
                totalDistance: plan.totalDistance,
                name: plan.name
            });

            invalidateLearningCache();
            if (typeof window.refreshTrainerWorkoutViews === 'function') {
                await window.refreshTrainerWorkoutViews();
            }
            await refreshTrainerKnowledgeSummary();
            appendTrainerMessage('assistant', 'Workout kaydedildi. Bu kayit artik senin manuel olusturdugun antrenman gibi listelerde gorunecek ve AI havuzuna da eklendi.', false);
            if (status) {
                status.innerHTML = 'Workout kaydedildi ve ogrencilere dagitildi.';
            }
        } catch (error) {
            console.error('AI workout save error:', error);
            if (status) {
                status.innerHTML = `Kayit sirasinda hata oldu: ${escapeHtml(error.message)}`;
            }
        } finally {
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent = 'Workoutu Kaydet';
            }
        }
    }

    function getFeedStatusMeta(feed) {
        const status = String(feed?.lastSyncStatus || 'pending');
        if (status === 'synced') {
            return { label: 'Senkron', color: '#1e8449', background: '#edf8f1' };
        }
        if (status === 'unchanged') {
            return { label: 'Degisim yok', color: '#2c5d8a', background: '#eef6ff' };
        }
        if (status === 'failed') {
            return { label: 'Hata', color: '#c0392b', background: '#fdecea' };
        }
        return { label: 'Bekliyor', color: '#7f8c8d', background: '#f2f4f6' };
    }

    function renderMonitoredFeedList(feeds) {
        const container = q('globalAiFeedList');
        if (!container) {
            return;
        }

        if (!feeds.length) {
            container.innerHTML = '<div style="padding:16px; border:1px dashed #dbe7f3; border-radius:12px; color:#7b8a9b;">Henuz izlenen link eklenmedi.</div>';
            return;
        }

        container.innerHTML = feeds.map(feed => {
            const feedId = feed.feedId || feed.id || '';
            const meta = getFeedStatusMeta(feed);
            const isBusy = superAdminUiState.syncingFeedIds.has(feedId);
            const actionLabel = isBusy ? 'Calisiyor...' : 'Simdi Tara';
            return `
                <div style="padding:14px; border-radius:12px; border:1px solid #dbe7f3; background:#fff; margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                        <div style="max-width:680px;">
                            <div style="font-weight:700; color:#2c3e50;">${escapeHtml(feed.label || feed.url || 'Izlenen link')}</div>
                            <div style="font-size:0.92em; color:#6f8091; margin-top:4px; word-break:break-all;">${escapeHtml(feed.url || '')}</div>
                            ${feed.notes ? `<div style="margin-top:8px; color:#5f6c7b;">${escapeHtml(feed.notes)}</div>` : ''}
                            <div style="font-size:0.88em; color:#6f8091; margin-top:8px; line-height:1.5;">
                                Periyot: <strong>${escapeHtml(formatSyncInterval(feed.intervalHours || 24))}</strong> |
                                Son tarama: <strong>${escapeHtml(formatRelativeDate(feed.lastSyncedAt || feed.lastAttemptAt || ''))}</strong> |
                                Sonraki: <strong>${escapeHtml(feed.enabled ? formatRelativeDate(feed.nextSyncAt) : 'Pasif')}</strong>
                            </div>
                            ${feed.lastError ? `<div style="margin-top:8px; color:#c0392b; line-height:1.5;">${escapeHtml(feed.lastError)}</div>` : ''}
                        </div>
                        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:flex-start; justify-content:flex-end;">
                            <div style="padding:6px 10px; border-radius:999px; background:${meta.background}; color:${meta.color}; font-weight:700;">${escapeHtml(meta.label)}</div>
                            <button type="button" class="btn btn-info" data-feed-action="sync" data-feed-id="${escapeHtml(feedId)}" ${isBusy ? 'disabled' : ''}>${escapeHtml(actionLabel)}</button>
                            <button type="button" class="btn btn-primary" data-feed-action="toggle" data-feed-id="${escapeHtml(feedId)}" ${isBusy ? 'disabled' : ''}>${feed.enabled ? 'Duraklat' : 'Aktif Et'}</button>
                            <button type="button" class="btn btn-danger" data-feed-action="delete" data-feed-id="${escapeHtml(feedId)}" ${isBusy ? 'disabled' : ''}>Sil</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async function handleSuperAdminManualTextImport() {
        const actor = getCurrentSuperAdmin();
        const titleInput = q('globalAiManualKnowledgeTitle');
        const textInput = q('globalAiManualKnowledgeText');
        const linksInput = q('globalAiManualKnowledgeLinks');
        const status = q('globalAiManualImportStatus');

        if (!actor?.id) {
            if (status) {
                status.innerHTML = '<span style="color:#c0392b;">Super Admin bilgisi bulunamadi.</span>';
            }
            return;
        }

        const rawText = String(textInput?.value || '').trim();
        if (!rawText) {
            if (status) {
                status.innerHTML = '<span style="color:#c0392b;">Toplu workout metnini girmelisin.</span>';
            }
            return;
        }

        if (status) {
            status.innerHTML = 'Toplu metin AI havuzuna aktariliyor...';
        }

        try {
            const translationResult = await maybeTranslateTextToTurkish(rawText);
            const sourceId = `manual_${Date.now()}_${hashString(rawText.slice(0, 240))}`;
            const referenceLinks = String(linksInput?.value || '')
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(Boolean);

            await ingestTextAsKnowledge({
                sourceId,
                sourceName: String(titleInput?.value || '').trim() || `Manuel workout paketi ${new Date().toLocaleDateString('tr-TR')}`,
                sourceType: 'manual-text-import',
                fileName: 'manual-workout-package.txt',
                fileUrl: '',
                text: translationResult.text,
                ageTags: [],
                styleTags: [],
                goalTags: [],
                referenceLinks,
                sourceLabel: 'Toplu workout metni',
                ownerRole: 'superadmin',
                ownerId: actor.id,
                uploadedByName: actor.name || 'Super Admin',
                uploadedByEmail: actor.email || '',
                metadata: {
                    importedFrom: 'manual-text',
                    sourceLanguage: translationResult.sourceLanguage || 'unknown',
                    translationApplied: translationResult.translationApplied,
                    translationStatus: translationResult.translationStatus,
                    translatedTo: translationResult.translationApplied ? 'tr' : ''
                }
            });

            if (textInput) {
                textInput.value = '';
            }
            if (titleInput) {
                titleInput.value = '';
            }
            if (linksInput) {
                linksInput.value = '';
            }

            if (status) {
                status.innerHTML = translationResult.translationApplied
                    ? '<span style="color:#1e8449;">Toplu metin eklendi. Yabanci icerik Turkceye cevrilerek indekslendi.</span>'
                    : '<span style="color:#1e8449;">Toplu metin bilgi bankasina eklendi.</span>';
            }

            await refreshSuperAdminKnowledgePanel();
        } catch (error) {
            if (status) {
                status.innerHTML = `<span style="color:#c0392b;">Toplu import basarisiz: ${escapeHtml(error.message)}</span>`;
            }
        }
    }

    async function handleSuperAdminSaveFeed() {
        const urlInput = q('globalAiFeedUrl');
        const labelInput = q('globalAiFeedLabel');
        const intervalInput = q('globalAiFeedInterval');
        const noteInput = q('globalAiFeedNote');
        const status = q('globalAiFeedStatus');
        let savedFeedId = '';

        const rawUrl = String(urlInput?.value || '').trim();
        if (!rawUrl) {
            if (status) {
                status.innerHTML = '<span style="color:#c0392b;">Izlemek istedigin linki girmelisin.</span>';
            }
            return;
        }

        if (status) {
            status.innerHTML = 'Link kaydediliyor ve ilk tarama baslatiliyor...';
        }

        try {
            const savedFeed = await createOrUpdateMonitoredFeed({
                url: rawUrl,
                label: String(labelInput?.value || '').trim(),
                intervalHours: Number(intervalInput?.value || 24),
                notes: String(noteInput?.value || '').trim()
            });

            savedFeedId = savedFeed.feedId;
            superAdminUiState.syncingFeedIds.add(savedFeed.feedId);
            const syncResult = await syncMonitoredFeed(savedFeed.feedId, { force: true });
            superAdminUiState.syncingFeedIds.delete(savedFeed.feedId);

            if (urlInput) {
                urlInput.value = '';
            }
            if (labelInput) {
                labelInput.value = '';
            }
            if (noteInput) {
                noteInput.value = '';
            }
            if (intervalInput) {
                intervalInput.value = '24';
            }

            if (status) {
                if (syncResult.status === 'failed') {
                    status.innerHTML = `<span style="color:#b9770e;">Link kaydedildi ama ilk tarama basarisiz oldu: ${escapeHtml(syncResult.error || 'Bilinmeyen hata')}</span>`;
                } else {
                    status.innerHTML = `<span style="color:#1e8449;">Link kaydedildi. Ilk tarama durumu: ${escapeHtml(syncResult.status)}</span>`;
                }
            }

            await refreshSuperAdminKnowledgePanel();
        } catch (error) {
            if (savedFeedId) {
                superAdminUiState.syncingFeedIds.delete(savedFeedId);
            }
            if (status) {
                status.innerHTML = `<span style="color:#c0392b;">Link kaydedilemedi: ${escapeHtml(error.message)}</span>`;
            }
        }
    }

    async function handleSuperAdminSyncFeeds(forceAll = false) {
        const status = q('globalAiFeedStatus');
        if (status) {
            status.innerHTML = forceAll
                ? 'Tum aktif linkler simdi taraniyor...'
                : 'Siradaki linkler taraniyor...';
        }

        try {
            const summary = await syncDueMonitoredFeeds({ forceAll, forceRefresh: true });
            if (status) {
                status.innerHTML = summary.processed
                    ? `<span style="color:${summary.failed ? '#b9770e' : '#1e8449'};">${summary.processed} link kontrol edildi. ${summary.synced} guncellendi, ${summary.unchanged} degismedi, ${summary.failed} hata.</span>`
                    : '<span style="color:#5f6c7b;">Taranacak aktif link bulunmadi.</span>';
            }
            await refreshSuperAdminKnowledgePanel();
        } catch (error) {
            if (status) {
                status.innerHTML = `<span style="color:#c0392b;">Link taramasi basarisiz: ${escapeHtml(error.message)}</span>`;
            }
        }
    }

    async function handleSuperAdminFeedActions(event) {
        const actionButton = event.target.closest('[data-feed-action]');
        if (!actionButton) {
            return;
        }

        const action = actionButton.getAttribute('data-feed-action') || '';
        const feedId = actionButton.getAttribute('data-feed-id') || '';
        const status = q('globalAiFeedStatus');
        if (!action || !feedId) {
            return;
        }
        if (superAdminUiState.syncingFeedIds.has(feedId)) {
            return;
        }

        superAdminUiState.syncingFeedIds.add(feedId);
        try {
            if (action === 'sync') {
                if (status) {
                    status.innerHTML = 'Secilen link taraniyor...';
                }
                const result = await syncMonitoredFeed(feedId, { force: true });
                if (status) {
                    status.innerHTML = result.status === 'failed'
                        ? `<span style="color:#b9770e;">Link tarandi ama hata alindi: ${escapeHtml(result.error || 'Bilinmeyen hata')}</span>`
                        : `<span style="color:#1e8449;">Link tarandi. Durum: ${escapeHtml(result.status)}</span>`;
                }
            } else if (action === 'toggle') {
                const feeds = await fetchMonitoredFeeds(true);
                const targetFeed = feeds.find(item => (item.feedId || item.id) === feedId);
                await setMonitoredFeedEnabled(feedId, !targetFeed?.enabled);
                if (status) {
                    status.innerHTML = `<span style="color:#1e8449;">Link durumu guncellendi: ${targetFeed?.enabled ? 'duraklatildi' : 'aktif edildi'}.</span>`;
                }
            } else if (action === 'delete') {
                if (!window.confirm('Bu izlenen linki ve bagli AI kaynagini silmek istiyor musun?')) {
                    return;
                }
                await removeMonitoredFeed(feedId);
                if (status) {
                    status.innerHTML = '<span style="color:#1e8449;">Izlenen link silindi.</span>';
                }
            }

            await refreshSuperAdminKnowledgePanel();
        } catch (error) {
            if (status) {
                status.innerHTML = `<span style="color:#c0392b;">Islem basarisiz: ${escapeHtml(error.message)}</span>`;
            }
        } finally {
            superAdminUiState.syncingFeedIds.delete(feedId);
        }
    }

    async function handleSuperAdminImportDocuments() {
        const actor = getCurrentSuperAdmin();
        const input = q('globalAiKnowledgeFiles');
        const status = q('globalAiImportStatus');
        const errorList = q('globalAiImportErrors');
        const labelInput = q('globalAiKnowledgeLabel');
        const linksInput = q('globalAiKnowledgeReferenceLinks');

        if (!actor?.id) {
            if (status) {
                status.innerHTML = '<span style="color:#c0392b;">Super Admin bilgisi bulunamadi.</span>';
            }
            return;
        }

        const files = Array.from(input?.files || []);
        if (!files.length) {
            if (status) {
                status.innerHTML = '<span style="color:#c0392b;">En az bir belge secmelisin.</span>';
            }
            return;
        }

        if (errorList) {
            errorList.innerHTML = '';
        }
        if (status) {
            status.innerHTML = 'Belgeler parcali bilgi bankasina aktariliyor...';
        }

        const label = String(labelInput?.value || '').trim();
        const referenceLinks = String(linksInput?.value || '')
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);

        const failures = [];
        const warnings = [];
        const notices = [];
        for (const file of files) {
            try {
                const originalText = await extractDocumentText(file);
                if (!originalText.trim()) {
                    throw new Error('Belgede okunabilir metin bulunamadi.');
                }
                const translationResult = await maybeTranslateTextToTurkish(originalText);
                if (translationResult.note) {
                    if (translationResult.translationApplied) {
                        notices.push(`${file.name}: ${translationResult.note}`);
                    } else if (translationResult.translationStatus === 'translation-failed') {
                        warnings.push(`${file.name}: ${translationResult.note}`);
                    }
                }
                const sourceId = `global_${Date.now()}_${hashString(file.name + originalText.slice(0, 200))}`;
                const uploadResult = await uploadSourceFileToStorage(file, sourceId);
                if (uploadResult.warning) {
                    warnings.push(`${file.name}: ${uploadResult.warning}`);
                }
                await ingestTextAsKnowledge({
                    sourceId,
                    sourceName: file.name,
                    sourceType: 'superadmin-upload',
                    fileName: file.name,
                    fileUrl: uploadResult.fileUrl,
                    text: translationResult.text,
                    ageTags: [],
                    styleTags: [],
                    goalTags: [],
                    referenceLinks,
                    sourceLabel: label,
                    ownerRole: 'superadmin',
                    ownerId: actor.id,
                    uploadedByName: actor.name || 'Super Admin',
                    uploadedByEmail: actor.email || '',
                    metadata: {
                        importedFrom: 'superadmin-panel',
                        mimeType: file.type || '',
                        size: file.size || 0,
                        sourceLanguage: translationResult.sourceLanguage || 'unknown',
                        translationApplied: translationResult.translationApplied,
                        translationStatus: translationResult.translationStatus,
                        translatedTo: translationResult.translationApplied ? 'tr' : '',
                        originalSampleText: String(originalText || '').slice(0, 260),
                        storageUploadStatus: uploadResult.status,
                        storageUploadWarning: uploadResult.warning || ''
                    }
                });
            } catch (error) {
                failures.push(`${file.name}: ${error.message}`);
            }
        }

        if (errorList) {
            errorList.innerHTML = [
                ...notices.map(item => `<li style="color:#1e8449;">${escapeHtml(item)}</li>`),
                ...warnings.map(item => `<li style="color:#b9770e;">${escapeHtml(item)}</li>`),
                ...failures.map(item => `<li style="color:#c0392b;">${escapeHtml(item)}</li>`)
            ].join('');
        }

        if (status) {
            if (failures.length) {
                status.innerHTML = `<span style="color:#b9770e;">Belgelerin bir kismi aktarildi. ${files.length - failures.length}/${files.length} basarili. Turkcelestirilen yabanci kaynaklar varsa asagida listelendi.</span>`;
            } else if (warnings.length) {
                status.innerHTML = `<span style="color:#b9770e;">${files.length} belge AI havuzuna eklendi. Ceviri veya Storage ile ilgili notlar asagida.</span>`;
            } else if (notices.length) {
                status.innerHTML = `<span style="color:#1e8449;">${files.length} belge bilgi bankasina eklendi. Yabanci kaynaklar otomatik Turkceye cevrildi.</span>`;
            } else {
                status.innerHTML = `<span style="color:#1e8449;">${files.length} belge bilgi bankasina eklendi.</span>`;
            }
        }

        if (!failures.length && input) {
            input.value = '';
        }

        await refreshSuperAdminKnowledgePanel();
    }

    async function handleSuperAdminSearch() {
        const query = String(q('globalAiSearchQuery')?.value || '').trim();
        const status = q('globalAiSearchStatus');
        const results = q('globalAiSearchResults');
        if (!query) {
            if (status) {
                status.innerHTML = 'Arama yapmak icin bir sorgu yaz.';
            }
            if (results) {
                results.innerHTML = '';
            }
            return;
        }

        if (status) {
            status.innerHTML = 'Bilgi bankasi taraniyor...';
        }

        try {
            const matches = await getRankedKnowledgeMatches(extractSlotsFromText(query), MAX_SEARCH_RESULTS);
            if (!results) {
                return;
            }

            if (!matches.length) {
                results.innerHTML = '<div style="padding:16px; border:1px dashed #dbe7f3; border-radius:12px; color:#7b8a9b;">Eslestirilen kaynak bulunamadi.</div>';
                if (status) {
                    status.innerHTML = 'Eslesen kaynak cikmadi.';
                }
                return;
            }

            results.innerHTML = matches.map(match => `
                <div style="padding:16px; border-radius:12px; border:1px solid #dbe7f3; background:#fff; margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
                        <div>
                            <div style="font-weight:700; color:#2c3e50;">${escapeHtml(match.sourceName || 'Kaynak')}</div>
                            <div style="font-size:0.9em; color:#6f8091; margin-top:4px;">${escapeHtml(match.sourceType || 'bilgi')}</div>
                        </div>
                        <div style="padding:6px 10px; border-radius:999px; background:#eef6ff; color:#2c5d8a; font-weight:700;">Skor ${match.score}</div>
                    </div>
                    <div style="margin-top:10px; color:#5f6c7b; line-height:1.6;">${escapeHtml(String(match.text || '').slice(0, 260))}...</div>
                </div>
            `).join('');

            if (status) {
                status.innerHTML = `${matches.length} kaynak bulundu.`;
            }
        } catch (error) {
            if (status) {
                status.innerHTML = `Arama sirasinda hata: ${escapeHtml(error.message)}`;
            }
        }
    }

    async function refreshSuperAdminKnowledgePanel() {
        const badge = q('globalAiKnowledgeStateBadge');
        const stats = q('globalAiKnowledgeStats');
        const seedStatus = q('globalAiSeedStatus');
        if (!badge || !stats) {
            return;
        }

        try {
            const [insights, sources, feeds] = await Promise.all([
                buildGlobalLearningInsights(),
                fetchKnowledgeSources(),
                fetchMonitoredFeeds()
            ]);
            badge.textContent = buildKnowledgeBadgeText(insights);
            if (seedStatus) {
                seedStatus.innerHTML = insights.seededSourceCount
                    ? '<span style="color:#1e8449;">Sistem seed kutuphanesi aktif.</span>'
                    : '<span style="color:#b9770e;">Sistem seed kutuphanesi henuz eklenmedi.</span>';
            }
            renderMonitoredFeedList(feeds);
            stats.innerHTML = `
                <div style="color:#5f6c7b; line-height:1.6; max-width:880px;">
                    Bu havuz Super Admin yuklemeleri ile birlikte platform genelindeki workoutlar ve satisa acilan workoutlardan otomatik ogrenir.
                    Son durum: <strong>${escapeHtml(insights.totalWorkoutSales)}</strong> satis ornegi, <strong>${escapeHtml(insights.totalWorkouts)}</strong> workout, 
                    en baskin yas grubu <strong>${escapeHtml(insights.topAge || 'veri birikiyor')}</strong>.
                    Izlenen link havuzu: <strong>${escapeHtml(insights.enabledFeedCount)}</strong> aktif link, <strong>${escapeHtml(insights.dueFeedCount)}</strong> tanesi kontrol bekliyor.
                </div>
                ${renderKnowledgeSummaryCards(insights)}
                <div style="margin-top:16px; display:grid; gap:10px;">
                    ${sources.slice(0, 6).map(source => `
                        <div style="padding:14px; border-radius:12px; border:1px solid #dbe7f3; background:#fff;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
                                <div>
                                    <div style="font-weight:700; color:#2c3e50;">${escapeHtml(source.sourceName || source.fileName || 'Kaynak')}</div>
                                    <div style="font-size:0.9em; color:#6f8091; margin-top:4px;">${escapeHtml(source.sourceType || '')} | ${escapeHtml(source.chunkCount || 0)} parcacik | ${escapeHtml(formatRelativeDate(source.updatedAt || source.createdAt))}</div>
                                </div>
                                <div style="padding:6px 10px; border-radius:999px; background:#f3f8fd; color:#35516e; font-weight:700;">${escapeHtml(source.sourceLabel || 'Global kaynak')}</div>
                            </div>
                            <div style="margin-top:10px; color:#5f6c7b; line-height:1.6;">${escapeHtml(String(source.sampleText || '').slice(0, 220))}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            badge.textContent = 'Bilgi bankasi okunamadi';
            stats.innerHTML = `<div style="color:#c0392b;">Panel yuklenemedi: ${escapeHtml(error.message)}</div>`;
        }
    }

    function setupTrainerPage() {
        if (trainerUiState.initialized) {
            return;
        }

        const form = q('trainerAiChatForm');
        const saveButton = q('trainerAiSaveBtn');
        const resetButton = q('trainerAiResetBtn');
        const templateButton = q('trainerAiTemplateBtn');
        const input = q('trainerAiChatInput');
        if (!form || !saveButton || !resetButton || !input) {
            return;
        }

        form.addEventListener('submit', handleTrainerChatSubmit);
        saveButton.addEventListener('click', saveTrainerGeneratedWorkout);
        input.addEventListener('input', event => {
            renderTrainerInputGuidance(event.target.value);
        });
        if (templateButton) {
            templateButton.addEventListener('click', insertTrainerPromptTemplate);
        }
        resetButton.addEventListener('click', () => {
            const status = q('trainerAiChatStatus');
            if (status) {
                status.innerHTML = 'Yeni sohbet baslatildi.';
            }
            resetTrainerConversation();
        });

        renderTrainerQuickPrompts();
        renderTrainerScheduleOptions();
        const scheduleSelect = q('trainerAiSchedule');
        if (scheduleSelect && !scheduleSelect.dataset.bound) {
            scheduleSelect.dataset.bound = 'true';
            scheduleSelect.addEventListener('change', () => {
                handleTrainerScheduleContextChange();
            });
        }
        resetTrainerConversation();
        trainerUiState.initialized = true;
    }

    async function loadTrainerPage() {
        setupTrainerPage();
        renderTrainerScheduleOptions();
        const status = q('trainerAiChatStatus');
        if (status) {
            status.innerHTML = 'Global workout ve satis ornekleri senkronize ediliyor...';
        }
        await ensureLearningExamplesBackfilled();
        await ensureCuratedWorkoutLibrarySeeded();
        await ensureOlympicCoachFeedsSeeded();
        await syncDueMonitoredFeeds().catch(() => null);
        await refreshTrainerKnowledgeSummary();
        if (status) {
            status.innerHTML = 'Ders grubunu sec, sonra mesaj gonder. Eksik alan kalirsa burada isteyecegim.';
        }
        renderTrainerInputGuidance(String(q('trainerAiChatInput')?.value || ''));
    }

    function setupSuperAdminPage() {
        if (superAdminUiState.initialized) {
            return;
        }

        const uploadButton = q('globalAiUploadBtn');
        const searchButton = q('globalAiSearchBtn');
        const manualImportButton = q('globalAiManualImportBtn');
        const feedSaveButton = q('globalAiFeedSaveBtn');
        const feedSyncButton = q('globalAiFeedSyncDueBtn');
        const feedList = q('globalAiFeedList');
        if (!uploadButton || !searchButton || !manualImportButton || !feedSaveButton || !feedSyncButton || !feedList) {
            return;
        }

        uploadButton.addEventListener('click', handleSuperAdminImportDocuments);
        searchButton.addEventListener('click', handleSuperAdminSearch);
        manualImportButton.addEventListener('click', handleSuperAdminManualTextImport);
        feedSaveButton.addEventListener('click', handleSuperAdminSaveFeed);
        feedSyncButton.addEventListener('click', () => handleSuperAdminSyncFeeds(true));
        feedList.addEventListener('click', handleSuperAdminFeedActions);
        superAdminUiState.initialized = true;
    }

    async function loadSuperAdminPage() {
        setupSuperAdminPage();
        const status = q('globalAiImportStatus');
        if (status) {
            status.innerHTML = 'Mevcut workout, seed kutuphane ve izlenen linkler senkronize ediliyor...';
        }
        await ensureLearningExamplesBackfilled();
        await ensureCuratedWorkoutLibrarySeeded();
        const autoSyncSummary = await syncDueMonitoredFeeds();
        await refreshSuperAdminKnowledgePanel();
        if (status) {
            status.innerHTML = autoSyncSummary.processed
                ? `Yeni belge yukleyebilir veya ortak havuzu arayabilirsin. Acilista ${autoSyncSummary.processed} link kontrol edildi.`
                : 'Yeni belge yukleyebilir veya ortak havuzu arayabilirsin.';
        }
    }

    window.aiKnowledgeEngine = {
        syncWorkoutKnowledge,
        syncWorkoutSaleKnowledge,
        fetchKnowledgeSources,
        fetchKnowledgeChunks,
        fetchMonitoredFeeds,
        syncMonitoredFeed,
        syncDueMonitoredFeeds,
        buildGlobalLearningInsights,
        ensureLearningExamplesBackfilled,
        ensureCuratedWorkoutLibrarySeeded,
        invalidateLearningCache
    };

    window.trainerAiPage = {
        setup: setupTrainerPage,
        load: loadTrainerPage,
        saveGeneratedWorkout: saveTrainerGeneratedWorkout
    };

    window.superAdminAiPage = {
        setup: setupSuperAdminPage,
        load: loadSuperAdminPage
    };
})();