import { collection, getDocs, query, where } from 'firebase/firestore';

import { db } from '../config/firebase';
import { getScheduleDisplayLabel } from '../utils/scheduleDisplay';

export const GOAL_OPTIONS = [
  { key: 'genel', label: 'Genel gelisim' },
  { key: 'teknik', label: 'Teknik' },
  { key: 'sprint', label: 'Sprint' },
  { key: 'dayaniklilik', label: 'Dayaniklilik' },
  { key: 'yaris', label: 'Yaris hazirlik' },
  { key: 'ayak', label: 'Ayak vurusu' },
];

export const LEVEL_OPTIONS = [
  { key: 'beginner', label: 'Yeni baslayan' },
  { key: 'intermediate', label: 'Orta seviye' },
  { key: 'advanced', label: 'Ileri seviye' },
  { key: 'performance', label: 'Performans/Yaris' },
];

export const STYLE_OPTIONS = ['Serbest', 'Sirtustu', 'Kurbagalama', 'Kelebekce', 'Karma'];

const GOAL_LABELS = GOAL_OPTIONS.reduce((acc, item) => {
  acc[item.key] = item.label;
  return acc;
}, {});

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function roundToNearest50(value) {
  return Math.max(200, Math.round(toNumber(value) / 50) * 50);
}

function roundBlockDistance(value, min = 50) {
  return Math.max(min, Math.round(toNumber(value) / 50) * 50);
}

function parsePerformanceTimeToSeconds(value) {
  if (!value) return NaN;
  const text = String(value).trim();
  const minSecCs = text.match(/^(\d{1,2}):(\d{2})\.(\d{1,2})$/);
  if (minSecCs) {
    return Number(minSecCs[1]) * 60 + Number(minSecCs[2]) + Number(minSecCs[3]) / 100;
  }
  const minSec = text.match(/^(\d{1,2}):(\d{2})$/);
  if (minSec) return Number(minSec[1]) * 60 + Number(minSec[2]);
  const secCs = text.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (secCs) return Number(secCs[1]) + Number(secCs[2]) / 100;
  return Number.NaN;
}

function getStudentAgeLocal(student) {
  if (Number.isFinite(Number(student?.birthYear))) {
    return new Date().getFullYear() - Number(student.birthYear);
  }
  if (Number.isFinite(Number(student?.age))) return Number(student.age);
  return Number.NaN;
}

function getAgeBucket(age) {
  if (!Number.isFinite(age)) return '';
  if (age <= 8) return '7-8 yas';
  if (age <= 10) return '9-10 yas';
  if (age <= 12) return '11-12 yas';
  if (age <= 14) return '13-14 yas';
  if (age <= 16) return '15-16 yas';
  return '17+ yas';
}

function buildAgeGroupLabelFromAges(ages) {
  const valid = (ages || []).filter((age) => Number.isFinite(age));
  if (!valid.length) return '';
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  return min === max ? `${min} yas` : `${min}-${max} yas`;
}

function summarizePerformanceRows(performances, typeLabel) {
  const grouped = {};
  performances.forEach((performance) => {
    const style = performance.style || 'Karma';
    const distance = Number(performance.distance) || 0;
    const seconds = parsePerformanceTimeToSeconds(performance.time);
    if (!distance || !Number.isFinite(seconds)) return;
    const key = `${style}_${distance}`;
    if (!grouped[key] || seconds < grouped[key].bestSeconds) {
      grouped[key] = { style, distance, bestSeconds: seconds, bestTime: performance.time, typeLabel };
    }
  });
  return Object.values(grouped).sort((a, b) => a.distance - b.distance || a.bestSeconds - b.bestSeconds).slice(0, 6);
}

function inferLevelKeyFromGroupContext(groupContext) {
  if (!groupContext) return '';
  const avgAge = Number(groupContext.averageAge);
  const competition = groupContext.competitionRows || [];
  const training = groupContext.trainingRows || [];
  if (competition.some((row) => row.distance >= 100 && row.bestSeconds <= 75)) return 'performance';
  if (competition.length >= 2 || training.length >= 4) return 'advanced';
  if (Number.isFinite(avgAge) && avgAge <= 9) return 'beginner';
  return 'intermediate';
}

async function fetchPerformancesForStudents(studentIds) {
  if (!Array.isArray(studentIds) || !studentIds.length) return [];
  const performances = [];
  for (let index = 0; index < studentIds.length; index += 10) {
    const batch = studentIds.slice(index, index + 10);
    const snap = await getDocs(query(collection(db, 'performances'), where('studentId', 'in', batch)));
    snap.forEach((doc) => performances.push({ id: doc.id, ...doc.data() }));
  }
  return performances.sort((left, right) => String(right.date || right.createdAt || '').localeCompare(String(left.date || left.createdAt || '')));
}

