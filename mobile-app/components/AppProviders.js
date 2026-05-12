import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { db } from '../config/firebase';
import { registerPushToken } from '../services/notificationService';
import { useAuthStore } from '../store/authStore';
import { theme } from '../config/theme';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.text,
    border: theme.colors.border,
    primary: theme.colors.primary,
  },
};

export default function AppProviders({ children }) {
  const profile = useAuthStore((state) => state.profile);

  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
            staleTime: 60 * 1000,
            gcTime: 15 * 60 * 1000,
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
          },
          mutations: {
            retry: 1,
          },
        },
      }),
    []
  );

  useEffect(() => {
    onlineManager.setEventListener((setOnline) =>
      NetInfo.addEventListener((state) => {
        setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
      })
    );
  }, []);

  useEffect(() => {
    const persister = createAsyncStoragePersister({ storage: AsyncStorage });

    persistQueryClient({
      queryClient,
      persister,
      maxAge: 24 * 60 * 60 * 1000,
    });
  }, [queryClient]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        queryClient.refetchQueries({ type: 'active', stale: true });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [queryClient]);

  useEffect(() => {
    if (!profile?.uid) {
      return undefined;
    }

    registerPushToken(profile).catch((error) => {
      console.warn('Push token kaydedilemedi:', error.message);
    });

    return undefined;
  }, [profile]);

  useEffect(() => {
    if (!profile?.uid) {
      return undefined;
    }

    const unsubs = [];
    let invalidateTimer = null;
    const pendingPrefixes = new Set();

    function invalidateByPrefix(prefix) {
      queryClient.invalidateQueries({
        predicate: (queryState) =>
          Array.isArray(queryState.queryKey)
          && typeof queryState.queryKey[0] === 'string'
          && queryState.queryKey[0].startsWith(prefix),
      });
    }

    function scheduleInvalidate(prefixes) {
      prefixes.forEach((prefix) => pendingPrefixes.add(prefix));

      if (invalidateTimer) {
        return;
      }

      invalidateTimer = setTimeout(() => {
        const prefixesToInvalidate = Array.from(pendingPrefixes);
        pendingPrefixes.clear();
        invalidateTimer = null;
        prefixesToInvalidate.forEach((prefix) => invalidateByPrefix(prefix));
      }, 500);
    }

    function watchCollection(collectionName, adminId, prefixes) {
      const sourceQuery = adminId
        ? query(collection(db, collectionName), where('adminId', '==', adminId))
        : query(collection(db, collectionName));
      let initialized = false;

      const unsub = onSnapshot(
        sourceQuery,
        () => {
          if (!initialized) {
            initialized = true;
            return;
          }

          scheduleInvalidate(prefixes);
        },
        () => null
      );

      unsubs.push(unsub);
    }

    if (profile.role === 'admin') {
      const adminCollections = [
        'branches',
        'trainers',
        'schedules',
        'students',
        'prices',
        'payments',
        'incomes',
        'expenses',
        'discounts',
        'announcements',
        'trainer_time_programs',
        'trainer_time_preferences',
        'attendance',
        'trainer_reviews',
        'users',
      ];

      adminCollections.forEach((name) => watchCollection(name, profile.uid, ['ad-']));
      watchCollection('events', null, ['ad-']);
      watchCollection('standards', null, ['ad-']);
      watchCollection('products', null, ['ad-']);
    }

    if (profile.role === 'secretary') {
      const adminId = profile.adminId || profile.uid;
      const secretaryCollections = ['branches', 'schedules', 'trainers', 'students', 'prices', 'discounts', 'payments', 'chats', 'announcements', 'events'];
      secretaryCollections.forEach((name) => watchCollection(name, adminId, ['sec-']));
    }

    if (profile.role === 'trainer') {
      const adminId = profile.adminId || profile.uid;
      const trainerCollections = ['schedules', 'students', 'attendance', 'lesson_comments', 'performances', 'trainer_time_programs', 'trainer_time_preferences', 'workouts', 'student_workouts', 'workout_sales', 'notifications', 'orders'];
      trainerCollections.forEach((name) => watchCollection(name, adminId, ['tr-']));
      watchCollection('products', null, ['tr-']);
      watchCollection('events', null, ['tr-']);
      watchCollection('standards', null, ['tr-']);
    }

    if (profile.role === 'parent') {
      const adminId = profile.adminId || profile.uid;
      const parentCollections = ['students', 'payments', 'attendance', 'performances', 'lesson_comments', 'announcements', 'orders', 'notifications', 'events'];
      parentCollections.forEach((name) => watchCollection(name, adminId, ['pr-']));
      watchCollection('products', null, ['pr-']);
      watchCollection('standards', null, ['pr-']);
    }

    return () => {
      if (invalidateTimer) {
        clearTimeout(invalidateTimer);
        invalidateTimer = null;
      }
      unsubs.forEach((unsub) => unsub());
    };
  }, [profile?.uid, profile?.role, profile?.adminId, queryClient]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer theme={navigationTheme}>
            <StatusBar style="dark" />
            {children}
          </NavigationContainer>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}