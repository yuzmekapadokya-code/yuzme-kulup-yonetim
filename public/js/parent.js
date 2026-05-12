// Parent Dashboard JavaScript

let currentParent = null;
let studentData = null;
let allSchedules = [];
let allBranches = [];
let allTrainers = [];
let allAnnouncements = [];
let allParentStandards = [];
let allParentPerformances = [];
let allParentComments = [];
let allParentTrainerReviews = [];
let currentMarketInquiryProduct = null;
let parentMarketCart = [];
let allParentMarketProducts = [];
let parentMarketBankSettings = null;

const PARENT_TRAINER_REVIEW_LABELS = {
    1: 'Çok Kötü',
    2: 'Kötü',
    3: 'Orta',
    4: 'İyi',
    5: 'Çok İyi'
};

const PARENT_TRAINER_REVIEW_QUESTIONS = [
    { key: 'safety', label: 'Antrenörün çocukların güvenliğine gösterdiği dikkat nasıldır?' },
    { key: 'teaching', label: 'Antrenörün yüzme tekniklerini öğretme becerisini nasıl değerlendirirsiniz?' },
    { key: 'planning', label: 'Derslerin düzeni ve planlı ilerlemesi nasıldır?' },
    { key: 'communicationWithChildren', label: 'Antrenörün çocuklarla iletişimi nasıldır?' },
    { key: 'motivation', label: 'Antrenörün çocukları motive etme ve cesaretlendirme becerisi nasıldır?' },
    { key: 'studentDevelopment', label: 'Çocuğunuzun yüzme gelişimini nasıl değerlendiriyorsunuz?' },
    { key: 'communicationWithParents', label: 'Antrenörün velilerle iletişimi ve bilgilendirmesi nasıldır?' },
    { key: 'overallSatisfaction', label: 'Genel olarak yüzme antrenöründen memnuniyet düzeyiniz nedir?' }
];