export async function buildGroupPerformanceContext({ scheduleId, students, schedules, branches }) {
  if (!scheduleId) return null;
  const matchingStudents = (students || []).filter((student) => student.scheduleId === scheduleId);
  if (!matchingStudents.length) return null;
  const schedule = (schedules || []).find((item) => item.id === scheduleId) || null;
  const branch = (branches || []).find((item) => item.id === schedule?.branchId) || null;
  const performances = await fetchPerformancesForStudents(matchingStudents.map((item) => item.id));
  const ages = matchingStudents.map(getStudentAgeLocal).filter((age) => Number.isFinite(age));
  const normalizedPerformances = performances.map((item) => ({
    ...item,
    type: item.type === 'race' ? 'competition' : (item.type || 'training'),
  }));
  const trainingRows = summarizePerformanceRows(normalizedPerformances.filter((p) => p.type === 'training'), 'Antrenman derecesi');
  const competitionRows = summarizePerformanceRows(normalizedPerformances.filter((p) => p.type === 'competition'), 'Yaris derecesi');
  const averageAge = ages.length ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length) : null;
  const ageGroupLabel = buildAgeGroupLabelFromAges(ages) || (Number.isFinite(averageAge) ? getAgeBucket(averageAge) : '');
  const scheduleLabel = `${branch?.name || 'Sube'} - ${getScheduleDisplayLabel(schedule, branch) || 'Ders'}`;
  return {
    scheduleId,
    scheduleLabel,
    studentCount: matchingStudents.length,
    studentNames: matchingStudents.map((s) => `${s.name || ''} ${s.surname || ''}`.trim()).filter(Boolean).slice(0, 8),
    ages,
    averageAge,
    ageGroupLabel,
    suggestedLevelKey: inferLevelKeyFromGroupContext({ averageAge, trainingRows, competitionRows }),
    trainingRows,
    competitionRows,
    trainingSummaryText: trainingRows.map((row) => `${row.style} ${row.distance}m antrenman ${row.bestTime}`).join(' | '),
    competitionSummaryText: competitionRows.map((row) => `${row.style} ${row.distance}m yaris ${row.bestTime}`).join(' | '),
  };
}

function chooseSupportStyle(focusStyle) {
  if (!focusStyle || focusStyle === 'Karma') return 'Karma';
  if (focusStyle === 'Serbest') return 'Sirtustu';
  if (focusStyle === 'Sirtustu') return 'Serbest';
  return 'Serbest';
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
  if (age <= 8) baseDistance = 850;
  else if (age <= 10) baseDistance = 1150;
  else if (age <= 12) baseDistance = 1500;
  else if (age <= 14) baseDistance = 2000;
  else if (age <= 16) baseDistance = 2400;
  else baseDistance = 2800;
  const levelMultiplier = ({ beginner: 0.8, intermediate: 1, advanced: 1.12, performance: 1.25 })[levelKey] || 1;
  const goalMultiplier = ({ teknik: 0.88, sprint: 0.94, dayaniklilik: 1.15, yaris: 1.08, ayak: 0.84, genel: 1 })[goalKey] || 1;
  return roundToNearest50(baseDistance * (duration / 60) * levelMultiplier * goalMultiplier);
}

function createRepeatedSet(repeat, distance, style, restSeconds, note) {
  return { repeat, distance, style, restSeconds, note };
}

function estimateSetSwimSeconds(distance, levelKey) {
  const pacePer100 = ({ beginner: 125, intermediate: 108, advanced: 95, performance: 82 })[levelKey] || 108;
  return Math.max(20, Math.round((Number(distance) / 100) * pacePer100));
}

