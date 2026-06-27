// Admin Dashboard JavaScript

let currentAdmin = null;
let allBranches = [];
let allTrainers = [];
let allSchedules = [];
let allStudents = [];
let allExpenses = [];
let allTrainerReviews = [];
let allPrices = {};
let financeChart = null;
let allAdminStandards = [];
let adminRealtimeUnsubs = [];
let adminRealtimeReloadTimer = null;
let adminMarketCart = [];
let allAdminMarketProducts = [];
let adminMarketBankSettings = null;
let currentClubProfileData = {};

const EXPENSE_CATEGORIES = [
    { id: 'pool_rent', label: 'Havuz kirası' },
    { id: 'advertising', label: 'Reklam / tanıtım harcaması' },
    { id: 'utilities', label: 'Elektrik / su / doğalgaz' },
    { id: 'equipment', label: 'Malzeme ve ekipman' },
    { id: 'maintenance', label: 'Bakım ve onarım' },
    { id: 'insurance', label: 'Sigorta' },
    { id: 'staff_services', label: 'Personel / dış hizmet' },
    { id: 'taxes_fees', label: 'Vergi ve resmi harçlar' },
    { id: 'office', label: 'Ofis / kırtasiye' },
    { id: 'other', label: 'Diğer' }
];

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeAdminMarketCardNumber(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 19);
}

function formatAdminMarketCardNumber(value) {
    return normalizeAdminMarketCardNumber(value).match(/.{1,4}/g)?.join(' ') || '';
}

function formatAdminMarketCardExpiry(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) {
        return digits;
    }
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function detectAdminMarketCardBrand(cardNumber) {
    const digits = normalizeAdminMarketCardNumber(cardNumber);
    if (/^4/.test(digits)) return 'Visa';
    if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
    if (/^3[47]/.test(digits)) return 'American Express';
    if (/^6(?:011|5)/.test(digits)) return 'Discover';
    return 'Bilinmiyor';
}
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

function clearAdminRealtimeSync() {
    adminRealtimeUnsubs.forEach(unsub => {
        try {
            unsub();
        } catch (error) {
            console.warn('Realtime unsubscribe hatasi:', error);
        }
    });
    adminRealtimeUnsubs = [];

    if (adminRealtimeReloadTimer) {
        clearTimeout(adminRealtimeReloadTimer);
        adminRealtimeReloadTimer = null;
    }
}

function getActiveAdminPage() {
    return document.querySelector('.nav-link.active')?.dataset?.page || 'dashboard';
}

async function refreshActiveAdminPageData() {
    const pageName = getActiveAdminPage();

    if (pageName === 'dashboard') {
        showDashboard();
    } else if (pageName === 'club') {
        loadClubProfile();
    } else if (pageName === 'secretaries') {
        loadSecretaries();
    } else if (pageName === 'education_models') {
        loadEducationModels();
    } else if (pageName === 'branches') {
        loadBranches();
    } else if (pageName === 'trainers') {
        loadTrainers();
    } else if (pageName === 'schedules') {
        loadSchedules();
    } else if (pageName === 'schedule_table') {
        loadScheduleTable();
    } else if (pageName === 'prices') {
        loadPrices();
    } else if (pageName === 'events') {
        loadEvents();
    } else if (pageName === 'announcements') {
        loadAnnouncements();
    } else if (pageName === 'market') {
        loadAdminMarketProducts();
    } else if (pageName === 'standards') {
        loadAdminStandards();
    } else if (pageName === 'discounts') {
        loadDiscounts();
    } else if (pageName === 'finance') {
        await loadFinance();
    } else if (pageName === 'chat') {
        loadAdminChatList();
    }
}

function scheduleAdminRealtimeReload() {
    if (adminRealtimeReloadTimer) {
        return;
    }

    adminRealtimeReloadTimer = setTimeout(async () => {
        adminRealtimeReloadTimer = null;
        try {
            await loadAllData();
            await refreshActiveAdminPageData();
        } catch (error) {
            console.warn('Realtime yenileme hatasi:', error);
        }
    }, 900);
}

function setupAdminRealtimeSync() {
    clearAdminRealtimeSync();

    if (!window.db || !currentAdmin?.id) {
        return;
    }

    const subscribe = (queryRef) => {
        const unsub = queryRef.onSnapshot(() => {
            scheduleAdminRealtimeReload();
        }, (error) => {
            console.warn('Realtime dinleme hatasi:', error);
        });
        adminRealtimeUnsubs.push(unsub);
    };

    const adminScopedCollections = [
        'branches',
        'trainers',
        'schedules',
        'students',
        'prices',
        'expenses',
        'payments',
        'incomes',
        'discounts',
        'announcements',
        'trainer_time_programs',
        'trainer_time_preferences',
        'attendance',
        'trainer_reviews'
    ];

    adminScopedCollections.forEach((collectionName) => {
        subscribe(db.collection(collectionName).where('adminId', '==', currentAdmin.id));
    });

    subscribe(db.collection('events').where('adminId', '==', currentAdmin.id));
    subscribe(db.collection('products'));
    subscribe(db.collection('standards'));
}

function formatTryCurrency(amount) {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(amount || 0));
}

function formatTryCurrencyCompact(amount) {
    const value = Number(amount || 0);
    const formatted = new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
    return `${formatted} ₺`;
}

