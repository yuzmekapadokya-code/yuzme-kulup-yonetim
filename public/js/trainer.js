// Trainer Dashboard & Chronometer JavaScript

let currentTrainer = null;
let allSchedules = [];
let allBranches = [];
let allStudents = [];
let allWorkouts = [];
let currentUserCredits = 0;
let currentCreditPurchaseSettings = null;
let selectedCreditPackage = null;
let trainerMarketCart = [];
let allTrainerMarketProducts = [];
window.getTrainerAiContext = function getTrainerAiContext() {
    return {
        currentTrainer,
        allSchedules,
        allBranches,
        allStudents,
        allWorkouts
    };
};
window.refreshTrainerWorkoutViews = async function refreshTrainerWorkoutViews() {
    await loadAllData();
    loadWorkouts();
};
const AVAILABILITY_SLOT_OPTIONS = Array.from({ length: 18 }, (_, index) => {
    const hour = 6 + index;
    return `${String(hour).padStart(2, '0')}:00`;
});
const AVAILABILITY_DAY_OPTIONS = [
    { key: 'monday', label: 'Pazartesi' },
    { key: 'tuesday', label: 'Salı' },
    { key: 'wednesday', label: 'Çarşamba' },
    { key: 'thursday', label: 'Perşembe' },
    { key: 'friday', label: 'Cuma' },
    { key: 'saturday', label: 'Cumartesi' },
    { key: 'sunday', label: 'Pazar' }
];

// Chronometer variables
let currentWorkout = null;
let currentExerciseIndex = 0;
let isRunning = false;
let isPaused = false;
let chronometerTime = 0;
let chronometerInterval = null;
let isRestTime = false;
let restTime = 0;
let restInterval = null;
let activeWorkoutRef = null;
let activeWorkoutListener = null;
let touchBlockingEnabled = false;
let postponeLessonModalState = {
    scheduleId: '',
    eligibleDates: [],
    availableMonthKeys: [],
    monthIndex: 0,
    selectedDate: ''
};

function formatTryCurrency(amount) {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(amount || 0));
}

function getScheduleLessonCount(schedule) {
    const lessonsCount = Number(schedule?.lessonsCount);
    return Number.isFinite(lessonsCount) && lessonsCount > 0 ? lessonsCount : 1;
}

function getScheduleLessonType(schedule) {
    return schedule?.lessonType === 'private' ? 'private' : 'group';
}

function getScheduleLessonTypeLabel(schedule) {
    return getScheduleLessonType(schedule) === 'private' ? 'Özel Ders' : 'Grup Dersi';
}

function getSchedulePostponements(schedule) {
    if (Array.isArray(schedule?.postponements)) {
        return schedule.postponements.filter(Boolean);
    }

    const fallbackCount = Number(schedule?.postponementCount || 0);
    return Number.isFinite(fallbackCount) && fallbackCount > 0
        ? Array.from({ length: fallbackCount }, (_, index) => ({ id: `legacy_${index + 1}` }))
        : [];
}

function getSchedulePostponementCount(schedule) {
    return getSchedulePostponements(schedule).length;
}

function buildTrainerAttendanceLessonCountMap(records = []) {
    const latestRecordMap = {};
    const latestTimestampMap = {};

    records.forEach(record => {
        const lessonNumber = Number(record?.lessonNumber);
        if (!record?.studentId || !record?.scheduleId || !Number.isFinite(lessonNumber)) {
            return;
        }

        const lessonKey = `${record.studentId}_${record.scheduleId}_${lessonNumber}`;
        const recordTimestamp = getAttendanceRecordTimestamp(record);
        if (!Object.prototype.hasOwnProperty.call(latestTimestampMap, lessonKey) || recordTimestamp >= latestTimestampMap[lessonKey]) {
            latestTimestampMap[lessonKey] = recordTimestamp;
            latestRecordMap[lessonKey] = record;
        }
    });

    return Object.values(latestRecordMap).reduce((accumulator, record) => {
        const progressKey = `${record.studentId}_${record.scheduleId}`;
        accumulator[progressKey] = (accumulator[progressKey] || 0) + 1;
        return accumulator;
    }, {});
}

function normalizeScheduleTrainerAssignments(schedule) {
    if (Array.isArray(schedule?.trainerAssignments) && schedule.trainerAssignments.length) {
        return schedule.trainerAssignments.filter(Boolean);
    }

    if (!schedule?.trainerId) {
        return [];
    }

    return [{
        trainerId: schedule.trainerId,
        trainerDocId: schedule.trainerDocId || '',
        trainerName: schedule.trainerName || '',
        role: 'head',
        trainerRate: Number.isFinite(Number(schedule?.trainerRate)) ? Number(schedule.trainerRate) : null,
        trainerPaymentDetails: Array.isArray(schedule?.trainerPaymentDetails) ? schedule.trainerPaymentDetails : [],
        trainerPaymentStatus: schedule?.trainerPaymentStatus === 'paid' ? 'paid' : 'pending'
    }];
}

function getCurrentTrainerAssignment(schedule) {
    return normalizeScheduleTrainerAssignments(schedule).find(assignment => {
        return assignment?.trainerId === currentTrainer?.id
            || assignment?.trainerId === currentTrainer?.docId
            || assignment?.trainerDocId === currentTrainer?.docId
            || assignment?.trainerDocId === currentTrainer?.id;
    }) || null;
}

function scheduleBelongsToCurrentTrainer(schedule) {
    return Boolean(getCurrentTrainerAssignment(schedule));
}

function getNormalizedScheduleDays(schedule) {
    if (Array.isArray(schedule?.days) && schedule.days.length) {
        return schedule.days.map(day => String(day).trim()).filter(Boolean);
    }
    if (typeof schedule?.day === 'string' && schedule.day.trim()) {
        return [schedule.day.trim()];
    }
    return ['monday'];
}

function formatTrainerScheduleDays(schedule) {
    return getNormalizedScheduleDays(schedule)
        .map(day => getTrainerAvailabilityDayLabel(day))
        .join(', ');
}

function buildTrainerPaymentDetails(schedule) {
    const assignment = getCurrentTrainerAssignment(schedule);
    const lessonsCount = getScheduleLessonCount(schedule);
    const fallbackStatus = assignment?.trainerPaymentStatus === 'paid'
        ? 'paid'
        : schedule?.trainerPaymentStatus === 'paid' ? 'paid' : 'pending';
    const existing = Array.isArray(assignment?.trainerPaymentDetails)
        ? assignment.trainerPaymentDetails
        : [];

    return Array.from({ length: lessonsCount }, (_, index) => ({
        lessonNumber: index + 1,
        status: existing[index]?.status === 'paid' ? 'paid' : fallbackStatus
    }));
}

function calculateTrainerSalarySummary() {
    const salaryRows = allSchedules.map(schedule => {
        const branch = allBranches.find(item => item.id === schedule.branchId);
        const lessonsCount = getScheduleLessonCount(schedule);
        const assignment = getCurrentTrainerAssignment(schedule);
        const hasConfiguredRate = Number.isFinite(Number(schedule?.trainerRate));
        const assignmentHasRate = Number.isFinite(Number(assignment?.trainerRate));
        const trainerRate = assignmentHasRate
            ? Number(assignment.trainerRate)
            : hasConfiguredRate ? Number(schedule.trainerRate) : null;
        const paymentDetails = buildTrainerPaymentDetails(schedule);
        const paidLessons = paymentDetails.filter(item => item.status === 'paid').length;
        const pendingLessons = Math.max(0, lessonsCount - paidLessons);
        const totalSalary = trainerRate !== null ? lessonsCount * trainerRate : 0;
        const paidAmount = trainerRate !== null ? paidLessons * trainerRate : 0;
        const pendingAmount = trainerRate !== null ? pendingLessons * trainerRate : 0;

        return {
            id: schedule.id,
            branchName: branch ? branch.name : 'Bilinmiyor',
            time: schedule.time || '-',
            lessonsCount,
            hasConfiguredRate: trainerRate !== null,
            trainerRate,
            totalSalary,
            paidLessons,
            pendingLessons,
            paidAmount,
            pendingAmount
        };
    });

    const totalLessons = salaryRows.reduce((sum, row) => sum + row.lessonsCount, 0);
    const estimatedSalary = salaryRows.reduce((sum, row) => sum + row.totalSalary, 0);
    const configuredRows = salaryRows.filter(row => row.hasConfiguredRate);
    const uniqueRates = [...new Set(configuredRows.map(row => row.trainerRate.toFixed(2)))];
    const paidAmount = configuredRows.reduce((sum, row) => sum + row.paidAmount, 0);
    const pendingAmount = configuredRows.reduce((sum, row) => sum + row.pendingAmount, 0);
    let displayRateText = 'Tanımsız';

    if (configuredRows.length === 1 && uniqueRates.length === 1 && salaryRows.length === 1) {
        displayRateText = formatTryCurrency(configuredRows[0].trainerRate);
    } else if (configuredRows.length && uniqueRates.length === 1) {
        displayRateText = formatTryCurrency(configuredRows[0].trainerRate);
    } else if (configuredRows.length) {
        displayRateText = `${configuredRows.length} ders tanımlı`;
    }

    return {
        hasConfiguredRate: configuredRows.length > 0,
        displayRateText,
        totalLessons,
        estimatedSalary,
        paidAmount,
        pendingAmount,
        salaryRows
    };
}

function renderTrainerSalarySummary() {
    const hourlyRateElement = document.getElementById('trainerHourlyRate');
    const estimatedSalaryElement = document.getElementById('trainerEstimatedSalary');
    const salarySummaryContainer = document.getElementById('salarySummaryContainer');

    if (!hourlyRateElement || !estimatedSalaryElement || !salarySummaryContainer) {
        return;
    }

    const salarySummary = calculateTrainerSalarySummary();
    hourlyRateElement.textContent = salarySummary.displayRateText;
    estimatedSalaryElement.textContent = formatTryCurrency(salarySummary.estimatedSalary);

    if (!salarySummary.hasConfiguredRate) {
        salarySummaryContainer.innerHTML = `
            <div style="padding: 16px; border-radius: 12px; background: #fff8e8; border: 1px solid #f5deb0; color: #7d5a11;">
                Ders bazlı maaşınız henüz tanımlanmamış. Normal admin panelinden her ders için ücret girildiğinde burada otomatik hesaplama görünecek.
            </div>
        `;
        return;
    }

    const breakdownHtml = salarySummary.salaryRows.length
        ? salarySummary.salaryRows.map(item => `
            <div class="salary-breakdown-item">
                <div class="salary-breakdown-meta">
                    <strong>${item.branchName} - ${item.time}</strong>
                    <small>${item.hasConfiguredRate ? `${item.lessonsCount} ders x ${formatTryCurrency(item.trainerRate)}` : 'Maaş tanımlanmadı'}</small>
                </div>
                <span>${item.lessonsCount} ders</span>
                <span>${item.hasConfiguredRate ? formatTryCurrency(item.trainerRate) : '-'}</span>
                <span>${item.hasConfiguredRate ? formatTryCurrency(item.totalSalary) : '-'}</span>
                <span class="badge ${item.pendingLessons === 0 ? 'badge-success' : 'badge-warning'}">${item.paidLessons}/${item.lessonsCount} ödendi</span>
            </div>
        `).join('')
        : '<div style="padding: 16px; border-radius: 12px; background: #f8fbff; border: 1px solid #d8e9fb; color: #607284;">Henüz üzerinize atanmış ders saati bulunmuyor.</div>';

    salarySummaryContainer.innerHTML = `
        <div class="salary-summary-grid">
            <div class="salary-summary-item">
                <strong>Ders Ücretleri</strong>
                <span>${salarySummary.displayRateText}</span>
            </div>
            <div class="salary-summary-item">
                <strong>Toplam Ders Adedi</strong>
                <span>${salarySummary.totalLessons}</span>
            </div>
            <div class="salary-summary-item">
                <strong>Tahmini Toplam Kazanç</strong>
                <span>${formatTryCurrency(salarySummary.estimatedSalary)}</span>
            </div>
            <div class="salary-summary-item">
                <strong>Ödendi</strong>
                <span>${formatTryCurrency(salarySummary.paidAmount)}</span>
            </div>
            <div class="salary-summary-item">
                <strong>Bekleyen</strong>
                <span>${formatTryCurrency(salarySummary.pendingAmount)}</span>
            </div>
        </div>
        <div class="salary-breakdown-list">${breakdownHtml}</div>
    `;
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

// Chat variables
let chatUnsub = null;
let activeChatId = null;
let activeSuperAdminChatId = null;
let superAdminChatUnsub = null;

// Notification variables
let notificationUnsub = null;

// Notification functions
function showNotification(message, title = 'Yeni Mesaj') {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: message,
            icon: '../images/logo.svg'
        });
    }
}

async function requestNotificationPermission() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }
    return false;
}

function setupNotificationListeners(chatDocs) {
    chatDocs.forEach(doc => {
        const chatId = doc.id;
        const chat = doc.data();

        // Listen for new messages in this chat
        db.collection('chats').doc(chatId).collection('messages')
            .where('senderId', '!=', currentTrainer.id)
            .onSnapshot((snapshot) => {
                const newMessages = snapshot.docChanges().filter(change =>
                    change.type === 'added' && change.doc.data().senderId !== currentTrainer.id
                );

                if (newMessages.length > 0 && activeChatId !== chatId) {
                    // Show notification
                    const lastMessage = newMessages[newMessages.length - 1].doc.data();
                    const senderName = lastMessage.senderName;
                    const messageText = lastMessage.text.length > 50 ? lastMessage.text.substring(0, 50) + '...' : lastMessage.text;

                    let title = 'Yeni Mesaj';
                    if (chat.type === 'group') {
                        title = `${chat.groupName} - ${senderName}`;
                    } else {
                        title = senderName;
                    }

                    showNotification(messageText, title);

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

// Check authentication
let notificationPermissionRequested = false;

window.addEventListener('load', async () => {
    const userId = sessionStorage.getItem('user_id');
    const role = sessionStorage.getItem('user_role');
    
    if (!userId || role !== 'trainer') {
        window.location.href = '../index.html';
        return;
    }
    
    currentTrainer = {
        id: userId,
        name: sessionStorage.getItem('user_name'),
        email: sessionStorage.getItem('user_email')
    };
    
    document.getElementById('userName').textContent = currentTrainer.name;
    document.getElementById('userAvatar').textContent = currentTrainer.name.charAt(0).toUpperCase();
    
    // Load initial data
    await loadAllData();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Request notification permission on first user interaction
    document.addEventListener('click', () => {
        if (!notificationPermissionRequested) {
            notificationPermissionRequested = true;
            requestNotificationPermission().catch(err => console.log('Notification permission error:', err));
        }
    }, { once: true });

    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            switchPage(page);
        });
    });

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await auth.signOut();
                sessionStorage.clear();
                window.location.href = '../index.html';
            } catch (error) {
                alert('Çıkış yapılırken hata: ' + error.message);
            }
        });
    }

    // Workout form
    const workoutForm = document.getElementById('workoutForm');
    if (workoutForm) {
        workoutForm.addEventListener('submit', saveWorkout);
    }

    // Sell workout form
    const sellWorkoutForm = document.getElementById('sellWorkoutForm');
    if (sellWorkoutForm) {
        sellWorkoutForm.addEventListener('submit', sellWorkout);
    }

    const trainerCommentForm = document.getElementById('trainerCommentForm');
    if (trainerCommentForm) {
        trainerCommentForm.addEventListener('submit', saveTrainerComment);
    }

    const manualCreditPurchaseForm = document.getElementById('manualCreditPurchaseForm');
    if (manualCreditPurchaseForm) {
        manualCreditPurchaseForm.addEventListener('submit', submitManualCreditPurchase);
    }

    // Performance report branch filter
    const reportBranchFilter = document.getElementById('reportBranchFilter');
    if (reportBranchFilter) {
        reportBranchFilter.addEventListener('change', updateReportScheduleFilter);
    }

    const reportScheduleFilter = document.getElementById('reportScheduleFilter');
    if (reportScheduleFilter) {
        reportScheduleFilter.addEventListener('change', updateReportStudentFilter);
    }
    
    // Performance input branch filter
    const perfBranchFilter = document.getElementById('perfBranchFilter');
    if (perfBranchFilter) {
        perfBranchFilter.addEventListener('change', updatePerfScheduleFilter);
    }

    const performanceStyle = document.getElementById('performanceStyle');
    if (performanceStyle) {
        performanceStyle.addEventListener('change', updateDistanceOptions);
    }

    if (window.trainerAiPage && typeof window.trainerAiPage.setup === 'function') {
        window.trainerAiPage.setup();
    }
}

// Update credit display in UI
function updateCreditDisplay() {
    const creditElements = document.querySelectorAll('.user-credits');
    creditElements.forEach(element => {
        element.textContent = currentUserCredits.toLocaleString('tr-TR');
    });
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Dosya okunamadı.'));
        reader.readAsDataURL(file);
    });
}

function getStudentBirthYear(student) {
    if (!student) return null;
    if (student.birthYear) return Number(student.birthYear);
    if (student.age) return new Date().getFullYear() - Number(student.age);
    return null;
}

function getStudentAge(student) {
    const birthYear = getStudentBirthYear(student);
    if (!birthYear) return null;
    return new Date().getFullYear() - birthYear;
}

function normalizePerformanceStyleToStandard(style) {
    const map = {
        'Serbest': 'Serbest',
        'Sırt': 'Sırtüstü',
        'Kurbağa': 'Kurbağalama',
        'Kelebek': 'Kelebekçe',
        'Karışık': 'Karma'
    };

    return map[style] || style;
}

function sortPerformancesByRecency(performances) {
    return [...performances].sort((a, b) => {
        const dateDelta = new Date(b.date) - new Date(a.date);
        if (dateDelta !== 0) return dateDelta;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
}

function getClosestPreviousPerformance(groupPerfs) {
    const chronological = sortPerformancesByRecency(groupPerfs);
    return {
        latest: chronological[0] || null,
        previous: chronological[1] || null,
        chronological
    };
}

function getTrainerReadableStandardReference(standard, style, distance) {
    const title = getTrainerReadableStandardTitle(standard);
    return `${title} • ${standard.gender || '-'} • ${style} ${distance}m`;
}

// Load credit balance with real-time updates
async function loadCreditBalance() {
    try {
        const creditRef = db.collection('user_credits').doc(currentTrainer.id);

        // First, ensure the document exists
        const doc = await creditRef.get();
        if (!doc.exists) {
            await creditRef.set({
                balance: 0,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            });
        }

        // Set up real-time listener for credit balance updates
        creditRef.onSnapshot((doc) => {
            const creditData = doc.data() || {};
            currentUserCredits = creditData.balance || 0;
            currentTrainer.credits = currentUserCredits;
            currentTrainer.blockedCredits = creditData.blockedCredits || 0;
            updateCreditDisplay();
        });

    } catch (error) {
        console.error('Kredi bakiyesi yüklenirken hata:', error);
    }
}

async function changeUserCreditBalance(userId, delta, description, type, referenceId = null, extraFields = {}) {
    const creditRef = db.collection('user_credits').doc(userId);
    let balanceAfter = 0;

    await db.runTransaction(async transaction => {
        const creditDoc = await transaction.get(creditRef);
        const currentBalance = creditDoc.exists ? Number(creditDoc.data().balance || 0) : 0;
        const nextBalance = currentBalance + Number(delta);

        if (nextBalance < 0) {
            throw new Error('Yetersiz kredi bakiyesi.');
        }

        balanceAfter = nextBalance;
        transaction.set(creditRef, {
            balance: nextBalance,
            lastUpdated: new Date().toISOString()
        }, { merge: true });
    });

    await db.collection('credit_transactions').add({
        userId,
        amount: Number(delta),
        type,
        description,
        referenceId,
        timestamp: new Date().toISOString(),
        balanceAfter,
        ...extraFields
    });

    if (userId === currentTrainer.id) {
        currentUserCredits = balanceAfter;
        currentTrainer.credits = balanceAfter;
        updateCreditDisplay();
    }

    return balanceAfter;
}

// Load all data
async function loadAllData() {
    try {
        // İlk olarak antrenörün yöneticisini (adminId) bulmalıyız
        let adminId = null;
        const trainerDocSnap = await db.collection('trainers').where('uid', '==', currentTrainer.id).limit(1).get();

        if (!trainerDocSnap.empty) {
            const trainerData = trainerDocSnap.docs[0].data();
            adminId = trainerData.adminId;
            currentTrainer.adminId = adminId; // currentTrainer'a adminId ekle
            currentTrainer.docId = trainerDocSnap.docs[0].id; // trainer document ID'yi sakla
        } else {
            // Fallback: bazen trainers dokümanı UID yerine doküman ID olarak saklanmış olabilir
            const trainerById = await db.collection('trainers').doc(currentTrainer.id).get();
            if (trainerById.exists) {
                const trainerData = trainerById.data();
                adminId = trainerData.adminId;
                currentTrainer.adminId = adminId;
                currentTrainer.docId = trainerById.id;
            }
        }

        if (!adminId) {
            console.error('Antrenörün yöneticisi bulunamadı!');
            return;
        }

        const trainerDocId = !trainerDocSnap.empty ? trainerDocSnap.docs[0].id : currentTrainer.docId;

        let workoutsQuery = db.collection('workouts').where('trainerId', '==', currentTrainer.id);
        if (adminId) workoutsQuery = workoutsQuery.where('adminId', '==', adminId);

        const [schedulesSnap, branchesSnap, studentsSnap, workoutsSnap] = await Promise.all([
            db.collection('schedules')
                .where('adminId', '==', adminId)
                .get(),
            db.collection('branches').where('adminId', '==', adminId).get(),
            db.collection('students').where('adminId', '==', adminId).get(),
            workoutsQuery.get(),
            loadClubProfile(),
            loadCreditBalance(),
            loadStandards()
        ]);

        const schedules = schedulesSnap.docs
            .map(doc => ({id: doc.id, ...doc.data()}))
            .filter(schedule => scheduleBelongsToCurrentTrainer({
                ...schedule,
                trainerDocId: schedule.trainerDocId || trainerDocId
            }));

        allSchedules = schedules;
        allBranches = branchesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        allStudents = studentsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })).filter(student => allSchedules.some(schedule => schedule.id === student.scheduleId));

        allWorkouts = workoutsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        showDashboard();
    } catch (error) {
        console.error('Veri yüklenirken hata:', error);
    }
}