function applySessionTimeline(blocks, profile) {
  const sessionDuration = Number(profile.sessionDuration) || 60;
  let usedMinutes = 0;
  blocks.forEach((block) => {
    let blockSwimSeconds = 0;
    let blockRestSeconds = 0;
    block.sets.forEach((set) => {
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

  const scaleFactor = usedMinutes > sessionDuration + 8 ? sessionDuration / usedMinutes : 1;
  if (scaleFactor < 1) {
    blocks.forEach((block) => {
      block.estimatedMinutes = Math.max(1, Math.round(block.estimatedMinutes * scaleFactor));
      block.sets.forEach((set) => {
        set.estimatedMinutes = Math.max(1, Math.round((set.estimatedMinutes || 1) * scaleFactor));
      });
    });
    usedMinutes = blocks.reduce((sum, block) => sum + Number(block.estimatedMinutes || 0), 0);
  }
  return {
    plannedMinutes: usedMinutes,
    targetMinutes: sessionDuration,
    fitsSession: usedMinutes <= sessionDuration + 5,
  };
}

function rebuildExercisesFromBlocks(blocks) {
  const exercises = [];
  blocks.forEach((block) => {
    block.sets.forEach((set) => {
      const repeatCount = Math.max(1, Number(set.repeat) || 1);
      for (let index = 0; index < repeatCount; index += 1) {
        exercises.push({
          distance: Number(set.distance) || 50,
          style: set.style || 'Karma',
          restSeconds: Number(set.restSeconds) || 15,
          estimatedMinutes: set.estimatedMinutes || 1,
          focus: block.title,
          note: set.note || block.focus,
        });
      }
    });
  });
  return exercises;
}

function autoFillProfileFromGroupContext(profile, groupContext) {
  if (!groupContext) return { ...profile };
  const next = { ...profile };
  if (!Number.isFinite(Number(next.age)) && Number.isFinite(Number(groupContext.averageAge))) {
    next.age = Number(groupContext.averageAge);
  }
  if (!next.ageGroupLabel && groupContext.ageGroupLabel) next.ageGroupLabel = groupContext.ageGroupLabel;
  if (!next.levelKey && groupContext.suggestedLevelKey) next.levelKey = groupContext.suggestedLevelKey;
  if (!next.focusStyle && groupContext.trainingRows?.[0]?.style) next.focusStyle = groupContext.trainingRows[0].style;
  const performanceNotes = [
    groupContext.trainingSummaryText ? `Antrenman dereceleri: ${groupContext.trainingSummaryText}` : '',
    groupContext.competitionSummaryText ? `Yaris dereceleri: ${groupContext.competitionSummaryText}` : '',
  ].filter(Boolean).join(' | ');
  next.notes = [next.notes, performanceNotes].filter(Boolean).join(' | ');
  return next;
}

export function buildWorkoutBlocks(profile) {
  const focusStyle = profile.focusStyle || 'Karma';
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
      createRepeatedSet(4, 25, focusStyle, 30, 'Maksimum hiz, cikis ve su alti disiplini'),
    ];
  } else if (goalKey === 'dayaniklilik') {
    mainSets = [
      createRepeatedSet(Math.max(4, Math.round(mainDistance / 200)), 100, focusStyle, aerobicRest, 'Sabit tempo, negatif split bitir'),
      createRepeatedSet(4, 50, supportStyle, 20, 'Teknigi dagitmadan toparla'),
    ];
  } else if (goalKey === 'yaris') {
    mainSets = [
      createRepeatedSet(4, 50, focusStyle, 35, 'Yaris temposu + ilk 15m sert cikis'),
      createRepeatedSet(Math.max(4, Math.round(mainDistance / 100)), 75, focusStyle, 25, 'Pace koru, son 25m ivmelen'),
    ];
  } else if (goalKey === 'ayak') {
    mainSets = [
      createRepeatedSet(Math.max(6, Math.round(mainDistance / 50)), 50, focusStyle, kickRest, 'Board ile ayak ritmi ve denge'),
      createRepeatedSet(4, 25, supportStyle, 20, 'Ayak bitisinde hizli toparlama'),
    ];
  } else if (goalKey === 'teknik') {
    mainSets = [
      createRepeatedSet(6, 50, focusStyle, 20, 'Drill + yuzus kombinasyonu'),
      createRepeatedSet(Math.max(4, Math.round(mainDistance / 100)), 75, focusStyle, 25, 'Uzun kulac, ritim ve nefes zamani'),
    ];
  } else {
    mainSets = [
      createRepeatedSet(Math.max(4, Math.round(mainDistance / 100)), 100, focusStyle, aerobicRest, 'Kontrollu tempo ve duzenli cikis'),
      createRepeatedSet(4, 50, supportStyle, 20, 'Ritim bozmadan teknik odak'),
    ];
  }

  const blocks = [
    {
      title: 'Isinma',
      focus: 'Nabzi ac, eklemleri hazirla ve ilk teknik temaslari oturt.',
      sets: [
        createRepeatedSet(Math.max(2, Math.round(warmupDistance / 200)), 100, focusStyle === 'Karma' ? 'Serbest' : focusStyle, 15, 'Rahat tempo, uzun kulac'),
        createRepeatedSet(2, 50, supportStyle, 15, 'Sirt pozisyonu ve omuz acisi'),
      ],
    },
    {
      title: 'Teknik blok',
      focus: goalKey === 'sprint' ? 'Teknigi hiz bozulmadan tut.' : 'Temel teknik dokunuslari duzelt ve verimliligi artir.',
      sets: [
        createRepeatedSet(Math.max(4, Math.round(techniqueDistance / 100)), 50, focusStyle, 20, 'Drill ve farkindalik odagi'),
        createRepeatedSet(4, 25, focusStyle, 20, 'Kayis ve su tutusu'),
      ],
    },
    {
      title: 'Ana set',
      focus: goalKey === 'dayaniklilik' ? 'Uzayan setlerde tempo kaybetme.' : goalKey === 'sprint' ? 'Kisa mesafede kalite ve cikis gucu.' : 'Ana hedefe gore yuklenme.',
      sets: mainSets,
    },
    {
      title: 'Destek seti',
      focus: goalKey === 'ayak' ? 'Ayak vurusu ve core dengeyi bir arada tut.' : 'Yorgunluk altinda teknigi koru.',
      sets: [
        createRepeatedSet(Math.max(4, Math.round(supportDistance / 100)), 50, supportStyle, kickRest, goalKey === 'ayak' ? 'Kick baskin' : 'Teknik dengeleme'),
        createRepeatedSet(2, 50, 'Karma', 20, 'Kontrollu gecis'),
      ],
    },
    {
      title: 'Soguma',
      focus: 'Nabzi indir, hareket araligini koru ve seansi toparla.',
      sets: [
        createRepeatedSet(Math.max(2, Math.round(cooldownDistance / 100)), 50, supportStyle, 15, 'Rahat tempo'),
        createRepeatedSet(2, 25, 'Serbest', 15, 'Uzun nefes ve gevseme'),
      ],
    },
  ];

  const timeline = applySessionTimeline(blocks, profile);
  const exercises = rebuildExercisesFromBlocks(blocks);
  return {
    blocks,
    exercises,
    totalDistance: exercises.reduce((sum, exercise) => sum + Number(exercise.distance || 0), 0),
    focusStyle,
    timeline,
  };
}

export function buildOlympicCoachingNotes(profile, groupContext, timeline) {
  return [
    'Olimpiyat seviyesi yuzme kocu modu: grup performans verisi + kural tabanli plan birlestirildi.',
    groupContext
      ? `Secilen grup: ${groupContext.scheduleLabel} | ${groupContext.studentCount} sporcu | ${groupContext.ageGroupLabel || 'yas grubu belirleniyor'}`
      : 'Grup secilmedi: genel plan uretildi.',
    groupContext?.trainingRows?.length
      ? `Antrenman derecesi ozeti: ${groupContext.trainingRows.map((row) => `${row.style} ${row.distance}m ${row.bestTime}`).join(', ')}`
      : '',
    groupContext?.competitionRows?.length
      ? `Yaris derecesi ozeti: ${groupContext.competitionRows.map((row) => `${row.style} ${row.distance}m ${row.bestTime}`).join(', ')}`
      : '',
    timeline ? `Sure plani: ${timeline.plannedMinutes} dk / hedef ${timeline.targetMinutes} dk` : '',
    profile.notes ? `Ek not: ${profile.notes}` : '',
  ].filter(Boolean);
}

export async function generateAiWorkoutPlan({ profile, scheduleId, students, schedules, branches }) {
  let groupContext = null;
  if (scheduleId) {
    groupContext = await buildGroupPerformanceContext({ scheduleId, students, schedules, branches });
  }
  const enrichedProfile = autoFillProfileFromGroupContext({ ...profile }, groupContext);
  const { blocks, exercises, totalDistance, focusStyle, timeline } = buildWorkoutBlocks(enrichedProfile);
  const ageLabel = enrichedProfile.ageGroupLabel || (Number.isFinite(Number(enrichedProfile.age)) ? `${enrichedProfile.age} yas` : 'Karma');
  const goalLabel = GOAL_LABELS[enrichedProfile.goalKey] || 'Genel';
  const name = `${ageLabel} ${focusStyle || 'Karma'} ${goalLabel} antrenmani`;
  return {
    name,
    createdAt: new Date().toISOString(),
    profile: { ...enrichedProfile, focusStyle },
    groupContext,
    totalDistance,
    exercises,
    workoutBlocks: blocks,
    sessionTimeline: timeline,
    coachingNotes: buildOlympicCoachingNotes(enrichedProfile, groupContext, timeline),
  };
}

export function planToWorkoutBuilderBlocks(plan) {
  return (plan?.workoutBlocks || []).map((block, index) => ({
    name: block.title || `Blok ${index + 1}`,
    repeatCount: 1,
    roundRestSeconds: 0,
    exercises: (block.sets || []).map((set) => ({
      distance: String(set.distance || 50),
      style: set.style || 'Karma',
      reps: String(Math.max(1, Number(set.repeat) || 1)),
      intervalSeconds: String(Math.max(20, estimateSetSwimSeconds(set.distance, plan.profile?.levelKey) + Number(set.restSeconds || 15))),
      restEnabled: Number(set.restSeconds || 0) > 0,
      restSeconds: String(Math.max(0, Number(set.restSeconds || 15))),
    })),
  }));
}