function roundParentCurrency(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function parseParentDateValue(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') {
        const date = value.toDate();
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'object' && typeof value.seconds === 'number') {
        const date = new Date(value.seconds * 1000);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
}

function formatParentDateTR(value) {
    const date = parseParentDateValue(value);
    if (!date) return '-';
    return date.toLocaleDateString('tr-TR');
}

function getParentStudentInstallments(student = studentData) {
    if (Array.isArray(student?.installments) && student.installments.length) {
        return student.installments.map(item => ({ ...item }));
    }

    const installmentCount = Math.max(1, Number(student?.installmentCount) || 1);
    const totalAmount = roundParentCurrency(student?.totalAmount || 0);
    const baseAmount = installmentCount > 0 ? roundParentCurrency(totalAmount / installmentCount) : 0;

    return Array.from({ length: installmentCount }, (_, index) => ({
        installmentNumber: index + 1,
        amount: index === installmentCount - 1 ? roundParentCurrency(totalAmount - (baseAmount * index)) : baseAmount,
        dueDate: null,
        lessonLabel: '',
        paid: false,
        paidAmount: 0,
        paidAt: null
    }));
}

function getParentTrainerReviewAverage(review) {
    const questionScores = review?.questionScores || {};
    const scores = PARENT_TRAINER_REVIEW_QUESTIONS
        .map(item => Number(questionScores[item.key]))
        .filter(score => Number.isFinite(score) && score >= 1 && score <= 5);
    if (!scores.length) {
        return null;
    }
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function formatParentTrainerRating(value) {
    const score = Number(value);
    if (!Number.isFinite(score)) {
        return '-';
    }
    return `${score.toFixed(1)} / 5`;
}

function getParentTrainerRatingStars(value) {
    const score = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
    return '★'.repeat(score) + '☆'.repeat(5 - score);
}

function resolveParentTrainerByIdentifiers(trainerId = '', trainerDocId = '') {
    return allTrainers.find(trainer => {
        return trainer.id === trainerDocId
            || trainer.id === trainerId
            || trainer.uid === trainerId
            || trainer.uid === trainerDocId;
    }) || null;
}

function getParentAssignedTrainerOptions() {
    const schedule = allSchedules.find(item => item.id === studentData?.scheduleId);
    if (!schedule) {
        return [];
    }

    const rawAssignments = Array.isArray(schedule.trainerAssignments) && schedule.trainerAssignments.length
        ? schedule.trainerAssignments
        : (schedule.trainerId || schedule.trainerDocId
            ? [{
                trainerId: schedule.trainerId || '',
                trainerDocId: schedule.trainerDocId || '',
                trainerName: schedule.trainerName || ''
            }]
            : []);

    const uniqueAssignments = new Map();
    rawAssignments.forEach(assignment => {
        const trainer = resolveParentTrainerByIdentifiers(assignment?.trainerId || '', assignment?.trainerDocId || '');
        const trainerId = assignment?.trainerId || trainer?.uid || trainer?.id || '';
        const trainerDocId = assignment?.trainerDocId || trainer?.id || '';
        const key = trainerDocId || trainerId;
        if (!key || uniqueAssignments.has(key)) {
            return;
        }
        uniqueAssignments.set(key, {
            trainerId,
            trainerDocId,
            trainerName: assignment?.trainerName || trainer?.name || 'Antrenör',
            trainerKey: key
        });
    });

    return Array.from(uniqueAssignments.values());
}

function doesParentReviewMatchTrainer(review, trainerRef = {}) {
    const trainerValues = [trainerRef.trainerId, trainerRef.trainerDocId, trainerRef.trainerKey].filter(Boolean);
    const reviewValues = [review?.trainerId, review?.trainerDocId].filter(Boolean);
    return trainerValues.some(value => reviewValues.includes(value));
}

function buildParentTrainerReviewScopeKey(scopeType, targetId, trainerRef = {}) {
    if (scopeType === 'general') {
        const trainerKey = trainerRef.trainerDocId || trainerRef.trainerId || targetId || 'unknown';
        return `general_${studentData?.id || 'student'}_${trainerKey}`;
    }
    return `lesson_${targetId}`;
}

function findExistingParentTrainerReview(scopeType, targetId, trainerRef = {}) {
    const scopeKey = buildParentTrainerReviewScopeKey(scopeType, targetId, trainerRef);
    return allParentTrainerReviews.find(review => review.scopeKey === scopeKey) || null;
}

function getParentTrainerReviewAggregate() {
    const scores = allParentTrainerReviews
        .map(review => getParentTrainerReviewAverage(review))
        .filter(score => Number.isFinite(score));
    if (!scores.length) {
        return { count: 0, average: null };
    }
    return {
        count: scores.length,
        average: scores.reduce((sum, score) => sum + score, 0) / scores.length
    };
}

function getParentTrainerReviewContext(scopeType, targetId) {
    if (scopeType === 'lesson') {
        const comment = allParentComments.find(item => item.id === targetId);
        if (!comment) {
            return null;
        }
        const trainer = resolveParentTrainerByIdentifiers(comment.trainerId || '', comment.trainerDocId || '');
        return {
            scopeType,
            targetId,
            scopeKey: buildParentTrainerReviewScopeKey(scopeType, targetId, {
                trainerId: comment.trainerId || trainer?.uid || trainer?.id || '',
                trainerDocId: comment.trainerDocId || trainer?.id || ''
            }),
            trainerId: comment.trainerId || trainer?.uid || trainer?.id || '',
            trainerDocId: comment.trainerDocId || trainer?.id || '',
            trainerName: comment.trainerName || trainer?.name || 'Antrenör',
            lessonCommentId: comment.id,
            lessonDate: comment.lessonDate || comment.createdAt || '',
            lessonTopic: comment.topic || 'Ders yorumu',
            title: 'Ders Bazlı Antrenör Değerlendirmesi',
            subtitle: `${comment.trainerName || trainer?.name || 'Antrenör'} için ${formatParentDateTR(comment.lessonDate || comment.createdAt)} tarihli ders değerlendirmesini doldurun.`
        };
    }

    const trainerRef = getParentAssignedTrainerOptions().find(item => item.trainerKey === targetId || item.trainerDocId === targetId || item.trainerId === targetId);
    if (!trainerRef) {
        return null;
    }

    return {
        scopeType,
        targetId: trainerRef.trainerKey,
        scopeKey: buildParentTrainerReviewScopeKey(scopeType, trainerRef.trainerKey, trainerRef),
        trainerId: trainerRef.trainerId || '',
        trainerDocId: trainerRef.trainerDocId || '',
        trainerName: trainerRef.trainerName || 'Antrenör',
        lessonCommentId: '',
        lessonDate: '',
        lessonTopic: '',
        title: 'Genel Antrenör Değerlendirmesi',
        subtitle: `${trainerRef.trainerName || 'Antrenör'} için tüm derslere yönelik genel memnuniyet değerlendirmenizi paylaşın.`
    };
}

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

// Check authentication
window.addEventListener('load', async () => {
    const userId = sessionStorage.getItem('user_id');
    const role = sessionStorage.getItem('user_role');
    
    if (!userId || role !== 'parent') {
        window.location.href = '../index.html';
        return;
    }
    
    currentParent = {
        id: userId,
        name: sessionStorage.getItem('user_name'),
        email: sessionStorage.getItem('user_email')
    };
    
    document.getElementById('userName').textContent = currentParent.name;
    document.getElementById('userAvatar').textContent = currentParent.name.charAt(0).toUpperCase();
    
    // Load initial data
    await loadAllData();
    setupEventListeners();
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

    const parentStandardBirthYearFilter = document.getElementById('parentStandardBirthYearFilter');
    if (parentStandardBirthYearFilter) {
        parentStandardBirthYearFilter.addEventListener('change', () => {
            populateParentStandardStyleFilter();
            populateParentStandardDistanceFilter();
            filterParentStandards();
        });
    }

    const parentStandardStyleFilter = document.getElementById('parentStandardStyleFilter');
    if (parentStandardStyleFilter) {
        parentStandardStyleFilter.addEventListener('change', () => {
            populateParentStandardDistanceFilter();
            filterParentStandards();
        });
    }

    const parentStandardDistanceFilter = document.getElementById('parentStandardDistanceFilter');
    if (parentStandardDistanceFilter) {
        parentStandardDistanceFilter.addEventListener('change', filterParentStandards);
    }

    const parentTrainerReviewForm = document.getElementById('parentTrainerReviewForm');
    if (parentTrainerReviewForm) {
        parentTrainerReviewForm.addEventListener('submit', saveParentTrainerReview);
    }
}

// Load all data
async function loadAllData() {
    try {
        // Get parent's student
        const userDoc = await db.collection('users').doc(currentParent.id).get();
        const userData = userDoc.data();
        
        if (userData && userData.studentId) {
            const studentDoc = await db.collection('students').doc(userData.studentId).get();
            studentData = {id: userData.studentId, ...studentDoc.data()};
            const adminId = studentData.adminId || '';
            
            const [schedulesSnap, trainersSnap, branchesSnap, announcementsSnap] = await Promise.all([
                adminId ? db.collection('schedules').where('adminId', '==', adminId).get() : db.collection('schedules').get(),
                adminId ? db.collection('trainers').where('adminId', '==', adminId).get() : db.collection('trainers').get(),
                adminId ? db.collection('branches').where('adminId', '==', adminId).get() : db.collection('branches').get(),
                adminId ? db.collection('announcements').where('adminId', '==', adminId).get() : db.collection('announcements').get(),
                loadAllEvents(adminId)
            ]);

            allSchedules = schedulesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
            allTrainers = trainersSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
            allBranches = branchesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
            allAnnouncements = announcementsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
            
            showOverview();
        }
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
        'overview': 'Özet',
        'events': 'Etkinlikler',
        'workouts': 'Antrenmanlar',
        'performances': '📊 Performans',
        'payments': 'Ödeme Durumu',
        'attendance': 'Devam Durumu',
        'standards': '🎯 Barajlar',
        'announcements': 'Duyurular',
        'market': '🛒 Market',
        'chat': '💬 Mesajlaşma',
        'profile': 'Profil'
    };
    
    document.getElementById('pageTitle').textContent = titles[pageName] || 'Veli Paneli';
    
    // Load page-specific data
    if (pageName === 'events') {
        renderEventCalendar();
        renderEventsList();
    } else if (pageName === 'workouts') {
        loadStudentWorkouts();
    } else if (pageName === 'performances') {
        loadParentPerformanceDashboard();
    } else if (pageName === 'payments') {
        loadPayments();
    } else if (pageName === 'attendance') {
        loadAttendance();
    } else if (pageName === 'standards') {
        loadParentStandards();
    } else if (pageName === 'announcements') {
        loadAnnouncements();
    } else if (pageName === 'market') {
        loadMarketProducts();
    } else if (pageName === 'chat') {
        loadChatList();
    } else if (pageName === 'profile') {
        loadProfileInfo();
    }
}

function loadProfileInfo() {
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');

    if (profileName) profileName.textContent = currentParent?.name || '-';
    if (profileEmail) profileEmail.textContent = currentParent?.email || '-';
}

function getParentStudentBirthYear(student = studentData) {
    if (!student) return null;
    if (student.birthYear) return Number(student.birthYear);
    if (student.age) return new Date().getFullYear() - Number(student.age);
    return null;
}

function getParentStudentAge(student = studentData) {
    const birthYear = getParentStudentBirthYear(student);
    if (!birthYear) return null;
    return new Date().getFullYear() - birthYear;
}

function getParentStandardScope(standard) {
    if (standard.scopeType) return standard.scopeType;
    if (standard.adminId) return 'admin';
    if (standard.trainerId) return 'trainer';
    return 'global';
}

function cleanParentStandardDocumentTitle(value) {
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

    const priorityMarkers = ['ULUSAL GELİŞİM LİGİ', 'TÜRKİYE FİNALİ', 'TURKIYE FINALI', 'ANALİG', 'ANALIG', 'OKUL SPORLARI', 'MİLLİ TAKIM', 'MILLI TAKIM'];
    const foundIndexes = priorityMarkers
        .map(marker => upperTitle.indexOf(marker))
        .filter(index => index >= 0)
        .sort((left, right) => left - right);

    return (foundIndexes.length ? upperTitle.slice(foundIndexes[0]) : upperTitle).replace(/\s+/g, ' ').trim() || 'BARAJ';
}

function isParentOpenAgeStandard(standard) {
    const token = String(standard?.ageGroupToken || '').trim();
    return Boolean(standard?.isOpenAgeGroup) || token.endsWith('+');
}

function doesParentStandardMatchBirthYear(standard, studentBirthYear) {
    const standardBirthYear = Number(standard?.birthYear);
    if (!Number.isFinite(standardBirthYear)) {
        return false;
    }

    const normalizedStudentBirthYear = Number(studentBirthYear);
    if (!Number.isFinite(normalizedStudentBirthYear)) {
        return true;
    }

    if (isParentOpenAgeStandard(standard)) {
        return normalizedStudentBirthYear <= standardBirthYear;
    }

    return standardBirthYear <= normalizedStudentBirthYear;
}

function getParentStandardBirthYearLabel(standard) {
    const birthYear = Number(standard?.birthYear);
    if (!Number.isFinite(birthYear)) {
        return '-';
    }
    if (isParentOpenAgeStandard(standard)) {
        return `${birthYear}+ (Açık Yaş)`;
    }
    return String(birthYear);
}

function getParentReadableStandardTitle(standard) {
    const year = getParentStandardBirthYearLabel(standard);
    const eventTitle = cleanParentStandardDocumentTitle(standard.name || standard.groupLabel || '');
    const poolLabel = standard.poolType ? `${standard.poolType} metre` : '';
    const categoryLabel = standard.category ? String(standard.category).toLocaleLowerCase('tr-TR') : '';
    return [year, eventTitle, poolLabel, categoryLabel].filter(Boolean).join(' ').trim();
}

let expandedParentStandardGroups = new Set();

function isStandardVisibleToParent(standard) {
    if (!studentData) return false;

    const scope = getParentStandardScope(standard);
    const matchesGender = !studentData.gender || !standard.gender || standard.gender === studentData.gender;
    if (!matchesGender) return false;

    if (scope === 'global') return true;
    if (scope === 'admin') return standard.adminId === studentData.adminId;
    if (scope === 'trainer') return standard.trainerId === studentData.trainerId;
    return false;
}

function escapeParentStandardText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function populateParentStandardBirthYearFilter() {
    const birthYearSelect = document.getElementById('parentStandardBirthYearFilter');
    if (!birthYearSelect) return;

    const birthYears = [...new Set(allParentStandards
        .map(item => Number(item.birthYear))
        .filter(year => Number.isFinite(year)))]
        .sort((a, b) => b - a);

    birthYearSelect.innerHTML = '<option value="">Tüm Doğum Yılları</option>';
    birthYears.forEach(birthYear => {
        const option = document.createElement('option');
        option.value = String(birthYear);
        const hasOpenAge = allParentStandards.some(item => Number(item.birthYear) === birthYear && isParentOpenAgeStandard(item));
        option.textContent = hasOpenAge ? `${birthYear}+ (Açık Yaş)` : String(birthYear);
        birthYearSelect.appendChild(option);
    });
}

function getParentFilteredStandardsForSelectors() {
    const birthYearFilter = document.getElementById('parentStandardBirthYearFilter')?.value || '';
    const styleFilter = document.getElementById('parentStandardStyleFilter')?.value || '';

    return allParentStandards.filter(standard => {
        const matchBirthYear = !birthYearFilter || String(standard.birthYear) === birthYearFilter;
        const matchStyle = !styleFilter || standard.style === styleFilter;
        return matchBirthYear && matchStyle;
    });
}

function populateParentStandardStyleFilter() {
    const styleSelect = document.getElementById('parentStandardStyleFilter');
    if (!styleSelect) return;

    const currentValue = styleSelect.value || '';
    const birthYearFilter = document.getElementById('parentStandardBirthYearFilter')?.value || '';
    const styles = [...new Set(allParentStandards
        .filter(standard => !birthYearFilter || String(standard.birthYear) === birthYearFilter)
        .map(standard => String(standard.style || '').trim())
        .filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));

    styleSelect.innerHTML = '<option value="">Tüm Stiller</option>';
    styles.forEach(style => {
        const option = document.createElement('option');
        option.value = style;
        option.textContent = style;
        styleSelect.appendChild(option);
    });

    styleSelect.value = styles.includes(currentValue) ? currentValue : '';
}

function populateParentStandardDistanceFilter() {
    const distanceSelect = document.getElementById('parentStandardDistanceFilter');
    if (!distanceSelect) return;

    const currentValue = distanceSelect.value || '';
    const distances = [...new Set(getParentFilteredStandardsForSelectors()
        .map(standard => Number(standard.distance))
        .filter(distance => Number.isFinite(distance)))].sort((a, b) => a - b);

    distanceSelect.innerHTML = '<option value="">Tüm Mesafeler</option>';
    distances.forEach(distance => {
        const option = document.createElement('option');
        option.value = String(distance);
        option.textContent = `${distance}m`;
        distanceSelect.appendChild(option);
    });

    distanceSelect.value = distances.map(String).includes(currentValue) ? currentValue : '';
}

function normalizeParentPerformanceStyle(style) {
    const styleMap = {
        'Sırt': 'Sırtüstü',
        'Kurbağa': 'Kurbağalama',
        'Kelebek': 'Kelebekçe',
        'Karışık': 'Karma'
    };

    return styleMap[style] || style;
}

function parentTimeToSeconds(timeString) {
    if (!timeString || typeof timeString !== 'string' || !timeString.includes(':')) return Number.POSITIVE_INFINITY;
    const [minutes, secondsPart] = timeString.split(':');
    const [seconds, centiseconds = '0'] = String(secondsPart || '').split('.');
    return (Number(minutes) * 60) + Number(seconds) + (Number(centiseconds) / 100);
}

function formatParentTimeDifference(seconds) {
    if (!Number.isFinite(seconds)) return '-';
    const totalCentiseconds = Math.round(seconds * 100);
    const minutes = Math.floor(totalCentiseconds / 6000);
    const remainingCentiseconds = totalCentiseconds % 6000;
    const wholeSeconds = Math.floor(remainingCentiseconds / 100);
    const centiseconds = remainingCentiseconds % 100;

    if (minutes > 0) {
        return `${minutes}:${String(wholeSeconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
    }

    return `${wholeSeconds}.${String(centiseconds).padStart(2, '0')} sn`;
}

function getParentBestPerformance(style, distance) {
    const matching = allParentPerformances.filter(item => {
        const sameStyle = normalizeParentPerformanceStyle(item.style) === normalizeParentPerformanceStyle(style);
        const sameDistance = Number(item.distance) === Number(distance);
        return sameStyle && sameDistance;
    });

    if (!matching.length) return null;

    return matching.reduce((best, current) => (
        parentTimeToSeconds(current.time) < parentTimeToSeconds(best.time) ? current : best
    ));
}

function buildParentStandardStatus(standard) {
    const bestPerformance = getParentBestPerformance(standard.style, standard.distance);
    if (!bestPerformance) {
        return '<span style="color: #95a5a6;">Henüz derece yok</span>';
    }

    const bestSeconds = parentTimeToSeconds(bestPerformance.time);
    const standardSeconds = parentTimeToSeconds(standard.time);
    const delta = Math.abs(bestSeconds - standardSeconds);

    if (bestSeconds <= standardSeconds) {
        return `
            <div style="color: #27ae60; font-weight: 600;">Geçti</div>
            <div style="font-size: 0.85em; color: #27ae60;">${formatParentTimeDifference(delta)} farkla</div>
            <div style="font-size: 0.82em; color: #7f8c8d;">En iyi derece: ${escapeParentStandardText(bestPerformance.time)}</div>
        `;
    }

    return `
        <div style="color: #c0392b; font-weight: 600;">Geçemedi</div>
        <div style="font-size: 0.85em; color: #c0392b;">${formatParentTimeDifference(delta)} geride</div>
        <div style="font-size: 0.82em; color: #7f8c8d;">En iyi derece: ${escapeParentStandardText(bestPerformance.time)}</div>
    `;
}

function displayParentStandards(standards) {
    const tbody = document.getElementById('parentStandardsTableBody');
    if (!tbody) return;

    if (!standards.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #95a5a6;">Seçilen filtreye uygun baraj bulunamadı.</td></tr>';
        return;
    }

    const groupedStandards = new Map();
    standards.forEach(standard => {
        const title = getParentReadableStandardTitle(standard);
        const meta = [(getParentStandardScope(standard) === 'global' ? 'Genel Baraj' : 'Kulüp Barajı'), standard.gender].filter(Boolean).join(' • ');
        const groupKey = [title, meta].join('|');
        if (!groupedStandards.has(groupKey)) {
            groupedStandards.set(groupKey, { key: groupKey, title, meta, items: [] });
        }
        groupedStandards.get(groupKey).items.push(standard);
    });

    let html = '';
    Array.from(groupedStandards.values()).forEach(group => {
        const isExpanded = expandedParentStandardGroups.has(group.key);
        html += `
            <tr style="background:#f7fafc; border-bottom:1px solid #dfe7ef; cursor:pointer;" onclick="toggleParentStandardGroup('${escapeParentStandardText(group.key)}')">
                <td colspan="6" style="padding:14px 12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
                        <div>
                            <div style="font-weight:700; color:#22313f;">${isExpanded ? '▼' : '►'} ${escapeParentStandardText(group.title)}</div>
                            <div style="margin-top:4px; font-size:0.85em; color:#6f8091;">${escapeParentStandardText(group.meta)} • ${group.items.length} kayıt</div>
                        </div>
                        <div style="font-size:0.82em; color:#8aa0b2;">Detayları ${isExpanded ? 'gizle' : 'göster'}</div>
                    </div>
                </td>
            </tr>
        `;

        if (isExpanded) {
            group.items
                .sort((left, right) => String(left.style || '').localeCompare(String(right.style || ''), 'tr') || Number(left.distance || 0) - Number(right.distance || 0))
                .forEach(standard => {
                    html += `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 12px;">
                                <div style="font-weight: 600; color: #2c3e50;">${escapeParentStandardText(standard.style)} ${escapeParentStandardText(standard.distance)}m</div>
                                <div style="margin-top: 4px; font-size: 0.82em; color: #7f8c8d;">${escapeParentStandardText(standard.gender)}</div>
                            </td>
                            <td style="padding: 12px;">${escapeParentStandardText(getParentStandardBirthYearLabel(standard))}</td>
                            <td style="padding: 12px;">${escapeParentStandardText(standard.style)}</td>
                            <td style="padding: 12px;">${escapeParentStandardText(standard.distance)}m</td>
                            <td style="padding: 12px; text-align: center; font-weight: 600; color: #2980b9;">${escapeParentStandardText(standard.time)}</td>
                            <td style="padding: 12px; min-width: 170px;">${buildParentStandardStatus(standard)}</td>
                        </tr>
                    `;
                });
        }
    });

    tbody.innerHTML = html;
}

function toggleParentStandardGroup(groupKey) {
    if (expandedParentStandardGroups.has(groupKey)) {
        expandedParentStandardGroups.delete(groupKey);
    } else {
        expandedParentStandardGroups.add(groupKey);
    }
    filterParentStandards();
}

async function loadParentStandards() {
    if (!studentData) return;

    const info = document.getElementById('parentStandardsInfo');
    const studentBirthYear = getParentStudentBirthYear();
    if (info) {
        info.textContent = studentBirthYear
            ? `Öğrenciniz için ${studentBirthYear} doğum yılı ve daha eski doğum yıllarına ait barajlar gösterilir.`
            : 'Öğrencinizin doğum yılına göre uygun barajlar gösterilir.';
    }

    try {
        const snap = await db.collection('standards').orderBy('name').get();
        allParentStandards = snap.docs
            .map(doc => ({id: doc.id, ...doc.data()}))
            .filter(item => item.birthYear)
            .filter(item => doesParentStandardMatchBirthYear(item, studentBirthYear || item.birthYear))
            .filter(isStandardVisibleToParent);

        populateParentStandardBirthYearFilter();
        populateParentStandardStyleFilter();
        populateParentStandardDistanceFilter();
        filterParentStandards();
    } catch (error) {
        console.error('Veli barajları yüklenirken hata:', error);
        const tbody = document.getElementById('parentStandardsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #e74c3c;">Barajlar yüklenemedi.</td></tr>';
        }
    }
}

function filterParentStandards() {
    const birthYearFilter = document.getElementById('parentStandardBirthYearFilter')?.value || '';
    const styleFilter = document.getElementById('parentStandardStyleFilter')?.value || '';
    const distanceFilter = document.getElementById('parentStandardDistanceFilter')?.value || '';

    const filtered = allParentStandards.filter(standard => {
        const matchBirthYear = !birthYearFilter || String(standard.birthYear) === birthYearFilter;
        const matchStyle = !styleFilter || standard.style === styleFilter;
        const matchDistance = !distanceFilter || String(standard.distance) === distanceFilter;
        return matchBirthYear && matchStyle && matchDistance;
    });

    displayParentStandards(filtered);
}

function getParentStandardMatchForPerformance(performance) {
    const studentBirthYear = getParentStudentBirthYear();
    const performanceSeconds = parentTimeToSeconds(performance.time);
    const matchingStandards = allParentStandards
        .filter(standard => doesParentStandardMatchBirthYear(standard, studentBirthYear || standard.birthYear))
        .filter(standard => normalizeParentPerformanceStyle(standard.style) === normalizeParentPerformanceStyle(performance.style))
        .filter(standard => Number(standard.distance) === Number(performance.distance))
        .sort((left, right) => Number(right.birthYear) - Number(left.birthYear) || (parentTimeToSeconds(left.time) - parentTimeToSeconds(right.time)));

    if (!matchingStandards.length) {
        return null;
    }

    const passed = matchingStandards.filter(standard => performanceSeconds <= parentTimeToSeconds(standard.time));
    if (passed.length) {
        const strongest = passed[0];
        return {
            passed: true,
            standard: strongest,
            difference: parentTimeToSeconds(strongest.time) - performanceSeconds,
            passedNames: passed.map(item => item.name)
        };
    }

    const nearest = matchingStandards[0];
    return {
        passed: false,
        standard: nearest,
        difference: performanceSeconds - parentTimeToSeconds(nearest.time),
        passedNames: []
    };
}

function renderParentPerformanceCards() {
    const container = document.getElementById('parentPerformancesList');
    if (!container) return;

    if (!allParentPerformances.length) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #95a5a6; background: #f8f9fa; border-radius: 8px;">Henüz performans kaydı bulunmuyor.</div>';
        return;
    }

    const grouped = {};
    allParentPerformances.forEach(performance => {
        const key = `${normalizeParentPerformanceStyle(performance.style)}_${performance.distance}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(performance);
    });

    const cards = Object.values(grouped).map(group => {
        const sortedByDate = [...group].sort((left, right) => new Date(right.date || right.createdAt || 0) - new Date(left.date || left.createdAt || 0));
        const best = group.reduce((bestItem, currentItem) => (
            parentTimeToSeconds(currentItem.time) < parentTimeToSeconds(bestItem.time) ? currentItem : bestItem
        ));
        const latest = sortedByDate[0];
        const standardState = getParentStandardMatchForPerformance(best);
        const styleLabel = normalizeParentPerformanceStyle(best.style);
        const cardId = `parent-perf-${best.id}`;

        return `
            <div style="background: #f9f9f9; border-radius: 10px; padding: 16px; margin-bottom: 15px; border-left: 4px solid #3498db; cursor: pointer;" onclick="openParentPerformanceModal('${cardId}')">
                <div style="display: flex; justify-content: space-between; gap: 12px; align-items: flex-start;">
                    <div>
                        <h4 style="margin: 0 0 8px 0; color: #2c3e50;">${best.distance}m ${styleLabel}</h4>
                        <div style="font-size: 1.35em; font-weight: 700; color: #27ae60;">${escapeParentStandardText(best.time)}</div>
                        <div style="font-size: 0.88em; color: #7f8c8d; margin-top: 4px;">Son derece: ${escapeParentStandardText(latest.time)} • ${new Date(latest.date || latest.createdAt).toLocaleDateString('tr-TR')}</div>
                    </div>
                    <div style="text-align: right; min-width: 180px;">
                        ${standardState ? (standardState.passed
                            ? `<div style="color: #27ae60; font-weight: 600;">${escapeParentStandardText(standardState.standard.name)} geçildi</div><div style="font-size: 0.85em; color: #27ae60;">${formatParentTimeDifference(standardState.difference)} farkla</div>`
                            : `<div style="color: #c0392b; font-weight: 600;">${escapeParentStandardText(standardState.standard.name)} kaçtı</div><div style="font-size: 0.85em; color: #c0392b;">${formatParentTimeDifference(standardState.difference)} geride</div>`)
                            : '<div style="color: #95a5a6; font-size: 0.9em;">Baraj eşleşmesi yok</div>'}
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = cards.join('');

    Object.values(grouped).forEach(group => {
        const best = group.reduce((bestItem, currentItem) => (
            parentTimeToSeconds(currentItem.time) < parentTimeToSeconds(bestItem.time) ? currentItem : bestItem
        ));
        const styleLabel = normalizeParentPerformanceStyle(best.style);
        const cardId = `parent-perf-${best.id}`;
        window.parentPerformanceModalCache = window.parentPerformanceModalCache || {};
        window.parentPerformanceModalCache[cardId] = {
            title: `${best.distance}m ${styleLabel}`,
            performances: [...group].sort((left, right) => new Date(right.date || right.createdAt || 0) - new Date(left.date || left.createdAt || 0))
        };
    });
}

function renderParentTrainerComments() {
    const container = document.getElementById('parentTrainerComments');
    if (!container) return;

    if (!allParentComments.length) {
        container.innerHTML = '<div style="padding: 16px; background: #f8f9fa; border-radius: 8px; color: #95a5a6;">Henüz antrenör notu girilmemiş.</div>';
        return;
    }

    container.innerHTML = allParentComments.map(comment => `
        <div style="background: white; border: 1px solid #ecf0f1; border-left: 4px solid #16a085; border-radius: 8px; padding: 14px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; gap: 10px; margin-bottom: 8px;">
                <strong style="color: #2c3e50;">${escapeParentStandardText(comment.topic || 'Ders Yorumu')}</strong>
                <span style="color: #7f8c8d; font-size: 0.85em;">${new Date(comment.lessonDate || comment.createdAt).toLocaleDateString('tr-TR')}</span>
            </div>
            <div style="font-size: 0.88em; color: #7f8c8d; margin-bottom: 8px;">${escapeParentStandardText(comment.trainerName || 'Antrenör')}</div>
            <div style="color: #34495e; line-height: 1.55;">${escapeParentStandardText(comment.comment)}</div>
            <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; margin-top:12px; padding-top:12px; border-top:1px solid #edf2f7; flex-wrap:wrap;">
                <div style="font-size:0.88em; color:#6b7280;">${(() => {
                    const review = findExistingParentTrainerReview('lesson', comment.id, { trainerId: comment.trainerId || '', trainerDocId: comment.trainerDocId || '' });
                    const average = getParentTrainerReviewAverage(review);
                    return review && average
                        ? `Bu ders için verdiğiniz puan: <strong style=&quot;color:#0f766e;&quot;>${formatParentTrainerRating(average)}</strong> • ${getParentTrainerRatingStars(average)}`
                        : 'Bu ders için henüz değerlendirme yapmadınız.';
                })()}</div>
                <button class="btn btn-primary btn-sm" onclick="openParentTrainerReviewModal('lesson', '${comment.id}')">${findExistingParentTrainerReview('lesson', comment.id, { trainerId: comment.trainerId || '', trainerDocId: comment.trainerDocId || '' }) ? 'Değerlendirmeyi Güncelle' : 'Antrenörü Değerlendir'}</button>
            </div>
        </div>
    `).join('');
}

function renderParentGeneralTrainerReviews() {
    const container = document.getElementById('parentGeneralTrainerReviews');
    if (!container) return;

    const trainerOptions = getParentAssignedTrainerOptions();
    if (!trainerOptions.length) {
        container.innerHTML = '<div style="padding: 16px; background: #f8f9fa; border-radius: 8px; color: #95a5a6;">Bu öğrenci için atanmış antrenör bulunamadı.</div>';
        return;
    }

    container.innerHTML = trainerOptions.map(trainer => {
        const generalReview = findExistingParentTrainerReview('general', trainer.trainerKey, trainer);
        const average = getParentTrainerReviewAverage(generalReview);
        const lessonReviewCount = allParentTrainerReviews.filter(review => review.scopeType === 'lesson' && doesParentReviewMatchTrainer(review, trainer)).length;

        return `
            <div style="background:white; border:1px solid #e5e7eb; border-radius:10px; padding:16px; margin-bottom:12px; display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap; align-items:center;">
                <div>
                    <div style="font-weight:700; color:#1f2937;">${escapeParentStandardText(trainer.trainerName || 'Antrenör')}</div>
                    <div style="font-size:0.9em; color:#6b7280; margin-top:6px;">${generalReview && average ? `Genel puanınız: ${formatParentTrainerRating(average)} • ${getParentTrainerRatingStars(average)}` : 'Henüz genel değerlendirme yapmadınız.'}</div>
                    <div style="font-size:0.85em; color:#94a3b8; margin-top:4px;">Ders bazlı değerlendirme sayınız: ${lessonReviewCount}</div>
                </div>
                <button class="btn btn-info btn-sm" onclick="openParentTrainerReviewModal('general', '${trainer.trainerKey}')">${generalReview ? 'Genel Değerlendirmeyi Güncelle' : 'Genel Değerlendirme Yap'}</button>
            </div>
        `;
    }).join('');
}

function updateParentPerformanceSummary() {
    const bestOverall = allParentPerformances.reduce((best, current) => {
        if (!best) return current;
        return parentTimeToSeconds(current.time) < parentTimeToSeconds(best.time) ? current : best;
    }, null);
    const passedCount = allParentPerformances.reduce((count, performance) => {
        const status = getParentStandardMatchForPerformance(performance);
        return count + (status && status.passed ? 1 : 0);
    }, 0);

    document.getElementById('parentPerformanceCount').textContent = String(allParentPerformances.length);
    document.getElementById('parentBestPerformance').textContent = bestOverall ? `${bestOverall.distance}m ${normalizeParentPerformanceStyle(bestOverall.style)} • ${bestOverall.time}` : '-';
    document.getElementById('parentPassedStandardCount').textContent = String(passedCount);
    document.getElementById('parentCommentCount').textContent = String(allParentComments.length);

    const reviewAggregate = getParentTrainerReviewAggregate();
    const reviewCountElement = document.getElementById('parentTrainerReviewCount');
    const reviewAverageElement = document.getElementById('parentTrainerReviewAverage');
    if (reviewCountElement) {
        reviewCountElement.textContent = String(reviewAggregate.count);
    }
    if (reviewAverageElement) {
        reviewAverageElement.textContent = reviewAggregate.average ? formatParentTrainerRating(reviewAggregate.average) : '-';
    }
}

async function loadParentPerformanceDashboard() {
    if (!studentData) return;

    const info = document.getElementById('parentPerformanceInfo');
    if (info) {
        info.textContent = 'En iyi dereceler, geçilen barajlar ve ders bazlı antrenör yorumları birlikte gösterilir.';
    }

    try {
        const [performancesSnap, commentsSnap, trainerReviewsSnap] = await Promise.all([
            db.collection('performances').where('studentId', '==', studentData.id).get(),
            db.collection('lesson_comments').where('studentId', '==', studentData.id).get(),
            db.collection('trainer_reviews').where('studentId', '==', studentData.id).get()
        ]);

        allParentPerformances = performancesSnap.docs
            .map(doc => ({id: doc.id, ...doc.data()}))
            .sort((left, right) => new Date(right.date || right.createdAt || 0) - new Date(left.date || left.createdAt || 0));
        allParentComments = commentsSnap.docs
            .map(doc => ({id: doc.id, ...doc.data()}))
            .sort((left, right) => new Date(right.lessonDate || right.createdAt || 0) - new Date(left.lessonDate || left.createdAt || 0));
        allParentTrainerReviews = trainerReviewsSnap.docs
            .map(doc => ({id: doc.id, ...doc.data()}))
            .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0));

        if (!allParentStandards.length) {
            await loadParentStandards();
        }

        updateParentPerformanceSummary();
        renderParentGeneralTrainerReviews();
        renderParentPerformanceCards();
        renderParentTrainerComments();
    } catch (error) {
        console.error('Performans paneli yüklenirken hata:', error);
        document.getElementById('parentPerformancesList').innerHTML = '<div style="padding: 20px; color: #e74c3c;">Performans bilgileri yüklenemedi.</div>';
        document.getElementById('parentTrainerComments').innerHTML = '<div style="padding: 20px; color: #e74c3c;">Antrenör yorumları yüklenemedi.</div>';
        const generalReviews = document.getElementById('parentGeneralTrainerReviews');
        if (generalReviews) {
            generalReviews.innerHTML = '<div style="padding: 20px; color: #e74c3c;">Antrenör değerlendirmeleri yüklenemedi.</div>';
        }
    }
}

function openParentTrainerReviewModal(scopeType, targetId) {
    const context = getParentTrainerReviewContext(scopeType, targetId);
    if (!context) {
        alert('Değerlendirme bilgisi hazırlanamadı.');
        return;
    }

    const existingReview = findExistingParentTrainerReview(scopeType, context.targetId, context);
    window.parentTrainerReviewModalState = {
        ...context,
        reviewId: existingReview?.id || ''
    };

    document.getElementById('parentTrainerReviewModalTitle').textContent = context.title;
    document.getElementById('parentTrainerReviewModalSubtitle').textContent = context.subtitle;
    document.getElementById('parentTrainerReviewComment').value = existingReview?.comment || '';
    document.getElementById('parentTrainerReviewSubmitButton').textContent = existingReview ? 'Değerlendirmeyi Güncelle' : 'Değerlendirmeyi Kaydet';

    const questionScores = existingReview?.questionScores || {};
    document.getElementById('parentTrainerReviewQuestions').innerHTML = PARENT_TRAINER_REVIEW_QUESTIONS.map((question, index) => `
        <div style="padding:16px; border:1px solid #e5e7eb; border-radius:10px; margin-bottom:12px; background:#fff;">
            <div style="font-weight:600; color:#1f2937; margin-bottom:10px;">${index + 1}. ${question.label}</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:8px;">
                ${Object.entries(PARENT_TRAINER_REVIEW_LABELS).map(([score, label]) => `
                    <label style="display:flex; align-items:center; gap:8px; padding:10px 12px; border:1px solid #dbe4ef; border-radius:8px; cursor:pointer; background:#f8fbff;">
                        <input type="radio" name="trainerReview_${question.key}" value="${score}" ${Number(questionScores[question.key]) === Number(score) ? 'checked' : ''}>
                        <span>${score} - ${label}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');

    document.getElementById('parentTrainerReviewModal').classList.add('active');
}

function closeParentTrainerReviewModal() {
    document.getElementById('parentTrainerReviewModal').classList.remove('active');
    const form = document.getElementById('parentTrainerReviewForm');
    if (form) {
        form.reset();
    }
    window.parentTrainerReviewModalState = null;
}

async function saveParentTrainerReview(e) {
    e.preventDefault();

    const modalState = window.parentTrainerReviewModalState;
    if (!modalState || !studentData) {
        alert('Değerlendirme bilgisi bulunamadı.');
        return;
    }

    const questionScores = {};
    for (const question of PARENT_TRAINER_REVIEW_QUESTIONS) {
        const selectedValue = document.querySelector(`input[name="trainerReview_${question.key}"]:checked`);
        if (!selectedValue) {
            alert('Lütfen tüm soruları puanlayın.');
            return;
        }
        questionScores[question.key] = Number(selectedValue.value);
    }

    const averageScore = getParentTrainerReviewAverage({ questionScores });
    const comment = String(document.getElementById('parentTrainerReviewComment').value || '').trim();
    const now = new Date().toISOString();
    const existingReview = modalState.reviewId ? allParentTrainerReviews.find(item => item.id === modalState.reviewId) : null;
    const payload = {
        adminId: studentData.adminId || '',
        branchId: studentData.branchId || '',
        scheduleId: studentData.scheduleId || '',
        studentId: studentData.id,
        studentName: `${studentData.name || ''} ${studentData.surname || ''}`.trim(),
        parentId: currentParent?.id || '',
        parentName: currentParent?.name || 'Veli',
        trainerId: modalState.trainerId || '',
        trainerDocId: modalState.trainerDocId || '',
        trainerName: modalState.trainerName || 'Antrenör',
        scopeType: modalState.scopeType,
        targetId: modalState.targetId,
        scopeKey: modalState.scopeKey,
        lessonCommentId: modalState.lessonCommentId || '',
        lessonDate: modalState.lessonDate || '',
        lessonTopic: modalState.lessonTopic || '',
        questionScores,
        averageScore: roundParentCurrency(averageScore || 0),
        questionCount: PARENT_TRAINER_REVIEW_QUESTIONS.length,
        comment,
        updatedAt: now,
        createdAt: existingReview?.createdAt || now
    };

    try {
        if (modalState.reviewId) {
            await db.collection('trainer_reviews').doc(modalState.reviewId).set(payload, { merge: true });
        } else {
            await db.collection('trainer_reviews').add(payload);
        }

        closeParentTrainerReviewModal();
        await loadParentPerformanceDashboard();
        alert('Antrenör değerlendirmeniz kaydedildi.');
    } catch (error) {
        console.error('Antrenör değerlendirmesi kaydedilirken hata:', error);
        alert('Değerlendirme kaydedilemedi: ' + error.message);
    }
}

function openParentPerformanceModal(cardId) {
    const cache = window.parentPerformanceModalCache || {};
    const modalData = cache[cardId];
    if (!modalData) return;

    document.getElementById('parentPerformanceModalTitle').textContent = modalData.title;
    document.getElementById('parentPerformanceModalContent').innerHTML = modalData.performances.map(item => {
        const status = getParentStandardMatchForPerformance(item);
        return `
            <div style="background: #f9f9f9; border-radius: 8px; padding: 14px; margin-bottom: 12px; border-left: 4px solid ${item.type === 'competition' ? '#e74c3c' : '#3498db'};">
                <div style="display: flex; justify-content: space-between; gap: 10px; align-items: flex-start;">
                    <div>
                        <div style="font-size: 1.25em; font-weight: 700; color: #2c3e50;">${escapeParentStandardText(item.time)}</div>
                        <div style="font-size: 0.9em; color: #7f8c8d; margin-top: 4px;">${new Date(item.date || item.createdAt).toLocaleDateString('tr-TR')} • ${item.type === 'competition' ? 'Yarış' : 'Antrenman'}</div>
                    </div>
                    <div style="text-align: right; font-size: 0.88em;">
                        ${status ? (status.passed
                            ? `<div style="color: #27ae60; font-weight: 600;">${escapeParentStandardText(status.standard.name)} geçildi</div><div style="color: #27ae60;">${formatParentTimeDifference(status.difference)} farkla</div>`
                            : `<div style="color: #c0392b; font-weight: 600;">${escapeParentStandardText(status.standard.name)} kaçtı</div><div style="color: #c0392b;">${formatParentTimeDifference(status.difference)} geride</div>`)
                            : '<div style="color: #95a5a6;">Baraj eşleşmesi yok</div>'}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    document.getElementById('parentPerformanceModal').classList.add('active');
}

function closeParentPerformanceModal() {
    document.getElementById('parentPerformanceModal').classList.remove('active');
}

// ======================== OVERVIEW ========================

function showOverview() {
    if (!studentData) return;
    
    const studentName = `${studentData.name} ${studentData.surname}`;
    const totalAmount = studentData.totalAmount || 0;
    const paidAmount = studentData.totalPaid || 0;
    const remainingAmount = totalAmount - paidAmount;
    const installments = getParentStudentInstallments(studentData);
    
    document.getElementById('studentNameDisplay').textContent = studentName;
    document.getElementById('totalAmountDisplay').textContent = totalAmount.toFixed(2) + ' ₺';
    document.getElementById('paidAmountDisplay').textContent = paidAmount.toFixed(2) + ' ₺';
    document.getElementById('remainingAmountDisplay').textContent = remainingAmount.toFixed(2) + ' ₺';
    
    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">';

    installments.forEach(item => {
        const installmentAmount = roundParentCurrency(item.amount || 0);
        const paidInstallmentAmount = roundParentCurrency(item.paidAmount || 0);
        const remainingInstallmentAmount = Math.max(0, roundParentCurrency(installmentAmount - paidInstallmentAmount));
        const status = remainingInstallmentAmount <= 0.009 ? '✓ Ödendi' : (paidInstallmentAmount > 0 ? 'Kısmi ödendi' : 'Beklemede');
        const statusClass = remainingInstallmentAmount <= 0.009 ? 'badge-success' : 'badge-warning';

        html += `
            <div style="padding: 15px; background: #f9f9f9; border-radius: 5px; border-left: 4px solid ${remainingInstallmentAmount <= 0.009 ? '#27ae60' : '#f39c12'};">
                <strong>Taksit ${item.installmentNumber}</strong><br>
                Tutar: ₺${installmentAmount.toFixed(2)}<br>
                Son Tarih: ${formatParentDateTR(item.dueDate)}<br>
                ${item.paidAt ? `Ödeme Tarihi: ${formatParentDateTR(item.paidAt)}<br>` : ''}
                ${item.lessonLabel ? `Not: ${item.lessonLabel}<br>` : ''}
                <span class="badge ${statusClass}">${status}</span>
            </div>
        `;
    });
    
    html += '</div>';
    document.getElementById('installmentPlan').innerHTML = html;
}

// ======================== PAYMENTS ========================

async function loadPayments() {
    if (!studentData) return;
    
    const tbody = document.getElementById('paymentsTable');
    tbody.innerHTML = '';

    getParentStudentInstallments(studentData).forEach(item => {
        const installmentAmount = roundParentCurrency(item.amount || 0);
        const paidInstallmentAmount = roundParentCurrency(item.paidAmount || 0);
        const remainingInstallmentAmount = Math.max(0, roundParentCurrency(installmentAmount - paidInstallmentAmount));
        const row = document.createElement('tr');
        const statusBadge = remainingInstallmentAmount <= 0.009
            ? '<span class="badge badge-success">Ödendi</span>'
            : '<span class="badge badge-warning">Beklemede</span>';
        const statusText = remainingInstallmentAmount <= 0.009
            ? 'Ödeme tamamlandı'
            : (paidInstallmentAmount > 0 ? `Kısmi • Kalan ₺${remainingInstallmentAmount.toFixed(2)}` : 'Bekleyen ödeme');
        
        row.innerHTML = `
            <td>${item.installmentNumber}</td>
            <td>₺${installmentAmount.toFixed(2)}</td>
            <td>${formatParentDateTR(item.dueDate)}</td>
            <td>${item.paidAt ? formatParentDateTR(item.paidAt) : '-'}</td>
            <td>${statusBadge}<br><small style="color:#6f8091;">${statusText}</small></td>
        `;
        tbody.appendChild(row);
    });
}

// ======================== ATTENDANCE ========================

async function loadAttendance() {
    if (!studentData) return;
    
    try {
        // Get student's schedule
        const schedule = allSchedules.find(s => s.id === studentData.scheduleId);
        const lessonsCount = schedule?.lessonsCount || 8; // Default to 8 if not set
        
        // Get all attendance records for this student
        const attendanceSnap = await db.collection('attendance')
            .where('studentId', '==', studentData.id)
            .get();
        
        // Count present records
        const presentCount = attendanceSnap.docs.filter(doc => doc.data().present === true).length;
        const missedCount = attendanceSnap.docs.filter(doc => doc.data().present === false).length;
        const attendancePercentage = lessonsCount > 0 
            ? Math.round((presentCount / lessonsCount) * 100)
            : 0;
        
        console.log('Attendance calc:', {lessonsCount, presentCount, missedCount, attendancePercentage});
        
        document.getElementById('totalClassCount').textContent = lessonsCount;
        document.getElementById('attendedCount').textContent = presentCount;
        document.getElementById('missedCount').textContent = missedCount;
        document.getElementById('attendancePercentage').textContent = `%${attendancePercentage}`;
        
        // Attendance details
        let html = '<div class="attendance-chart" style="margin-top: 20px;">';
        html += `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div style="padding: 15px; background: #d4edda; border-radius: 5px;">
                    <h3 style="color: #155724; margin-bottom: 10px;">Katılınan Dersler</h3>
                    <p style="font-size: 2em; color: #27ae60; font-weight: bold;">${presentCount}/${lessonsCount}</p>
                </div>
                <div style="padding: 15px; background: #f8d7da; border-radius: 5px;">
                    <h3 style="color: #721c24; margin-bottom: 10px;">Katılmayan Dersler</h3>
                    <p style="font-size: 2em; color: #e74c3c; font-weight: bold;">${missedCount}/${lessonsCount}</p>
                </div>
            </div>
        `;
        
        // Progress bar
        html += `
            <div style="margin-top: 20px;">
                <p style="font-weight: 600; margin-bottom: 8px;">Devam Yüzdesi: %${attendancePercentage}</p>
                <div style="width: 100%; height: 30px; background: #e0e0e0; border-radius: 15px; overflow: hidden;">
                    <div style="width: ${attendancePercentage}%; height: 100%; background: linear-gradient(90deg, #27ae60, #229954); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                        %${attendancePercentage}
                    </div>
                </div>
            </div>
        `;
        
        html += '</div>';
        document.getElementById('attendanceDetails').innerHTML = html;
    } catch (error) {
        console.error('Devam durumu yüklenirken hata:', error);
        document.getElementById('attendanceDetails').innerHTML = '<p style="color: #e74c3c;">Hata: ' + error.message + '</p>';
    }
}

// ======================== ANNOUNCEMENTS ========================

async function loadAnnouncements() {
    const container = document.getElementById('announcementsList');
    container.innerHTML = '';
    
    if (!studentData) return;
    
    // Filter announcements relevant to this student
    const relevantAnnouncements = allAnnouncements.filter(ann => {
        if (ann.target === 'all') return true;
        if (ann.target === 'schedule' && ann.scheduleId === studentData.scheduleId) return true;
        return false;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if (relevantAnnouncements.length === 0) {
        container.innerHTML = '<p style="color: #95a5a6;">Henüz duyuru bulunmamaktadır.</p>';
        return;
    }
    
    relevantAnnouncements.forEach(announcement => {
        const card = document.createElement('div');
        card.style.cssText = 'background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 15px; border-left: 4px solid var(--primary);';
        
        const date = new Date(announcement.createdAt);
        const dateStr = date.toLocaleDateString('tr-TR');
        const timeStr = date.toLocaleTimeString('tr-TR', {hour: '2-digit', minute: '2-digit'});
        
        card.innerHTML = `
            <h3 style="margin-bottom: 10px; color: var(--dark);">${announcement.title}</h3>
            <p style="margin-bottom: 10px; line-height: 1.6;">${announcement.content}</p>
            <small style="color: #95a5a6;">${dateStr} ${timeStr}</small>
        `;
        
        container.appendChild(card);
    });
}

// ======================== WORKOUTS ========================

function buildParentWorkoutExercisesHtml(exercises) {
    if (!Array.isArray(exercises) || !exercises.length) {
        return '<ul style="margin: 10px 0; padding-left: 20px;"><li>Egzersiz bilgisi yok</li></ul>';
    }

    let html = '<ul style="margin: 10px 0; padding-left: 20px;">';
    exercises.forEach(exercise => {
        const reps = exercise.reps ? `${exercise.reps}x` : '';
        const distance = exercise.distance ? `${exercise.distance}m ` : '';
        const style = exercise.style || '-';
        const rest = exercise.restSeconds ? ` (${exercise.restSeconds}s dinlenme)` : '';
        html += `<li>${reps}${distance}${style}${rest}</li>`;
    });
    html += '</ul>';
    return html;
}

function showWorkoutDetails(workoutId, workoutName, exercises, branchName, scheduleTime, workoutDate) {
    const exercisesHtml = buildParentWorkoutExercisesHtml(exercises);
    // Modal oluştur
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;

    modal.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 10px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; color: var(--dark);">${workoutName}</h3>
                <button onclick="this.closest('.workout-modal').remove()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">×</button>
            </div>
            <div style="margin-bottom: 15px;">
                <small style="color: #7f8c8d;">
                    📍 ${branchName} - ${scheduleTime} | 📅 ${workoutDate}
                </small>
            </div>
            <div>
                <h4 style="margin-bottom: 10px; color: var(--dark);">Egzersizler:</h4>
                ${exercisesHtml}
            </div>
        </div>
    `;

    modal.className = 'workout-modal';
    document.body.appendChild(modal);

    // Modal dışına tıklayınca kapat
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

async function loadStudentWorkouts() {
    if (!studentData) return;

    const container = document.getElementById('studentWorkoutsList');

    try {
        // Get student's workouts - try different query approaches
        let workoutsSnap;

        // Sadece studentId ile sorgula - index gerektirmeyen sorgu
        workoutsSnap = await db.collection('student_workouts')
            .where('studentId', '==', studentData.id)
            .get();

        // Manuel sıralama
        const docs = workoutsSnap.docs.sort((a, b) => {
            const dateA = new Date(a.data().createdAt || 0);
            const dateB = new Date(b.data().createdAt || 0);
            return dateB - dateA;
        });
        workoutsSnap = { docs, empty: docs.length === 0 };

        if (workoutsSnap.empty) {
            container.innerHTML = '<p style="color: #95a5a6; padding: 20px; text-align: center;">Henüz antrenman atanmamış.</p>';
            return;
        }

        console.log('Bulunan antrenman sayısı:', workoutsSnap.docs.length);

        let html = '<div style="display: grid; gap: 15px;">';

        for (const doc of workoutsSnap.docs) {
            const swData = doc.data();
            console.log('Student workout data:', swData);

            try {
                const workoutSnap = await db.collection('workouts').doc(swData.workoutId).get();

                if (!workoutSnap.exists) {
                    console.warn('Antrenman belgesi bulunamadı:', swData.workoutId);
                    continue;
                }

                const workout = workoutSnap.data();
                console.log('Workout data:', workout);

                const schedule = allSchedules.find(s => s.id === swData.scheduleId);
                const branch = schedule ? allBranches.find(b => b.id === schedule.branchId) : null;

                const date = new Date(swData.createdAt).toLocaleDateString('tr-TR');

                html += `
                    <div style="padding: 15px; background: #f9f9f9; border-radius: 5px; border-left: 4px solid #3498db; cursor: pointer; transition: all 0.3s;"
                         onclick='showWorkoutDetails(${JSON.stringify(workout.id)}, ${JSON.stringify(workout.name || 'İsimsiz Antrenman')}, ${JSON.stringify(workout.exercises || [])}, ${JSON.stringify(branch ? branch.name : 'Bilinmiyor')}, ${JSON.stringify(schedule ? schedule.time : '-')}, ${JSON.stringify(date)})'>
                        <h4 style="margin: 0; color: var(--dark);">${workout.name || 'İsimsiz Antrenman'}</h4>
                        <small style="color: #666;">Detayları görmek için tıklayın</small>
                    </div>
                `;
            } catch (error) {
                console.error('Antrenman yükleme hatası:', error, swData);
                continue;
            }
        }

        html += '</div>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Antrenmanlar yüklenirken hata:', error);
        container.innerHTML = '<p style="color: #e74c3c; padding: 20px; text-align: center;">Antrenmanlar yüklenemedi. Lütfen sayfayı yenileyin.</p>';
    }
}
// ======================== EVENTS ========================

let allEvents = [];
let currentSelectedDate = null;

async function loadAllEvents() {
    try {
        const adminId = arguments[0] || studentData?.adminId || '';
        const eventsSnap = adminId
            ? await db.collection('events').where('adminId', '==', adminId).get()
            : await db.collection('events').get();
        allEvents = eventsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Etkinlik takvimi oluştur
        renderEventCalendar();
        
        // Tüm etkinlikleri listele
        renderEventsList();
    } catch (error) {
        console.error('Etkinlikler yüklenirken hata:', error);
    }
}

function renderEventCalendar() {
    const calendarContainer = document.getElementById('eventCalendar');
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    let html = `
        <div style="text-align: center;">
            <h4>${new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(now)}</h4>
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; margin-top: 10px;">
    `;
    
    // Günün başlangıcını bul
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    // Gün başlıkları
    const dayNames = ['Pzr', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    dayNames.forEach(day => {
        html += `<div style="font-weight: bold; padding: 5px;">${day}</div>`;
    });
    
    // Takvim günleri
    const currentDate = new Date(startDate);
    while (currentDate <= lastDay) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const hasEvent = allEvents.some(e => e.date === dateStr);
        const isToday = dateStr === now.toISOString().split('T')[0];
        
        const bgColor = hasEvent ? '#ffd700' : isToday ? '#e3f2fd' : '#fff';
        const border = hasEvent ? '2px solid #ff8c00' : isToday ? '2px solid #2196f3' : '1px solid #ddd';
        
        html += `
            <div onclick="selectEventDate('${dateStr}')" 
                 style="padding: 8px; background: ${bgColor}; border: ${border}; border-radius: 3px; cursor: pointer; text-align: center; font-weight: ${hasEvent ? 'bold' : 'normal'};">
                ${currentDate.getDate()}
            </div>
        `;
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    html += '</div></div>';
    calendarContainer.innerHTML = html;
}

function selectEventDate(dateStr) {
    currentSelectedDate = dateStr;
    const eventsOnDate = allEvents.filter(e => e.date === dateStr);
    const container = document.getElementById('selectedDateEvents');
    
    if (eventsOnDate.length === 0) {
        container.innerHTML = '<p style="color: #999;">Bu tarihte etkinlik yok.</p>';
        return;
    }
    
    let html = '<div style="text-align: left;">';
    eventsOnDate.forEach(event => {
        html += `
            <div style="background: #f9f9f9; padding: 10px; border-radius: 5px; margin-bottom: 10px; border-left: 4px solid #2196f3;">
                <h4 style="margin: 0 0 5px 0; color: #2196f3;">${event.name}</h4>
                <p style="margin: 5px 0; font-size: 0.9em;"><strong>📌</strong> ${event.description || 'Açıklama yok'}</p>
                <p style="margin: 5px 0; font-size: 0.9em;"><strong>👥</strong> ${event.type}</p>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

function renderEventsList() {
    const container = document.getElementById('eventsList');
    
    if (allEvents.length === 0) {
        container.innerHTML = '<p style="color: #999;">Henüz etkinlik kaydı yok.</p>';
        return;
    }
    
    // Etkinlikleri tarihe göre sırala
    const sortedEvents = [...allEvents].sort((a, b) => {
        return new Date(a.date) - new Date(b.date);
    });
    
    let html = '<div>';
    
    sortedEvents.forEach(event => {
        const eventDate = new Date(event.date + 'T00:00:00');
        const formattedDate = new Intl.DateTimeFormat('tr-TR', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        }).format(eventDate);
        
        const typeEmoji = {
            'Etkinlik': '📢',
            'Yarışma': '🏆',
            'Kamp': '⛺',
            'Diğer': '📌'
        }[event.type] || '📌';
        
        html += `
            <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 15px; border-left: 4px solid #2196f3;">
                <h3 style="margin: 0 0 10px 0; color: #2196f3;">${typeEmoji} ${event.name}</h3>
                <p style="margin: 5px 0;"><strong>📅 Tarih:</strong> ${formattedDate}</p>
                <p style="margin: 5px 0;"><strong>📝 Tür:</strong> ${event.type}</p>
                <p style="margin: 5px 0;"><strong>📋 Açıklama:</strong> ${event.description || 'Açıklama yok'}</p>
                ${event.location ? `<p style="margin: 5px 0;"><strong>📍 Konum:</strong> ${event.location}</p>` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// ======================== MARKET SYSTEM ========================

function getParentProductCartItem(productId) {
    return parentMarketCart.find(item => item.productId === productId) || null;
}

function getParentCartTotals() {
    return parentMarketCart.reduce((result, item) => {
        const quantity = Number(item.quantity || 0);
        const unitPrice = Number(item.unitPrice || 0);
        result.itemCount += quantity;
        result.totalAmount += quantity * unitPrice;
        return result;
    }, { itemCount: 0, totalAmount: 0 });
}

function buildParentCartPanelHtml() {
    const totals = getParentCartTotals();
    const selectedPaymentMethod = document.getElementById('parentMarketPaymentMethod')?.value || 'cash';
    const cartItemsHtml = parentMarketCart.length
        ? parentMarketCart.map(item => `
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; padding:12px 0; border-bottom:1px solid #eef2f7; flex-wrap:wrap;">
                <div>
                    <div style="font-weight:700; color:#22313f;">${item.productName}</div>
                    <div style="margin-top:4px; color:#6f8091; font-size:0.9em;">₺${Number(item.unitPrice || 0).toFixed(2)} x ${Number(item.quantity || 1)}</div>
                </div>
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <button class="btn btn-secondary btn-sm" onclick="updateParentCartQuantity('${item.productId}', -1)">-</button>
                    <strong>${Number(item.quantity || 1)}</strong>
                    <button class="btn btn-secondary btn-sm" onclick="updateParentCartQuantity('${item.productId}', 1)">+</button>
                    <button class="btn btn-danger btn-sm" onclick="removeParentCartItem('${item.productId}')">Sil</button>
                </div>
            </div>
        `).join('')
        : '<div style="padding:14px; border:1px dashed #d7e1eb; border-radius:10px; color:#8aa0b2; background:#fff;">Sepetiniz bos. Urun kartlarindan ekleme yapabilirsiniz.</div>';

    return `
        <div style="grid-column:1/-1; background:#fff; border:1px solid #e5ebf2; border-radius:16px; padding:18px; box-shadow:0 10px 30px rgba(15,23,42,0.06); margin-bottom:4px;">
            <div style="display:flex; justify-content:space-between; gap:16px; align-items:flex-start; flex-wrap:wrap;">
                <div>
                    <div style="font-size:0.82em; letter-spacing:0.06em; color:#7f8c8d; font-weight:700;">VELI ALISVERIS</div>
                    <h3 style="margin:6px 0 0; color:#22313f;">Sepet ve teslimat bilgileri</h3>
                </div>
                <div style="text-align:right; min-width:180px;">
                    <div style="font-size:0.9em; color:#6f8091;">Toplam kalem</div>
                    <div style="font-size:1.6em; font-weight:800; color:#1d7c54;">${totals.itemCount}</div>
                    <div style="margin-top:4px; color:#22313f; font-weight:700;">₺${totals.totalAmount.toFixed(2)}</div>
                </div>
            </div>
            <div style="margin-top:16px;">${cartItemsHtml}</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-top:16px;">
                <input id="parentMarketPhone" type="text" placeholder="Telefon" value="${currentParent?.phone || ''}" style="padding:12px 14px; border:1px solid #d8e3ee; border-radius:10px;">
                <select id="parentMarketPaymentMethod" onchange="updateParentMarketBankInfo()" style="padding:12px 14px; border:1px solid #d8e3ee; border-radius:10px;">
                    <option value="cash" ${selectedPaymentMethod === 'cash' ? 'selected' : ''}>Nakit</option>
                    <option value="iban" ${selectedPaymentMethod === 'iban' ? 'selected' : ''}>Havale / EFT</option>
                    <option value="credit_card" ${selectedPaymentMethod === 'credit_card' ? 'selected' : ''}>Kredi Karti</option>
                </select>
                <input id="parentMarketInstallment" type="text" placeholder="Taksit tercihi (opsiyonel)" style="padding:12px 14px; border:1px solid #d8e3ee; border-radius:10px;">
            </div>
            <div id="parentMarketBankInfoContainer">${buildParentMarketBankInfoHtml(selectedPaymentMethod)}</div>
            <textarea id="parentMarketAddress" rows="3" placeholder="Teslimat adresi" style="width:100%; margin-top:12px; padding:12px 14px; border:1px solid #d8e3ee; border-radius:10px;"></textarea>
            <textarea id="parentMarketNote" rows="2" placeholder="Siparis notu (opsiyonel)" style="width:100%; margin-top:12px; padding:12px 14px; border:1px solid #d8e3ee; border-radius:10px;"></textarea>
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap; margin-top:14px;">
                <div style="font-size:0.9em; color:#6f8091;">Tek checkout ile tek siparis ve tek bildirim olusturulur.</div>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button class="btn btn-secondary" onclick="clearParentCart()">Sepeti Temizle</button>
                    <button class="btn btn-success" onclick="submitParentMarketCheckout()">Siparisi Tamamla</button>
                </div>
            </div>
        </div>
    `;
}

function addParentProductToCart(product) {
    const existingItem = getParentProductCartItem(product.id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        parentMarketCart.push({
            productId: product.id,
            productName: product.name || 'Urun',
            unitPrice: Number(product.price || 0),
            imageUrl: product.imageUrl || '',
            quantity: 1,
        });
    }
    loadMarketProducts();
}

function addCurrentParentProductToCart() {
    if (!currentMarketInquiryProduct) return;
    addParentProductToCart(currentMarketInquiryProduct);
    closeParentMarketInfoModal();
}

function updateParentCartQuantity(productId, delta) {
    const existingItem = getParentProductCartItem(productId);
    if (!existingItem) return;
    existingItem.quantity = Math.max(1, Number(existingItem.quantity || 1) + Number(delta || 0));
    loadMarketProducts();
}

function removeParentCartItem(productId) {
    parentMarketCart = parentMarketCart.filter(item => item.productId !== productId);
    loadMarketProducts();
}

function clearParentCart() {
    parentMarketCart = [];
    loadMarketProducts();
}

function normalizeParentMarketCardNumber(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 19);
}

function formatParentMarketCardNumber(value) {
    return normalizeParentMarketCardNumber(value).match(/.{1,4}/g)?.join(' ') || '';
}

function formatParentMarketCardExpiry(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) {
        return digits;
    }
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function detectParentMarketCardBrand(cardNumber) {
    const digits = normalizeParentMarketCardNumber(cardNumber);
    if (/^4/.test(digits)) return 'Visa';
    if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
    if (/^3[47]/.test(digits)) return 'American Express';
    if (/^6(?:011|5)/.test(digits)) return 'Discover';
    return 'Bilinmiyor';
}

function buildParentMarketCreditCardHtml() {
    return `
        <div style="margin-top:12px; padding:14px 16px; border:1px solid #ecd9c3; border-radius:12px; background:#fff9f2; color:#22313f;">
            <div style="font-size:0.82em; letter-spacing:0.05em; color:#9a6025; font-weight:700;">KREDI KARTI BILGILERI</div>
            <input id="parentMarketCardHolder" type="text" placeholder="Kart uzerindeki ad soyad" style="width:100%; margin-top:10px; padding:12px 14px; border:1px solid #d8e3ee; border-radius:10px;">
            <input id="parentMarketCardNumber" type="text" inputmode="numeric" maxlength="23" placeholder="Kart numarasi" oninput="this.value = formatParentMarketCardNumber(this.value)" style="width:100%; margin-top:10px; padding:12px 14px; border:1px solid #d8e3ee; border-radius:10px;">
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-top:10px;">
                <input id="parentMarketCardExpiry" type="text" inputmode="numeric" maxlength="5" placeholder="AA/YY" oninput="this.value = formatParentMarketCardExpiry(this.value)" style="padding:12px 14px; border:1px solid #d8e3ee; border-radius:10px;">
                <input id="parentMarketCardCvv" type="password" inputmode="numeric" maxlength="4" placeholder="CVV" oninput="this.value = this.value.replace(/\D/g, '').slice(0, 4)" style="padding:12px 14px; border:1px solid #d8e3ee; border-radius:10px;">
            </div>
            <div style="margin-top:8px; color:#6f8091; font-size:0.9em;">Guvenlik nedeniyle tam kart numarasi ve CVV siparis kaydina yazilmaz; sadece ozet bilgi tutulur.</div>
        </div>
    `;
}

function getParentMarketCardSnapshot() {
    const holderName = document.getElementById('parentMarketCardHolder')?.value?.trim() || '';
    const cardNumber = normalizeParentMarketCardNumber(document.getElementById('parentMarketCardNumber')?.value || '');
    const expiry = formatParentMarketCardExpiry(document.getElementById('parentMarketCardExpiry')?.value || '');
    const cvv = String(document.getElementById('parentMarketCardCvv')?.value || '').replace(/\D/g, '').slice(0, 4);

    if (!holderName) {
        throw new Error('Kart uzerindeki ad soyad gerekli.');
    }
    if (cardNumber.length < 13 || cardNumber.length > 19) {
        throw new Error('Gecerli bir kart numarasi girin.');
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
        throw new Error('Son kullanma tarihini AA/YY formatinda girin.');
    }
    if (cvv.length < 3 || cvv.length > 4) {
        throw new Error('Gecerli bir CVV girin.');
    }

    return {
        cardHolderNameSnapshot: holderName,
        cardLast4Snapshot: cardNumber.slice(-4),
        cardExpirySnapshot: expiry,
        cardBrandSnapshot: detectParentMarketCardBrand(cardNumber),
    };
}

function buildParentMarketBankInfoHtml(paymentMethod = 'cash') {
    if (paymentMethod === 'credit_card') {
        return buildParentMarketCreditCardHtml();
    }
    if (paymentMethod !== 'iban' || !parentMarketBankSettings?.iban) {
        return '';
    }

    return `
        <div style="margin-top:12px; padding:14px 16px; border:1px solid #dce8f5; border-radius:12px; background:#f6fbff; color:#22313f;">
            <div style="font-size:0.82em; letter-spacing:0.05em; color:#5e7a96; font-weight:700;">HAVALE / EFT BILGILERI</div>
            <div style="margin-top:8px;"><strong>Banka:</strong> ${parentMarketBankSettings.bankName || '-'}</div>
            <div style="margin-top:4px;"><strong>Hesap Sahibi:</strong> ${parentMarketBankSettings.accountHolder || '-'}</div>
            <div style="margin-top:4px;"><strong>IBAN:</strong> ${parentMarketBankSettings.iban || '-'}</div>
            ${parentMarketBankSettings.note ? `<div style="margin-top:8px;"><strong>Not:</strong> ${parentMarketBankSettings.note}</div>` : ''}
        </div>
    `;
}

function updateParentMarketBankInfo() {
    const container = document.getElementById('parentMarketBankInfoContainer');
    const paymentMethod = document.getElementById('parentMarketPaymentMethod')?.value || 'cash';
    if (!container) {
        return;
    }
    container.innerHTML = buildParentMarketBankInfoHtml(paymentMethod);
}

async function createParentOrderNotifications(orderId, orderTitle) {
    const superAdminsSnap = await db.collection('users').where('role', '==', 'superadmin').get();
    const notifications = superAdminsSnap.docs.map(doc => db.collection('notifications').add({
        userId: doc.id,
        title: 'Yeni market siparisi',
        message: `${currentParent.name}, ${orderTitle} icin yeni bir siparis olusturdu.`,
        type: 'market_order',
        orderId,
        createdAt: new Date().toISOString(),
        read: false,
    }));
    await Promise.all(notifications);
}

async function submitParentMarketCheckout() {
    if (!parentMarketCart.length) {
        alert('Sepetiniz bos.');
        return;
    }

    const phone = document.getElementById('parentMarketPhone')?.value?.trim() || '';
    const shippingAddress = document.getElementById('parentMarketAddress')?.value?.trim() || '';
    const paymentMethod = document.getElementById('parentMarketPaymentMethod')?.value || 'cash';
    const installmentPreference = document.getElementById('parentMarketInstallment')?.value?.trim() || '';
    const note = document.getElementById('parentMarketNote')?.value?.trim() || '';

    if (!phone || !shippingAddress) {
        alert('Telefon ve teslimat adresi zorunludur.');
        return;
    }

    const items = parentMarketCart.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0),
        imageUrl: item.imageUrl || '',
    }));
    const totals = getParentCartTotals();
    const orderTitle = items.length === 1 ? items[0].productName : `${items.length} urunluk veli sepeti`;

    try {
        let ibanSnapshot = '';
        let bankNameSnapshot = '';
        let accountHolderSnapshot = '';
        let cardHolderNameSnapshot = '';
        let cardLast4Snapshot = '';
        let cardExpirySnapshot = '';
        let cardBrandSnapshot = '';

        if (paymentMethod === 'iban') {
            if (!parentMarketBankSettings) {
                const settingsDoc = await db.collection('app_settings').doc('credit_purchase_bank').get();
                parentMarketBankSettings = settingsDoc.exists ? settingsDoc.data() : null;
            }
            ibanSnapshot = parentMarketBankSettings?.iban || '';
            bankNameSnapshot = parentMarketBankSettings?.bankName || '';
            accountHolderSnapshot = parentMarketBankSettings?.accountHolder || '';
        } else if (paymentMethod === 'credit_card') {
            const cardSnapshot = getParentMarketCardSnapshot();
            cardHolderNameSnapshot = cardSnapshot.cardHolderNameSnapshot;
            cardLast4Snapshot = cardSnapshot.cardLast4Snapshot;
            cardExpirySnapshot = cardSnapshot.cardExpirySnapshot;
            cardBrandSnapshot = cardSnapshot.cardBrandSnapshot;
        }

        const orderRef = await db.collection('orders').add({
            type: 'product_checkout',
            orderTitle,
            items,
            itemCount: totals.itemCount,
            totalAmount: totals.totalAmount,
            paymentMethod,
            status: 'pending',
            buyerId: currentParent.id,
            buyerName: currentParent.name,
            buyerEmail: currentParent.email,
            buyerRole: 'parent',
            buyerPhone: phone,
            shippingAddress,
            installmentPreference,
            adminId: studentData?.adminId || '',
            studentId: studentData?.id || '',
            studentName: studentData ? `${studentData.name || ''} ${studentData.surname || ''}`.trim() : '',
            note,
            ibanSnapshot,
            bankNameSnapshot,
            accountHolderSnapshot,
            cardHolderNameSnapshot,
            cardLast4Snapshot,
            cardExpirySnapshot,
            cardBrandSnapshot,
            createdAt: new Date().toISOString(),
        });

        await createParentOrderNotifications(orderRef.id, orderTitle);
        clearParentCart();
        alert(`Siparisiniz alindi. ${orderTitle} icin tek siparis kaydi olusturuldu.`);
    } catch (error) {
        console.error('Veli checkout hatasi:', error);
        alert('Siparis olusturulamadi: ' + error.message);
    }
}

async function loadMarketProducts() {
    try {
        if (!parentMarketBankSettings) {
            const settingsDoc = await db.collection('app_settings').doc('credit_purchase_bank').get();
            parentMarketBankSettings = settingsDoc.exists ? settingsDoc.data() : null;
        }

        const productsSnap = await db.collection('products').get();
        const products = productsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        allParentMarketProducts = products;
        
        displayMarketProducts(products);
    } catch (error) {
        console.error('Ürünler yüklenirken hata:', error);
    }
}

function displayMarketProducts(products) {
    const container = document.getElementById('marketProducts');
    container.innerHTML = buildParentCartPanelHtml();

    if (products.length === 0) {
        container.innerHTML += '<p style="text-align: center; color: #95a5a6; grid-column: 1/-1; padding: 40px;">Henüz ürün eklenmemiş</p>';
        return;
    }

    products.forEach(product => {
        const cartItem = getParentProductCartItem(product.id);
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
                ${product.imageUrl ? `<img src="${product.imageUrl}" style="max-width: 100%; max-height: 100%; object-fit: cover;">` : '<div style="font-size: 48px; color: #ddd;">📦</div>'}
            </div>
            <div style="padding: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #2c3e50;">${product.name}</h3>
                <p style="color: #27ae60; font-size: 1.5em; font-weight: bold; margin: 10px 0;">₺${product.price.toFixed(2)}</p>
                ${product.description ? `<p style="color: #666; margin: 10px 0; font-size: 0.9em;">${product.description}</p>` : ''}
                <div style="display:flex; gap:10px; margin-top:15px;">
                    <button class="btn btn-secondary" onclick="openParentMarketInfoModal('${product.id}')" style="flex:1;">İncele</button>
                    <button class="btn btn-success" onclick="addParentProductToCart({ id: '${product.id}', name: '${String(product.name).replace(/'/g, '\\&#39;')}', price: ${Number(product.price || 0)}, imageUrl: '${String(product.imageUrl || '').replace(/'/g, '\\&#39;')}' })" style="flex:1;">Sepete Ekle</button>
                </div>
                ${cartItem ? `<div style="margin-top:10px; color:#0f766e; font-size:0.9em; font-weight:700;">Sepette: ${cartItem.quantity} adet</div>` : ''}
            </div>
        `;

        container.appendChild(productCard);
    });
}

function openParentMarketInfoModal(productId) {
    const product = allParentMarketProducts.find(item => item.id === productId);
    const cartItem = parentMarketCart.find(item => item.productId === productId);
    if (!product) return;
    currentMarketInquiryProduct = product;
    document.getElementById('parentMarketInfoTitle').textContent = currentMarketInquiryProduct.name || 'Urun Detayi';
    document.getElementById('parentMarketInfoText').textContent = currentMarketInquiryProduct.description || 'Bu urun icin aciklama girilmemis.';
    document.getElementById('parentMarketInfoMeta').textContent = `Fiyat: ₺${Number(currentMarketInquiryProduct.price || 0).toFixed(2)}${cartItem ? ` • Sepette ${cartItem.quantity} adet var` : ''}`;
    document.getElementById('parentMarketInfoModal').classList.add('active');
}

function closeParentMarketInfoModal() {
    document.getElementById('parentMarketInfoModal').classList.remove('active');
}

async function connectParentToSuperAdminFromMarket() {
    addCurrentParentProductToCart();
}

// ======================== CHAT SYSTEM ========================

let activeChatId = null;
let chatUnsub = null;

// Load chat list
async function loadChatList() {
    const container = document.getElementById('chatListContainer');
    if (!container) return;
    container.innerHTML = '<p style="color: #95a5a6;">Yükleniyor...</p>';

    try {
        // Get all chats where parent is a participant
        const chatsSnap = await db.collection('chats')
            .where('userIds', 'array-contains', currentParent.id)
            .orderBy('createdAt', 'desc')
            .get();

        if (chatsSnap.empty) {
            container.innerHTML = '<p style="color: #95a5a6; text-align: center;">Henüz sohbet yok.</p>';
            return;
        }

        let html = '';
        chatsSnap.forEach(doc => {
            const chat = doc.data();
            const chatId = doc.id;
            let title = '';
            let subtitle = '';

            if (chat.type === 'group') {
                title = chat.groupName || 'Grup Sohbeti';
                subtitle = `${chat.userIds.length} üye`;
            } else if (chat.type === 'credit-purchase') {
                title = 'Kredi Satın Alma';
                subtitle = 'Sistem';
            } else {
                // Direct chat: find other participant's name
                const otherId = chat.userIds.find(uid => uid !== currentParent.id);
                if (chat.users && chat.users[otherId]) {
                    title = chat.users[otherId].name;
                    subtitle = chat.users[otherId].role === 'trainer' ? 'Antrenör' :
                              chat.users[otherId].role === 'admin' ? 'Yönetici' :
                              chat.users[otherId].role === 'secretary' ? 'Sekreter' : 'Kullanıcı';
                } else {
                    title = 'Birebir Sohbet';
                    subtitle = 'Kullanıcı';
                }
            }

            html += `<div class="chat-list-item" style="padding: 12px; border-bottom: 1px solid #eee; cursor: pointer; transition: background 0.2s;" onclick="openChatView('${chatId}', '${title.replace(/'/g, '\\\'')}')">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <strong style="color: #2c3e50;">${title}</strong><br>
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
        document.getElementById('chatListContainer').innerHTML = '<p style="color: #e74c3c;">Sohbetler yüklenemedi.</p>';
    }
}

// Open chat view
function openChatView(chatId, title) {
    // Switch to chat view page
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.getElementById('chat-view-page').classList.add('active');

    document.getElementById('chatViewTitle').textContent = `💬 ${title}`;
    activeChatId = chatId;

    loadChatMessages(chatId);
}

// Close chat view and return to chat list
function closeChatView() {
    document.getElementById('chat-view-page').classList.remove('active');
    document.getElementById('chat-page').classList.add('active');

    if (chatUnsub) {
        chatUnsub();
        chatUnsub = null;
    }
    activeChatId = null;
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
                    const isOwnMessage = message.senderId === currentParent.id;
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
            senderId: currentParent.id,
            senderName: currentParent.name,
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

    const newChatForm = document.getElementById('newChatEmailForm');
    const chatEmailInput = document.getElementById('chatEmailInput');
    if (newChatForm) newChatForm.onsubmit = submitNewChatByEmail;
    if (chatEmailInput) chatEmailInput.oninput = chatEmailLookupUser;
}

// Close new chat email page
function closeNewChatEmailPage() {
    document.getElementById('new-chat-email-page').classList.remove('active');
    document.getElementById('chat-page').classList.add('active');

    document.getElementById('newChatEmailForm').reset();
    document.getElementById('chatEmailUserInfo').textContent = '';
}

// Email lookup for new chat
async function chatEmailLookupUser(e) {
    const email = e.target.value.trim().toLowerCase();
    const infoDiv = document.getElementById('chatEmailUserInfo');
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
async function submitNewChatByEmail(e) {
    e.preventDefault();

    const email = document.getElementById('chatEmailInput').value.trim().toLowerCase();
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
        .where('userIds', 'array-contains', currentParent.id)
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
            userIds: [currentParent.id, userId],
            users: {
                [currentParent.id]: { name: currentParent.name, role: 'parent' },
                [userId]: { name: userName, role: userRole }
            },
            type: 'direct',
            createdAt: new Date().toISOString()
        });
        chatId = chatDoc.id;
    }

    closeNewChatEmailPage();
    openChatView(chatId, userName);
}

// Open new group chat modal
function openNewGroupChatModal() {
    document.getElementById('newGroupChatModal').style.display = 'flex';
    const groupForm = document.getElementById('newGroupChatForm');
    if (groupForm) groupForm.onsubmit = submitNewGroupChat;
}

// Close new group chat modal
function closeNewGroupChatModal() {
    document.getElementById('newGroupChatModal').style.display = 'none';
    document.getElementById('newGroupChatForm').reset();
}

function openPasswordModal() {
    const modal = document.getElementById('passwordModal');
    if (modal) modal.style.display = 'flex';
}

function closePasswordModal() {
    const modal = document.getElementById('passwordModal');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('passwordForm');
    if (form) form.reset();
}

function openEmailModal() {
    const modal = document.getElementById('emailModal');
    if (modal) modal.style.display = 'flex';
}

function closeEmailModal() {
    const modal = document.getElementById('emailModal');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('emailForm');
    if (form) form.reset();
}

async function submitPasswordChange(e) {
    e.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        alert('Yeni sifre ve tekrar sifresi ayni olmali.');
        return;
    }

    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Kullanici oturumu bulunamadi.');

        const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
        await user.reauthenticateWithCredential(credential);
        await user.updatePassword(newPassword);

        closePasswordModal();
        alert('Sifre basariyla guncellendi.');
    } catch (error) {
        console.error('Sifre guncelleme hatasi:', error);
        alert('Sifre guncellenemedi: ' + error.message);
    }
}

async function submitEmailChange(e) {
    e.preventDefault();

    const newEmail = document.getElementById('newEmail').value.trim().toLowerCase();
    const password = document.getElementById('emailPassword').value;

    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Kullanici oturumu bulunamadi.');

        const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
        await user.reauthenticateWithCredential(credential);
        await user.updateEmail(newEmail);

        await db.collection('users').doc(currentParent.id).update({ email: newEmail });

        currentParent.email = newEmail;
        sessionStorage.setItem('user_email', newEmail);
        loadProfileInfo();

        closeEmailModal();
        alert('E-posta basariyla guncellendi.');
    } catch (error) {
        console.error('E-posta guncelleme hatasi:', error);
        alert('E-posta guncellenemedi: ' + error.message);
    }
}

// Submit new group chat
async function submitNewGroupChat(e) {
    e.preventDefault();

    const groupName = document.getElementById('groupChatName').value.trim();
    const emailsRaw = document.getElementById('groupChatUserEmails').value.trim();

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

    // Add current parent's email if not present
    if (!emails.includes(currentParent.email)) {
        emails.push(currentParent.email);
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
            createdAt: new Date().toISOString()
        });

        closeNewGroupChatModal();
        openChatView(chatDoc.id, groupName);
        loadChatList(); // Refresh chat list
    } catch (error) {
        console.error('Grup sohbeti oluşturulurken hata:', error);
        alert('Grup sohbeti oluşturulamadı: ' + error.message);
    }
}

// Add event listeners for chat forms
document.addEventListener('DOMContentLoaded', () => {
    // Existing form listeners...

    // Chat form listeners
    const chatForm = document.getElementById('chatForm');
    if (chatForm) {
        chatForm.addEventListener('submit', sendChatMessage);
    }

    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', submitPasswordChange);
    }

    const emailForm = document.getElementById('emailForm');
    if (emailForm) {
        emailForm.addEventListener('submit', submitEmailChange);
    }
});