// Switch page
function switchPage(pageName) {
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const pageElement = document.getElementById(pageName + '-page');
    if (pageElement) {
        pageElement.classList.add('active');
        requestAnimationFrame(() => scrollMainContentToTop(pageElement));
    }

    const activeNavLink = document.querySelector(`[data-page="${pageName}"]`);
    if (activeNavLink) activeNavLink.classList.add('active');
    
    const titles = {
        'dashboard': 'Dashboard',
        'classes': 'Dersler',
        'attendance': 'Yoklama',
        'chronometer': 'Antrenman Ekranı',
        'students': 'Öğrenciler',
        'performance': 'Derece Girişi',
        'performance-report': '📊 Performans Raporu',
        'standards': '🎯 Barajlar',
        'sell-workouts': 'Antrenman Sat',
        'buy-workouts': 'Antrenman Satın Al',
        'market': '🛒 Market (Kredi)',
        'credit-request': 'Kredi Talep Et',
        'cash-withdrawal': '💸 Kredileri Bozdur',
        'ai-workout': 'Yapay Zeka Antrenman',
        'chat': 'Sohbet'
    };
    
    document.getElementById('pageTitle').textContent = titles[pageName] || 'Dashboard';
    
    if (pageName === 'classes') {
        loadClasses();
    } else if (pageName === 'attendance') {
        loadAttendanceSchedules();
    } else if (pageName === 'chronometer') {
        loadChronometerWorkouts();
    } else if (pageName === 'students') {
        loadStudents();
    } else if (pageName === 'performance') {
        initializePerformanceInputDropdowns();
        loadPerformanceStudents();
    } else if (pageName === 'performance-report') {
        initializePerformanceReportDropdowns();
        loadPerformanceReport();
    } else if (pageName === 'standards') {
        loadStandards();
    } else if (pageName === 'sell-workouts') {
        loadSellWorkouts();
    } else if (pageName === 'buy-workouts') {
        loadBuyWorkouts();
    } else if (pageName === 'market') {
        loadTrainerMarket();
    } else if (pageName === 'credit-request') {
        loadCreditPackages();
    } else if (pageName === 'cash-withdrawal') {
        loadExchangeRateTrainer();
        loadWithdrawalBalance();
    } else if (pageName === 'ai-workout') {
        if (window.trainerAiPage && typeof window.trainerAiPage.load === 'function') {
            window.trainerAiPage.load();
        }
    } else if (pageName === 'chat') {
        if (window.loadChatList && window.loadChatList !== loadChatList) {
            window.loadChatList();
            return;
        }
        loadChatList();
    // ======================== CHAT LIST ========================
    async function loadChatList() {
        const container = document.getElementById('chatListContainer');
        if (!container) return;
        container.innerHTML = '<p style="color: #95a5a6;">Yükleniyor...</p>';
        try {
            // Kullanıcının dahil olduğu sohbetleri çek
            const chatsSnap = await db.collection('chats')
                .where('userIds', 'array-contains', currentTrainer.id)
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
                    const otherId = chat.userIds.find(uid => uid !== currentTrainer.id);
                    if (chat.users && chat.users[otherId]) {
                        title = chat.users[otherId].name;
                        subtitle = chat.users[otherId].role === 'admin' ? 'Yönetici' :
                                  chat.users[otherId].role === 'parent' ? 'Veli' :
                                  chat.users[otherId].role === 'secretary' ? 'Sekreter' : 'Kullanıcı';
                    } else {
                        title = 'Birebir Sohbet';
                        subtitle = 'Kullanıcı';
                    }
                }

                let gearIcon = '';
                if (chat.type === 'group' && (!chat.createdBy || chat.createdBy === sessionStorage.getItem('user_id'))) {
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

    window.loadChatList = loadChatList;
    }
}

// ======================== DASHBOARD ========================

function showDashboard() {
    const salarySummary = calculateTrainerSalarySummary();

    document.getElementById('totalStudents').textContent = allStudents.length;
    document.getElementById('todayClasses').textContent = allSchedules.length;
    document.getElementById('publishedWorkouts').textContent = allWorkouts.filter(w => w.published).length;
    document.getElementById('trainerHourlyRate').textContent = salarySummary.displayRateText;
    document.getElementById('trainerEstimatedSalary').textContent = formatTryCurrency(salarySummary.estimatedSalary);
    
    let html = '';
    allWorkouts.slice(0, 5).forEach(workout => {
        html += `
            <div style="padding: 12px; background: #f9f9f9; border-radius: 5px; margin-bottom: 10px; border-left: 4px solid #3498db;">
                <strong>${workout.name}</strong><br>
                <small>${new Date(workout.createdAt).toLocaleDateString('tr-TR')}</small>
                <span class="badge ${workout.published ? 'badge-success' : 'badge-warning'}" style="float: right;">
                    ${workout.published ? 'Yayınlandı' : 'Taslak'}
                </span>
            </div>
        `;
    });
    
    document.getElementById('recentWorkouts').innerHTML = html || '<p style="color: #95a5a6;">Henüz antrenman oluşturulmamış</p>';
    renderTrainerSalarySummary();
}

// ======================== WORKOUTS ========================

function openWorkoutModal() {
    document.getElementById('workoutForm').reset();
    document.getElementById('exercisesList').innerHTML = '';
    addExercise();
    
    // Populate schedule dropdown
    const scheduleSelect = document.getElementById('workoutSchedule');
    scheduleSelect.innerHTML = '<option value="">Seçiniz...</option>';
    allSchedules.forEach(schedule => {
        const branch = allBranches.find(b => b.id === schedule.branchId);
        const option = document.createElement('option');
        option.value = schedule.id;
        option.textContent = `${branch ? branch.name : 'Bilinmiyor'} - ${schedule.time}`;
        scheduleSelect.appendChild(option);
    });
    
    document.getElementById('workoutModal').classList.add('active');
}

function closeWorkoutModal() {
    document.getElementById('workoutModal').classList.remove('active');
}

function addExercise() {
    const container = document.getElementById('exercisesList');
    const index = container.children.length;
    
    const exerciseDiv = document.createElement('div');
    exerciseDiv.className = 'exercise-input';
    exerciseDiv.id = `exercise-${index}`;
    exerciseDiv.style.cssText = 'padding: 15px; background: white; border-radius: 5px; margin-bottom: 10px; border: 1px solid #e0e0e0;';
    
    exerciseDiv.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px;">
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 0.9em;">Mesafe (m):</label>
                <input type="number" class="exercise-distance" min="50" step="50" value="100" required>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 0.9em;">Stil:</label>
                <select class="exercise-style" required>
                    <option value="">Seçiniz</option>
                    <option value="Kelebek">Kelebek</option>
                    <option value="Sırt">Sırt</option>
                    <option value="Göğüs">Göğüs</option>
                    <option value="Ön Çıkış">Ön Çıkış</option>
                    <option value="Serbest">Serbest</option>
                </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 0.9em;">Ara Saniye (her 50m):</label>
                <input type="number" class="exercise-rest" min="0" value="30" required>
            </div>
        </div>
        <button type="button" class="btn btn-danger btn-sm" onclick="removeExercise('exercise-${index}')">Sil</button>
    `;
    
    container.appendChild(exerciseDiv);
}

function removeExercise(id) {
    const element = document.getElementById(id);
    if (element) {
        element.remove();
    }
}

async function createTrainerWorkoutRecord(workoutInput, options = {}) {
    if (!currentTrainer?.id) {
        throw new Error('Antrenor bilgisi bulunamadi.');
    }

    const scheduleId = String(workoutInput?.scheduleId || '').trim();
    if (!scheduleId) {
        throw new Error('Ders grubu secilmeden antrenman kaydedilemez.');
    }

    const exercises = Array.isArray(workoutInput?.exercises) ? workoutInput.exercises : [];
    if (!exercises.length) {
        throw new Error('En az bir egzersiz gerekli.');
    }

    const createdAt = new Date().toISOString();
    const published = options.published !== false;
    const workoutData = {
        name: workoutInput.name,
        exercises,
        workoutBlocks: Array.isArray(workoutInput.workoutBlocks) ? workoutInput.workoutBlocks : [],
        scheduleId,
        trainerId: currentTrainer.id,
        adminId: currentTrainer.adminId || null,
        published,
        sharedAt: published ? createdAt : null,
        createdAt,
        ...((options.extraFields && typeof options.extraFields === 'object') ? options.extraFields : {})
    };

    const workoutRef = await db.collection('workouts').add(workoutData);

    if (published && options.shareToStudents !== false) {
        const studentsInClass = allStudents.filter(student => student.scheduleId === scheduleId);
        for (const student of studentsInClass) {
            await db.collection('student_workouts').add({
                studentId: student.id,
                workoutId: workoutRef.id,
                scheduleId,
                trainerId: currentTrainer.id,
                adminId: currentTrainer.adminId || null,
                createdAt,
                completed: false
            });
        }
    }

    if (window.aiKnowledgeEngine && typeof window.aiKnowledgeEngine.syncWorkoutKnowledge === 'function') {
        try {
            await window.aiKnowledgeEngine.syncWorkoutKnowledge({
                id: workoutRef.id,
                ...workoutData
            }, {
                trainerId: currentTrainer.id,
                trainerName: currentTrainer.name,
                trainerEmail: currentTrainer.email,
                adminId: currentTrainer.adminId || ''
            });
        } catch (error) {
            console.warn('AI workout knowledge sync skipped:', error.message);
        }
    }

    return {
        id: workoutRef.id,
        ...workoutData
    };
}

window.createTrainerWorkoutRecord = createTrainerWorkoutRecord;

async function saveWorkout(e) {
    e.preventDefault();
    
    const scheduleId = document.getElementById('workoutSchedule').value;
    if (!scheduleId) {
        alert('Lütfen bir saat grubu seçiniz!');
        return;
    }
    
    const exercises = [];
    document.querySelectorAll('.exercise-input').forEach(exerciseDiv => {
        exercises.push({
            distance: parseInt(exerciseDiv.querySelector('.exercise-distance').value),
            style: exerciseDiv.querySelector('.exercise-style').value,
            restSeconds: parseInt(exerciseDiv.querySelector('.exercise-rest').value)
        });
    });
    
    if (exercises.length === 0) {
        alert('Lütfen en az bir egzersiz ekleyiniz!');
        return;
    }
    
    try {
        await createTrainerWorkoutRecord({
            name: document.getElementById('workoutName').value,
            exercises,
            scheduleId
        }, {
            published: true,
            shareToStudents: true
        });

        await loadAllData();
        closeWorkoutModal();
        loadWorkouts();
        alert('Antrenman başarıyla kaydedildi ve öğrencilere gönderildi!');
    } catch (error) {
        alert('Hata: ' + error.message);
    }
}

async function loadWorkouts() {
    const container = document.getElementById('workoutsList');
    container.innerHTML = '';
    
    allWorkouts.forEach(workout => {
        const card = document.createElement('div');
        card.style.cssText = 'padding: 20px; background: #f9f9f9; border-radius: 5px; margin-bottom: 15px; border-left: 4px solid #3498db;';
        
        const schedule = allSchedules.find(s => s.id === workout.scheduleId);
        const branch = schedule ? allBranches.find(b => b.id === schedule.branchId) : null;
        const scheduleInfo = schedule ? `<small style="color: #7f8c8d; display: block; margin-bottom: 10px;">📍 ${branch ? branch.name : 'Bilinmiyor'} - ${schedule.time}</small>` : '';
        
        let exercisesHtml = '<ul style="margin-top: 10px;">';
        workout.exercises.forEach((ex, idx) => {
            exercisesHtml += `<li>${ex.distance}m ${ex.style} (${ex.restSeconds}s ara)</li>`;
        });
        exercisesHtml += '</ul>';
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <h3 style="margin-bottom: 5px;">${workout.name}</h3>
                    ${scheduleInfo}
                    ${exercisesHtml}
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-success btn-sm" onclick="startWorkoutChronometer('${workout.id}')">Başlat</button>
                    <button class="btn btn-info btn-sm" onclick="generateWorkoutPDF('${workout.id}')">PDF Oluştur</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteWorkout('${workout.id}')">Sil</button>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

async function publishWorkout(workoutId, publish) {
    try {
        await db.collection('workouts').doc(workoutId).update({
            published: publish
        });
        await loadAllData();
        loadWorkouts();
        alert(publish ? 'Antrenman yayınlandı!' : 'Antrenman yayından kaldırıldı!');
    } catch (error) {
        alert('Hata: ' + error.message);
    }
}

async function deleteWorkout(workoutId) {
    if (!confirm('Bu antrenmanı silmek istediğinize emin misiniz?')) return;

    try {
        await db.collection('workouts').doc(workoutId).delete();

        const [studentWorkoutsSnap, workoutSalesSnap] = await Promise.all([
            db.collection('student_workouts').where('workoutId', '==', workoutId).get(),
            db.collection('workout_sales').where('workoutId', '==', workoutId).get()
        ]);

        await Promise.all([
            ...studentWorkoutsSnap.docs.map(doc => doc.ref.delete()),
            ...workoutSalesSnap.docs.map(doc => doc.ref.delete()),
            db.collection('active_workouts').doc(workoutId).delete().catch(() => null)
        ]);

        await loadAllData();
        loadWorkouts();
        alert('Antrenman ve ilişkili Firestore kayıtları silindi!');
    } catch (error) {
        alert('Hata: ' + error.message);
    }
}

// ======================== CLASSES ========================

async function loadClasses() {
    const tbody = document.getElementById('classesTable');
    tbody.innerHTML = '';
    
    allSchedules.forEach(schedule => {
        const branch = allBranches.find(b => b.id === schedule.branchId);
        const postponementCount = getSchedulePostponementCount(schedule);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${branch ? branch.name : 'Bilinmiyor'}</td>
            <td>${schedule.time}<br><small style="color:#7f8c8d;">${formatTrainerScheduleDays(schedule)}</small><br><small style="color:#5d7285;">${getScheduleLessonTypeLabel(schedule)}${postponementCount ? ` • ${postponementCount} erteleme` : ''}</small></td>
            <td>${schedule.capacity}</td>
            <td>
                <button class="btn btn-info btn-sm" onclick="viewClass('${schedule.id}')">Görüntüle</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    await loadTrainerAvailabilityPlanner();
}

function renderTrainerAvailabilitySlotPicker(availableSlots = [], selectedSlots = []) {
    const container = document.getElementById('trainerAvailabilitySlotPicker');
    if (!container) return;

    const allowed = (availableSlots && availableSlots.length ? availableSlots : AVAILABILITY_SLOT_OPTIONS)
        .map(item => String(item).trim())
        .filter(Boolean)
        .sort();
    const selected = new Set((selectedSlots || []).map(item => String(item).trim()));

    container.innerHTML = allowed.map(slot => `
        <label style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 8px; background: #fff; border: 1px solid #dbe4ef; border-radius: 6px; cursor: pointer;">
            <input type="checkbox" name="trainerAvailabilitySlot" value="${slot}" ${selected.has(slot) ? 'checked' : ''}>
            <span style="font-size: 0.9em;">${slot}</span>
        </label>
    `).join('');
}

function getTrainerAvailabilityDayLabel(dayKey) {
    return AVAILABILITY_DAY_OPTIONS.find(item => item.key === dayKey)?.label || 'Bilinmeyen Gün';
}

function getNormalizedTrainerDailySlots(rawData) {
    const dailySlots = {};
    AVAILABILITY_DAY_OPTIONS.forEach(day => {
        dailySlots[day.key] = [];
    });

    if (rawData && rawData.dailySlots && typeof rawData.dailySlots === 'object') {
        AVAILABILITY_DAY_OPTIONS.forEach(day => {
            const values = rawData.dailySlots[day.key];
            dailySlots[day.key] = Array.isArray(values) ? values.map(item => String(item).trim()).filter(Boolean).sort() : [];
        });
        return dailySlots;
    }

    if (rawData && Array.isArray(rawData.slots)) {
        dailySlots.monday = rawData.slots.map(item => String(item).trim()).filter(Boolean).sort();
    }

    return dailySlots;
}

function parseTrainerDateValue(value) {
    if (!value) return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
    }
    if (typeof value.toDate === 'function') {
        const date = value.toDate();
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'string') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'number') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'object' && typeof value.seconds === 'number') {
        const date = new Date(value.seconds * 1000);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
}

function formatTrainerDateTR(value) {
    const date = parseTrainerDateValue(value);
    if (!date) return '-';
    return date.toLocaleDateString('tr-TR');
}

function formatTrainerDetailedDateTR(value) {
    const date = parseTrainerDateValue(value);
    if (!date) return '-';
    return date.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

function mapTrainerDayKeyToJsDay(dayKey) {
    const map = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6
    };
    return map[dayKey] ?? null;
}

function calculateTrainerLessonDatesFromStart(startDate, scheduleDays, lessonCount) {
    const targetDays = (scheduleDays || [])
        .map(mapTrainerDayKeyToJsDay)
        .filter(day => day !== null);

    const uniqueDays = [...new Set(targetDays.length ? targetDays : [1])];
    const dates = [];
    const cursor = new Date(startDate.getTime());
    cursor.setHours(0, 0, 0, 0);

    let guard = 0;
    while (dates.length < lessonCount && guard < 4000) {
        if (uniqueDays.includes(cursor.getDay())) {
            dates.push(new Date(cursor.getTime()));
        }
        cursor.setDate(cursor.getDate() + 1);
        guard += 1;
    }

    return dates;
}

function formatTrainerIsoDate(value) {
    const date = parseTrainerDateValue(value);
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getTrainerMonthKey(value) {
    const date = parseTrainerDateValue(value);
    if (!date) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getTrainerMonthLabel(monthKey) {
    if (!monthKey) return '-';
    const [year, month] = monthKey.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('tr-TR', {
        month: 'long',
        year: 'numeric'
    });
}

function getTrainerSchedulePostponableDates(schedule) {
    if (!schedule) {
        return [];
    }

    const startDate = parseTrainerDateValue(schedule.startDate) || parseTrainerDateValue(schedule.createdAt) || new Date();
    startDate.setHours(0, 0, 0, 0);

    const lessonDates = calculateTrainerLessonDatesFromStart(
        startDate,
        getNormalizedScheduleDays(schedule),
        getScheduleLessonCount(schedule) + getSchedulePostponementCount(schedule)
    );
    const postponedDateSet = new Set(
        getSchedulePostponements(schedule)
            .map(item => item?.date)
            .filter(Boolean)
    );

    return lessonDates
        .map(date => new Date(date.getTime()))
        .filter(date => !postponedDateSet.has(formatTrainerIsoDate(date)))
        .map(date => ({
            date,
            iso: formatTrainerIsoDate(date),
            label: formatTrainerDetailedDateTR(date),
            dayLabel: date.toLocaleDateString('tr-TR', { weekday: 'short' })
        }));
}

function updatePostponeSelectedDateInfo() {
    const info = document.getElementById('postponeSelectedDateInfo');
    if (!info) return;

    if (!postponeLessonModalState.selectedDate) {
        info.textContent = 'Tarih seçilmedi.';
        return;
    }

    info.textContent = `Seçili tarih: ${formatTrainerDetailedDateTR(postponeLessonModalState.selectedDate)}`;
}

function renderPostponeLessonCalendar() {
    const monthLabel = document.getElementById('postponeCalendarMonthLabel');
    const grid = document.getElementById('postponeCalendarGrid');
    const emptyState = document.getElementById('postponeCalendarEmpty');
    const prevButton = document.getElementById('postponePrevMonthButton');
    const nextButton = document.getElementById('postponeNextMonthButton');

    if (!monthLabel || !grid || !emptyState || !prevButton || !nextButton) {
        return;
    }

    const monthKey = postponeLessonModalState.availableMonthKeys[postponeLessonModalState.monthIndex] || '';
    monthLabel.textContent = getTrainerMonthLabel(monthKey);
    prevButton.disabled = postponeLessonModalState.monthIndex <= 0;
    nextButton.disabled = postponeLessonModalState.monthIndex >= postponeLessonModalState.availableMonthKeys.length - 1;

    if (!monthKey) {
        grid.innerHTML = '';
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        updatePostponeSelectedDateInfo();
        return;
    }

    const eligibleDateMap = new Map(
        postponeLessonModalState.eligibleDates
            .filter(item => getTrainerMonthKey(item.date) === monthKey)
            .map(item => [item.iso, item])
    );

    if (!eligibleDateMap.size) {
        grid.innerHTML = '';
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        updatePostponeSelectedDateInfo();
        return;
    }

    const [year, month] = monthKey.split('-').map(Number);
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const leadingBlankCount = (firstDayOfMonth.getDay() + 6) % 7;
    const cells = [];

    for (let index = 0; index < leadingBlankCount; index += 1) {
        cells.push('<div class="postpone-day-cell"></div>');
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const iso = formatTrainerIsoDate(new Date(year, month - 1, day));
        const eligibleDate = eligibleDateMap.get(iso);
        if (!eligibleDate) {
            cells.push('<div class="postpone-day-cell"></div>');
            continue;
        }

        cells.push(`
            <div class="postpone-day-cell">
                <button type="button" class="postpone-day-button${postponeLessonModalState.selectedDate === iso ? ' selected' : ''}" onclick="selectPostponeLessonDate('${iso}')">
                    ${day}
                    <small>${eligibleDate.dayLabel}</small>
                </button>
            </div>
        `);
    }

    grid.innerHTML = cells.join('');
    grid.style.display = 'grid';
    emptyState.style.display = 'none';
    updatePostponeSelectedDateInfo();
}

function selectPostponeLessonDate(isoDate) {
    postponeLessonModalState.selectedDate = isoDate;
    renderPostponeLessonCalendar();
}

function changePostponeCalendarMonth(direction) {
    const nextIndex = postponeLessonModalState.monthIndex + Number(direction || 0);
    if (nextIndex < 0 || nextIndex >= postponeLessonModalState.availableMonthKeys.length) {
        return;
    }
    postponeLessonModalState.monthIndex = nextIndex;
    renderPostponeLessonCalendar();
}

function closePostponeLessonModal() {
    const modal = document.getElementById('postponeLessonModal');
    if (modal) {
        modal.classList.remove('active');
    }

    const reasonInput = document.getElementById('postponeLessonReason');
    if (reasonInput) {
        reasonInput.value = '';
    }

    const panel = document.getElementById('postponeSpecificDatePanel');
    if (panel) {
        panel.style.display = 'none';
    }

    postponeLessonModalState = {
        scheduleId: '',
        eligibleDates: [],
        availableMonthKeys: [],
        monthIndex: 0,
        selectedDate: ''
    };
}

function showSpecificPostponeDatePicker() {
    const panel = document.getElementById('postponeSpecificDatePanel');
    if (!panel) return;
    panel.style.display = 'block';
    renderPostponeLessonCalendar();
}

function openPostponeLessonModal(schedule) {
    const modal = document.getElementById('postponeLessonModal');
    const summary = document.getElementById('postponeLessonSummary');
    const todayButton = document.getElementById('postponeTodayButton');
    const todayButtonText = document.getElementById('postponeTodayButtonText');
    const specificPanel = document.getElementById('postponeSpecificDatePanel');
    const reasonInput = document.getElementById('postponeLessonReason');

    if (!modal || !summary || !todayButton || !todayButtonText || !specificPanel || !reasonInput) {
        return;
    }

    const branch = allBranches.find(item => item.id === schedule.branchId);
    const eligibleDates = getTrainerSchedulePostponableDates(schedule);
    const availableMonthKeys = [...new Set(eligibleDates.map(item => getTrainerMonthKey(item.date)))];
    const todayIso = formatTrainerIsoDate(new Date());
    const currentMonthKey = getTrainerMonthKey(new Date());
    const initialMonthIndex = Math.max(availableMonthKeys.indexOf(currentMonthKey), 0);
    const todayIsEligible = eligibleDates.some(item => item.iso === todayIso);

    postponeLessonModalState = {
        scheduleId: schedule.id,
        eligibleDates,
        availableMonthKeys,
        monthIndex: initialMonthIndex,
        selectedDate: ''
    };

    summary.innerHTML = `
        <strong>${branch ? branch.name : 'Bilinmeyen şube'} - ${schedule.time || '-'}</strong><br>
        <span>${formatTrainerScheduleDays(schedule)} • ${getScheduleLessonTypeLabel(schedule)} • ${eligibleDates.length} seçilebilir ders günü</span>
    `;
    reasonInput.value = '';
    specificPanel.style.display = 'none';
    todayButton.disabled = !todayIsEligible;
    todayButtonText.textContent = todayIsEligible
        ? `Bugün (${formatTrainerDateTR(todayIso)}) planlı ders olarak görünüyor.`
        : 'Bugün bu dersin günü değil ya da bugünkü ders daha önce ertelendi.';
    updatePostponeSelectedDateInfo();
    renderPostponeLessonCalendar();
    modal.classList.add('active');
}

async function submitSchedulePostponementForDate(postponeDate) {
    const scheduleId = postponeLessonModalState.scheduleId || document.getElementById('attendanceScheduleSelect')?.value;
    if (!scheduleId || !postponeDate) {
        alert('Erteleme tarihi seçilemedi.');
        return;
    }

    const schedule = allSchedules.find(item => item.id === scheduleId);
    if (!schedule || !scheduleBelongsToCurrentTrainer(schedule)) {
        alert('Seçilen ders bulunamadı.');
        return;
    }

    const eligibleDates = getTrainerSchedulePostponableDates(schedule);
    if (!eligibleDates.some(item => item.iso === postponeDate)) {
        alert('Bu tarih için erteleme yapılamaz. Takvimden uygun bir ders günü seçin.');
        return;
    }

    const existingPostponements = getSchedulePostponements(schedule);
    if (existingPostponements.some(item => item?.date === postponeDate)) {
        alert('Bu ders için seçtiğiniz tarihte zaten bir erteleme kaydı var.');
        return;
    }

    const reason = String(document.getElementById('postponeLessonReason')?.value || '').trim();

    try {
        await db.collection('schedules').doc(scheduleId).update({
            postponements: existingPostponements.concat({
                id: `postpone_${Date.now()}`,
                date: postponeDate,
                reason,
                createdAt: new Date().toISOString(),
                createdBy: currentTrainer.id,
                createdByName: currentTrainer.name || ''
            }),
            updatedAt: new Date().toISOString()
        });

        closePostponeLessonModal();
        await loadAllData();
        await loadClasses();
        await loadAttendanceSchedules();
        const select = document.getElementById('attendanceScheduleSelect');
        if (select) select.value = scheduleId;
        await loadAttendanceForSchedule();
        alert(`${formatTrainerDateTR(postponeDate)} tarihli ders ertelendi. Bitiş tarihi telafi için uzatıldı.`);
    } catch (error) {
        alert('Erteleme kaydedilemedi: ' + error.message);
    }
}

async function submitTodayPostponement() {
    await submitSchedulePostponementForDate(formatTrainerIsoDate(new Date()));
}

async function submitSelectedPostponementDate() {
    if (!postponeLessonModalState.selectedDate) {
        alert('Takvimden bir ders günü seçin.');
        return;
    }
    await submitSchedulePostponementForDate(postponeLessonModalState.selectedDate);
}

function getSelectedTrainerAvailabilitySlots() {
    return Array.from(document.querySelectorAll('#trainerAvailabilitySlotPicker input[name="trainerAvailabilitySlot"]:checked'))
        .map(input => input.value)
        .sort();
}

function updateTrainerAvailabilityBranchSelect() {
    const select = document.getElementById('trainerAvailabilityBranchSelect');
    if (!select) return;

    const existingValue = select.value;
    select.innerHTML = '<option value="">-- Şube Seçiniz --</option>';

    allBranches.forEach(branch => {
        const option = document.createElement('option');
        option.value = branch.id;
        option.textContent = branch.name;
        select.appendChild(option);
    });

    if (existingValue && allBranches.some(branch => branch.id === existingValue)) {
        select.value = existingValue;
    }
}

async function loadTrainerAvailabilitySummary() {
    const container = document.getElementById('trainerAvailabilitySummary');
    if (!container || !currentTrainer?.adminId) return;

    try {
        const snap = await db.collection('trainer_time_preferences')
            .where('adminId', '==', currentTrainer.adminId)
            .where('trainerId', '==', currentTrainer.id)
            .get();

        const rows = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (!rows.length) {
            container.innerHTML = '<span style="color:#7f8c8d;">Henüz kayıtlı müsaitlik seçiminiz yok.</span>';
            return;
        }

        container.innerHTML = rows.map(row => {
            const branch = allBranches.find(item => item.id === row.branchId);
            const dailySlots = getNormalizedTrainerDailySlots(row);
            const daySummary = AVAILABILITY_DAY_OPTIONS
                .filter(day => (dailySlots[day.key] || []).length)
                .map(day => `${day.label}: ${(dailySlots[day.key] || []).join(', ')}`)
                .join(' | ');
            return `<div style="padding: 8px 0; border-bottom: 1px solid #edf2f7;"><strong>${branch ? branch.name : 'Bilinmeyen şube'}:</strong> ${daySummary || '-'}</div>`;
        }).join('');
    } catch (error) {
        container.innerHTML = `<span style="color:#c0392b;">Özet yüklenemedi: ${error.message}</span>`;
    }
}

async function loadTrainerAvailabilityForBranch() {
    const branchId = document.getElementById('trainerAvailabilityBranchSelect')?.value;
    const selectedDay = document.getElementById('trainerAvailabilityDaySelect')?.value || 'monday';
    const status = document.getElementById('trainerAvailabilityStatus');

    if (!branchId) {
        renderTrainerAvailabilitySlotPicker([], []);
        if (status) {
            status.style.color = '#7f8c8d';
            status.textContent = 'Önce bir şube seçin.';
        }
        return;
    }

    try {
        const templateDocId = `${currentTrainer.adminId}_${branchId}`;
        const templateDoc = await db.collection('trainer_time_programs').doc(templateDocId).get();
        const templateDailySlots = getNormalizedTrainerDailySlots(templateDoc.exists ? templateDoc.data() : null);
        const availableSlots = templateDailySlots[selectedDay] || [];

        if (!availableSlots.length) {
            renderTrainerAvailabilitySlotPicker([], []);
            if (status) {
                status.style.color = '#b9770e';
                status.textContent = 'Bu şube için yönetici tarafından saat havuzu tanımlanmamış.';
            }
            return;
        }

        const prefDocId = `${currentTrainer.adminId}_${branchId}_${currentTrainer.id}`;
        const prefDoc = await db.collection('trainer_time_preferences').doc(prefDocId).get();
        const prefDailySlots = getNormalizedTrainerDailySlots(prefDoc.exists ? prefDoc.data() : null);
        const selectedSlots = prefDailySlots[selectedDay] || [];

        renderTrainerAvailabilitySlotPicker(availableSlots, selectedSlots);
        if (status) {
            status.style.color = '#7f8c8d';
            status.textContent = `${getTrainerAvailabilityDayLabel(selectedDay)} saatleri yüklendi. Müsait olduklarınızı seçip kaydedin.`;
        }
    } catch (error) {
        if (status) {
            status.style.color = '#c0392b';
            status.textContent = 'Müsaitlik saatleri yüklenemedi: ' + error.message;
        }
    }
}

async function saveTrainerAvailability() {
    const branchId = document.getElementById('trainerAvailabilityBranchSelect')?.value;
    const selectedDay = document.getElementById('trainerAvailabilityDaySelect')?.value || 'monday';
    const status = document.getElementById('trainerAvailabilityStatus');

    if (!branchId) {
        alert('Lütfen bir şube seçin.');
        return;
    }

    const slots = getSelectedTrainerAvailabilitySlots();
    if (!slots.length) {
        alert('En az bir saat seçin.');
        return;
    }

    try {
        const docId = `${currentTrainer.adminId}_${branchId}_${currentTrainer.id}`;
        const existingDoc = await db.collection('trainer_time_preferences').doc(docId).get();
        const dailySlots = getNormalizedTrainerDailySlots(existingDoc.exists ? existingDoc.data() : null);
        dailySlots[selectedDay] = slots;

        await db.collection('trainer_time_preferences').doc(docId).set({
            adminId: currentTrainer.adminId,
            branchId,
            trainerId: currentTrainer.id,
            trainerDocId: currentTrainer.docId || '',
            slots,
            dailySlots,
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        }, { merge: true });

        if (status) {
            status.style.color = '#1e8449';
            status.textContent = `${getTrainerAvailabilityDayLabel(selectedDay)} için müsaitlik kaydedildi.`;
        }

        await loadTrainerAvailabilitySummary();
    } catch (error) {
        if (status) {
            status.style.color = '#c0392b';
            status.textContent = 'Müsaitlik kaydedilemedi: ' + error.message;
        }
    }
}

async function loadTrainerAvailabilityPlanner() {
    if (!document.getElementById('trainerAvailabilityBranchSelect')) return;
    updateTrainerAvailabilityBranchSelect();

    const select = document.getElementById('trainerAvailabilityBranchSelect');
    if (select && !select.value && allBranches.length) {
        select.value = allBranches[0].id;
    }

    const daySelect = document.getElementById('trainerAvailabilityDaySelect');
    if (daySelect && !daySelect.value) {
        daySelect.value = 'monday';
    }

    await loadTrainerAvailabilityForBranch();
    await loadTrainerAvailabilitySummary();
    await loadTrainerCompletionCalendar();
}

async function loadTrainerCompletionCalendar() {
    const tbody = document.getElementById('trainerCompletionCalendarTable');
    if (!tbody) return;

    let attendanceCountMap = {};
    const privateScheduleIds = new Set(
        allSchedules
            .filter(schedule => scheduleBelongsToCurrentTrainer(schedule) && getScheduleLessonType(schedule) === 'private')
            .map(schedule => schedule.id)
            .filter(Boolean)
    );

    if (privateScheduleIds.size) {
        const attendanceSnap = await db.collection('attendance')
            .where('trainerId', '==', currentTrainer.id)
            .get();
        const attendanceRecords = attendanceSnap.docs
            .map(doc => doc.data() || {})
            .filter(record => privateScheduleIds.has(record.scheduleId));
        attendanceCountMap = buildTrainerAttendanceLessonCountMap(attendanceRecords);
    }

    const rows = allStudents
        .filter(student => String(student.status || 'active') === 'active')
        .map(student => {
            const schedule = allSchedules.find(item => item.id === student.scheduleId);
            if (!schedule || !scheduleBelongsToCurrentTrainer(schedule)) return null;
            const branch = allBranches.find(item => item.id === student.branchId);
            const lessonsCount = getScheduleLessonCount(schedule);
            const postponementCount = getSchedulePostponementCount(schedule);
            const startDate = parseTrainerDateValue(student.startDate) || parseTrainerDateValue(schedule?.startDate) || parseTrainerDateValue(student.createdAt);
            if (!startDate) return null;

            const lessonDates = calculateTrainerLessonDatesFromStart(startDate, getNormalizedScheduleDays(schedule), lessonsCount + postponementCount);
            const endDate = lessonDates.length ? lessonDates[lessonDates.length - 1] : startDate;

            const now = new Date();
            const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const isPrivateLesson = getScheduleLessonType(schedule) === 'private';
            const completedLessons = isPrivateLesson ? (attendanceCountMap[`${student.id}_${schedule.id}`] || 0) : null;
            const remainingLessons = isPrivateLesson ? Math.max(0, lessonsCount - completedLessons) : null;

            return {
                student,
                branch,
                schedule,
                startDate,
                endDate,
                daysLeft,
                postponementCount,
                isPrivateLesson,
                remainingLessons
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 12px; color: #95a5a6;">Takvim gösterecek aktif öğrenci bulunamadı.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map(item => {
        const statusLabel = item.daysLeft < 0
            ? 'Süresi doldu - saat boşalabilir'
            : item.daysLeft === 0
                ? 'Bugün bitiyor'
                : `${item.daysLeft} gün kaldı`;
        const detailParts = [];
        if (item.isPrivateLesson) {
            detailParts.push(`${item.remainingLessons} ders kaldı`);
        }
        if (item.postponementCount) {
            detailParts.push(`${item.postponementCount} erteleme işlendi`);
        }
        return `
            <tr style="border-bottom: 1px solid #eef2f7;">
                <td style="padding: 10px;">${item.student.name} ${item.student.surname || ''}</td>
                <td style="padding: 10px;">${item.branch ? item.branch.name : 'Bilinmiyor'}</td>
                <td style="padding: 10px;">${item.schedule.time}</td>
                <td style="padding: 10px;">${formatTrainerDetailedDateTR(item.startDate)}</td>
                <td style="padding: 10px;">${formatTrainerDetailedDateTR(item.endDate)}${item.isPrivateLesson ? `<br><small style="color:#5d7285;">Yoklamaya göre ${item.remainingLessons} ders kaldı</small>` : ''}</td>
                <td style="padding: 10px; ${item.daysLeft < 0 ? 'color:#c0392b;font-weight:600;' : 'color:#2c3e50;'}">${statusLabel}${detailParts.length ? `<br><small style="color:#5d7285; font-weight:500;">${detailParts.join(' • ')}</small>` : ''}</td>
            </tr>
        `;
    }).join('');
}

async function postponeSelectedScheduleLesson() {
    const scheduleId = document.getElementById('attendanceScheduleSelect')?.value;
    if (!scheduleId) {
        alert('Önce bir ders seçin.');
        return;
    }

    const schedule = allSchedules.find(item => item.id === scheduleId);
    if (!schedule || !scheduleBelongsToCurrentTrainer(schedule)) {
        alert('Seçilen ders bulunamadı.');
        return;
    }

    openPostponeLessonModal(schedule);
}

function viewClass(scheduleId) {
    const selectedSchedule = allSchedules.find(schedule => schedule.id === scheduleId);
    if (!selectedSchedule) {
        alert('Ders grubu bulunamadı.');
        return;
    }

    switchPage('attendance');

    requestAnimationFrame(() => {
        const select = document.getElementById('attendanceScheduleSelect');
        if (!select) return;
        select.value = scheduleId;
        loadAttendanceForSchedule();
    });
}

// ======================== STUDENTS ========================

async function loadStudents() {
    const container = document.getElementById('studentsGroupContainer');
    container.innerHTML = '';
    
    // Antrenörün kendi şubeleri ve saatleri
    const trainerSchedules = allSchedules.filter(scheduleBelongsToCurrentTrainer);
    
    // Grupları oluştur
    const groups = {};
    
    allStudents.forEach(student => {
        const schedule = allSchedules.find(s => s.id === student.scheduleId);
        const branch = allBranches.find(b => b.id === student.branchId);
        
        // Eğer bu antrenörün saati değilse, gösterme
        if (!schedule || !scheduleBelongsToCurrentTrainer(schedule)) {
            return;
        }
        
        const key = `${student.branchId}_${student.scheduleId}`;
        const label = `${branch ? branch.name : 'Bilinmiyor'} - ${schedule ? schedule.time : 'Bilinmiyor'}`;
        
        if (!groups[key]) {
            groups[key] = {
                label,
                students: [],
                lessonsCount: schedule?.lessonsCount || 1
            };
        }
        groups[key].students.push(student);
    });
    
    // Eğer grup yoksa mesaj göster
    if (Object.keys(groups).length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Henüz öğrenci yok.</div>';
        return;
    }
    
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
                    <th style="padding: 10px; text-align: left;">Doğum Yılı</th>
                    <th style="padding: 10px; text-align: left;">Devam Durumu</th>
                    <th style="padding: 10px; text-align: center;">İşlemler</th>
                </tr>
            </thead>
            <tbody id="tbody-${key}"></tbody>
        `;
        
        const tbody = table.getElementsByTagName('tbody')[0];
        group.students.forEach(student => {
            const birthYear = getStudentBirthYear(student);
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid #ddd';
            row.innerHTML = `
                <td style="padding: 10px;">${student.name} ${student.surname}</td>
                <td style="padding: 10px;">${birthYear || '-'}</td>
                <td style="padding: 10px;">
                    <div style="width: 100px; height: 8px; background: #e0e0e0; border-radius: 4px;">
                        <div style="width: 70%; height: 100%; background: #27ae60; border-radius: 4px;"></div>
                    </div>
                    <small>%70</small>
                </td>
                <td style="padding: 10px; text-align: center;">
                    <button class="btn btn-info btn-sm" onclick="markAttendance('${student.id}')">Devam Kaydı</button>
                    <button class="btn btn-success btn-sm" onclick="openTrainerCommentModal('${student.id}')" style="margin-left: 6px;">Yorum Yaz</button>
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
    
    // Arama fonksiyonu
    setupStudentSearch();
}

function markAttendance(studentId) {
    alert('Devam kaydı güncellendi!');
}

function openTrainerCommentModal(studentId) {
    const student = allStudents.find(item => item.id === studentId);
    if (!student) {
        alert('Öğrenci bulunamadı.');
        return;
    }

    window.selectedCommentStudentId = studentId;
    document.getElementById('trainerCommentStudentName').textContent = `${student.name} ${student.surname}`;
    document.getElementById('trainerCommentDate').valueAsDate = new Date();
    document.getElementById('trainerCommentTopic').value = '';
    document.getElementById('trainerCommentText').value = '';
    document.getElementById('trainerCommentModal').classList.add('active');
}

function closeTrainerCommentModal() {
    document.getElementById('trainerCommentModal').classList.remove('active');
    const form = document.getElementById('trainerCommentForm');
    if (form) form.reset();
    window.selectedCommentStudentId = null;
}

async function saveTrainerComment(e) {
    e.preventDefault();

    const studentId = window.selectedCommentStudentId;
    const comment = document.getElementById('trainerCommentText').value.trim();
    const topic = document.getElementById('trainerCommentTopic').value.trim();
    const lessonDate = document.getElementById('trainerCommentDate').value;
    const student = allStudents.find(item => item.id === studentId);

    if (!studentId || !student || !comment || !topic || !lessonDate) {
        alert('Lütfen tüm yorum alanlarını doldurun.');
        return;
    }

    try {
        await db.collection('lesson_comments').add({
            studentId,
            studentName: `${student.name} ${student.surname}`,
            trainerId: currentTrainer.id,
            trainerName: currentTrainer.name,
            adminId: currentTrainer.adminId || '',
            scheduleId: student.scheduleId || '',
            branchId: student.branchId || '',
            topic,
            comment,
            lessonDate,
            createdAt: new Date().toISOString()
        });

        alert('Ders yorumu kaydedildi. Veli panelinde görüntülenecek.');
        closeTrainerCommentModal();
    } catch (error) {
        console.error('Yorum kaydedilirken hata:', error);
        alert('Yorum kaydedilemedi: ' + error.message);
    }
}

// ======================== CHRONOMETER ========================

async function startWorkoutChronometer(workoutId) {
    const workout = allWorkouts.find(w => w.id === workoutId);
    if (!workout) return;

    // Aktif antrenman referansı oluştur
    activeWorkoutRef = db.collection('active_workouts').doc(workoutId);

    // Önce mevcut aktif antrenmanı kontrol et
    const activeWorkoutDoc = await activeWorkoutRef.get();
    if (activeWorkoutDoc.exists) {
        // Mevcut antrenman varsa, onu yükle
        const activeData = activeWorkoutDoc.data();
        currentWorkout = workout;
        currentExerciseIndex = activeData.currentExerciseIndex || 0;
        isRunning = activeData.isRunning || false;
        isPaused = activeData.isPaused || false;
        chronometerTime = activeData.chronometerTime || 0;
        isRestTime = activeData.isRestTime || false;
    } else {
        // Yeni antrenman başlat
        currentWorkout = workout;
        currentExerciseIndex = 0;
        isRunning = false;
        isPaused = false;
        chronometerTime = 0;
        isRestTime = false;

        // Aktif antrenmanı Firestore'a kaydet
        await activeWorkoutRef.set({
            workoutId: workoutId,
            trainerId: currentTrainer.id,
            adminId: currentTrainer.adminId,
            currentExerciseIndex: 0,
            isRunning: false,
            isPaused: false,
            chronometerTime: 0,
            isRestTime: false,
            startedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        });
    }

    // Real-time listener ekle
    activeWorkoutListener = activeWorkoutRef.onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            // Sadece diğer cihazlardan gelen güncellemeleri işle
            if (data.lastUpdatedBy !== currentTrainer.id) {
                currentExerciseIndex = data.currentExerciseIndex || 0;
                isRunning = data.isRunning || false;
                isPaused = data.isPaused || false;
                chronometerTime = data.chronometerTime || 0;
                isRestTime = data.isRestTime || false;

                updateChronometerDisplay();
                displayExerciseList();
                updateCurrentExerciseInfo();

                // Timer durumuna göre butonları güncelle
                if (isRunning && !isPaused) {
                    document.getElementById('pauseBtn').style.display = 'inline-block';
                    document.getElementById('resumeBtn').style.display = 'none';
                    document.getElementById('restBtn').style.display = 'inline-block';
                    document.getElementById('nextExerciseBtn').style.display = 'none';
                } else if (isPaused) {
                    document.getElementById('pauseBtn').style.display = 'none';
                    document.getElementById('resumeBtn').style.display = 'inline-block';
                    document.getElementById('restBtn').style.display = 'none';
                    document.getElementById('nextExerciseBtn').style.display = 'none';
                } else {
                    document.getElementById('pauseBtn').style.display = 'none';
                    document.getElementById('resumeBtn').style.display = 'none';
                    document.getElementById('restBtn').style.display = 'none';
                    document.getElementById('nextExerciseBtn').style.display = 'inline-block';
                }
            }
        }
    });

    document.getElementById('chronometerModal').classList.add('active');
    document.getElementById('workoutTitle').textContent = workout.name;

    // Fullscreen mode
    const modal = document.getElementById('chronometerModal');
    if (modal.requestFullscreen) {
        modal.requestFullscreen();
    } else if (modal.webkitRequestFullscreen) {
        modal.webkitRequestFullscreen();
    } else if (modal.msRequestFullscreen) {
        modal.msRequestFullscreen();
    }

    updateChronometerDisplay();
    displayExerciseList();
    updateCurrentExerciseInfo();
}

function updateCurrentExerciseInfo() {
    if (!currentWorkout || currentExerciseIndex >= currentWorkout.exercises.length) {
        return;
    }
    
    const exercise = currentWorkout.exercises[currentExerciseIndex];
    document.getElementById('currentExerciseName').textContent = `${currentExerciseIndex + 1}. ${exercise.distance}m ${exercise.style}`;
    document.getElementById('currentDistance').textContent = exercise.distance + 'm';
    document.getElementById('currentStyle').textContent = exercise.style;
    document.getElementById('currentRest').textContent = exercise.restSeconds + 's';
    
    // Show next exercise preview if available
    if (currentExerciseIndex < currentWorkout.exercises.length - 1) {
        const nextExercise = currentWorkout.exercises[currentExerciseIndex + 1];
        document.getElementById('nextExercisePreview').style.display = 'block';
        document.getElementById('nextExerciseName').textContent = `${nextExercise.distance}m ${nextExercise.style}`;
    } else {
        document.getElementById('nextExercisePreview').style.display = 'none';
    }
}

function displayExerciseList() {
    const container = document.getElementById('exerciseListDisplay');
    let html = '<h4 style="margin-top: 20px;">Antrenman Detayları:</h4>';
    html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">';
    
    currentWorkout.exercises.forEach((ex, idx) => {
        const isActive = idx === currentExerciseIndex;
        const bgColor = isActive ? '#3498db' : '#f9f9f9';
        const textColor = isActive ? 'white' : '#2c3e50';
        
        html += `
            <div style="padding: 15px; background: ${bgColor}; color: ${textColor}; border-radius: 5px; text-align: center; border: 2px ${isActive ? 'solid #2980b9' : 'solid #e0e0e0'};">
                <div style="font-weight: bold; margin-bottom: 5px;">#${idx + 1}</div>
                <div>${ex.distance}m</div>
                <div style="font-size: 0.9em; margin-top: 5px;">${ex.style}</div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

async function startChronometer() {
    updateCurrentExerciseInfo();
    displayExerciseList();
    document.getElementById('nextExerciseBtn').style.display = 'none';
    document.getElementById('pauseBtn').style.display = 'inline-block';
    document.getElementById('restBtn').style.display = 'inline-block';
    // Countdown from exercise duration
    const exercise = currentWorkout.exercises[currentExerciseIndex];
    chronometerTime = exercise.distance * 1; // 1 saniye = 1m, isteğe göre değiştirilebilir
    isRunning = true;
    isPaused = false;
    updateChronometerDisplay();

    // Firestore'u güncelle
    if (activeWorkoutRef) {
        await activeWorkoutRef.update({
            currentExerciseIndex: currentExerciseIndex,
            isRunning: true,
            isPaused: false,
            chronometerTime: chronometerTime,
            isRestTime: false,
            lastUpdated: new Date().toISOString(),
            lastUpdatedBy: currentTrainer.id
        });
    }

    chronometerInterval = setInterval(async () => {
        chronometerTime--;
        updateChronometerDisplay();

        // Her saniye Firestore'u güncelle
        if (activeWorkoutRef) {
            await activeWorkoutRef.update({
                chronometerTime: chronometerTime,
                lastUpdated: new Date().toISOString(),
                lastUpdatedBy: currentTrainer.id
            });
        }

        if (chronometerTime <= 0) {
            clearInterval(chronometerInterval);
            document.getElementById('pauseBtn').style.display = 'none';
            document.getElementById('restBtn').style.display = 'none';
            document.getElementById('nextExerciseBtn').style.display = 'inline-block';

            // Antrenman bittiğinde durumu güncelle
            if (activeWorkoutRef) {
                await activeWorkoutRef.update({
                    isRunning: false,
                    isPaused: false,
                    lastUpdated: new Date().toISOString(),
                    lastUpdatedBy: currentTrainer.id
                });
            }
        }
    }, 1000);
}

async function pauseChronometer() {
    isRunning = false;
    isPaused = true;
    clearInterval(chronometerInterval);

    document.getElementById('pauseBtn').style.display = 'none';
    document.getElementById('resumeBtn').style.display = 'inline-block';

    // Firestore'u güncelle
    if (activeWorkoutRef) {
        await activeWorkoutRef.update({
            isRunning: false,
            isPaused: true,
            lastUpdated: new Date().toISOString(),
            lastUpdatedBy: currentTrainer.id
        });
    }
}

function resumeChronometer() {
    isRunning = true;
    isPaused = false;
    document.getElementById('resumeBtn').style.display = 'none';
    document.getElementById('pauseBtn').style.display = 'inline-block';
    chronometerInterval = setInterval(() => {
        chronometerTime--;
        updateChronometerDisplay();
        if (chronometerTime <= 0) {
            clearInterval(chronometerInterval);
            document.getElementById('pauseBtn').style.display = 'none';
            document.getElementById('restBtn').style.display = 'none';
            document.getElementById('nextExerciseBtn').style.display = 'inline-block';
        }
    }, 1000);
}

function updateChronometerDisplay() {
    const display = document.getElementById('chronometerDisplay');
    display.textContent = formatTime(chronometerTime);
    // Color transitions
    if (chronometerTime > 10) {
        display.style.color = '#27ae60'; // green
    } else if (chronometerTime > 5) {
        display.style.color = '#f39c12'; // orange
    } else {
        display.style.color = '#e74c3c'; // red
    }
}

function closeChronometer() {
    clearInterval(chronometerInterval);
    clearInterval(restInterval);
    document.getElementById('chronometerModal').classList.remove('active');
    isRunning = false;
    // Exit fullscreen if active
    if (document.fullscreenElement) {
        document.exitFullscreen();
    }
}

// ======================== ATTENDANCE ========================

async function loadAttendanceSchedules() {
    const select = document.getElementById('attendanceScheduleSelect');
    select.innerHTML = '<option value="">Seçiniz...</option>';
    
    allSchedules.forEach(schedule => {
        const branch = allBranches.find(b => b.id === schedule.branchId);
        const option = document.createElement('option');
        option.value = schedule.id;
        option.textContent = `${branch ? branch.name : 'Bilinmiyor'} - ${schedule.time}`;
        select.appendChild(option);
    });
}

async function loadAttendanceForSchedule() {
    const scheduleId = document.getElementById('attendanceScheduleSelect').value;
    const container = document.getElementById('attendanceContainer');
    const info = document.getElementById('attendanceScheduleInfo');
    
    if (!scheduleId) {
        container.innerHTML = '<p style="color: #95a5a6;">Lütfen bir saat grubu seçiniz.</p>';
        if (info) info.textContent = '';
        return;
    }
    
    try {
        const schedule = allSchedules.find(s => s.id === scheduleId);
        const branch = allBranches.find(item => item.id === schedule?.branchId);
        const lessonsCount = schedule?.lessonsCount || 8; // Default to 8 lessons if not set
        const studentsInClass = allStudents.filter(s => s.scheduleId === scheduleId);
        const postponementCount = getSchedulePostponementCount(schedule);

        if (info && schedule) {
            info.textContent = `${branch ? branch.name : 'Bilinmeyen şube'} • ${schedule.time || '-'} • ${getScheduleLessonTypeLabel(schedule)}${postponementCount ? ` • ${postponementCount} erteleme` : ''}`;
        }
        
        if (studentsInClass.length === 0) {
            container.innerHTML = '<p style="color: #95a5a6;">Bu saat grubunda öğrenci bulunmamaktadır.</p>';
            return;
        }
        
        // Tüm dönem kayıtlarından her ders için son durumu al.
        // Böylece önceki gün işaretlenen 5. ders, ertesi gün 6. derse geçerken görünmeye devam eder.
        const attendanceSnap = await db.collection('attendance')
            .where('scheduleId', '==', scheduleId)
            .get();
        const today = new Date().toISOString().split('T')[0];
        
        const attendanceMap = {};
        const attendanceTsMap = {};
        attendanceSnap.docs.forEach(doc => {
            const data = doc.data();
            if (!Number.isFinite(Number(data.lessonNumber))) return;
            const key = `${data.studentId}_${data.lessonNumber}`;
            const recordTs = getAttendanceRecordTimestamp(data);

            if (!Object.prototype.hasOwnProperty.call(attendanceTsMap, key) || recordTs >= attendanceTsMap[key]) {
                attendanceTsMap[key] = recordTs;
                attendanceMap[key] = data.present;
            }
        });
        
        let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px;">';
        
        studentsInClass.forEach(student => {
            html += `
                <div style="padding: 15px; background: #f9f9f9; border: 2px solid #ddd; border-radius: 5px;">
                    <h4 style="margin: 0 0 15px 0; color: #2c3e50;">${student.name} ${student.surname}</h4>
                    <div style="display: grid; grid-template-columns: repeat(${Math.min(lessonsCount, 5)}, 1fr); gap: 8px;">
            `;
            
            for (let lessonNum = 1; lessonNum <= lessonsCount; lessonNum++) {
                const key = `${student.id}_${lessonNum}`;
                const isPresent = attendanceMap[key];
                const bgColor = isPresent === true ? '#d4edda' : isPresent === false ? '#f8d7da' : '#e9ecef';
                const textColor = isPresent === true ? '#155724' : isPresent === false ? '#721c24' : '#495057';
                const displayText = isPresent === true ? '✓' : isPresent === false ? '✗' : '?';
                
                html += `
                    <button class="lesson-box" 
                            onclick="toggleLessonAttendance('${student.id}', '${scheduleId}', ${lessonNum}, '${today}')"
                            style="padding: 12px; background: ${bgColor}; border: 1px solid #ccc; border-radius: 3px; cursor: pointer; font-weight: bold; color: ${textColor}; transition: all 0.2s;">
                        Ders ${lessonNum}: ${displayText}
                    </button>
                `;
            }
            
            html += `
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Yoklama yüklenirken hata:', error);
        container.innerHTML = '<p style="color: #e74c3c;">Hata oluştu: ' + error.message + '</p>';
    }
}

async function markAttendance(studentId, scheduleId, present, date) {
    try {
        // Check if attendance record exists
        const existingSnap = await db.collection('attendance')
            .where('studentId', '==', studentId)
            .where('scheduleId', '==', scheduleId)
            .where('date', '==', date)
            .get();
        
        if (existingSnap.docs.length > 0) {
            // Update
            await db.collection('attendance').doc(existingSnap.docs[0].id).update({
                present: present,
                updatedAt: new Date().toISOString()
            });
        } else {
            // Create
            await db.collection('attendance').add({
                studentId: studentId,
                scheduleId: scheduleId,
                trainerId: currentTrainer.id,
                date: date,
                present: present,
                createdAt: new Date().toISOString()
            });
        }
        
        // Refresh display
        await loadAttendanceForSchedule();
    } catch (error) {
        alert('Yoklama kaydedilirken hata: ' + error.message);
    }
}

// Ders bazlı yoklama kaydı (her ders için ayrı)
async function toggleLessonAttendance(studentId, scheduleId, lessonNumber, date) {
    try {
        // Mevcut durumu kontrol et
        const existingSnap = await db.collection('attendance')
            .where('studentId', '==', studentId)
            .where('scheduleId', '==', scheduleId)
            .where('lessonNumber', '==', lessonNumber)
            .get();
        
        const sortedDocs = existingSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => getAttendanceRecordTimestamp(b) - getAttendanceRecordTimestamp(a));

        let currentState = null;
        if (sortedDocs.length > 0) {
            currentState = sortedDocs[0].present;
        }
        
        // Durumu döndür: null -> true -> false -> null
        let newState;
        if (currentState === null || currentState === undefined) {
            newState = true; // Geldi
        } else if (currentState === true) {
            newState = false; // Gelmedi
        } else {
            newState = null; // Temizle
        }
        
        if (sortedDocs.length > 0) {
            const latestDocId = sortedDocs[0].id;
            if (newState === null) {
                // Sil
                await db.collection('attendance').doc(latestDocId).delete();
            } else {
                // Güncelle
                await db.collection('attendance').doc(latestDocId).update({
                    present: newState,
                    date: date,
                    adminId: currentTrainer.adminId || '',
                    updatedAt: new Date().toISOString()
                });
            }
        } else if (newState !== null) {
            // Yeni kayıt oluştur
            await db.collection('attendance').add({
                studentId: studentId,
                scheduleId: scheduleId,
                trainerId: currentTrainer.id,
                lessonNumber: lessonNumber,
                date: date,
                present: newState,
                adminId: currentTrainer.adminId || '',
                createdAt: new Date().toISOString()
            });
        }
        
        // Ekranı yenile
        await loadAttendanceForSchedule();
    } catch (error) {
        alert('Ders yoklaması kaydedilirken hata: ' + error.message);
        console.error(error);
    }
}

function getAttendanceRecordTimestamp(record) {
    if (!record) return 0;

    const parseValue = value => {
        if (!value) return 0;
        if (typeof value.toDate === 'function') {
            return value.toDate().getTime();
        }
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : 0;
        }
        if (value && typeof value.seconds === 'number') {
            return value.seconds * 1000;
        }
        const ts = new Date(value).getTime();
        return Number.isFinite(ts) ? ts : 0;
    };

    return Math.max(
        parseValue(record.updatedAt),
        parseValue(record.createdAt),
        parseValue(record.date)
    );
}

// ======================== CHRONOMETER SCREEN ========================

async function loadChronometerWorkouts() {
    const select = document.getElementById('chronometerWorkoutSelect');
    select.innerHTML = '<option value="">Seçiniz...</option>';
    
    allWorkouts.forEach(workout => {
        const option = document.createElement('option');
        option.value = workout.id;
        option.textContent = workout.name;
        select.appendChild(option);
    });
}

async function initializeChronometerScreen() {
    const workoutId = document.getElementById('chronometerWorkoutSelect').value;
    if (!workoutId) {
        document.getElementById('chronometerLaunchBtn').style.display = 'none';
        document.getElementById('chronometerScreenContainer').innerHTML = '';
        return;
    }
    
    document.getElementById('chronometerLaunchBtn').style.display = 'inline-block';
}

function launchChronometerFullscreen() {
    const workoutId = document.getElementById('chronometerWorkoutSelect').value;
    const workout = allWorkouts.find(w => w.id === workoutId);
    
    if (!workout) return;
    
    currentWorkout = workout;
    currentExerciseIndex = 0;
    isRunning = false;
    isPaused = false;
    chronometerTime = 0;
    isRestTime = false;
    
    document.getElementById('chronometerModal').classList.add('active');
    document.getElementById('workoutTitle').textContent = workout.name;
    
    updateChronometerDisplay();
    displayExerciseList();
    updateCurrentExerciseInfo();
}

// ======================== PDF GENERATION ========================

async function loadClubProfile() {
    try {
        // Get trainer's admin from user document
        const trainerDoc = await db.collection('users').doc(currentTrainer.id).get();
        if (!trainerDoc.exists) return;
        
        const adminId = trainerDoc.data().adminId;
        if (!adminId) return;
        
        const clubProfile = await db.collection('clubProfiles').doc(adminId).get();
        if (clubProfile.exists) {
            const data = clubProfile.data();
            
            // Update header with club info
            const header = document.querySelector('.header');
            if (header && data.clubName) {
                let headerContent = header.innerHTML;
                
                // Check if club info already exists
                if (!header.querySelector('.club-header-info')) {
                    let clubHtml = `<div class="club-header-info" style="display: flex; align-items: center; gap: 10px;">`;
                    
                    if (data.logoUrl) {
                        clubHtml += `<img src="${data.logoUrl}" style="height: 40px; border-radius: 5px;">`;
                    }
                    
                    clubHtml += `<div><strong>${data.clubName}</strong></div></div>`;
                    
                    // Insert club info at the beginning of header left div
                    const headerLeft = header.querySelector('div:first-child');
                    if (headerLeft) {
                        headerLeft.insertAdjacentHTML('afterbegin', clubHtml);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Klub profili yüklenirken hata:', error);
    }
}

async function generateWorkoutPDF(workoutId) {
    const workout = allWorkouts.find(w => w.id === workoutId);
    if (!workout) return;
    try {
        // Load club profile
        let clubName = 'Yüzme Kulübü';
        let clubLogo = null;
        // Get trainer's adminId from user doc
        const trainerDoc = await db.collection('users').doc(currentTrainer.id).get();
        let adminId = currentTrainer.id;
        if (trainerDoc.exists && trainerDoc.data().adminId) {
            adminId = trainerDoc.data().adminId;
        }
        const clubProfile = await db.collection('clubProfiles').doc(adminId).get();
        if (clubProfile.exists) {
            clubName = clubProfile.data().clubName || clubName;
            clubLogo = clubProfile.data().logoUrl || null;
        }
        // Create PDF using jsPDF
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let yPosition = 15;
        // Header with logo and club name
        if (clubLogo) {
            doc.addImage(clubLogo, 'PNG', 15, yPosition, 30, 30);
        }
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text(clubName, clubLogo ? 50 : 15, yPosition + 12);
        yPosition += 40;
        // Title and date
        doc.setFontSize(14);
        const today = new Date().toLocaleDateString('tr-TR');
        doc.text(`${today} Antrenmanı`, 15, yPosition);
        yPosition += 15;
        // Workout details
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        doc.text(`Antrenman: ${workout.name}`, 15, yPosition);
        yPosition += 10;
        // Exercises
        doc.setFont(undefined, 'bold');
        doc.text('Egzersizler:', 15, yPosition);
        yPosition += 8;
        doc.setFont(undefined, 'normal');
        workout.exercises.forEach((ex, idx) => {
            const text = `${idx + 1}. ${ex.distance}m ${ex.style} - ${ex.restSeconds}s ara`;
            doc.text(text, 20, yPosition);
            yPosition += 6;
            if (yPosition > pageHeight - 15) {
                doc.addPage();
                yPosition = 15;
            }
        });
        // Save PDF
        doc.save(`${today}-antrenman.pdf`);
        alert('PDF başarıyla indirildi!');
    } catch (error) {
        console.error('PDF oluşturulurken hata:', error);
        alert('PDF oluşturulurken hata: ' + error.message);
    }
}
// --- END PATCH ---
// ======================== PERFORMANCE TRACKING ========================

async function loadPerformanceStudents() {
    const select = document.getElementById('performanceStudentSelect');
    select.innerHTML = '<option value="">-- Öğrenci Seçiniz --</option>';

    const branchFilter = document.getElementById('perfBranchFilter')?.value || '';
    const scheduleFilter = document.getElementById('perfScheduleFilter')?.value || '';

    // Filter students by selected branch/schedule
    let filteredStudents = allStudents;
    if (branchFilter || scheduleFilter) {
        filteredStudents = allStudents.filter(student => {
            const studentSchedule = allSchedules.find(s => s.id === student.scheduleId);
            if (!studentSchedule) return false;
            if (branchFilter && studentSchedule.branchId !== branchFilter) return false;
            if (scheduleFilter && student.scheduleId !== scheduleFilter) return false;
            return true;
        });
    }

    // Populate select
    filteredStudents.forEach(student => {
        const option = document.createElement('option');
        option.value = student.id;
        option.textContent = `${student.name} ${student.surname}`;
        select.appendChild(option);
    });

    // Hide form and history initially
    document.getElementById('performanceEntryForm').style.display = 'none';
    document.getElementById('performanceHistory').style.display = 'none';
}

// Initialize branch/schedule dropdowns for performance input
function initializePerformanceInputDropdowns() {
    const branchSelect = document.getElementById('perfBranchFilter');
    const scheduleSelect = document.getElementById('perfScheduleFilter');
    if (!branchSelect || !scheduleSelect) return;

    branchSelect.innerHTML = '<option value="">-- Tüm Şubeler --</option>';
    allBranches.sort((a, b) => (a.name || '').localeCompare(b.name)).forEach(branch => {
        const opt = document.createElement('option');
        opt.value = branch.id;
        opt.textContent = branch.name;
        branchSelect.appendChild(opt);
    });

    // Populate schedules (all by default)
    scheduleSelect.innerHTML = '<option value="">-- Tüm Saatler --</option>';
    const schedules = allSchedules.slice().sort((a, b) => (a.time || '').localeCompare(b.time));
    schedules.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.time || 'Saat tanımlanmamış';
        scheduleSelect.appendChild(opt);
    });
}

// Update schedule dropdown when branch changes (performance input)
function updatePerfScheduleFilter() {
    const branchFilter = document.getElementById('perfBranchFilter')?.value || '';
    const scheduleSelect = document.getElementById('perfScheduleFilter');
    if (!scheduleSelect) return;

    let schedules = allSchedules;
    if (branchFilter) schedules = schedules.filter(s => s.branchId === branchFilter);
    schedules.sort((a, b) => (a.time || '').localeCompare(b.time));

    scheduleSelect.innerHTML = '<option value="">-- Tüm Saatler --</option>';
    schedules.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.time || 'Saat tanımlanmamış';
        scheduleSelect.appendChild(opt);
    });

    // Refresh students list after schedule change
    loadPerformanceStudents();
}

function togglePerformanceType() {
    const type = document.querySelector('input[name="performanceType"]:checked').value;
    const titleElement = document.getElementById('performanceFormTitle');
    titleElement.textContent = type === 'training' ? 'Yeni Antrenman Derecesi' : 'Yeni Yarış Derecesi';

    // Update distance options based on style
    updateDistanceOptions();
}

function updateDistanceOptions() {
    const style = document.getElementById('performanceStyle').value;
    const distanceSelect = document.getElementById('performanceDistance');
    if (!distanceSelect) return;
    const currentValue = distanceSelect.value;
    distanceSelect.innerHTML = '<option value="">-- Mesafe Seçiniz --</option>';

    const distances = {
        'Serbest': [50, 100, 200, 400, 800, 1500],
        'Sırt': [50, 100, 200],
        'Kurbağa': [50, 100, 200],
        'Kelebek': [50, 100, 200],
        'Karışık': [100, 200, 400]
    };

    if (distances[style]) {
        distances[style].forEach(distance => {
            const option = document.createElement('option');
            option.value = distance;
            option.textContent = `${distance}m`;
            distanceSelect.appendChild(option);
        });

        if (distances[style].map(String).includes(String(currentValue))) {
            distanceSelect.value = String(currentValue);
        }
    }
}

async function loadStudentPerformances() {
    const studentId = document.getElementById('performanceStudentSelect').value;
    const formDiv = document.getElementById('performanceEntryForm');
    const historyDiv = document.getElementById('performanceHistory');

    if (!studentId) {
        formDiv.style.display = 'none';
        historyDiv.style.display = 'none';
        return;
    }

    formDiv.style.display = 'block';
    historyDiv.style.display = 'block';

    // Set default date to today
    document.getElementById('performanceDate').valueAsDate = new Date();

    // Update distance options initially
    updateDistanceOptions();

    // Load existing performances
    await loadPerformanceHistory(studentId);
}

async function fetchPerformancesByStudentIds(studentIds) {
    const ids = [...new Set((studentIds || []).filter(Boolean))];
    if (!ids.length) {
        return [];
    }

    const performances = [];
    for (let index = 0; index < ids.length; index += 10) {
        const chunk = ids.slice(index, index + 10);
        if (!chunk.length) continue;

        const snapshot = await db.collection('performances')
            .where('studentId', 'in', chunk)
            .get();

        snapshot.docs.forEach(doc => {
            performances.push({ id: doc.id, ...doc.data() });
        });
    }

    return performances;
}

async function loadPerformanceHistory(studentId) {
    try {
        const performances = (await fetchPerformancesByStudentIds([studentId]))
            .filter(perf => perf.studentId === studentId);
        
        // Sort client-side by date and createdAt
        performances.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            if (dateA.getTime() !== dateB.getTime()) {
                return dateB - dateA; // newest date first
            }
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        const container = document.getElementById('performanceList');
        container.innerHTML = '';

        if (performances.length === 0) {
            container.innerHTML = '<p style="color: #95a5a6; text-align: center; padding: 20px;">Henüz derece kaydı bulunmamaktadır.</p>';
            return;
        }

        // Group performances by style and distance
        const groupedPerformances = {};
        performances.forEach(perf => {
            const key = `${perf.style}_${perf.distance}`;
            if (!groupedPerformances[key]) {
                groupedPerformances[key] = [];
            }
            groupedPerformances[key].push(perf);
        });

        // Display each group
        Object.keys(groupedPerformances).forEach(key => {
            const [style, distance] = key.split('_');
            const groupPerformances = groupedPerformances[key].sort((a, b) => {
                // Sort by time (faster first)
                return timeToSeconds(a.time) - timeToSeconds(b.time);
            });

            const bestTime = groupPerformances[0];
            const latestTime = groupPerformances[0]; // Latest is now the first (newest)
            
            // Find previous performance (chronologically, not just second-best)
            let improvementHtml = '';
            if (groupPerformances.length > 1) {
                // groupPerformances is sorted by speed (fastest first), but we need chronological order
                const chronoSorted = [...groupPerformances].sort((a, b) => 
                    new Date(b.date) - new Date(a.date) || 
                    new Date(b.createdAt) - new Date(a.createdAt)
                );
                
                if (chronoSorted.length > 1) {
                    const previousPerf = chronoSorted[1]; // Second newest
                    const currentPerf = chronoSorted[0]; // Newest
                    const currentSeconds = timeToSeconds(currentPerf.time);
                    const previousSeconds = timeToSeconds(previousPerf.time);
                    const improvement = previousSeconds - currentSeconds; // positive = faster
                    
                    if (improvement > 0) {
                        // Got faster (green up arrow)
                        improvementHtml = `<span style="color: #27ae60; font-weight: bold; font-size: 1.1em;">⬆️ ${formatTimeDifference(improvement)} daha hızlı</span>`;
                    } else if (improvement < 0) {
                        // Got slower (red down arrow)
                        improvementHtml = `<span style="color: #e74c3c; font-weight: bold; font-size: 1.1em;">⬇️ ${formatTimeDifference(Math.abs(improvement))} daha yavaş</span>`;
                    }
                }
            }

            const card = document.createElement('div');
            card.style.cssText = 'background: #f9f9f9; border-radius: 8px; padding: 15px; margin-bottom: 15px; border-left: 4px solid #3498db;';

            let performancesHtml = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 10px;">';
            groupPerformances.slice(0, 5).forEach(perf => {
                const isBest = perf.id === bestTime.id;
                const badgeColor = perf.type === 'competition' ? '#e74c3c' : '#3498db';
                const badgeText = perf.type === 'competition' ? 'YARIŞ' : 'ANTR';

                performancesHtml += `
                    <div style="background: white; padding: 10px; border-radius: 5px; border: 2px ${isBest ? 'solid #27ae60' : 'solid #e0e0e0'};">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <span style="background: ${badgeColor}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em; font-weight: bold;">${badgeText}</span>
                            ${isBest ? '<span style="color: #27ae60; font-weight: bold;">🏆 EN İYİ</span>' : ''}
                        </div>
                        <div style="font-size: 1.2em; font-weight: bold; color: #2c3e50;">${perf.time}</div>
                        <div style="color: #7f8c8d; font-size: 0.9em;">${new Date(perf.date).toLocaleDateString('tr-TR')}</div>
                    </div>
                `;
            });
            performancesHtml += '</div>';

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3 style="margin: 0; color: #2c3e50;">${distance}m ${style}</h3>
                    <div style="text-align: right;">
                        <div style="font-size: 1.1em; font-weight: bold; color: #27ae60;">${bestTime.time}</div>
                        <div style="font-size: 0.9em; color: #7f8c8d;">En iyi süre</div>
                        ${improvementHtml}
                    </div>
                </div>
                ${performancesHtml}
            `;

            container.appendChild(card);
        });

    } catch (error) {
        console.error('Dereceler yüklenirken hata:', error);
        document.getElementById('performanceList').innerHTML = '<p style="color: #e74c3c;">Dereceler yüklenirken hata oluştu.</p>';
    }
}

async function savePerformance() {
    const studentId = document.getElementById('performanceStudentSelect').value;
    const style = document.getElementById('performanceStyle').value;
    const distance = document.getElementById('performanceDistance').value;
    const time = document.getElementById('performanceTime').value.trim();
    const date = document.getElementById('performanceDate').value;
    const type = document.querySelector('input[name="performanceType"]:checked').value;

    if (!studentId || !style || !distance || !time || !date) {
        alert('Lütfen tüm alanları doldurunuz!');
        return;
    }

    // Validate time format (MM:SS.ss or M:SS.ss)
    if (!/^(\d{1,2}):(\d{2})\.(\d{1,2})$/.test(time)) {
        alert('Derece formatı geçersiz! Örnek: 1:30.45');
        return;
    }

    try {
        const performanceData = {
            studentId: studentId,
            trainerId: currentTrainer.id,
            adminId: currentTrainer.adminId,
            style: style,
            distance: parseInt(distance),
            time: time,
            type: type,
            date: date,
            createdAt: new Date().toISOString()
        };

        await db.collection('performances').add(performanceData);

        alert('Derece başarıyla kaydedildi!');
        document.getElementById('performanceTime').value = '';

        // Reload performances
        await loadPerformanceHistory(studentId);

    } catch (error) {
        alert('Derece kaydedilirken hata: ' + error.message);
        console.error('Performance save error:', error);
    }
}

// ======================== PERFORMANCE REPORT ========================

async function updateReportScheduleFilter() {
    const branchFilter = document.getElementById('reportBranchFilter')?.value || '';
    const scheduleSelect = document.getElementById('reportScheduleFilter');
    
    // Get schedules for selected branch
    let schedules = allSchedules;
    if (branchFilter) {
        schedules = schedules.filter(s => s.branchId === branchFilter);
    }
    
    // Sort by time
    schedules.sort((a, b) => (a.time || '').localeCompare(b.time));
    
    // Populate schedule dropdown
    scheduleSelect.innerHTML = '<option value="">-- Tüm Saatler --</option>';
    schedules.forEach(schedule => {
        const timeStr = schedule.time ? `${schedule.time}` : 'Saat tanımlanmamış';
        const option = document.createElement('option');
        option.value = schedule.id;
        option.textContent = timeStr;
        scheduleSelect.appendChild(option);
    });

    updateReportStudentFilter();
}

function getReportFilteredStudents() {
    const branchFilter = document.getElementById('reportBranchFilter')?.value || '';
    const scheduleFilter = document.getElementById('reportScheduleFilter')?.value || '';

    return allStudents.filter(student => {
        if (branchFilter) {
            const studentSchedule = allSchedules.find(schedule => schedule.id === student.scheduleId);
            if (!studentSchedule || studentSchedule.branchId !== branchFilter) {
                return false;
            }
        }

        if (scheduleFilter && student.scheduleId !== scheduleFilter) {
            return false;
        }

        return true;
    });
}

function updateReportStudentFilter() {
    const studentSelect = document.getElementById('reportStudentFilter');
    if (!studentSelect) return;

    const previousValue = studentSelect.value || '';
    const filteredStudents = getReportFilteredStudents()
        .sort((left, right) => `${left.name || ''} ${left.surname || ''}`.localeCompare(`${right.name || ''} ${right.surname || ''}`, 'tr'));

    studentSelect.innerHTML = '<option value="">-- Tüm Sporcular --</option>';
    filteredStudents.forEach(student => {
        const option = document.createElement('option');
        option.value = student.id;
        option.textContent = `${student.name || ''} ${student.surname || ''}`.trim();
        studentSelect.appendChild(option);
    });

    if (previousValue && filteredStudents.some(student => student.id === previousValue)) {
        studentSelect.value = previousValue;
    }

    loadPerformanceReport();
}

async function initializePerformanceReportDropdowns() {
    const branchSelect = document.getElementById('reportBranchFilter');
    const scheduleSelect = document.getElementById('reportScheduleFilter');
    const studentSelect = document.getElementById('reportStudentFilter');
    
    if (!branchSelect || !scheduleSelect || !studentSelect) return;
    
    // Populate branch dropdown
    branchSelect.innerHTML = '<option value="">-- Tüm Şubeler --</option>';
    allBranches.sort((a, b) => (a.name || '').localeCompare(b.name));
    allBranches.forEach(branch => {
        const option = document.createElement('option');
        option.value = branch.id;
        option.textContent = branch.name;
        branchSelect.appendChild(option);
    });
    
    // Populate schedules for default (all)
    scheduleSelect.innerHTML = '<option value="">-- Tüm Saatler --</option>';
    let schedules = allSchedules.sort((a, b) => (a.time || '').localeCompare(b.time));
    schedules.forEach(s => {
        const timeStr = s.time ? `${s.time}` : 'Saat tanımlanmamış';
        const option = document.createElement('option');
        option.value = s.id;
        option.textContent = timeStr;
        scheduleSelect.appendChild(option);
    });

    updateReportStudentFilter();
}

async function loadPerformanceReport() {
    try {
        const branchFilter = document.getElementById('reportBranchFilter')?.value || '';
        const scheduleFilter = document.getElementById('reportScheduleFilter')?.value || '';
        const styleFilter = document.getElementById('reportStyleFilter')?.value || '';
        const studentFilter = document.getElementById('reportStudentFilter')?.value || '';
        const container = document.getElementById('performanceReportContainer');

        // Filter students based on branch and schedule
        let filteredStudents = allStudents;
        
        if (branchFilter || scheduleFilter) {
            filteredStudents = allStudents.filter(student => {
                let matches = true;
                
                if (branchFilter) {
                    const studentSchedule = allSchedules.find(s => s.id === student.scheduleId);
                    if (!studentSchedule || studentSchedule.branchId !== branchFilter) {
                        matches = false;
                    }
                }
                
                if (scheduleFilter && student.scheduleId !== scheduleFilter) {
                    matches = false;
                }
                
                return matches;
            });
        }

        if (studentFilter) {
            filteredStudents = filteredStudents.filter(student => student.id === studentFilter);
        }
        
        const filteredStudentIds = new Set(filteredStudents.map(s => s.id));

        const performances = await fetchPerformancesByStudentIds([...filteredStudentIds]);

        if (performances.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 40px;">Henüz derece kaydı bulunmamaktadır.</p>';
            return;
        }
        
        // Group by student, filtered
        const studentPerformances = {};
        performances.forEach(perf => {
            if (!filteredStudentIds.has(perf.studentId)) return;
            
            if (!studentPerformances[perf.studentId]) {
                studentPerformances[perf.studentId] = [];
            }
            studentPerformances[perf.studentId].push(perf);
        });
        
        let html = '';
        
        // Process each student
        for (const studentId in studentPerformances) {
            const perfs = studentPerformances[studentId];
            const student = filteredStudents.find(s => s.id === studentId);
            
            if (!student) continue;
            
            // Group by style and distance
            const grouped = {};
            perfs.forEach(perf => {
                const key = `${perf.style}_${perf.distance}`;
                if (!grouped[key]) {
                    grouped[key] = [];
                }
                grouped[key].push(perf);
            });
            
            let studentHtml = `<div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid #3498db; margin-bottom: 20px;">
                <h3 style="margin: 0 0 20px 0; color: #2c3e50;">${student.name} ${student.surname}</h3>`;
            
            // Separate Training and Competition
            const trainingPerfs = {};
            const competitionPerfs = {};
            
            for (const key in grouped) {
                const [style, distance] = key.split('_');
                
                // Apply style filter
                if (styleFilter && style !== styleFilter) continue;
                
                const groupPerfs = grouped[key];
                
                // Separate by type
                groupPerfs.forEach(perf => {
                    const targetObj = perf.type === 'competition' ? competitionPerfs : trainingPerfs;
                    if (!targetObj[key]) {
                        targetObj[key] = [];
                    }
                    targetObj[key].push(perf);
                });
            }
            
            // Render Training
            if (Object.keys(trainingPerfs).length > 0) {
                studentHtml += `<div style="margin-bottom: 20px;">
                    <h4 style="color: #3498db; margin-bottom: 12px;">🏋️ Antrenman Dereceleri</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">`;
                
                for (const key in trainingPerfs) {
                    const [style, distance] = key.split('_');
                    const groupPerfs = trainingPerfs[key].sort((a, b) => {
                        const dateA = new Date(a.date);
                        const dateB = new Date(b.date);
                        return dateB - dateA;
                    });
                    
                    const bestTime = groupPerfs.reduce((min, p) => 
                        timeToSeconds(p.time) < timeToSeconds(min.time) ? p : min
                    );
                    
                    studentHtml += renderPerformanceCard(distance, style, bestTime, groupPerfs, student);
                }
                
                studentHtml += '</div></div>';
            }
            
            // Render Competition
            if (Object.keys(competitionPerfs).length > 0) {
                studentHtml += `<div>
                    <h4 style="color: #e74c3c; margin-bottom: 12px;">🏅 Yarış Dereceleri</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">`;
                
                for (const key in competitionPerfs) {
                    const [style, distance] = key.split('_');
                    const groupPerfs = competitionPerfs[key].sort((a, b) => {
                        const dateA = new Date(a.date);
                        const dateB = new Date(b.date);
                        return dateB - dateA;
                    });
                    
                    const bestTime = groupPerfs.reduce((min, p) => 
                        timeToSeconds(p.time) < timeToSeconds(min.time) ? p : min
                    );
                    
                    studentHtml += renderPerformanceCard(distance, style, bestTime, groupPerfs, student);
                }
                
                studentHtml += '</div></div>';
            }
            
            studentHtml += '</div>';
            html += studentHtml;
        }
        
        if (!html) {
            container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 40px;">Seçilen filtreye ait derece kaydı bulunmamaktadır.</p>';
            return;
        }
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Rapor yüklenirken hata:', error);
        document.getElementById('performanceReportContainer').innerHTML = '<p style="color: #e74c3c;">Rapor yüklenirken hata oluştu: ' + error.message + '</p>';
    }
}

// Global cache for performance details
let performanceDetailsCache = {};
let performanceDetailCounter = 0;

// Render a single performance card (clickable)
function buildPerformanceTrendHtml(groupPerfs) {
    if (groupPerfs.length < 2) return '';

    const { latest, previous } = getClosestPreviousPerformance(groupPerfs);
    if (!latest || !previous) return '';
    const difference = timeToSeconds(previous.time) - timeToSeconds(latest.time);
    const previousDateLabel = previous.date ? new Date(previous.date).toLocaleDateString('tr-TR') : 'önceki sonuç';

    if (!Number.isFinite(difference)) {
        return '<div style="color: #7f8c8d; font-weight: 600; font-size: 0.9em; margin-top: 8px;">→ Trend hesaplanamadı</div>';
    }

    if (difference > 0) {
        return `<div style="color: #27ae60; font-weight: bold; font-size: 0.95em; margin-top: 8px;">⬆️ ${previousDateLabel} sonucuna göre ${formatTimeDifference(difference)} daha hızlı</div>`;
    }

    if (difference < 0) {
        return `<div style="color: #e74c3c; font-weight: bold; font-size: 0.95em; margin-top: 8px;">⬇️ ${previousDateLabel} sonucuna göre ${formatTimeDifference(Math.abs(difference))} daha yavaş</div>`;
    }

    return `<div style="color: #7f8c8d; font-weight: 600; font-size: 0.9em; margin-top: 8px;">→ ${previousDateLabel} sonucuyla aynı derece</div>`;
}

function buildStandardStatusHtml(student, style, distance, referencePerformance) {
    const birthYear = getStudentBirthYear(student);
    if (!birthYear) {
        return '<div style="margin-top: 10px; color: #95a5a6; font-size: 0.9em;">Doğum yılı olmadığı için baraj karşılaştırması yapılamadı.</div>';
    }

    const normalizedStyle = normalizePerformanceStyleToStandard(style);
    const referenceSeconds = timeToSeconds(referencePerformance.time);
    if (!Number.isFinite(referenceSeconds)) {
        return '<div style="margin-top: 10px; color: #95a5a6; font-size: 0.9em;">Geçerli derece zamanı olmadığı için baraj karşılaştırması yapılamadı.</div>';
    }

    const matchingStandards = allStandards.filter(standard => {
        const matchesBirthYear = doesTrainerStandardMatchBirthYear(standard, birthYear);
        const sameStyle = standard.style === normalizedStyle;
        const sameDistance = Number(standard.distance) === Number(distance);
        const sameGender = !student.gender || !standard.gender || standard.gender === student.gender;
        return matchesBirthYear && sameStyle && sameDistance && sameGender && Number.isFinite(timeToSeconds(standard.time));
    }).sort((a, b) => Number(b.birthYear) - Number(a.birthYear) || (timeToSeconds(a.time) - timeToSeconds(b.time)));

    if (!matchingStandards.length) {
        return '<div style="margin-top: 10px; color: #95a5a6; font-size: 0.9em;">Bu branş ve mesafe için eşleşen baraj bulunamadı.</div>';
    }

    const passedStandards = matchingStandards
        .filter(standard => referenceSeconds <= timeToSeconds(standard.time))
        .sort((a, b) => timeToSeconds(a.time) - timeToSeconds(b.time) || Number(b.birthYear || 0) - Number(a.birthYear || 0));

    if (!passedStandards.length) {
        const nearestStandard = [...matchingStandards]
            .sort((a, b) => Math.abs(referenceSeconds - timeToSeconds(a.time)) - Math.abs(referenceSeconds - timeToSeconds(b.time)) || timeToSeconds(a.time) - timeToSeconds(b.time))[0];
        const gap = referenceSeconds - timeToSeconds(nearestStandard.time);
        const standardLabel = getTrainerReadableStandardReference(nearestStandard, style, distance);
        return `
            <div style="margin-top: 10px; font-size: 0.9em; line-height: 1.5;">
                <div style="color: #c0392b;"><strong>Barajı kaçırdı.</strong> ${standardLabel}</div>
                <div style="color: #c0392b;"><strong>${nearestStandard.time}</strong> barajını ${formatTimeDifference(gap)} ile kaçırdı.</div>
            </div>
        `;
    }

    const strongestPassed = passedStandards[0];
    const margin = timeToSeconds(strongestPassed.time) - referenceSeconds;
    const standardLabel = getTrainerReadableStandardReference(strongestPassed, style, distance);

    return `
        <div style="margin-top: 10px; font-size: 0.9em; line-height: 1.5;">
            <div style="color: #27ae60;"><strong>Barajı geçti.</strong> ${standardLabel}</div>
            <div style="color: #27ae60;"><strong>${strongestPassed.time}</strong> barajını ${formatTimeDifference(margin)} ile geçti.</div>
        </div>
    `;
}

function renderPerformanceCard(distance, style, bestTime, groupPerfs, student) {
    const { latest, previous, chronological } = getClosestPreviousPerformance(groupPerfs);
    const latestPerformance = latest || bestTime;
    const improvementHtml = buildPerformanceTrendHtml(groupPerfs);
    const standardStatusHtml = buildStandardStatusHtml(student, style, distance, latestPerformance);
    const latestIsBest = latestPerformance && bestTime && latestPerformance.id === bestTime.id;
    const previousReferenceHtml = previous
        ? `<div style="font-size: 0.82em; color: #7f8c8d; margin-bottom: 6px;">Önceki sonuç: ${previous.time} • ${new Date(previous.date).toLocaleDateString('tr-TR')}</div>`
        : '<div style="font-size: 0.82em; color: #95a5a6; margin-bottom: 6px;">Karşılaştırma için önceki sonuç yok</div>';
    
    // Store in cache with unique ID
    const cardId = 'perf_' + (performanceDetailCounter++);
    performanceDetailsCache[cardId] = {
        distance, style, groupPerfs, studentName: student.name, studentSurname: student.surname
    };
    
    return `
        <div style="background: #f9f9f9; padding: 12px; border-radius: 5px; border: 1px solid #e0e0e0; cursor: pointer; transition: all 0.2s;" 
             onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'; this.style.borderColor='#3498db';" 
             onmouseout="this.style.boxShadow='none'; this.style.borderColor='#e0e0e0';"
             onclick="showPerformanceDetail('${cardId}')">
            <div style="font-weight: 600; color: #2c3e50; margin-bottom: 8px;">${distance}m ${style}</div>
            <div style="font-size: 1.3em; font-weight: bold; color: #2c3e50; margin-bottom: 5px;">${latestPerformance.time}</div>
            <div style="font-size: 0.85em; color: #7f8c8d; margin-bottom: 5px;">Son derece</div>
            ${previousReferenceHtml}
            <div style="font-size: 0.95em; font-weight: 600; color: ${latestIsBest ? '#27ae60' : '#2980b9'}; margin-bottom: 5px;">En iyi derece: ${bestTime.time}${latestIsBest ? ' • son derece ile ayni' : ''}</div>
            <div style="font-size: 0.9em; color: #7f8c8d; margin-bottom: 8px;">Toplam: ${groupPerfs.length} derece</div>
            ${improvementHtml}
            ${standardStatusHtml}
        </div>
    `;
}

// Show performance detail modal
function showPerformanceDetail(cardId) {
    const data = performanceDetailsCache[cardId];
    if (!data) return;
    
    const { distance, style, groupPerfs, studentName, studentSurname } = data;
    const modal = document.getElementById('performanceDetailModal');
    const title = document.getElementById('detailModalTitle');
    const content = document.getElementById('detailModalContent');
    
    title.textContent = `${distance}m ${style} - ${studentName} ${studentSurname}`;
    
    // Sort by date descending
    const sorted = groupPerfs.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA.getTime() !== dateB.getTime()) {
            return dateB - dateA;
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    let html = '<div style="display: grid; gap: 10px;">';
    
    sorted.forEach((perf, index) => {
        const badgeColor = perf.type === 'competition' ? '#e74c3c' : '#3498db';
        const badgeText = perf.type === 'competition' ? '🏅 YARIŞ' : '🏋️ ANTR';
        const isBest = index === sorted.findIndex(p => 
            timeToSeconds(p.time) === Math.min(...sorted.map(x => timeToSeconds(x.time)))
        );
        
        html += `
            <div style="background: white; padding: 12px; border-radius: 5px; border-left: 4px solid ${badgeColor};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="background: ${badgeColor}; color: white; padding: 3px 8px; border-radius: 3px; font-size: 0.85em; font-weight: bold;">${badgeText}</span>
                    ${isBest ? '<span style="color: #27ae60; font-weight: bold;">🏆 EN İYİ</span>' : ''}
                </div>
                <div style="font-size: 1.4em; font-weight: bold; color: #2c3e50; margin-bottom: 5px;">${perf.time}</div>
                <div style="color: #7f8c8d; font-size: 0.9em;">📅 ${new Date(perf.date).toLocaleDateString('tr-TR')}</div>
            </div>
        `;
    });
    
    html += '</div>';
    content.innerHTML = html;
    modal.style.display = 'flex';
}

// Close performance detail modal
function closePerformanceDetailModal() {
    document.getElementById('performanceDetailModal').style.display = 'none';
}

// Toggle performance type title
function togglePerformanceType() {
    const type = document.querySelector('input[name="performanceType"]:checked').value;
    const titleElement = document.getElementById('performanceFormTitle');
    titleElement.textContent = type === 'training' ? 'Yeni Antrenman Derecesi' : 'Yeni Yarış Derecesi';
    updateDistanceOptions();
}

// Helper functions for time calculations
function timeToSeconds(timeString) {
    if (!timeString || typeof timeString !== 'string') return Number.POSITIVE_INFINITY;

    const normalized = timeString.trim();
    if (!normalized) return Number.POSITIVE_INFINITY;

    if (!normalized.includes(':')) {
        const directNumber = Number(normalized.replace(',', '.'));
        return Number.isFinite(directNumber) ? directNumber : Number.POSITIVE_INFINITY;
    }

    const [minutesPart, secondsPartRaw] = normalized.split(':');
    const [wholeSecondsPart, centisecondsPart = '0'] = String(secondsPartRaw || '').split('.');
    const minutes = Number(minutesPart);
    const seconds = Number(wholeSecondsPart);
    const centiseconds = Number(centisecondsPart);

    if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || !Number.isFinite(centiseconds)) {
        return Number.POSITIVE_INFINITY;
    }

    return (minutes * 60) + seconds + (centiseconds / 100);
}

function formatTimeDifference(seconds) {
    if (!Number.isFinite(seconds)) return '-';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    const centiseconds = Math.round((seconds % 1) * 100);

    if (minutes > 0) {
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    } else {
        return `${remainingSeconds}.${centiseconds.toString().padStart(2, '0')} saniye`;
    }
}

function getWorkoutTypeLabel(workoutType) {
    const normalized = String(workoutType || '').trim().toLowerCase();
    if (normalized === 'sprint') return '🏃 Sprint';
    if (normalized === 'uzman' || normalized === 'uzmanlik' || normalized === 'expert' || normalized === 'specialist') return '🎯 Uzman';
    if (normalized === 'teknik' || normalized === 'technique' || normalized === 'technical') return '🔧 Teknik';
    return normalized ? `📌 ${workoutType}` : '📌 Belirtilmedi';
}

function buildWorkoutSaleMetaHtml(sale) {
    const metaItems = [
        { label: '👥 Yaş', value: sale.ageGroup || '-' },
        { label: '🎯 Hedef', value: sale.target || '-' },
        { label: '🏊 Stil', value: sale.style || 'Karma' },
        { label: '📏 Mesafe', value: sale.distance || 'Karma' },
        { label: '⚡ Tür', value: getWorkoutTypeLabel(sale.workoutType) }
    ];

    return `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin: 12px 0;">
            ${metaItems.map(item => `
                <div style="background:#fff; border:1px solid #e4ebf2; border-radius:8px; padding:10px;">
                    <div style="font-size:0.78em; color:#6b7b8b; margin-bottom:4px;">${item.label}</div>
                    <div style="font-weight:600; color:#22313f;">${item.value}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// ======================== TRAINER MARKET SYSTEM ========================

function getTrainerMarketCartItem(productId) {
    return trainerMarketCart.find(item => item.productId === productId) || null;
}

function getTrainerMarketTotals() {
    return trainerMarketCart.reduce((result, item) => {
        const quantity = Number(item.quantity || 0);
        result.itemCount += quantity;
        result.totalAmount += quantity * Number(item.unitPrice || 0);
        result.totalCredits += quantity * Number(item.unitCreditCost || 0);
        return result;
    }, { itemCount: 0, totalAmount: 0, totalCredits: 0 });
}

function addTrainerProductToCart(product) {
    const existingItem = getTrainerMarketCartItem(product.id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        trainerMarketCart.push({
            productId: product.id,
            productName: product.name || 'Urun',
            unitPrice: Number(product.price || 0),
            unitCreditCost: Number(product.creditCost || 0),
            imageUrl: product.imageUrl || '',
            quantity: 1,
        });
    }
    displayTrainerMarketProducts(allTrainerMarketProducts);
}

function updateTrainerCartQuantity(productId, delta) {
    const existingItem = getTrainerMarketCartItem(productId);
    if (!existingItem) return;
    existingItem.quantity = Math.max(1, Number(existingItem.quantity || 1) + Number(delta || 0));
    displayTrainerMarketProducts(allTrainerMarketProducts);
}

function removeTrainerCartItem(productId) {
    trainerMarketCart = trainerMarketCart.filter(item => item.productId !== productId);
    displayTrainerMarketProducts(allTrainerMarketProducts);
}

function clearTrainerCart() {
    trainerMarketCart = [];
    displayTrainerMarketProducts(allTrainerMarketProducts);
}

function normalizeTrainerMarketCardNumber(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 19);
}

function formatTrainerMarketCardNumber(value) {
    return normalizeTrainerMarketCardNumber(value).match(/.{1,4}/g)?.join(' ') || '';
}

function formatTrainerMarketCardExpiry(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) {
        return digits;
    }
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function detectTrainerMarketCardBrand(cardNumber) {
    const digits = normalizeTrainerMarketCardNumber(cardNumber);
    if (/^4/.test(digits)) return 'Visa';
    if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
    if (/^3[47]/.test(digits)) return 'American Express';
    if (/^6(?:011|5)/.test(digits)) return 'Discover';
    return 'Bilinmiyor';
}

function buildTrainerMarketCreditCardHtml() {
    return `
        <div style="margin-top:12px; padding:14px 16px; border:1px solid #ecd9c3; border-radius:12px; background:#fff9f2; color:#22313f;">
            <div style="font-size:0.82em; letter-spacing:0.05em; color:#9a6025; font-weight:700;">KREDI KARTI BILGILERI</div>
            <input id="trainerMarketCardHolder" type="text" placeholder="Kart uzerindeki ad soyad" style="width:100%; margin-top:10px; padding:12px 14px; border:1px solid #d8e3ee; border-radius:10px;">
            <input id="trainerMarketCardNumber" type="text" inputmode="numeric" maxlength="23" placeholder="Kart numarasi" oninput="this.value = formatTrainerMarketCardNumber(this.value)" style="width:100%; margin-top:10px; padding:12px 14px; border:1px solid #d8e3ee; border-radius:10px;">
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-top:10px;">
                <input id="trainerMarketCardExpiry" type="text" inputmode="numeric" maxlength="5" placeholder="AA/YY" oninput="this.value = formatTrainerMarketCardExpiry(this.value)" style="padding:12px 14px; border:1px solid #d8e3ee; border-radius:10px;">
                <input id="trainerMarketCardCvv" type="password" inputmode="numeric" maxlength="4" placeholder="CVV" oninput="this.value = this.value.replace(/\D/g, '').slice(0, 4)" style="padding:12px 14px; border:1px solid #d8e3ee; border-radius:10px;">
            </div>
            <div style="margin-top:8px; color:#6f8091; font-size:0.9em;">Guvenlik nedeniyle tam kart numarasi ve CVV siparis kaydina yazilmaz; sadece ozet bilgi tutulur.</div>
        </div>
    `;
}

function getTrainerMarketCardSnapshot() {
    const holderName = document.getElementById('trainerMarketCardHolder')?.value?.trim() || '';
    const cardNumber = normalizeTrainerMarketCardNumber(document.getElementById('trainerMarketCardNumber')?.value || '');
    const expiry = formatTrainerMarketCardExpiry(document.getElementById('trainerMarketCardExpiry')?.value || '');
    const cvv = String(document.getElementById('trainerMarketCardCvv')?.value || '').replace(/\D/g, '').slice(0, 4);

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
        cardBrandSnapshot: detectTrainerMarketCardBrand(cardNumber),
    };
}

function buildTrainerMarketBankInfoHtml(paymentMethod = 'credit') {
    if (paymentMethod === 'credit_card') {
        return buildTrainerMarketCreditCardHtml();
    }
    if (paymentMethod !== 'iban' || !currentCreditPurchaseSettings?.iban) {
        return '';
    }

    return `
        <div style="margin-top:12px; padding:14px 16px; border:1px solid #dce8f5; border-radius:12px; background:#f6fbff; color:#22313f;">
            <div style="font-size:0.82em; letter-spacing:0.05em; color:#5e7a96; font-weight:700;">HAVALE / EFT BILGILERI</div>
            <div style="margin-top:8px;"><strong>Banka:</strong> ${currentCreditPurchaseSettings.bankName || '-'}</div>
            <div style="margin-top:4px;"><strong>Hesap Sahibi:</strong> ${currentCreditPurchaseSettings.accountHolder || '-'}</div>
            <div style="margin-top:4px;"><strong>IBAN:</strong> ${currentCreditPurchaseSettings.iban || '-'}</div>
            ${currentCreditPurchaseSettings.note ? `<div style="margin-top:8px;"><strong>Not:</strong> ${currentCreditPurchaseSettings.note}</div>` : ''}
        </div>
    `;
}

function updateTrainerMarketBankInfo() {
    const container = document.getElementById('trainerMarketBankInfoContainer');
    const paymentMethod = document.getElementById('trainerMarketPaymentMethod')?.value || 'credit';
    if (!container) {
        return;
    }
    container.innerHTML = buildTrainerMarketBankInfoHtml(paymentMethod);
}

function buildTrainerMarketCartHtml() {
    const totals = getTrainerMarketTotals();
    const selectedPaymentMethod = document.getElementById('trainerMarketPaymentMethod')?.value || 'credit';
    const itemsHtml = trainerMarketCart.length
        ? trainerMarketCart.map(item => `
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; padding:12px 0; border-bottom:1px solid #eef2f7; flex-wrap:wrap;">
                <div>
                    <div style="font-weight:700; color:#22313f;">${item.productName}</div>
                    <div style="margin-top:4px; color:#6f8091; font-size:0.9em;">₺${Number(item.unitPrice || 0).toFixed(2)} • ${Number(item.unitCreditCost || 0)} kredi</div>
                </div>
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <button class="btn btn-secondary btn-sm" onclick="updateTrainerCartQuantity('${item.productId}', -1)">-</button>
                    <strong>${Number(item.quantity || 1)}</strong>
                    <button class="btn btn-secondary btn-sm" onclick="updateTrainerCartQuantity('${item.productId}', 1)">+</button>
                    <button class="btn btn-danger btn-sm" onclick="removeTrainerCartItem('${item.productId}')">Sil</button>
                </div>
            </div>
        `).join('')
        : '<div style="padding:14px; border:1px dashed #d7e1eb; border-radius:10px; color:#8aa0b2; background:#fff;">Sepetiniz bos. Urun kartlarindan ekleme yapabilirsiniz.</div>';

    return `
        <div style="grid-column:1/-1; background:#fff; border:1px solid #e5ebf2; border-radius:16px; padding:18px; box-shadow:0 10px 30px rgba(15,23,42,0.06); margin-bottom:18px;">
            <div style="display:flex; justify-content:space-between; gap:16px; align-items:flex-start; flex-wrap:wrap;">
                <div>
                    <div style="font-size:0.82em; letter-spacing:0.06em; color:#7f8c8d; font-weight:700;">ALISVERIS</div>
                    <h3 style="margin:6px 0 0; color:#22313f;">Sepet ve odeme tercihi</h3>
                </div>
                <div style="text-align:right; min-width:180px;">
                    <div style="font-size:0.9em; color:#6f8091;">Toplam kalem</div>
                    <div style="font-size:1.6em; font-weight:800; color:#1d7c54;">${totals.itemCount}</div>
                    <div style="margin-top:4px; color:#22313f; font-weight:700;">₺${totals.totalAmount.toFixed(2)} • ${totals.totalCredits} kredi</div>
                </div>
            </div>
            <div style="margin-top:16px;">${itemsHtml}</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-top:16px;">
                <input id="trainerMarketPhone" type="text" placeholder="Telefon" value="${currentTrainer?.phone || ''}" style="padding:12px 14px; border:1px solid #d8e3ee; border-radius:10px;">
                <select id="trainerMarketPaymentMethod" onchange="updateTrainerMarketBankInfo()" style="padding:12px 14px; border:1px solid #d8e3ee; border-radius:10px;">
                    <option value="credit" ${selectedPaymentMethod === 'credit' ? 'selected' : ''}>Kredi ile odeme</option>
                    <option value="iban" ${selectedPaymentMethod === 'iban' ? 'selected' : ''}>Havale / EFT</option>
                    <option value="credit_card" ${selectedPaymentMethod === 'credit_card' ? 'selected' : ''}>Kredi Karti</option>
                </select>
            </div>
            <div id="trainerMarketBankInfoContainer">${buildTrainerMarketBankInfoHtml(selectedPaymentMethod)}</div>
            <textarea id="trainerMarketAddress" rows="3" placeholder="Teslimat adresi" style="width:100%; margin-top:12px; padding:12px 14px; border:1px solid #d8e3ee; border-radius:10px;"></textarea>
            <textarea id="trainerMarketNote" rows="2" placeholder="Siparis notu (opsiyonel)" style="width:100%; margin-top:12px; padding:12px 14px; border:1px solid #d8e3ee; border-radius:10px;"></textarea>
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap; margin-top:14px;">
                <div style="font-size:0.9em; color:#6f8091;">Toplu checkout ile tek siparis ve tek bildirim olusturulur.</div>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button class="btn btn-secondary" onclick="clearTrainerCart()">Sepeti Temizle</button>
                    <button class="btn btn-primary" onclick="submitTrainerMarketCheckout()">Siparisi Tamamla</button>
                </div>
            </div>
        </div>
    `;
}

async function createTrainerMarketNotifications(orderId, orderTitle) {
    const superAdminsSnap = await db.collection('users').where('role', '==', 'superadmin').get();
    const notifications = superAdminsSnap.docs.map(doc => db.collection('notifications').add({
        userId: doc.id,
        title: 'Yeni trainer market siparisi',
        message: `${currentTrainer.name}, ${orderTitle} icin yeni bir siparis olusturdu.`,
        type: 'market_order',
        orderId,
        createdAt: new Date().toISOString(),
        read: false,
    }));
    await Promise.all(notifications);
}

async function submitTrainerMarketCheckout() {
    if (!trainerMarketCart.length) {
        alert('Sepetiniz bos.');
        return;
    }

    const phone = document.getElementById('trainerMarketPhone')?.value?.trim() || '';
    const shippingAddress = document.getElementById('trainerMarketAddress')?.value?.trim() || '';
    const paymentMethod = document.getElementById('trainerMarketPaymentMethod')?.value || 'credit';
    const note = document.getElementById('trainerMarketNote')?.value?.trim() || '';

    if (!phone || !shippingAddress) {
        alert('Telefon ve teslimat adresi zorunludur.');
        return;
    }

    const items = trainerMarketCart.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0),
        unitCreditCost: Number(item.unitCreditCost || 0),
        imageUrl: item.imageUrl || '',
    }));
    const totals = getTrainerMarketTotals();
    const orderTitle = items.length === 1 ? items[0].productName : `${items.length} urunluk trainer sepeti`;

    try {
        let ibanSnapshot = '';
        let bankNameSnapshot = '';
        let accountHolderSnapshot = '';
        let cardHolderNameSnapshot = '';
        let cardLast4Snapshot = '';
        let cardExpirySnapshot = '';
        let cardBrandSnapshot = '';

        if (paymentMethod === 'credit') {
            if (currentUserCredits < totals.totalCredits) {
                alert('Bu sepet icin yeterli krediniz yok.');
                return;
            }
            await changeUserCreditBalance(currentTrainer.id, -totals.totalCredits, `${orderTitle} sepet satin alimi`, 'market_purchase', orderTitle, {
                itemCount: totals.itemCount,
            });
        } else if (paymentMethod === 'iban') {
            const settingsDoc = await db.collection('app_settings').doc('credit_purchase_bank').get();
            const settings = settingsDoc.exists ? settingsDoc.data() : null;
            ibanSnapshot = settings?.iban || '';
            bankNameSnapshot = settings?.bankName || '';
            accountHolderSnapshot = settings?.accountHolder || '';
        } else if (paymentMethod === 'credit_card') {
            const cardSnapshot = getTrainerMarketCardSnapshot();
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
            totalCredits: totals.totalCredits,
            paymentMethod,
            status: 'pending',
            buyerId: currentTrainer.id,
            buyerName: currentTrainer.name,
            buyerEmail: currentTrainer.email,
            buyerRole: 'trainer',
            buyerPhone: phone,
            shippingAddress,
            adminId: currentTrainer.adminId || '',
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

        await createTrainerMarketNotifications(orderRef.id, orderTitle);
        trainerMarketCart = [];
        await loadTrainerMarket();
        alert(`Siparisiniz alindi. ${orderTitle} icin tek siparis kaydi olusturuldu.`);
    } catch (error) {
        console.error('Trainer checkout hatasi:', error);
        alert('Siparis olusturulamadi: ' + error.message);
    }
}

