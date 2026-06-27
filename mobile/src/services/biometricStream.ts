/**
 * Biometric Stream — Layer 1 of the intelligence architecture.
 *
 * Always-listening over Apple HealthKit. On each incoming signal:
 *   respond-now  → fire anomaly to engagement engine immediately
 *   hold-and-watch → accumulate, check again on next sample
 *   log-only → write to local DB, no action
 *
 * All three paths log the event. The real-time layer never waits on batch.
 */

import { Platform } from 'react-native';
import { getDb } from './localDb';
import { useEngagementEngine, type EngagementTriggerType } from './engagementEngine';

// Signal thresholds — based on smoking cessation research
const THRESHOLDS = {
  // Resting heart rate spike (nicotine withdrawal causes HR elevation)
  HEART_RATE_SPIKE: 15, // bpm above personal baseline
  // Sleep disruption (common in nicotine withdrawal)
  SLEEP_DEFICIT_HOURS: 1.5, // hours below baseline
  // Step count drop (lethargy/mood dip correlates with craving)
  STEP_DROP_PERCENT: 40, // % below daily baseline
  // HRV drop (stress indicator)
  HRV_DROP_PERCENT: 25, // % below baseline
};

export type BiometricSignal = {
  type: 'heart_rate' | 'steps' | 'sleep' | 'hrv';
  value: number;
  timestamp: number;
  source: 'healthkit' | 'manual';
};

export type AnomalyDecision = 'respond_now' | 'hold_and_watch' | 'log_only';

interface UserBaseline {
  restingHeartRate: number;
  dailySteps: number;
  sleepHours: number;
  hrv: number;
}

// Default baselines until batch profiler computes real ones
const DEFAULT_BASELINE: UserBaseline = {
  restingHeartRate: 72,
  dailySteps: 6000,
  sleepHours: 7,
  hrv: 45,
};

let currentBaseline: UserBaseline = { ...DEFAULT_BASELINE };
let holdBuffer: BiometricSignal[] = [];
let pollInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Evaluate a single biometric signal against the user's baseline.
 * Returns a decision: respond now, hold and watch, or just log.
 */
export function evaluateSignal(signal: BiometricSignal, baseline: UserBaseline): AnomalyDecision {
  switch (signal.type) {
    case 'heart_rate': {
      const spike = signal.value - baseline.restingHeartRate;
      if (spike >= THRESHOLDS.HEART_RATE_SPIKE) return 'respond_now';
      if (spike >= THRESHOLDS.HEART_RATE_SPIKE * 0.6) return 'hold_and_watch';
      return 'log_only';
    }
    case 'sleep': {
      const deficit = baseline.sleepHours - signal.value;
      if (deficit >= THRESHOLDS.SLEEP_DEFICIT_HOURS) return 'respond_now';
      if (deficit >= THRESHOLDS.SLEEP_DEFICIT_HOURS * 0.5) return 'hold_and_watch';
      return 'log_only';
    }
    case 'steps': {
      const dropPercent = ((baseline.dailySteps - signal.value) / baseline.dailySteps) * 100;
      if (dropPercent >= THRESHOLDS.STEP_DROP_PERCENT) return 'respond_now';
      if (dropPercent >= THRESHOLDS.STEP_DROP_PERCENT * 0.6) return 'hold_and_watch';
      return 'log_only';
    }
    case 'hrv': {
      const dropPercent = ((baseline.hrv - signal.value) / baseline.hrv) * 100;
      if (dropPercent >= THRESHOLDS.HRV_DROP_PERCENT) return 'respond_now';
      if (dropPercent >= THRESHOLDS.HRV_DROP_PERCENT * 0.6) return 'hold_and_watch';
      return 'log_only';
    }
    default:
      return 'log_only';
  }
}

/**
 * Process an incoming biometric signal. Always logs. May trigger engagement.
 */
