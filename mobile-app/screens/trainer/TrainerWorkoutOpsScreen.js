import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import { theme } from '../../config/theme';
import {
  approveWorkoutOffer,
  buyWorkoutSale,
  deletePurchasedWorkoutLibraryItem,
  deleteWorkoutCascade,
  getTrainerCommerceOverview,
  removeWorkoutSale,
  saveWorkout,
  sellWorkout,
  startWorkoutSellerChat,
  submitWorkoutOffer,
  updateWorkout,
} from '../../services/trainerService';
import {
  GOAL_OPTIONS as AI_GOAL_OPTIONS,
  LEVEL_OPTIONS as AI_LEVEL_OPTIONS,
  STYLE_OPTIONS as AI_STYLE_OPTIONS,
  generateAiWorkoutPlan,
  planToWorkoutBuilderBlocks,
} from '../../services/aiWorkoutService';
import { useAuthStore } from '../../store/authStore';

const strokeOptions = ['Serbest', 'Sirt', 'Kurbaga', 'Kelebek', 'Karisik'];

let builderSequence = 0;

function createBuilderId(prefix) {
  builderSequence += 1;
  return `${prefix}-${builderSequence}`;
}

function toSafeNumber(value, fallback = 0) {
  const normalized = typeof value === 'string' ? value.replace(',', '.') : value;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(toSafeNumber(totalSeconds, 0)));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function initialExercise(overrides = {}) {
  const restSeconds = Math.max(0, toSafeNumber(overrides.restSeconds, 20));
  return {
    id: createBuilderId('exercise'),
    distance: String(overrides.distance ?? '50'),
    style: overrides.style || 'Serbest',
    reps: String(overrides.reps ?? '6'),
    intervalSeconds: String(overrides.intervalSeconds ?? '35'),
    restEnabled: overrides.restEnabled ?? restSeconds > 0,
    restSeconds: String(restSeconds),
  };
}

function initialWorkoutBlock(overrides = {}) {
  const sourceExercises = Array.isArray(overrides.exercises) && overrides.exercises.length
    ? overrides.exercises
    : [initialExercise()];

  return {
    id: createBuilderId('block'),
    name: overrides.name || '',
    repeatCount: String(overrides.repeatCount ?? '1'),
    roundRestSeconds: String(overrides.roundRestSeconds ?? '0'),
    exercises: sourceExercises.map((exercise) => initialExercise(exercise)),
  };
}

function sanitizeBuilderExercise(exercise) {
  return {
    distance: Math.max(0, toSafeNumber(exercise.distance, 0)),
    style: String(exercise.style || 'Serbest').trim() || 'Serbest',
    reps: Math.max(1, toSafeNumber(exercise.reps, 1)),
    intervalSeconds: Math.max(1, toSafeNumber(exercise.intervalSeconds, 30)),
    restSeconds: exercise.restEnabled === false ? 0 : Math.max(0, toSafeNumber(exercise.restSeconds, 0)),
  };
}

function flattenWorkoutBlocks(blocks) {
  const normalizedBlocks = (blocks || [])
    .map((block, blockIndex) => {
      const exercises = (block.exercises || [])
        .map((exercise) => sanitizeBuilderExercise(exercise))
        .filter((exercise) => exercise.distance > 0 && exercise.intervalSeconds > 0);

      if (!exercises.length) {
        return null;
      }

      return {
        name: String(block.name || `Blok ${blockIndex + 1}`).trim(),
        repeatCount: Math.max(1, toSafeNumber(block.repeatCount, 1)),
        roundRestSeconds: Math.max(0, toSafeNumber(block.roundRestSeconds, 0)),
        exercises,
      };
    })
    .filter(Boolean);

  const exercises = [];
  normalizedBlocks.forEach((block) => {
    for (let repeatIndex = 0; repeatIndex < block.repeatCount; repeatIndex += 1) {
      block.exercises.forEach((exercise, exerciseIndex) => {
        const isLastExerciseOfRound = exerciseIndex === block.exercises.length - 1;
        const hasNextRound = repeatIndex < block.repeatCount - 1;
        exercises.push({
          ...exercise,
          restSeconds: exercise.restSeconds + (isLastExerciseOfRound && hasNextRound ? block.roundRestSeconds : 0),
        });
      });
    }
  });

  return { workoutBlocks: normalizedBlocks, exercises };
}

function buildWorkoutBlocksFromWorkout(workout) {
  if (Array.isArray(workout?.workoutBlocks) && workout.workoutBlocks.length) {
    return workout.workoutBlocks.map((block) => initialWorkoutBlock(block));
  }

  if (Array.isArray(workout?.exercises) && workout.exercises.length) {
    return [initialWorkoutBlock({ name: 'Blok 1', exercises: workout.exercises, repeatCount: 1, roundRestSeconds: 0 })];
  }

  return [initialWorkoutBlock()];
}

function summarizeWorkoutBuilder(payload) {
  return {
    totalBlocks: payload.workoutBlocks.length,
    totalRows: payload.exercises.length,
    totalDistance: payload.exercises.reduce(
      (sum, exercise) => sum + ((Number(exercise.distance) || 0) * (Number(exercise.reps) || 0)),
      0,
    ),
  };
}

function formatExerciseLine(exercise) {
  return `${exercise.reps || 1} x ${exercise.distance}m ${exercise.style || '-'} | Tempo ${formatDuration(exercise.intervalSeconds)} | Dinlenme ${formatDuration(exercise.restSeconds)}`;
}

function formatWorkoutBlockSummary(block, index) {
  const repeatCount = Math.max(1, toSafeNumber(block.repeatCount, 1));
  const roundRestSeconds = Math.max(0, toSafeNumber(block.roundRestSeconds, 0));
  const blockDistance = (block.exercises || []).reduce(
    (sum, exercise) => sum + (Math.max(0, toSafeNumber(exercise.distance, 0)) * Math.max(1, toSafeNumber(exercise.reps, 1))),
    0,
  ) * repeatCount;
  const blockLabel = block.name ? `Blok ${index + 1} - ${block.name}` : `Blok ${index + 1}`;
  return `${blockLabel}: ${repeatCount} tekrar, ${blockDistance}m toplam, tur arasi ${formatDuration(roundRestSeconds)}`;
}