async function loadTrainerMarket() {
    try {
        // Güncel kredi bakiyesini sayfadaki tüm gösterimlere uygula
        await loadCreditBalance();

        if (!currentCreditPurchaseSettings) {
            const settingsDoc = await db.collection('app_settings').doc('credit_purchase_bank').get();
            currentCreditPurchaseSettings = settingsDoc.exists ? settingsDoc.data() : null;
        }

        const container = document.getElementById('buyWorkoutsContainer');
        if (container) {
            container.innerHTML = `
                <div style="margin-bottom: 25px;">
                    <h3 style="margin-bottom: 12px; color: #2c3e50;">Ürünler</h3>
                    <div id="trainerProductMarketContainer" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 18px;"></div>
                </div>
                <div>
                    <h3 style="margin-bottom: 12px; color: #2c3e50;">Satıştaki Antrenmanlar</h3>
                    <div id="buyWorkoutsListContainer"></div>
                </div>
            `;
        }

        const productsSnap = await db.collection('products').get();
        const products = productsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(product => !currentTrainer.adminId || !product.adminId || product.adminId === currentTrainer.adminId);
        allTrainerMarketProducts = products;
        displayTrainerMarketProducts(products);

        // Ürünleri ve satıştaki antrenmanları yükle
        await loadBuyWorkouts();
        await loadSellWorkouts();

    } catch (error) {
        console.error('Market yüklenirken hata:', error);
        const container = document.getElementById('buyWorkoutsContainer') || document.getElementById('buyWorkoutsListContainer');
        if (container) {
            container.innerHTML = '<p style="color: #e74c3c;">Market yüklenirken hata oluştu.</p>';
        }
    }
}

