import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';

import { flushOfflineQueue } from '../services/offlineSyncService';

export function useNetworkStatus() {
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        flushOfflineQueue().catch((error) => {
          console.warn('Offline queue flush failed:', error.message);
        });
      }
    });

    return unsubscribe;
  }, []);
}