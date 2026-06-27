import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Colors, Spacing, Radii } from '../../theme';

const TRIGGERS = [
  { key: 'stress', label: 'Stress', icon: '😤' },
  { key: 'boredom', label: 'Boredom', icon: '😐' },
  { key: 'social', label: 'Social', icon: '🍻' },
  { key: 'routine', label: 'Routine', icon: '☕' },
  { key: 'craving', label: 'Just craving', icon: '🔥' },
];

const INTENSITIES = [1, 2, 3, 4, 5];

interface TriggerCaptureProps {
  onComplete: (trigger: string, intensity: number) => void;
  onSkip: () => void;
}

export default function TriggerCapture({ onComplete, onSkip }: TriggerCaptureProps) {
  const [step, setStep] = useState<'trigger' | 'intensity'>('trigger');
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);

  const handleTrigger = useCallback((key: string) => {
    setSelectedTrigger(key);
    setStep('intensity');
  }, []);

  const handleIntensity = useCallback(
    (level: number) => {
      if (selectedTrigger) {
        onComplete(selectedTrigger, level);
      }
    },
    [selectedTrigger, onComplete],
  );

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.container}>
      {step === 'trigger' ? (
        <View style={styles.content}>
          <Text style={styles.question}>What set it off?</Text>
          <View style={styles.options}>
            {TRIGGERS.map(({ key, label, icon }) => (
              <TouchableOpacity
                key={key}
                style={styles.option}
                onPress={() => handleTrigger(key)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionIcon}>{icon}</Text>
                <Text style={styles.optionLabel}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.question}>How strong?</Text>
          <View style={styles.intensityRow}>
            {INTENSITIES.map((level) => (
              <TouchableOpacity
                key={level}
                style={styles.intensityButton}
                onPress={() => handleIntensity(level)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.intensityNumber,
                  level >= 4 && styles.intensityHigh,
                ]}>
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.intensityLabels}>
            <Text style={styles.intensityLabel}>mild</Text>
            <Text style={styles.intensityLabel}>intense</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  content: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  question: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  option: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    minWidth: 90,
    gap: 4,
  },
  optionIcon: {
    fontSize: 22,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  skipButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  skipText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  intensityRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  intensityButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  intensityNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  intensityHigh: {
    color: Colors.coral,
  },
  intensityLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 240,
    paddingHorizontal: 4,
  },
  intensityLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
});