function displayTrainerMarketProducts(products) {
    const container = document.getElementById('trainerProductMarketContainer');
    if (!container) return;

    container.innerHTML = buildTrainerMarketCartHtml();

    if (!products.length) {
        container.innerHTML += '<div style="padding: 24px; text-align: center; color: #95a5a6; background: #f8f9fa; border-radius: 8px; grid-column: 1 / -1;">Henüz ürün eklenmedi.</div>';
        return;
    }

    container.innerHTML += products.map(product => {
        const cartItem = getTrainerMarketCartItem(product.id);
        return `
        <div style="background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08); border: 1px solid #ecf0f1;">
            <div style="height: 170px; background: #f8f9fa; display: flex; align-items: center; justify-content: center;">
                ${product.imageUrl ? `<img src="${product.imageUrl}" alt="${product.name}" style="max-width: 100%; max-height: 100%; object-fit: cover;">` : '<div style="font-size: 42px; color: #d0d7de;">📦</div>'}
            </div>
            <div style="padding: 16px;">
                <h4 style="margin: 0 0 8px 0; color: #2c3e50;">${product.name}</h4>
                <div style="display: flex; justify-content: space-between; gap: 8px; margin-bottom: 10px;">
                    <span style="color: #7f8c8d; font-size: 0.9em;">Nakit: ₺${Number(product.price || 0).toFixed(2)}</span>
                    <strong style="color: #3498db;">${Number(product.creditCost || 0)} kredi</strong>
                </div>
                ${product.description ? `<p style="color: #666; font-size: 0.92em; min-height: 42px;">${product.description}</p>` : '<p style="color: #95a5a6; font-size: 0.92em; min-height: 42px;">Açıklama yok.</p>'}
                <button class="btn btn-primary" style="width: 100%; margin-top: 8px;" onclick="addTrainerProductToCart({ id: '${product.id}', name: '${String(product.name).replace(/'/g, '\\&#39;')}', price: ${Number(product.price || 0)}, creditCost: ${Number(product.creditCost || 0)}, imageUrl: '${String(product.imageUrl || '').replace(/'/g, '\\&#39;')}' })">Sepete Ekle</button>
                ${cartItem ? `<div style="margin-top:10px; color:#0f766e; font-size:0.9em; font-weight:700;">Sepette: ${cartItem.quantity} adet</div>` : ''}
            </div>
        </div>
    `;
    }).join('');
}