function buildWorkoutPreviewLines(workout, limit = 3) {
  return buildWorkoutBlocksFromWorkout(workout)
    .slice(0, limit)
    .map((block, index) => formatWorkoutBlockSummary(block, index));
}

function buildWorkoutPdfHtml(workout, options = {}) {
  const blocks = buildWorkoutBlocksFromWorkout(workout).map((block) => ({
    ...block,
    repeatCount: Math.max(1, toSafeNumber(block.repeatCount, 1)),
    roundRestSeconds: Math.max(0, toSafeNumber(block.roundRestSeconds, 0)),
    exercises: (block.exercises || []).map((exercise) => sanitizeBuilderExercise(exercise)),
  }));
  const flattened = flattenWorkoutBlocks(blocks);
  const summary = summarizeWorkoutBuilder(flattened);
  const rows = blocks.map((block, blockIndex) => (
    (block.exercises || []).map((exercise, exerciseIndex) => `
      <tr>
        <td style="padding: 12px; border: 1px solid #dbe7f3; text-align: center; font-weight: 700;">${blockIndex + 1}</td>
        <td style="padding: 12px; border: 1px solid #dbe7f3; text-align: left;">${block.name || `Blok ${blockIndex + 1}`}</td>
        <td style="padding: 12px; border: 1px solid #dbe7f3; text-align: center;">${block.repeatCount}</td>
        <td style="padding: 12px; border: 1px solid #dbe7f3; text-align: center;">${exercise.reps || 1}</td>
        <td style="padding: 12px; border: 1px solid #dbe7f3; text-align: center;">${exercise.distance || '-'}</td>
        <td style="padding: 12px; border: 1px solid #dbe7f3; text-align: center;">${exercise.style || '-'}</td>
        <td style="padding: 12px; border: 1px solid #dbe7f3; text-align: center;">${formatDuration(exercise.intervalSeconds)}</td>
        <td style="padding: 12px; border: 1px solid #dbe7f3; text-align: center;">${formatDuration(exercise.restSeconds)}</td>
        <td style="padding: 12px; border: 1px solid #dbe7f3; text-align: center;">${exerciseIndex === block.exercises.length - 1 && block.roundRestSeconds > 0 ? formatDuration(block.roundRestSeconds) : '-'}</td>
      </tr>
    `)
  )).join('');

  return `
    <html>
      <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; background: #f2f7fc; color: #1f2937;">
        <div style="padding: 28px;">
          <div style="background: linear-gradient(135deg, #0b63a7 0%, #1f9bd1 100%); color: #fff; border-radius: 16px; padding: 20px 22px; margin-bottom: 16px;">
            <div style="font-size: 12px; font-weight: 800; letter-spacing: 1px; opacity: 0.9;">TRAINER WORKOUT PDF</div>
            <h1 style="margin: 8px 0 0; font-size: 30px; line-height: 1.2;">${workout.name || workout.workoutName || 'Workout'}</h1>
          </div>
          <div style="display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 180px; background: #ffffff; border: 1px solid #dbe7f3; border-radius: 12px; padding: 12px;">
              <div style="font-size: 12px; color: #62778f;">Toplam mesafe</div>
              <div style="font-size: 24px; font-weight: 800; color: #10406b;">${summary.totalDistance}m</div>
            </div>
            <div style="flex: 1; min-width: 180px; background: #ffffff; border: 1px solid #dbe7f3; border-radius: 12px; padding: 12px;">
              <div style="font-size: 12px; color: #62778f;">Ders grubu</div>
              <div style="font-size: 18px; font-weight: 800; color: #10406b;">${options.scheduleLabel || '-'}</div>
            </div>
            <div style="flex: 1; min-width: 180px; background: #ffffff; border: 1px solid #dbe7f3; border-radius: 12px; padding: 12px;">
              <div style="font-size: 12px; color: #62778f;">Olusturma</div>
              <div style="font-size: 18px; font-weight: 800; color: #10406b;">${new Date().toLocaleDateString('tr-TR')}</div>
            </div>
          </div>
          <table style="width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #dbe7f3;">
            <thead>
              <tr style="background: #ecf5ff; color: #0f426d;">
                <th style="padding: 12px; border: 1px solid #dbe7f3;">Blok</th>
                <th style="padding: 12px; border: 1px solid #dbe7f3;">Plan</th>
                <th style="padding: 12px; border: 1px solid #dbe7f3;">Tekrar</th>
                <th style="padding: 12px; border: 1px solid #dbe7f3;">Tur</th>
                <th style="padding: 12px; border: 1px solid #dbe7f3;">Mesafe</th>
                <th style="padding: 12px; border: 1px solid #dbe7f3;">Stil</th>
                <th style="padding: 12px; border: 1px solid #dbe7f3;">Tempo</th>
                <th style="padding: 12px; border: 1px solid #dbe7f3;">Egzersiz sonu dinlenme</th>
                <th style="padding: 12px; border: 1px solid #dbe7f3;">Tur sonu dinlenme</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin-top: 14px; color: #64748b; font-size: 12px;">Tempo ve dinlenme sureleri dakika:saniye formatinda gosterilir.</p>
        </div>
      </body>
    </html>
  `;
}

