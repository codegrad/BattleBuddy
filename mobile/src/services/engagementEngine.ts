/**
 * Engagement Engine — the proactive outreach state machine.
 *
 * States:
 *   idle → window_open → (self_engaged | nudge_sent) → cooldown → idle
 *
 * An anomaly (biometric signal, time-based risk, etc.) opens an engagement window.
 * If the user self-engages (opens the app, starts a session) within the window,
 * it's logged as self-initiated and the window closes quietly.
 * If the window expires without engagement, the engine sends a nudge.
 *
 * The engagement window duration is a single system-wide config value.
 */

import { create } from 'zustand';
import { EngagementConfig, ApiConfig } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type EngagementState =
  | 'idle'
  | 'window_open'
  | 'self_engaged'
  | 'nudge_sent'
  | 'cooldown';

export type EngagementTriggerType =
  | 'biometric_anomaly'
  | 'risk_window'
  | 'scheduled_checkin'
  | 're_engagement';

export interface EngagementEvent {
  id: string;
  type: EngagementTriggerType;
  timestamp: number;
  context: Record<string, unknown>;
  resolution: 'self_engaged' | 'nudge_sent' | 'expired' | 'pending';
}

interface EngagementEngineState {
  state: EngagementState;
  currentEvent: EngagementEvent | null;
  lastNudgeAt: number | null;
  lastSessionEndAt: number | null;
  eventLog: EngagementEvent[];

  // Actions
  onAnomaly: (type: EngagementTriggerType, context?: Record<string, unknown>) => void;
  onUserSelfEngaged: () => void;
  onSessionEnd: () => void;
  onWindowExpired: () => void;
  onCooldownComplete: () => void;
}

let windowTimer: ReturnType<typeof setTimeout> | null = null;
let cooldownTimer: ReturnType<typeof setTimeout> | null = null;

export const useEngagementEngine = create<EngagementEngineState>((set, get) => ({
  state: 'idle',
  currentEvent: null,
  lastNudgeAt: null,
  lastSessionEndAt: null,
  eventLog: [],

  onAnomaly: (type, context = {}) => {
    const current = get();

    // Don't open a window if we're already in one, in cooldown, or nudged recently
    if (current.state !== 'idle') return;

    const now = Date.now();
    if (current.lastNudgeAt && now - current.lastNudgeAt < EngagementConfig.MIN_NUDGE_INTERVAL_MS) return;
    if (current.lastSessionEndAt && now - current.lastSessionEndAt < EngagementConfig.POST_SESSION_COOLDOWN_MS) return;

    const event: EngagementEvent = {
      id: `eng-${now}`,
      type,
      timestamp: now,
      context,
      resolution: 'pending',
    };

    set({ state: 'window_open', currentEvent: event });

    // Start the window timer
    if (windowTimer) clearTimeout(windowTimer);
    windowTimer = setTimeout(() => {
      get().onWindowExpired();
    }, EngagementConfig.WINDOW_DURATION_MS);
  },

  onUserSelfEngaged: () => {
    const current = get();
    if (current.state !== 'window_open' || !current.currentEvent) return;

    // User opened the app or started a session within the window — log as self-initiated
    if (windowTimer) { clearTimeout(windowTimer); windowTimer = null; }

    const resolved: EngagementEvent = {
      ...current.currentEvent,
      resolution: 'self_engaged',
    };

    set({
      state: 'self_engaged',
      currentEvent: null,
      eventLog: [...current.eventLog, resolved],
    });

    // Go straight to idle — no cooldown needed for self-engagement
    set({ state: 'idle' });
  },

  onWindowExpired: () => {
    const current = get();
    if (current.state !== 'window_open' || !current.currentEvent) return;

    windowTimer = null;
    const now = Date.now();

    const resolved: EngagementEvent = {
      ...current.currentEvent,
      resolution: 'nudge_sent',
    };

    set({
      state: 'nudge_sent',
      currentEvent: null,
      lastNudgeAt: now,
      eventLog: [...current.eventLog, resolved],
    });

    // Fire the push notification
    sendNudge(resolved).catch(() => {});

    // Enter cooldown
    set({ state: 'cooldown' });
    if (cooldownTimer) clearTimeout(cooldownTimer);
    cooldownTimer = setTimeout(() => {
      get().onCooldownComplete();
    }, EngagementConfig.POST_SESSION_COOLDOWN_MS);
  },

  onSessionEnd: () => {
    // A session just completed — enter cooldown regardless of state
    if (windowTimer) { clearTimeout(windowTimer); windowTimer = null; }

    set({
      state: 'cooldown',
      currentEvent: null,
      lastSessionEndAt: Date.now(),
    });

    if (cooldownTimer) clearTimeout(cooldownTimer);
    cooldownTimer = setTimeout(() => {
      get().onCooldownComplete();
    }, EngagementConfig.POST_SESSION_COOLDOWN_MS);
  },

  onCooldownComplete: () => {
    cooldownTimer = null;
    set({ state: 'idle' });
  },
}));

