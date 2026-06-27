import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing } from '../../theme';
import { LAST_OUTCOME_KEY, type LastOutcome } from '../../services/outcomeRecorder';

function formatElapsed(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return 'just now';

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h ago` : `${days}d ago`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m ago` : `${hours}h ago`;
  }
  return `${minutes}m ago`;
}

function formatClock(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export default function UrgeTimer() {
  const [now, setNow] = useState(Date.now());
  const [lastOutcome, setLastOutcome] = useState<LastOutcome | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(LAST_OUTCOME_KEY).then((raw) => {
      if (raw) {
        try { setLastOutcome(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  // Re-read after returning from a session (storage may have changed)
  useEffect(() => {
    const interval = setInterval(() => {
      AsyncStorage.getItem(LAST_OUTCOME_KEY).then((raw) => {
        if (raw) {
          try {
            const parsed: LastOutcome = JSON.parse(raw);
            if (parsed.timestamp !== lastOutcome?.timestamp) {
              setLastOutcome(parsed);
            }
          } catch {}
        }
      });
    }, 5_000);
    return () => clearInterval(interval);
  }, [lastOutcome?.timestamp]);

  // Tick the clock every second
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, []);

  const elapsed = lastOutcome
    ? now - new Date(lastOutcome.timestamp).getTime()
    : null;

  const isResisted = lastOutcome?.outcome === 'resisted';

  return (
    <View style={styles.container}>
      {/* Live clock */}
      <Text style={styles.clock}>{formatClock(new Date(now))}</Text>

      {lastOutcome && elapsed !== null ? (
        <View style={styles.urgeRow}>
          <Text style={styles.elapsedLabel}>Last urge</Text>
          <Text style={styles.elapsed}>{formatElapsed(elapsed)}</Text>
          <View
            style={[
              styles.outcomeBadge,
              isResisted ? styles.resistedBadge : styles.gaveInBadge,
            ]}
          >
            <Text
              style={[
                styles.outcomeText,
                isResisted ? styles.resistedText : styles.gaveInText,
              ]}
            >
              {isResisted ? 'Resisted' : 'Gave In'}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={styles.noData}>No urges logged yet</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
    gap: 6,
  },
  clock: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  urgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  elapsedLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  elapsed: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  outcomeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  resistedBadge: {
    backgroundColor: 'rgba(52,199,89,0.15)',
  },
  gaveInBadge: {
    backgroundColor: 'rgba(255,69,58,0.12)',
  },
  outcomeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  resistedText: {
    color: Colors.success,
  },
  gaveInText: {
    color: Colors.error,
  },
  noData: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
});