// ======================== STUDENT SEARCH ========================

function setupStudentSearch() {
    const searchInput = document.getElementById('studentSearchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const groups = document.querySelectorAll('[id^="group-"]');
        let visibleGroupCount = 0;

        groups.forEach(groupDiv => {
            const table = groupDiv.closest('[id^="group-"]').parentElement.querySelector('table');
            if (!table) return;

            const rows = table.querySelectorAll('tbody tr');
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
            const header = groupDiv.parentElement.querySelector('[id^="group-"]')?.previousElementSibling;
            if (header && visibleRows > 0) {
                header.style.display = '';
                groupDiv.style.display = '';
                visibleGroupCount++;
            } else if (header) {
                header.style.display = 'none';
                groupDiv.style.display = 'none';
            }
        });
    });
}

// ======================== WORKOUT SELL/BUY SYSTEM ========================

// Sell Workout Modal Functions
function openSellWorkoutModal() {
    document.getElementById('sellWorkoutForm').reset();
    const select = document.getElementById('sellWorkoutSelect');
    select.innerHTML = '<option value="">-- Antrenman Seçiniz --</option>';

    allWorkouts.forEach(workout => {
        const option = document.createElement('option');
        option.value = workout.id;
        option.textContent = workout.name;
        select.appendChild(option);
    });

    document.getElementById('sellWorkoutModal').classList.add('active');
}