function roundCurrency(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function getTrainerPaymentStatusMeta(status) {
    return status === 'paid'
        ? { label: 'Ödendi', className: 'badge-success' }
        : { label: 'Bekliyor', className: 'badge-warning' };
}

function getTrainerReviewAverage(review) {
    const scores = Object.values(review?.questionScores || {})
        .map(value => Number(value))
        .filter(value => Number.isFinite(value) && value >= 1 && value <= 5);
    if (!scores.length) {
        return null;
    }
    return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

function doesTrainerReviewMatchTrainer(review, trainer) {
    const trainerIds = [trainer?.id, trainer?.uid].filter(Boolean);
    const reviewIds = [review?.trainerDocId, review?.trainerId].filter(Boolean);
    return trainerIds.some(value => reviewIds.includes(value));
}

function getAdminTrainerReviewStats(trainer) {
    const matchingReviews = allTrainerReviews.filter(review => doesTrainerReviewMatchTrainer(review, trainer));
    const averages = matchingReviews
        .map(review => getTrainerReviewAverage(review))
        .filter(value => Number.isFinite(value));

    if (!averages.length) {
        return {
            count: 0,
            average: null,
            generalCount: 0,
            lessonCount: 0
        };
    }

    return {
        count: averages.length,
        average: averages.reduce((sum, value) => sum + value, 0) / averages.length,
        generalCount: matchingReviews.filter(review => review.scopeType === 'general').length,
        lessonCount: matchingReviews.filter(review => review.scopeType === 'lesson').length
    };
}

function renderTrainerReviewStars(value) {
    const score = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
    return '★'.repeat(score) + '☆'.repeat(5 - score);
}

function getScheduleLessonCount(schedule) {
    const lessonsCount = Number(schedule?.lessonsCount);
    return Number.isFinite(lessonsCount) && lessonsCount > 0 ? lessonsCount : 1;
}

function getScheduleLessonType(schedule) {
    const raw = String(schedule?.lessonType || '').trim();
    return raw || 'group';
}

function getScheduleLessonTypeLabel(schedule) {
    const key = getScheduleLessonType(schedule);
    if (typeof getEducationModelLabelById === 'function') {
        return getEducationModelLabelById(key);
    }
    if (key === 'private') return 'Özel Ders';
    if (key === 'group') return 'Grup Dersi';
    return key;
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

function getTrainerUniqueId(trainer) {
    return trainer?.uid || trainer?.id || '';
}

function escapeInlineString(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function resolveTrainerByIdentifier(identifier) {
    if (!identifier) return null;
    return allTrainers.find(trainer => trainer.id === identifier || trainer.uid === identifier) || null;
}

function normalizeScheduleTrainerAssignments(schedule) {
    if (Array.isArray(schedule?.trainerAssignments) && schedule.trainerAssignments.length) {
        return schedule.trainerAssignments
            .map((assignment, index) => {
                const trainer = resolveTrainerByIdentifier(assignment.trainerId) || resolveTrainerByIdentifier(assignment.trainerDocId);
                const trainerId = assignment.trainerId || trainer?.uid || trainer?.id || '';
                const trainerDocId = assignment.trainerDocId || trainer?.id || '';
                if (!trainerId && !trainerDocId) return null;

                return {
                    trainerId,
                    trainerDocId,
                    trainerName: assignment.trainerName || trainer?.name || 'Bilinmiyor',
                    role: assignment.role || (index === 0 ? 'head' : 'assistant'),
                    headTrainerId: assignment.headTrainerId || '',
                    headTrainerDocId: assignment.headTrainerDocId || '',
                    headTrainerName: assignment.headTrainerName || '',
                    trainerRate: Number.isFinite(Number(assignment.trainerRate)) ? Number(assignment.trainerRate) : null,
                    trainerPaymentDetails: Array.isArray(assignment.trainerPaymentDetails) ? assignment.trainerPaymentDetails : [],
                    trainerPaymentStatus: assignment.trainerPaymentStatus === 'paid' ? 'paid' : 'pending',
                    trainerPaidLessonCount: Number(assignment.trainerPaidLessonCount || 0)
                };
            })
            .filter(Boolean);
    }

    const trainer = resolveTrainerByIdentifier(schedule?.trainerId);
    if (!schedule?.trainerId && !trainer) {
        return [];
    }

    return [{
        trainerId: schedule?.trainerId || trainer?.uid || trainer?.id || '',
        trainerDocId: trainer?.id || '',
        trainerName: trainer?.name || 'Bilinmiyor',
        role: 'head',
        trainerRate: Number.isFinite(Number(schedule?.trainerRate)) ? Number(schedule.trainerRate) : null,
        trainerPaymentDetails: Array.isArray(schedule?.trainerPaymentDetails) ? schedule.trainerPaymentDetails : [],
        trainerPaymentStatus: schedule?.trainerPaymentStatus === 'paid' ? 'paid' : 'pending',
        trainerPaidLessonCount: Number(schedule?.trainerPaidLessonCount || 0)
    }];
}

function summarizeAssignmentPaymentDetails(assignment, lessonsCount) {
    const fallbackStatus = assignment?.trainerPaymentStatus === 'paid' ? 'paid' : 'pending';
    const existing = Array.isArray(assignment?.trainerPaymentDetails) ? assignment.trainerPaymentDetails : [];
    const details = Array.from({ length: lessonsCount }, (_, index) => ({
        ...(existing[index] || {}),
        lessonNumber: index + 1,
        status: existing[index]?.status === 'paid' ? 'paid' : fallbackStatus
    }));
    const paidLessons = details.filter(item => item.status === 'paid').length;

    return {
        details,
        paidLessons,
        totalLessons: lessonsCount,
        aggregateStatus: lessonsCount > 0 && paidLessons === lessonsCount ? 'paid' : 'pending'
    };
}

function formatScheduleTrainerAssignments(schedule) {
    const assignments = normalizeScheduleTrainerAssignments(schedule);
    if (!assignments.length) {
        return 'Bilinmiyor';
    }

    return assignments.map(assignment => {
        const roleLabel = assignment.role === 'assistant' ? 'Yardımcı Antrenör' : 'Baş Antrenör';
        if (assignment.role === 'assistant' && assignment.headTrainerName) {
            return `${assignment.trainerName} (${roleLabel} • ${assignment.headTrainerName})`;
        }
        return `${assignment.trainerName} (${roleLabel})`;
    }).join(', ');
}

function getScheduleHeadTrainerOptions(assignments = [], currentAssignment = {}) {
    return assignments
        .filter(item => item.role === 'head' && item.trainerId)
        .map(item => ({
            trainerId: item.trainerId,
            trainerDocId: item.trainerDocId || '',
            trainerName: item.trainerName || 'Baş Antrenör'
        }))
        .filter((item, index, list) => list.findIndex(other => other.trainerId === item.trainerId) === index);
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

function renderScheduleDaysPicker(selectedDays = []) {
    const container = document.getElementById('scheduleDaysPicker');
    if (!container) return;

    const selected = new Set((selectedDays || []).map(day => String(day).trim()));
    container.innerHTML = AVAILABILITY_DAY_OPTIONS.map(day => `
        <label style="display:inline-flex; align-items:center; gap:6px; padding:6px 8px; background:#fff; border:1px solid #dbe4ef; border-radius:6px; cursor:pointer;">
            <input type="checkbox" name="scheduleDay" value="${day.key}" ${selected.has(day.key) ? 'checked' : ''}>
            <span>${day.label}</span>
        </label>
    `).join('');
}

function getSelectedScheduleDays() {
    return Array.from(document.querySelectorAll('#scheduleDaysPicker input[name="scheduleDay"]:checked'))
        .map(input => input.value)
        .sort((a, b) => {
            const ai = AVAILABILITY_DAY_OPTIONS.findIndex(item => item.key === a);
            const bi = AVAILABILITY_DAY_OPTIONS.findIndex(item => item.key === b);
            return ai - bi;
        });
}

function formatScheduleDays(schedule) {
    return getNormalizedScheduleDays(schedule)
        .map(day => getAvailabilityDayLabel(day))
        .join(', ');
}

function updateScheduleCalendarPreview() {
    const preview = document.getElementById('scheduleCalendarPreview');
    if (!preview) return;

    const branchId = document.getElementById('scheduleBranch')?.value;
    const time = document.getElementById('scheduleTime')?.value || '-';
    const lessonType = document.getElementById('scheduleLessonType')?.value === 'private' ? 'Özel Ders' : 'Grup Dersi';
    const lessonsCount = Math.max(1, parseInt(document.getElementById('scheduleLessonsCount')?.value || '1', 10));
    const startDateRaw = document.getElementById('scheduleStartDate')?.value;
    const selectedDays = getSelectedScheduleDays();
    const branch = allBranches.find(item => item.id === branchId);

    if (!startDateRaw || !selectedDays.length) {
        preview.innerHTML = 'Takvim önizlemesi için başlangıç tarihi ve en az bir ders günü seçin.';
        return;
    }

    const startDate = parseDateValue(startDateRaw);
    if (!startDate) {
        preview.innerHTML = 'Başlangıç tarihi geçersiz.';
        return;
    }

    const lessonDates = calculateLessonDatesFromStart(startDate, selectedDays, lessonsCount);
    const endDate = lessonDates.length ? lessonDates[lessonDates.length - 1] : startDate;
    const weeksSpan = Math.max(1, Math.ceil((lessonDates.length || 1) / Math.max(1, selectedDays.length)));
    const startDayLabel = getAvailabilityDayLabel(selectedDays.find(day => mapDayKeyToJsDay(day) === startDate.getDay()) || selectedDays[0]);

    preview.innerHTML = `
        <strong>${branch ? branch.name : 'Şube'} için ${time} ${lessonType.toLocaleLowerCase('tr-TR')}</strong><br>
        ${formatDateTR(startDate)} (${startDayLabel}) tarihinde başlayacaktır.<br>
        Ders günleri: <strong>${selectedDays.map(getAvailabilityDayLabel).join(', ')}</strong><br>
        Toplam ${lessonsCount} ders planında yaklaşık <strong>${weeksSpan} hafta</strong> sürer ve <strong>${formatDateTR(endDate)}</strong> tarihinde biter.
    `;
}

function renderScheduleTrainerAssignmentRows(assignments = []) {
    const container = document.getElementById('scheduleTrainerAssignments');
    if (!container) return;

    const effectiveAssignments = assignments.length
        ? assignments
        : [{ trainerId: '', trainerDocId: '', role: 'head' }];

    const headTrainerOptions = getScheduleHeadTrainerOptions(effectiveAssignments);

    container.innerHTML = effectiveAssignments.map((assignment, index) => {
        const trainerOptions = ['<option value="">-- Antrenör Seçiniz --</option>']
            .concat(allTrainers.map(trainer => {
                const trainerId = getTrainerUniqueId(trainer);
                return `<option value="${trainerId}" data-doc-id="${trainer.id}" ${trainerId === assignment.trainerId || trainer.id === assignment.trainerDocId ? 'selected' : ''}>${escapeHtml(trainer.name)}</option>`;
            }))
            .join('');

        const isAssistant = assignment.role === 'assistant';
        const headOptions = ['<option value="">-- Baş Antrenör Seçiniz --</option>']
            .concat(headTrainerOptions.map(head => {
                const selected = head.trainerId === assignment.headTrainerId || head.trainerDocId === assignment.headTrainerDocId;
                return `<option value="${head.trainerId}" data-doc-id="${head.trainerDocId}" ${selected ? 'selected' : ''}>${escapeHtml(head.trainerName)}</option>`;
            }))
            .join('');

        return `
            <div class="schedule-trainer-assignment-row">
                <select class="schedule-trainer-select" data-index="${index}" required aria-label="Antrenör">
                    ${trainerOptions}
                </select>
                <select class="schedule-trainer-role" data-index="${index}" aria-label="Rol">
                    <option value="head" ${assignment.role === 'head' ? 'selected' : ''}>Baş Antrenör</option>
                    <option value="assistant" ${assignment.role === 'assistant' ? 'selected' : ''}>Yardımcı Antrenör</option>
                </select>
                <select class="schedule-head-trainer-select" data-index="${index}" aria-label="Baş antrenör" ${isAssistant ? '' : 'disabled'} style="${isAssistant ? '' : 'opacity:0.55;'}">
                    ${headOptions}
                </select>
                <button type="button" class="btn btn-danger btn-sm" onclick="removeScheduleTrainerAssignmentRow(${index})" ${effectiveAssignments.length === 1 ? 'disabled' : ''}>Sil</button>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.schedule-trainer-role').forEach(select => {
        select.addEventListener('change', () => {
            renderScheduleTrainerAssignmentRows(collectScheduleTrainerAssignments({ allowEmpty: true }));
        });
    });
    container.querySelectorAll('.schedule-trainer-select').forEach(select => {
        select.addEventListener('change', () => {
            renderScheduleTrainerAssignmentRows(collectScheduleTrainerAssignments({ allowEmpty: true }));
        });
    });
}

function addScheduleTrainerAssignmentRow() {
    const currentAssignments = collectScheduleTrainerAssignments({ allowEmpty: true });
    currentAssignments.push({ trainerId: '', trainerDocId: '', role: currentAssignments.length === 0 ? 'head' : 'assistant' });
    renderScheduleTrainerAssignmentRows(currentAssignments);
    if (typeof recomputeScheduleAutoCapacity === 'function') {
        recomputeScheduleAutoCapacity();
    }
}

function removeScheduleTrainerAssignmentRow(index) {
    const currentAssignments = collectScheduleTrainerAssignments({ allowEmpty: true });
    if (currentAssignments.length <= 1) {
        renderScheduleTrainerAssignmentRows([{ trainerId: '', trainerDocId: '', role: 'head' }]);
        if (typeof recomputeScheduleAutoCapacity === 'function') {
            recomputeScheduleAutoCapacity();
        }
        return;
    }
    currentAssignments.splice(index, 1);
    if (currentAssignments.length && !currentAssignments.some(item => item.role === 'head')) {
        currentAssignments[0].role = 'head';
    }
    renderScheduleTrainerAssignmentRows(currentAssignments);
    if (typeof recomputeScheduleAutoCapacity === 'function') {
        recomputeScheduleAutoCapacity();
    }
}

function collectScheduleTrainerAssignments(options = {}) {
    const rows = Array.from(document.querySelectorAll('#scheduleTrainerAssignments .schedule-trainer-assignment-row'));
    const assignments = rows.map(row => {
        const trainerSelect = row.querySelector('.schedule-trainer-select');
        const roleSelect = row.querySelector('.schedule-trainer-role');
        const headTrainerSelect = row.querySelector('.schedule-head-trainer-select');
        const trainerId = trainerSelect?.value || '';
        const trainer = resolveTrainerByIdentifier(trainerId);
        const role = roleSelect?.value === 'assistant' ? 'assistant' : 'head';
        const headTrainerId = role === 'assistant' ? (headTrainerSelect?.value || '') : trainerId;
        const headTrainer = resolveTrainerByIdentifier(headTrainerId);

        return {
            trainerId,
            trainerDocId: trainer?.id || '',
            trainerName: trainer?.name || '',
            role,
            headTrainerId: role === 'assistant' ? headTrainerId : trainerId,
            headTrainerDocId: role === 'assistant' ? (headTrainer?.id || headTrainerSelect?.selectedOptions?.[0]?.dataset?.docId || '') : (trainer?.id || ''),
            headTrainerName: role === 'assistant' ? (headTrainer?.name || '') : (trainer?.name || '')
        };
    }).filter(item => options.allowEmpty || item.trainerId);

    return assignments;
}

function summarizeTrainerPaymentDetails(schedule) {
    const assignments = normalizeScheduleTrainerAssignments(schedule);
    const lessonsCount = getScheduleLessonCount(schedule);
    const assignmentSummaries = assignments.map(assignment => {
        const paymentSummary = summarizeAssignmentPaymentDetails(assignment, lessonsCount);
        return {
            ...assignment,
            ...paymentSummary,
            trainerRate: Number.isFinite(Number(assignment.trainerRate)) ? Number(assignment.trainerRate) : null
        };
    });

    const paidLessons = assignmentSummaries.reduce((sum, assignment) => sum + assignment.paidLessons, 0);
    const totalLessons = assignmentSummaries.reduce((sum, assignment) => sum + assignment.totalLessons, 0);

    return {
        assignments: assignmentSummaries,
        paidLessons,
        pendingLessons: Math.max(0, totalLessons - paidLessons),
        totalLessons,
        aggregateStatus: totalLessons > 0 && paidLessons === totalLessons ? 'paid' : 'pending'
    };
}

function getAdminScheduleDisplayLabel(schedule, branch = null) {
    if (!schedule) {
        return 'Bilinmiyor';
    }
    const resolvedBranch = branch || allBranches.find(item => item.id === schedule.branchId);
    const customName = String(schedule.customName || '').trim();
    const time = schedule.time || '';
    const days = formatScheduleDays(schedule);
    const daySuffix = days ? ` • ${days}` : '';
    if (customName) {
        return `${customName} • ${time}${daySuffix}`;
    }
    const branchName = resolvedBranch?.name || 'Şube';
    return `${branchName} • ${time}${daySuffix}`;
}

function getExpenseCategoryMeta(categoryId) {
    return EXPENSE_CATEGORIES.find(item => item.id === categoryId) || null;
}

function getExpenseDisplayLabel(expense) {
    if (!expense) {
        return 'Gider';
    }
    if (expense.category === 'other' && expense.otherNote) {
        return `Diğer: ${expense.otherNote}`;
    }
    if (expense.categoryLabel) {
        return expense.categoryLabel;
    }
    const categoryMeta = getExpenseCategoryMeta(expense.category);
    if (categoryMeta) {
        return categoryMeta.label;
    }
    return expense.description || 'Gider';
}

function populateExpenseCategorySelect() {
    const select = document.getElementById('expenseCategory');
    if (!select) {
        return;
    }
    select.innerHTML = '<option value="">-- Gider türü seçiniz --</option>' +
        EXPENSE_CATEGORIES.map(category => `<option value="${category.id}">${escapeHtml(category.label)}</option>`).join('');
}

function toggleExpenseOtherNote() {
    const category = document.getElementById('expenseCategory')?.value || '';
    const group = document.getElementById('expenseOtherNoteGroup');
    if (!group) {
        return;
    }
    group.style.display = category === 'other' ? 'block' : 'none';
    if (category !== 'other') {
        const noteInput = document.getElementById('expenseOtherNote');
        if (noteInput) {
            noteInput.value = '';
        }
    }
}

function getStudentFinanceTotals(student) {
    const totalAmount = roundCurrency(student?.totalAmount || 0);
    const paidAmount = roundCurrency(student?.totalPaid || 0);
    const remainingAmount = Math.max(0, roundCurrency(totalAmount - paidAmount));
    return { totalAmount, paidAmount, remainingAmount };
}

function escapeHtmlForPdf(value) {
    return escapeHtml(value);
}

function formatReportDateTR(date = new Date()) {
    return date.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

function studentMatchesFinanceFilters(student, branchFilter, scheduleFilter) {
    const branchId = resolveFinanceBranchId(student, student);
    const scheduleId = resolveFinanceScheduleId(student, student);
    if (branchFilter && branchId !== branchFilter) {
        return false;
    }
    if (scheduleFilter && scheduleId !== scheduleFilter) {
        return false;
    }
    return true;
}

function groupFinanceStudentsForPdf(students) {
    const groups = {};

    students.forEach(student => {
        const schedule = allSchedules.find(item => item.id === student.scheduleId);
        const branch = allBranches.find(item => item.id === resolveFinanceBranchId(student, student));
        const label = getAdminScheduleDisplayLabel(schedule, branch);
        if (!groups[label]) {
            groups[label] = { label, students: [] };
        }
        groups[label].students.push(student);
    });

    return Object.values(groups).sort((left, right) => left.label.localeCompare(right.label, 'tr'));
}

function summarizeFinanceExpensesByCategory(expenses) {
    const summary = {};
    expenses.forEach(expense => {
        const key = expense.category || 'legacy';
        const label = getExpenseDisplayLabel(expense);
        if (!summary[key]) {
            summary[key] = { label, total: 0, count: 0 };
        }
        summary[key].total += Number(expense.amount || 0);
        summary[key].count += 1;
    });
    return Object.values(summary).sort((left, right) => right.total - left.total);
}

async function resolveAdminClubPdfName() {
    try {
        const clubDoc = await db.collection('clubProfiles').doc(currentAdmin.id).get();
        if (clubDoc.exists) {
            const clubData = clubDoc.data() || {};
            return getClubDisplayNameFromData(clubData) || currentAdmin.name || 'Yüzme Kulübü';
        }
    } catch (error) {
        console.warn('Kulüp adı alınamadı:', error);
    }
    return currentAdmin?.name || 'Yüzme Kulübü';
}

function buildFinancePdfHtml(options = {}) {
    const {
        clubName = 'Yüzme Kulübü',
        rangeLabel = '',
        summary = {},
        expenseSummary = [],
        studentGroups = []
    } = options;

    const expenseRowsHtml = expenseSummary.length
        ? expenseSummary.map(item => `
            <tr>
                <td>${escapeHtmlForPdf(item.label)}</td>
                <td style="text-align:center;">${item.count}</td>
                <td class="pdf-money">${escapeHtmlForPdf(formatTryCurrencyCompact(item.total))}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="3" style="text-align:center; color:#7f8c8d;">Bu dönemde manuel gider yok.</td></tr>';

    const studentGroupsHtml = studentGroups.length
        ? studentGroups.map(group => {
            const sortedStudents = group.students.slice().sort((left, right) => {
                const nameLeft = `${left.name || ''} ${left.surname || ''}`.trim();
                const nameRight = `${right.name || ''} ${right.surname || ''}`.trim();
                return nameLeft.localeCompare(nameRight, 'tr');
            });

            const rowsHtml = sortedStudents.map((student, index) => {
                const totals = getStudentFinanceTotals(student);
                return `
                    <tr class="${index % 2 === 0 ? 'pdf-row-even' : 'pdf-row-odd'}">
                        <td class="pdf-name">${escapeHtmlForPdf(`${student.name || ''} ${student.surname || ''}`.trim())}</td>
                        <td class="pdf-money">${escapeHtmlForPdf(formatTryCurrencyCompact(totals.totalAmount))}</td>
                        <td class="pdf-money">${escapeHtmlForPdf(formatTryCurrencyCompact(totals.paidAmount))}</td>
                        <td class="pdf-money">${escapeHtmlForPdf(formatTryCurrencyCompact(totals.remainingAmount))}</td>
                    </tr>
                `;
            }).join('');

            return `
                <section class="pdf-group-block">
                    <div class="pdf-group-title">Ders: ${escapeHtmlForPdf(group.label)} (${sortedStudents.length} öğrenci)</div>
                    <table class="pdf-finance-table">
                        <colgroup>
                            <col class="col-name">
                            <col class="col-money">
                            <col class="col-money">
                            <col class="col-money">
                        </colgroup>
                        <thead>
                            <tr>
                                <th>Ad Soyad</th>
                                <th class="pdf-money">Toplam</th>
                                <th class="pdf-money">Ödenen</th>
                                <th class="pdf-money">Kalan</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </section>
            `;
        }).join('')
        : '<p style="text-align:center; color:#7f8c8d;">Seçili filtreye uygun öğrenci bulunamadı.</p>';

    return `
        <style>
            .finance-pdf-root {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                color: #1e293b;
                background: #ffffff;
                width: 1060px;
                padding: 22px 24px 30px;
                box-sizing: border-box;
            }
            .pdf-main-title { margin: 0; text-align: center; font-size: 22px; font-weight: 700; }
            .pdf-main-subtitle { margin: 8px 0 20px; text-align: center; font-size: 12px; color: #64748b; }
            .pdf-summary-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 10px;
                margin-bottom: 22px;
            }
            .pdf-summary-card {
                border: 1px solid #dbe4ef;
                border-radius: 8px;
                padding: 10px;
                background: #f8fbff;
                text-align: center;
            }
            .pdf-summary-card span { display: block; font-size: 10px; color: #64748b; margin-bottom: 4px; }
            .pdf-summary-card strong { font-size: 11px; color: #0b7ea8; word-break: break-word; }
            .pdf-section-title {
                margin: 18px 0 10px;
                font-size: 13px;
                font-weight: 700;
                color: #0f2942;
                border-bottom: 2px solid #e2e8f0;
                padding-bottom: 6px;
            }
            .pdf-finance-table, .pdf-expense-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 9.5px;
                table-layout: fixed;
            }
            .pdf-finance-table col.col-name { width: 38%; }
            .pdf-finance-table col.col-money { width: 20.66%; }
            .pdf-finance-table thead th, .pdf-expense-table thead th {
                background: #0f2942;
                color: #fff;
                padding: 7px 5px;
                text-align: left;
                border: 1px solid #0f2942;
            }
            .pdf-finance-table thead th.pdf-money,
            .pdf-finance-table td.pdf-money,
            .pdf-expense-table td.pdf-money {
                text-align: right;
                white-space: nowrap;
                font-variant-numeric: tabular-nums;
                letter-spacing: -0.15px;
                padding-left: 4px;
                padding-right: 6px;
            }
            .pdf-finance-table tbody td, .pdf-expense-table tbody td {
                border: 1px solid #dbe4ef;
                padding: 6px 5px;
                vertical-align: middle;
            }
            .pdf-finance-table tbody td.pdf-name {
                word-wrap: break-word;
                overflow-wrap: anywhere;
                line-height: 1.35;
            }
            .pdf-finance-table tbody tr.pdf-row-even td { background: #f8fafc; }
            .pdf-group-block { margin-bottom: 18px; page-break-inside: avoid; }
            .pdf-group-title {
                background: #e8f6fc;
                border: 1px solid #b8d9e8;
                border-bottom: none;
                padding: 8px 10px;
                font-size: 11px;
                font-weight: 700;
            }
            .pdf-footer-note { margin-top: 16px; font-size: 10px; color: #94a3b8; }
        </style>
        <div class="finance-pdf-root">
            <h1 class="pdf-main-title">${escapeHtmlForPdf(clubName)}</h1>
            <p class="pdf-main-subtitle">Gelir / Gider Raporu • ${escapeHtmlForPdf(rangeLabel)}</p>
            <div class="pdf-summary-grid">
                <div class="pdf-summary-card"><span>Ciro</span><strong>${escapeHtmlForPdf(formatTryCurrencyCompact(summary.turnover || 0))}</strong></div>
                <div class="pdf-summary-card"><span>Gelir</span><strong>${escapeHtmlForPdf(formatTryCurrencyCompact(summary.income || 0))}</strong></div>
                <div class="pdf-summary-card"><span>Gider</span><strong>${escapeHtmlForPdf(formatTryCurrencyCompact(summary.expense || 0))}</strong></div>
                <div class="pdf-summary-card"><span>Kâr</span><strong>${escapeHtmlForPdf(formatTryCurrencyCompact(summary.profit || 0))}</strong></div>
            </div>
            <h2 class="pdf-section-title">Gider özeti (manuel)</h2>
            <table class="pdf-expense-table">
                <thead>
                    <tr>
                        <th>Gider türü</th>
                        <th style="width:12%; text-align:center;">Adet</th>
                        <th style="width:22%; text-align:right;">Toplam</th>
                    </tr>
                </thead>
                <tbody>${expenseRowsHtml}</tbody>
            </table>
            <h2 class="pdf-section-title">Öğrenci ödeme durumu</h2>
            ${studentGroupsHtml}
            <p class="pdf-footer-note">Rapor tarihi: ${escapeHtmlForPdf(formatReportDateTR())}</p>
        </div>
    `;
}

async function downloadFinancePdf(html, filename = 'gelir-gider-raporu.pdf') {
    if (typeof window.html2pdf !== 'function') {
        throw new Error('PDF kütüphanesi yüklenemedi. Sayfayı yenileyip tekrar deneyin.');
    }

    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    // html2canvas, "left:-10000px" gibi viewport disindaki konteynerleri bazi
    // kombinasyonlarda (body overflow-x:hidden / panel-enhanced stilleriyle)
    // bos olarak yakalayabiliyor. Bunun yerine ekranda gorunur konuma alip
    // opacity:0 + pointer-events:none ile gozden gizliyoruz. Boylece layout
    // gercek pikseller uzerinden hesaplanir ve PDF dolu uretilir.
    host.style.cssText = [
        'position: fixed',
        'top: 0',
        'left: 0',
        'width: 1123px',
        'max-width: 1123px',
        'background: #ffffff',
        'opacity: 0',
        'pointer-events: none',
        'z-index: -1',
        'overflow: visible'
    ].join('; ') + ';';
    host.innerHTML = html;
    document.body.appendChild(host);

    const root = host.querySelector('.finance-pdf-root');
    if (!root) {
        document.body.removeChild(host);
        throw new Error('PDF içeriği oluşturulamadı.');
    }

    try {
        await window.html2pdf()
            .set({
                margin: [10, 8, 12, 8],
                filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    letterRendering: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    width: 1123,
                    windowWidth: 1123,
                    scrollX: 0,
                    scrollY: 0
                },
                jsPDF: {
                    unit: 'mm',
                    format: 'a4',
                    orientation: 'landscape'
                },
                pagebreak: { mode: ['css', 'legacy'] }
            })
            .from(root)
            .save();
    } finally {
        document.body.removeChild(host);
    }
}

async function exportFinancePdf() {
    if (!currentAdmin?.id) {
        alert('Oturum bulunamadı.');
        return;
    }

    const branchFilter = document.getElementById('financeBranchFilter')?.value || '';
    const scheduleFilter = document.getElementById('financeScheduleFilter')?.value || '';
    const range = getFinanceDateRange();
    const rangeLabel = formatFinanceRangeLabel(range);

    try {
        const turnoverEl = document.getElementById('currentTurnover');
        const incomeEl = document.getElementById('currentIncome');
        const expenseEl = document.getElementById('currentExpense');
        const profitEl = document.getElementById('currentProfit');

        const filteredStudents = allStudents.filter(student => studentMatchesFinanceFilters(student, branchFilter, scheduleFilter));
        const filteredExpenses = allExpenses.filter(expense => {
            if (!isDateInFinanceRange(expense.date || expense.createdAt, range)) {
                return false;
            }
            const branchId = resolveFinanceBranchId(expense);
            const scheduleId = resolveFinanceScheduleId(expense);
            if (branchFilter && branchId !== branchFilter) {
                return false;
            }
            if (scheduleFilter && scheduleId !== scheduleFilter) {
                return false;
            }
            return true;
        });

        const clubName = await resolveAdminClubPdfName();
        const html = buildFinancePdfHtml({
            clubName,
            rangeLabel,
            summary: {
                turnover: parseTryCurrencyText(turnoverEl?.textContent),
                income: parseTryCurrencyText(incomeEl?.textContent),
                expense: parseTryCurrencyText(expenseEl?.textContent),
                profit: parseTryCurrencyText(profitEl?.textContent)
            },
            expenseSummary: summarizeFinanceExpensesByCategory(filteredExpenses),
            studentGroups: groupFinanceStudentsForPdf(filteredStudents)
        });

        const suffix = new Date().toISOString().slice(0, 10);
        await downloadFinancePdf(html, `gelir-gider-${suffix}.pdf`);
    } catch (error) {
        console.error('Finans PDF hatası:', error);
        alert('PDF oluşturulamadı: ' + error.message);
    }
}

function parseTryCurrencyText(text) {
    if (!text) {
        return 0;
    }
    const cleaned = String(text).replace(/[^\d,.-]/g, '').trim();
    if (!cleaned) {
        return 0;
    }
    if (cleaned.includes(',')) {
        const normalized = cleaned.replace(/\./g, '').replace(',', '.');
        const value = Number(normalized);
        return Number.isFinite(value) ? value : 0;
    }
    const value = Number(cleaned);
    return Number.isFinite(value) ? value : 0;
}

function createFinanceScheduleEntry(scheduleId) {
    const schedule = allSchedules.find(item => item.id === scheduleId);
    const branch = schedule ? allBranches.find(item => item.id === schedule.branchId) : null;
    return {
        scheduleName: getAdminScheduleDisplayLabel(schedule, branch),
        turnover: 0,
        income: 0,
        paymentIncome: 0,
        extraIncome: 0,
        expense: 0,
        manualExpense: 0,
        salaryExpense: 0,
        profit: 0,
        payments: [],
        incomes: [],
        expenses: [],
        salaryDetails: []
    };
}

function ensureFinanceBranchEntry(branchData, branchId) {
    if (!branchData[branchId]) {
        branchData[branchId] = {
            branchName: allBranches.find(branch => branch.id === branchId)?.name || 'Bilinmiyor',
            schedules: {},
                totalTurnover: 0,
            totalIncome: 0,
            totalExpense: 0,
            totalManualExpense: 0,
            totalSalaryExpense: 0,
            totalProfit: 0
        };
    }
    return branchData[branchId];
}

function ensureFinanceScheduleEntry(branchData, branchId, scheduleId) {
    const branchEntry = ensureFinanceBranchEntry(branchData, branchId);
    if (!branchEntry.schedules[scheduleId]) {
        branchEntry.schedules[scheduleId] = createFinanceScheduleEntry(scheduleId);
    }
    return branchEntry.schedules[scheduleId];
}

function calculateScheduleTrainerSalaryExpense(schedule) {
    const options = arguments[1] || {};
    const range = options.range || null;
    const assignments = normalizeScheduleTrainerAssignments(schedule);
    const details = assignments.flatMap(assignment => {
        const trainerRate = Number(assignment?.trainerRate);
        if (!Number.isFinite(trainerRate) || trainerRate <= 0) {
            return [];
        }

        const paymentDetails = Array.isArray(assignment?.trainerPaymentDetails) ? assignment.trainerPaymentDetails : [];
        const paidLessons = paymentDetails.filter(item => {
            if (item?.status !== 'paid') {
                return false;
            }
            if (!range) {
                return true;
            }
            const paidDate = parseDateValue(item?.paidAt || item?.updatedAt || schedule?.compensationUpdatedAt);
            return paidDate && paidDate >= range.start && paidDate <= range.end;
        });

        if (!paidLessons.length) {
            return [];
        }

        return [{
            trainerId: assignment.trainerId,
            trainerDocId: assignment.trainerDocId,
            trainerName: assignment.trainerName || 'Bilinmiyor',
            paidLessons: paidLessons.length,
            trainerRate,
            amount: trainerRate * paidLessons.length
        }];
    });

    return {
        total: details.reduce((sum, item) => sum + item.amount, 0),
        details
    };
}

function getFinanceRangePreset() {
    return document.getElementById('financeRangeFilter')?.value || 'all';
}

function getFinanceDateRange() {
    const preset = getFinanceRangePreset();
    if (preset === 'all') {
        return null;
    }

    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end.getTime());

    switch (preset) {
        case 'week':
            start.setDate(start.getDate() - 6);
            break;
        case 'twoWeeks':
            start.setDate(start.getDate() - 13);
            break;
        case 'month':
            start.setMonth(start.getMonth() - 1);
            break;
        case 'twoMonths':
            start.setMonth(start.getMonth() - 2);
            break;
        case 'threeMonths':
            start.setMonth(start.getMonth() - 3);
            break;
        case 'year':
            start.setFullYear(start.getFullYear() - 1);
            break;
        default:
            start.setDate(start.getDate() - 6);
            break;
    }

    start.setHours(0, 0, 0, 0);
    return { start, end, preset };
}

function formatFinanceRangeLabel(range) {
    if (!range) {
        return 'Tüm zamanların gelir ve gideri gösteriliyor.';
    }
    return `${range.start.toLocaleDateString('tr-TR')} - ${range.end.toLocaleDateString('tr-TR')} aralığı gösteriliyor.`;
}

function isDateInFinanceRange(value, range) {
    if (!range) {
        return true;
    }
    const date = parseDateValue(value);
    return Boolean(date && date >= range.start && date <= range.end);
}

function getFinanceRecordDate(record) {
    if (!record) {
        return null;
    }

    return parseDateValue(record.timestamp || record.date || record.createdAt || record.updatedAt);
}

function resolveFinanceBranchId(record, student = null) {
    return record?.branchId || record?.studentBranchId || student?.branchId || 'unknown';
}

function resolveFinanceScheduleId(record, student = null) {
    return record?.scheduleId || record?.studentScheduleId || student?.scheduleId || 'unknown';
}

function isBranchLevelIncomeRecord(income) {
    const scheduleId = String(income?.scheduleId || '').trim();
    return !scheduleId || scheduleId === 'unknown';
}

function doesIncomeMatchFinanceDetail(income, branchId, scheduleId) {
    const incomeBranchId = resolveFinanceBranchId(income);
    if (incomeBranchId !== branchId) {
        return false;
    }

    const incomeScheduleId = resolveFinanceScheduleId(income);
    return incomeScheduleId === scheduleId || isBranchLevelIncomeRecord(income);
}

function getAdminStudentInstallments(student) {
    if (Array.isArray(student?.installments) && student.installments.length) {
        return student.installments.map(item => ({ ...item }));
    }

    const installmentCount = Math.max(1, Number(student?.installmentCount) || 1);
    const totalAmount = Number(student?.totalAmount) || 0;
    const baseAmount = installmentCount > 0 ? totalAmount / installmentCount : 0;

    return Array.from({ length: installmentCount }, (_, index) => ({
        installmentNumber: index + 1,
        amount: index === installmentCount - 1 ? totalAmount - (baseAmount * index) : baseAmount,
        dueDate: '',
        lessonLabel: '',
        paidAmount: 0,
        paidAt: null
    }));
}

function rollbackPaymentFromInstallments(student, payment) {
    const installments = getAdminStudentInstallments(student).map(item => ({ ...item }));
    const allocationMap = new Map(
        (Array.isArray(payment?.installmentAllocations) ? payment.installmentAllocations : [])
            .map(item => [Number(item?.installmentNumber), roundCurrency(item?.appliedAmount || 0)])
            .filter(([installmentNumber, amount]) => Number.isFinite(installmentNumber) && amount > 0)
    );

    if (allocationMap.size) {
        installments.forEach(item => {
            const installmentNumber = Number(item?.installmentNumber);
            const appliedAmount = allocationMap.get(installmentNumber) || 0;
            if (!appliedAmount) {
                return;
            }

            const nextPaidAmount = Math.max(0, roundCurrency((item.paidAmount || 0) - appliedAmount));
            const totalAmount = roundCurrency(item.amount || 0);
            item.paidAmount = nextPaidAmount;
            item.paid = nextPaidAmount + 0.009 >= totalAmount;
            if (!item.paid) {
                item.paidAt = null;
            }
        });

        return installments;
    }

    let remainingRollback = roundCurrency(payment?.amount || 0);
    for (let index = installments.length - 1; index >= 0; index -= 1) {
        if (remainingRollback <= 0) {
            break;
        }

        const item = installments[index];
        const paidAmount = roundCurrency(item?.paidAmount || 0);
        if (paidAmount <= 0) {
            continue;
        }

        const rollbackAmount = Math.min(remainingRollback, paidAmount);
        const nextPaidAmount = Math.max(0, roundCurrency(paidAmount - rollbackAmount));
        const totalAmount = roundCurrency(item.amount || 0);
        item.paidAmount = nextPaidAmount;
        item.paid = nextPaidAmount + 0.009 >= totalAmount;
        if (!item.paid) {
            item.paidAt = null;
        }

        remainingRollback = roundCurrency(remainingRollback - rollbackAmount);
    }

    return installments;
}

function normalizeDateToDayStart(value) {
    const date = parseDateValue(value);
    if (!date) {
        return null;
    }
    const normalized = new Date(date.getTime());
    normalized.setHours(0, 0, 0, 0);
    return normalized;
}

function getDaysUntilDate(value, today = new Date()) {
    const targetDate = normalizeDateToDayStart(value);
    if (!targetDate) {
        return null;
    }
    const normalizedToday = new Date(today.getTime());
    normalizedToday.setHours(0, 0, 0, 0);
    return Math.round((targetDate.getTime() - normalizedToday.getTime()) / (1000 * 60 * 60 * 24));
}

function buildInstallmentAlerts() {
    const today = new Date();

    return allStudents.flatMap(student => {
        const branch = allBranches.find(item => item.id === student.branchId);
        const schedule = allSchedules.find(item => item.id === student.scheduleId);
        return getAdminStudentInstallments(student)
            .map(installment => {
                const amount = Number(installment.amount || 0);
                const paidAmount = Number(installment.paidAmount || 0);
                const remainingAmount = Math.max(0, amount - paidAmount);
                if (remainingAmount <= 0.009 || !installment.dueDate) {
                    return null;
                }

                const daysUntil = getDaysUntilDate(installment.dueDate, today);
                if (daysUntil === null || daysUntil > 3) {
                    return null;
                }

                return {
                    studentId: student.id,
                    studentName: `${student.name || ''} ${student.surname || ''}`.trim() || 'Bilinmiyor',
                    installmentNumber: installment.installmentNumber,
                    dueDate: installment.dueDate,
                    daysUntil,
                    remainingAmount,
                    lessonLabel: installment.lessonLabel || '',
                    branchName: branch?.name || 'Bilinmiyor',
                    scheduleName: schedule?.time || '-'
                };
            })
            .filter(Boolean);
    }).sort((a, b) => a.daysUntil - b.daysUntil || parseDateValue(a.dueDate) - parseDateValue(b.dueDate));
}

function renderInstallmentAlerts() {
    const container = document.getElementById('adminInstallmentAlerts');
    const countBadge = document.getElementById('adminInstallmentAlertCount');
    if (!container || !countBadge) {
        return;
    }

    const alerts = buildInstallmentAlerts();
    countBadge.textContent = String(alerts.length);

    if (!alerts.length) {
        container.innerHTML = '<p style="color: #95a5a6; margin: 0;">Önümüzdeki 3 gün içinde yaklaşan veya geciken taksit bulunmuyor.</p>';
        return;
    }

    container.innerHTML = alerts.map(item => {
        const statusText = item.daysUntil < 0
            ? `${Math.abs(item.daysUntil)} gün gecikti`
            : item.daysUntil === 0
                ? 'Bugün son gün'
                : `${item.daysUntil} gün kaldı`;
        const accentColor = item.daysUntil < 0 ? '#c0392b' : '#f39c12';

        return `
            <div style="padding: 14px; border: 1px solid #e8edf3; border-left: 4px solid ${accentColor}; border-radius: 8px; background: #fff; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; gap: 12px; align-items: start;">
                    <div>
                        <div style="font-weight: 700; color: #2c3e50;">${item.studentName}</div>
                        <div style="color: #5d7285; font-size: 0.92em; margin-top: 4px;">${item.branchName} • ${item.scheduleName} • ${item.installmentNumber}. taksit</div>
                        <div style="color: #5d7285; font-size: 0.92em; margin-top: 4px;">Son tarih: ${formatDateTR(item.dueDate)}${item.lessonLabel ? ` • ${item.lessonLabel}` : ''}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700; color: ${accentColor};">${statusText}</div>
                        <div style="color: #2c3e50; margin-top: 4px;">Kalan: ${formatTryCurrency(item.remainingAmount)}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function buildVisibleFinanceBranchData(branchData, branchFilter, scheduleFilter) {
    return Object.entries(branchData).reduce((accumulator, [branchId, branch]) => {
        if (branchFilter && branchId !== branchFilter) {
            return accumulator;
        }

        const visibleSchedules = Object.entries(branch.schedules).reduce((scheduleAccumulator, [scheduleId, schedule]) => {
            if (scheduleFilter && scheduleId !== scheduleFilter) {
                return scheduleAccumulator;
            }
            scheduleAccumulator[scheduleId] = schedule;
            return scheduleAccumulator;
        }, {});

        if (!Object.keys(visibleSchedules).length) {
            return accumulator;
        }

        const totals = Object.values(visibleSchedules).reduce((summary, schedule) => {
            summary.totalTurnover += schedule.turnover;
            summary.totalIncome += schedule.income;
            summary.totalExpense += schedule.expense;
            summary.totalManualExpense += schedule.manualExpense;
            summary.totalSalaryExpense += schedule.salaryExpense;
            return summary;
        }, {
            totalTurnover: 0,
            totalIncome: 0,
            totalExpense: 0,
            totalManualExpense: 0,
            totalSalaryExpense: 0
        });

        accumulator[branchId] = {
            ...branch,
            schedules: visibleSchedules,
            ...totals,
            totalProfit: totals.totalIncome - totals.totalExpense
        };
        return accumulator;
    }, {});
}

function buildLessonGroupChatId(adminId, branchId, scheduleId) {
    return ['lesson-group', adminId || 'global', branchId || 'unknown', scheduleId || 'unknown']
        .join('_')
        .replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function deleteDocumentsFromQuery(query) {
    const snap = await query.get();
    if (snap.empty) {
        return 0;
    }

    await Promise.all(snap.docs.map(doc => doc.ref.delete()));
    return snap.size;
}

async function deleteDocumentsByField(collectionName, fieldName, value) {
    if (!value) {
        return 0;
    }

    return deleteDocumentsFromQuery(db.collection(collectionName).where(fieldName, '==', value));
}

async function cleanupOrphanParentUser(parentUid, excludedStudentId = '') {
    if (!parentUid) {
        return;
    }

    const remainingStudentsSnap = await db.collection('students')
        .where('adminId', '==', currentAdmin.id)
        .where('parentUid', '==', parentUid)
        .get();

    const hasRemainingStudent = remainingStudentsSnap.docs.some(doc => doc.id !== excludedStudentId);
    if (!hasRemainingStudent) {
        await db.collection('users').doc(parentUid).delete().catch(() => null);
    }
}

async function cleanupLessonGroupChatForSchedule(branchId, scheduleId) {
    if (!branchId || !scheduleId) {
        return;
    }

    const remainingStudentsSnap = await db.collection('students')
        .where('adminId', '==', currentAdmin.id)
        .where('branchId', '==', branchId)
        .where('scheduleId', '==', scheduleId)
        .get();

    const remainingStudents = remainingStudentsSnap.docs
        .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
        .filter(student => String(student.status || 'active') !== 'inactive' && String(student.status || 'active') !== 'deleted');

    if (remainingStudents.length) {
        return;
    }

    await db.collection('chats').doc(buildLessonGroupChatId(currentAdmin.id, branchId, scheduleId)).delete().catch(() => null);
}

async function cleanupPriceForSchedule(branchId, scheduleTime, excludedScheduleId = '') {
    if (!branchId || !scheduleTime) {
        return;
    }

    const hasRemainingSchedule = allSchedules.some(schedule => {
        return schedule.id !== excludedScheduleId && schedule.branchId === branchId && schedule.time === scheduleTime;
    });

    if (!hasRemainingSchedule) {
        await db.collection('prices').doc(`${branchId}_${scheduleTime}`).delete().catch(() => null);
    }
}

async function cleanupStudentFirestoreRecords(studentId, studentData = {}) {
    await Promise.all([
        deleteDocumentsByField('payments', 'studentId', studentId),
        deleteDocumentsByField('attendance', 'studentId', studentId),
        deleteDocumentsByField('performances', 'studentId', studentId),
        deleteDocumentsByField('lesson_comments', 'studentId', studentId),
        deleteDocumentsByField('trainer_reviews', 'studentId', studentId),
        deleteDocumentsByField('student_workouts', 'studentId', studentId)
    ]);

    await db.collection('students').doc(studentId).delete().catch(() => null);
    await cleanupOrphanParentUser(studentData.parentUid || '', studentId);
    await cleanupLessonGroupChatForSchedule(studentData.branchId || '', studentData.scheduleId || '');
}

async function cleanupWorkoutDocumentsForSchedule(scheduleId) {
    if (!scheduleId) {
        return;
    }

    const workoutsSnap = await db.collection('workouts').where('scheduleId', '==', scheduleId).get();
    for (const workoutDoc of workoutsSnap.docs) {
        await deleteDocumentsByField('student_workouts', 'workoutId', workoutDoc.id);
        await deleteDocumentsByField('workout_sales', 'workoutId', workoutDoc.id).catch(() => null);
        await db.collection('active_workouts').doc(workoutDoc.id).delete().catch(() => null);
        await workoutDoc.ref.delete();
    }
}

async function cleanupScheduleFirestoreRecords(schedule) {
    if (!schedule?.id) {
        return;
    }

    const studentsSnap = await db.collection('students')
        .where('adminId', '==', currentAdmin.id)
        .where('scheduleId', '==', schedule.id)
        .get();

    for (const studentDoc of studentsSnap.docs) {
        await cleanupStudentFirestoreRecords(studentDoc.id, studentDoc.data() || {});
    }

    await Promise.all([
        deleteDocumentsByField('attendance', 'scheduleId', schedule.id),
        deleteDocumentsByField('student_workouts', 'scheduleId', schedule.id),
        deleteDocumentsByField('expenses', 'scheduleId', schedule.id),
        deleteDocumentsByField('incomes', 'scheduleId', schedule.id),
        deleteDocumentsByField('announcements', 'scheduleId', schedule.id),
        deleteDocumentsByField('lesson_comments', 'scheduleId', schedule.id),
        deleteDocumentsByField('trainer_reviews', 'scheduleId', schedule.id)
    ]);

    await cleanupWorkoutDocumentsForSchedule(schedule.id);
    await db.collection('schedules').doc(schedule.id).delete().catch(() => null);
    await cleanupLessonGroupChatForSchedule(schedule.branchId || '', schedule.id);
    await cleanupPriceForSchedule(schedule.branchId || '', schedule.time || '', schedule.id);
}

async function cleanupBranchFirestoreRecords(branchId) {
    if (!branchId) {
        return;
    }

    const branchSchedules = allSchedules.filter(schedule => schedule.branchId === branchId);
    for (const schedule of branchSchedules) {
        await cleanupScheduleFirestoreRecords(schedule);
    }

    const orphanStudentsSnap = await db.collection('students')
        .where('adminId', '==', currentAdmin.id)
        .where('branchId', '==', branchId)
        .get();
    for (const studentDoc of orphanStudentsSnap.docs) {
        await cleanupStudentFirestoreRecords(studentDoc.id, studentDoc.data() || {});
    }

    await Promise.all([
        deleteDocumentsByField('expenses', 'branchId', branchId),
        deleteDocumentsByField('incomes', 'branchId', branchId),
        deleteDocumentsByField('announcements', 'branchId', branchId),
        deleteDocumentsByField('events', 'branchId', branchId),
        deleteDocumentsByField('trainer_time_preferences', 'branchId', branchId)
    ]);

    await db.collection('trainer_time_programs').doc(`${currentAdmin.id}_${branchId}`).delete().catch(() => null);

    const pricesSnap = await db.collection('prices').where('adminId', '==', currentAdmin.id).get();
    await Promise.all(
        pricesSnap.docs
            .filter(doc => doc.id.startsWith(`${branchId}_`))
            .map(doc => doc.ref.delete())
    );

    await db.collection('branches').doc(branchId).delete().catch(() => null);
}

function renderScheduleCompensationInputs(schedule) {
    const container = document.getElementById('scheduleCompensationAssignments');
    if (!container) return;

    const lessonsCount = getScheduleLessonCount(schedule);
    const assignments = normalizeScheduleTrainerAssignments(schedule);
    container.innerHTML = assignments.map(assignment => {
        const roleLabel = assignment.role === 'assistant' ? 'Yardımcı Antrenör' : 'Baş Antrenör';
        const paymentSummary = summarizeAssignmentPaymentDetails(assignment, lessonsCount);
        return `
            <div style="margin-bottom: 18px; padding: 16px; border-radius: 12px; border: 1px solid #dbe9f6; background: #fbfdff;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;">
                    <div>
                        <strong style="color: #2c3e50;">${assignment.trainerName}</strong>
                        <div style="color: #6b7b8b; font-size: 0.9em; margin-top: 4px;">${roleLabel}</div>
                    </div>
                    <div style="color: #2c5d8a; font-weight: 600;">${paymentSummary.paidLessons}/${paymentSummary.totalLessons} ders ödendi</div>
                </div>
                <div class="form-group">
                    <label>Ders Başına Maaş (₺)</label>
                    <input type="number" min="0" step="0.01" class="schedule-comp-rate" data-trainer-id="${assignment.trainerId}" data-trainer-doc-id="${assignment.trainerDocId}" value="${assignment.trainerRate ?? ''}" required>
                </div>
                <div style="display: grid; gap: 10px;">
                    ${paymentSummary.details.map(item => `
                        <div style="display: grid; grid-template-columns: minmax(0, 1fr) 180px; gap: 12px; align-items: center; padding: 10px 12px; border-radius: 8px; background: #f8fbff; border: 1px solid #dbe9f6;">
                            <div style="font-weight: 600; color: #2c3e50;">${item.lessonNumber}. ders</div>
                            <select class="lesson-payment-status" data-trainer-id="${assignment.trainerId}" data-lesson-number="${item.lessonNumber}" style="width: 100%;">
                                <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>Bekliyor</option>
                                <option value="paid" ${item.status === 'paid' ? 'selected' : ''}>Ödendi</option>
                            </select>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// Check authentication
window.addEventListener('load', async () => {
    const userId = sessionStorage.getItem('user_id');
    const role = sessionStorage.getItem('user_role');
    
    if (!userId || role !== 'admin') {
        window.location.href = '../index.html';
        return;
    }
    
    currentAdmin = {
        id: userId,
        name: sessionStorage.getItem('user_name'),
        email: sessionStorage.getItem('user_email')
    };
    
    document.getElementById('userName').textContent = currentAdmin.name;
    document.getElementById('userAvatar').textContent = currentAdmin.name.charAt(0).toUpperCase();
    
    // Load initial data
    await loadAllData();
    setupAdminRealtimeSync();
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

    // User avatar click for club profile edit
    document.getElementById('userAvatar').addEventListener('click', openClubProfileModal);

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
            clearAdminRealtimeSync();
            await auth.signOut();
            sessionStorage.clear();
            window.location.href = '../index.html';
        } catch (error) {
            alert('Çıkış yapılırken hata: ' + error.message);
        }
    });

    // Forms
    document.getElementById('branchForm').addEventListener('submit', saveBranch);
    document.getElementById('trainerForm').addEventListener('submit', saveTrainer);
    document.getElementById('scheduleForm').addEventListener('submit', saveSchedule);
    document.getElementById('scheduleCompensationForm').addEventListener('submit', saveScheduleCompensation);
    document.getElementById('announcementForm').addEventListener('submit', sendAnnouncement);
    document.getElementById('expenseForm').addEventListener('submit', saveExpense);

    const adminAddStandardForm = document.getElementById('adminAddStandardForm');
    if (adminAddStandardForm) {
        adminAddStandardForm.addEventListener('submit', saveAdminStandard);
    }

    const adminEditStandardForm = document.getElementById('adminEditStandardForm');
    if (adminEditStandardForm) {
        adminEditStandardForm.addEventListener('submit', updateAdminStandard);
    }

    // Announcement target change
    document.getElementById('announcementTarget').addEventListener('change', (e) => {
        document.getElementById('scheduleSelectDiv').style.display =
            e.target.value === 'schedule' ? 'block' : 'none';
    });
}

window.addEventListener('beforeunload', () => {
    clearAdminRealtimeSync();
});

// Load all data from Firestore
async function loadAllData() {
    try {
        const [branchesSnap, trainersSnap, schedulesSnap, studentsSnap, expensesSnap, trainerReviewsSnap, clubDoc] = await Promise.all([
            db.collection('branches').where('adminId', '==', currentAdmin.id).get(),
            db.collection('trainers').where('adminId', '==', currentAdmin.id).get(),
            db.collection('schedules').where('adminId', '==', currentAdmin.id).get(),
            db.collection('students').where('adminId', '==', currentAdmin.id).get(),
            db.collection('expenses').where('adminId', '==', currentAdmin.id).get(),
            db.collection('trainer_reviews').where('adminId', '==', currentAdmin.id).get(),
            db.collection('clubProfiles').doc(currentAdmin.id).get()
        ]);

        allBranches = branchesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        allTrainers = trainersSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        allSchedules = schedulesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        allStudents = studentsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        allExpenses = expensesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        allTrainerReviews = trainerReviewsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));

        currentClubProfileData = clubDoc && clubDoc.exists ? (clubDoc.data() || {}) : {};

        const clubLink = document.getElementById('clubNavLink');
        if (clubLink) {
            clubLink.style.display = 'block';
        }

        // Update dropdowns
        updateBranchSelects();
        updateTrainerSelects();
        updateScheduleSelects();

        // Show dashboard
        showDashboard();
    } catch (error) {
        console.error('Veri yüklenirken hata:', error);
        alert('Veri yüklenirken hata: ' + error.message);
    }
}

// Switch page
function switchPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
    });

    // Update nav links and show selected page
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.dataset.page === pageName) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Show selected page
    const pageElement = document.getElementById(pageName + '-page');
    if (pageElement) {
        pageElement.classList.add('active');
        requestAnimationFrame(() => scrollMainContentToTop(pageElement));
    }
    
    // Update title
    const titles = {
        'dashboard': 'Dashboard',
        'club': 'Kulüp Profili',
        'secretaries': 'Sekreterler',
        'education_models': 'Eğitim Modelleri',
        'branches': 'Şubeler',
        'trainers': 'Antrenörler',
        'schedules': 'Ders Saatleri',
        'prices': 'Fiyatlandırma',
        'events': 'Etkinlikler',
        'announcements': 'Duyurular',
        'market': '🛒 Market',
        'standards': '🎯 Barajlar',
        'discounts': 'İndirim Kodları',
        'finance': 'Gelir/Gider'
    };
    
    document.getElementById('pageTitle').textContent = titles[pageName] || 'Dashboard';
    
    // Load page-specific data
    if (pageName === 'dashboard') {
        showDashboard();
    } else if (pageName === 'club') {
        loadClubProfile();
    } else if (pageName === 'secretaries') {
        loadSecretaries();
    } else if (pageName === 'education_models') {
        loadEducationModels();
    } else if (pageName === 'branches') {
        loadBranches();
    } else if (pageName === 'trainers') {
        loadTrainers();
    } else if (pageName === 'schedules') {
        loadSchedules();
    } else if (pageName === 'prices') {
        loadPrices();
    } else if (pageName === 'events') {
        loadEvents();
    } else if (pageName === 'announcements') {
        loadAnnouncements();
    } else if (pageName === 'market') {
        loadAdminMarketProducts();
    } else if (pageName === 'standards') {
        loadAdminStandards();
    } else if (pageName === 'discounts') {
        loadDiscounts();
    } else if (pageName === 'finance') {
        loadFinance();
    } else if (pageName === 'chat') {
        loadAdminChatList();
    }
}

// ======================== DASHBOARD ========================

function showDashboard() {
    const totalIncome = allStudents.reduce((sum, student) => {
        return sum + (student.totalPaid || 0);
    }, 0);
    
    document.getElementById('totalBranches').textContent = allBranches.length;
    document.getElementById('totalTrainers').textContent = allTrainers.length;
    document.getElementById('totalStudents').textContent = allStudents.length;
    document.getElementById('totalIncome').textContent = totalIncome.toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    // Recent activities
    const activities = [];
    allStudents.slice(0, 5).forEach(student => {
        activities.push(`<div class="activity-item">📝 ${student.name} kaydı alındı</div>`);
    });
    
    document.getElementById('recentActivities').innerHTML = 
        activities.join('') || '<p style="color: #95a5a6;">Henüz aktivite yok</p>';

    renderInstallmentAlerts();
}

// ======================== EDUCATION MODELS ========================

async function persistCustomEducationModels(customModels) {
    if (!currentAdmin?.id) {
        throw new Error('Yönetici oturumu bulunamadı.');
    }
    const payload = {
        educationModels: customModels.map(item => ({
            id: item.id,
            name: item.name,
            defaultPerTrainerCapacity: item.defaultPerTrainerCapacity,
            builtIn: false,
            removable: true,
            updatedAt: new Date().toISOString()
        })),
        adminId: currentAdmin.id,
        updatedAt: new Date().toISOString()
    };
    await db.collection('clubProfiles').doc(currentAdmin.id).set(payload, { merge: true });
    currentClubProfileData = { ...(currentClubProfileData || {}), educationModels: payload.educationModels };
}

function getCustomEducationModels() {
    return getActiveEducationModels().filter(item => !item.builtIn);
}

function renderEducationModelsTable() {
    const tbody = document.getElementById('educationModelsTable');
    if (!tbody) return;

    const models = getActiveEducationModels();
    tbody.innerHTML = models.map(model => {
        const typeBadge = model.builtIn
            ? '<span class="badge" style="background:#e7eef5; color:#34495e;">Sistem</span>'
            : '<span class="badge" style="background:#dbeefc; color:#0b7ea8;">Özel</span>';
        const actions = model.builtIn
            ? '<span style="color:#95a5a6;">Sistem modeli silinemez</span>'
            : `<button class="btn btn-danger btn-sm" onclick="deleteEducationModel('${escapeHtml(model.id)}')">Sil</button>`;
        return `
            <tr>
                <td><strong>${escapeHtml(model.name)}</strong></td>
                <td>${Number(model.defaultPerTrainerCapacity) || 0} öğr./antrenör</td>
                <td>${typeBadge}</td>
                <td>${actions}</td>
            </tr>
        `;
    }).join('');
}

async function loadEducationModels() {
    renderEducationModelsTable();
    const form = document.getElementById('educationModelForm');
    if (form && !form.dataset.bound) {
        form.dataset.bound = 'true';
        form.addEventListener('submit', saveEducationModel);
    }
}

async function saveEducationModel(event) {
    event.preventDefault();
    const nameInput = document.getElementById('educationModelName');
    const quotaInput = document.getElementById('educationModelDefaultQuota');
    if (!nameInput || !quotaInput) return;

    const name = String(nameInput.value || '').trim();
    if (!name) {
        alert('Lütfen model adı girin.');
        return;
    }
    if (name.length > 60) {
        alert('Model adı en fazla 60 karakter olabilir.');
        return;
    }

    const helpers = window.ClubProfileHelpers;
    const slug = helpers && typeof helpers.slugifyEducationModelName === 'function'
        ? helpers.slugifyEducationModelName(name)
        : name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

    if (!slug) {
        alert('Model adından geçerli bir kısa kod üretilemedi. Lütfen daha açıklayıcı bir ad girin.');
        return;
    }

    const existing = getActiveEducationModels();
    const existingByName = existing.find(item => item.name.toLowerCase('tr') === name.toLowerCase('tr')
        || item.id.replace(/^em_/, '').startsWith(slug));
    if (existingByName) {
        alert('Bu isimde / benzer kodda bir model zaten var. Lütfen farklı bir ad seçin.');
        return;
    }

    const quotaRaw = Number(quotaInput.value);
    const defaultPerTrainerCapacity = Number.isFinite(quotaRaw) && quotaRaw > 0
        ? Math.max(1, Math.min(50, Math.floor(quotaRaw)))
        : 8;

    const id = `em_${slug}_${Math.random().toString(36).slice(2, 6)}`;
    const newModel = { id, name, defaultPerTrainerCapacity, builtIn: false, removable: true };

    const currentCustom = getCustomEducationModels();
    const nextCustom = [...currentCustom, newModel];

    try {
        await persistCustomEducationModels(nextCustom);
        nameInput.value = '';
        quotaInput.value = 8;
        renderEducationModelsTable();
        alert('Yeni eğitim modeli eklendi.');
    } catch (error) {
        console.error('Eğitim modeli kaydedilemedi:', error);
        alert('Eğitim modeli kaydedilemedi: ' + (error.message || 'Bilinmeyen hata'));
    }
}

async function deleteEducationModel(modelId) {
    const target = String(modelId || '').trim();
    if (!target) return;

    const model = getActiveEducationModels().find(item => item.id === target);
    if (!model) return;
    if (model.builtIn) {
        alert('Sistem modelleri silinemez.');
        return;
    }

    const usedByBranch = allBranches.some(branch => {
        const types = (branch && branch.lessonTypes && typeof branch.lessonTypes === 'object') ? branch.lessonTypes : {};
        return Boolean(types[target]);
    });
    const usedBySchedule = allSchedules.some(schedule => String(schedule.lessonType || '') === target);

    if (usedByBranch || usedBySchedule) {
        const parts = [];
        if (usedByBranch) parts.push('bir veya daha fazla şubede etkin');
        if (usedBySchedule) parts.push('bir veya daha fazla ders saatinde kullanılıyor');
        if (!confirm(`Bu eğitim modeli ${parts.join(', ')}. Yine de silmek istiyor musunuz? (Mevcut kayıtlar bozulmaz, sadece bu model artık seçilemez olur.)`)) {
            return;
        }
    } else if (!confirm(`"${model.name}" modelini silmek istediğinize emin misiniz?`)) {
        return;
    }

    const remainingCustom = getCustomEducationModels().filter(item => item.id !== target);
    try {
        await persistCustomEducationModels(remainingCustom);
        renderEducationModelsTable();
        alert('Eğitim modeli silindi.');
    } catch (error) {
        console.error('Eğitim modeli silinemedi:', error);
        alert('Silme işlemi başarısız: ' + (error.message || 'Bilinmeyen hata'));
    }
}

// ======================== BRANCHES ========================

const BRANCH_DEFAULT_GROUP_QUOTA = 8;
const BRANCH_DEFAULT_PRIVATE_QUOTA = 1;

function getActiveEducationModels() {
    const helpers = window.ClubProfileHelpers;
    if (helpers && typeof helpers.getEducationModels === 'function') {
        return helpers.getEducationModels(currentClubProfileData || {});
    }
    return [
        { id: 'group', name: 'Grup Dersi', defaultPerTrainerCapacity: 8, builtIn: true, removable: false },
        { id: 'private', name: 'Özel Ders', defaultPerTrainerCapacity: 1, builtIn: true, removable: false }
    ];
}

function getEducationModelLabelById(modelId) {
    const helpers = window.ClubProfileHelpers;
    if (helpers && typeof helpers.getEducationModelLabel === 'function') {
        return helpers.getEducationModelLabel(currentClubProfileData || {}, modelId);
    }
    if (modelId === 'private') return 'Özel Ders';
    if (modelId === 'group') return 'Grup Dersi';
    return String(modelId || 'Ders');
}

function getEducationModelDefaultCapacity(modelId) {
    const model = getActiveEducationModels().find(item => item.id === modelId);
    if (model && Number.isFinite(Number(model.defaultPerTrainerCapacity)) && Number(model.defaultPerTrainerCapacity) > 0) {
        return Math.floor(Number(model.defaultPerTrainerCapacity));
    }
    if (modelId === 'private') return BRANCH_DEFAULT_PRIVATE_QUOTA;
    return BRANCH_DEFAULT_GROUP_QUOTA;
}

function getBranchLessonTypes(branch) {
    const models = getActiveEducationModels();
    const result = {};
    if (branch && branch.lessonTypes && typeof branch.lessonTypes === 'object') {
        models.forEach(model => {
            result[model.id] = Boolean(branch.lessonTypes[model.id]);
        });
        // Built-in defaults if everything off and legacy data: default group on for legacy compatibility
        const anySelected = Object.values(result).some(Boolean);
        if (!anySelected) {
            result.group = branch.lessonTypes.group !== false;
            if (typeof branch.lessonTypes.private !== 'undefined') {
                result.private = Boolean(branch.lessonTypes.private);
            }
        }
    } else {
        // No data: default to group only
        models.forEach(model => {
            result[model.id] = model.id === 'group';
        });
    }
    return result;
}

function getBranchPerTrainerQuota(branch, lessonType) {
    const lessonKey = String(lessonType || 'group');
    const fallback = getEducationModelDefaultCapacity(lessonKey);
    if (!branch || !branch.perTrainerCapacity || typeof branch.perTrainerCapacity !== 'object') {
        return fallback;
    }
    const raw = Number(branch.perTrainerCapacity[lessonKey]);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

function syncBranchLessonTypeUi() {
    document.querySelectorAll('.branch-lesson-type-option').forEach(label => {
        const input = label.querySelector('input[type="checkbox"]');
        label.style.borderColor = input && input.checked ? '#0b7ea8' : '#d8e3ee';
        label.style.background = input && input.checked ? 'rgba(11,126,168,0.08)' : '#f8fbff';

        const modelId = label.dataset.modelId;
        const quotaWrap = document.getElementById(`branchQuotaWrap-${modelId}`);
        const quotaInput = document.getElementById(`branchQuotaInput-${modelId}`);
        if (quotaWrap) quotaWrap.style.display = input && input.checked ? '' : 'none';
        if (quotaInput) quotaInput.required = Boolean(input && input.checked);
    });
}

function renderBranchLessonTypeOptions(branch = null) {
    const typesContainer = document.getElementById('branchLessonTypesContainer');
    const quotasContainer = document.getElementById('branchQuotasContainer');
    if (!typesContainer || !quotasContainer) return;

    const models = getActiveEducationModels();
    const currentTypes = branch ? getBranchLessonTypes(branch) : null;

    typesContainer.innerHTML = '';
    quotasContainer.innerHTML = '';

    models.forEach(model => {
        const isChecked = currentTypes
            ? Boolean(currentTypes[model.id])
            : (model.id === 'group');

        const optionLabel = document.createElement('label');
        optionLabel.className = 'branch-lesson-type-option';
        optionLabel.dataset.modelId = model.id;
        optionLabel.style.cssText = 'flex:1 1 180px; display:flex; align-items:center; gap:10px; padding:12px 14px; border:1px solid #d8e3ee; border-radius:10px; background:#f8fbff; cursor:pointer;';
        optionLabel.innerHTML = `
            <input type="checkbox" data-model-id="${escapeHtml(model.id)}" ${isChecked ? 'checked' : ''}>
            <span><strong>${escapeHtml(model.name)}</strong>${model.builtIn ? '' : ' <small style="color:#7f8c8d;">(özel)</small>'}</span>
        `;
        typesContainer.appendChild(optionLabel);

        const quotaValue = branch ? getBranchPerTrainerQuota(branch, model.id) : (Number(model.defaultPerTrainerCapacity) || 8);
        const quotaWrap = document.createElement('div');
        quotaWrap.className = 'form-group';
        quotaWrap.id = `branchQuotaWrap-${model.id}`;
        quotaWrap.style.display = isChecked ? '' : 'none';
        quotaWrap.innerHTML = `
            <label>${escapeHtml(model.name)} — Antrenör Başına Kontenjan:</label>
            <input type="number" id="branchQuotaInput-${escapeHtml(model.id)}" min="1" max="50" value="${quotaValue}" ${isChecked ? 'required' : ''}>
            <p class="form-hint" style="margin-top:6px;">Bir antrenörün eş zamanlı eğitebileceği maksimum öğrenci sayısı. Ders saati eklenirken kapasite otomatik (antrenör sayısı × bu sayı) hesaplanır.</p>
        `;
        quotasContainer.appendChild(quotaWrap);

        const checkbox = optionLabel.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.addEventListener('change', syncBranchLessonTypeUi);
        }
    });

    syncBranchLessonTypeUi();
}

function openBranchModal(branchId = null) {
    document.getElementById('branchForm').reset();
    document.getElementById('branchModal').classList.add('active');

    const branch = branchId ? allBranches.find(b => b.id === branchId) : null;

    if (branch) {
        document.getElementById('branchName').value = branch.name;
        document.getElementById('branchAddress').value = branch.address;
        document.getElementById('branchPhone').value = branch.phone;
        document.getElementById('branchForm').dataset.branchId = branchId;
    } else {
        delete document.getElementById('branchForm').dataset.branchId;
    }

    renderBranchLessonTypeOptions(branch);
}

function closeBranchModal() {
    document.getElementById('branchModal').classList.remove('active');
}

async function saveBranch(e) {
    e.preventDefault();
    
    const branchId = document.getElementById('branchForm').dataset.branchId;
    const models = getActiveEducationModels();

    const lessonTypes = {};
    const perTrainerCapacity = {};
    let anySelected = false;

    models.forEach(model => {
        const checkbox = document.querySelector(`#branchLessonTypesContainer input[data-model-id="${CSS.escape(model.id)}"]`);
        const checked = Boolean(checkbox && checkbox.checked);
        lessonTypes[model.id] = checked;
        if (checked) anySelected = true;

        const quotaInput = document.getElementById(`branchQuotaInput-${model.id}`);
        const fallback = Number(model.defaultPerTrainerCapacity) || 8;
        const raw = Number(quotaInput?.value || fallback);
        const value = Number.isFinite(raw) && raw > 0 ? Math.max(1, Math.min(50, Math.floor(raw))) : fallback;
        perTrainerCapacity[model.id] = value;
    });

    if (!anySelected) {
        alert('Lütfen şubede en az bir ders türü seçin.');
        return;
    }

    const existingBranch = branchId ? allBranches.find(b => b.id === branchId) : null;
    const branchData = {
        name: document.getElementById('branchName').value,
        address: document.getElementById('branchAddress').value,
        phone: document.getElementById('branchPhone').value,
        lessonTypes,
        perTrainerCapacity,
        adminId: currentAdmin.id,
        updatedAt: new Date().toISOString()
    };

    if (!existingBranch) {
        branchData.createdAt = new Date().toISOString();
    }
    
    try {
        if (branchId) {
            await db.collection('branches').doc(branchId).update(branchData);
        } else {
            await db.collection('branches').add(branchData);
        }
        
        await loadAllData();
        closeBranchModal();
        loadBranches();
        alert('Şube başarıyla kaydedildi!');
    } catch (error) {
        alert('Hata: ' + error.message);
    }
}

async function loadBranches() {
    const tbody = document.getElementById('branchesTable');
    tbody.innerHTML = '';

    const models = getActiveEducationModels();

    allBranches.forEach(branch => {
        const types = getBranchLessonTypes(branch);
        const labels = models
            .filter(model => types[model.id])
            .map(model => `${escapeHtml(model.name)} (${getBranchPerTrainerQuota(branch, model.id)} öğr./antrenör)`);
        const lessonSummary = labels.length
            ? `<br><small style="color:#5d7285;">${labels.join(' • ')}</small>`
            : '<br><small style="color:#c0392b;">Ders türü tanımlanmamış</small>';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(branch.name)}${lessonSummary}</td>
            <td>${escapeHtml(branch.address || '')}</td>
            <td>${escapeHtml(branch.phone || '')}</td>
            <td>
                <button class="btn btn-info btn-sm" onclick="openBranchModal('${branch.id}')">Düzenle</button>
                <button class="btn btn-danger btn-sm" onclick="deleteBranch('${branch.id}')">Sil</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function deleteBranch(branchId) {
    if (!confirm('Bu şubeyi silmek istediğinize emin misiniz?')) return;
    
    try {
        await cleanupBranchFirestoreRecords(branchId);
        await loadAllData();
        loadBranches();
        alert('Şube ve ilişkili Firestore kayıtları silindi!');
    } catch (error) {
        alert('Hata: ' + error.message);
    }
}

// ======================== TRAINERS ========================

function openTrainerModal(trainerId = null) {
    document.getElementById('trainerForm').reset();
    document.getElementById('trainerModal').classList.add('active');
    
    if (trainerId) {
        const trainer = allTrainers.find(t => t.id === trainerId);
        if (trainer) {
            document.getElementById('trainerName').value = trainer.name;
            document.getElementById('trainerEmail').value = trainer.email;
            if (trainer.branches) {
                document.getElementById('trainerBranches').value = trainer.branches;
            }
            document.getElementById('trainerForm').dataset.trainerId = trainerId;
        }
    } else {
        delete document.getElementById('trainerForm').dataset.trainerId;
    }
}

function closeTrainerModal() {
    document.getElementById('trainerModal').classList.remove('active');
}

async function saveTrainer(e) {
    e.preventDefault();
    
    const trainerId = document.getElementById('trainerForm').dataset.trainerId;
    const trainerEmail = document.getElementById('trainerEmail').value;
    const trainerPassword = document.getElementById('trainerPassword').value;
    const selectedBranches = Array.from(document.getElementById('trainerBranches').selectedOptions)
        .map(opt => opt.value)
        .filter(val => val);
    
    const trainerData = {
        name: document.getElementById('trainerName').value,
        email: trainerEmail,
        branches: selectedBranches,
        role: 'trainer',
        adminId: currentAdmin.id,
        createdAt: new Date().toISOString()
    };
    
    try {
        if (trainerId) {
            // Update existing trainer
            await db.collection('trainers').doc(trainerId).update(trainerData);
        } else {
            // Create new trainer with auth
            const userCred = await auth.createUserWithEmailAndPassword(trainerEmail, trainerPassword);
            trainerData.uid = userCred.user.uid;
            
            // Create user in firestore
            await db.collection('users').doc(userCred.user.uid).set(trainerData);
            await db.collection('trainers').add(trainerData);
        }
        
        await loadAllData();
        closeTrainerModal();
        loadTrainers();
        alert('Antrenör başarıyla kaydedildi!');
    } catch (error) {
        alert('Hata: ' + error.message);
    }
}

async function loadTrainers() {
    const tbody = document.getElementById('trainersTable');
    tbody.innerHTML = '';
    
    allTrainers.forEach(trainer => {
        const reviewStats = getAdminTrainerReviewStats(trainer);
        const branchNames = trainer.branches 
            ? trainer.branches.map(bId => {
                const branch = allBranches.find(b => b.id === bId);
                return branch ? branch.name : 'Bilinmiyor';
            }).join(', ')
            : '-';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${trainer.name}</td>
            <td>${trainer.email}</td>
            <td>${branchNames}</td>
            <td>${reviewStats.average ? `<strong>${reviewStats.average.toFixed(1)} / 5</strong><br><small style="color:#6b7280;">${renderTrainerReviewStars(reviewStats.average)}</small>` : '<span style="color:#95a5a6;">Henüz puan yok</span>'}</td>
            <td>${reviewStats.count ? `<strong>${reviewStats.count} değerlendirme</strong><br><small style="color:#6b7280;">Genel: ${reviewStats.generalCount} • Ders: ${reviewStats.lessonCount}</small>` : '<span style="color:#95a5a6;">Yorum yok</span>'}</td>
            <td>
                <button class="btn btn-info btn-sm" onclick="openTrainerModal('${trainer.id}')">Düzenle</button>
                <button class="btn btn-danger btn-sm" onclick="deleteTrainer('${trainer.id}')">Sil</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function deleteTrainer(trainerId) {
    if (!confirm('Bu antrenörü silmek istediğinize emin misiniz?')) return;
    
    try {
        // Get trainer doc to obtain uid if present
        const trainerDoc = await db.collection('trainers').doc(trainerId).get();
        if (trainerDoc.exists) {
            const trainerData = trainerDoc.data();
            const uid = trainerData.uid || null;

            // Delete trainer document
            await db.collection('trainers').doc(trainerId).delete();

            // Delete users doc (firestore) if uid available
            if (uid) {
                try { await db.collection('users').doc(uid).delete(); } catch (e) { console.warn('users doc delete failed', e); }
            }

            // Delete schedules referencing this trainer (by doc id or by uid)
            const schedulesByDoc = await db.collection('schedules').where('trainerId', '==', trainerId).get();
            for (const sdoc of schedulesByDoc.docs) {
                await db.collection('schedules').doc(sdoc.id).delete();
            }

            await deleteDocumentsByField('trainer_reviews', 'trainerDocId', trainerId);

            if (uid) {
                const schedulesByUid = await db.collection('schedules').where('trainerId', '==', uid).get();
                for (const sdoc of schedulesByUid.docs) {
                    await db.collection('schedules').doc(sdoc.id).delete();
                }

                await deleteDocumentsByField('trainer_reviews', 'trainerId', uid);

                // Delete workouts created by this trainer (workouts store trainerId as uid)
                const workoutsSnap = await db.collection('workouts').where('trainerId', '==', uid).get();
                for (const w of workoutsSnap.docs) {
                    await db.collection('workouts').doc(w.id).delete();
                }

                // Delete student_workouts records for this trainer
                const swSnap = await db.collection('student_workouts').where('trainerId', '==', uid).get();
                for (const sw of swSnap.docs) {
                    await db.collection('student_workouts').doc(sw.id).delete();
                }
            }
        } else {
            // If trainer doc not found, attempt best-effort deletion
            await db.collection('trainers').doc(trainerId).delete();
        }

        await loadAllData();
        loadTrainers();
        alert('Antrenör ve ilişkili veriler silindi (Firestore). Auth kullanıcı silinmediyse, lütfen Firebase Console üzerinden silin.');
    } catch (error) {
        alert('Hata: ' + error.message);
    }
}

// ======================== SCHEDULES ========================

function getScheduleLessonTypeLabelByKey(lessonTypeKey) {
    return getEducationModelLabelById(lessonTypeKey);
}

function buildAutoScheduleName(branch, lessonTypeKey, time) {
    const branchName = branch?.name ? String(branch.name).trim() : '';
    const lessonLabel = getScheduleLessonTypeLabelByKey(lessonTypeKey);
    const timeLabel = time ? String(time).trim() : '';
    if (!branchName) return '';
    return timeLabel ? `${branchName} • ${lessonLabel} • ${timeLabel}` : `${branchName} • ${lessonLabel}`;
}

function refreshScheduleLessonTypeOptions() {
    const branchSelect = document.getElementById('scheduleBranch');
    const lessonTypeSelect = document.getElementById('scheduleLessonType');
    const hint = document.getElementById('scheduleLessonTypeHint');
    if (!branchSelect || !lessonTypeSelect) return;

    const branchId = branchSelect.value;
    const branch = branchId ? allBranches.find(item => item.id === branchId) : null;
    const types = getBranchLessonTypes(branch);
    const models = getActiveEducationModels();

    const previousValue = lessonTypeSelect.value || 'group';
    lessonTypeSelect.innerHTML = '';
    const allowedTypes = models
        .filter(model => types[model.id])
        .map(model => ({ value: model.id, label: model.name }));

    if (allowedTypes.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '— Şubede ders türü tanımlı değil —';
        lessonTypeSelect.appendChild(option);
        if (hint) hint.textContent = 'Bu şubede henüz ders türü tanımlanmadı. Şubeyi düzenleyerek bir eğitim modelini etkinleştirin.';
    } else {
        allowedTypes.forEach(item => {
            const option = document.createElement('option');
            option.value = item.value;
            option.textContent = item.label;
            lessonTypeSelect.appendChild(option);
        });
        lessonTypeSelect.value = allowedTypes.some(item => item.value === previousValue) ? previousValue : allowedTypes[0].value;
        if (hint) {
            const list = allowedTypes.map(item => item.label).join(', ');
            hint.textContent = `Bu şubede yapılan ders türleri: ${list}.`;
        }
    }
}

function getAssignedScheduleTrainerCount() {
    const rows = collectScheduleTrainerAssignments();
    if (Array.isArray(rows) && rows.length > 0) return rows.length;
    return 1;
}

function recomputeScheduleAutoCapacity({ force = false } = {}) {
    const branchSelect = document.getElementById('scheduleBranch');
    const lessonTypeSelect = document.getElementById('scheduleLessonType');
    const capacityInput = document.getElementById('scheduleCapacity');
    if (!branchSelect || !lessonTypeSelect || !capacityInput) return;

    const branchId = branchSelect.value;
    const branch = branchId ? allBranches.find(item => item.id === branchId) : null;
    if (!branch) return;

    const lessonType = lessonTypeSelect.value === 'private' ? 'private' : 'group';
    const perTrainer = getBranchPerTrainerQuota(branch, lessonType);
    const trainerCount = getAssignedScheduleTrainerCount();
    const suggested = Math.max(1, perTrainer * trainerCount);

    const userTouched = capacityInput.dataset.userTouched === 'true';
    if (force || !userTouched) {
        capacityInput.value = suggested;
        capacityInput.dataset.autoValue = String(suggested);
    }

    const hint = document.getElementById('scheduleCapacityHint');
    if (hint) {
        hint.textContent = `Otomatik öneri: ${trainerCount} antrenör × ${perTrainer} öğrenci = ${suggested} kişi. Şubede tanımlı "antrenör başına ${perTrainer}" değeri kullanıldı. İsterseniz değiştirebilirsiniz.`;
    }
}

function refreshScheduleAutoNamePreview() {
    const branchSelect = document.getElementById('scheduleBranch');
    const timeInput = document.getElementById('scheduleTime');
    const lessonTypeSelect = document.getElementById('scheduleLessonType');
    const customNameInput = document.getElementById('scheduleCustomName');
    const preview = document.getElementById('scheduleAutoNamePreview');
    if (!branchSelect || !lessonTypeSelect || !customNameInput || !preview) return;

    const branchId = branchSelect.value;
    const branch = branchId ? allBranches.find(item => item.id === branchId) : null;
    const lessonType = lessonTypeSelect.value === 'private' ? 'private' : 'group';
    const time = timeInput?.value || '';
    const autoName = buildAutoScheduleName(branch, lessonType, time);

    if (autoName) {
        customNameInput.value = autoName;
        preview.textContent = autoName;
        preview.style.color = '#0b7ea8';
    } else {
        customNameInput.value = '';
        preview.textContent = 'Şube ve saat seçildiğinde otomatik oluşturulacak.';
        preview.style.color = '#7f8c8d';
    }
}

function openScheduleModal(scheduleId = null) {
    document.getElementById('scheduleForm').reset();
    document.getElementById('scheduleModal').classList.add('active');

    const capacityInput = document.getElementById('scheduleCapacity');
    if (capacityInput) {
        delete capacityInput.dataset.userTouched;
        delete capacityInput.dataset.autoValue;
    }

    if (scheduleId) {
        const schedule = allSchedules.find(s => s.id === scheduleId);
        if (schedule) {
            document.getElementById('scheduleCustomName').value = schedule.customName || '';
            document.getElementById('scheduleBranch').value = schedule.branchId;
            document.getElementById('scheduleTime').value = schedule.time;
            refreshScheduleLessonTypeOptions();
            document.getElementById('scheduleLessonType').value = getScheduleLessonType(schedule);
            document.getElementById('scheduleStartDate').value = schedule.startDate || new Date().toISOString().split('T')[0];
            document.getElementById('scheduleCapacity').value = schedule.capacity;
            document.getElementById('scheduleLessonsCount').value = schedule.lessonsCount || 1;
            renderScheduleDaysPicker(getNormalizedScheduleDays(schedule));
            renderScheduleTrainerAssignmentRows(normalizeScheduleTrainerAssignments(schedule));
            document.getElementById('scheduleForm').dataset.scheduleId = scheduleId;
            updateScheduleCalendarPreview();
            if (capacityInput) capacityInput.dataset.userTouched = 'true';
        }
    } else {
        delete document.getElementById('scheduleForm').dataset.scheduleId;
        refreshScheduleLessonTypeOptions();
        document.getElementById('scheduleStartDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('scheduleLessonsCount').value = 1;
        renderScheduleDaysPicker(['monday']);
        renderScheduleTrainerAssignmentRows();
        updateScheduleCalendarPreview();
    }

    refreshScheduleAutoNamePreview();
    recomputeScheduleAutoCapacity({ force: !scheduleId });

    const branchEl = document.getElementById('scheduleBranch');
    if (branchEl) {
        branchEl.onchange = () => {
            refreshScheduleLessonTypeOptions();
            refreshScheduleAutoNamePreview();
            recomputeScheduleAutoCapacity({ force: true });
            updateScheduleCalendarPreview();
        };
    }
    const lessonTypeEl = document.getElementById('scheduleLessonType');
    if (lessonTypeEl) {
        lessonTypeEl.onchange = () => {
            refreshScheduleAutoNamePreview();
            recomputeScheduleAutoCapacity({ force: true });
            updateScheduleCalendarPreview();
        };
    }
    const timeEl = document.getElementById('scheduleTime');
    if (timeEl) {
        timeEl.oninput = () => {
            refreshScheduleAutoNamePreview();
            updateScheduleCalendarPreview();
        };
    }
    if (capacityInput) {
        capacityInput.oninput = () => {
            const autoValue = capacityInput.dataset.autoValue;
            if (autoValue && String(capacityInput.value) !== String(autoValue)) {
                capacityInput.dataset.userTouched = 'true';
            }
        };
    }

    const watchedIds = ['scheduleStartDate', 'scheduleLessonsCount'];
    watchedIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.onchange = updateScheduleCalendarPreview;
            element.oninput = updateScheduleCalendarPreview;
        }
    });

    document.querySelectorAll('#scheduleDaysPicker input[name="scheduleDay"]').forEach(input => {
        input.onchange = updateScheduleCalendarPreview;
    });
}

function closeScheduleModal() {
    document.getElementById('scheduleModal').classList.remove('active');
}

async function saveSchedule(e) {
    e.preventDefault();
    
    const scheduleId = document.getElementById('scheduleForm').dataset.scheduleId;
    const existingSchedule = scheduleId ? allSchedules.find(item => item.id === scheduleId) : null;
    const trainerAssignments = collectScheduleTrainerAssignments();
    const selectedDays = getSelectedScheduleDays();

    if (!trainerAssignments.length) {
        alert('En az bir antrenör ataması yapın.');
        return;
    }

    if (!selectedDays.length) {
        alert('En az bir ders günü seçin.');
        return;
    }

    if (!trainerAssignments.some(item => item.role === 'head')) {
        trainerAssignments[0].role = 'head';
    }

    const missingHeadLink = trainerAssignments.find(item => item.role === 'assistant' && !item.headTrainerId);
    if (missingHeadLink) {
        alert('Yardımcı antrenör atamalarında bağlı olduğu baş antrenörü seçmelisiniz.');
        return;
    }

    const primaryAssignment = trainerAssignments.find(item => item.role === 'head') || trainerAssignments[0];
    const selectedBranchId = document.getElementById('scheduleBranch').value;
    const selectedBranch = allBranches.find(item => item.id === selectedBranchId);
    const lessonTypeRaw = String(document.getElementById('scheduleLessonType').value || 'group').trim();
    const knownModels = getActiveEducationModels();
    const selectedLessonType = knownModels.some(model => model.id === lessonTypeRaw)
        ? lessonTypeRaw
        : 'group';
    const selectedTime = document.getElementById('scheduleTime').value;

    if (selectedBranch) {
        const allowedTypes = getBranchLessonTypes(selectedBranch);
        if (!allowedTypes[selectedLessonType]) {
            const allowedLabels = knownModels
                .filter(model => allowedTypes[model.id])
                .map(model => model.name);
            alert(`Bu şubede sadece şu ders türleri yapılıyor: ${allowedLabels.join(', ') || 'tanımsız'}. Lütfen uygun ders türünü seçin veya şubeyi düzenleyin.`);
            return;
        }
    }

    const userProvidedName = String(document.getElementById('scheduleCustomName').value || '').trim();
    const autoName = buildAutoScheduleName(selectedBranch, selectedLessonType, selectedTime);
    const finalCustomName = userProvidedName || autoName || null;

    const scheduleData = {
        customName: finalCustomName,
        branchId: selectedBranchId,
        time: selectedTime,
        lessonType: selectedLessonType,
        startDate: document.getElementById('scheduleStartDate').value || new Date().toISOString().split('T')[0],
        days: selectedDays,
        trainerId: primaryAssignment.trainerId,
        trainerDocId: primaryAssignment.trainerDocId,
        trainerAssignments,
        trainerIds: trainerAssignments.map(item => item.trainerId),
        capacity: parseInt(document.getElementById('scheduleCapacity').value),
        lessonsCount: parseInt(document.getElementById('scheduleLessonsCount').value) || 1,
        adminId: currentAdmin.id,
        postponements: Array.isArray(existingSchedule?.postponements) ? existingSchedule.postponements : [],
        createdAt: existingSchedule?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    try {
        if (scheduleId) {
            await db.collection('schedules').doc(scheduleId).update(scheduleData);
        } else {
            await db.collection('schedules').add(scheduleData);
        }
        
        await loadAllData();
        closeScheduleModal();
        loadSchedules();
        if (getActiveAdminPage() === 'schedule_table') {
            loadScheduleTable();
        }
        alert('Ders saati başarıyla kaydedildi!');
    } catch (error) {
        alert('Hata: ' + error.message);
    }
}

async function loadSchedules() {
    const tbody = document.getElementById('schedulesTable');
    tbody.innerHTML = '';
    
    allSchedules.forEach(schedule => {
        const branch = allBranches.find(b => b.id === schedule.branchId);
        const hasRate = Number.isFinite(Number(schedule.trainerRate));
        const paymentSummary = summarizeTrainerPaymentDetails(schedule);
        const statusMeta = getTrainerPaymentStatusMeta(paymentSummary.aggregateStatus);
        const postponementCount = getSchedulePostponementCount(schedule);
        const scheduleDisplayName = schedule.customName ? schedule.customName : (branch ? branch.name : 'Bilinmiyor');
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${scheduleDisplayName}</td>
            <td>${schedule.time}<br><small style="color:#7f8c8d;">${formatScheduleDays(schedule)}</small><br><small style="color:#5d7285;">${getScheduleLessonTypeLabel(schedule)}${postponementCount ? ` • ${postponementCount} erteleme` : ''}</small></td>
            <td>${formatScheduleTrainerAssignments(schedule)}</td>
            <td>${schedule.capacity}</td>
            <td>${hasRate ? formatTryCurrency(schedule.trainerRate) : '-'}</td>
            <td>${hasRate ? `<span class="badge ${statusMeta.className}">${paymentSummary.paidLessons}/${paymentSummary.totalLessons} ödendi</span>` : '<span style="color: #95a5a6;">Tanımsız</span>'}</td>
            <td>
                <button class="btn btn-success btn-sm" onclick="openScheduleCompensationModal('${schedule.id}')">Maaş</button>
                <button class="btn btn-info btn-sm" onclick="openScheduleModal('${schedule.id}')">Düzenle</button>
                <button class="btn btn-danger btn-sm" onclick="deleteSchedule('${schedule.id}')">Sil</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    await loadAvailabilityPlanner();
}

function renderScheduleTimeGridSummary() {
    const container = document.getElementById('scheduleTimeGridSummary');
    if (!container) return;

    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayLabels = {
        monday: 'Pzt',
        tuesday: 'Sal',
        wednesday: 'Çar',
        thursday: 'Per',
        friday: 'Cum',
        saturday: 'Cmt',
        sunday: 'Paz'
    };
    const slots = {};

    allSchedules.forEach(schedule => {
        const branch = allBranches.find(item => item.id === schedule.branchId);
        const scheduleName = schedule.customName || branch?.name || 'Ders';
        const days = getNormalizedScheduleDays(schedule);
        const time = schedule.time || '-';
        days.forEach(dayKey => {
            if (!slots[dayKey]) slots[dayKey] = {};
            if (!slots[dayKey][time]) slots[dayKey][time] = [];
            slots[dayKey][time].push({
                name: scheduleName,
                branch: branch?.name || '-',
                trainers: formatScheduleTrainerAssignments(schedule)
            });
        });
    });

    const activeDays = dayOrder.filter(day => slots[day] && Object.keys(slots[day]).length);
    if (!activeDays.length) {
        container.innerHTML = '<p style="color:#95a5a6;">Henüz tanımlı ders saati yok.</p>';
        return;
    }

    container.innerHTML = `
        <h3 style="margin:0 0 10px;">Haftalık Ders Saatleri Özeti</h3>
        <div style="display:grid; gap:12px;">
            ${activeDays.map(dayKey => {
                const times = Object.keys(slots[dayKey]).sort();
                return `
                    <div style="border:1px solid #e5e7eb; border-radius:8px; padding:12px; background:#f8fbff;">
                        <strong>${dayLabels[dayKey] || dayKey}</strong>
                        <div style="margin-top:8px; display:grid; gap:8px;">
                            ${times.map(time => `
                                <div style="padding:8px 10px; border-radius:6px; background:#fff; border:1px solid #dbe9f6;">
                                    <div style="font-weight:600; color:#2c3e50;">${escapeHtml(time)}</div>
                                    ${slots[dayKey][time].map(item => `
                                        <div style="font-size:0.92em; color:#5d7285; margin-top:4px;">
                                            <strong>${escapeHtml(item.name)}</strong> • ${escapeHtml(item.branch)} • ${escapeHtml(item.trainers)}
                                        </div>
                                    `).join('')}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

async function loadScheduleTable() {
    const tbody = document.getElementById('scheduleTableBody');
    tbody.innerHTML = '';
    renderScheduleTimeGridSummary();

    allSchedules.forEach(schedule => {
        const branch = allBranches.find(b => b.id === schedule.branchId);
        const scheduleName = schedule.customName || branch?.name || 'Bilinmiyor';
        const daysLabel = formatScheduleDays(schedule);
        const trainerAssignments = normalizeScheduleTrainerAssignments(schedule);
        const trainerLabels = trainerAssignments
            .map(a => {
                const trainer = resolveTrainerByIdentifier(a.trainerId) || resolveTrainerByIdentifier(a.trainerDocId);
                return trainer?.name || 'Bilinmiyor';
            })
            .filter(Boolean);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${escapeHtml(scheduleName)}</strong></td>
            <td>${branch ? branch.name : 'Bilinmiyor'}</td>
            <td>${schedule.time || '-'}</td>
            <td>${daysLabel || '-'}</td>
            <td>${trainerLabels.join(', ') || '-'}</td>
            <td>${schedule.capacity || '-'}</td>
            <td>${schedule.lessonsCount || 1}</td>
            <td>
                <button class="btn btn-info btn-sm" onclick="openScheduleModal('${schedule.id}')">Düzenle</button>
                <button class="btn btn-danger btn-sm" onclick="deleteSchedule('${schedule.id}')">Sil</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function renderAvailabilitySlotPicker(containerId, selectedSlots = [], inputName = 'availabilitySlot') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const selected = new Set((selectedSlots || []).map(item => String(item).trim()));
    container.innerHTML = AVAILABILITY_SLOT_OPTIONS.map(slot => `
        <label style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 8px; background: #fff; border: 1px solid #dbe4ef; border-radius: 6px; cursor: pointer;">
            <input type="checkbox" name="${inputName}" value="${slot}" ${selected.has(slot) ? 'checked' : ''}>
            <span style="font-size: 0.9em;">${slot}</span>
        </label>
    `).join('');
}

function getAvailabilityDayLabel(dayKey) {
    return AVAILABILITY_DAY_OPTIONS.find(item => item.key === dayKey)?.label || 'Bilinmeyen Gün';
}

function getNormalizedDailySlots(rawData) {
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

    // Geriye uyumluluk: eski kayıtlarda sadece slots dizisi olabilir.
    if (rawData && Array.isArray(rawData.slots)) {
        dailySlots.monday = rawData.slots.map(item => String(item).trim()).filter(Boolean).sort();
    }

    return dailySlots;
}

function parseDateValue(value) {
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

function formatIsoDateValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getNextScheduleStartDateValue(dayKey) {
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    const targetDay = mapDayKeyToJsDay(dayKey);

    if (targetDay === null) {
        return formatIsoDateValue(currentDate);
    }

    const dayDiff = (targetDay - currentDate.getDay() + 7) % 7;
    currentDate.setDate(currentDate.getDate() + dayDiff);
    return formatIsoDateValue(currentDate);
}

function getAvailabilitySlotStart(slot) {
    const normalized = String(slot || '').trim();
    if (!normalized) return '';
    if (normalized.includes('-')) {
        return normalized.split('-')[0].trim();
    }
    return normalized;
}

function mapDayKeyToJsDay(dayKey) {
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

function calculateLessonDatesFromStart(startDate, scheduleDays, lessonCount) {
    const targetDays = (scheduleDays || [])
        .map(mapDayKeyToJsDay)
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

function formatDateTR(value) {
    const date = parseDateValue(value);
    if (!date) return '-';
    return date.toLocaleDateString('tr-TR');
}

function formatDetailedDateTR(value) {
    const date = parseDateValue(value);
    if (!date) return '-';
    return date.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

function openQuickScheduleFromAvailability(trainerId, trainerDocId, branchId, dayKey, slot) {
    openScheduleModal();

    const resolvedTrainerId = trainerId || trainerDocId || '';
    const scheduleBranch = document.getElementById('scheduleBranch');
    const scheduleTime = document.getElementById('scheduleTime');
    const scheduleStartDate = document.getElementById('scheduleStartDate');
    const schedulePreview = document.getElementById('scheduleCalendarPreview');

    if (scheduleBranch && branchId) {
        scheduleBranch.value = branchId;
    }
    if (scheduleTime) {
        scheduleTime.value = getAvailabilitySlotStart(slot);
    }
    if (scheduleStartDate) {
        scheduleStartDate.value = getNextScheduleStartDateValue(dayKey || 'monday');
    }

    renderScheduleDaysPicker([dayKey || 'monday']);
    renderScheduleTrainerAssignmentRows([
        {
            trainerId: resolvedTrainerId,
            trainerDocId: trainerDocId || '',
            role: 'head'
        }
    ]);

    document.querySelectorAll('#scheduleDaysPicker input[name="scheduleDay"]').forEach(input => {
        input.onchange = updateScheduleCalendarPreview;
    });

    updateScheduleCalendarPreview();

    if (schedulePreview) {
        schedulePreview.insertAdjacentHTML('afterbegin', '<strong>Hızlı ders açma:</strong> Müsaitlik kartından gelen şube, gün, saat ve antrenör bilgileri forma işlendi.<br>');
    }
}

function getAttendanceRecordTimestamp(record) {
    if (!record) return 0;

    const values = [record.updatedAt, record.createdAt, record.date];
    for (const value of values) {
        const parsedDate = parseDateValue(value);
        if (parsedDate) {
            return parsedDate.getTime();
        }
    }

    return 0;
}

function buildAttendanceLessonCountMap(records = []) {
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

async function copyAvailabilitySummary(text) {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const temp = document.createElement('textarea');
            temp.value = text;
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            document.body.removeChild(temp);
        }
        alert('Müsaitlik özeti panoya kopyalandı.');
    } catch (error) {
        alert('Kopyalama başarısız: ' + error.message);
    }
}

function buildAvailabilityShareText(trainerName, branchName, daySummary) {
    const lines = daySummary.length
        ? daySummary.map(item => `${item.dayLabel}: ${item.slots.join(', ')}`)
        : ['Henüz müsaitlik seçimi yapılmadı.'];
    return `${trainerName}\n${branchName}\n${lines.join('\n')}`;
}

function getSelectedAvailabilitySlots(containerId, inputName = 'availabilitySlot') {
    return Array.from(document.querySelectorAll(`#${containerId} input[name="${inputName}"]:checked`))
        .map(input => input.value)
        .sort();
}

function updateAvailabilityBranchSelect() {
    const select = document.getElementById('availabilityBranchSelect');
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

async function loadAvailabilityTemplateForBranch() {
    const branchId = document.getElementById('availabilityBranchSelect')?.value;
    const selectedDay = document.getElementById('availabilityDaySelect')?.value || 'monday';
    const status = document.getElementById('availabilityStatus');

    if (!branchId) {
        renderAvailabilitySlotPicker('availabilitySlotPicker', []);
        if (status) status.textContent = 'Önce bir şube seçin.';
        return;
    }

    try {
        const docId = `${currentAdmin.id}_${branchId}`;
        const templateDoc = await db.collection('trainer_time_programs').doc(docId).get();
        const dailySlots = getNormalizedDailySlots(templateDoc.exists ? templateDoc.data() : null);
        const slots = dailySlots[selectedDay] || [];
        renderAvailabilitySlotPicker('availabilitySlotPicker', slots);
        if (status) {
            status.style.color = '#7f8c8d';
            status.textContent = slots.length
                ? `${getAvailabilityDayLabel(selectedDay)} için kayıtlı saatler: ${slots.join(', ')}`
                : `${getAvailabilityDayLabel(selectedDay)} için henüz saat programı tanımlanmadı.`;
        }
    } catch (error) {
        if (status) {
            status.style.color = '#c0392b';
            status.textContent = 'Program yüklenemedi: ' + error.message;
        }
    }
}

async function saveAvailabilityTemplate() {
    const branchId = document.getElementById('availabilityBranchSelect')?.value;
    const selectedDay = document.getElementById('availabilityDaySelect')?.value || 'monday';
    const status = document.getElementById('availabilityStatus');

    if (!branchId) {
        alert('Lütfen bir şube seçin.');
        return;
    }

    const selectedSlots = getSelectedAvailabilitySlots('availabilitySlotPicker');
    if (!selectedSlots.length) {
        alert('En az bir saat seçin.');
        return;
    }

    try {
        const docId = `${currentAdmin.id}_${branchId}`;
        const templateDoc = await db.collection('trainer_time_programs').doc(docId).get();
        const existingDailySlots = getNormalizedDailySlots(templateDoc.exists ? templateDoc.data() : null);
        existingDailySlots[selectedDay] = selectedSlots;

        await db.collection('trainer_time_programs').doc(docId).set({
            adminId: currentAdmin.id,
            branchId,
            slots: selectedSlots,
            dailySlots: existingDailySlots,
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        }, { merge: true });

        if (status) {
            status.style.color = '#1e8449';
            status.textContent = `${getAvailabilityDayLabel(selectedDay)} için saat programı kaydedildi.`;
        }

        await loadTrainerAvailabilitySummary();
    } catch (error) {
        if (status) {
            status.style.color = '#c0392b';
            status.textContent = 'Program kaydedilemedi: ' + error.message;
        }
    }
}

async function loadTrainerAvailabilitySummary() {
    const tbody = document.getElementById('availabilitySummaryTable');
    const cardsContainer = document.getElementById('availabilitySummaryCards');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="padding: 12px; color: #7f8c8d;">Yükleniyor...</td></tr>';
    if (cardsContainer) {
        cardsContainer.innerHTML = '<div style="padding: 12px; color: #7f8c8d; border: 1px solid #edf2f7; border-radius: 10px; background: #fff;">Müsaitlik özetleri yükleniyor...</div>';
    }

    try {
        const prefsSnap = await db.collection('trainer_time_preferences')
            .where('adminId', '==', currentAdmin.id)
            .get();

        const rows = prefsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="4" style="padding: 12px; color: #95a5a6;">Henüz antrenör müsaitlik seçimi yok.</td></tr>';
            if (cardsContainer) {
                cardsContainer.innerHTML = '<div style="padding: 14px; color: #95a5a6; border: 1px solid #edf2f7; border-radius: 10px; background: #fff;">Henüz paylaşılacak müsaitlik özeti yok.</div>';
            }
            return;
        }

        if (cardsContainer) {
            cardsContainer.innerHTML = rows.map(row => {
                const trainer = allTrainers.find(item => item.uid === row.trainerId || item.id === row.trainerDocId || item.id === row.trainerId);
                const branch = allBranches.find(item => item.id === row.branchId);
                const trainerName = trainer ? trainer.name : 'Bilinmeyen antrenör';
                const branchName = branch ? branch.name : 'Bilinmeyen şube';
                const dailySlots = getNormalizedDailySlots(row);
                const daySummary = AVAILABILITY_DAY_OPTIONS
                    .map(day => ({
                        dayKey: day.key,
                        dayLabel: day.label,
                        slots: dailySlots[day.key] || []
                    }))
                    .filter(item => item.slots.length);
                const shareText = buildAvailabilityShareText(trainerName, branchName, daySummary);

                return `
                    <div style="padding: 14px; border: 1px solid #dbe9f6; border-radius: 12px; background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%); box-shadow: 0 6px 20px rgba(15, 23, 42, 0.05);">
                        <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap; margin-bottom:10px;">
                            <div>
                                <div style="font-weight:700; color:#1f3b57; font-size:1rem;">${trainerName}</div>
                                <div style="color:#5d7285; font-size:0.92rem; margin-top:2px;">${branchName}</div>
                            </div>
                            <button type="button" class="btn btn-info btn-sm" onclick="copyAvailabilitySummary(${JSON.stringify(shareText).replace(/"/g, '&quot;')})">WhatsApp İçin Kopyala</button>
                        </div>
                        <div style="display:grid; gap:8px;">
                            ${daySummary.length ? daySummary.map(item => `
                                <div style="display:grid; grid-template-columns: 120px 1fr; gap:10px; align-items:start; padding:10px; border-radius:10px; background:#fff; border:1px solid #edf2f7;">
                                    <div style="font-weight:600; color:#274c77;">${item.dayLabel}</div>
                                    <div style="color:#2c3e50; line-height:1.5;">
                                        <div>${item.slots.join(', ')}</div>
                                        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">
                                            ${item.slots.map(slot => `
                                                <button
                                                    type="button"
                                                    class="btn btn-success btn-sm"
                                                    onclick="openQuickScheduleFromAvailability('${escapeInlineString(row.trainerId || '')}', '${escapeInlineString(row.trainerDocId || '')}', '${escapeInlineString(row.branchId || '')}', '${item.dayKey}', '${escapeInlineString(slot)}')"
                                                >
                                                    ${slot} icin ders ac
                                                </button>
                                            `).join('')}
                                        </div>
                                    </div>
                                </div>
                            `).join('') : '<div style="padding:10px; border-radius:10px; background:#fff; border:1px solid #edf2f7; color:#95a5a6;">Henüz müsaitlik seçimi yapılmadı.</div>'}
                        </div>
                    </div>
                `;
            }).join('');
        }

        tbody.innerHTML = rows.map(row => {
            const trainer = allTrainers.find(item => item.uid === row.trainerId || item.id === row.trainerDocId || item.id === row.trainerId);
            const branch = allBranches.find(item => item.id === row.branchId);
            const dailySlots = getNormalizedDailySlots(row);
            const daySummary = AVAILABILITY_DAY_OPTIONS
                .filter(day => (dailySlots[day.key] || []).length)
                .map(day => `${day.label}: ${(dailySlots[day.key] || []).join(', ')}`)
                .join('<br>');
            const updatedAt = row.updatedAt ? new Date(row.updatedAt).toLocaleString('tr-TR') : '-';

            return `
                <tr style="border-bottom: 1px solid #eef2f7;">
                    <td style="padding: 10px;">${trainer ? trainer.name : 'Bilinmeyen antrenör'}</td>
                    <td style="padding: 10px;">${branch ? branch.name : 'Bilinmeyen şube'}</td>
                    <td style="padding: 10px;">${daySummary || '-'}</td>
                    <td style="padding: 10px;">${updatedAt}</td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" style="padding: 12px; color: #c0392b;">Müsaitlik özeti yüklenemedi: ${error.message}</td></tr>`;
    }
}

async function loadAvailabilityPlanner() {
    if (!document.getElementById('availabilityBranchSelect')) return;
    updateAvailabilityBranchSelect();

    const select = document.getElementById('availabilityBranchSelect');
    if (select && !select.value && allBranches.length) {
        select.value = allBranches[0].id;
    }

    const daySelect = document.getElementById('availabilityDaySelect');
    if (daySelect && !daySelect.value) {
        daySelect.value = 'monday';
    }

    await loadAvailabilityTemplateForBranch();
    await loadTrainerAvailabilitySummary();
    await loadStudentCompletionCalendar();
}

async function loadStudentCompletionCalendar() {
    const tbody = document.getElementById('studentCompletionCalendarTable');
    if (!tbody) return;

    let attendanceCountMap = {};
    const privateScheduleIds = new Set(
        allSchedules
            .filter(schedule => getScheduleLessonType(schedule) === 'private')
            .map(schedule => schedule.id)
            .filter(Boolean)
    );

    if (privateScheduleIds.size) {
        let attendanceRecords = [];
        try {
            const attendanceSnap = await db.collection('attendance').where('adminId', '==', currentAdmin.id).get();
            attendanceRecords = attendanceSnap.docs.map(doc => doc.data() || {});
        } catch (error) {
            console.warn('Admin scoped attendance okunamadi, fallback kullaniliyor:', error);
            const attendanceSnap = await db.collection('attendance').get();
            attendanceRecords = attendanceSnap.docs
                .map(doc => doc.data() || {})
                .filter(record => record.adminId === currentAdmin.id);
        }

        attendanceRecords = attendanceRecords.filter(record => privateScheduleIds.has(record.scheduleId));
        attendanceCountMap = buildAttendanceLessonCountMap(attendanceRecords);
    }

    const activeStudents = allStudents
        .filter(student => String(student.status || 'active') === 'active')
        .map(student => {
            const schedule = allSchedules.find(item => item.id === student.scheduleId);
            const branch = allBranches.find(item => item.id === student.branchId);
            const lessonsCount = getScheduleLessonCount(schedule);
            const postponementCount = getSchedulePostponementCount(schedule);
            const startDate = parseDateValue(student.startDate) || parseDateValue(schedule?.startDate) || parseDateValue(student.createdAt);
            if (!startDate || !schedule) return null;

            const lessonDates = calculateLessonDatesFromStart(startDate, getNormalizedScheduleDays(schedule), lessonsCount + postponementCount);
            const endDate = lessonDates.length ? lessonDates[lessonDates.length - 1] : startDate;
            const now = new Date();
            const diffMs = endDate.getTime() - now.getTime();
            const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            const isPrivateLesson = getScheduleLessonType(schedule) === 'private';
            const completedLessons = isPrivateLesson ? (attendanceCountMap[`${student.id}_${schedule.id}`] || 0) : null;
            const remainingLessons = isPrivateLesson ? Math.max(0, lessonsCount - completedLessons) : null;

            return {
                student,
                schedule,
                branch,
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

    if (!activeStudents.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 12px; color: #95a5a6;">Takvim gösterecek aktif öğrenci bulunamadı.</td></tr>';
        return;
    }

    tbody.innerHTML = activeStudents.map(item => {
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
                <td style="padding: 10px;">${formatDetailedDateTR(item.startDate)}</td>
                <td style="padding: 10px;">${formatDetailedDateTR(item.endDate)}${item.isPrivateLesson ? `<br><small style="color:#5d7285;">Yoklamaya göre ${item.remainingLessons} ders kaldı</small>` : ''}</td>
                <td style="padding: 10px; ${item.daysLeft < 0 ? 'color:#c0392b;font-weight:600;' : 'color:#2c3e50;'}">${statusLabel}${detailParts.length ? `<br><small style="color:#5d7285; font-weight:500;">${detailParts.join(' • ')}</small>` : ''}</td>
            </tr>
        `;
    }).join('');
}

async function deleteSchedule(scheduleId) {
    if (!confirm('Bu ders saatini silmek istediğinize emin misiniz?')) return;
    
    try {
        const schedule = allSchedules.find(item => item.id === scheduleId);
        await cleanupScheduleFirestoreRecords(schedule || { id: scheduleId });
        await loadAllData();
        loadSchedules();
        alert('Ders saati ve ilişkili Firestore kayıtları silindi!');
    } catch (error) {
        alert('Hata: ' + error.message);
    }
}

function openScheduleCompensationModal(scheduleId) {
    const schedule = allSchedules.find(item => item.id === scheduleId);
    if (!schedule) {
        alert('Ders saati bulunamadı.');
        return;
    }

    const branch = allBranches.find(item => item.id === schedule.branchId);
    const lessonsCount = getScheduleLessonCount(schedule);
    const paymentSummary = summarizeTrainerPaymentDetails(schedule);

    document.getElementById('scheduleCompensationForm').dataset.scheduleId = scheduleId;
    document.getElementById('scheduleCompensationSummary').innerHTML = `
        <strong>${branch ? branch.name : 'Bilinmiyor'} - ${schedule.time}</strong><br>
        <span>${formatScheduleTrainerAssignments(schedule)} | ${lessonsCount} ders | ${paymentSummary.paidLessons}/${paymentSummary.totalLessons} ödeme tamamlandı</span>
    `;
    renderScheduleCompensationInputs(schedule);
    document.getElementById('scheduleCompensationModal').classList.add('active');
}

function closeScheduleCompensationModal() {
    document.getElementById('scheduleCompensationModal').classList.remove('active');
    document.getElementById('scheduleCompensationForm').reset();
    delete document.getElementById('scheduleCompensationForm').dataset.scheduleId;
}

async function saveScheduleCompensation(e) {
    e.preventDefault();

    const scheduleId = document.getElementById('scheduleCompensationForm').dataset.scheduleId;
    const schedule = allSchedules.find(item => item.id === scheduleId);

    if (!scheduleId) {
        alert('Ders saati seçilemedi.');
        return;
    }

    if (!schedule) {
        alert('Ders saati bulunamadı.');
        return;
    }

    const rateInputs = Array.from(document.querySelectorAll('#scheduleCompensationAssignments .schedule-comp-rate'));
    const paymentInputs = Array.from(document.querySelectorAll('#scheduleCompensationAssignments .lesson-payment-status'));
    const assignmentMap = new Map(normalizeScheduleTrainerAssignments(schedule).map(assignment => [assignment.trainerId, { ...assignment }]));

    for (const input of rateInputs) {
        const trainerRate = Number.parseFloat(input.value);
        if (!Number.isFinite(trainerRate) || trainerRate < 0) {
            alert('Tüm antrenör maaşları için geçerli bir tutar girin.');
            input.focus();
            return;
        }
        const assignment = assignmentMap.get(input.dataset.trainerId);
        if (assignment) {
            assignment.trainerRate = trainerRate;
        }
    }

    paymentInputs.forEach(input => {
        const assignment = assignmentMap.get(input.dataset.trainerId);
        if (!assignment) return;
        if (!Array.isArray(assignment.trainerPaymentDetails)) {
            assignment.trainerPaymentDetails = [];
        }
        const detailIndex = Number(input.dataset.lessonNumber) - 1;
        const existingDetail = assignment.trainerPaymentDetails[detailIndex] || {};
        const nextStatus = input.value === 'paid' ? 'paid' : 'pending';
        assignment.trainerPaymentDetails[detailIndex] = {
            ...existingDetail,
            lessonNumber: Number(input.dataset.lessonNumber),
            status: nextStatus,
            paidAt: nextStatus === 'paid'
                ? (existingDetail.paidAt || new Date().toISOString())
                : null,
            updatedAt: new Date().toISOString()
        };
    });

    const updatedAssignments = Array.from(assignmentMap.values()).map(assignment => {
        const paymentSummary = summarizeAssignmentPaymentDetails(assignment, getScheduleLessonCount(schedule));
        return {
            ...assignment,
            trainerPaymentDetails: paymentSummary.details,
            trainerPaidLessonCount: paymentSummary.paidLessons,
            trainerPaymentStatus: paymentSummary.aggregateStatus
        };
    });

    const primaryAssignment = updatedAssignments.find(item => item.role === 'head') || updatedAssignments[0];


    try {
        await db.collection('schedules').doc(scheduleId).update({
            trainerAssignments: updatedAssignments,
            trainerRate: Number.isFinite(Number(primaryAssignment?.trainerRate)) ? Number(primaryAssignment.trainerRate) : null,
            trainerPaymentStatus: primaryAssignment?.trainerPaymentStatus || 'pending',
            trainerPaymentDetails: primaryAssignment?.trainerPaymentDetails || [],
            trainerPaidLessonCount: Number(primaryAssignment?.trainerPaidLessonCount || 0),
            compensationUpdatedAt: new Date().toISOString(),
            compensationUpdatedBy: currentAdmin.id
        });

        await loadAllData();
        closeScheduleCompensationModal();
        loadSchedules();
        alert('Ders maaşı güncellendi!');
    } catch (error) {
        alert('Hata: ' + error.message);
    }
}

// ======================== PRICES ========================

async function loadPrices() {
    const container = document.getElementById('pricesContainer');
    container.innerHTML = '';

    // Load existing prices
    const pricesSnap = await db.collection('prices').where('adminId', '==', currentAdmin.id).get();
    allPrices = {};
    pricesSnap.docs.forEach(doc => {
        const data = doc.data();
        allPrices[doc.id] = data.price;
    });

    allSchedules.forEach(schedule => {
        const branch = allBranches.find(b => b.id === schedule.branchId);
        const priceKey = `${schedule.branchId}_${schedule.time}`;
        const existingPrice = allPrices[priceKey];

        const priceCard = document.createElement('div');
        priceCard.className = 'price-card';
        priceCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: #f9f9f9; border-radius: 5px; margin-bottom: 10px;">
                <div>
                    <strong>${branch ? branch.name : 'Bilinmiyor'}</strong> - ${schedule.time}
                </div>
                <div style="display: flex; gap: 10px;">
                    <input type="number" placeholder="Fiyat (₺)" class="price-input" data-key="${priceKey}" step="0.01" style="width: 150px; padding: 8px;" value="${existingPrice || ''}">
                    <button class="btn btn-success btn-sm" onclick="savePrice('${priceKey}')">${existingPrice ? 'Güncelle' : 'Kaydet'}</button>
                </div>
            </div>
        `;
        container.appendChild(priceCard);
    });
}

async function savePrice(priceKey) {
    const price = parseFloat(document.querySelector(`[data-key="${priceKey}"]`).value);

    if (isNaN(price) || price <= 0) {
        alert('Geçerli bir fiyat girin!');
        return;
    }

    try {
        await db.collection('prices').doc(priceKey).set({
            price: price,
            adminId: currentAdmin.id,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        alert('Fiyat kaydedildi!');
        await loadPrices(); // Reload to show readonly state
    } catch (error) {
        alert('Hata: ' + error.message);
    }
}

// ======================== ANNOUNCEMENTS ========================

function openAnnouncementModal() {
    document.getElementById('announcementForm').reset();
    document.getElementById('announcementModal').classList.add('active');
}

function closeAnnouncementModal() {
    document.getElementById('announcementModal').classList.remove('active');
}

async function sendAnnouncement(e) {
    e.preventDefault();
    
    const title = document.getElementById('announcementTitle').value;
    const content = document.getElementById('announcementContent').value;
    const target = document.getElementById('announcementTarget').value;
    
    const announcementData = {
        title: title,
        content: content,
        target: target,
        adminId: currentAdmin.id,
        createdAt: new Date().toISOString()
    };
    
    try {
        if (target === 'schedule') {
            const branchId = document.getElementById('announcementBranch').value;
            const scheduleId = document.getElementById('announcementSchedule').value;
            announcementData.branchId = branchId;
            announcementData.scheduleId = scheduleId;
        }
        
        await db.collection('announcements').add(announcementData);
        closeAnnouncementModal();
        loadAnnouncements();
        alert('Duyuru gönderildi!');
    } catch (error) {
        alert('Hata: ' + error.message);
    }
}

async function loadAnnouncements() {
    const container = document.getElementById('announcementsList');
    container.innerHTML = '';

    const announcementsSnap = await db.collection('announcements').where('adminId', '==', currentAdmin.id).orderBy('createdAt', 'desc').limit(10).get();
    const announcements = announcementsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));

    announcements.forEach(announcement => {
        const card = document.createElement('div');
        card.style.cssText = 'background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 10px;';
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <h3>${announcement.title}</h3>
                    <p>${announcement.content}</p>
                    <small style="color: #95a5a6;">
                        ${new Date(announcement.createdAt).toLocaleDateString('tr-TR')}
                    </small>
                </div>
                <button class="btn btn-danger btn-sm" onclick="deleteAnnouncement('${announcement.id}')" style="margin-left: 10px;">Sil</button>
            </div>
        `;
        container.appendChild(card);
    });
}

async function deleteAnnouncement(announcementId) {
    if (!confirm('Bu duyuruyu silmek istediğinize emin misiniz?')) return;

    try {
        await db.collection('announcements').doc(announcementId).delete();
        await loadAnnouncements();
        alert('Duyuru silindi!');
    } catch (error) {
        alert('Duyuru silinirken hata: ' + error.message);
    }
}

// ======================== FINANCE ========================

async function loadFinance() {
    const branchFilter = document.getElementById('financeBranchFilter')?.value || '';
    const scheduleFilter = document.getElementById('financeScheduleFilter')?.value || '';
    const range = getFinanceDateRange();
    const rangeInfo = document.getElementById('financeRangeInfo');
    if (rangeInfo) {
        rangeInfo.textContent = formatFinanceRangeLabel(range);
    }

    let allPayments = [];
    let allIncomes = [];
    try {
        const [paymentsSnap, incomesSnap] = await Promise.all([
            db.collection('payments').where('adminId', '==', currentAdmin.id).get(),
            db.collection('incomes').where('adminId', '==', currentAdmin.id).get()
        ]);
        allPayments = paymentsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        allIncomes = incomesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
    } catch (error) {
        console.error('Finans kayıtları yüklenirken hata:', error);
    }

    const branchData = {};

    allStudents.forEach(student => {
        const branchId = resolveFinanceBranchId(student, student);
        const scheduleId = resolveFinanceScheduleId(student, student);
        const turnover = Number(student.totalAmount || 0);

        const branchEntry = ensureFinanceBranchEntry(branchData, branchId);
        const scheduleEntry = ensureFinanceScheduleEntry(branchData, branchId, scheduleId);

        scheduleEntry.turnover += turnover;
        branchEntry.totalTurnover += turnover;
    });

    allExpenses.filter(expense => isDateInFinanceRange(expense.date || expense.createdAt, range)).forEach(expense => {
        const branchId = resolveFinanceBranchId(expense);
        const scheduleId = resolveFinanceScheduleId(expense);

        const branchEntry = ensureFinanceBranchEntry(branchData, branchId);
        const scheduleEntry = ensureFinanceScheduleEntry(branchData, branchId, scheduleId);

        scheduleEntry.expense += expense.amount || 0;
        scheduleEntry.manualExpense += expense.amount || 0;
        scheduleEntry.expenses.push(expense);
        branchEntry.totalExpense += expense.amount || 0;
        branchEntry.totalManualExpense += expense.amount || 0;
    });

    allSchedules.forEach(schedule => {
        const branchId = resolveFinanceBranchId(schedule);
        const scheduleId = schedule.id || resolveFinanceScheduleId(schedule);
        const salaryExpense = calculateScheduleTrainerSalaryExpense(schedule, { range });

        if (!salaryExpense.total) {
            return;
        }

        const branchEntry = ensureFinanceBranchEntry(branchData, branchId);
        const scheduleEntry = ensureFinanceScheduleEntry(branchData, branchId, scheduleId);
        scheduleEntry.expense += salaryExpense.total;
        scheduleEntry.salaryExpense += salaryExpense.total;
        scheduleEntry.salaryDetails = salaryExpense.details;
        branchEntry.totalExpense += salaryExpense.total;
        branchEntry.totalSalaryExpense += salaryExpense.total;
    });

    allPayments.filter(payment => isDateInFinanceRange(getFinanceRecordDate(payment), range)).forEach(payment => {
        const student = allStudents.find(item => item.id === payment.studentId);
        const branchId = resolveFinanceBranchId(payment, student);
        const scheduleId = resolveFinanceScheduleId(payment, student);
        const paid = Number(payment.amount || 0);

        const branchEntry = ensureFinanceBranchEntry(branchData, branchId);
        const scheduleEntry = ensureFinanceScheduleEntry(branchData, branchId, scheduleId);

        scheduleEntry.income += paid;
        scheduleEntry.paymentIncome += paid;
        scheduleEntry.payments.push(payment);
        branchEntry.totalIncome += paid;
    });

    allIncomes.filter(income => isDateInFinanceRange(income.date || income.createdAt, range)).forEach(income => {
        const branchId = resolveFinanceBranchId(income);
        const scheduleId = resolveFinanceScheduleId(income);

        const branchEntry = ensureFinanceBranchEntry(branchData, branchId);
        const scheduleEntry = ensureFinanceScheduleEntry(branchData, branchId, scheduleId);
        const amount = Number(income.amount || 0);

        scheduleEntry.income += amount;
        scheduleEntry.extraIncome += amount;
        scheduleEntry.incomes.push(income);
        branchEntry.totalIncome += amount;
    });

    Object.values(branchData).forEach(branch => {
        branch.totalProfit = branch.totalIncome - branch.totalExpense;
        Object.values(branch.schedules).forEach(schedule => {
            schedule.profit = schedule.income - schedule.expense;
        });
    });

    const filteredBranchData = buildVisibleFinanceBranchData(branchData, branchFilter, scheduleFilter);

    let totalTurnover = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    Object.values(filteredBranchData).forEach(branch => {
        totalTurnover += branch.totalTurnover || 0;
        totalIncome += branch.totalIncome;
        totalExpense += branch.totalExpense;
    });
    const totalProfit = totalIncome - totalExpense;

    // Update summary cards
    document.getElementById('currentTurnover').textContent = formatTryCurrency(totalTurnover);
    document.getElementById('currentIncome').textContent = formatTryCurrency(totalIncome);
    document.getElementById('currentExpense').textContent = formatTryCurrency(totalExpense);
    document.getElementById('currentProfit').textContent = formatTryCurrency(totalProfit);

    const tableContainer = document.getElementById('financeTable');
    let tableRows = '';

    Object.entries(filteredBranchData).forEach(([branchId, branch]) => {
        tableRows += `
            <tr style="background-color: #f8f9fa;">
                <td colspan="7" style="font-weight: bold; padding: 15px; border-top: 2px solid #dee2e6;">
                🏢 ${branch.branchName} - Ciro: ${formatTryCurrency(branch.totalTurnover || 0)}, Gelir: ${formatTryCurrency(branch.totalIncome)}, Gider: ${formatTryCurrency(branch.totalExpense)}, Kâr: ${formatTryCurrency(branch.totalProfit)}
                </td>
            </tr>
        `;

        Object.entries(branch.schedules).forEach(([scheduleId, schedule]) => {
            tableRows += `
                <tr>
                <td>⏰ ${schedule.scheduleName}</td>
                <td>${formatTryCurrency(schedule.turnover)}</td>
                <td>${formatTryCurrency(schedule.income)}</td>
                <td>${formatTryCurrency(schedule.expense)}<br><small style="color:#6f8091;">Manuel: ${formatTryCurrency(schedule.manualExpense)} • Maaş: ${formatTryCurrency(schedule.salaryExpense)}</small></td>
                <td>${formatTryCurrency(schedule.profit)}</td>
                <td>${schedule.payments.length} ödeme${schedule.incomes.length ? ` + ${schedule.incomes.length} ek gelir` : ''}</td>
                <td>
                    <button class="btn btn-info btn-sm" onclick="openDetailsModal('${branchId}', '${scheduleId}')">Detay</button>
                </td>
                </tr>
            `;
        });
    });

    tableContainer.innerHTML = `
        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>Şube / Saat</th>
                        <th>Ciro</th>
                        <th>Gelir</th>
                        <th>Gider</th>
                        <th>Kâr</th>
                        <th>Ödeme</th>
                        <th>İşlem</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows || '<tr><td colspan="7" style="padding: 20px; text-align: center; color: #95a5a6;">Seçili filtreye ait finans kaydı bulunamadı.</td></tr>'}
                </tbody>
            </table>
        </div>
    `;

    // Update filter dropdowns
    updateFinanceFilters();

    // Update chart
    if (financeChart) {
        financeChart.destroy();
    }

    const ctx = document.getElementById('financeChart').getContext('2d');
    financeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Gelir', 'Gider'],
            datasets: [{
                data: [totalIncome, totalExpense],
                backgroundColor: ['#27ae60', '#e74c3c'],
                borderColor: ['#229954', '#c0392b'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function openIncomeModal() {
    document.getElementById('incomeForm').reset();
    document.getElementById('incomeDate').valueAsDate = new Date();
    document.getElementById('incomeModal').classList.add('active');
}

function closeIncomeModal() {
    document.getElementById('incomeModal').classList.remove('active');
}

async function saveIncome(e) {
    e.preventDefault();

    const incomeData = {
        description: document.getElementById('incomeDescription').value,
        amount: parseFloat(document.getElementById('incomeAmount').value),
        date: document.getElementById('incomeDate').value,
        branchId: document.getElementById('incomeBranch').value,
        scheduleId: document.getElementById('incomeSchedule').value,
        adminId: currentAdmin.id,
        createdAt: new Date().toISOString()
    };

    try {
        await db.collection('incomes').add(incomeData);
        await loadAllData();
        closeIncomeModal();
        loadFinance();
        alert('Gelir kaydedildi!');
    } catch (error) {
        alert('Hata: ' + error.message);
    }
}

function openExpenseModal() {
    document.getElementById('expenseForm').reset();
    document.getElementById('expenseDate').valueAsDate = new Date();
    populateExpenseCategorySelect();
    toggleExpenseOtherNote();
    updateExpenseScheduleOptions();
    document.getElementById('expenseModal').classList.add('active');
}

function closeExpenseModal() {
    document.getElementById('expenseModal').classList.remove('active');
}

async function saveExpense(e) {
    e.preventDefault();

    const expenseBranchEl = document.getElementById('expenseBranch');
    const expenseScheduleEl = document.getElementById('expenseSchedule');
    const categoryId = document.getElementById('expenseCategory')?.value || '';
    const categoryMeta = getExpenseCategoryMeta(categoryId);
    const otherNote = String(document.getElementById('expenseOtherNote')?.value || '').trim();

    if (!categoryMeta) {
        alert('Lütfen gider türü seçin.');
        return;
    }

    if (categoryId === 'other' && !otherNote) {
        alert('“Diğer” seçeneği için kısa bir açıklama yazın.');
        return;
    }

    const expenseData = {
        category: categoryId,
        categoryLabel: categoryMeta.label,
        otherNote: categoryId === 'other' ? otherNote : '',
        description: categoryId === 'other' ? `Diğer: ${otherNote}` : categoryMeta.label,
        amount: parseFloat(document.getElementById('expenseAmount').value),
        date: document.getElementById('expenseDate').value,
        branchId: expenseBranchEl ? expenseBranchEl.value : '',
        scheduleId: expenseScheduleEl ? expenseScheduleEl.value : '',
        adminId: currentAdmin.id,
        createdAt: new Date().toISOString()
    };

    try {
        await db.collection('expenses').add(expenseData);
        await loadAllData();
        closeExpenseModal();
        loadFinance();
        alert('Gider kaydedildi!');
    } catch (error) {
        alert('Hata: ' + error.message);
    }
}

async function deleteExpense(expenseId) {
    if (!expenseId) return;
    if (!confirm('Bu gider kaydını silmek istediğinize emin misiniz?')) return;

    try {
        await db.collection('expenses').doc(expenseId).delete();
        await loadAllData();
        await loadFinance();

        const branchId = document.getElementById('financeBranchFilter')?.value || '';
        const scheduleId = document.getElementById('financeScheduleFilter')?.value || '';
        if (branchId && scheduleId) {
            closeDetailsModal();
            await openDetailsModal(branchId, scheduleId);
        }
    } catch (error) {
        alert('Gider silinirken hata: ' + error.message);
    }
}

async function deleteIncome(incomeId) {
    if (!incomeId) return;
    if (!confirm('Bu gelir kaydını silmek istediğinize emin misiniz?')) return;

    try {
        await db.collection('incomes').doc(incomeId).delete();
        await loadFinance();

        const branchId = document.getElementById('financeBranchFilter')?.value || '';
        const scheduleId = document.getElementById('financeScheduleFilter')?.value || '';
        if (branchId && scheduleId) {
            closeDetailsModal();
            await openDetailsModal(branchId, scheduleId);
        }
    } catch (error) {
        alert('Gelir silinirken hata: ' + error.message);
    }
}

async function deletePayment(paymentId) {
    if (!paymentId) return;
    if (!confirm('Bu ödeme kaydını silmek istediğinize emin misiniz? Bu işlem öğrencinin ödeme durumunu da geri alır.')) return;

    try {
        const paymentRef = db.collection('payments').doc(paymentId);
        const paymentSnap = await paymentRef.get();
        if (!paymentSnap.exists) {
            alert('Ödeme kaydı bulunamadı.');
            return;
        }

        const payment = { id: paymentSnap.id, ...(paymentSnap.data() || {}) };
        const studentId = payment.studentId || '';

        if (studentId) {
            const studentRef = db.collection('students').doc(studentId);
            const studentSnap = await studentRef.get();

            if (studentSnap.exists) {
                const student = { id: studentSnap.id, ...(studentSnap.data() || {}) };
                const updatedInstallments = rollbackPaymentFromInstallments(student, payment);
                const nextTotalPaid = Math.max(0, roundCurrency((student.totalPaid || 0) - (payment.amount || 0)));

                await studentRef.update({
                    totalPaid: nextTotalPaid,
                    installments: updatedInstallments
                });
            }
        }

        await paymentRef.delete();
        await loadAllData();
        await loadFinance();

        const branchId = document.getElementById('financeBranchFilter')?.value || '';
        const scheduleId = document.getElementById('financeScheduleFilter')?.value || '';
        if (branchId && scheduleId) {
            closeDetailsModal();
            await openDetailsModal(branchId, scheduleId);
        }
    } catch (error) {
        alert('Ödeme silinirken hata: ' + error.message);
    }
}

// ======================== DETAILS MODAL ========================

async function openDetailsModal(branchId, scheduleId) {
    if (!branchId || !scheduleId) {
        const selectedBranch = document.getElementById('financeBranchFilter')?.value || '';
        const selectedSchedule = document.getElementById('financeScheduleFilter')?.value || '';
        if (!selectedBranch || !selectedSchedule) {
            alert('Detay görmek için önce şube ve saat filtresini birlikte seçin.');
            return;
        }
        branchId = selectedBranch;
        scheduleId = selectedSchedule;
    }

    const branch = allBranches.find(b => b.id === branchId);
    const schedule = allSchedules.find(s => s.id === scheduleId);
    const turnover = allStudents
        .filter(student => resolveFinanceBranchId(student, student) === branchId && resolveFinanceScheduleId(student, student) === scheduleId)
        .reduce((sum, student) => sum + Number(student.totalAmount || 0), 0);
    const range = getFinanceDateRange();
    const manualExpenses = allExpenses.filter(expense => (
        (expense.branchId || 'unknown') === branchId &&
        (expense.scheduleId || 'unknown') === scheduleId &&
        isDateInFinanceRange(expense.date || expense.createdAt, range)
    ));
    const salaryExpense = schedule ? calculateScheduleTrainerSalaryExpense(schedule, { range }) : { total: 0, details: [] };

    let payments = [];
    let incomes = [];
    try {
        const [paymentsSnap, incomesSnap] = await Promise.all([
            db.collection('payments').where('adminId', '==', currentAdmin.id).get(),
            db.collection('incomes').where('adminId', '==', currentAdmin.id).get()
        ]);
        payments = paymentsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        incomes = incomesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
    } catch (error) {
        console.error('Finans detayları yüklenirken hata:', error);
    }

    const filteredPayments = payments.filter(payment => {
        const student = allStudents.find(s => s.id === payment.studentId);
        return resolveFinanceBranchId(payment, student) === branchId &&
            resolveFinanceScheduleId(payment, student) === scheduleId &&
            isDateInFinanceRange(getFinanceRecordDate(payment), range);
    });

    const filteredIncomes = incomes.filter(income => (
        doesIncomeMatchFinanceDetail(income, branchId, scheduleId) &&
        isDateInFinanceRange(income.date || income.createdAt, range)
    ));

    const modalHtml = `
        <div id="detailsModal" class="modal" style="display: flex;">
            <div class="modal-content" style="max-width: 900px; max-height: 80vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2>💰 Detaylı Finans Geçmişi</h2>
                    <button class="close-btn" onclick="closeDetailsModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px;">
                        <h3>🏢 ${branch ? branch.name : 'Bilinmiyor'} - ⏰ ${schedule ? `${schedule.time} (${schedule.lessonsCount || 1} Ders)` : 'Bilinmiyor'}</h3>
                        <p><strong>Dönem:</strong> ${formatFinanceRangeLabel(range)}</p>
                        <p><strong>Ciro:</strong> ${formatTryCurrency(turnover)}</p>
                        <p><strong>Toplam Ödeme Sayısı:</strong> ${filteredPayments.length}</p>
                        <p><strong>Ek Gelir:</strong> ${formatTryCurrency(filteredIncomes.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</p>
                        <p><strong>Manuel Gider:</strong> ${formatTryCurrency(manualExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</p>
                        <p><strong>Antrenör Maaşı Gideri:</strong> ${formatTryCurrency(salaryExpense.total)}</p>
                    </div>

                    <div style="margin-bottom: 20px; border: 1px solid #e5e9ef; border-radius: 8px; padding: 15px; background: white;">
                        <h3 style="margin: 0 0 12px;">📈 Ek Gelirler</h3>
                        ${filteredIncomes.length === 0
                            ? '<p style="color: #95a5a6; margin: 0;">Bu dönem için ek gelir yok.</p>'
                            : filteredIncomes.map(income => `
                                <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; padding:10px 0; border-bottom:1px solid #eef2f6;">
                                    <div>
                                        <div style="font-weight:600; color:#2c3e50;">${income.description || 'Ek gelir'}</div>
                                        <div style="font-size:0.9em; color:#6f8091;">${income.date ? new Date(income.date).toLocaleDateString('tr-TR') : '-'} • ${formatTryCurrency(income.amount || 0)}${isBranchLevelIncomeRecord(income) ? ' • Şube geneli gelir' : ''}</div>
                                    </div>
                                    <button class="btn btn-danger btn-sm" onclick="deleteIncome('${income.id}')">Sil</button>
                                </div>
                            `).join('')}
                    </div>

                    <div style="margin-bottom: 20px; border: 1px solid #e5e9ef; border-radius: 8px; padding: 15px; background: white;">
                        <h3 style="margin: 0 0 12px;">🧾 Manuel Giderler</h3>
                        ${manualExpenses.length === 0
                            ? '<p style="color: #95a5a6; margin: 0;">Bu ders için manuel gider yok.</p>'
                            : manualExpenses.map(expense => `
                                <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; padding:10px 0; border-bottom:1px solid #eef2f6;">
                                    <div>
                                        <div style="font-weight:600; color:#2c3e50;">${escapeHtml(getExpenseDisplayLabel(expense))}</div>
                                        <div style="font-size:0.9em; color:#6f8091;">${expense.date ? new Date(expense.date).toLocaleDateString('tr-TR') : '-'} • ${formatTryCurrency(expense.amount || 0)}</div>
                                    </div>
                                    <button class="btn btn-danger btn-sm" onclick="deleteExpense('${expense.id}')">Sil</button>
                                </div>
                            `).join('')}
                    </div>

                    <div style="margin-bottom: 20px; border: 1px solid #e5e9ef; border-radius: 8px; padding: 15px; background: white;">
                        <h3 style="margin: 0 0 12px;">👨‍🏫 Otomatik Maaş Giderleri</h3>
                        ${salaryExpense.details.length === 0
                            ? '<p style="color: #95a5a6; margin: 0;">Ödenmiş antrenör maaşı bulunmuyor.</p>'
                            : salaryExpense.details.map(item => `
                                <div style="padding:10px 0; border-bottom:1px solid #eef2f6;">
                                    <div style="font-weight:600; color:#2c3e50;">${item.trainerName}</div>
                                    <div style="font-size:0.9em; color:#6f8091;">${item.paidLessons} ders x ${formatTryCurrency(item.trainerRate)} = ${formatTryCurrency(item.amount)}</div>
                                </div>
                            `).join('')}
                    </div>

                    ${filteredPayments.length === 0 ?
                        '<p style="text-align: center; color: #95a5a6; padding: 40px;">Bu şube/saat için ödeme bulunamadı.</p>' :
                        `<div style="max-height: 500px; overflow-y: auto;">
                            ${filteredPayments.map(payment => {
                                const student = allStudents.find(s => s.id === payment.studentId);
                                const paymentDate = getFinanceRecordDate(payment);
                                const secretary = allSecretaries.find(s => s.id === payment.createdBy) ||
                                                 { name: payment.createdBy || 'Bilinmiyor' };

                                return `
                                    <div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: white;">
                                        <div style="display:flex; justify-content:flex-end; margin-bottom:10px;">
                                            <button class="btn btn-danger btn-sm" onclick="deletePayment('${payment.id}')">Ödemeyi Sil</button>
                                        </div>
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                            <div>
                                                <h4 style="margin: 0 0 10px 0; color: #2c3e50;">👤 ${student ? `${student.name} ${student.surname}` : 'Bilinmiyor'}</h4>
                                                <p style="margin: 5px 0;"><strong>💰 Tutar:</strong> ${formatTryCurrency(payment.amount)}</p>
                                                <p style="margin: 5px 0;"><strong>💳 Yöntem:</strong> ${getPaymentMethodText(payment.method)}</p>
                                                <p style="margin: 5px 0;"><strong>👩‍💼 Sekreter:</strong> ${payment.createdByName || payment.createdBy || secretary.name}</p>
                                                <p style="margin: 5px 0;"><strong>📋 Açıklama:</strong> ${payment.description || payment.note || 'Tanımlanmamış'}</p>
                                                <p style="margin: 5px 0;"><strong>🕒 Tarih:</strong> ${paymentDate ? paymentDate.toLocaleDateString('tr-TR') : '-'}</p>
                                                ${payment.method === 'cash' && payment.paymentTime ? `
                                                    <p style="margin: 5px 0; background: #fff3cd; padding: 8px; border-radius: 4px; color: #856404;"><strong>⏰ Nakit Saati:</strong> ${String(payment.paymentTime.hour).padStart(2, '0')}:${String(payment.paymentTime.minute).padStart(2, '0')}:${String(payment.paymentTime.second).padStart(2, '0')}</p>
                                                ` : ''}
                                            </div>
                                            <div>
                                                ${payment.receiptData || payment.invoiceData ? `
                                                    <div style="border: 1px solid #eee; border-radius: 5px; padding: 10px; background: #f9f9f9;">
                                                        <h5 style="margin: 0 0 10px 0;">📄 Belgeler</h5>
                                                        ${payment.receiptData ? `
                                                            <div style="margin-bottom: 10px;">
                                                                <img src="${payment.receiptData}" alt="Dekont" style="max-width: 100%; max-height: 150px; border-radius: 5px; cursor: pointer; border: 1px solid #ddd;" onclick="showFullImage('${payment.receiptData}', 'Dekont')">
                                                                <p style="margin: 5px 0 0 0; font-size: 0.85em; color: #666;">🏦 Dekont - ${payment.receiptFileName || ''}</p>
                                                            </div>
                                                        ` : ''}
                                                        ${payment.invoiceData ? `
                                                            <div style="margin-bottom: 10px;">
                                                                <img src="${payment.invoiceData}" alt="Fatura" style="max-width: 100%; max-height: 150px; border-radius: 5px; cursor: pointer; border: 1px solid #ddd;" onclick="showFullImage('${payment.invoiceData}', 'Fatura')">
                                                                <p style="margin: 5px 0 0 0; font-size: 0.85em; color: #666;">💳 Fatura - ${payment.invoiceFileName || ''}</p>
                                                            </div>
                                                        ` : ''}
                                                    </div>
                                                ` : '<p style="color: #95a5a6; font-style: italic; font-size: 0.9em;">Belge yüklenmemiş (nakit ödeme)</p>'}
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>`
                    }
                </div>
            </div>
        </div>

        <!-- Full Image Modal -->
        <div id="imageModal" class="modal" style="display: none;">
            <div class="modal-content" style="max-width: 90vw; max-height: 90vh;">
                <div class="modal-header">
                    <h2 id="imageModalTitle">Belge</h2>
                    <button class="close-btn" onclick="closeImageModal()">&times;</button>
                </div>
                <div style="text-align: center;">
                    <img id="fullImage" src="" alt="Belge" style="max-width: 100%; max-height: 80vh; object-fit: contain;">
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if present
    const existingModal = document.getElementById('detailsModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeDetailsModal() {
    const modal = document.getElementById('detailsModal');
    if (modal) {
        modal.remove();
    }
}

function getPaymentMethodText(method) {
    const methods = {
        'cash': '💵 Nakit',
        'transfer': '🏦 Havale/EFT',
        'credit': '💳 Kredi Kartı'
    };
    return methods[method] || method;
}

function showFullImage(src, title) {
    document.getElementById('fullImage').src = src;
    document.getElementById('imageModalTitle').textContent = title;
    document.getElementById('imageModal').style.display = 'flex';
}

function closeImageModal() {
    document.getElementById('imageModal').style.display = 'none';
}

function openDetailsModalFromFilters() {
    const branchId = document.getElementById('financeBranchFilter')?.value || '';
    const scheduleId = document.getElementById('financeScheduleFilter')?.value || '';
    openDetailsModal(branchId, scheduleId);
}

// ======================== UPDATE FINANCE FILTERS ========================

function updateFinanceFilters() {
    const selectedBranch = document.getElementById('financeBranchFilter')?.value || '';
    const selectedSchedule = document.getElementById('financeScheduleFilter')?.value || '';

    // Update branch filter
    const branchFilter = document.getElementById('financeBranchFilter');
    if (branchFilter) {
        branchFilter.innerHTML = '<option value="">Tüm Şubeler</option>';
        allBranches.forEach(branch => {
            const option = document.createElement('option');
            option.value = branch.id;
            option.textContent = branch.name;
            branchFilter.appendChild(option);
        });
        branchFilter.value = selectedBranch;
    }

    // Update schedule filter
    const scheduleFilter = document.getElementById('financeScheduleFilter');
    if (scheduleFilter) {
        scheduleFilter.innerHTML = '<option value="">Tüm Saatler</option>';
        allSchedules.forEach(schedule => {
            const branch = allBranches.find(b => b.id === schedule.branchId);
            const option = document.createElement('option');
            option.value = schedule.id;
            option.textContent = `${branch ? branch.name : 'Bilinmiyor'} - ${schedule.time}`;
            scheduleFilter.appendChild(option);
        });
        scheduleFilter.value = selectedSchedule;
    }
}

// ======================== UPDATE SELECTS ========================

function updateBranchSelects() {
    const selects = [
        document.getElementById('scheduleBranch'),
        document.getElementById('announcementBranch'),
        document.getElementById('incomeBranch'),
        document.getElementById('expenseBranch')
    ];
    
    selects.forEach(select => {
        if (!select) return;
        select.innerHTML = '<option value="">-- Şube Seçiniz --</option>';
        allBranches.forEach(branch => {
            const option = document.createElement('option');
            option.value = branch.id;
            option.textContent = branch.name;
            select.appendChild(option);
        });
    });
}

function updateTrainerSelects() {
    const select = document.getElementById('trainerBranches');
    select.innerHTML = '<option value="">-- Şube Seçiniz --</option>';
    allBranches.forEach(branch => {
        const option = document.createElement('option');
        option.value = branch.id;
        option.textContent = branch.name;
        select.appendChild(option);
    });
    
    const scheduleTrainer = document.getElementById('scheduleTrainer');
    if (scheduleTrainer) {
        scheduleTrainer.innerHTML = '<option value="">-- Antrenör Seçiniz --</option>';
    }

    renderScheduleTrainerAssignmentRows(collectScheduleTrainerAssignments({ allowEmpty: true }));
}

function updateScheduleSelects() {
    const scheduleSelects = [
        document.getElementById('announcementSchedule'),
        document.getElementById('incomeSchedule'),
        document.getElementById('expenseSchedule')
    ];

    scheduleSelects.forEach(select => {
        if (!select) return;
        select.innerHTML = '<option value="">-- Saat Seçiniz --</option>';
        allSchedules.forEach(schedule => {
            const branch = allBranches.find(b => b.id === schedule.branchId);
            const option = document.createElement('option');
            option.value = schedule.id;
            option.textContent = `${branch ? branch.name : 'Bilinmiyor'} - ${schedule.time}`;
            select.appendChild(option);
        });
    });

    // Update event time filter
    const timeFilter = document.getElementById('eventTimeFilter');
    if (timeFilter) {
        timeFilter.innerHTML = '<option value="">Tüm Saatler</option>';
        // Get unique times
        const uniqueTimes = [...new Set(allSchedules.map(s => s.time))].sort();
        uniqueTimes.forEach(time => {
            const option = document.createElement('option');
            option.value = time;
            option.textContent = time;
            timeFilter.appendChild(option);
        });
    }

    // Update event time select in modal
    const eventTimeSelect = document.getElementById('eventTime');
    if (eventTimeSelect) {
        eventTimeSelect.innerHTML = '<option value="">Tüm Saatler</option>';
        // Get unique times
        const uniqueTimes = [...new Set(allSchedules.map(s => s.time))].sort();
        uniqueTimes.forEach(time => {
            const option = document.createElement('option');
            option.value = time;
            option.textContent = time;
            eventTimeSelect.appendChild(option);
        });
    }

    updateExpenseScheduleOptions();
}

function updateExpenseScheduleOptions() {
    const branchId = document.getElementById('expenseBranch')?.value || '';
    const select = document.getElementById('expenseSchedule');
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">-- Saat Seçiniz --</option>';

    allSchedules
        .filter(schedule => !branchId || schedule.branchId === branchId)
        .forEach(schedule => {
            const branch = allBranches.find(item => item.id === schedule.branchId);
            const option = document.createElement('option');
            option.value = schedule.id;
            option.textContent = `${branch ? branch.name : 'Bilinmiyor'} - ${schedule.time}`;
            select.appendChild(option);
        });

    if (currentValue && Array.from(select.options).some(option => option.value === currentValue)) {
        select.value = currentValue;
    }
}
// ======================== CLUB PROFILE ========================

let allSecretaries = [];

function buildClubProfileWarning(clubData) {
    const warnings = [];
    if (!String(clubData?.clubName || '').trim()) {
        warnings.push('kulüp adı eksik');
    }
    if (!String(clubData?.logoUrl || '').trim()) {
        warnings.push('kulüp logosu eksik');
    }
    if (!warnings.length) return '';
    return 'Uyarı: Sohbet ve profil görünümünün doğru çalışması için ' + warnings.join(' ve ') + '.';
}

function renderClubProfileStatus(targetId, clubData, successMessage) {
    const target = document.getElementById(targetId);
    if (!target) return;

    const warning = buildClubProfileWarning(clubData);
    if (warning) {
        target.innerHTML = '<div style="color:#b9770e; font-weight:600; margin-top:8px;">' + warning + '</div>'
            + (successMessage ? '<div style="color:#27ae60; margin-top:6px;">' + successMessage + '</div>' : '');
        return;
    }

    target.style.color = '#27ae60';
    target.textContent = successMessage || 'Kulüp profili hazır.';
}

function getClubProfileHelpers() {
    return window.ClubProfileHelpers || null;
}

function getClubDisplayNameFromData(clubData) {
    const helpers = getClubProfileHelpers();
    if (helpers?.getClubDisplayName) {
        return helpers.getClubDisplayName(clubData);
    }
    return String(clubData?.clubName || clubData?.name || '').trim();
}

function bindClubLogoPreviewInput() {
    const logoInput = document.getElementById('clubLogo');
    const preview = document.getElementById('clubLogoPreview');
    if (!logoInput || !preview || logoInput.dataset.boundPreview === '1') {
        return;
    }
    logoInput.dataset.boundPreview = '1';
    logoInput.addEventListener('change', () => {
        const file = logoInput.files?.[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            preview.src = event.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    });
}

async function loadClubProfile() {
    const clubForm = document.getElementById('clubForm');
    const clubNameInput = document.getElementById('clubName');
    const logoPreview = document.getElementById('clubLogoPreview');
    const clubLink = document.getElementById('clubNavLink');

    try {
        bindClubLogoPreviewInput();
        if (clubLink) {
            clubLink.style.display = 'block';
        }
        if (clubForm) {
            clubForm.style.display = 'block';
        }

        const clubDoc = await db.collection('clubProfiles').doc(currentAdmin.id).get();
        if (clubDoc.exists) {
            const clubData = clubDoc.data() || {};
            if (clubNameInput) {
                clubNameInput.value = getClubDisplayNameFromData(clubData);
            }
            if (logoPreview) {
                const logoUrl = clubData.logoUrl || '';
                if (logoUrl) {
                    logoPreview.src = logoUrl;
                    logoPreview.style.display = 'block';
                } else {
                    logoPreview.removeAttribute('src');
                    logoPreview.style.display = 'none';
                }
            }
            renderClubProfileStatus('clubMessage', clubData, 'Kulüp adı ve logosunu buradan güncelleyebilirsiniz. Hızlı düzenleme için üstteki avatara da tıklayabilirsiniz.');
        } else if (clubNameInput) {
            clubNameInput.value = '';
            if (logoPreview) {
                logoPreview.removeAttribute('src');
                logoPreview.style.display = 'none';
            }
            renderClubProfileStatus('clubMessage', {}, 'İlk kurulum: kulüp adınızı ve logonuzu kaydedin.');
        }
    } catch (error) {
        console.error('Kulüp profili yüklenirken hata:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('clubForm')) {
        document.getElementById('clubForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveClubProfile();
        });
    }
    if (document.getElementById('clubProfileForm')) {
        document.getElementById('clubProfileForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveClubProfileUpdate();
        });
    }

    const editClubLogo = document.getElementById('editClubLogo');
    const editClubLogoPreview = document.getElementById('editClubLogoPreview');
    if (editClubLogo && editClubLogoPreview && editClubLogo.dataset.boundPreview !== '1') {
        editClubLogo.dataset.boundPreview = '1';
        editClubLogo.addEventListener('change', () => {
            const file = editClubLogo.files?.[0];
            if (!file) {
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                editClubLogoPreview.src = event.target.result;
                editClubLogoPreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        });
    }
});

async function saveClubProfile() {
    const clubName = document.getElementById('clubName').value.trim();
    const logoFile = document.getElementById('clubLogo').files[0];
    const resultDiv = document.getElementById('clubMessage');

    if (!clubName) {
        alert('Kulüp adı zorunludur.');
        return;
    }

    try {
        resultDiv.textContent = 'Kaydediliyor...';
        resultDiv.style.color = '#000';

        const helpers = getClubProfileHelpers();
        let logoUrl;
        if (logoFile) {
            logoUrl = helpers?.readImageFileAsDataUrl
                ? await helpers.readImageFileAsDataUrl(logoFile, 2 * 1024 * 1024)
                : await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(logoFile);
                });
        }

        const clubData = helpers?.buildClubProfileWritePayload
            ? helpers.buildClubProfileWritePayload({
                clubName,
                logoUrl,
                adminId: currentAdmin.id
            })
            : {
                clubName,
                name: clubName,
                logoUrl,
                adminId: currentAdmin.id,
                updatedAt: new Date().toISOString()
            };

        await db.collection('clubProfiles').doc(currentAdmin.id).set(clubData, { merge: true });
        renderClubProfileStatus('clubMessage', clubData, '✓ Kulüp profili kaydedildi!');
        document.getElementById('clubLogo').value = '';
        await loadClubProfile();
    } catch (error) {
        resultDiv.style.color = '#e74c3c';
        resultDiv.textContent = 'Hata: ' + error.message;
    }
}

// Open club profile edit modal
async function openClubProfileModal() {
    try {
        const clubDoc = await db.collection('clubProfiles').doc(currentAdmin.id).get();
        if (clubDoc.exists) {
            const clubData = clubDoc.data();
            document.getElementById('editClubName').value = getClubDisplayNameFromData(clubData);
            if (clubData.logoUrl) {
                document.getElementById('editClubLogoPreview').src = clubData.logoUrl;
                document.getElementById('editClubLogoPreview').style.display = 'block';
            } else {
                document.getElementById('editClubLogoPreview').style.display = 'none';
            }
            renderClubProfileStatus('clubProfileMessage', clubData, '');
        } else {
            renderClubProfileStatus('clubProfileMessage', {}, '');
        }
    } catch (error) {
        console.error('Kulüp profili yüklenirken hata:', error);
    }

    document.getElementById('clubProfileModal').classList.add('active');
}

// Close club profile edit modal
function closeClubProfileModal() {
    document.getElementById('clubProfileModal').classList.remove('active');
    document.getElementById('clubProfileForm').reset();
    document.getElementById('editClubLogoPreview').style.display = 'none';
    document.getElementById('clubProfileMessage').textContent = '';
}

// Save club profile update
async function saveClubProfileUpdate(e) {
    e.preventDefault();

    const clubName = document.getElementById('editClubName').value.trim();
    const logoFile = document.getElementById('editClubLogo').files[0];
    const resultDiv = document.getElementById('clubProfileMessage');

    if (!clubName) {
        alert('Kulüp adı zorunludur.');
        return;
    }

    try {
        resultDiv.textContent = 'Kaydediliyor...';
        resultDiv.style.color = '#000';

        const helpers = getClubProfileHelpers();
        const existingDoc = await db.collection('clubProfiles').doc(currentAdmin.id).get();
        const existingData = existingDoc.exists ? existingDoc.data() || {} : {};

        let logoUrl = existingData.logoUrl || '';
        if (logoFile) {
            logoUrl = helpers?.readImageFileAsDataUrl
                ? await helpers.readImageFileAsDataUrl(logoFile, 2 * 1024 * 1024)
                : await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(logoFile);
                });
        }

        const clubData = helpers?.buildClubProfileWritePayload
            ? helpers.buildClubProfileWritePayload({
                clubName,
                logoUrl,
                adminId: currentAdmin.id,
                leadFormSettings: existingData.leadFormSettings || null
            })
            : {
                clubName,
                name: clubName,
                logoUrl,
                adminId: currentAdmin.id,
                updatedAt: new Date().toISOString()
            };

        if (clubData.leadFormSettings === null) {
            delete clubData.leadFormSettings;
        }

        await db.collection('clubProfiles').doc(currentAdmin.id).set(clubData, { merge: true });
        renderClubProfileStatus('clubProfileMessage', clubData, '✓ Kulüp profili güncellendi!');
        await loadClubProfile();
        setTimeout(() => {
            closeClubProfileModal();
        }, 1200);
    } catch (error) {
        resultDiv.style.color = '#e74c3c';
        resultDiv.textContent = 'Hata: ' + error.message;
    }
}

// ======================== SECRETARIES ========================

async function loadSecretaries() {
    try {
        const secsSnap = await db.collection('users').where('adminId', '==', currentAdmin.id).where('role', '==', 'secretary').get();
        allSecretaries = secsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        
        const tbody = document.getElementById('secretariesTable');
        tbody.innerHTML = '';
        
        if (allSecretaries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #95a5a6;">Henüz sekreter eklenmemiş</td></tr>';
            return;
        }
        
        allSecretaries.forEach(sec => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${sec.name}</td>
                <td>${sec.email}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteSecretary('${sec.id}')">Sil</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Sekreterler yüklenirken hata:', error);
    }
}

function openSecretaryModal() {
    document.getElementById('secretaryForm').reset();
    document.getElementById('secretaryModal').classList.add('active');
}

function closeSecretaryModal() {
    document.getElementById('secretaryModal').classList.remove('active');
}

async function saveSecretaryFromForm(e) {
    e.preventDefault();
    
    const name = document.getElementById('secretaryName').value;
    const email = document.getElementById('secretaryEmail').value;
    const password = document.getElementById('secretaryPassword').value;
    
    try {
        // Firebase Auth'ta kullanıcı oluştur
        const userCred = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCred.user.uid;
        
        // Firestore'da sekreter kaydı oluştur
        await db.collection('users').doc(uid).set({
            name: name,
            email: email,
            role: 'secretary',
            adminId: currentAdmin.id,
            createdAt: new Date().toISOString()
        });
        
        alert('✓ Sekreter başarıyla oluşturuldu!');
        closeSecretaryModal();
        await loadSecretaries();
    } catch (error) {
        alert('Hata: ' + error.message);
        console.error('Secretary creation error:', error);
    }
}

async function deleteSecretary(secretaryId) {
    if (!confirm('Bu sekreteri silmek istediğinize emin misiniz?')) return;
    
    try {
        await db.collection('users').doc(secretaryId).delete();
        await loadSecretaries();
        alert('Sekreter silindi!');
    } catch (error) {
        alert('Hata: ' + error.message);
    }
}

// Setup event listeners for secretary form
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('secretaryForm')) {
        document.getElementById('secretaryForm').addEventListener('submit', saveSecretaryFromForm);
    }
    if (document.getElementById('discountForm')) {
        document.getElementById('discountForm').addEventListener('submit', saveDiscount);
    }
});

// ======================== DISCOUNTS MANAGEMENT ========================

async function loadDiscounts() {
    try {
        const discountsSnap = await db.collection('discounts').where('adminId', '==', currentAdmin.id).get();
        const discounts = discountsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));

        const tbody = document.getElementById('discountsTable');
        tbody.innerHTML = '';

        if (discounts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #95a5a6;">Henüz indirim kodu oluşturulmamış</td></tr>';
            return;
        }

        discounts.forEach(discount => {
            const expiryDate = new Date(discount.expiryDate);
            const now = new Date();
            const isExpired = expiryDate < now;
            const isLimitReached = discount.usageLimit && discount.usageCount >= discount.usageLimit;

            let statusText = 'Aktif';
            let statusClass = 'badge-success';

            if (isExpired) {
                statusText = 'Süresi Dolmuş';
                statusClass = 'badge-danger';
            } else if (isLimitReached) {
                statusText = 'Limit Dolmuş';
                statusClass = 'badge-warning';
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${discount.code}</strong></td>
                <td>%${discount.percentage}</td>
                <td>${expiryDate.toLocaleDateString('tr-TR')}</td>
                <td>${discount.usageLimit || 'Sınırsız'}</td>
                <td>${discount.usageCount || 0}</td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteDiscount('${discount.id}')">Sil</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('İndirim kodları yüklenirken hata:', error);
        alert('İndirim kodları yüklenirken hata: ' + error.message);
    }
}

function openDiscountModal() {
    document.getElementById('discountForm').reset();
    document.getElementById('discountExpiryDate').valueAsDate = new Date();
    document.getElementById('discountModal').classList.add('active');
}

function closeDiscountModal() {
    document.getElementById('discountModal').classList.remove('active');
}

async function saveDiscount(e) {
    e.preventDefault();

    const code = document.getElementById('discountCode').value.trim().toUpperCase();
    const percentage = parseInt(document.getElementById('discountPercentage').value);
    const expiryDate = document.getElementById('discountExpiryDate').value;
    const usageLimit = document.getElementById('discountUsageLimit').value;

    if (!code || !percentage || !expiryDate) {
        alert('Lütfen zorunlu alanları doldurunuz!');
        return;
    }

    if (percentage < 1 || percentage > 100) {
        alert('İndirim yüzdesi 1-100 arasında olmalıdır!');
        return;
    }

    // Check if code already exists
    try {
        const existingDiscount = await db.collection('discounts')
            .where('adminId', '==', currentAdmin.id)
            .where('code', '==', code)
            .get();

        if (!existingDiscount.empty) {
            alert('Bu indirim kodu zaten mevcut!');
            return;
        }

        const discountData = {
            code: code,
            percentage: percentage,
            expiryDate: expiryDate,
            usageLimit: usageLimit ? parseInt(usageLimit) : null,
            usageCount: 0,
            adminId: currentAdmin.id,
            createdAt: new Date().toISOString()
        };

        await db.collection('discounts').add(discountData);
        alert('✓ İndirim kodu başarıyla oluşturuldu!');
        closeDiscountModal();
        await loadDiscounts();
    } catch (error) {
        alert('İndirim kodu kaydedilirken hata: ' + error.message);
        console.error(error);
    }
}

async function deleteDiscount(discountId) {
    if (!confirm('Bu indirim kodunu silmek istediğinize emin misiniz?')) return;

    try {
        await db.collection('discounts').doc(discountId).delete();
        alert('İndirim kodu silindi!');
        await loadDiscounts();
    } catch (error) {
        alert('İndirim kodu silinirken hata: ' + error.message);
    }
}

let allEvents = [];

async function loadEvents() {
    try {
        const eventsSnap = await db.collection('events').where('adminId', '==', currentAdmin.id).get();
        allEvents = eventsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        renderEventsList();
    } catch (error) {
        console.error('Etkinlikler yüklenirken hata:', error);
    }
}

function renderEventsList() {
    const container = document.getElementById('eventsList');
    const branchFilter = document.getElementById('eventBranchFilter').value;
    const timeFilter = document.getElementById('eventTimeFilter').value;

    if (allEvents.length === 0) {
        container.innerHTML = '<p style="color: #999;">Henüz etkinlik kaydı yok.</p>';
        return;
    }

    // Etkinlikleri tarihe göre sırala
    const sortedEvents = [...allEvents].sort((a, b) => {
        return new Date(a.date) - new Date(b.date);
    });

    // Filtre uygula
    const filteredEvents = sortedEvents.filter(event => {
        if (branchFilter && event.branchId !== branchFilter) return false;
        if (timeFilter && event.time !== timeFilter) return false;
        return true;
    });

    let html = '<div>';

    filteredEvents.forEach(event => {
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

        // Şube ve saat bilgilerini göster
        const branch = allBranches.find(b => b.id === event.branchId);
        const branchName = branch ? branch.name : 'Tüm Şubeler';
        const timeDisplay = event.time || 'Tüm Saatler';

        html += `
            <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 15px; border-left: 4px solid #2196f3;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <h3 style="margin: 0 0 10px 0; color: #2196f3;">${typeEmoji} ${event.name}</h3>
                        <p style="margin: 5px 0;"><strong>📅 Tarih:</strong> ${formattedDate}</p>
                        <p style="margin: 5px 0;"><strong>🏢 Şube:</strong> ${branchName}</p>
                        <p style="margin: 5px 0;"><strong>🕒 Saat:</strong> ${timeDisplay}</p>
                        <p style="margin: 5px 0;"><strong>📝 Tür:</strong> ${event.type}</p>
                        <p style="margin: 5px 0;"><strong>📋 Açıklama:</strong> ${event.description || 'Açıklama yok'}</p>
                        ${event.location ? `<p style="margin: 5px 0;"><strong>📍 Konum:</strong> ${event.location}</p>` : ''}
                    </div>
                    <button class="btn btn-danger btn-sm" onclick="deleteEvent('${event.id}')" style="margin-left: 10px;">Sil</button>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

function openEventModal() {
    document.getElementById('eventName').value = '';
    document.getElementById('eventDate').value = '';
    document.getElementById('eventBranch').value = '';
    document.getElementById('eventTime').value = '';
    document.getElementById('eventType').value = '';
    document.getElementById('eventDescription').value = '';
    document.getElementById('eventLocation').value = '';
    document.getElementById('eventModal').style.display = 'flex';
}

function closeEventModal() {
    document.getElementById('eventModal').style.display = 'none';
}

async function saveEvent() {
    const name = document.getElementById('eventName').value.trim();
    const date = document.getElementById('eventDate').value;
    const branchId = document.getElementById('eventBranch').value;
    const time = document.getElementById('eventTime').value;
    const type = document.getElementById('eventType').value;
    const description = document.getElementById('eventDescription').value.trim();
    const location = document.getElementById('eventLocation').value.trim();

    if (!name || !date || !type) {
        alert('Lütfen zorunlu alanları doldurunuz!');
        return;
    }

    try {
        await db.collection('events').add({
            name,
            date,
            branchId: branchId || null,
            time: time || null,
            type,
            description,
            location,
            createdBy: currentAdmin.name,
            createdAt: new Date().toISOString()
        });

        alert('✓ Etkinlik başarıyla kaydedildi!');
        closeEventModal();
        await loadEvents();
    } catch (error) {
        alert('Etkinlik kaydedilirken hata: ' + error.message);
        console.error(error);
    }
}

async function deleteEvent(eventId) {
    if (!confirm('Bu etkinliği silmek istediğinize emin misiniz?')) return;
    
    try {
        await db.collection('events').doc(eventId).delete();
        await loadEvents();
        alert('Etkinlik silindi!');
    } catch (error) {
        alert('Etkinlik silinirken hata: ' + error.message);
    }
}

// ======================== ADMIN MARKET SYSTEM ========================

async function loadAdminMarketProducts() {
    try {
        if (!adminMarketBankSettings) {
            const settingsDoc = await db.collection('app_settings').doc('credit_purchase_bank').get();
            adminMarketBankSettings = settingsDoc.exists ? settingsDoc.data() : null;
        }

        const productsSnap = await db.collection('products').get();
        const products = productsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        allAdminMarketProducts = products;
        displayAdminMarketProducts(products);
    } catch (error) {
        console.error('Ürünler yüklenirken hata:', error);
    }
}

function getAdminCartTotals() {
    return adminMarketCart.reduce((summary, item) => {
        const quantity = Number(item.quantity || 0);
        const unitPrice = Number(item.price || 0);
        summary.itemCount += quantity;
        summary.totalAmount += quantity * unitPrice;
        return summary;
    }, { itemCount: 0, totalAmount: 0 });
}

function addAdminProductToCart(productId) {
    const product = allAdminMarketProducts.find(item => item.id === productId);
    if (!product) {
        alert('Ürün bulunamadı.');
        return;
    }

    const existing = adminMarketCart.find(item => item.id === product.id);
    if (existing) {
        existing.quantity += 1;
    } else {
        adminMarketCart.push({
            id: product.id,
            name: product.name,
            price: Number(product.price || 0),
            quantity: 1
        });
    }
    displayAdminMarketProducts(allAdminMarketProducts);
}

function updateAdminCartQuantity(productId, delta) {
    adminMarketCart = adminMarketCart
        .map(item => item.id === productId ? { ...item, quantity: Math.max(0, Number(item.quantity || 0) + delta) } : item)
        .filter(item => item.quantity > 0);
    displayAdminMarketProducts(allAdminMarketProducts);
}

function removeAdminCartItem(productId) {
    adminMarketCart = adminMarketCart.filter(item => item.id !== productId);
    displayAdminMarketProducts(allAdminMarketProducts);
}

function buildAdminMarketBankInfoHtml(paymentMethod = 'iban') {
    if (paymentMethod === 'credit_card') {
        return `
            <div style="margin-top:12px; padding:14px 16px; border:1px solid #ecd9c3; border-radius:12px; background:#fff9f2; color:#22313f;">
                <div style="font-size:0.82em; letter-spacing:0.05em; color:#9a6025; font-weight:700;">KREDI KARTI BILGILERI</div>
                <input id="adminMarketCardHolder" type="text" placeholder="Kart uzerindeki ad soyad" style="width:100%; margin-top:10px; padding:10px 12px; border:1px solid #d7dee8; border-radius:8px;">
                <input id="adminMarketCardNumber" type="text" inputmode="numeric" maxlength="23" placeholder="Kart numarasi" oninput="this.value = formatAdminMarketCardNumber(this.value)" style="width:100%; margin-top:10px; padding:10px 12px; border:1px solid #d7dee8; border-radius:8px;">
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-top:10px;">
                    <input id="adminMarketCardExpiry" type="text" inputmode="numeric" maxlength="5" placeholder="AA/YY" oninput="this.value = formatAdminMarketCardExpiry(this.value)" style="padding:10px 12px; border:1px solid #d7dee8; border-radius:8px;">
                    <input id="adminMarketCardCvv" type="password" inputmode="numeric" maxlength="4" placeholder="CVV" oninput="this.value = this.value.replace(/\D/g, '').slice(0, 4)" style="padding:10px 12px; border:1px solid #d7dee8; border-radius:8px;">
                </div>
                <div style="margin-top:8px; color:#6f8091; font-size:0.9em;">Guvenlik nedeniyle tam kart numarasi ve CVV siparis kaydina yazilmaz; sadece ozet bilgi tutulur.</div>
            </div>
        `;
    }
    if (paymentMethod !== 'iban' || !adminMarketBankSettings?.iban) {
        return '';
    }

    return `
        <div style="margin-top:12px; padding:14px 16px; border:1px solid #dce8f5; border-radius:12px; background:#f6fbff; color:#22313f;">
            <div style="font-size:0.82em; letter-spacing:0.05em; color:#5e7a96; font-weight:700;">HAVALE / EFT BILGILERI</div>
            <div style="margin-top:8px;"><strong>Banka:</strong> ${adminMarketBankSettings.bankName || '-'}</div>
            <div style="margin-top:4px;"><strong>Hesap Sahibi:</strong> ${adminMarketBankSettings.accountHolder || '-'}</div>
            <div style="margin-top:4px;"><strong>IBAN:</strong> ${adminMarketBankSettings.iban || '-'}</div>
            ${adminMarketBankSettings.note ? `<div style="margin-top:8px;"><strong>Not:</strong> ${adminMarketBankSettings.note}</div>` : ''}
        </div>
    `;
}

function updateAdminMarketBankInfo() {
    const container = document.getElementById('adminMarketBankInfoContainer');
    const paymentMethod = document.getElementById('adminMarketPaymentMethod')?.value || 'iban';
    if (!container) {
        return;
    }
    container.innerHTML = buildAdminMarketBankInfoHtml(paymentMethod);
}

function getAdminMarketCardSnapshot() {
    const holderName = document.getElementById('adminMarketCardHolder')?.value?.trim() || '';
    const cardNumber = normalizeAdminMarketCardNumber(document.getElementById('adminMarketCardNumber')?.value || '');
    const expiry = formatAdminMarketCardExpiry(document.getElementById('adminMarketCardExpiry')?.value || '');
    const cvv = String(document.getElementById('adminMarketCardCvv')?.value || '').replace(/\D/g, '').slice(0, 4);

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
        cardBrandSnapshot: detectAdminMarketCardBrand(cardNumber),
    };
}

function buildAdminCartHtml() {
    const totals = getAdminCartTotals();
    const defaultPhone = currentAdmin?.phone || '';
    const defaultAddress = currentAdmin?.clubAddress || '';
    const selectedPaymentMethod = document.getElementById('adminMarketPaymentMethod')?.value || 'iban';
    return `
        <div style="grid-column: 1/-1; margin-bottom: 20px; border: 1px solid #dce8f5; border-radius: 14px; padding: 18px; background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%); box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);">
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:14px;">
                <div>
                    <h3 style="margin:0; color:#1f3c5a;">Sepet ve Checkout</h3>
                    <p style="margin:6px 0 0; color:#6f8091;">Toplu siparişi tek seferde super admin tarafına gönderin.</p>
                </div>
                <div style="color:#1f3c5a; font-weight:700;">${totals.itemCount} urun | ${formatTryCurrency(totals.totalAmount)}</div>
            </div>
            ${adminMarketCart.length ? adminMarketCart.map(item => `
                <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; padding:12px 0; border-top:1px solid #e7eef6;">
                    <div>
                        <div style="font-weight:700; color:#2c3e50;">${item.name}</div>
                        <div style="color:#6f8091; font-size:0.92em;">${formatTryCurrency(item.price)} x ${item.quantity}</div>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button class="btn btn-primary btn-sm" onclick="updateAdminCartQuantity('${item.id}', -1)">-</button>
                        <button class="btn btn-primary btn-sm" onclick="updateAdminCartQuantity('${item.id}', 1)">+</button>
                        <button class="btn btn-danger btn-sm" onclick="removeAdminCartItem('${item.id}')">Sil</button>
                    </div>
                </div>
            `).join('') : '<div style="padding:14px 0; color:#95a5a6; border-top:1px solid #e7eef6;">Sepetiniz bos.</div>'}
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-top:16px;">
                <input id="adminMarketBuyerPhone" value="${defaultPhone}" placeholder="Telefon" style="padding:10px 12px; border:1px solid #d7dee8; border-radius:8px;">
                <select id="adminMarketPaymentMethod" onchange="updateAdminMarketBankInfo()" style="padding:10px 12px; border:1px solid #d7dee8; border-radius:8px;">
                    <option value="iban" ${selectedPaymentMethod === 'iban' ? 'selected' : ''}>IBAN</option>
                    <option value="credit_card" ${selectedPaymentMethod === 'credit_card' ? 'selected' : ''}>Kredi Karti</option>
                    <option value="cash" ${selectedPaymentMethod === 'cash' ? 'selected' : ''}>Nakit</option>
                </select>
                <select id="adminMarketInstallment" style="padding:10px 12px; border:1px solid #d7dee8; border-radius:8px;">
                    <option value="tek_cekim">Tek cekim</option>
                    <option value="taksitli">Taksitli</option>
                </select>
            </div>
            <div id="adminMarketBankInfoContainer">${buildAdminMarketBankInfoHtml(selectedPaymentMethod)}</div>
            <textarea id="adminMarketShippingAddress" placeholder="Teslimat adresi" style="width:100%; min-height:88px; padding:12px; border:1px solid #d7dee8; border-radius:8px; margin-top:12px;">${defaultAddress}</textarea>
            <textarea id="adminMarketOrderNote" placeholder="Siparis notu" style="width:100%; min-height:76px; padding:12px; border:1px solid #d7dee8; border-radius:8px; margin-top:12px;"></textarea>
            <div style="display:flex; justify-content:flex-end; margin-top:12px;">
                <button class="btn btn-success" onclick="submitAdminMarketCheckout()" ${adminMarketCart.length ? '' : 'disabled'}>Sepeti Siparis Olarak Gonder</button>
            </div>
        </div>
    `;
}

function displayAdminMarketProducts(products) {
    const container = document.getElementById('adminMarketProducts');
    if (!container) return;
    try {
        container.innerHTML = '';
    } catch (error) {
        console.error('Error setting innerHTML:', error);
        return;
    }

    if (products.length === 0) {
        container.innerHTML = `${buildAdminCartHtml()}<p style="text-align: center; color: #95a5a6; grid-column: 1/-1; padding: 40px;">Henüz ürün eklenmemiş</p>`;
        return;
    }

    container.innerHTML = buildAdminCartHtml();

    products.forEach(product => {
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
                <p style="color: #27ae60; font-size: 1.5em; font-weight: bold; margin: 10px 0;">₺${Number(product.price || 0).toFixed(2)}</p>
                ${product.description ? `<p style="color: #666; margin: 10px 0; font-size: 0.9em;">${product.description}</p>` : ''}
                <button class="btn btn-success" onclick="addAdminProductToCart('${product.id}')" style="width: 100%; margin-top: 15px;">
                    🛒 Sepete Ekle
                </button>
            </div>
        `;

        container.appendChild(productCard);
    });
}

async function submitAdminMarketCheckout() {
    if (!adminMarketCart.length) {
        alert('Sepetiniz bos.');
        return;
    }

    const buyerPhone = document.getElementById('adminMarketBuyerPhone')?.value?.trim() || '';
    const shippingAddress = document.getElementById('adminMarketShippingAddress')?.value?.trim() || '';
    const paymentMethod = document.getElementById('adminMarketPaymentMethod')?.value || 'iban';
    const installmentPreference = document.getElementById('adminMarketInstallment')?.value || 'tek_cekim';
    const note = document.getElementById('adminMarketOrderNote')?.value?.trim() || '';

    if (!buyerPhone) {
        alert('Telefon bilgisi gerekli.');
        return;
    }
    if (!shippingAddress) {
        alert('Teslimat adresi gerekli.');
        return;
    }

    const items = adminMarketCart.map(item => ({
        productId: item.id,
        productName: item.name,
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.price || 0),
        lineTotal: Number(item.price || 0) * Number(item.quantity || 1)
    }));
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const orderTitle = items.length === 1
        ? `${items[0].productName}${items[0].quantity > 1 ? ` x${items[0].quantity}` : ''}`
        : `${items[0].productName} +${items.length - 1} urun`;

    try {
        let ibanSnapshot = '';
        let bankNameSnapshot = '';
        let accountHolderSnapshot = '';
        let cardHolderNameSnapshot = '';
        let cardLast4Snapshot = '';
        let cardExpirySnapshot = '';
        let cardBrandSnapshot = '';

        if (paymentMethod === 'iban') {
            if (!adminMarketBankSettings) {
                const settingsDoc = await db.collection('app_settings').doc('credit_purchase_bank').get();
                adminMarketBankSettings = settingsDoc.exists ? settingsDoc.data() : null;
            }
            ibanSnapshot = adminMarketBankSettings?.iban || '';
            bankNameSnapshot = adminMarketBankSettings?.bankName || '';
            accountHolderSnapshot = adminMarketBankSettings?.accountHolder || '';
        } else if (paymentMethod === 'credit_card') {
            const cardSnapshot = getAdminMarketCardSnapshot();
            cardHolderNameSnapshot = cardSnapshot.cardHolderNameSnapshot;
            cardLast4Snapshot = cardSnapshot.cardLast4Snapshot;
            cardExpirySnapshot = cardSnapshot.cardExpirySnapshot;
            cardBrandSnapshot = cardSnapshot.cardBrandSnapshot;
        }

        await db.collection('orders').add({
            type: 'product',
            status: 'pending',
            paymentMethod,
            items,
            itemCount,
            orderTitle,
            totalAmount,
            buyerId: currentAdmin.id,
            buyerName: currentAdmin.name,
            buyerEmail: currentAdmin.email,
            buyerRole: 'admin',
            buyerPhone,
            shippingAddress,
            installmentPreference,
            note,
            adminId: currentAdmin.id,
            ibanSnapshot,
            bankNameSnapshot,
            accountHolderSnapshot,
            cardHolderNameSnapshot,
            cardLast4Snapshot,
            cardExpirySnapshot,
            cardBrandSnapshot,
            createdAt: new Date().toISOString()
        });

        adminMarketCart = [];
        alert(`✓ Siparişiniz başarıyla alındı!\n\nSipariş: ${orderTitle}\nTutar: ${formatTryCurrency(totalAmount)}\n\nSistem yöneticisi tarafından onay bekleniyor.`);
        await loadAdminMarketProducts();
    } catch (error) {
        console.error('Satın alma hatası:', error);
        alert('Satın alma işleminde hata oluştu: ' + error.message);
    }
}

// ======================== ADMIN CHAT SYSTEM ========================

let activeAdminChatId = null;
let adminChatUnsub = null;

// Load chat list when chat page is opened
async function loadAdminChatList() {
    try {
        const container = document.getElementById('adminChatListContainer');
        container.innerHTML = '<p style="color: #95a5a6;">Yükleniyor...</p>';

        // Get all chats where admin is a participant
        const chatsSnap = await db.collection('chats')
            .where('userIds', 'array-contains', currentAdmin.id)
            .get();

        // Sort client-side to avoid composite index requirement
        const chats = chatsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
                title = 'Kredi Satın Alma';
                subtitle = 'Sistem';
            } else {
                // Direct chat: find other participant's name
                const otherId = chat.userIds.find(uid => uid !== currentAdmin.id);
                if (chat.users && chat.users[otherId]) {
                    title = chat.users[otherId].name;
                    subtitle = chat.users[otherId].role === 'trainer' ? 'Antrenör' :
                              chat.users[otherId].role === 'parent' ? 'Veli' :
                              chat.users[otherId].role === 'secretary' ? 'Sekreter' : 'Kullanıcı';
                } else {
                    title = 'Birebir Sohbet';
                    subtitle = 'Kullanıcı';
                }
            }

            html += `<div class="chat-list-item" style="padding: 12px; border-bottom: 1px solid #eee; cursor: pointer; transition: background 0.2s;" onclick="openAdminChatView('${chatId}', '${title.replace(/'/g, '\\\'')}')">
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
        document.getElementById('adminChatListContainer').innerHTML = '<p style="color: #e74c3c;">Sohbetler yüklenemedi.</p>';
    }
}

// Open chat view
function openAdminChatView(chatId, title) {
    // Update the right panel instead of switching pages
    const chatViewContainer = document.getElementById('adminChatViewContainer');
    chatViewContainer.innerHTML = `
        <div style="height: 500px; border: 1px solid #ddd; border-radius: 5px; padding: 15px; background: #f9f9f9; display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h4 style="margin: 0; color: #2c3e50;">💬 ${title}</h4>
                <button class="btn btn-secondary btn-sm" onclick="closeAdminChatView()">✕</button>
            </div>
            <div id="adminChatMessages" style="flex: 1; overflow-y: auto; margin-bottom: 15px; padding: 10px; background: white; border-radius: 5px;">
                <p style="color: #95a5a6; text-align: center;">Mesajlar yükleniyor...</p>
            </div>
            <form id="adminChatForm" style="display: flex; gap: 10px;">
                <input type="text" id="adminChatMessageInput" placeholder="Mesajınızı yazın..." style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 5px;" required>
                <button type="submit" class="btn btn-success">Gönder</button>
            </form>
        </div>
    `;

    activeAdminChatId = chatId;
    loadAdminChatMessages(chatId);

    // Add form event listener
    document.getElementById('adminChatForm').addEventListener('submit', sendAdminChatMessage);
}

// Close chat view and return to chat list
function closeAdminChatView() {
    document.getElementById('admin-chat-view-page').classList.remove('active');
    document.getElementById('chat-page').classList.add('active');

    if (adminChatUnsub) {
        adminChatUnsub();
        adminChatUnsub = null;
    }
    activeAdminChatId = null;
}

// Load chat messages
async function loadAdminChatMessages(chatId) {
    try {
        const messagesContainer = document.getElementById('adminChatMessages');
        messagesContainer.innerHTML = '<p style="color: #95a5a6; text-align: center;">Mesajlar yükleniyor...</p>';

        // Set up real-time listener for messages
        adminChatUnsub = db.collection('chats').doc(chatId).collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot((snapshot) => {
                const messages = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));

                if (messages.length === 0) {
                    messagesContainer.innerHTML = '<p style="color: #95a5a6; text-align: center;">Henüz mesaj yok.</p>';
                    return;
                }

                let html = '';
                messages.forEach(message => {
                    const isOwnMessage = message.senderId === currentAdmin.id;
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
        document.getElementById('adminChatMessages').innerHTML = '<p style="color: #e74c3c; text-align: center;">Mesajlar yüklenemedi.</p>';
    }
}

// Send chat message
async function sendAdminChatMessage(e) {
    e.preventDefault();

    const messageInput = document.getElementById('adminChatMessageInput');
    const messageText = messageInput.value.trim();

    if (!messageText || !activeAdminChatId) return;

    try {
        await db.collection('chats').doc(activeAdminChatId).collection('messages').add({
            text: messageText,
            senderId: currentAdmin.id,
            senderName: currentAdmin.name,
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
    document.getElementById('admin-new-chat-email-page').classList.add('active');

    document.getElementById('adminNewChatEmailForm').addEventListener('submit', submitAdminNewChatByEmail);
    document.getElementById('adminChatEmailInput').addEventListener('input', adminChatEmailLookupUser);
}

// Close new chat email page
function closeAdminNewChatEmailPage() {
    document.getElementById('admin-new-chat-email-page').classList.remove('active');
    document.getElementById('chat-page').classList.add('active');

    document.getElementById('adminNewChatEmailForm').reset();
    document.getElementById('adminChatEmailUserInfo').textContent = '';
}

// Email lookup for new chat
async function adminChatEmailLookupUser(e) {
    const email = e.target.value.trim().toLowerCase();
    const infoDiv = document.getElementById('adminChatEmailUserInfo');
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
async function submitAdminNewChatByEmail(e) {
    e.preventDefault();

    const email = document.getElementById('adminChatEmailInput').value.trim().toLowerCase();
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
        .where('userIds', 'array-contains', currentAdmin.id)
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
            userIds: [currentAdmin.id, userId],
            users: {
                [currentAdmin.id]: { name: currentAdmin.name, role: 'admin' },
                [userId]: { name: userName, role: userRole }
            },
            type: 'direct',
            createdAt: new Date().toISOString()
        });
        chatId = chatDoc.id;
    }

    closeAdminNewChatEmailPage();
    openAdminChatView(chatId, userName);
}

// Open new group chat modal
function openNewGroupChatModal() {
    document.getElementById('adminNewGroupChatModal').style.display = 'flex';
    document.getElementById('adminNewGroupChatForm').addEventListener('submit', submitAdminNewGroupChat);
}

// Close new group chat modal
function closeAdminNewGroupChatModal() {
    document.getElementById('adminNewGroupChatModal').style.display = 'none';
    document.getElementById('adminNewGroupChatForm').reset();
}

function closeAdminGroupManagementModal() {
    const modal = document.getElementById('adminGroupManagementModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.dataset.chatId = '';

    const form = document.getElementById('adminGroupManagementForm');
    if (form) form.reset();
}

async function addAdminGroupMember() {
    const modal = document.getElementById('adminGroupManagementModal');
    const emailInput = document.getElementById('adminGroupAddMemberEmail');
    const chatId = (modal && modal.dataset.chatId) || activeAdminChatId;

    if (!chatId) {
        alert('Lutfen once bir grup sohbeti secin.');
        return;
    }

    const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
    if (!email) {
        alert('Lutfen e-posta giriniz.');
        return;
    }

    try {
        const chatRef = db.collection('chats').doc(chatId);
        const chatSnap = await chatRef.get();
        if (!chatSnap.exists || chatSnap.data().type !== 'group') {
            alert('Secili sohbet bir grup degil.');
            return;
        }

        let foundDoc = null;
        let foundRole = 'user';
        for (const probe of [
            { col: 'users', role: 'user' },
            { col: 'trainers', role: 'trainer' },
            { col: 'parents', role: 'parent' },
            { col: 'admins', role: 'admin' }
        ]) {
            const snap = await db.collection(probe.col).where('email', '==', email).limit(1).get();
            if (!snap.empty) {
                foundDoc = snap.docs[0];
                foundRole = probe.role;
                break;
            }
        }

        if (!foundDoc) {
            alert('Kullanici bulunamadi.');
            return;
        }

        const userData = foundDoc.data() || {};
        const usersMap = chatSnap.data().users || {};
        usersMap[foundDoc.id] = {
            name: userData.name || userData.fullName || email,
            role: userData.role || foundRole,
            email
        };

        await chatRef.update({
            userIds: firebase.firestore.FieldValue.arrayUnion(foundDoc.id),
            userEmails: firebase.firestore.FieldValue.arrayUnion(email),
            users: usersMap
        });

        if (emailInput) emailInput.value = '';
        alert('Uye gruba eklendi.');
    } catch (error) {
        console.error('Gruba uye eklenirken hata:', error);
        alert('Uye eklenemedi: ' + error.message);
    }
}

async function deleteAdminGroup() {
    const modal = document.getElementById('adminGroupManagementModal');
    const chatId = (modal && modal.dataset.chatId) || activeAdminChatId;

    if (!chatId) {
        alert('Silinecek grup secili degil.');
        return;
    }

    if (!confirm('Bu grup sohbeti kalici olarak silinecek. Emin misiniz?')) return;

    try {
        await db.collection('chats').doc(chatId).delete();
        closeAdminGroupManagementModal();
        closeAdminChatView();
        await loadAdminChatList();
        alert('Grup silindi.');
    } catch (error) {
        console.error('Grup silinirken hata:', error);
        alert('Grup silinemedi: ' + error.message);
    }
}

// Submit new group chat
async function submitAdminNewGroupChat(e) {
    e.preventDefault();

    const groupName = document.getElementById('adminGroupChatName').value.trim();
    const emailsRaw = document.getElementById('adminGroupChatUserEmails').value.trim();

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

    // Add current admin's email if not present
    if (!emails.includes(currentAdmin.email)) {
        emails.push(currentAdmin.email);
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
                const data = doc.data();
                userIds.push(doc.id);
                users[doc.id] = {
                    name: data.name || data.fullName || email,
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

        closeAdminNewGroupChatModal();
        openAdminChatView(chatDoc.id, groupName);
        loadAdminChatList(); // Refresh chat list
    } catch (error) {
        console.error('Grup sohbeti oluşturulurken hata:', error);
        alert('Grup sohbeti oluşturulamadı: ' + error.message);
    }
}



// Add event listeners for chat forms
document.addEventListener('DOMContentLoaded', () => {
    // Existing form listeners...

    // Chat form listeners
    const adminChatForm = document.getElementById('adminChatForm');
    if (adminChatForm) {
        adminChatForm.addEventListener('submit', sendAdminChatMessage);
    }
});

// ======================== STANDARDS MANAGEMENT ========================

let expandedAdminStandardGroups = new Set();

function getAdminStandardScope(standard) {
    if (standard.scopeType) return standard.scopeType;
    if (standard.adminId) return 'admin';
    if (standard.trainerId) return 'trainer';
    return 'global';
}

function getAdminTrainerIdentitySet() {
    const trainerIds = new Set();

    allTrainers.forEach(trainer => {
        if (trainer.id) trainerIds.add(trainer.id);
        if (trainer.uid) trainerIds.add(trainer.uid);
    });

    return trainerIds;
}

function isStandardVisibleToAdmin(standard) {
    const scope = getAdminStandardScope(standard);

    if (scope === 'global') {
        return true;
    }

    if (scope === 'admin') {
        return standard.adminId === currentAdmin.id;
    }

    if (scope === 'trainer') {
        return getAdminTrainerIdentitySet().has(standard.trainerId);
    }

    return false;
}

function isStandardEditableByAdmin(standard) {
    return getAdminStandardScope(standard) === 'admin' && standard.adminId === currentAdmin.id;
}

function cleanAdminStandardDocumentTitle(value) {
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

function getAdminReadableStandardTitle(standard) {
    const year = standard.birthYear ? String(standard.birthYear) : '';
    const eventTitle = cleanAdminStandardDocumentTitle(standard.name || standard.groupLabel || '');
    const poolLabel = standard.poolType ? `${standard.poolType} metre` : '';
    const categoryLabel = standard.category ? String(standard.category).toLocaleLowerCase('tr-TR') : '';
    return [year, eventTitle, poolLabel, categoryLabel].filter(Boolean).join(' ').trim();
}

function getAdminStandardMeta(standard) {
    const scope = getAdminStandardScope(standard);
    const scopeLabel = scope === 'global' ? 'Süper Admin' : (scope === 'admin' ? 'Kulüp Barajı' : 'Eski Antrenör Kaydı');
    return scopeLabel;
}

function escapeAdminStandardText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function loadAdminStandards() {
    try {
        const standardsSnap = await db.collection('standards')
            .orderBy('name')
            .get();

        allAdminStandards = standardsSnap.docs
            .map(doc => ({id: doc.id, ...doc.data()}))
            .filter(isStandardVisibleToAdmin);

        displayAdminStandards(allAdminStandards);
    } catch (error) {
        console.error('Barajlar yüklenirken hata:', error);
        const tbody = document.getElementById('adminStandardsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center; color: #e74c3c;">Barajlar yüklenemedi.</td></tr>';
        }
    }
}

function displayAdminStandards(standards) {
    const tbody = document.getElementById('adminStandardsTableBody');
    if (!tbody) return;

    if (standards.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center; color: #95a5a6;">Henüz görüntülenecek baraj yok.</td></tr>';
        return;
    }

    const groupedStandards = new Map();
    standards.forEach(standard => {
        const title = getAdminReadableStandardTitle(standard);
        const meta = getAdminStandardMeta(standard);
        const groupKey = [
            standard.birthYear || '',
            cleanAdminStandardDocumentTitle(standard.name || standard.groupLabel || ''),
            standard.poolType || '',
            standard.category || '',
            getAdminStandardScope(standard),
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
        const isExpanded = expandedAdminStandardGroups.has(group.key);
        html += `
            <tr style="background:#f7fafc; border-bottom:1px solid #dfe7ef; cursor:pointer;" onclick="toggleAdminStandardGroup('${escapeAdminStandardText(group.key)}')">
                <td colspan="7" style="padding:14px 12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
                        <div>
                            <div style="font-weight:700; color:#22313f;">${isExpanded ? '▼' : '►'} ${escapeAdminStandardText(group.title)}</div>
                            <div style="margin-top:4px; font-size:0.85em; color:#6f8091;">${escapeAdminStandardText(group.meta)} • ${group.items.length} kayıt</div>
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
                    const canEdit = isStandardEditableByAdmin(standard);
                    html += `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 12px;">
                                <div style="font-weight: 600; color: #2c3e50;">${escapeAdminStandardText(standard.style)} ${escapeAdminStandardText(standard.distance)}m</div>
                                <div style="margin-top: 4px; font-size: 0.82em; color: #7f8c8d;">${escapeAdminStandardText(standard.gender)}</div>
                            </td>
                            <td style="padding: 12px;">${escapeAdminStandardText(standard.birthYear)}</td>
                            <td style="padding: 12px;">${escapeAdminStandardText(standard.gender)}</td>
                            <td style="padding: 12px;">${escapeAdminStandardText(standard.style)}</td>
                            <td style="padding: 12px;">${escapeAdminStandardText(standard.distance)}m</td>
                            <td style="padding: 12px; text-align: center; font-weight: 600; color: #2980b9;">${escapeAdminStandardText(standard.time)}</td>
                            <td style="padding: 12px; text-align: center;">
                                ${canEdit ? `<button class="btn btn-info btn-sm" onclick="event.stopPropagation(); openAdminEditStandardModal('${standard.id}')">Düzenle</button>
                                <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteAdminStandard('${standard.id}')">Sil</button>` : '<span style="color: #95a5a6; font-size: 0.9em;">Salt okunur</span>'}
                            </td>
                        </tr>
                    `;
                });
        }
    });

    tbody.innerHTML = html;
}

function toggleAdminStandardGroup(groupKey) {
    if (expandedAdminStandardGroups.has(groupKey)) {
        expandedAdminStandardGroups.delete(groupKey);
    } else {
        expandedAdminStandardGroups.add(groupKey);
    }
    filterAdminStandards();
}

function openAdminStandardModal() {
    const modal = document.getElementById('adminStandardModal');
    if (modal) {
        modal.style.display = 'block';
    }

    const form = document.getElementById('adminAddStandardForm');
    if (form) {
        form.reset();
    }
}

function closeAdminStandardModal() {
    const modal = document.getElementById('adminStandardModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function openAdminEditStandardModal(standardId) {
    const standard = allAdminStandards.find(item => item.id === standardId);
    if (!standard || !isStandardEditableByAdmin(standard)) {
        alert('Bu barajı düzenleme yetkiniz yok.');
        return;
    }

    document.getElementById('adminEditStandardId').value = standard.id;
    document.getElementById('adminEditStandardName').value = standard.name || '';
    document.getElementById('adminEditStandardBirthYear').value = standard.birthYear || '';
    document.getElementById('adminEditStandardGender').value = standard.gender || '';
    document.getElementById('adminEditStandardStyle').value = standard.style || '';
    document.getElementById('adminEditStandardDistance').value = standard.distance || '';
    document.getElementById('adminEditStandardTime').value = standard.time || '';
    document.getElementById('adminEditStandardModal').style.display = 'block';
}

function closeAdminEditStandardModal() {
    const modal = document.getElementById('adminEditStandardModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function saveAdminStandard(e) {
    e.preventDefault();

    const standardData = {
        name: document.getElementById('adminStandardName').value.trim(),
        birthYear: Number(document.getElementById('adminStandardBirthYear').value),
        gender: document.getElementById('adminStandardGender').value,
        style: document.getElementById('adminStandardStyle').value,
        distance: Number(document.getElementById('adminStandardDistance').value),
        time: document.getElementById('adminStandardTime').value.trim(),
        scopeType: 'admin',
        adminId: currentAdmin.id,
        createdAt: new Date().toISOString(),
        createdBy: currentAdmin.id,
        createdByRole: 'admin'
    };

    try {
        await db.collection('standards').add(standardData);
        closeAdminStandardModal();
        await loadAdminStandards();
        alert('Baraj kaydedildi. Bu kayıt sadece kulübünüzde görünür.');
    } catch (error) {
        console.error('Baraj kaydedilirken hata:', error);
        alert('Baraj kaydedilirken hata: ' + error.message);
    }
}

async function updateAdminStandard(e) {
    e.preventDefault();

    const standardId = document.getElementById('adminEditStandardId').value;
    const existingStandard = allAdminStandards.find(item => item.id === standardId);

    if (!existingStandard || !isStandardEditableByAdmin(existingStandard)) {
        alert('Bu barajı güncelleme yetkiniz yok.');
        return;
    }

    const standardData = {
        name: document.getElementById('adminEditStandardName').value.trim(),
        birthYear: Number(document.getElementById('adminEditStandardBirthYear').value),
        gender: document.getElementById('adminEditStandardGender').value,
        style: document.getElementById('adminEditStandardStyle').value,
        distance: Number(document.getElementById('adminEditStandardDistance').value),
        time: document.getElementById('adminEditStandardTime').value.trim(),
        scopeType: 'admin',
        adminId: currentAdmin.id,
        updatedAt: new Date().toISOString(),
        updatedBy: currentAdmin.id,
        updatedByRole: 'admin'
    };

    try {
        await db.collection('standards').doc(standardId).update(standardData);
        closeAdminEditStandardModal();
        await loadAdminStandards();
        alert('Baraj güncellendi.');
    } catch (error) {
        console.error('Baraj güncellenirken hata:', error);
        alert('Baraj güncellenirken hata: ' + error.message);
    }
}

async function deleteAdminStandard(standardId) {
    const standard = allAdminStandards.find(item => item.id === standardId);

    if (!standard || !isStandardEditableByAdmin(standard)) {
        alert('Bu barajı silme yetkiniz yok.');
        return;
    }

    if (!confirm('Bu barajı silmek istediğinize emin misiniz?')) {
        return;
    }

    try {
        await db.collection('standards').doc(standardId).delete();
        await loadAdminStandards();
        alert('Baraj silindi.');
    } catch (error) {
        console.error('Baraj silinirken hata:', error);
        alert('Baraj silinirken hata: ' + error.message);
    }
}

function filterAdminStandards() {
    const nameFilter = document.getElementById('adminStandardNameFilter').value.toLowerCase();
    const genderFilter = document.getElementById('adminStandardGenderFilter').value;
    const styleFilter = document.getElementById('adminStandardStyleFilter').value;
    const distanceFilter = document.getElementById('adminStandardDistanceFilter').value;
    const birthYearFilter = document.getElementById('adminStandardBirthYearFilter').value;

    const filtered = allAdminStandards.filter(standard => {
        const matchName = (standard.name || '').toLowerCase().includes(nameFilter);
        const matchGender = !genderFilter || standard.gender === genderFilter;
        const matchStyle = !styleFilter || standard.style === styleFilter;
        const matchDistance = !distanceFilter || String(standard.distance) === distanceFilter;
        const matchBirthYear = !birthYearFilter || String(standard.birthYear) === birthYearFilter;

        return matchName && matchGender && matchStyle && matchDistance && matchBirthYear;
    });

    displayAdminStandards(filtered);
}
