import { useEffect, useCallback } from 'react';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'bb_onboarding_complete';

interface OnboardingState {
  complete: boolean | null;
  _hydrated: boolean;
  _hydrate: () => Promise<void>;
  markComplete: () => Promise<void>;
  reset: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  complete: null,
  _hydrated: false,

  _hydrate: async () => {
    const val = await AsyncStorage.getItem(KEY);
    set({ complete: val === 'true', _hydrated: true });
  },

  markComplete: async () => {
    await AsyncStorage.setItem(KEY, 'true');
    set({ complete: true });
  },

  reset: async () => {
    await AsyncStorage.removeItem(KEY);
    set({ complete: false });
  },
}));

export function useOnboarding() {
  const store = useOnboardingStore();

  useEffect(() => {
    if (!store._hydrated) {
      store._hydrate();
    }
  }, [store]);

  const markComplete = useCallback(() => store.markComplete(), [store]);
  const reset = useCallback(() => store.reset(), [store]);

  return { complete: store.complete, markComplete, reset };
}
