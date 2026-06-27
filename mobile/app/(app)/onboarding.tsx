import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { BBMascot } from '../../src/components/mascot';
import { useOnboarding } from '../../src/hooks/useOnboarding';
import { Colors, Spacing, Radii } from '../../src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TRIGGERS = [
  { key: 'stress', label: 'Stress', icon: '😤' },
  { key: 'boredom', label: 'Boredom', icon: '😐' },
  { key: 'social', label: 'Social situations', icon: '🍻' },
  { key: 'morning_coffee', label: 'Morning coffee', icon: '☕' },
  { key: 'after_meals', label: 'After meals', icon: '🍽' },
  { key: 'driving', label: 'Driving', icon: '🚗' },
];

type Step = 'welcome' | 'habit' | 'triggers';

export default function OnboardingScreen() {
  const [step, setStep] = useState<Step>('welcome');
  const [selectedTriggers, setSelectedTriggers] = useState<Set<string>>(new Set());
  const { markComplete } = useOnboarding();

  const toggleTrigger = useCallback((key: string) => {
    setSelectedTriggers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleFinish = useCallback(async () => {
    await markComplete();
  }, [markComplete]);

  return (
    <SafeAreaView style={styles.container}>
      {step === 'welcome' && (
        <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)} style={styles.step}>
          <View style={styles.mascotArea}>
            <BBMascot state="idle" size={180} />
          </View>
          <Text style={styles.heading}>Meet your BattleBuddy</Text>
          <Text style={styles.body}>
            {"I'm an AI companion here to help you resist urges and build new habits. " +
             "I'll be in your corner — no lectures, no judgment. Just support when you need it."}
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setStep('habit')} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>Get started</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {step === 'habit' && (
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.step}>
          <Text style={styles.stepLabel}>STEP 1 OF 2</Text>
          <Text style={styles.heading}>What are you working on?</Text>
          <View style={styles.habitCard}>
            <Text style={styles.habitIcon}>🚭</Text>
            <View style={styles.habitInfo}>
              <Text style={styles.habitTitle}>Quitting smoking / vaping</Text>
              <Text style={styles.habitSubtitle}>
                Nicotine urges are frequent — that gives us lots of chances to practice resisting together.
              </Text>
            </View>
          </View>
          <Text style={styles.caption}>
            More habits coming soon. For now, the app is tuned for nicotine.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setStep('triggers')} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>That's me</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {step === 'triggers' && (
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.step}>
          <Text style={styles.stepLabel}>STEP 2 OF 2</Text>
          <Text style={styles.heading}>What usually sets it off?</Text>
          <Text style={styles.body}>
            Select your biggest triggers. This helps me know when to check in.
          </Text>
          <View style={styles.triggerGrid}>
            {TRIGGERS.map(({ key, label, icon }) => (
              <TouchableOpacity
                key={key}
                style={[styles.triggerChip, selectedTriggers.has(key) && styles.triggerChipActive]}
                onPress={() => toggleTrigger(key)}
                activeOpacity={0.7}
              >
                <Text style={styles.triggerIcon}>{icon}</Text>
                <Text style={[styles.triggerLabel, selectedTriggers.has(key) && styles.triggerLabelActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={handleFinish} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>
              {selectedTriggers.size > 0 ? "Let's go" : 'Skip for now'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Progress dots */}
      <View style={styles.dots}>
        {(['welcome', 'habit', 'triggers'] as Step[]).map((s) => (
          <View key={s} style={[styles.dot, step === s && styles.dotActive]} />
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  step: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    gap: Spacing.md,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.coral,
    letterSpacing: 1.5,
  },
  mascotArea: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 32,
  },
  body: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  caption: {
    fontSize: 13,
    color: Colors.textTertiary,
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: Colors.coral,
    borderRadius: Radii.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  habitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.coral,
  },
  habitIcon: { fontSize: 36 },
  habitInfo: { flex: 1, gap: 4 },
  habitTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  habitSubtitle: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  triggerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  triggerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.full,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm) / 2,
  },
  triggerChipActive: {
    borderColor: Colors.coral,
    backgroundColor: 'rgba(232, 98, 74, 0.1)',
  },
  triggerIcon: { fontSize: 18 },
  triggerLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  triggerLabelActive: { color: Colors.coral },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.surfaceBorder,
  },
  dotActive: {
    backgroundColor: Colors.coral,
    width: 24,
  },
});
