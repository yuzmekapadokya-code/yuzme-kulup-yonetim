import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const useOfflineQueueStore = create(
  persist(
    (set, get) => ({
      queue: [],
      addJob: (job) => set({ queue: [...get().queue, job] }),
      replaceQueue: (queue) => set({ queue }),
      clearQueue: () => set({ queue: [] }),
    }),
    {
      name: 'yuzme-mobile-offline-queue',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);