export default function TrainerWorkoutOpsScreen({ navigation }) {
  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();
  const commerceQuery = useQuery({
    queryKey: ['tr-commerce', profile?.uid],
    queryFn: () => getTrainerCommerceOverview(profile),
    enabled: Boolean(profile?.uid),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const [workoutName, setWorkoutName] = useState('');
  const [editingWorkoutId, setEditingWorkoutId] = useState('');
  const [scheduleId, setScheduleId] = useState('');
  const [workoutBlocks, setWorkoutBlocks] = useState([initialWorkoutBlock()]);
  const [sellValues, setSellValues] = useState({ workoutId: '', name: '', description: '', ageGroup: '', target: '', style: 'Karma', distance: 'Karma', workoutType: 'general', credit: '' });
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [approvalPrices, setApprovalPrices] = useState({});
  const [aiProfile, setAiProfile] = useState({
    goalKey: 'genel',
    levelKey: 'intermediate',
    focusStyle: 'Karma',
    sessionDuration: '60',
    age: '',
    notes: '',
  });
  const [aiPlan, setAiPlan] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);

  useEffect(() => {
    if (commerceQuery.data?.schedules?.length && !scheduleId) {
      setScheduleId(commerceQuery.data.schedules[0].id);
    }
  }, [commerceQuery.data, scheduleId]);

  useEffect(() => {
    if (commerceQuery.data?.workouts?.length && !sellValues.workoutId) {
      const workout = commerceQuery.data.workouts[0];
      setSellValues((current) => ({ ...current, workoutId: workout.id, name: workout.name || '' }));
    }
  }, [commerceQuery.data, sellValues.workoutId]);

  useEffect(() => {
    if (commerceQuery.data?.marketSales?.length && !selectedSaleId) {
      setSelectedSaleId(commerceQuery.data.marketSales[0].id);
    }
  }, [commerceQuery.data, selectedSaleId]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['tr-commerce', profile.uid] });
    queryClient.invalidateQueries({ queryKey: ['tr-dashboard', profile.uid] });
  }

  function resetWorkoutBuilder() {
    setWorkoutName('');
    setEditingWorkoutId('');
    setWorkoutBlocks([initialWorkoutBlock()]);
  }

  const workoutBuilderPayload = useMemo(() => flattenWorkoutBlocks(workoutBlocks), [workoutBlocks]);
  const workoutBuilderSummary = useMemo(() => summarizeWorkoutBuilder(workoutBuilderPayload), [workoutBuilderPayload]);

  const workoutMutation = useMutation({
    mutationFn: ({ name }) => {
      const payload = {
        profile,
        name,
        scheduleId,
        exercises: workoutBuilderPayload.exercises,
        workoutBlocks: workoutBuilderPayload.workoutBlocks,
      };

      if (editingWorkoutId) {
        return updateWorkout({ ...payload, workoutId: editingWorkoutId });
      }

      return saveWorkout(payload);
    },
    onSuccess: () => {
      resetWorkoutBuilder();
      invalidate();
    },
    onError: (error) => Alert.alert('Workout', error.message || 'Workout kaydedilemedi.'),
  });

  async function handleCreateWorkout() {
    if (!scheduleId) {
      Alert.alert('Eksik bilgi', 'Lutfen once bir ders grubu secin.');
      return;
    }

    if (!Array.isArray(workoutBuilderPayload.exercises) || !workoutBuilderPayload.exercises.length) {
      Alert.alert('Eksik bilgi', 'En az bir gecerli blok veya egzersiz olmadan kaydedemezsiniz.');
      return;
    }

    const normalizedName = workoutName.trim();
    if (!normalizedName) {
      Alert.alert('Workout adi gerekli', 'Workout adini yazmadan kaydetme yapamazsiniz.');
      return;
    }

    try {
      await workoutMutation.mutateAsync({ name: normalizedName });
      Alert.alert('Basarili', editingWorkoutId ? 'Workout guncellendi.' : 'Workout kaydedildi.');
    } catch (error) {
      Alert.alert('Kaydetme hatasi', error?.message || 'Workout kaydedilemedi.');
    }
  }

  const deleteWorkoutMutation = useMutation({
    mutationFn: deleteWorkoutCascade,
    onSuccess: invalidate,
    onError: (error) => Alert.alert('Workout', error.message || 'Workout silinemedi.'),
  });

  const sellWorkoutMutation = useMutation({
    mutationFn: () => sellWorkout({ profile, ...sellValues }),
    onSuccess: () => {
      setSellValues({ workoutId: '', name: '', description: '', ageGroup: '', target: '', style: 'Karma', distance: 'Karma', workoutType: 'general', credit: '' });
      invalidate();
    },
    onError: (error) => Alert.alert('Satis', error.message || 'Workout satisa cikarilamadi.'),
  });

  const removeSaleMutation = useMutation({ mutationFn: removeWorkoutSale, onSuccess: invalidate });
  const removeLibraryMutation = useMutation({
    mutationFn: ({ libraryItemId }) => deletePurchasedWorkoutLibraryItem({ profile, libraryItemId }),
    onSuccess: invalidate,
    onError: (error) => Alert.alert('Kutuphane', error.message || 'Satin alinan workout silinemedi.'),
  });
  const selectedMarketSale = useMemo(
    () => (commerceQuery.data?.marketSales || []).find((item) => item.id === selectedSaleId) || (commerceQuery.data?.marketSales || [])[0] || null,
    [commerceQuery.data?.marketSales, selectedSaleId],
  );
  const offerMutation = useMutation({
    mutationFn: () => submitWorkoutOffer({ profile, saleId: selectedMarketSale?.id, offer: offerAmount, message: offerMessage }),
    onSuccess: () => {
      setOfferAmount('');
      setOfferMessage('');
      invalidate();
    },
    onError: (error) => Alert.alert('Pazarlik', error.message || 'Teklif gonderilemedi.'),
  });
  const buyMutation = useMutation({
    mutationFn: ({ saleId }) => buyWorkoutSale({ profile, saleId }),
    onMutate: async ({ saleId }) => {
      const key = ['tr-commerce', profile.uid];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (current) => {
        if (!current) return current;
        const sales = Array.isArray(current.marketSales) ? current.marketSales : [];
        const sale = sales.find((item) => item.id === saleId);
        if (!sale) return current;

        const specialOffer = sale.specialOffers?.[profile.uid] && sale.specialOffers[profile.uid].status === 'accepted'
          ? sale.specialOffers[profile.uid]
          : null;
        const finalPrice = Number(specialOffer ? specialOffer.price : sale.credit) || 0;

        const optimisticLibraryItem = {
          id: `optimistic_${Date.now()}_${saleId}`,
          buyerId: profile.uid,
          buyerName: profile.name,
          sellerId: sale.sellerId,
          sellerName: sale.sellerName,
          workoutSaleId: saleId,
          workoutName: sale.name,
          ageGroup: sale.ageGroup,
          target: sale.target,
          style: sale.style,
          distance: sale.distance,
          workoutType: sale.workoutType,
          exercises: Array.isArray(sale.exercises) ? sale.exercises : [],
          workoutBlocks: Array.isArray(sale.workoutBlocks) ? sale.workoutBlocks : [],
          price: finalPrice,
          purchasedAt: new Date().toISOString(),
          contentIncluded: true,
          contentLockedUntilPurchase: false,
        };

        return {
          ...current,
          creditBalance: Math.max(0, Number(current.creditBalance || 0) - finalPrice),
          workoutLibrary: [optimisticLibraryItem, ...(Array.isArray(current.workoutLibrary) ? current.workoutLibrary : [])],
        };
      });
      return { key, previous };
    },
    onSuccess: invalidate,
    onError: (error, _variables, context) => {
      if (context?.key && typeof context.previous !== 'undefined') {
        queryClient.setQueryData(context.key, context.previous);
      }
      Alert.alert('Satin alma', error.message || 'Workout satin alinamadi.');
    },
    onSettled: () => invalidate(),
  });
  const approveMutation = useMutation({ mutationFn: approveWorkoutOffer, onSuccess: invalidate, onError: (error) => Alert.alert('Onay', error.message || 'Ozel fiyat kaydedilemedi.') });
  const chatMutation = useMutation({
    mutationFn: ({ saleId }) => startWorkoutSellerChat({ profile, saleId }),
    onSuccess: (chat) => navigation.navigate('ChatDetail', { chat }),
    onError: (error) => Alert.alert('Sohbet', error.message || 'Sohbet acilamadi.'),
  });

  if (commerceQuery.isLoading) {
    return <LoadingBlock label="Workout ve market modulu yukleniyor..." />;
  }

  if (commerceQuery.isError) {
    return (
      <ScreenLayout title="Antrenman ve Market" subtitle="Veri alinirken hata olustu. Ekran simdi guvenli hata durumunu gosteriyor.">
        <EmptyState
          title="Antrenman modulu acilamadi"
          description={commerceQuery.error?.message || 'Workout, market veya kredi verileri okunurken hata olustu.'}
        />
        <ActionButton label="Tekrar Dene" onPress={() => commerceQuery.refetch()} fullWidth />
      </ScreenLayout>
    );
  }

  const data = {
    branches: commerceQuery.data?.branches || [],
    schedules: commerceQuery.data?.schedules || [],
    workouts: commerceQuery.data?.workouts || [],
    mySales: commerceQuery.data?.mySales || [],
    marketSales: commerceQuery.data?.marketSales || [],
    workoutLibrary: commerceQuery.data?.workoutLibrary || [],
    creditBalance: commerceQuery.data?.creditBalance || 0,
    blockedCredits: commerceQuery.data?.blockedCredits || 0,
  };

  function updateBlock(blockId, field, value) {
    setWorkoutBlocks((current) => current.map((block) => (block.id === blockId ? { ...block, [field]: value } : block)));
  }

  function updateExercise(blockId, exerciseId, field, value) {
    setWorkoutBlocks((current) => current.map((block) => {
      if (block.id !== blockId) return block;
      return {
        ...block,
        exercises: block.exercises.map((exercise) => (exercise.id === exerciseId ? { ...exercise, [field]: value } : exercise)),
      };
    }));
  }

  function toggleExerciseRest(blockId, exerciseId) {
    setWorkoutBlocks((current) => current.map((block) => {
      if (block.id !== blockId) return block;
      return {
        ...block,
        exercises: block.exercises.map((exercise) => {
          if (exercise.id !== exerciseId) return exercise;
          const restEnabled = !exercise.restEnabled;
          return {
            ...exercise,
            restEnabled,
            restSeconds: restEnabled ? (exercise.restSeconds || '20') : '0',
          };
        }),
      };
    }));
  }

  function addWorkoutBlock() {
    setWorkoutBlocks((current) => [...current, initialWorkoutBlock({ name: `Blok ${current.length + 1}` })]);
  }

  function duplicateWorkoutBlock(blockId) {
    setWorkoutBlocks((current) => {
      const block = current.find((item) => item.id === blockId);
      if (!block) return current;
      return [...current, initialWorkoutBlock({
        name: block.name,
        repeatCount: block.repeatCount,
        roundRestSeconds: block.roundRestSeconds,
        exercises: block.exercises,
      })];
    });
  }

  function removeWorkoutBlock(blockId) {
    setWorkoutBlocks((current) => (current.length === 1 ? current : current.filter((block) => block.id !== blockId)));
  }

  function addExercise(blockId) {
    setWorkoutBlocks((current) => current.map((block) => (
      block.id === blockId
        ? { ...block, exercises: [...block.exercises, initialExercise()] }
        : block
    )));
  }

  function removeExercise(blockId, exerciseId) {
    setWorkoutBlocks((current) => current.map((block) => {
      if (block.id !== blockId || block.exercises.length === 1) {
        return block;
      }
      return {
        ...block,
        exercises: block.exercises.filter((exercise) => exercise.id !== exerciseId),
      };
    }));
  }

  function startEditingWorkout(workout) {
    setEditingWorkoutId(workout.id);
    setWorkoutName(workout.name || '');
    setScheduleId(workout.scheduleId || data.schedules[0]?.id || '');
    setWorkoutBlocks(buildWorkoutBlocksFromWorkout(workout));
  }

  function setApprovalValue(key, value) {
    setApprovalPrices((current) => ({ ...current, [key]: value }));
  }

  function scheduleLabel(scheduleIdValue) {
    const schedule = data.schedules.find((item) => item.id === scheduleIdValue);
    const branch = data.branches.find((item) => item.id === schedule?.branchId);
    return schedule ? `${branch?.name || 'Sube'} | ${schedule.time || '-'}` : '-';
  }

  async function handleAiGenerate() {
    setAiGenerating(true);
    try {
      const profilePayload = {
        goalKey: aiProfile.goalKey,
        levelKey: aiProfile.levelKey,
        focusStyle: aiProfile.focusStyle,
        sessionDuration: Number(aiProfile.sessionDuration) || 60,
        age: aiProfile.age ? Number(aiProfile.age) : null,
        notes: aiProfile.notes || '',
      };
      const plan = await generateAiWorkoutPlan({
        profile: profilePayload,
        scheduleId,
        students: commerceQuery.data?.students || [],
        schedules: commerceQuery.data?.schedules || [],
        branches: commerceQuery.data?.branches || [],
      });
      setAiPlan(plan);
    } catch (error) {
      Alert.alert('AI Plani', error.message || 'Plan uretilemedi.');
    } finally {
      setAiGenerating(false);
    }
  }

  function applyAiPlanToBuilder() {
    if (!aiPlan) return;
    const builderBlocks = planToWorkoutBuilderBlocks(aiPlan);
    if (!builderBlocks.length) return;
    setWorkoutName(aiPlan.name || workoutName);
    setWorkoutBlocks(builderBlocks.map((block) => initialWorkoutBlock(block)));
    Alert.alert('AI Plani', 'Plan workout duzenleyiciye aktarildi.');
  }

  async function exportWorkoutPdf(workout) {
    try {
      const html = buildWorkoutPdfHtml(workout, { scheduleLabel: scheduleLabel(workout.scheduleId) });
      if (Platform.OS === 'web') {
        const popup = window.open('', '_blank', 'width=1200,height=900');
        if (!popup) {
          Alert.alert('PDF', 'Tarayici acilir pencereyi engelledi. Lutfen popup izni verin.');
          return;
        }
        popup.document.open();
        popup.document.write(html);
        popup.document.close();
        popup.focus();
        setTimeout(() => {
          popup.print();
        }, 400);
        return;
      }
      const file = await Print.printToFileAsync({ html, base64: false });
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (sharingAvailable) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Workout PDF Paylas' });
        return;
      }
      Alert.alert('PDF hazir', file.uri);
    } catch (error) {
      Alert.alert('PDF', error.message || 'PDF olusturulamadi.');
    }
  }

  return (
    <ScreenLayout title="Antrenman ve Market" subtitle="">
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>ANTRENMAN MERKEZI</Text>
        <Text style={styles.heroTitle}>Trainer antrenman operasyonlari</Text>
        <Text style={styles.heroText}>Antrenman olustur, satisa cikar ve kutuphaneni yonet.</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryLabel}>Hazir workout</Text>
            <Text style={styles.summaryValue}>{data.workouts.length}</Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryLabel}>Aktif satis</Text>
            <Text style={styles.summaryValue}>{data.mySales.length}</Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryLabel}>Kredi</Text>
            <Text style={styles.summaryValue}>{data.creditBalance}</Text>
          </View>
        </View>
      </View>

      <SectionHeader title="Olimpiyat Seviyesi AI Antrenor" caption="Grup performansini, yas grubunu ve hedefi degerlendirip sureli plan ureteyim" />
      <View style={styles.card}>
        <Text style={styles.label}>Hedef</Text>
        <View style={styles.chipRow}>
          {AI_GOAL_OPTIONS.map((option) => (
            <ActionButton
              key={option.key}
              label={option.label}
              variant={aiProfile.goalKey === option.key ? 'primary' : 'secondary'}
              onPress={() => setAiProfile((current) => ({ ...current, goalKey: option.key }))}
            />
          ))}
        </View>
        <Text style={styles.label}>Seviye</Text>
        <View style={styles.chipRow}>
          {AI_LEVEL_OPTIONS.map((option) => (
            <ActionButton
              key={option.key}
              label={option.label}
              variant={aiProfile.levelKey === option.key ? 'primary' : 'secondary'}
              onPress={() => setAiProfile((current) => ({ ...current, levelKey: option.key }))}
            />
          ))}
        </View>
        <Text style={styles.label}>Odak stili</Text>
        <View style={styles.chipRow}>
          {AI_STYLE_OPTIONS.map((option) => (
            <ActionButton
              key={option}
              label={option}
              variant={aiProfile.focusStyle === option ? 'primary' : 'secondary'}
              onPress={() => setAiProfile((current) => ({ ...current, focusStyle: option }))}
            />
          ))}
        </View>
        <View style={styles.inlineFieldRow}>
          <View style={styles.fieldColumn}>
            <Text style={styles.label}>Seans suresi (dk)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="60"
              value={aiProfile.sessionDuration}
              onChangeText={(text) => setAiProfile((current) => ({ ...current, sessionDuration: text }))}
            />
          </View>
          <View style={styles.fieldColumn}>
            <Text style={styles.label}>Yas (opsiyonel)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="12"
              value={aiProfile.age}
              onChangeText={(text) => setAiProfile((current) => ({ ...current, age: text }))}
            />
          </View>
        </View>
        <Text style={styles.label}>Ek not / odak</Text>
        <TextInput
          style={[styles.input, { minHeight: 64 }]}
          multiline
          placeholder="Orn. nefes ritmi, baslangic gucu, donus disiplini..."
          value={aiProfile.notes}
          onChangeText={(text) => setAiProfile((current) => ({ ...current, notes: text }))}
        />
        <Text style={styles.itemText}>Ders grubu secili olursa plan, gruptaki sporcularin antrenman ve yaris derecelerine gore otomatik ayarlanir.</Text>
        <ActionButton
          label={aiGenerating ? 'Plan uretiliyor...' : 'AI Plan Uret'}
          onPress={handleAiGenerate}
          disabled={aiGenerating}
          fullWidth
        />
        {aiPlan ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>{aiPlan.name}</Text>
            <Text style={styles.itemText}>Toplam: {aiPlan.totalDistance}m | Hedef sure: {aiPlan.sessionTimeline?.targetMinutes || 60} dk | Planlanan: {aiPlan.sessionTimeline?.plannedMinutes || 0} dk</Text>
            {aiPlan.groupContext ? (
              <View>
                <Text style={styles.itemText}>Grup: {aiPlan.groupContext.scheduleLabel} | {aiPlan.groupContext.studentCount} sporcu | {aiPlan.groupContext.ageGroupLabel || '-'}</Text>
                {aiPlan.groupContext.trainingSummaryText ? <Text style={styles.itemText}>Antrenman: {aiPlan.groupContext.trainingSummaryText}</Text> : null}
                {aiPlan.groupContext.competitionSummaryText ? <Text style={styles.itemText}>Yaris: {aiPlan.groupContext.competitionSummaryText}</Text> : null}
              </View>
            ) : null}
            {(aiPlan.workoutBlocks || []).map((block, idx) => (
              <View key={`${block.title}-${idx}`} style={{ marginTop: 6 }}>
                <Text style={styles.itemTitle}>{block.title} ({block.estimatedMinutes || 1} dk)</Text>
                <Text style={styles.itemText}>{block.focus}</Text>
                {block.sets.map((set, sidx) => (
                  <Text key={sidx} style={styles.itemText}>
                    • {set.repeat} x {set.distance}m {set.style} | {set.restSeconds}sn dinlenme | ~{set.estimatedMinutes || 1} dk
                  </Text>
                ))}
              </View>
            ))}
            {(aiPlan.coachingNotes || []).length ? (
              <View style={{ marginTop: 8 }}>
                {aiPlan.coachingNotes.map((note, nidx) => (
                  <Text key={nidx} style={styles.itemText}>• {note}</Text>
                ))}
              </View>
            ) : null}
            <ActionButton label="Bu plani duzenleyiciye al" onPress={applyAiPlanToBuilder} fullWidth />
          </View>
        ) : null}
      </View>

      <SectionHeader title="Workout olustur" caption="Blok tekrari, set arasi dinlenme ve duzenleme desteklenir" />
      <View style={styles.card}>
        {editingWorkoutId ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Duzenleme modu acik</Text>
            <Text style={styles.itemText}>Bu kaydetme islemi mevcut workoutu gunceller; ogrenci paylasimi ayni workout kimligiyle korunur.</Text>
          </View>
        ) : null}
        <TextInput style={styles.input} placeholder="Workout adi" value={workoutName} onChangeText={setWorkoutName} />
        <Text style={styles.label}>Ders grubu</Text>
        {!data.schedules.length ? (
          <EmptyState title="Ders grubu bulunamadi" description="Antrenman atamak icin once bu antrenore bagli aktif bir grup olmali." />
        ) : (
          <View style={styles.chipRow}>
            {data.schedules.map((schedule) => (
              <ActionButton key={schedule.id} label={scheduleLabel(schedule.id)} variant={scheduleId === schedule.id ? 'primary' : 'secondary'} onPress={() => setScheduleId(schedule.id)} />
            ))}
          </View>
        )}
        <View style={styles.builderSummaryRow}>
          <View style={styles.builderSummaryChip}>
            <Text style={styles.builderSummaryLabel}>Blok</Text>
            <Text style={styles.builderSummaryValue}>{workoutBuilderSummary.totalBlocks}</Text>
          </View>
          <View style={styles.builderSummaryChip}>
            <Text style={styles.builderSummaryLabel}>Egzersiz satiri</Text>
            <Text style={styles.builderSummaryValue}>{workoutBuilderSummary.totalRows}</Text>
          </View>
          <View style={styles.builderSummaryChip}>
            <Text style={styles.builderSummaryLabel}>Toplam mesafe</Text>
            <Text style={styles.builderSummaryValue}>{workoutBuilderSummary.totalDistance}m</Text>
          </View>
        </View>
        {workoutBlocks.map((block, blockIndex) => (
          <View key={block.id} style={styles.blockCard}>
            <View style={styles.blockHeader}>
              <View style={styles.flexOne}>
                <Text style={styles.itemTitle}>Blok {blockIndex + 1}</Text>
                <Text style={styles.itemText}>{block.exercises.length} egzersiz satiri</Text>
              </View>
              <ActionButton label="Kopyala" variant="secondary" onPress={() => duplicateWorkoutBlock(block.id)} />
            </View>
            <TextInput
              style={styles.input}
              placeholder={`Blok ${blockIndex + 1} basligi`}
              value={block.name}
              onChangeText={(text) => updateBlock(block.id, 'name', text)}
            />
            <View style={styles.inlineFieldRow}>
              <View style={styles.fieldColumn}>
                <Text style={styles.label}>Bu blok kac kez tekrar etsin?</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Orn. 3"
                  keyboardType="numeric"
                  value={block.repeatCount}
                  onChangeText={(text) => updateBlock(block.id, 'repeatCount', text)}
                />
              </View>
              <View style={styles.fieldColumn}>
                <Text style={styles.label}>Tekrarlar arasindaki dinlenme (sn)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Orn. 30"
                  keyboardType="numeric"
                  value={block.roundRestSeconds}
                  onChangeText={(text) => updateBlock(block.id, 'roundRestSeconds', text)}
                />
              </View>
            </View>
            {block.exercises.map((exercise, exerciseIndex) => (
              <View key={exercise.id} style={styles.exerciseCard}>
                <Text style={styles.itemTitleSmall}>Egzersiz {exerciseIndex + 1}</Text>
                <View style={styles.inlineFieldRow}>
                  <View style={styles.fieldColumn}>
                    <Text style={styles.label}>Mesafe</Text>
                    <TextInput style={styles.input} placeholder="50" keyboardType="numeric" value={exercise.distance} onChangeText={(text) => updateExercise(block.id, exercise.id, 'distance', text)} />
                  </View>
                  <View style={styles.fieldColumn}>
                    <Text style={styles.label}>Tur</Text>
                    <TextInput style={styles.input} placeholder="6" keyboardType="numeric" value={exercise.reps} onChangeText={(text) => updateExercise(block.id, exercise.id, 'reps', text)} />
                  </View>
                </View>
                <Text style={styles.label}>Stil</Text>
                <View style={styles.chipRow}>
                  {strokeOptions.map((stroke) => (
                    <ActionButton
                      key={`${exercise.id}-stroke-${stroke}`}
                      label={stroke}
                      variant={exercise.style === stroke ? 'primary' : 'secondary'}
                      onPress={() => updateExercise(block.id, exercise.id, 'style', stroke)}
                    />
                  ))}
                </View>
                <View style={styles.inlineFieldRow}>
                  <View style={styles.fieldColumn}>
                    <Text style={styles.label}>Tempo (sn)</Text>
                    <TextInput style={styles.input} placeholder="35" keyboardType="numeric" value={exercise.intervalSeconds} onChangeText={(text) => updateExercise(block.id, exercise.id, 'intervalSeconds', text)} />
                  </View>
                  <View style={styles.fieldColumn}>
                    <Text style={styles.label}>Egzersiz sonu dinlenme (sn)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="20"
                      keyboardType="numeric"
                      value={exercise.restEnabled ? exercise.restSeconds : '0'}
                      onChangeText={(text) => updateExercise(block.id, exercise.id, 'restSeconds', text)}
                      editable={exercise.restEnabled}
                    />
                  </View>
                </View>
                <ActionButton
                  label={exercise.restEnabled ? 'Egzersiz dinlenmesi acik' : 'Egzersiz dinlenmesi kapali'}
                  variant={exercise.restEnabled ? 'primary' : 'secondary'}
                  onPress={() => toggleExerciseRest(block.id, exercise.id)}
                  fullWidth
                />
                <Text style={styles.itemText}>{formatExerciseLine({ ...exercise, restSeconds: exercise.restEnabled ? exercise.restSeconds : 0 })}</Text>
                <ActionButton label="Egzersizi Sil" variant="secondary" onPress={() => removeExercise(block.id, exercise.id)} />
              </View>
            ))}
            <View style={styles.buttonColumn}>
              <ActionButton label="Bu bloka egzersiz ekle" variant="secondary" onPress={() => addExercise(block.id)} fullWidth />
              <ActionButton label="Bloku Sil" variant="secondary" onPress={() => removeWorkoutBlock(block.id)} fullWidth />
            </View>
          </View>
        ))}
        <View style={styles.buttonColumn}>
          <ActionButton label="Yeni blok ekle" variant="secondary" onPress={addWorkoutBlock} fullWidth />
          {editingWorkoutId ? <ActionButton label="Duzenlemeyi Iptal Et" variant="secondary" onPress={resetWorkoutBuilder} fullWidth /> : null}
          <ActionButton label={workoutMutation.isPending ? (editingWorkoutId ? 'Guncelleniyor...' : 'Kaydediliyor...') : (editingWorkoutId ? 'Workoutu Guncelle' : 'Antrenmani Kaydet')} onPress={handleCreateWorkout} fullWidth />
        </View>
      </View>

      <SectionHeader title="Workout kutuphanem" caption="Olusturdugun workoutlar" />
      <View style={styles.card}>
        {!data.workouts.length ? (
          <EmptyState title="Workout yok" description="Henuz workout olusturmadiniz." />
        ) : (
          data.workouts.map((workout) => (
            <View key={workout.id} style={styles.subCard}>
              <Text style={styles.itemTitle}>{workout.name}</Text>
              <Text style={styles.itemText}>{scheduleLabel(workout.scheduleId)}</Text>
              {buildWorkoutPreviewLines(workout, 4).map((line, index) => (
                <Text key={`${workout.id}-preview-${index}`} style={styles.itemText}>{line}</Text>
              ))}
              <View style={styles.buttonRow}>
                <ActionButton label="Duzenle" variant="secondary" onPress={() => startEditingWorkout(workout)} />
                <ActionButton label="PDF" variant="secondary" onPress={() => exportWorkoutPdf(workout)} />
                <ActionButton label="Workoutu Sil" variant="secondary" onPress={() => deleteWorkoutMutation.mutate(workout.id)} />
              </View>
            </View>
          ))
        )}
      </View>

      <SectionHeader title="Satisa cikar" caption="Kendi workoutunu kredi karsiligi listele" />
      <View style={styles.card}>
        <Text style={styles.label}>Workout sec</Text>
        {!data.workouts.length ? (
          <EmptyState title="Satisa cikacak antrenman yok" description="Market ilani olusturmak icin once kendi kutuphanene bir antrenman kaydet." />
        ) : (
          <View style={styles.chipRow}>
            {data.workouts.map((workout) => (
              <ActionButton
                key={workout.id}
                label={workout.name}
                variant={sellValues.workoutId === workout.id ? 'primary' : 'secondary'}
                onPress={() => setSellValues((current) => ({ ...current, workoutId: workout.id, name: workout.name || current.name }))}
              />
            ))}
          </View>
        )}
        <TextInput style={styles.input} placeholder="Baslik" value={sellValues.name} onChangeText={(text) => setSellValues((current) => ({ ...current, name: text }))} />
        <TextInput style={[styles.input, styles.textarea]} multiline placeholder="Aciklama" value={sellValues.description} onChangeText={(text) => setSellValues((current) => ({ ...current, description: text }))} />
        <TextInput style={styles.input} placeholder="Yas grubu" value={sellValues.ageGroup} onChangeText={(text) => setSellValues((current) => ({ ...current, ageGroup: text }))} />
        <TextInput style={styles.input} placeholder="Hedef kitle" value={sellValues.target} onChangeText={(text) => setSellValues((current) => ({ ...current, target: text }))} />
        <TextInput style={styles.input} placeholder="Stil" value={sellValues.style} onChangeText={(text) => setSellValues((current) => ({ ...current, style: text }))} />
        <TextInput style={styles.input} placeholder="Mesafe" value={sellValues.distance} onChangeText={(text) => setSellValues((current) => ({ ...current, distance: text }))} />
        <TextInput style={styles.input} placeholder="Tur" value={sellValues.workoutType} onChangeText={(text) => setSellValues((current) => ({ ...current, workoutType: text }))} />
        <TextInput style={styles.input} placeholder="Kredi" keyboardType="numeric" value={sellValues.credit} onChangeText={(text) => setSellValues((current) => ({ ...current, credit: text }))} />
        <ActionButton label={sellWorkoutMutation.isPending ? 'Yayinlaniyor...' : 'Satisa Cikar'} onPress={() => sellWorkoutMutation.mutate()} fullWidth />
      </View>

      <SectionHeader title="Benim satislarim" caption="Gelen teklifleri onayla veya ilani kaldir" />
      <View style={styles.card}>
        {!data.mySales.length ? (
          <EmptyState title="Satis yok" description="Henuz satisa cikardiginiz workout bulunmuyor." />
        ) : (
          data.mySales.map((sale) => {
            const latestOffers = Object.values((sale.negotiations || []).reduce((result, item) => {
              if (!item?.from || item.from === sale.sellerId) return result;
              const current = result[item.from];
              if (!current || new Date(item.timestamp || 0).getTime() >= new Date(current.timestamp || 0).getTime()) {
                result[item.from] = item;
              }
              return result;
            }, {}));

            return (
              <View key={sale.id} style={styles.subCard}>
                <Text style={styles.itemTitle}>{sale.name}</Text>
                <Text style={styles.itemText}>{sale.description}</Text>
                <Text style={styles.itemText}>{sale.credit} kredi | {sale.ageGroup} | {sale.target}</Text>
                {latestOffers.map((offer) => {
                  const key = `${sale.id}_${offer.from}`;
                  return (
                    <View key={key} style={styles.offerCard}>
                      <Text style={styles.itemTitleSmall}>{offer.fromName || 'Kullanici'}</Text>
                      <Text style={styles.itemText}>Son teklif: {offer.offer} kredi</Text>
                      {offer.message ? <Text style={styles.itemText}>{offer.message}</Text> : null}
                      <TextInput
                        style={styles.input}
                        placeholder="Onaylanacak fiyat"
                        keyboardType="numeric"
                        value={approvalPrices[key] ?? String(offer.offer || '')}
                        onChangeText={(text) => setApprovalValue(key, text)}
                      />
                      <ActionButton
                        label="Ozel Fiyati Onayla"
                        onPress={() => approveMutation.mutate({ saleId: sale.id, buyerId: offer.from, buyerName: offer.fromName, approvedPrice: approvalPrices[key] ?? offer.offer, sellerName: profile.name })}
                      />
                    </View>
                  );
                })}
                <ActionButton label="Ilani Kaldir" variant="secondary" onPress={() => removeSaleMutation.mutate(sale.id)} />
              </View>
            );
          })
        )}
      </View>

      <SectionHeader title="Workout market" caption="Incele, pazarlik yap, satin al veya sohbet baslat" />
      <View style={styles.card}>
        {!!data.marketSales.length ? (
          <View style={styles.chipRow}>
            {data.marketSales.map((sale) => (
              <ActionButton key={sale.id} label={sale.name} variant={selectedSaleId === sale.id ? 'primary' : 'secondary'} onPress={() => setSelectedSaleId(sale.id)} />
            ))}
          </View>
        ) : null}
        {!selectedMarketSale ? (
          <EmptyState title="Pazar kaydi yok" description="Ayni admin kapsaminda aktif workout ilani bulunmuyor." />
        ) : (
          <View style={styles.subCard}>
            <Text style={styles.itemTitle}>{selectedMarketSale.name}</Text>
            <Text style={styles.itemText}>{selectedMarketSale.description}</Text>
            <Text style={styles.itemText}>{selectedMarketSale.credit} kredi | Satici: {selectedMarketSale.sellerName}</Text>
            <Text style={styles.itemText}>{selectedMarketSale.ageGroup} | {selectedMarketSale.target} | {selectedMarketSale.style} | {selectedMarketSale.distance}</Text>
            {buildWorkoutPreviewLines(selectedMarketSale, 3).map((line, index) => (
              <Text key={`${selectedMarketSale.id}-preview-${index}`} style={styles.itemText}>{line}</Text>
            ))}
            <TextInput style={styles.input} placeholder="Teklif tutari" keyboardType="numeric" value={offerAmount} onChangeText={setOfferAmount} />
            <TextInput style={[styles.input, styles.textarea]} multiline placeholder="Teklif notu" value={offerMessage} onChangeText={setOfferMessage} />
            <View style={styles.buttonColumn}>
              <ActionButton label={offerMutation.isPending ? 'Gonderiliyor...' : 'Teklif Gonder'} onPress={() => offerMutation.mutate()} fullWidth />
              <ActionButton label="Sohbet Baslat" variant="secondary" onPress={() => chatMutation.mutate({ saleId: selectedMarketSale.id })} fullWidth />
              <ActionButton label="Hemen Satin Al" onPress={() => buyMutation.mutate({ saleId: selectedMarketSale.id })} fullWidth />
            </View>
          </View>
        )}
      </View>

      <SectionHeader title="Satin alinan workoutlar" caption="Kutuphanene eklenen workoutlar" />
      <View style={styles.card}>
        {!data.workoutLibrary.length ? (
          <EmptyState title="Kutuphane bos" description="Satin alinmis workout bulunmuyor." />
        ) : (
          data.workoutLibrary.map((item) => (
            <View key={item.id} style={styles.subCard}>
              <Text style={styles.itemTitle}>{item.workoutName}</Text>
              <Text style={styles.itemText}>Satici: {item.sellerName}</Text>
              <Text style={styles.itemText}>Fiyat: {item.price} kredi</Text>
              {buildWorkoutPreviewLines(item, 4).map((line, index) => (
                <Text key={`${item.id}-library-preview-${index}`} style={styles.itemText}>{line}</Text>
              ))}
              <ActionButton label="PDF" variant="secondary" onPress={() => exportWorkoutPdf(item)} />
              <ActionButton label="Kutuphane Kaydini Sil" variant="secondary" onPress={() => removeLibraryMutation.mutate({ libraryItemId: item.id })} />
            </View>
          ))
        )}
      </View>

      <SectionHeader title="AI workout" caption="Web panelindeki gecici durum mobilde de korunur" />
      <View style={styles.disabledBox}>
        <Text style={styles.disabledTitle}>Ozellik gecici olarak kapali</Text>
        <Text style={styles.itemText}>Odeme ve AI altyapisi tekrar aktif oldugunda mobil ekran da ayni akisla acilacak.</Text>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#e9f5ff',
    borderColor: '#c6e2f6',
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: 10,
  },
  heroEyebrow: {
    color: theme.colors.primaryDeep,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    color: theme.colors.primaryDeep,
    fontSize: 22,
    fontWeight: '800',
  },
  heroText: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryChip: {
    flexGrow: 1,
    minWidth: '30%',
    backgroundColor: '#ffffffcc',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  summaryLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  summaryValue: {
    color: theme.colors.primaryDeep,
    fontSize: 20,
    fontWeight: '800',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 12,
  },
  infoCard: {
    backgroundColor: '#eef7ff',
    borderColor: '#bedcf4',
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 6,
  },
  infoTitle: {
    color: theme.colors.primaryDeep,
    fontWeight: '800',
  },
  builderSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  builderSummaryChip: {
    flexGrow: 1,
    minWidth: '30%',
    backgroundColor: '#f4f9ff',
    borderWidth: 1,
    borderColor: '#d8e8f5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  builderSummaryLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  builderSummaryValue: {
    color: theme.colors.primaryDeep,
    fontSize: 18,
    fontWeight: '800',
  },
  blockCard: {
    backgroundColor: '#fbfdff',
    borderWidth: 1,
    borderColor: '#dfeaf3',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 10,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineFieldRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fieldColumn: {
    flex: 1,
    minWidth: 150,
    gap: 6,
  },
  exerciseCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  subCard: {
    backgroundColor: '#fbfdff',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 6,
  },
  offerCard: {
    backgroundColor: '#f4f8fb',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#d7e6f1',
    padding: theme.spacing.md,
    gap: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  buttonColumn: {
    gap: 8,
  },
  label: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: theme.colors.text,
  },
  textarea: {
    minHeight: 90,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  itemTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 15,
  },
  itemTitleSmall: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  itemText: {
    color: theme.colors.textMuted,
  },
  flexOne: {
    flex: 1,
  },
  disabledBox: {
    backgroundColor: '#fff6e8',
    borderColor: '#f3d7a4',
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 6,
  },
  disabledTitle: {
    color: '#9b5f00',
    fontWeight: '800',
  },
});
