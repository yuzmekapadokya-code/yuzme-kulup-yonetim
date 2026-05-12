import { useEffect } from 'react';

import AppProviders from '../components/AppProviders';
import RootNavigator from '../navigation/RootNavigator';
import { useAuthBootstrap } from '../hooks/useAuthBootstrap';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { startIncomingCallWatcher, stopIncomingCallWatcher } from '../realtime/callRealtime';
import { useAuthStore } from '../store/authStore';

function BootstrapBoundary() {
  useAuthBootstrap();
  useNetworkStatus();

  const profile = useAuthStore((state) => state.profile);

  useEffect(() => {
    if (!profile?.uid) {
      stopIncomingCallWatcher();
      return undefined;
    }

    const unsubscribe = startIncomingCallWatcher(profile);
    return () => {
      unsubscribe?.();
      stopIncomingCallWatcher();
    };
  }, [profile]);

  return <RootNavigator />;
}

export default function AppEntry() {
  return (
    <AppProviders>
      <BootstrapBoundary />
    </AppProviders>
  );
}