import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { fetchUserProfile, type UserProfile } from '../../src/services/profileBuilder';
import { Colors, Spacing, Radii } from '../../src/theme';

const MILESTONES = [
  { count: 1, label: 'First resist', icon: '🌱' },
  { count: 3, label: '3 in a row', icon: '💪' },
  { count: 7, label: 'One week', icon: '⭐' },
  { count: 14, label: 'Two weeks', icon: '🔥' },
  { count: 30, label: 'One month', icon: '🏆' },
  { count: 60, label: 'Two months', icon: '👑' },
  { count: 100, label: 'Triple digits', icon: '💎' },
];

export default function GoalsScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetchUserProfile(null).then(setProfile);
  }, []);

  const streak = profile?.streak ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Goals</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Habit target */}
        <View style={styles.targetCard}>
          <Text style={styles.targetIcon}>🚭</Text>
          <View style={styles.targetInfo}>
            <Text style={styles.targetTitle}>Quitting smoking</Text>
            <Text style={styles.targetSubtitle}>Your current habit target</Text>
          </View>
        </View>

        {/* Current streak */}
        <View style={styles.streakCard}>
          <Text style={styles.streakNumber}>{streak}</Text>
          <Text style={styles.streakLabel}>
            {streak === 1 ? 'resist in a row' : 'resists in a row'}
          </Text>
        </View>

        {/* Milestones */}
        <Text style={styles.sectionTitle}>Milestones</Text>
        {MILESTONES.map(({ count, label, icon }) => {
          const reached = streak >= count;
          return (
            <View key={count} style={[styles.milestone, reached && styles.milestoneReached]}>
              <Text style={[styles.milestoneIcon, !reached && styles.milestoneDim]}>{icon}</Text>
              <View style={styles.milestoneInfo}>
                <Text style={[styles.milestoneLabel, !reached && styles.milestoneDim]}>{label}</Text>
                <Text style={[styles.milestoneCount, !reached && styles.milestoneDim]}>
                  {count} resists
                </Text>
              </View>
              {reached && <Text style={styles.milestoneCheck}>✓</Text>}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
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
  scroll: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  targetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  targetIcon: { fontSize: 32 },
  targetInfo: { flex: 1 },
  targetTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  targetSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  streakCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.coral,
  },
  streakNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.coral,
    fontVariant: ['tabular-nums'],
  },
  streakLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },
  milestone: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  milestoneReached: {
    borderWidth: 1,
    borderColor: Colors.success,
  },
  milestoneIcon: { fontSize: 24, width: 32, textAlign: 'center' },
  milestoneInfo: { flex: 1 },
  milestoneLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  milestoneCount: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
  milestoneDim: { opacity: 0.35 },
  milestoneCheck: { fontSize: 18, color: Colors.success, fontWeight: '700' },
});