function closeSellWorkoutModal() {
    document.getElementById('sellWorkoutModal').classList.remove('active');
}

async function sellWorkout(e) {
    e.preventDefault();

    const workoutId = document.getElementById('sellWorkoutSelect').value;
    const name = document.getElementById('sellWorkoutName').value;
    const description = document.getElementById('sellWorkoutDescription').value;
    const ageGroup = document.getElementById('sellWorkoutAgeGroup').value;
    const target = document.getElementById('sellWorkoutTarget').value;
    const style = document.getElementById('sellWorkoutStyle').value || 'Karma';
    const distance = document.getElementById('sellWorkoutDistance').value || 'Karma';
    const workoutType = document.querySelector('input[name="sellWorkoutType"]:checked').value;
    const credit = parseInt(document.getElementById('sellWorkoutCredit').value, 10);
    
    if (!workoutId || !name || !description || !ageGroup || !target || isNaN(credit) || credit < 1) {
        alert('Lütfen tüm zorunlu alanları doldurunuz!');
        return;
    }

    try {
        const workout = allWorkouts.find(w => w.id === workoutId);
        if (!workout) {
            alert('Antrenman bulunamadı!');
            return;
        }

        const sellData = {
            workoutId: workoutId,
            sellerId: currentTrainer.id,
            sellerName: currentTrainer.name,
            sellerEmail: currentTrainer.email,
            name: name,
            description: description,
            ageGroup: ageGroup,
            target: target,
            style: style,
            distance: distance,
            workoutType: workoutType,
            credit: credit,
            exercises: workout.exercises,
            adminId: currentTrainer.adminId,
            createdAt: new Date().toISOString(),
            status: 'active',
            purchaseRequests: [],
            negotiations: []
        };

        const saleRef = await db.collection('workout_sales').add(sellData);

        if (window.aiKnowledgeEngine && typeof window.aiKnowledgeEngine.syncWorkoutSaleKnowledge === 'function') {
            try {
                await window.aiKnowledgeEngine.syncWorkoutSaleKnowledge({
                    id: saleRef.id,
                    ...sellData
                }, {
                    trainerId: currentTrainer.id,
                    trainerName: currentTrainer.name,
                    trainerEmail: currentTrainer.email,
                    adminId: currentTrainer.adminId || ''
                });
            } catch (error) {
                console.warn('AI workout sale knowledge sync skipped:', error.message);
            }
        }

        alert('Antrenman satışa çıkarıldı!');
        closeSellWorkoutModal();
        loadSellWorkouts();
    } catch (error) {
        alert('Hata: ' + error.message);
    }
}

