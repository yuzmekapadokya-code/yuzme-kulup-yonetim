import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const initialState = {
  status: 'loading',
  bootstrapped: false,
  firebaseUser: null,
  profile: null,
};

export const useAuthStore = create(
  persist(
    (set) => ({
      ...initialState,
      setLoading: () => set({ status: 'loading' }),
      setSession: ({ firebaseUser, profile }) =>
        set({
          status: profile ? 'authenticated' : 'guest',
          bootstrapped: true,
          firebaseUser,
          profile,
        }),
      setGuest: () =>
        set({
          status: 'guest',
          bootstrapped: true,
          firebaseUser: null,
          profile: null,
        }),
      reset: () => set({ ...initialState, bootstrapped: true, status: 'guest' }),
    }),
    {
      name: 'yuzme-mobile-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        profile: state.profile,
        status: state.status,
        bootstrapped: state.bootstrapped,
      }),
    }
  )
);