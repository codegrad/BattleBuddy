import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ScreenWithEntity from '../../src/components/common/ScreenWithEntity';
import BBMascot from '../../src/components/mascot/BBMascot';
import { useAuthStore } from '../../src/stores/authStore';
import { fetchRecords, type RecordsData } from '../../src/services/statsService';
import { Colors, Spacing, Radii } from '../../src/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function GoalsScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const [data, setData] = useState<RecordsData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRecords(userId ?? null)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  const newRecord = data?.records.find((r) => r.isNew);

  // A freshly-broken record gets its own moment — mascot + haptic — the
  // one time this screen celebrates instead of just reporting.
  useEffect(() => {
    if (newRecord) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [newRecord?.key]);

  return (
    <ScreenWithEntity title="Records">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>Records only ever get better. A slip never resets anything here.</Text>

        {newRecord && (
          <View style={styles.celebrate}>
            <BBMascot state="celebrating" size={56} showRing={false} />
            <Text style={styles.celebrateText}>
              New record — <Text style={styles.celebrateHighlight}>{newRecord.value}</Text> {newRecord.unit.toLowerCase()}.
            </Text>
          </View>
        )}

        <View style={styles.grid}>
          {data?.records.map((r) => (
            <View key={r.key} style={styles.tile}>
              <Ionicons name={r.icon as IconName} size={24} color={Colors.textSecondary} style={styles.tileIcon} />
              <Text style={styles.tileValue}>{r.value}</Text>
              <Text style={styles.tileUnit}>{r.unit}</Text>
              <Text style={styles.tileMeta}>Set {formatDate(r.setDate)}</Text>
              {r.context && <Text style={styles.tileCtx}>{r.context}</Text>}
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Milestones</Text>
        {data?.milestones.map((m) => {
          const unlocked = !!m.unlockedAt;
          return (
            <View key={m.key} style={[styles.milestone, unlocked && styles.milestoneUnlocked]}>
              <View style={[styles.check, unlocked ? styles.checkUnlocked : styles.checkLocked]}>
                <Ionicons name={unlocked ? 'checkmark' : 'ellipse-outline'} size={16} color={unlocked ? Colors.success : Colors.textTertiary} />
              </View>
              <View style={styles.milestoneInfo}>
                <Text style={[styles.milestoneTitle, !unlocked && styles.milestoneDim]}>{m.title}</Text>
                <Text style={styles.milestoneSub}>
                  {unlocked ? `Unlocked ${formatDate(m.unlockedAt!)}` : 'Not yet'}
                  {m.detail ? ` — ${m.detail}` : ''}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </ScreenWithEntity>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  scroll: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  eyebrow: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  celebrate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: 'rgba(52,199,89,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.35)',
    borderRadius: Radii.md,
    padding: Spacing.md,
  },
  celebrateText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textPrimary,
  },
  celebrateHighlight: {
    fontWeight: '800',
    color: Colors.success,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.md,
  },
  tileIcon: {
    marginBottom: 6,
  },
  tileValue: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.coral,
    lineHeight: 32,
  },
  tileUnit: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 17,
  },
  tileMeta: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 10,
  },
  tileCtx: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },
  milestone: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  milestoneUnlocked: {
    borderColor: 'rgba(52,199,89,0.4)',
  },
  check: {
    width: 32,
    height: 32,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkUnlocked: {
    backgroundColor: 'rgba(52,199,89,0.15)',
  },
  checkLocked: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  milestoneInfo: {
    flex: 1,
  },
  milestoneTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  milestoneDim: {
    color: Colors.textTertiary,
  },
  milestoneSub: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
    lineHeight: 16,
  },
});
