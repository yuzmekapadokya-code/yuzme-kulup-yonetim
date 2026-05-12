import NetInfo from '@react-native-community/netinfo';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useKeepAwake } from 'expo-keep-awake';
import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ScreenOrientation from 'expo-screen-orientation';

import ActionButton from '../../components/ActionButton';
import EmptyState from '../../components/EmptyState';
import LoadingBlock from '../../components/LoadingBlock';
import ScreenLayout from '../../components/ScreenLayout';
import SectionHeader from '../../components/SectionHeader';
import { theme } from '../../config/theme';
import {
  deletePurchasedWorkoutLibraryItem,
  deleteWorkoutCascade,
  getTrainerActiveWorkoutControl,
  getTrainerCommerceOverview,
  saveTrainerActiveWorkoutControl,
} from '../../services/trainerService';
import { useAuthStore } from '../../store/authStore';

const warningTime = 10;
const dangerTime = 5;
const laneOptions = [1, 2, 3, 4, 5, 6, 7, 8];
const standardGridGap = 10;
const standardHorizontalPadding = 32;
const fullscreenGridGap = 8;
const fullscreenHorizontalPadding = 28;

const swimUi = {
  primary: '#0066ff',
  primaryDark: '#0052d4',
  secondary: '#00d4ff',
  success: '#00cc88',
  warning: '#ffaa00',
  danger: '#ff3333',
  dark: '#eaf3ff',
  panel: '#e5f0ff',
  card: '#ffffff',
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatClock(seconds) {
  const safe = Math.max(0, Number(seconds || 0));
  const min = String(Math.floor(safe / 60)).padStart(2, '0');
  const sec = String(safe % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

function getTimerTextStyle(visualState) {
  if (visualState === 'warning') return 'warning';
  if (visualState === 'danger') return 'danger';
  return 'normal';
}

function getStandardLaneColumns(laneCount, viewportWidth) {
  if (laneCount <= 1) return 1;
  if (laneCount === 2) return 2;
  if (laneCount <= 4) return 2;
  return viewportWidth >= 1080 ? 3 : 2;
}

function getStandardLaneCardWidth(laneCount, viewportWidth) {
  const columnCount = getStandardLaneColumns(laneCount, viewportWidth);
  const totalGapWidth = standardGridGap * Math.max(columnCount - 1, 0);
  const usableWidth = Math.max(viewportWidth - standardHorizontalPadding - totalGapWidth, 180);
  return Math.max(usableWidth / columnCount, 180);
}

function getStandardLaneMinHeight(laneCount, viewportHeight) {
  if (laneCount <= 1) return Math.max(viewportHeight * 0.68, 520);
  if (laneCount === 2) return Math.max(viewportHeight * 0.46, 390);
  if (laneCount <= 4) return Math.max(viewportHeight * 0.34, 320);
  return Math.max(viewportHeight * 0.28, 280);
}

function getStandardTimerFontSize(laneCount, laneWidth, viewportHeight) {
  const widthDriven = laneCount <= 1
    ? laneWidth * 0.28
    : laneCount === 2
      ? laneWidth * 0.24
      : laneWidth * 0.19;
  const heightCap = laneCount <= 1 ? viewportHeight * 0.22 : viewportHeight * 0.16;
  const maxSize = laneCount <= 1 ? 172 : laneCount === 2 ? 124 : 92;
  const minSize = laneCount <= 1 ? 104 : laneCount === 2 ? 74 : 50;
  return Math.max(minSize, Math.min(widthDriven, heightCap, maxSize));
}

function getStandardHeadlineFontSize(laneCount, laneWidth) {
  const widthDriven = laneCount <= 1 ? laneWidth * 0.082 : laneCount === 2 ? laneWidth * 0.074 : laneWidth * 0.062;
  return Math.max(16, Math.min(widthDriven, laneCount <= 1 ? 34 : 24));
}

function getStandardMetaFontSize(laneCount, laneWidth) {
  const widthDriven = laneCount <= 1 ? laneWidth * 0.05 : laneCount === 2 ? laneWidth * 0.046 : laneWidth * 0.04;
  return Math.max(12, Math.min(widthDriven, laneCount <= 1 ? 22 : 18));
}

function getStandardLaneTitleFontSize(laneCount, laneWidth) {
  const widthDriven = laneCount <= 1 ? laneWidth * 0.055 : laneCount === 2 ? laneWidth * 0.05 : laneWidth * 0.043;
  return Math.max(15, Math.min(widthDriven, laneCount <= 1 ? 24 : 18));
}

function getFullscreenLaneColumns(laneCount, viewportWidth) {
  if (laneCount <= 1) return 1;
  if (laneCount === 2) return 2;
  if (laneCount <= 4) return 2;
  if (laneCount <= 6) return viewportWidth >= 1280 ? 3 : 2;
  return viewportWidth >= 1440 ? 4 : viewportWidth >= 1100 ? 3 : 2;
}

function getFullscreenLaneCardWidth(laneCount, viewportWidth) {
  const columnCount = getFullscreenLaneColumns(laneCount, viewportWidth);
  const totalGapWidth = fullscreenGridGap * Math.max(columnCount - 1, 0);
  const usableWidth = Math.max(viewportWidth - fullscreenHorizontalPadding - totalGapWidth, 220);
  return Math.max(usableWidth / columnCount, 220);
}

function getFullscreenLaneMinHeight(laneCount, viewportHeight) {
  if (laneCount <= 2) return Math.max(viewportHeight * 0.72, 250);
  if (laneCount <= 4) return Math.max(viewportHeight * 0.42, 220);
  return Math.max(viewportHeight * 0.28, 180);
}

function getFullscreenTimerFontSize(laneCount, laneWidth, viewportHeight) {
  const widthDriven = laneCount <= 2 ? laneWidth * 0.31 : laneCount <= 4 ? laneWidth * 0.23 : laneWidth * 0.18;
  return Math.max(56, Math.min(widthDriven, viewportHeight * 0.34, 148));
}

function getFullscreenHeadlineFontSize(laneCount, laneWidth) {
  const widthDriven = laneCount <= 2 ? laneWidth * 0.082 : laneCount <= 4 ? laneWidth * 0.062 : laneWidth * 0.05;
  return Math.max(18, Math.min(widthDriven, 34));
}

function getFullscreenMetaFontSize(laneCount, laneWidth) {
  const widthDriven = laneCount <= 2 ? laneWidth * 0.048 : laneCount <= 4 ? laneWidth * 0.04 : laneWidth * 0.034;
  return Math.max(13, Math.min(widthDriven, 20));
}

function buildPlan(exercises) {
  return (exercises || [])
    .map((exercise) => ({
      distance: Math.max(1, toNumber(exercise.distance, 0)),
      style: String(exercise.style || '').trim() || 'Serbest',
      reps: Math.max(1, toNumber(exercise.reps, 1)),
      intervalSeconds: Math.max(1, toNumber(exercise.intervalSeconds, 30)),
      restSeconds: Math.max(0, toNumber(exercise.restSeconds, 0)),
    }))
    .filter((exercise) => exercise.distance > 0 && exercise.intervalSeconds > 0);
}

function createLaneState(selectedWorkoutId = '') {
  return {
    selectedWorkoutId,
    isRunning: false,
    isPaused: false,
    phase: 'idle',
    setIndex: 0,
    repIndex: 1,
    remainingSeconds: 0,
    history: [],
  };
}

function getStatusText(laneState) {
  if (!laneState.isRunning) return laneState.phase === 'complete' ? 'Tamamlandi' : 'Hazir';
  if (laneState.isPaused) return 'Duraklatildi';
  if (laneState.phase === 'rest') return 'Dinlenme';
  return 'Calisma';
}

function getVisualState(laneState) {
  if (laneState.phase === 'rest' && laneState.isRunning) return 'rest';
  if (laneState.isRunning && laneState.remainingSeconds <= dangerTime) return 'danger';
  if (laneState.isRunning && laneState.remainingSeconds <= warningTime) return 'warning';
  if (laneState.isRunning) return 'success';
  return 'normal';
}

function advanceLaneState(currentLane, plan) {
  if (!plan.length) {
    return {
      ...currentLane,
      isRunning: false,
      isPaused: false,
      phase: 'idle',
      remainingSeconds: 0,
    };
  }

  const currentSet = plan[currentLane.setIndex];
  if (!currentSet) {
    return {
      ...currentLane,
      isRunning: false,
      isPaused: false,
      phase: 'complete',
      remainingSeconds: 0,
      history: ['Antrenman tamamlandi', ...(currentLane.history || [])].slice(0, 20),
    };
  }

  const isSetCompleted = currentLane.repIndex >= currentSet.reps;
  const hasNextSet = currentLane.setIndex < plan.length - 1;

  if (currentLane.phase === 'work' && currentSet.restSeconds > 0 && isSetCompleted && hasNextSet) {
    return {
      ...currentLane,
      phase: 'rest',
      remainingSeconds: currentSet.restSeconds,
      history: [`Dinlenme basladi (${currentSet.restSeconds}s)`, ...(currentLane.history || [])].slice(0, 20),
    };
  }

  if (currentLane.repIndex < currentSet.reps) {
    const nextRep = currentLane.repIndex + 1;
    return {
      ...currentLane,
      phase: 'work',
      repIndex: nextRep,
      remainingSeconds: currentSet.intervalSeconds,
      history: [`${currentSet.distance}m ${currentSet.style} | Tur ${nextRep}/${currentSet.reps}`, ...(currentLane.history || [])].slice(0, 20),
    };
  }

  const nextSetIndex = currentLane.setIndex + 1;
  if (nextSetIndex < plan.length) {
    const nextSet = plan[nextSetIndex];
    return {
      ...currentLane,
      phase: 'work',
      setIndex: nextSetIndex,
      repIndex: 1,
      remainingSeconds: nextSet.intervalSeconds,
      history: [`Set ${nextSetIndex + 1} basladi | ${nextSet.distance}m ${nextSet.style}`, ...(currentLane.history || [])].slice(0, 20),
    };
  }

  return {
    ...currentLane,
    isRunning: false,
    isPaused: false,
    phase: 'complete',
    remainingSeconds: 0,
    history: ['Antrenman tamamlandi', ...(currentLane.history || [])].slice(0, 20),
  };
}

export default function TrainerChronometerScreen() {
  useKeepAwake();

  const profile = useAuthStore((state) => state.profile);
  const queryClient = useQueryClient();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const lastHandledCommandNonceRef = useRef('');
  const [isOnline, setIsOnline] = useState(true);

  const commerceQuery = useQuery({
    queryKey: ['tr-commerce', profile?.uid],
    queryFn: () => getTrainerCommerceOverview(profile),
    enabled: Boolean(profile?.uid),
  });

  const controlQuery = useQuery({
    queryKey: ['tr-workout-control', profile?.uid],
    queryFn: () => getTrainerActiveWorkoutControl(profile),
    enabled: Boolean(profile?.uid && isOnline),
    refetchInterval: 1200,
  });

  const controlMutation = useMutation({
    mutationFn: (payload) => saveTrainerActiveWorkoutControl({ profile, ...payload }),
  });

  const removeWorkoutMutation = useMutation({
    mutationFn: (workoutId) => deleteWorkoutCascade(workoutId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tr-commerce', profile?.uid] }),
  });

  const removeLibraryMutation = useMutation({
    mutationFn: ({ libraryItemId }) => deletePurchasedWorkoutLibraryItem({ profile, libraryItemId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tr-commerce', profile?.uid] }),
  });

  const workouts = useMemo(() => {
    const own = (commerceQuery.data?.workouts || []).map((item) => ({
      id: `own_${item.id}`,
      source: 'own',
      sourceId: item.id,
      name: item.name || 'Adsiz workout',
      exercises: Array.isArray(item.exercises) ? item.exercises : [],
    }));
    const purchased = (commerceQuery.data?.workoutLibrary || []).map((item) => ({
      id: `lib_${item.id}`,
      source: 'library',
      sourceId: item.id,
      name: item.workoutName || 'Satin alinan workout',
      exercises: Array.isArray(item.exercises) ? item.exercises : [],
    }));
    return [...own, ...purchased];
  }, [commerceQuery.data?.workoutLibrary, commerceQuery.data?.workouts]);

  const [laneCount, setLaneCount] = useState(2);
  const [lanes, setLanes] = useState([]);
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);
  const [isTouchLocked, setIsTouchLocked] = useState(false);
  const [remoteLaneIndex, setRemoteLaneIndex] = useState(0);
  const [workoutPickerLaneIndex, setWorkoutPickerLaneIndex] = useState(null);
  const standardViewportWidth = windowWidth;
  const standardViewportHeight = windowHeight;
  const standardColumns = getStandardLaneColumns(laneCount, standardViewportWidth);
  const standardLaneWidth = getStandardLaneCardWidth(laneCount, standardViewportWidth);
  const standardLaneMinHeight = getStandardLaneMinHeight(laneCount, standardViewportHeight);
  const standardTimerFontSize = getStandardTimerFontSize(laneCount, standardLaneWidth, standardViewportHeight);
  const standardHeadlineFontSize = getStandardHeadlineFontSize(laneCount, standardLaneWidth);
  const standardMetaFontSize = getStandardMetaFontSize(laneCount, standardLaneWidth);
  const standardLaneTitleFontSize = getStandardLaneTitleFontSize(laneCount, standardLaneWidth);
  const fullscreenViewportWidth = Math.max(windowWidth, windowHeight);
  const fullscreenViewportHeight = Math.min(windowWidth, windowHeight);
  const fullscreenColumns = getFullscreenLaneColumns(laneCount, fullscreenViewportWidth);
  const fullscreenLaneWidth = getFullscreenLaneCardWidth(laneCount, fullscreenViewportWidth);
  const fullscreenLaneMinHeight = getFullscreenLaneMinHeight(laneCount, fullscreenViewportHeight);
  const fullscreenTimerFontSize = getFullscreenTimerFontSize(laneCount, fullscreenLaneWidth, fullscreenViewportHeight);
  const fullscreenHeadlineFontSize = getFullscreenHeadlineFontSize(laneCount, fullscreenLaneWidth);
  const fullscreenMetaFontSize = getFullscreenMetaFontSize(laneCount, fullscreenLaneWidth);

  const hasActiveLanes = useMemo(
    () => lanes.some((lane) => lane.isRunning && !lane.isPaused),
    [lanes]
  );

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const nextLaneCount = Number(controlQuery.data?.laneCount);
    if (Number.isFinite(nextLaneCount)) {
      setLaneCount(Math.max(1, Math.min(8, nextLaneCount)));
    }
  }, [controlQuery.data?.laneCount]);

  useEffect(() => {
    const defaultWorkoutId = workouts[0]?.id || '';
    setLanes((current) => {
      const resized = Array.from({ length: laneCount }, (_, index) => {
        const existing = current[index];
        if (!existing) return createLaneState(defaultWorkoutId);
        if (!existing.selectedWorkoutId || !workouts.some((item) => item.id === existing.selectedWorkoutId)) {
          return { ...existing, selectedWorkoutId: defaultWorkoutId };
        }
        return existing;
      });
      return resized;
    });
  }, [laneCount, workouts]);

  useEffect(() => {
    if (remoteLaneIndex > laneCount - 1) {
      setRemoteLaneIndex(Math.max(0, laneCount - 1));
    }
  }, [laneCount, remoteLaneIndex]);

  useEffect(() => {
    if (!hasActiveLanes) return undefined;

    const timerId = setInterval(() => {
      setLanes((current) => current.map((lane) => {
        if (!lane.isRunning || lane.isPaused) return lane;
        if (lane.remainingSeconds > 1) {
          return { ...lane, remainingSeconds: lane.remainingSeconds - 1 };
        }
        const selectedWorkout = workouts.find((item) => item.id === lane.selectedWorkoutId);
        const plan = buildPlan(selectedWorkout?.exercises);
        return advanceLaneState({ ...lane, remainingSeconds: 0 }, plan);
      }));
    }, 1000);
    return () => clearInterval(timerId);
  }, [hasActiveLanes, workouts]);

  useEffect(() => {
    const remote = controlQuery.data;
    if (!remote || !remote.commandNonce || remote.commandNonce === lastHandledCommandNonceRef.current) return;
    lastHandledCommandNonceRef.current = remote.commandNonce;

    const targetIndex = Number.isFinite(Number(remote.laneIndex)) ? Number(remote.laneIndex) : null;

    setLanes((current) => current.map((lane, index) => {
      if (targetIndex !== null && targetIndex !== index) return lane;
      const selectedWorkout = workouts.find((item) => item.id === (remote.selectedWorkoutId || lane.selectedWorkoutId));
      const plan = buildPlan(selectedWorkout?.exercises);

      if (remote.commandType === 'start' || remote.commandType === 'restart') {
        if (!plan.length) return lane;
        return {
          ...lane,
          selectedWorkoutId: selectedWorkout?.id || lane.selectedWorkoutId,
          isRunning: true,
          isPaused: false,
          phase: 'work',
          setIndex: 0,
          repIndex: 1,
          remainingSeconds: plan[0].intervalSeconds,
          history: [],
        };
      }
      if (remote.commandType === 'pauseToggle') {
        if (!lane.isRunning) return lane;
        return { ...lane, isPaused: !lane.isPaused };
      }
      if (remote.commandType === 'skip') {
        return advanceLaneState(lane, plan);
      }
      if (remote.commandType === 'reset') {
        return {
          ...lane,
          isRunning: false,
          isPaused: false,
          phase: 'idle',
          setIndex: 0,
          repIndex: 1,
          remainingSeconds: 0,
          history: [],
        };
      }
      return lane;
    }));
  }, [controlQuery.data, workouts]);

  useEffect(() => {
    return () => {
      restoreDefaultSystemUi().catch(() => null);
    };
  }, []);

  useEffect(() => {
    if (!isFullscreenMode) {
      return undefined;
    }

    let isDisposed = false;
    const reapplyFullscreenUi = () => {
      if (isDisposed) {
        return;
      }

      applyFullscreenSystemUi().catch(() => null);
    };
    const timerIds = [120, 360, 720].map((delay) => setTimeout(reapplyFullscreenUi, delay));
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        reapplyFullscreenUi();
      }
    });

    reapplyFullscreenUi();

    return () => {
      isDisposed = true;
      timerIds.forEach((timerId) => clearTimeout(timerId));
      appStateSubscription.remove();
    };
  }, [isFullscreenMode, windowHeight, windowWidth]);

  async function setNavigationBarPosition(position) {
    if (typeof NavigationBar.setPositionAsync !== 'function') {
      return;
    }

    await NavigationBar.setPositionAsync(position).catch(() => null);
  }

  async function applyFullscreenSystemUi() {
    if (typeof NavigationBar.setBehaviorAsync === 'function') {
      await NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => null);
    }
    await setNavigationBarPosition('absolute');
    await NavigationBar.setVisibilityAsync('hidden').catch(() => null);
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => null);
  }

  async function restoreDefaultSystemUi() {
    await NavigationBar.setVisibilityAsync('visible').catch(() => null);
    await setNavigationBarPosition('relative');
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => null);
  }

  async function enterFullscreenTraining() {
    setIsFullscreenMode(true);
    await applyFullscreenSystemUi();
  }

  async function exitFullscreenTraining() {
    setIsFullscreenMode(false);
    await restoreDefaultSystemUi();
  }

  function ensureFullscreenMode() {
    if (isFullscreenMode) return;
    enterFullscreenTraining().catch(() => null);
  }

  function dispatchControlCommand(commandType, options = {}) {
    if (!isOnline) {
      return;
    }

    const nonce = `${commandType}_${Date.now()}`;
    lastHandledCommandNonceRef.current = nonce;
    controlMutation.mutate({
      commandType,
      commandNonce: nonce,
      laneCount: options.laneCount ?? laneCount,
      selectedWorkoutId: options.selectedWorkoutId,
      laneIndex: options.laneIndex,
    });
  }

  function withTouchLock(action) {
    return () => {
      if (isTouchLocked) return;
      action();
    };
  }

  function updateLane(index, updater, commandType) {
    setLanes((current) => current.map((lane, laneIndex) => (laneIndex === index ? updater(lane) : lane)));
    if (commandType) dispatchControlCommand(commandType, { laneIndex: index });
  }

  function setLaneWorkout(index, workoutId) {
    updateLane(index, (lane) => ({
      ...lane,
      selectedWorkoutId: workoutId,
      isRunning: false,
      isPaused: false,
      phase: 'idle',
      setIndex: 0,
      repIndex: 1,
      remainingSeconds: 0,
      history: [],
    }));
  }

  function changeLaneWorkoutByOffset(index, offset) {
    updateLane(index, (lane) => {
      if (!workouts.length) return lane;
      const currentIndex = Math.max(0, workouts.findIndex((item) => item.id === lane.selectedWorkoutId));
      const nextIndex = (currentIndex + offset + workouts.length) % workouts.length;
      const nextWorkout = workouts[nextIndex];
      return {
        ...lane,
        selectedWorkoutId: nextWorkout.id,
        isRunning: false,
        isPaused: false,
        phase: 'idle',
        setIndex: 0,
        repIndex: 1,
        remainingSeconds: 0,
        history: [],
      };
    });
  }

  function startLane(index) {
    updateLane(index, (lane) => {
      const selectedWorkout = workouts.find((item) => item.id === lane.selectedWorkoutId);
      const plan = buildPlan(selectedWorkout?.exercises);
      if (!plan.length) return lane;
      return {
        ...lane,
        isRunning: true,
        isPaused: false,
        phase: 'work',
        setIndex: 0,
        repIndex: 1,
        remainingSeconds: plan[0].intervalSeconds,
        history: [],
      };
    }, 'start');
  }

  function pauseLane(index) {
    updateLane(index, (lane) => (lane.isRunning ? { ...lane, isPaused: !lane.isPaused } : lane), 'pauseToggle');
  }

  function restartLane(index) {
    updateLane(index, (lane) => {
      const selectedWorkout = workouts.find((item) => item.id === lane.selectedWorkoutId);
      const plan = buildPlan(selectedWorkout?.exercises);
      if (!plan.length) return lane;
      return {
        ...lane,
        isRunning: true,
        isPaused: false,
        phase: 'work',
        setIndex: 0,
        repIndex: 1,
        remainingSeconds: plan[0].intervalSeconds,
        history: [],
      };
    }, 'restart');
  }

  function resetLane(index) {
    updateLane(index, (lane) => ({
      ...lane,
      isRunning: false,
      isPaused: false,
      phase: 'idle',
      setIndex: 0,
      repIndex: 1,
      remainingSeconds: 0,
      history: [],
    }), 'reset');
  }

  function skipLane(index) {
    updateLane(index, (lane) => {
      const selectedWorkout = workouts.find((item) => item.id === lane.selectedWorkoutId);
      const plan = buildPlan(selectedWorkout?.exercises);
      return advanceLaneState(lane, plan);
    }, 'skip');
  }

  function updateLaneCount(nextLaneCount) {
    setLaneCount(nextLaneCount);
    dispatchControlCommand('laneCount', { laneCount: nextLaneCount });
  }

  function startAllLanes() {
    ensureFullscreenMode();
    lanes.forEach((lane, index) => {
      if (!lane.isRunning) startLane(index);
    });
  }

  function pauseAllLanes() {
    lanes.forEach((lane, index) => {
      if (lane.isRunning) pauseLane(index);
    });
  }

  function resetAllLanes() {
    lanes.forEach((_, index) => resetLane(index));
  }

  function restartAllLanes() {
    lanes.forEach((_, index) => restartLane(index));
  }

  function openWorkoutPicker(index) {
    if (isTouchLocked) return;
    setWorkoutPickerLaneIndex(index);
  }

  function closeWorkoutPicker() {
    setWorkoutPickerLaneIndex(null);
  }

  function selectWorkoutFromDropdown(workoutId) {
    if (workoutPickerLaneIndex === null) return;
    setLaneWorkout(workoutPickerLaneIndex, workoutId);
    closeWorkoutPicker();
  }

  function runRemoteCommand(commandType) {
    if (!isOnline) return;
    if (remoteLaneIndex < 0 || remoteLaneIndex >= lanes.length) return;
    if (commandType === 'start') {
      ensureFullscreenMode();
      startLane(remoteLaneIndex);
    }
    if (commandType === 'pauseToggle') pauseLane(remoteLaneIndex);
    if (commandType === 'restart') restartLane(remoteLaneIndex);
    if (commandType === 'skip') skipLane(remoteLaneIndex);
    if (commandType === 'reset') resetLane(remoteLaneIndex);
  }

  if (commerceQuery.isLoading || controlQuery.isLoading) {
    return <LoadingBlock label="Antrenman ekrani yukleniyor..." />;
  }

  if (commerceQuery.isError || controlQuery.isError || !commerceQuery.data) {
    return (
      <ScreenLayout title="Antrenman Ekrani" subtitle="Veri alinirken hata olustu.">
        <EmptyState
          title="Antrenman ekrani acilamadi"
          description={commerceQuery.error?.message || controlQuery.error?.message || 'Workout veya kontrol verileri okunurken hata olustu.'}
        />
        <ActionButton label="Tekrar Dene" onPress={() => {
          commerceQuery.refetch();
          controlQuery.refetch();
        }} fullWidth />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      title="Antrenman Ekrani"
      subtitle="Kulvar ve sayac kontrolu"
      scroll={false}
    >
      <StatusBar style={isFullscreenMode ? 'light' : 'dark'} hidden={isFullscreenMode} animated />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.stack}>
        <View style={styles.versionTagCard}>
          <Text style={styles.versionTagText}>YENI SURUM AKTIF - 20.03.2026 / V3</Text>
        </View>

        <SectionHeader title="🏁 Kulvar" caption="" />
        <View style={styles.card}>
          <View style={styles.chipRow}>
            {laneOptions.map((item) => (
              <ActionButton
                key={`lane-${item}`}
                label={`${item} Kulvar`}
                variant={laneCount === item ? 'primary' : 'secondary'}
                onPress={withTouchLock(() => updateLaneCount(item))}
              />
            ))}
          </View>
          <ActionButton label={isFullscreenMode ? 'Tam Ekrandan Cik' : 'Tam Ekran Ac'} onPress={withTouchLock(() => {
            if (isFullscreenMode) {
              exitFullscreenTraining();
              return;
            }
            enterFullscreenTraining();
          })} fullWidth />
        </View>

        <SectionHeader title="⏱️ Kontroller" caption="" />
        <View style={styles.card}>
          {!isOnline ? (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineBannerTitle}>Offline mod aktif</Text>
              <Text style={styles.offlineBannerText}>Kayitli workoutlar ve sayaç yerel olarak calisir. Uzaktan kontrol gecici olarak kapatildi.</Text>
            </View>
          ) : null}
          <View style={styles.startCenterWrap}>
            <ActionButton label="Start" onPress={startAllLanes} />
          </View>
          <View style={styles.actionRow}>
            <ActionButton label="Duraklat" variant="secondary" onPress={withTouchLock(pauseAllLanes)} />
            <ActionButton label="Durdur" variant="secondary" onPress={withTouchLock(resetAllLanes)} />
            <ActionButton label="Tekrar Baslat" variant="secondary" onPress={withTouchLock(restartAllLanes)} />
          </View>
        </View>

        <SectionHeader title="🎯 Workout Kutuphanesi" caption="" />
        <View style={styles.card}>
          {!workouts.length ? (
            <EmptyState title="Workout yok" description="Antrenman ve Market ekranindan workout ekleyin." />
          ) : workouts.map((workout) => (
            <View key={workout.id} style={styles.workoutRow}>
              <Text style={styles.workoutLabel}>{workout.source === 'library' ? 'Satin Alinan' : 'Kendi'} | {workout.name}</Text>
              <ActionButton
                label="Sil"
                variant="secondary"
                onPress={withTouchLock(() => {
                  if (workout.source === 'library') {
                    removeLibraryMutation.mutate({ libraryItemId: workout.sourceId });
                    return;
                  }
                  removeWorkoutMutation.mutate(workout.sourceId);
                })}
              />
            </View>
          ))}
        </View>

        <SectionHeader title="🎮 Kulvarlar" caption="" />
        <View
          style={[
            styles.lanesGrid,
            {
              justifyContent: standardColumns === 1 ? 'center' : 'space-between',
            },
          ]}
        >
          {lanes.map((lane, index) => {
            const selectedWorkout = workouts.find((item) => item.id === lane.selectedWorkoutId) || null;
            const plan = buildPlan(selectedWorkout?.exercises);
            const currentSet = plan[lane.setIndex] || null;
            const nextSet = plan[lane.setIndex + 1] || null;
            const visualState = getVisualState(lane);
            const showNextSetPreview = Boolean(lane.isRunning && lane.phase === 'rest' && lane.remainingSeconds <= 10 && lane.remainingSeconds >= 6 && nextSet);
            const statusText = getStatusText(lane);
            const currentSetLabel = currentSet ? `${currentSet.reps} x ${currentSet.distance}m ${currentSet.style}` : 'Workout sec';
            const currentTurLabel = currentSet ? `${lane.repIndex}/${currentSet.reps}` : '-';

            return (
              <View
                key={`lane-card-${index}`}
                style={[
                  styles.laneCard,
                  { width: standardLaneWidth, minHeight: standardLaneMinHeight },
                  visualState === 'success' ? styles.laneCardSuccess : null,
                  visualState === 'warning' ? styles.laneCardWarning : null,
                  visualState === 'danger' ? styles.laneCardDanger : null,
                  visualState === 'rest' ? styles.laneCardRest : null,
                ]}
              >
                <View style={styles.laneCardTop}>
                  <Text style={[styles.laneTitle, { fontSize: standardLaneTitleFontSize, lineHeight: standardLaneTitleFontSize + 4 }]}>🏊 Kulvar {index + 1}</Text>
                  <Text
                    style={[styles.laneWorkoutHeadline, { fontSize: standardHeadlineFontSize, lineHeight: standardHeadlineFontSize + 4 }]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    {currentSetLabel}
                  </Text>
                  <Text style={[styles.laneMeta, { fontSize: standardMetaFontSize, lineHeight: standardMetaFontSize + 4 }]}>Set {plan.length ? `${lane.setIndex + 1}/${plan.length}` : '-'} | Tur {currentTurLabel}</Text>
                  <Text style={[styles.laneMeta, { fontSize: standardMetaFontSize, lineHeight: standardMetaFontSize + 4 }]}>Durum: {statusText}</Text>
                </View>

                <View style={styles.laneTimerCenter}>
                  <Text style={[
                    styles.laneTimer,
                    { fontSize: standardTimerFontSize, lineHeight: standardTimerFontSize + 6 },
                    visualState === 'success' ? styles.laneTimerSuccess : null,
                    visualState === 'warning' ? styles.laneTimerWarning : null,
                    visualState === 'danger' ? styles.laneTimerDanger : null,
                    visualState === 'rest' ? styles.laneTimerRest : null,
                    showNextSetPreview ? styles.hiddenTimer : null,
                  ]}
                  adjustsFontSizeToFit
                  minimumFontScale={0.55}
                  >{formatClock(lane.remainingSeconds)}</Text>
                  {showNextSetPreview ? (
                    <View style={styles.nextSetOverlay}>
                      <Text style={styles.nextSetOverlayLead}>SIRADAKI</Text>
                      <Text style={styles.nextSetBannerLabel}>SIRADAKI HAREKET</Text>
                      <Text
                        style={[
                          styles.nextSetBannerText,
                          { fontSize: Math.max(18, Math.min(standardHeadlineFontSize, 24)), lineHeight: Math.max(24, Math.min(standardHeadlineFontSize + 6, 30)) },
                        ]}
                        adjustsFontSizeToFit
                        minimumFontScale={0.72}
                      >
                        {nextSet.reps} x {nextSet.distance}m {nextSet.style}
                      </Text>
                      <Text style={styles.nextSetBannerSubText}>Tur hazirligi basliyor</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.laneCardBottom}>
                  <View style={styles.lanePickerRow}>
                    <Pressable style={styles.dropdownButton} onPress={withTouchLock(() => openWorkoutPicker(index))}>
                      <Text style={styles.dropdownButtonText}>{selectedWorkout?.name || 'Workout sec'}</Text>
                      <Text style={styles.dropdownChevron}>▼</Text>
                    </Pressable>
                  </View>

                  <View style={styles.actionRow}>
                    <ActionButton label={lane.isRunning ? (lane.isPaused ? 'Devam Et' : 'Duraklat') : 'Baslat'} onPress={() => {
                      if (!lane.isRunning) {
                        ensureFullscreenMode();
                        startLane(index);
                        return;
                      }
                      if (isTouchLocked) return;
                      pauseLane(index);
                    }} />
                    <ActionButton label="Yeniden Baslat" variant="secondary" onPress={withTouchLock(() => restartLane(index))} />
                    <ActionButton label="Atlat" variant="secondary" onPress={withTouchLock(() => skipLane(index))} />
                    <ActionButton label="Sifirla" variant="secondary" onPress={withTouchLock(() => resetLane(index))} />
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {isOnline ? (
          <>
            <SectionHeader title="🕹️ Uzaktan Kontrol" caption="" />
            <View style={styles.card}>
              <View style={styles.chipRow}>
                {Array.from({ length: laneCount }, (_, index) => (
                  <ActionButton
                    key={`remote-lane-${index}`}
                    label={`Kulvar ${index + 1}`}
                    variant={remoteLaneIndex === index ? 'primary' : 'secondary'}
                    onPress={withTouchLock(() => setRemoteLaneIndex(index))}
                  />
                ))}
              </View>
              <Text style={styles.remoteInfoText}>Secili kulvar: {remoteLaneIndex + 1}</Text>
              <View style={styles.actionRow}>
                <ActionButton label="Baslat" onPress={() => runRemoteCommand('start')} />
                <ActionButton label="Duraklat" variant="secondary" onPress={withTouchLock(() => runRemoteCommand('pauseToggle'))} />
                <ActionButton label="Yeniden Baslat" variant="secondary" onPress={withTouchLock(() => runRemoteCommand('restart'))} />
                <ActionButton label="Atlat" variant="secondary" onPress={withTouchLock(() => runRemoteCommand('skip'))} />
                <ActionButton label="Sifirla" variant="secondary" onPress={withTouchLock(() => runRemoteCommand('reset'))} />
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>

      {isTouchLocked ? (
        <View pointerEvents="auto" style={styles.touchLockOverlay}>
          <Text style={styles.touchLockText}>Dokunma kapali</Text>
          <Text style={styles.touchLockSubText}>Acmak icin asagidaki butonu kullan.</Text>
          <View style={styles.touchLockButtonWrap}>
            <ActionButton label="Dokunma Ac" onPress={() => setIsTouchLocked(false)} fullWidth />
          </View>
        </View>
      ) : null}

      <Modal
        visible={isFullscreenMode}
        animationType="fade"
        transparent={false}
        hardwareAccelerated
        statusBarTranslucent
        navigationBarTranslucent
        presentationStyle="fullScreen"
        supportedOrientations={['landscape']}
        onShow={() => applyFullscreenSystemUi().catch(() => null)}
        onRequestClose={exitFullscreenTraining}
      >
        <StatusBar style="light" hidden animated />
        <View style={styles.fullscreenRoot}>
          <View style={styles.fullscreenHeader}>
            <Text style={styles.fullscreenTitle}>Antrenman Buyuk Ekran</Text>
            <View style={styles.fullscreenHeaderRight}>
              <Pressable style={styles.fullscreenLockButton} onPress={() => setIsTouchLocked((value) => !value)}>
                <Text style={styles.fullscreenCloseText}>{isTouchLocked ? 'Dokunma Ac' : 'Dokunma Kapat'}</Text>
              </Pressable>
              <Pressable style={styles.fullscreenClose} onPress={withTouchLock(exitFullscreenTraining)}>
                <Text style={styles.fullscreenCloseText}>Kapat</Text>
              </Pressable>
            </View>
          </View>

          <View
            style={[
              styles.fullscreenGrid,
              {
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: fullscreenColumns === 1 ? 'center' : 'space-between',
              },
            ]}
          >
            {lanes.map((lane, index) => {
              const selectedWorkout = workouts.find((item) => item.id === lane.selectedWorkoutId) || null;
              const plan = buildPlan(selectedWorkout?.exercises);
              const currentSet = plan[lane.setIndex] || null;
              const nextSet = plan[lane.setIndex + 1] || null;
              const visualState = getVisualState(lane);
              const showNextSetPreview = Boolean(lane.isRunning && lane.phase === 'rest' && lane.remainingSeconds <= 10 && lane.remainingSeconds >= 6 && nextSet);
              const currentSetLabel = currentSet ? `${currentSet.reps} x ${currentSet.distance}m ${currentSet.style}` : 'Workout sec';
              const statusText = getStatusText(lane);

              return (
                <View
                  key={`fullscreen-lane-${index}`}
                  style={[
                    styles.fullscreenLane,
                    { width: fullscreenLaneWidth, minHeight: fullscreenLaneMinHeight },
                    visualState === 'success' ? styles.fullscreenLaneSuccess : null,
                    visualState === 'warning' ? styles.fullscreenLaneWarning : null,
                    visualState === 'danger' ? styles.fullscreenLaneDanger : null,
                    visualState === 'rest' ? styles.fullscreenLaneRest : null,
                  ]}
                >
                  <View style={styles.fullscreenLaneTop}>
                    <Text style={styles.fullscreenLaneTitle}>Kulvar {index + 1}</Text>
                    <Text
                      style={[
                        styles.fullscreenLaneWorkout,
                        { fontSize: fullscreenHeadlineFontSize, lineHeight: fullscreenHeadlineFontSize + 4 },
                      ]}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {currentSetLabel}
                    </Text>
                    <Text style={[styles.fullscreenLaneMeta, { fontSize: fullscreenMetaFontSize, lineHeight: fullscreenMetaFontSize + 4 }]}>Set {plan.length ? `${lane.setIndex + 1}/${plan.length}` : '-'} | Tur {currentSet ? `${lane.repIndex}/${currentSet.reps}` : '-'}</Text>
                    <Text style={[styles.fullscreenLaneMeta, { fontSize: fullscreenMetaFontSize, lineHeight: fullscreenMetaFontSize + 4 }]}>Durum: {statusText}</Text>
                    {showNextSetPreview ? <Text style={[styles.fullscreenLaneMeta, { fontSize: fullscreenMetaFontSize, lineHeight: fullscreenMetaFontSize + 4 }]}>Siradaki: {nextSet.reps} x {nextSet.distance} {nextSet.style}</Text> : null}
                  </View>

                  <View style={styles.fullscreenLaneCenter}>
                    <Text style={[styles.fullscreenLaneTimer, { fontSize: fullscreenTimerFontSize, lineHeight: fullscreenTimerFontSize + 6 }, showNextSetPreview ? styles.hiddenTimer : null]}>{formatClock(lane.remainingSeconds)}</Text>
                    {showNextSetPreview ? (
                      <View style={styles.fullscreenPreviewOverlay}>
                        <Text style={styles.fullscreenPreviewLead}>SIRADAKI</Text>
                        <Text style={[styles.fullscreenPreviewText, { fontSize: fullscreenHeadlineFontSize + 4, lineHeight: fullscreenHeadlineFontSize + 10 }]}>{nextSet.reps} x {nextSet.distance}m {nextSet.style}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.fullscreenLaneBottomActions}>
                    <Pressable style={styles.fullscreenMiniBtn} onPress={withTouchLock(() => pauseLane(index))}>
                      <Text style={styles.fullscreenMiniBtnText}>Duraklat</Text>
                    </Pressable>
                    <Pressable style={styles.fullscreenMiniBtn} onPress={withTouchLock(() => skipLane(index))}>
                      <Text style={styles.fullscreenMiniBtnText}>Atla</Text>
                    </Pressable>
                    <Pressable style={styles.fullscreenMiniBtn} onPress={withTouchLock(() => resetLane(index))}>
                      <Text style={styles.fullscreenMiniBtnText}>Sifirla</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </Modal>

      <Modal visible={workoutPickerLaneIndex !== null} animationType="fade" transparent onRequestClose={closeWorkoutPicker}>
        <Pressable style={styles.dropdownBackdrop} onPress={closeWorkoutPicker}>
          <Pressable style={styles.dropdownSheet} onPress={() => null}>
            <Text style={styles.dropdownTitle}>Kulvar {workoutPickerLaneIndex !== null ? workoutPickerLaneIndex + 1 : ''} Antrenman Sec</Text>
            <ScrollView style={styles.dropdownList} contentContainerStyle={styles.dropdownListContent}>
              {workouts.map((workout) => (
                <Pressable key={`dropdown-workout-${workout.id}`} style={styles.dropdownItem} onPress={() => selectWorkoutFromDropdown(workout.id)}>
                  <Text style={styles.dropdownItemText}>{workout.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <ActionButton label="Kapat" variant="secondary" onPress={closeWorkoutPicker} fullWidth />
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
    paddingBottom: 24,
    backgroundColor: swimUi.dark,
  },
  versionTagCard: {
    backgroundColor: '#dff4ff',
    borderWidth: 1,
    borderColor: '#7bb7de',
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    ...theme.shadow.card,
  },
  versionTagText: {
    color: '#0b4672',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  touchLockCard: {
    backgroundColor: '#f2f8ff',
    borderWidth: 1,
    borderColor: '#c8def8',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 8,
    ...theme.shadow.card,
  },
  touchLockTitle: {
    color: '#18406f',
    fontWeight: '900',
    fontSize: 18,
  },
  touchLockInfo: {
    color: '#355f8f',
    fontWeight: '700',
    fontSize: 14,
  },
  card: {
    backgroundColor: swimUi.card,
    borderWidth: 1,
    borderColor: '#d1e3f8',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 10,
    ...theme.shadow.card,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  startCenterWrap: {
    alignItems: 'center',
  },
  workoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d4e4f8',
    borderRadius: 12,
    backgroundColor: '#f3f9ff',
    padding: 10,
    gap: 10,
  },
  workoutLabel: {
    color: '#1e4672',
    fontWeight: '700',
    flex: 1,
  },
  lanesGrid: {
    gap: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  laneCard: {
    borderWidth: 1,
    borderColor: '#c5dbf3',
    backgroundColor: '#edf5ff',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: 8,
  },
  laneCardSuccess: {
    borderColor: '#7fd4b2',
    backgroundColor: '#e9f8f1',
  },
  laneCardWarning: {
    borderColor: '#f8c17b',
    backgroundColor: '#fff5e9',
  },
  laneCardDanger: {
    borderColor: '#f0a5a5',
    backgroundColor: '#ffefef',
  },
  laneCardRest: {
    borderColor: '#c29bff',
    backgroundColor: '#f4ecff',
  },
  laneTitle: {
    color: '#1f4d7a',
    fontWeight: '900',
    fontSize: 16,
  },
  laneWorkoutHeadline: {
    color: '#12385f',
    fontWeight: '900',
    fontSize: 24,
    lineHeight: 28,
    textAlign: 'center',
  },
  laneTimer: {
    color: '#0f6fb3',
    fontWeight: '900',
    textAlign: 'center',
    alignSelf: 'center',
  },
  laneTimerSuccess: {
    color: '#00a85a',
  },
  laneTimerWarning: {
    color: '#d88400',
  },
  laneTimerDanger: {
    color: '#d11d1d',
  },
  laneTimerRest: {
    color: '#7b38d8',
  },
  hiddenTimer: {
    opacity: 0.12,
  },
  laneCardTop: {
    gap: 3,
    alignItems: 'center',
  },
  laneTimerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  laneCardBottom: {
    gap: 8,
  },
  laneMeta: {
    color: '#2f5e8f',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 22,
  },
  nextSetBanner: {
    backgroundColor: '#e8f4ff',
    borderColor: '#9dcaf2',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
    alignItems: 'center',
  },
  nextSetOverlay: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: 'rgba(28, 12, 56, 0.92)',
    borderWidth: 2,
    borderColor: '#b990ff',
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  nextSetOverlayLead: {
    color: '#f3e9ff',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 1,
  },
  nextSetBannerLabel: {
    color: '#2a5f93',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.7,
  },
  nextSetBannerText: {
    color: '#1c4e7f',
    fontWeight: '900',
    fontSize: 24,
    textAlign: 'center',
  },
  nextSetBannerSubText: {
    color: '#4c7295',
    fontWeight: '700',
    fontSize: 13,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  offlineBanner: {
    backgroundColor: '#fff4df',
    borderColor: '#f2cf8e',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  offlineBannerTitle: {
    color: '#8a5400',
    fontWeight: '900',
    fontSize: 16,
  },
  offlineBannerText: {
    color: '#8a6a32',
    fontWeight: '600',
    lineHeight: 18,
  },
  lanePickerRow: {
    marginTop: 4,
  },
  dropdownButton: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#b5d0ed',
    borderRadius: 10,
    backgroundColor: '#f2f8ff',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownButtonText: {
    color: '#224f7f',
    fontWeight: '700',
    flex: 1,
    marginRight: 10,
  },
  dropdownChevron: {
    color: '#4e79a6',
    fontWeight: '900',
  },
  touchLockOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(3, 10, 20, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  touchLockText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 28,
  },
  touchLockSubText: {
    color: '#d7ebff',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
  },
  touchLockButtonWrap: {
    width: '80%',
    marginTop: 12,
  },
  fullscreenRoot: {
    flex: 1,
    backgroundColor: '#051325',
    padding: 14,
    gap: 10,
  },
  fullscreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fullscreenHeaderRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  fullscreenTitle: {
    color: '#9cccf7',
    fontWeight: '900',
    fontSize: 24,
  },
  fullscreenClose: {
    borderWidth: 1,
    borderColor: '#2b5f93',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#0b2742',
  },
  fullscreenLockButton: {
    borderWidth: 1,
    borderColor: '#2b5f93',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#0b2742',
  },
  fullscreenCloseText: {
    color: '#d6eaff',
    fontWeight: '700',
  },
  fullscreenGrid: {
    flex: 1,
    gap: fullscreenGridGap,
  },
  fullscreenLane: {
    borderWidth: 1,
    borderColor: '#2a4d80',
    backgroundColor: '#0f2f57',
    borderRadius: 14,
    padding: 10,
    gap: 8,
    minHeight: 190,
  },
  fullscreenLaneSuccess: {
    borderColor: '#14c97b',
    backgroundColor: '#0d4b37',
  },
  fullscreenLaneWarning: {
    borderColor: '#ff8a00',
    backgroundColor: '#7a3a00',
  },
  fullscreenLaneDanger: {
    borderColor: '#c00000',
    backgroundColor: '#5a0000',
  },
  fullscreenLaneRest: {
    borderColor: '#d0a4ff',
    backgroundColor: '#32114d',
  },
  fullscreenLaneTitle: {
    color: '#9dd5ff',
    fontWeight: '900',
    fontSize: 20,
  },
  fullscreenLaneWorkout: {
    color: '#eaf4ff',
    fontWeight: '900',
    fontSize: 30,
    lineHeight: 34,
    textAlign: 'center',
  },
  fullscreenLaneTimer: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 140,
    lineHeight: 146,
    textAlign: 'center',
  },
  fullscreenPreviewOverlay: {
    width: '100%',
    borderRadius: 22,
    backgroundColor: 'rgba(8, 4, 20, 0.94)',
    borderWidth: 2,
    borderColor: '#cf9fff',
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fullscreenPreviewLead: {
    color: '#f5eefe',
    fontWeight: '900',
    fontSize: 22,
    letterSpacing: 1.5,
  },
  fullscreenPreviewText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 34,
    lineHeight: 40,
    textAlign: 'center',
  },
  fullscreenLaneTop: {
    alignItems: 'center',
    gap: 2,
  },
  fullscreenLaneCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenLaneBottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  fullscreenMiniBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2f79bf',
    backgroundColor: '#0f3a66',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenMiniBtnText: {
    color: '#e8f4ff',
    fontWeight: '900',
  },
  fullscreenLaneMeta: {
    color: '#d2e9fb',
    fontWeight: '700',
    fontSize: 20,
    textAlign: 'center',
  },
  remoteInfoText: {
    color: '#376391',
    fontWeight: '700',
  },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 10, 20, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  dropdownSheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '72%',
    backgroundColor: '#0f1f38',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#35629c',
    padding: 12,
    gap: 10,
  },
  dropdownTitle: {
    color: '#d9edff',
    fontWeight: '900',
    fontSize: 18,
  },
  dropdownList: {
    maxHeight: 300,
  },
  dropdownListContent: {
    gap: 8,
  },
  dropdownItem: {
    borderWidth: 1,
    borderColor: '#365f93',
    borderRadius: 10,
    backgroundColor: '#123053',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownItemText: {
    color: '#e4f2ff',
    fontWeight: '700',
  },
});