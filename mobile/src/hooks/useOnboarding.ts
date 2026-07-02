import { useEffect, useCallback } from 'react';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../stores/authStore';
import { scopedKey } from '../services/scopedStorage';

const KEY = 'bb_onboarding_complete';

interface OnboardingState {
  complete: boolean | null;
  _hydrate: () => Promise<void>;
  markComplete: () => Promise<void>;
  reset: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  complete: null,

  _hydrate: async () => {
    const val = await AsyncStorage.getItem(scopedKey(KEY));
    set({ complete: val === 'true' });
  },

  markComplete: async () => {
    await AsyncStorage.setItem(scopedKey(KEY), 'true');
    set({ complete: true });
  },

  reset: async () => {
    await AsyncStorage.removeItem(scopedKey(KEY));
    set({ complete: false });
  },
}));

export function useOnboarding() {
  const store = useOnboardingStore();
  // Re-hydrate whenever the signed-in user changes, so switching accounts
  // on the same device reloads that account's own onboarding state instead
  // of leaving the previous user's state in memory.
  const authUserId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    useOnboardingStore.getState()._hydrate();
  }, [authUserId]);

  const markComplete = useCallback(() => store.markComplete(), [store]);
  const reset = useCallback(() => store.reset(), [store]);

  return { complete: store.complete, markComplete, reset };
}
