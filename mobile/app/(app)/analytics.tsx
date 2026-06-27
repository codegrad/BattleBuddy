import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { fetchUserProfile, type UserProfile } from '../../src/services/profileBuilder';
import { Colors, Spacing, Radii } from '../../src/theme';

export default function AnalyticsScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserProfile(null)
      .then(setProfile)
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Analytics</Text>
        <View style={styles.spacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.coral} />
        </View>
      ) : !profile || profile.totalSessions === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptySubtitle}>
            Complete a few sessions and your progress will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Streak */}
          <View style={styles.heroCard}>
            <Text style={styles.heroNumber}>{profile.streak}</Text>
            <Text style={styles.heroLabel}>resist streak</Text>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <StatCard label="Sessions" value={String(profile.totalSessions)} />
            <StatCard
              label="Resist rate"
              value={`${profile.resistRate}%`}
              color={profile.resistRate >= 60 ? Colors.success : Colors.warning}
            />
          </View>

          {/* What works */}
          <Text style={styles.sectionTitle}>What works for you</Text>

          {profile.preferredFraming && (
            <InsightRow
              icon="🎯"
              text={`You respond best to ${profile.preferredFraming} framing`}
            />
          )}
          {profile.hardestTime && (
            <InsightRow
              icon="⏰"
              text={`Toughest time: around ${profile.hardestTime}`}
            />
          )}
          {profile.preferredMode && (
            <InsightRow
              icon={profile.preferredMode === 'voice' ? '🎙' : '💬'}
              text={`You prefer ${profile.preferredMode} mode`}
            />
          )}
          {!profile.preferredFraming && !profile.hardestTime && !profile.preferredMode && (
            <InsightRow
              icon="📈"
              text="Keep going — patterns will emerge after a few more sessions"
            />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InsightRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.insightRow}>
      <Text style={styles.insightIcon}>{icon}</Text>
      <Text style={styles.insightText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.surfaceBorder,
  },
  backButton: {
    paddingVertical: Spacing.xs,
    paddingRight: Spacing.sm,
    minWidth: 60,
  },
  backText: {
    color: Colors.coral,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  spacer: { minWidth: 60 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyIcon: { fontSize: 40, marginBottom: Spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  emptySubtitle: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', lineHeight: 20 },
  scroll: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.coral,
  },
  heroNumber: {
    fontSize: 56,
    fontWeight: '800',
    color: Colors.coral,
    fontVariant: ['tabular-nums'],
  },
  heroLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  insightIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
});