async function loadSellWorkouts() {
    try {
        const container = document.getElementById('sellWorkoutsContainer');
        container.innerHTML = '<p style="color: #95a5a6;">Yükleniyor...</p>';

        const salesSnap = await db.collection('workout_sales')
            .where('sellerId', '==', currentTrainer.id)
            .get();

        const sales = salesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (sales.length === 0) {
            container.innerHTML = '<p style="color: #95a5a6; text-align: center;">Henüz satışa çıkardığınız antrenman yok.</p>';
            return;
        }

        let html = '';
        sales.forEach(sale => {
            const purchaseRequests = sale.purchaseRequests || [];
            const latestNegotiation = Array.isArray(sale.negotiations) && sale.negotiations.length
                ? sale.negotiations[sale.negotiations.length - 1]
                : null;
            const negotiationHtml = latestNegotiation
                ? `<div style="margin: 10px 0 0 0; padding: 10px 12px; background: ${latestNegotiation.from === currentTrainer.id ? '#ebf5fb' : '#fff4e5'}; border-left: 4px solid ${latestNegotiation.from === currentTrainer.id ? '#3498db' : '#f39c12'}; border-radius: 6px;">
                        <div style="font-weight: 600; color: #2c3e50;">Son teklif: ${latestNegotiation.fromName || 'Kullanıcı'} • ${latestNegotiation.offer} Kredi</div>
                        ${latestNegotiation.message ? `<div style="margin-top: 4px; color: #5d6d7e; font-size: 0.9em;">${latestNegotiation.message}</div>` : ''}
                    </div>`
                : '';
            html += `
                <div style="background: #f9f9f9; border-radius: 8px; padding: 15px; margin-bottom: 15px; border-left: 4px solid #3498db;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <h3 style="margin: 0 0 10px 0; color: #2c3e50;">${sale.name}</h3>
                            <p style="color: #7f8c8d; margin: 5px 0;">${sale.description}</p>
                            ${buildWorkoutSaleMetaHtml(sale)}
                            <p style="font-weight: bold; color: #27ae60; margin: 5px 0;">${sale.credit} Kredi</p>
                            ${negotiationHtml}
                            <small style="color: #95a5a6;">${new Date(sale.createdAt).toLocaleDateString('tr-TR')}</small>
                        </div>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <span style="background: #f39c12; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold;">
                                ${purchaseRequests.length} Talep
                            </span>
                            <button class="btn btn-info btn-sm" onclick="openPurchaseRequestsModal('${sale.id}')">Talepleri Görüntüle</button>
                            <button class="btn btn-danger btn-sm" onclick="removeWorkoutSale('${sale.id}')">Kaldır</button>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (error) {
        console.error('Satıştaki antrenmanlar yüklenirken hata:', error);
        document.getElementById('sellWorkoutsContainer').innerHTML = '<p style="color: #e74c3c;">Hata oluştu.</p>';
    }
}

async function removeWorkoutSale(saleId) {
    if (!confirm('Bu antrenmanı satıştan kaldırmak istediğinize emin misiniz?')) return;

    try {
        await db.collection('workout_sales').doc(saleId).delete();
        loadSellWorkouts();
        alert('Antrenman satıştan kaldırıldı.');
    } catch (error) {
        alert('Hata: ' + error.message);
    }
}

// Buy Workout Functions
async function loadBuyWorkouts() {
    try {
        const container = document.getElementById('buyWorkoutsListContainer') || document.getElementById('buyWorkoutsContainer');
        if (!container) return;
        container.innerHTML = '<p style="color: #95a5a6;">Yükleniyor...</p>';

        let salesQuery = db.collection('workout_sales')
            .where('status', '==', 'active');

        // Filter by adminId to show only products from the same admin (skip if no adminId set)
        if (currentTrainer.adminId) {
            salesQuery = salesQuery.where('adminId', '==', currentTrainer.adminId);
        }

        const salesSnap = await salesQuery.get();

        const sales = salesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}))
            .filter(sale => sale.sellerId !== currentTrainer.id) // Kendi antrenmanlarını gösterme
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (sales.length === 0) {
            container.innerHTML = '<p style="color: #95a5a6; text-align: center;">Satıştaki antrenman bulunmuyor.</p>';
            return;
        }

        let html = '';
        sales.forEach(sale => {
            const specialOffer = sale.specialOffers && sale.specialOffers[currentTrainer.id] && sale.specialOffers[currentTrainer.id].status === 'accepted'
                ? sale.specialOffers[currentTrainer.id]
                : null;
            const priceLabel = specialOffer
                ? `<p style="font-weight: bold; color: #27ae60; margin: 5px 0;">${specialOffer.price} Kredi <span style="font-size: 0.8em; color: #e67e22;">Sana özel onaylandı</span></p>`
                : `<p style="font-weight: bold; color: #27ae60; margin: 5px 0;">${sale.credit} Kredi</p>`;
            html += `
                <div style="background: #f9f9f9; border-radius: 8px; padding: 15px; margin-bottom: 15px; border-left: 4px solid #3498db;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <h3 style="margin: 0 0 10px 0; color: #2c3e50;">${sale.name}</h3>
                            <p style="color: #7f8c8d; margin: 5px 0;">${sale.description}</p>
                            ${buildWorkoutSaleMetaHtml(sale)}
                            ${priceLabel}
                            <small style="color: #95a5a6;">Satıcı: ${sale.sellerName}</small>
                        </div>
                        <div>
                            <button class="btn btn-success btn-sm" onclick="openBuyWorkoutModal('${sale.id}')">İncele & Satın Al</button>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (error) {
        console.error('Satıştaki antrenmanlar yüklenirken hata:', error);
        const containerErr = document.getElementById('buyWorkoutsContainer') || document.getElementById('buyWorkoutsListContainer');
        if (containerErr) containerErr.innerHTML = '<p style="color: #e74c3c;">Hata oluştu.</p>';
    }
}

function openBuyWorkoutModal(saleId) {
    document.getElementById('buyWorkoutDetails').innerHTML = '<p style="color: #95a5a6;">Yükleniyor...</p>';
    document.getElementById('buyWorkoutModal').classList.add('active');
    
    window.currentViewingSaleId = saleId;
    loadSaleDetails(saleId);
}

function closeBuyWorkoutModal() {
    document.getElementById('buyWorkoutModal').classList.remove('active');
    window.currentViewingSaleId = null;
}

function closeNegotiationModal() {
    document.getElementById('negotiationModal').style.display = 'none';
}

async function loadSaleDetails(saleId) {
    try {
        const saleDoc = await db.collection('workout_sales').doc(saleId).get();
        if (!saleDoc.exists) {
            document.getElementById('buyWorkoutDetails').innerHTML = '<p style="color: #e74c3c;">Antrenman bulunamadı.</p>';
            return;
        }

        const sale = {id: saleDoc.id, ...saleDoc.data()};
        const specialOffer = sale.specialOffers && sale.specialOffers[currentTrainer.id] && sale.specialOffers[currentTrainer.id].status === 'accepted'
            ? sale.specialOffers[currentTrainer.id]
            : null;
        const activePrice = specialOffer ? Number(specialOffer.price) : Number(sale.credit);
        const hasEnoughCredits = currentUserCredits >= activePrice;
        
        // Pazarlık tekliflerini kontrol et
        let negotiationStatus = '';
        if (specialOffer) {
            negotiationStatus = `<p style="color: #1e8449; background: #eafaf1; padding: 10px; border-radius: 5px; margin: 10px 0;">✅ Satıcı sana özel fiyatı onayladı: <strong>${specialOffer.price} Kredi</strong>${specialOffer.message ? `<br><span style="font-size: 0.9em; color: #2c3e50;">${specialOffer.message}</span>` : ''}</p>`;
        } else if (sale.negotiations && sale.negotiations.length > 0) {
            const lastNegotiation = sale.negotiations[sale.negotiations.length - 1];
            if (lastNegotiation.from === currentTrainer.id) {
                negotiationStatus = `<p style="color: #3498db; background: #ebf5fb; padding: 10px; border-radius: 5px; margin: 10px 0;">💭 Senin Teklif: <strong>${lastNegotiation.offer} Kredi</strong> - Bekleniyor</p>`;
            }
        }

        const html = `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h3 style="margin: 0 0 12px 0; color: #2c3e50;">${sale.name}</h3>
                
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 15px; font-size: 0.95em;">
                    <div>
                        <p style="margin: 0; color: #666;">👥 Yaş Grubu:</p>
                        <p style="margin: 5px 0 0 0; font-weight: 600;">${sale.ageGroup}</p>
                    </div>
                    <div>
                        <p style="margin: 0; color: #666;">🎯 Hedef Kitle:</p>
                        <p style="margin: 5px 0 0 0; font-weight: 600;">${sale.target}</p>
                    </div>
                    <div>
                        <p style="margin: 0; color: #666;">🏊 Stil:</p>
                        <p style="margin: 5px 0 0 0; font-weight: 600;">${sale.style}</p>
                    </div>
                    <div>
                        <p style="margin: 0; color: #666;">📏 Mesafe:</p>
                        <p style="margin: 5px 0 0 0; font-weight: 600;">${sale.distance}</p>
                    </div>
                    <div>
                        <p style="margin: 0; color: #666;">⚡ Tür:</p>
                        <p style="margin: 5px 0 0 0; font-weight: 600;">${getWorkoutTypeLabel(sale.workoutType)}</p>
                    </div>
                </div>

                <div style="background: white; padding: 12px; border-radius: 5px; margin-bottom: 12px; border-left: 4px solid #27ae60;">
                    <p style="margin: 0; color: #666;">📝 Açıklama:</p>
                    <p style="margin: 5px 0 0 0; color: #333; line-height: 1.5;">${sale.description}</p>
                </div>

                <div style="background: #fff8e1; padding: 12px; border-radius: 5px; margin-bottom: 12px; border-left: 4px solid #f39c12; color: #7d6608;">
                    İçerik detayları satın alma öncesinde gizlidir. Satın alma sonrası antrenman otomatik olarak kütüphanenize eklenir.
                </div>

                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 15px;">
                    <div style="background: white; padding: 12px; border-radius: 5px; border-left: 4px solid #3498db;">
                        <p style="margin: 0; color: #666; font-size: 0.9em;">💳 Fiyat</p>
                        <p style="margin: 5px 0 0 0; font-size: 1.5em; font-weight: 600; color: #3498db;">${activePrice} Kredi</p>
                        ${specialOffer ? '<p style="margin: 8px 0 0 0; font-size: 0.85em; color: #1e8449;">Bu teklif yalnızca sana açık.</p>' : ''}
                    </div>
                    <div style="background: white; padding: 12px; border-radius: 5px; border-left: 4px solid #2c3e50;">
                        <p style="margin: 0; color: #666; font-size: 0.9em;">👤 Satıcı</p>
                        <p style="margin: 5px 0 0 0; font-weight: 600;">${sale.sellerName}</p>
                    </div>
                </div>

                <div style="background: white; padding: 12px; border-radius: 5px; margin-bottom: 15px; border-left: 4px solid #f39c12;">
                    <p style="margin: 0; color: #666; font-size: 0.9em;">💰 Senin Kredilerin</p>
                    <p style="margin: 5px 0 0 0; font-size: 1.3em; font-weight: 600; color: ${hasEnoughCredits ? '#27ae60' : '#e74c3c'};"> ${currentUserCredits || 0} Kredi</p>
                    ${!hasEnoughCredits ? '<p style="margin: 10px 0 0 0; color: #e74c3c; font-size: 0.9em;">❌ Yeterli kredin yok!</p>' : '<p style="margin: 10px 0 0 0; color: #27ae60; font-size: 0.9em;">✅ Satın almaya yeterli kredisin var</p>'}
                </div>

                ${negotiationStatus}

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                    ${hasEnoughCredits ? `<button class="btn btn-success" onclick="quickBuyWorkout('${saleId}', ${activePrice})">${specialOffer ? '✅ Özel Fiyatla Satın Al' : '✅ Hemen Satın Al'}</button>` : `<button class="btn btn-success" style="opacity: 0.5; cursor: not-allowed;">❌ Kredi Yetersiz</button>`}
                    <button class="btn btn-info" onclick="openNegotiationModal('${saleId}', ${sale.credit})">💭 Pazarlık Yap</button>
                    <button class="btn btn-primary" onclick="requestCustomWorkout('${saleId}', '${sale.sellerId}', '${sale.sellerName.replace(/'/g, '\'')}')">📝 Antrenman İste</button>
                </div>
            </div>
        `;

        document.getElementById('buyWorkoutDetails').innerHTML = html;
    } catch (error) {
        console.error('Antrenman détay yüklenirken hata:', error);
        document.getElementById('buyWorkoutDetails').innerHTML = '<p style="color: #e74c3c;">Detaylar yüklenemedi.</p>';
    }
}

async function quickBuyWorkout(saleId, price) {
    if (!confirm(`${price} Kredi karşılığında bu antrenmanı satın almak istediğinize emin misiniz?`)) {
        return;
    }

    try {
        const saleDoc = await db.collection('workout_sales').doc(saleId).get();
        const sale = saleDoc.data();
        const specialOffer = sale.specialOffers && sale.specialOffers[currentTrainer.id] && sale.specialOffers[currentTrainer.id].status === 'accepted'
            ? sale.specialOffers[currentTrainer.id]
            : null;
        const finalPrice = specialOffer ? Number(specialOffer.price) : Number(sale.credit);

        // Kredi kontrol et
        if (currentUserCredits < finalPrice) {
            alert('Yeterli krediniz yok!');
            return;
        }

        await changeUserCreditBalance(currentTrainer.id, -finalPrice, `${sale.name} antrenmanı satın alındı`, 'workout_purchase', saleId, {
            saleId,
            sellerId: sale.sellerId,
            specialOfferPrice: specialOffer ? finalPrice : null
        });
        await changeUserCreditBalance(sale.sellerId, finalPrice, `${sale.name} antrenmanı satıldı`, 'workout_sale', saleId, {
            saleId,
            buyerId: currentTrainer.id,
            specialOfferPrice: specialOffer ? finalPrice : null
        });

        // Antrenmanı alıcının kütüphanesine ekle
        await db.collection('workout_library').add({
            buyerId: currentTrainer.id,
            buyerName: currentTrainer.name,
            sellerId: sale.sellerId,
            sellerName: sale.sellerName,
            workoutSaleId: saleId,
            workoutName: sale.name,
            ageGroup: sale.ageGroup,
            target: sale.target,
            style: sale.style,
            distance: sale.distance,
            workoutType: sale.workoutType,
            exercises: sale.exercises,
            price: finalPrice,
            purchasedAt: new Date().toISOString(),
            contentIncluded: true,
            contentLockedUntilPurchase: false
        });

        if (specialOffer) {
            const specialOffers = {...(sale.specialOffers || {})};
            specialOffers[currentTrainer.id] = {
                ...specialOffer,
                status: 'used',
                usedAt: new Date().toISOString()
            };
            await db.collection('workout_sales').doc(saleId).update({ specialOffers });
        }

        // Satıcıya bildirim gönder
        await db.collection('notifications').add({
            userId: sale.sellerId,
            title: '🎉 Antrenman Satıldı!',
            message: `${currentTrainer.name}, "${sale.name}" antrenmanını satın aldı. +${finalPrice} Kredi kazandın!`,
            type: 'workout_sold',
            saleId: saleId,
            buyerId: currentTrainer.id,
            createdAt: new Date().toISOString()
        });

        alert('Antrenman başarıyla satın alındı! Kütüphanenize eklendi.');
        closeBuyWorkoutModal();
        loadBuyWorkouts();
    } catch (error) {
        console.error('Satın alma hatası:', error);
        alert('Hata: ' + error.message);
    }
}

async function openNegotiationModal(saleId, originalPrice) {
    window.currentNegotiationSaleId = saleId;
    window.currentNegotiationOriginalPrice = originalPrice;
    
    document.getElementById('sellerOriginalOffer').textContent = `${originalPrice} Kredi`;
    document.getElementById('buyerOffer').value = Math.max(1, Math.floor(originalPrice * 0.8));
    document.getElementById('negotiationForm').reset();
    document.getElementById('negotiationMessage').value = '';
    
    // Pazarlık geçmişini yükle
    await loadNegotiationHistory(saleId);
    
    document.getElementById('negotiationModal').style.display = 'block';
}

async function loadNegotiationHistory(saleId) {
    try {
        const saleDoc = await db.collection('workout_sales').doc(saleId).get();
        const sale = saleDoc.data();
        const negotiations = sale.negotiations || [];
        
        let html = '';
        negotiations.forEach(neg => {
            const isMe = neg.from === currentTrainer.id;
            const sideClass = isMe ? 'flex-end' : 'flex-start';
            const bgColor = isMe ? '#ebf5fb' : '#eafaf1';
            const borderColor = isMe ? '#3498db' : '#27ae60';
            
            html += `
                <div style="display: flex; justify-content: ${sideClass}; margin-bottom: 10px;">
                    <div style="background: ${bgColor}; border-left: 3px solid ${borderColor}; padding: 10px; border-radius: 5px; max-width: 80%; word-wrap: break-word;">
                        <p style="margin: 0; font-weight: 600; color: #2c3e50;">${isMe ? 'Sen' : sale.sellerName}: ${neg.offer} Kredi</p>
                        ${neg.message ? `<p style="margin: 5px 0 0 0; color: #555; font-size: 0.9em;">"${neg.message}"</p>` : ''}
                        <p style="margin: 5px 0 0 0; color: #95a5a6; font-size: 0.8em;">${new Date(neg.timestamp).toLocaleTimeString('tr-TR')}</p>
                    </div>
                </div>
            `;
        });
        
        document.getElementById('negotiationList').innerHTML = html || '<p style="color: #95a5a6;">Henüz teklif yok</p>';
    } catch (error) {
        console.error('Pazarlık geçmişi yüklenirken hata:', error);
    }
}

async function submitNegotiationOffer(e) {
    e.preventDefault();
    
    const saleId = window.currentNegotiationSaleId;
    const offer = Number(document.getElementById('buyerOffer').value);
    const message = document.getElementById('negotiationMessage').value;
    
    if (!offer || offer < 1) {
        alert('Geçerli bir teklif giriniz!');
        return;
    }
    
    try {
        const saleRef = db.collection('workout_sales').doc(saleId);
        await saleRef.update({
            negotiations: firebase.firestore.FieldValue.arrayUnion({
                from: currentTrainer.id,
                fromName: currentTrainer.name,
                offer: offer,
                message: message,
                timestamp: new Date().toISOString()
            })
        });
        
        // Satıcıya bildirim gönder
        const saleDoc = await saleRef.get();
        const sale = saleDoc.data();
        
        await db.collection('notifications').add({
            userId: sale.sellerId,
            title: '💭 Yeni Pazarlık Teklifi',
            message: `${currentTrainer.name}, "${sale.name}" antrenmanı için ${offer} Kredi teklif etti!`,
            type: 'workout_negotiation',
            saleId: saleId,
            buyerId: currentTrainer.id,
            createdAt: new Date().toISOString()
        });
        
        alert('Teklifin gönderildi!');
        await loadNegotiationHistory(saleId);
        document.getElementById('negotiationForm').reset();
    } catch (error) {
        console.error('Teklif gönderirken hata:', error);
        alert('Hata: ' + error.message);
    }
}

async function requestCustomWorkout(saleId, sellerId, sellerName) {
    if (!sellerId) {
        alert('Satıcı bilgisi bulunamadı!');
        return;
    }

    try {
        closeBuyWorkoutModal();
        switchPage('chat');
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 120)));

        const saleDoc = await db.collection('workout_sales').doc(saleId).get();
        const sale = saleDoc.exists ? saleDoc.data() || {} : {};
        const existingChatSnap = await db.collection('chats')
            .where('type', '==', 'direct')
            .where('userIds', 'array-contains', currentTrainer.id)
            .get();

        let chatId = null;
        existingChatSnap.forEach(doc => {
            const data = doc.data() || {};
            const userIds = Array.isArray(data.userIds) ? data.userIds : [];
            if (!chatId && userIds.length === 2 && userIds.includes(sellerId)) {
                chatId = doc.id;
            }
        });

        if (!chatId) {
            const sellerDoc = await db.collection('users').doc(sellerId).get().catch(() => null);
            const sellerData = sellerDoc && sellerDoc.exists ? sellerDoc.data() || {} : {};
            const chatDoc = await db.collection('chats').add({
                type: 'direct',
                userIds: [currentTrainer.id, sellerId],
                users: {
                    [currentTrainer.id]: { name: currentTrainer.name, role: 'trainer', email: currentTrainer.email || '' },
                    [sellerId]: { name: sellerName || sellerData.name || 'Antrenör', role: sellerData.role || 'trainer', email: sellerData.email || '' }
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                unreadCounts: {}
            });
            chatId = chatDoc.id;

            await db.collection('chats').doc(chatId).collection('messages').add({
                senderId: currentTrainer.id,
                senderName: currentTrainer.name,
                senderEmail: currentTrainer.email || '',
                senderClubName: '',
                text: `Merhaba ${sellerName || ''}, "${sale.name || 'bu antrenman'}" için birebir görüşmek istiyorum.`,
                type: 'text',
                timestamp: new Date().toISOString(),
                deleted: false
            });

            await db.collection('chats').doc(chatId).set({
                updatedAt: new Date().toISOString(),
                lastMessage: `Merhaba ${sellerName || ''}, "${sale.name || 'bu antrenman'}" için birebir görüşmek istiyorum.`,
                unreadCounts: { [sellerId]: 1 }
            }, { merge: true });
        }

        if (window.openChatWithUser) {
            await window.openChatWithUser(sellerId);
        } else if (window.openChatView) {
            await window.loadChatList?.();
            window.openChatView(chatId, sellerName || 'Sohbet');
        }

        requestAnimationFrame(() => {
            document.getElementById('chat-page')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            document.getElementById('chat-view-page')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            document.getElementById('chatMessages')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    } catch (error) {
        console.error('Sohbet açılırken hata:', error);
        alert('Hata: ' + error.message);
    }
}

async function purchaseWorkout(saleId) {
    try {
        const saleDoc = await db.collection('workout_sales').doc(saleId).get();
        if (!saleDoc.exists) {
            alert('Satış bulunamadı!');
            return;
        }

        const sale = saleDoc.data();

        // Antrenmanı satın alan kişiye kaydet
        const workoutData = {
            workoutId: sale.workoutId,
            buyerId: currentTrainer.id,
            sellerId: sale.sellerId,
            exercises: sale.exercises,
            name: sale.name,
            description: sale.description,
            purchasedAt: new Date().toISOString(),
            credit: sale.credit
        };

        // Kredi transferi işlemleri
        const creditAmount = sale.credit;
        const buyerId = currentTrainer.id;
        const sellerId = sale.sellerId;

        // Alıcı ve satıcı referansları
        const buyerRef = db.collection('trainers').doc(buyerId);
        const sellerRef = db.collection('trainers').doc(sellerId);

        await db.runTransaction(async (transaction) => {
            const buyerDoc = await transaction.get(buyerRef);
            const sellerDoc = await transaction.get(sellerRef);
            if (!buyerDoc.exists || !sellerDoc.exists) throw new Error('Kullanıcı bulunamadı!');
            const buyerCredit = buyerDoc.data().credit || 0;
            const sellerCredit = sellerDoc.data().credit || 0;
            if (buyerCredit < creditAmount) throw new Error('Yetersiz kredi!');
            transaction.update(buyerRef, { credit: buyerCredit - creditAmount });
            transaction.update(sellerRef, { credit: sellerCredit + creditAmount });
        });

        await db.collection('purchased_workouts').add(workoutData);

        alert('Antrenman başarıyla satın alındı!');
        closeBuyWorkoutModal();
        loadBuyWorkouts(); // Listeyi yenile
    } catch (error) {
        alert('Satın alma işlemi başarısız: ' + error.message);
    }
}

function openPurchaseRequestsModal(saleId) {
    document.getElementById('purchaseRequestsList').innerHTML = '<p>Yükleniyor...</p>';
    document.getElementById('purchaseRequestsModal').classList.add('active');
    loadPurchaseRequests(saleId);
}

function closePurchaseRequestsModal() {
    document.getElementById('purchaseRequestsModal').classList.remove('active');
}

async function loadPurchaseRequests(saleId) {
    try {
        const saleDoc = await db.collection('workout_sales').doc(saleId).get();
        if (!saleDoc.exists) {
            document.getElementById('purchaseRequestsList').innerHTML = '<p>Satış bulunamadı.</p>';
            return;
        }

        const sale = saleDoc.data();
        const requests = sale.purchaseRequests || [];
        const negotiations = Array.isArray(sale.negotiations) ? sale.negotiations : [];
        const specialOffers = sale.specialOffers || {};

        const latestNegotiationsByBuyer = new Map();
        negotiations.forEach(negotiation => {
            if (!negotiation || !negotiation.from || negotiation.from === sale.sellerId) return;
            const previous = latestNegotiationsByBuyer.get(negotiation.from);
            if (!previous || new Date(negotiation.timestamp || 0) >= new Date(previous.timestamp || 0)) {
                latestNegotiationsByBuyer.set(negotiation.from, negotiation);
            }
        });

        if (requests.length === 0 && latestNegotiationsByBuyer.size === 0) {
            document.getElementById('purchaseRequestsList').innerHTML = '<p>Henüz satın alma talebi yok.</p>';
            return;
        }

        let html = '';
        requests.forEach((request, index) => {
            html += `
                <div style="background: #f9f9f9; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${request.buyerName}</strong><br>
                            <small style="color: #7f8c8d;">${request.buyerEmail}</small><br>
                            <small>${new Date(request.requestedAt).toLocaleDateString('tr-TR')}</small>
                        </div>
                        <div>
                            <button class="btn btn-success btn-sm" onclick="shareContactInfo('${saleId}', ${index})">İletişim Bilgilerini Paylaş</button>
                        </div>
                    </div>
                </div>
            `;
        });

        if (latestNegotiationsByBuyer.size > 0) {
            html += '<div style="margin: 20px 0 10px; font-weight: 700; color: #2c3e50;">Pazarlık Teklifleri</div>';
            latestNegotiationsByBuyer.forEach((negotiation, buyerId) => {
                const specialOffer = specialOffers[buyerId];
                const safeBuyerName = (negotiation.fromName || 'Kullanıcı').replace(/'/g, '\\&#39;');
                const approvedHtml = specialOffer && specialOffer.status === 'accepted'
                    ? `<div style="margin-top: 10px; padding: 10px; border-radius: 6px; background: #eafaf1; color: #1e8449;">Bu kullanıcı için onaylanan özel fiyat: <strong>${specialOffer.price} Kredi</strong></div>`
                    : `<div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;">
                            <button class="btn btn-success btn-sm" onclick="approveNegotiationOffer('${saleId}', '${buyerId}', ${Number(negotiation.offer) || 0}, '${safeBuyerName}')">Teklifi Onayla</button>
                            <button class="btn btn-warning btn-sm" onclick="approveNegotiationOffer('${saleId}', '${buyerId}', '', '${safeBuyerName}')">Özel Fiyat Belirle</button>
                        </div>`;

                html += `
                    <div style="background: #f4f8fb; border-radius: 8px; padding: 15px; margin-bottom: 10px; border-left: 4px solid #3498db;">
                        <div style="display: flex; justify-content: space-between; align-items: start; gap: 12px;">
                            <div style="flex: 1;">
                                <strong>${negotiation.fromName || 'Kullanıcı'}</strong><br>
                                <small style="color: #7f8c8d;">Son teklif: ${negotiation.offer} Kredi</small><br>
                                ${negotiation.message ? `<div style="margin-top: 8px; color: #2c3e50;">"${negotiation.message}"</div>` : ''}
                                <small style="display: block; margin-top: 8px; color: #95a5a6;">${new Date(negotiation.timestamp).toLocaleString('tr-TR')}</small>
                                ${approvedHtml}
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        document.getElementById('purchaseRequestsList').innerHTML = html;
    } catch (error) {
        document.getElementById('purchaseRequestsList').innerHTML = '<p>Hata oluştu.</p>';
    }
}

async function approveNegotiationOffer(saleId, buyerId, suggestedPrice, buyerName) {
    try {
        const saleRef = db.collection('workout_sales').doc(saleId);
        const saleDoc = await saleRef.get();
        if (!saleDoc.exists) {
            alert('Satış bulunamadı!');
            return;
        }

        const sale = saleDoc.data() || {};
        const defaultPrice = Number(suggestedPrice) > 0 ? Number(suggestedPrice) : Number(sale.credit || 0);
        const enteredPrice = prompt(`${buyerName || 'Alıcı'} için özel fiyatı girin:`, String(defaultPrice));
        if (enteredPrice === null) {
            return;
        }

        const approvedPrice = Number(enteredPrice);
        if (!approvedPrice || approvedPrice < 1) {
            alert('Geçerli bir fiyat giriniz.');
            return;
        }

        const specialOffers = {...(sale.specialOffers || {})};
        specialOffers[buyerId] = {
            buyerId,
            buyerName: buyerName || 'Kullanıcı',
            price: approvedPrice,
            status: 'accepted',
            acceptedAt: new Date().toISOString(),
            originalPrice: Number(sale.credit || 0),
            lastOffer: Number(suggestedPrice) > 0 ? Number(suggestedPrice) : null,
            message: `${buyerName || 'Kullanıcı'} için özel fiyat onaylandı.`
        };

        await saleRef.update({
            specialOffers,
            updatedAt: new Date().toISOString()
        });

        await db.collection('notifications').add({
            userId: buyerId,
            title: '✅ Pazarlığın Onaylandı',
            message: `${currentTrainer.name}, "${sale.name}" için sana özel ${approvedPrice} Kredi fiyatını onayladı.`,
            type: 'workout_negotiation_accepted',
            saleId,
            sellerId: currentTrainer.id,
            createdAt: new Date().toISOString()
        });

        alert('Özel fiyat alıcıya tanımlandı.');
        await loadPurchaseRequests(saleId);
        await loadSellWorkouts();
        if (window.currentViewingSaleId === saleId) {
            await loadSaleDetails(saleId);
        }
    } catch (error) {
        console.error('Pazarlık onaylama hatası:', error);
        alert('Hata: ' + error.message);
    }
}

async function shareContactInfo(saleId, requestIndex) {
    try {
        const saleRef = db.collection('workout_sales').doc(saleId);
        const saleDoc = await saleRef.get();
        const saleData = saleDoc.data();

        const requests = saleData.purchaseRequests || [];
        if (requests[requestIndex]) {
            requests[requestIndex].status = 'shared';
            requests[requestIndex].sharedAt = new Date().toISOString();

            await saleRef.update({purchaseRequests: requests});

            // Alıcıya antrenmanı paylaş
            const buyerId = requests[requestIndex].buyerId;
            const workoutData = {
                workoutId: saleData.workoutId,
                buyerId: buyerId,
                sellerId: currentTrainer.id,
                exercises: saleData.exercises,
                name: saleData.name,
                description: saleData.description,
                purchasedAt: new Date().toISOString()
            };

            await db.collection('purchased_workouts').add(workoutData);

            alert('İletişim bilgileri paylaşıldı ve antrenman alıcıya gönderildi!');
            loadPurchaseRequests(saleId);
        }
    } catch (error) {
        alert('Hata: ' + error.message);
    }
}

// ======================== AI WORKOUT GENERATION ========================

async function generateAIWorkout(e) {
    const resultDiv = document.getElementById('aiWorkoutResult');
    if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }
    if (resultDiv) {
        resultDiv.innerHTML = '<p style="color: #7d6608; background: #fef5e7; padding: 12px; border-radius: 8px;">Bu özellik geliştirme sürecinde olduğu için geçici olarak kapatıldı.</p>';
    }
    alert('Yapay zeka ile antrenman oluşturma özelliği geçici olarak kapatıldı. Ödeme altyapısı tekrar açıldığında yeniden kullanıma alınacak.');
}

// Function to save API key
function saveApiKey() {
    alert('Yapay zeka ile antrenman oluşturma özelliği geçici olarak kapatıldı.');
}

async function saveAIWorkout(workoutText) {
    alert('Yapay zeka ile antrenman oluşturma özelliği geçici olarak kapatıldı.');
}

function parseAIWorkoutText(text) {
    // Basit parsing - gerçek uygulamada regex veya daha iyi parsing gerekli
    const exercises = [];
    const lines = text.split('\n');

    lines.forEach(line => {
        // "1. 400m Serbest (30s ara)" gibi satırları parse et
        const match = line.match(/(\d+)\.\s*(\d+)m\s*([^\s(]+).*?(\d+)s/);
        if (match) {
            exercises.push({
                distance: parseInt(match[2]),
                style: match[3],
                restSeconds: parseInt(match[4])
            });
        }
    });

    return exercises.length > 0 ? exercises : [{
        distance: 100,
        style: 'Serbest',
        restSeconds: 30
    }];
}

// ======================== CREDIT REQUEST SYSTEM ========================

async function submitCreditRequest(e) {
    e.preventDefault();

    const amount = parseInt(document.getElementById('requestAmount').value);
    const description = document.getElementById('requestDescription').value.trim();

    if (!amount || amount <= 0) {
        alert('Lütfen geçerli bir kredi miktarı giriniz!');
        return;
    }

    if (!description) {
        alert('Lütfen talep açıklaması giriniz!');
        return;
    }

    try {
        const requestData = {
            trainerId: currentTrainer.id,
            trainerName: currentTrainer.name,
            trainerEmail: currentTrainer.email,
            amount: amount,
            description: description,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        await db.collection('credit_requests').add(requestData);

        alert('Kredi talebiniz başarıyla gönderildi! Super Admin onayından sonra kredileriniz hesabınıza yüklenecektir.');
        document.getElementById('creditRequestForm').reset();
        loadCreditRequests();
    } catch (error) {
        console.error('Kredi talebi gönderilirken hata:', error);
        alert('Kredi talebi gönderilirken hata oluştu: ' + error.message);
    }
}

// Kredi paketlerini yükle
async function loadCreditPackages() {
    try {
        const container = document.getElementById('creditPackagesContainer');
        if (!container) return;

        await loadCreditPurchaseSettings();

        const packagesSnap = await db.collection('credit_packages').orderBy('credit').get();
        const packages = packagesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));

        if (packages.length === 0) {
            container.innerHTML = '<p style="color: #95a5a6; text-align: center; padding: 20px;">Henüz kredi paketi tanımlanmadı.</p>';
            return;
        }

        let html = '';
        packages.forEach(pkg => {
            html += `
                <div style="background: #f9f9f9; border-radius: 10px; padding: 20px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); text-align: center;">
                    <div style="font-size: 2em; font-weight: bold; color: #2980b9; margin-bottom: 10px;">${pkg.credit} Kredi</div>
                    <div style="font-size: 1.2em; color: #16a085; margin-bottom: 10px;">${pkg.price} TL</div>
                    <button class="btn btn-primary" onclick="openCreditPackageModal('${pkg.id}', ${pkg.credit}, ${pkg.price})">Kredi Paketi Satın Al</button>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (error) {
        document.getElementById('creditPackagesContainer').innerHTML = '<p style="color: #e74c3c;">Kredi paketleri yüklenemedi.</p>';
    }
}

// Kredi paketi seçim modal'ını aç
function openCreditPackageModal(packageId, credit, price) {
    window.selectedPackageId = packageId;
    selectedCreditPackage = {
        id: packageId,
        credit: Number(credit || 0),
        price: Number(price || 0)
    };
    document.getElementById('modalPackageCredit').textContent = credit;
    document.getElementById('modalPackagePrice').textContent = Number(price).toFixed(2);
    document.getElementById('creditPackageModal').classList.add('active');
}

// Kredi paketi modal'ını kapat
function closeCreditPackageModal() {
    document.getElementById('creditPackageModal').classList.remove('active');
    window.selectedPackageId = null;
    selectedCreditPackage = null;
}

// Otomatik satın al mesajını göster
function showAutoBuyMessage() {
    document.getElementById('creditPackageModal').classList.remove('active');
    document.getElementById('autoBuyInfoModal').classList.add('active');
}

// Otomatik satın al modal'ını kapat
function closeAutoBuyInfoModal() {
    document.getElementById('autoBuyInfoModal').classList.remove('active');
}

async function loadCreditPurchaseSettings() {
    const infoBox = document.getElementById('trainerCreditPurchaseInfo');
    const bankInfo = document.getElementById('manualCreditBankInfo');

    try {
        const settingsDoc = await db.collection('app_settings').doc('credit_purchase_bank').get();
        currentCreditPurchaseSettings = settingsDoc.exists ? settingsDoc.data() : null;

        const html = currentCreditPurchaseSettings
            ? `
                <div style="font-weight: 700; margin-bottom: 8px;">Güncel EFT / Havale Bilgileri</div>
                <div><strong>Banka:</strong> ${currentCreditPurchaseSettings.bankName || '-'}</div>
                <div><strong>Hesap Sahibi:</strong> ${currentCreditPurchaseSettings.accountHolder || '-'}</div>
                <div><strong>IBAN:</strong> ${currentCreditPurchaseSettings.iban || '-'}</div>
                ${currentCreditPurchaseSettings.note ? `<div style="margin-top: 10px;"><strong>Not:</strong> ${currentCreditPurchaseSettings.note}</div>` : ''}
                <div style="margin-top: 10px; color: #6b7b8b; font-size: 0.9em;">Son güncelleme: ${currentCreditPurchaseSettings.updatedAt ? new Date(currentCreditPurchaseSettings.updatedAt).toLocaleString('tr-TR') : '-'}</div>
            `
            : '<strong>Henüz EFT bilgisi tanımlanmadı.</strong> Lütfen süper admin ile iletişime geçin.';

        if (infoBox) infoBox.innerHTML = html;
        if (bankInfo) bankInfo.innerHTML = html;
    } catch (error) {
        console.error('Kredi satın alma banka bilgileri yüklenemedi:', error);
        const fallback = 'EFT bilgileri yüklenemedi. Lütfen daha sonra tekrar deneyin.';
        if (infoBox) infoBox.textContent = fallback;
        if (bankInfo) bankInfo.textContent = fallback;
    }
}

function openManualCreditPurchaseModal() {
    if (!selectedCreditPackage) {
        alert('Lütfen önce bir kredi paketi seçiniz.');
        return;
    }

    document.getElementById('creditPackageModal').classList.remove('active');
    document.getElementById('manualCreditPackageAmount').textContent = selectedCreditPackage.credit;
    document.getElementById('manualCreditPackagePrice').textContent = selectedCreditPackage.price.toFixed(2);
    loadCreditPurchaseSettings();
    document.getElementById('manualCreditPurchaseModal').classList.add('active');
}

function closeManualCreditPurchaseModal() {
    document.getElementById('manualCreditPurchaseModal').classList.remove('active');
    const form = document.getElementById('manualCreditPurchaseForm');
    if (form) form.reset();
}

async function submitManualCreditPurchase(e) {
    e.preventDefault();

    if (!selectedCreditPackage) {
        alert('Kredi paketi bilgisi bulunamadı. Lütfen tekrar deneyin.');
        return;
    }

    if (!currentCreditPurchaseSettings || !currentCreditPurchaseSettings.iban) {
        alert('Şu anda geçerli banka bilgisi bulunmuyor. Lütfen süper admin ile iletişime geçin.');
        return;
    }

    const receiptInput = document.getElementById('manualCreditReceipt');
    const note = document.getElementById('manualCreditNote').value.trim();
    const receiptFile = receiptInput && receiptInput.files ? receiptInput.files[0] : null;

    if (!receiptFile) {
        alert('Lütfen dekont dosyasını yükleyiniz.');
        return;
    }

    if (!note) {
        alert('Lütfen açıklama giriniz.');
        return;
    }

    try {
        const receiptDataUrl = await fileToDataUrl(receiptFile);
        await db.collection('orders').add({
            type: 'credit_package_purchase',
            packageId: selectedCreditPackage.id,
            packageName: `${selectedCreditPackage.credit} Kredi Paketi`,
            packageCredit: selectedCreditPackage.credit,
            buyerId: currentTrainer.id,
            buyerName: currentTrainer.name,
            buyerEmail: currentTrainer.email,
            buyerRole: 'trainer',
            totalAmount: selectedCreditPackage.price,
            paymentMethod: 'iban',
            status: 'pending',
            note,
            receiptFileName: receiptFile.name,
            receiptMimeType: receiptFile.type,
            receiptDataUrl,
            ibanSnapshot: currentCreditPurchaseSettings.iban || '',
            bankNameSnapshot: currentCreditPurchaseSettings.bankName || '',
            accountHolderSnapshot: currentCreditPurchaseSettings.accountHolder || '',
            createdAt: new Date().toISOString()
        });

        alert('EFT satın alma talebiniz gönderildi. Dekontunuz süper admin onayına düştü.');
        closeManualCreditPurchaseModal();
    } catch (error) {
        console.error('Manual kredi satın alma talebi oluşturulamadı:', error);
        alert('Talep oluşturulamadı: ' + error.message);
    }
}

// İletişime geçerek satın al (Modal'dan)
async function startCreditPurchaseChatFromModal() {
    const packageId = window.selectedPackageId;
    if (!packageId) {
        alert('Lütfen bir kredi paketi seçiniz!');
        return;
    }
    
    document.getElementById('creditPackageModal').classList.remove('active');
    
    try {
        // Find super admin
        const adminsSnap = await db.collection('users').where('role', '==', 'superadmin').limit(1).get();
        if (adminsSnap.empty) {
            alert('Süper admin bulunamadı!');
            return;
        }
        
        const superAdminDoc = adminsSnap.docs[0];
        const superAdminId = superAdminDoc.id;
        const superAdminName = superAdminDoc.data().name || 'Super Admin';
        const packageCredit = selectedCreditPackage?.credit || Number(document.getElementById('modalPackageCredit')?.textContent || 0);
        const packagePrice = selectedCreditPackage?.price || Number(document.getElementById('modalPackagePrice')?.textContent || 0);
        const initialMessage = `Merhaba, ${packageCredit} kredi paketini (${Number(packagePrice).toFixed(2)} TL) almak istiyorum.`;

        switchPage('chat');
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 120)));
        
        // Create/find direct chat
        let chatId = null;
        const chatQuery = await db.collection('chats')
            .where('type', '==', 'direct')
            .where('userIds', 'array-contains', currentTrainer.id)
            .get();
        
        chatQuery.forEach(doc => {
            const data = doc.data() || {};
            const userIds = Array.isArray(data.userIds) ? data.userIds : [];
            if (!chatId && userIds.length === 2 && userIds.includes(superAdminId)) {
                chatId = doc.id;
            }
        });

        if (!chatId) {
            const chatDoc = await db.collection('chats').add({
                userIds: [currentTrainer.id, superAdminId],
                users: {
                    [currentTrainer.id]: { name: currentTrainer.name, role: 'trainer', email: currentTrainer.email || '' },
                    [superAdminId]: { name: superAdminName, role: 'superadmin', email: superAdminDoc.data().email || '' }
                },
                type: 'direct',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                unreadCounts: {}
            });
            chatId = chatDoc.id;
        }

        const existingMessages = await db.collection('chats').doc(chatId).collection('messages').limit(1).get();
        if (existingMessages.empty) {
            await db.collection('chats').doc(chatId).collection('messages').add({
                senderId: currentTrainer.id,
                senderName: currentTrainer.name,
                senderEmail: currentTrainer.email || '',
                senderClubName: '',
                text: initialMessage,
                type: 'text',
                timestamp: new Date().toISOString(),
                deleted: false
            });

            await db.collection('chats').doc(chatId).set({
                updatedAt: new Date().toISOString(),
                lastMessage: initialMessage,
                unreadCounts: { [superAdminId]: 1 }
            }, { merge: true });
        }

        if (window.openChatWithUser) {
            await window.openChatWithUser(superAdminId);
        } else if (window.openChatView) {
            await window.loadChatList?.();
            window.openChatView(chatId, superAdminName);
        }

        requestAnimationFrame(() => {
            document.getElementById('chat-page')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            document.getElementById('chat-view-page')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            document.getElementById('chatMessages')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    } catch (error) {
        console.error('Chat açılırken hata:', error);
        alert('Chat açılırken hata oluştu: ' + error.message);
    }
}

// Chat modal helpers
function closeChatModal() {
    document.getElementById('chatModal').style.display = 'none';
    document.getElementById('chatMessages').innerHTML = '';
    activeChatId = null;
    if (window.chatUnsub) window.chatUnsub();
}

function closeChatView() {
    document.getElementById('chat-view-page').classList.remove('active');
    document.getElementById('chatMessages').innerHTML = '';
    activeChatId = null;
    if (window.chatUnsub) window.chatUnsub();
    switchPage('chat');
}

function openNewChatEmailPage() {
    document.querySelectorAll('.page-content').forEach(p=>p.classList.remove('active'));
    document.getElementById('new-chat-email-page').classList.add('active');
    document.getElementById('newChatEmailForm').onsubmit = submitNewChatByEmail;
    document.getElementById('chatEmailInput').oninput = chatEmailLookupUser;
    document.getElementById('chatEmailUserInfo').textContent = '';
}

// --- MISSING FUNCTION: chatEmailLookupUser ---
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

window.chatEmailLookupUser = chatEmailLookupUser;

function closeNewChatEmailPage() {
    document.getElementById('new-chat-email-page').classList.remove('active');
    document.getElementById('newChatEmailForm').reset();
    document.getElementById('chatEmailUserInfo').textContent = '';
    switchPage('chat');
}

// Fonksiyonları global scope'a ekle
window.openNewChatEmailPage = openNewChatEmailPage;
window.closeNewChatEmailPage = closeNewChatEmailPage;

// --- MISSING FUNCTION: submitNewChatByEmail ---
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
        .where('userIds', 'array-contains', currentTrainer.id)
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
            userIds: [currentTrainer.id, userId],
            users: {
                [currentTrainer.id]: { name: currentTrainer.name, role: 'trainer' },
                [userId]: { name: userName, role: userRole }
            },
            type: 'direct',
            createdAt: new Date().toISOString()
        });
        chatId = chatDoc.id;
    }
    openChatView(chatId, userName);
}

// --- MISSING FUNCTION: openNewGroupChatModal ---

function openNewGroupChatModal() {
    // Show the group chat modal
    document.getElementById('newGroupChatModal').style.display = 'flex';
    document.getElementById('newGroupChatForm').onsubmit = submitNewGroupChat;
}

function closeNewGroupChatModal() {
    document.getElementById('newGroupChatModal').style.display = 'none';
    document.getElementById('newGroupChatForm').reset();
}

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
    if (!emails.includes(currentTrainer.email)) emails.push(currentTrainer.email);
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
        createdBy: currentTrainer.id,
        createdAt: new Date().toISOString()
    });
    closeNewGroupChatModal();
    openChatView(chatDoc.id, groupName);
}

