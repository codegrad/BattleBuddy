import { useAuthStore } from '../stores/authStore';

/**
 * Namespaces a local-storage key by the currently signed-in user, so
 * locally cached data (profile summary, session history, onboarding
 * state, last-outcome) can never bleed across accounts on a shared
 * device. Falls back to the bare key when no one is signed in yet.
 */
export function scopedKey(base: string): string {
  const userId = useAuthStore.getState().user?.id;
  return userId ? `${base}:${userId}` : base;
}