export async function processSignal(signal: BiometricSignal): Promise<void> {
  // Always log
  await logBiometricEvent(signal);

  const decision = evaluateSignal(signal, currentBaseline);

  switch (decision) {
    case 'respond_now': {
      // Clear hold buffer — this is more urgent
      holdBuffer = [];
      useEngagementEngine.getState().onAnomaly('biometric_anomaly', {
        signal_type: signal.type,
        value: signal.value,
        baseline: currentBaseline[baselineKey(signal.type)],
        decision: 'respond_now',
      });
      break;
    }
    case 'hold_and_watch': {
      holdBuffer.push(signal);
      // If we've accumulated 3+ hold signals, escalate to respond
      if (holdBuffer.length >= 3) {
        useEngagementEngine.getState().onAnomaly('biometric_anomaly', {
          signal_type: 'accumulated',
          signals: holdBuffer.map(s => ({ type: s.type, value: s.value })),
          decision: 'accumulated_hold',
        });
        holdBuffer = [];
      }
      break;
    }
    case 'log_only':
      // Already logged above
      break;
  }
}

function baselineKey(signalType: string): keyof UserBaseline {
  switch (signalType) {
    case 'heart_rate': return 'restingHeartRate';
    case 'steps': return 'dailySteps';
    case 'sleep': return 'sleepHours';
    case 'hrv': return 'hrv';
    default: return 'restingHeartRate';
  }
}

async function logBiometricEvent(signal: BiometricSignal): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR IGNORE INTO biometric_events (id, type, value, timestamp, source, synced)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [`bio-${signal.timestamp}-${signal.type}`, signal.type, signal.value, signal.timestamp, signal.source],
    );
  } catch {
    // Non-critical — don't crash the real-time path
  }
}

/**
 * Update the user's baseline (called by batch profiler or on app start).
 */
export function updateBaseline(baseline: Partial<UserBaseline>): void {
  currentBaseline = { ...currentBaseline, ...baseline };
}

/**
 * Initialize HealthKit and start background observation.
 * iOS only — no-ops on Android.
 */
export async function startBiometricStream(): Promise<() => void> {
  if (Platform.OS !== 'ios') return () => {};

  // Ensure the biometric_events table exists
  try {
    const db = await getDb();
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS biometric_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        value REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        source TEXT NOT NULL,
        synced INTEGER NOT NULL DEFAULT 0
      );
    `);
  } catch {}

  try {
    let AppleHealthKit: any;
    let HealthKitPermissions: any;
    try {
      AppleHealthKit = require('react-native-health').default;
      ({ HealthKitPermissions } = require('react-native-health'));
    } catch {
      return () => {};
    }

    const permissions: typeof HealthKitPermissions = {
      permissions: {
        read: [
          AppleHealthKit.Constants.Permissions.HeartRate,
          AppleHealthKit.Constants.Permissions.StepCount,
          AppleHealthKit.Constants.Permissions.SleepAnalysis,
          AppleHealthKit.Constants.Permissions.HeartRateVariability,
        ],
        write: [],
      },
    };

    await new Promise<void>((resolve, reject) => {
      AppleHealthKit.initHealthKit(permissions, (err: string) => {
        if (err) reject(new Error(err));
        else resolve();
      });
    });

    // Poll for new data every 60 seconds
    const poll = async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Heart rate
      try {
        AppleHealthKit.getHeartRateSamples(
          { startDate: oneHourAgo.toISOString(), endDate: now.toISOString(), limit: 1, ascending: false },
          (_err: string, results: any[]) => {
            if (results?.length > 0) {
              processSignal({
                type: 'heart_rate',
                value: results[0].value,
                timestamp: new Date(results[0].endDate).getTime(),
                source: 'healthkit',
              });
            }
          },
        );
      } catch {}

      // Steps (today's total)
      try {
        AppleHealthKit.getStepCount(
          { date: now.toISOString(), includeManuallyAdded: true },
          (_err: string, results: { value: number }) => {
            if (results?.value != null) {
              processSignal({
                type: 'steps',
                value: results.value,
                timestamp: now.getTime(),
                source: 'healthkit',
              });
            }
          },
        );
      } catch {}
    };

    // Initial poll
    poll();
    // Continue polling
    pollInterval = setInterval(poll, 60 * 1000);

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };
  } catch {
    // HealthKit not available (simulator, denied, etc.)
    return () => {};
  }
}
