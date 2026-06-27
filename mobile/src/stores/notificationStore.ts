import { create } from 'zustand';

export interface NotificationPreferences {
  checkInEnabled: boolean;
  streakEnabled: boolean;
  reEngageEnabled: boolean;
  checkInTime1: string; // HH:MM
  checkInTime2: string;
  quietStart: string;
  quietEnd: string;
  timezone: string;
}

interface NotificationState extends NotificationPreferences {
  loaded: boolean;
  setPreference: <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K],
  ) => void;
  loadDefaults: () => void;
}

const DEFAULTS: NotificationPreferences = {
  checkInEnabled: true,
  streakEnabled: true,
  reEngageEnabled: true,
  checkInTime1: '13:00',
  checkInTime2: '19:00',
  quietStart: '22:00',
  quietEnd: '08:00',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

export const useNotificationStore = create<NotificationState>((set) => ({
  ...DEFAULTS,
  loaded: false,

  setPreference: (key, value) => set({ [key]: value }),

  loadDefaults: () => set({ ...DEFAULTS, loaded: true }),
}));