window.submitNewChatByEmail = submitNewChatByEmail;
window.openNewGroupChatModal = openNewGroupChatModal;
window.closeNewGroupChatModal = closeNewGroupChatModal;
window.submitNewGroupChat = submitNewGroupChat;
window.openChatView = openChatView;
window.closeChatView = closeChatView;

// ======================== GROUP MANAGEMENT FUNCTIONS ========================

let currentManagedGroupId = null;

// Open group management modal
function openGroupManagement() {
    if (!activeChatId) return;

    // Get chat data
    db.collection('chats').doc(activeChatId).get().then(doc => {
        if (!doc.exists) return;

        const chat = doc.data();
        if (chat.type !== 'group') return;

        currentManagedGroupId = activeChatId;

        // Populate form
        document.getElementById('groupManageName').value = chat.groupName || '';

        // Set current photo
        const photoElement = document.getElementById('groupCurrentPhoto');
        if (chat.groupPhoto) {
            photoElement.src = chat.groupPhoto;
        } else {
            photoElement.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23ddd%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-size=%2224%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22%3E👥%3C/text%3E%3C/svg%3E';
        }

        // Load members list
        loadGroupMembers(chat.userIds, chat.users);

        // Show modal
        document.getElementById('groupManagementModal').classList.add('active');
    }).catch(error => {
        console.error('Grup verisi alınırken hata:', error);
        alert('Grup verisi yüklenirken hata oluştu');
    });
}

// Close group management modal
function closeGroupManagementModal() {
    document.getElementById('groupManagementModal').classList.remove('active');
    document.getElementById('groupManagementForm').reset();
    currentManagedGroupId = null;
}

// Load group members list
function loadGroupMembers(userIds, users) {
    const container = document.getElementById('groupMembersList');
    container.innerHTML = '';

    if (!userIds || !users) return;

    userIds.forEach(userId => {
        const user = users[userId];
        if (user) {
            const memberDiv = document.createElement('div');
            memberDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee;';
            memberDiv.innerHTML = `
                <span>${user.name} (${user.role})</span>
                ${userId !== currentTrainer.id ? `<button class="btn btn-danger btn-sm" onclick="removeGroupMember('${userId}')">Çıkar</button>` : '<span style="color: #666; font-size: 0.9em;">(Siz)</span>'}
            `;
            container.appendChild(memberDiv);
        }
    });
}

// Add new member to group
async function addGroupMember() {
    const emailInput = document.getElementById('groupAddMemberEmail');
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
        loadGroupMembers(updatedUserIds, updatedUsers);

        // Clear input
        emailInput.value = '';

        alert('Üye başarıyla eklendi!');
    } catch (error) {
        console.error('Üye eklenirken hata:', error);
        alert('Üye eklenirken hata oluştu: ' + error.message);
    }
}

// Remove member from group
async function removeGroupMember(userId) {
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
        loadGroupMembers(updatedUserIds, updatedUsers);

        alert('Üye gruptan çıkarıldı!');
    } catch (error) {
        console.error('Üye çıkarılırken hata:', error);
        alert('Üye çıkarılırken hata oluştu: ' + error.message);
    }
}

// Save group changes
async function saveGroupChanges(e) {
    e.preventDefault();

    const newName = document.getElementById('groupManageName').value.trim();
    const newPhotoFile = document.getElementById('groupManagePhoto').files[0];

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
        if (document.getElementById('chatViewTitle')) {
            document.getElementById('chatViewTitle').textContent = `💬 ${newName}`;
        }

        alert('Grup bilgileri güncellendi!');
        closeGroupManagementModal();

        // Refresh chat list
        loadChatList();
    } catch (error) {
        console.error('Grup güncellenirken hata:', error);
        alert('Grup güncellenirken hata oluştu: ' + error.message);
    }
}

// Delete group
async function deleteGroup() {
    if (!confirm('Bu grubu silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) return;

    try {
        await db.collection('chats').doc(currentManagedGroupId).delete();

        alert('Grup silindi!');
        closeGroupManagementModal();

        // Close chat view and go back to chat list
        closeChatView();
        loadChatList();
    } catch (error) {
        console.error('Grup silinirken hata:', error);
        alert('Grup silinirken hata oluştu: ' + error.message);
    }
}

// Update group creation to include photo
async function submitNewGroupChat(e) {
    e.preventDefault();

    const groupName = document.getElementById('groupChatName').value.trim();
    const emailsRaw = document.getElementById('groupChatUserEmails').value.trim();
    const photoFile = document.getElementById('groupChatPhoto').files[0];

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

    // Add current trainer's email if not present
    if (!emails.includes(currentTrainer.email)) {
        emails.push(currentTrainer.email);
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
            createdBy: currentTrainer.id,
            createdAt: new Date().toISOString()
        };

        // Handle photo upload
        if (photoFile) {
            try {
                const photoUrl = await uploadFileToStorage(photoFile, 'group-photos/');
                groupData.groupPhoto = photoUrl;
            } catch (uploadError) {
                console.warn('Grup fotoğrafı yüklenemedi (CORS veya diğer hata):', uploadError.message);
                // Continue without photo - this is not critical for group creation
                alert('Grup fotoğrafı yüklenemedi, ancak grup oluşturulacak. Fotoğrafı daha sonra grup yönetiminden ekleyebilirsiniz.');
            }
        }

        const chatDoc = await db.collection('chats').add(groupData);

        closeNewGroupChatModal();
        openChatView(chatDoc.id, groupName);
        loadChatList(); // Refresh chat list
    } catch (error) {
        console.error('Grup sohbeti oluşturulurken hata:', error);
        alert('Grup sohbeti oluşturulamadı: ' + error.message);
    }
}

// Update openChatView to show group management button for groups created by current user
function openChatView(chatId, title) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.getElementById('chat-view-page').classList.add('active');
    document.getElementById('chatViewTitle').textContent = title || 'Sohbet';
    activeChatId = chatId;

    // Check if this is a group chat that can be managed by current user
    db.collection('chats').doc(chatId).get().then(doc => {
        if (doc.exists) {
            const chat = doc.data();
            const manageBtn = document.getElementById('groupManageBtn');
            // Get current user ID from sessionStorage (works for all user types)
            const currentUserId = sessionStorage.getItem('user_id');

            // Allow management if:
            // 1. User is the creator (createdBy field exists and matches current user UID or docId)
            // 2. For backward compatibility, allow management for groups without createdBy field
            const canManage = chat.type === 'group' && (!chat.createdBy || chat.createdBy === currentUserId || chat.createdBy === currentTrainer.docId);

            if (canManage) {
                manageBtn.style.display = 'inline-block';
                console.log('Group management button shown');
            } else {
                manageBtn.style.display = 'none';
                console.log('Group management button hidden - not authorized');
            }
        }
    }).catch(error => {
        console.error('Chat type kontrolü hatası:', error);
        const manageBtn = document.getElementById('groupManageBtn');
        manageBtn.style.display = 'none';
    });

    loadChatMessages(chatId);
    document.getElementById('chatForm').onsubmit = sendChatMessage;
}

// Upload file to Firebase Storage
async function uploadFileToStorage(file, path) {
    try {
        const storageRef = window.storage.ref();
        const fileRef = storageRef.child(path + Date.now() + '_' + file.name);

        const snapshot = await fileRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();

        return downloadURL;
    } catch (error) {
        console.error('Dosya yükleme hatası:', error);
        throw error;
    }
}

// Add event listeners for group management form
document.addEventListener('DOMContentLoaded', () => {
    const groupManageForm = document.getElementById('groupManagementForm');
    if (groupManageForm) {
        groupManageForm.addEventListener('submit', saveGroupChanges);
    }
});

window.openGroupManagement = openGroupManagement;
window.closeGroupManagementModal = closeGroupManagementModal;
window.addGroupMember = addGroupMember;
window.removeGroupMember = removeGroupMember;
window.saveGroupChanges = saveGroupChanges;
window.deleteGroup = deleteGroup;

// ======================== CHAT MESSAGE FUNCTIONS ========================

async function loadChatMessages(chatId) {
    try {
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.innerHTML = '<p style="color: #95a5a6; text-align: center;">Mesajlar yükleniyor...</p>';

        // Set up real-time listener for messages
        window.chatUnsub = db.collection('chats').doc(chatId).collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot((snapshot) => {
                const messages = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));

                if (messages.length === 0) {
                    messagesContainer.innerHTML = '<p style="color: #95a5a6; text-align: center;">Henüz mesaj yok.</p>';
                    return;
                }

                let html = '';
                messages.forEach(message => {
                    const isOwnMessage = message.senderId === currentTrainer.id;
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

async function sendChatMessage(e) {
    e.preventDefault();

    const messageInput = document.getElementById('chatInput');
    const messageText = messageInput.value.trim();

    if (!messageText || !activeChatId) return;

    try {
        await db.collection('chats').doc(activeChatId).collection('messages').add({
            text: messageText,
            senderId: currentTrainer.id,
            senderName: currentTrainer.name,
            timestamp: new Date().toISOString()
        });

        messageInput.value = '';
    } catch (error) {
        console.error('Mesaj gönderilirken hata:', error);
        alert('Mesaj gönderilemedi: ' + error.message);
    }
}

window.loadChatMessages = loadChatMessages;
window.sendChatMessage = sendChatMessage;

// ======================== STANDARDS (BARAJLAR) ========================

let allStandards = [];

function getTrainerStandardScope(standard) {
    if (standard.scopeType) return standard.scopeType;
    if (standard.adminId) return 'admin';
    if (standard.trainerId) return 'trainer';
    return 'global';
}

function isStandardVisibleToTrainer(standard) {
    const scope = getTrainerStandardScope(standard);

    if (scope === 'global') {
        return true;
    }

    if (scope === 'admin') {
        return Boolean(currentTrainer.adminId) && standard.adminId === currentTrainer.adminId;
    }

    if (scope === 'trainer') {
        return standard.trainerId === currentTrainer.id || standard.trainerId === currentTrainer.docId;
    }

    return false;
}

function getTrainerStandardMeta(standard) {
    const scope = getTrainerStandardScope(standard);
    const scopeLabel = scope === 'global' ? 'Genel Baraj' : 'Kulüp Barajı';

    return scopeLabel;
}

let expandedTrainerStandardGroups = new Set();

function cleanTrainerStandardDocumentTitle(value) {
    const rawTitle = String(value || '').trim();
    if (!rawTitle) return 'BARAJ';

    const upperTitle = rawTitle.toLocaleUpperCase('tr-TR')
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

function isTrainerOpenAgeStandard(standard) {
    const token = String(standard?.ageGroupToken || '').trim();
    return Boolean(standard?.isOpenAgeGroup) || token.endsWith('+');
}

function doesTrainerStandardMatchBirthYear(standard, studentBirthYear) {
    const standardBirthYear = Number(standard?.birthYear);
    if (!Number.isFinite(standardBirthYear)) {
        return false;
    }

    const normalizedStudentBirthYear = Number(studentBirthYear);
    if (!Number.isFinite(normalizedStudentBirthYear)) {
        return true;
    }

    if (isTrainerOpenAgeStandard(standard)) {
        return normalizedStudentBirthYear <= standardBirthYear;
    }

    return standardBirthYear <= normalizedStudentBirthYear;
}

function getTrainerStandardBirthYearLabel(standard) {
    const birthYear = Number(standard?.birthYear);
    if (!Number.isFinite(birthYear)) {
        return '-';
    }
    if (isTrainerOpenAgeStandard(standard)) {
        return `${birthYear}+ (Açık Yaş)`;
    }
    return String(birthYear);
}

function getTrainerReadableStandardTitle(standard) {
    const year = getTrainerStandardBirthYearLabel(standard);
    const eventTitle = cleanTrainerStandardDocumentTitle(standard.name || standard.groupLabel || '');
    const poolLabel = standard.poolType ? `${standard.poolType} metre` : '';
    const categoryLabel = standard.category ? String(standard.category).toLocaleLowerCase('tr-TR') : '';
    return [year, eventTitle, poolLabel, categoryLabel].filter(Boolean).join(' ').trim();
}

function escapeTrainerStandardText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Barajları yükle
async function loadStandards() {
    try {
        const standardsSnap = await db.collection('standards')
            .orderBy('name')
            .get();

        allStandards = standardsSnap.docs
            .map(doc => ({id: doc.id, ...doc.data()}))
            .filter(isStandardVisibleToTrainer);
        displayStandards(allStandards);
    } catch (error) {
        console.error('Barajlar yüklenirken hata:', error);
        document.getElementById('standardsTableBody').innerHTML = '<tr><td colspan="8" style="padding: 20px; text-align: center; color: #e74c3c;">Barajlar yüklenemedi.</td></tr>';
    }
}

// Barajları göster
function displayStandards(standards) {
    const tbody = document.getElementById('standardsTableBody');
    
    if (standards.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #95a5a6;">Henüz baraj tanımlanmadı.</td></tr>';
        return;
    }

    const groupedStandards = new Map();
    standards.forEach(standard => {
        const title = getTrainerReadableStandardTitle(standard);
        const meta = getTrainerStandardMeta(standard);
        const groupKey = [
            standard.birthYear || '',
            cleanTrainerStandardDocumentTitle(standard.name || standard.groupLabel || ''),
            standard.poolType || '',
            standard.category || '',
            getTrainerStandardScope(standard),
            standard.adminId || '',
            standard.trainerId || ''
        ].join('|');
        if (!groupedStandards.has(groupKey)) {
            groupedStandards.set(groupKey, { key: groupKey, title, meta, items: [] });
        }
        groupedStandards.get(groupKey).items.push(standard);
    });

    let html = '';
    Array.from(groupedStandards.values())
        .sort((left, right) => Number(right.items[0]?.birthYear || 0) - Number(left.items[0]?.birthYear || 0)
            || String(left.title || '').localeCompare(String(right.title || ''), 'tr')
            || String(left.meta || '').localeCompare(String(right.meta || ''), 'tr'))
        .forEach(group => {
        const isExpanded = expandedTrainerStandardGroups.has(group.key);
        html += `
            <tr style="background:#f7fafc; border-bottom:1px solid #dfe7ef; cursor:pointer;" onclick="toggleTrainerStandardGroup('${escapeTrainerStandardText(group.key)}')">
                <td colspan="6" style="padding:14px 12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
                        <div>
                            <div style="font-weight:700; color:#22313f;">${isExpanded ? '▼' : '►'} ${escapeTrainerStandardText(group.title)}</div>
                            <div style="margin-top:4px; font-size:0.85em; color:#6f8091;">${escapeTrainerStandardText(group.meta)} • ${group.items.length} kayıt</div>
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
                                <div style="font-weight: 600; color: #2c3e50;">${escapeTrainerStandardText(standard.style)} ${escapeTrainerStandardText(standard.distance)}m</div>
                                <div style="margin-top: 4px; font-size: 0.82em; color: #7f8c8d;">${escapeTrainerStandardText(standard.gender)}</div>
                            </td>
                            <td style="padding: 12px;">${escapeTrainerStandardText(getTrainerStandardBirthYearLabel(standard))}</td>
                            <td style="padding: 12px;">${escapeTrainerStandardText(standard.gender)}</td>
                            <td style="padding: 12px;">${escapeTrainerStandardText(standard.style)}</td>
                            <td style="padding: 12px;">${escapeTrainerStandardText(standard.distance)}m</td>
                            <td style="padding: 12px; text-align: center; font-weight: 600; color: #2980b9;">${escapeTrainerStandardText(standard.time)}</td>
                        </tr>
                    `;
                });
        }
    });

    tbody.innerHTML = html;
}

function toggleTrainerStandardGroup(groupKey) {
    if (expandedTrainerStandardGroups.has(groupKey)) {
        expandedTrainerStandardGroups.delete(groupKey);
    } else {
        expandedTrainerStandardGroups.add(groupKey);
    }
    filterStandards();
}

// Baraj ekleme modal'ını aç
function openAddStandardModal() {
    alert('Barajları eklemek yalnızca Süper Admin tarafından yapılabilir.');
}

// Baraj modal'ını kapat
function closeAddStandardModal() {
    const modal = document.getElementById('addStandardModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Barajları filtrele
function filterStandards() {
    const nameFilter = document.getElementById('standardNameFilter').value.toLowerCase();
    const genderFilter = document.getElementById('standardGenderFilter').value;
    const styleFilter = document.getElementById('standardStyleFilter').value;
    const distanceFilter = document.getElementById('standardDistanceFilter').value;
    const birthYearFilter = document.getElementById('standardBirthYearFilter').value;

    const filtered = allStandards.filter(std => {
        const matchName = std.name.toLowerCase().includes(nameFilter);
        const matchGender = !genderFilter || std.gender === genderFilter;
        const matchStyle = !styleFilter || std.style === styleFilter;
        const matchDistance = !distanceFilter || std.distance.toString() === distanceFilter;
        const matchBirthYear = !birthYearFilter || std.birthYear.toString() === birthYearFilter;

        return matchName && matchGender && matchStyle && matchDistance && matchBirthYear;
    });

    displayStandards(filtered);
}

// ==================== KREDİ BOZDURMA SİSTEMİ ====================

// Bozdurma oranını yükle ve göster
async function loadExchangeRateTrainer() {
    try {
        const rateSnap = await db.collection('app_settings')
            .doc('credit_exchange_rate')
            .get();

        if (rateSnap.exists) {
            const data = rateSnap.data();
            window.exchangeRate = {
                creditAmount: data.creditAmount,
                turAmount: data.turAmount
            };
            updateExchangeRateDisplay();
        }
    } catch (error) {
        console.error('Bozdurma oranı yüklenirken hata:', error);
        document.getElementById('withdrawalExchangeRate').textContent = 'Yüklenemedi';
    }
}

// Bozdurma oranını ekranda güncelle
function updateExchangeRateDisplay() {
    if (!window.exchangeRate) return;
    
    const rate = (window.exchangeRate.turAmount / window.exchangeRate.creditAmount).toFixed(2);
    document.getElementById('withdrawalExchangeRate').textContent = 
        `${window.exchangeRate.creditAmount} Kredi = ${window.exchangeRate.turAmount} TL`;
    
    // Dinamik olarak TL tutarını hesapla
    const amountInput = document.getElementById('withdrawalAmount');
    if (amountInput) {
        amountInput.addEventListener('input', calculateWithdrawalAmount);
    }
}

// Bozdurulacak TL tutarını hesapla
function calculateWithdrawalAmount() {
    const amount = Number(document.getElementById('withdrawalAmount').value) || 0;
    if (!window.exchangeRate) return;
    
    const tlAmount = (amount * window.exchangeRate.turAmount) / window.exchangeRate.creditAmount;
    document.getElementById('withdrawalTLAmount').textContent = tlAmount.toFixed(2);
}

// İlk yükleme sırasında input listener'ını ekle
function loadWithdrawalBalance() {
    // Antrenörün mevcut kredi bakiyesini göster
    if (currentTrainer && typeof currentUserCredits !== 'undefined') {
        document.getElementById('withdrawalBalanceCredits').textContent = currentUserCredits;
    }
    
    // Ödeme yöntemi seçim listener'ı
    const paymentRadios = document.querySelectorAll('input[name="paymentMethod"]');
    paymentRadios.forEach(radio => {
        radio.addEventListener('change', showPaymentDetails);
    });
    
    // Form submit listener'ı
    const withdrawalForm = document.getElementById('withdrawalRequestForm');
    if (withdrawalForm) {
        withdrawalForm.addEventListener('submit', handleWithdrawalRequest);
    }
    
    // Miktarı dinamik hesaplama listener'ı
    const amountInput = document.getElementById('withdrawalAmount');
    if (amountInput) {
        amountInput.addEventListener('input', calculateWithdrawalAmount);
    }
}

// Ödeme yöntemi seçimine göre alanları göster/gizle
function showPaymentDetails() {
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    
    const eftDetails = document.getElementById('eftPaymentDetails');
    const cryptoDetails = document.getElementById('cryptoPaymentDetails');
    
    if (paymentMethod === 'eft') {
        eftDetails.style.display = 'grid';
        cryptoDetails.style.display = 'none';
        document.getElementById('ibanInput').required = true;
        document.getElementById('accountNameInput').required = true;
    } else {
        eftDetails.style.display = 'none';
        cryptoDetails.style.display = 'grid';
        document.getElementById('walletAddressInput').required = true;
        document.getElementById('networkInput').required = true;
        document.getElementById('coinTypeInput').required = true;
    }
}

window.showPaymentDetails = showPaymentDetails;

// Bozdurma talebi oluştur
async function handleWithdrawalRequest(e) {
    e.preventDefault();
    
    const amount = Number(document.getElementById('withdrawalAmount').value);
    
    // Bakiye kontrolü
    if (currentUserCredits < amount) {
        alert('Yeterli krediniz yok!');
        return;
    }
    
    if (!window.exchangeRate) {
        alert('Bozdurma oranı yüklenemedi. Lütfen sayfayı yenileyin.');
        return;
    }
    
    const tlAmount = (amount * window.exchangeRate.turAmount) / window.exchangeRate.creditAmount;
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    
    let withdrawalData = {
        trainerId: currentTrainer.id,
        trainerName: currentTrainer.name,
        creditAmount: amount,
        turAmount: tlAmount,
        paymentMethod: paymentMethod,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    
    // Ödeme yöntemi bilgilerini ekle
    if (paymentMethod === 'eft') {
        withdrawalData.iban = document.getElementById('ibanInput').value;
        withdrawalData.accountName = document.getElementById('accountNameInput').value;
    } else {
        withdrawalData.walletAddress = document.getElementById('walletAddressInput').value;
        withdrawalData.network = document.getElementById('networkInput').value;
        withdrawalData.coinType = document.getElementById('coinTypeInput').value;
    }
    
    try {
        // Bozdurma talebi oluştur
        const withdrawalRef = await db.collection('cash_withdrawal_requests').add(withdrawalData);

        const creditRef = db.collection('user_credits').doc(currentTrainer.id);
        await db.runTransaction(async transaction => {
            const creditDoc = await transaction.get(creditRef);
            const creditData = creditDoc.exists ? creditDoc.data() : {};
            const balance = Number(creditData.balance || 0);
            const blockedCredits = Number(creditData.blockedCredits || 0);

            if (balance < amount) {
                throw new Error('Yeterli krediniz yok!');
            }

            transaction.set(creditRef, {
                balance: balance - amount,
                blockedCredits: blockedCredits + amount,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
        });

        await db.collection('credit_transactions').add({
            userId: currentTrainer.id,
            amount: -amount,
            type: 'cash_withdrawal_hold',
            description: `${amount} kredi bozdurma talebi için bloke edildi`,
            referenceId: withdrawalRef.id,
            timestamp: new Date().toISOString(),
            balanceAfter: currentUserCredits - amount
        });

        currentUserCredits -= amount;
        currentTrainer.credits = currentUserCredits;
        currentTrainer.blockedCredits = (currentTrainer.blockedCredits || 0) + amount;
        updateCreditDisplay();
        
        // Başarılı bildirim göster
        showWithdrawalSuccessNotification(amount, tlAmount);
        
        // Formu temizle
        document.getElementById('withdrawalRequestForm').reset();
        loadWithdrawalBalance();
        
    } catch (error) {
        console.error('Bozdurma talebi oluşturulurken hata:', error);
        alert('Hata: ' + error.message);
    }
}

// Bozdurma başarılı bildirimi göster
function showWithdrawalSuccessNotification(credits, tlAmount) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border: 2px solid #27ae60;
        border-radius: 10px;
        padding: 25px;
        max-width: 400px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
            <div style="font-size: 2.5em;">✅</div>
            <h3 style="margin: 0; color: #27ae60;">Talep Başarılı!</h3>
        </div>
        <p style="margin: 10px 0; color: #333; font-size: 0.95em;">
            <strong>${credits} Kredi</strong> bozdurma talebiniz oluşturuldu.
        </p>
        <div style="background: #f0f7f4; padding: 12px; border-radius: 5px; margin: 12px 0;">
            <p style="margin: 5px 0; color: #27ae60; font-size: 1.2em; font-weight: 600;">
                ₺${tlAmount.toFixed(2)}
            </p>
            <p style="margin: 5px 0; color: #666; font-size: 0.85em;">Alacağınız Tutar</p>
        </div>
        <p style="margin: 12px 0; color: #e74c3c; font-weight: 600; font-size: 0.95em;">
            ⏱️ Ödeme 40 dakika içinde yapılacaktır
        </p>
        <p style="margin: 10px 0; color: #666; font-size: 0.85em;">
            Talibiniz Süper Admin tarafından onaylanmıştır. Kredileriniz talep tamamlanana kadar bloke edilecektir.
        </p>
        <button onclick="this.parentElement.remove()" style="
            width: 100%;
            padding: 10px;
            background: #27ae60;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: 600;
            margin-top: 12px;
        ">Tamam</button>
    `;
    
    document.body.appendChild(notification);
    
    // 8 saniye sonra otomatik kapat
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 8000);
}


