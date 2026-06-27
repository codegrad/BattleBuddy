import { useEffect, useState, useCallback } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean>(true);

  useEffect(() => {
    return NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(state.isConnected ?? true);
    });
  }, []);

  const checkNow = useCallback(async (): Promise<boolean> => {
    const state = await NetInfo.fetch();
    const connected = state.isConnected ?? true;
    setIsConnected(connected);
    return connected;
  }, []);

  return { isConnected, checkNow };
}

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected ?? true;
}