/**
 * Check if the engine should send a nudge. Called by the push notification system.
 * Returns the event context if a nudge should be sent, null otherwise.
 */
export function shouldNudge(): EngagementEvent | null {
  const state = useEngagementEngine.getState();
  if (state.state === 'nudge_sent' && state.eventLog.length > 0) {
    return state.eventLog[state.eventLog.length - 1];
  }
  return null;
}

/**
 * Send a nudge notification via the server.
 */
async function sendNudge(event: EngagementEvent): Promise<void> {
  try {
    const userId = await AsyncStorage.getItem('bb_current_user')
      .then(s => s ? JSON.parse(s).id : null)
      .catch(() => null);
    if (!userId) return;

    await fetch(`${ApiConfig.CHAT_URL}/nudge/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        type: event.type,
        anomalyContext: event.context,
      }),
    });
  } catch {}
}

/**
 * Load risk windows from the server and start hourly checks.
 * Call once on app launch.
 */
let riskCheckInterval: ReturnType<typeof setInterval> | null = null;
let cachedRiskWindows: Array<{ hour: number; day_of_week: number | null; weight: number; source: string }> = [];

export async function startRiskWindowMonitor(userId: string): Promise<() => void> {
  try {
    const res = await fetch(`${ApiConfig.CHAT_URL}/risk-windows/${userId}`);
    if (res.ok) {
      const data = await res.json();
      cachedRiskWindows = data.windows || [];
    }
  } catch {}

  if (riskCheckInterval) clearInterval(riskCheckInterval);

  const check = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    for (const rw of cachedRiskWindows) {
      if (rw.hour !== currentHour) continue;
      if (rw.day_of_week !== null && rw.day_of_week !== currentDay) continue;
      if ((rw.weight || 0) < 0.3) continue;

      useEngagementEngine.getState().onAnomaly('risk_window', {
        trigger_type: 'risk_window',
        hour: rw.hour,
        day_of_week: rw.day_of_week,
        weight: rw.weight,
        riskMessage: `This is usually a tough time for you. ${rw.source || "What's happening right now?"}`,
      });
      break;
    }
  };

  riskCheckInterval = setInterval(check, 60 * 60 * 1000);
  check();

  return () => {
    if (riskCheckInterval) { clearInterval(riskCheckInterval); riskCheckInterval = null; }
  };
}

/**
 * Get the engagement context for the current moment.
 * Used to enrich the system prompt when the user opens a session.
 */
export function getEngagementContext(): string | null {
  const state = useEngagementEngine.getState();

  if (state.currentEvent) {
    const event = state.currentEvent;
    const ago = Math.round((Date.now() - event.timestamp) / 60000);
    return `Anomaly detected ${ago} minutes ago: ${event.type}. Context: ${JSON.stringify(event.context)}`;
  }

  // Check if we recently nudged
  if (state.lastNudgeAt) {
    const agoMin = Math.round((Date.now() - state.lastNudgeAt) / 60000);
    if (agoMin < 30) {
      const lastEvent = state.eventLog[state.eventLog.length - 1];
      return `Proactive nudge sent ${agoMin} minutes ago (${lastEvent?.type || 'unknown'}). User is responding to it.`;
    }
  }

  return null;
}
