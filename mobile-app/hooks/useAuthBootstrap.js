import { onAuthStateChanged } from 'firebase/auth';
import { useEffect } from 'react';

import { auth } from '../config/firebase';
import { buildUserProfile } from '../services/profileService';
import { useAuthStore } from '../store/authStore';

export function useAuthBootstrap() {
  const setLoading = useAuthStore((state) => state.setLoading);
  const setSession = useAuthStore((state) => state.setSession);
  const setGuest = useAuthStore((state) => state.setGuest);

  useEffect(() => {
    setLoading();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setGuest();
        return;
      }

      try {
        const profile = await buildUserProfile(firebaseUser);

        if (!profile || profile.frozen) {
          setGuest();
          return;
        }

        setSession({ firebaseUser, profile });
      } catch (error) {
        console.error('Auth bootstrap failed:', error);
        setGuest();
      }
    });

    return unsubscribe;
  }, [setGuest, setLoading, setSession]);
}