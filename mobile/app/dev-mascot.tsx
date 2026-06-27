import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { BBMascot, type MascotState } from '../src/components/mascot';
import { Colors, Spacing } from '../src/theme';

const STATES: { key: MascotState; label: string; description: string }[] = [
  { key: 'idle',           label: 'Idle',           description: 'Calm blue — resting on home screen' },
  { key: 'listening',      label: 'Listening',      description: 'Orange — waiting for user input' },
  { key: 'user_speaking',  label: 'User Speaking',  description: 'Green — user is talking' },
  { key: 'speaking',       label: 'BB Speaking',    description: 'Coral — BB is responding' },
  { key: 'celebrating',    label: 'Celebrating',    description: 'Green bounce — user resisted!' },
  { key: 'empathy',        label: 'Empathy',        description: 'Soft coral — user slipped, no shame' },
];

export default function DevMascotScreen() {
  const [currentState, setCurrentState] = useState<MascotState>('idle');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>BB Mascot — State Test</Text>
      </View>

      <View style={styles.mascotArea}>
        <BBMascot state={currentState} size={220} />
      </View>

      <Text style={styles.currentLabel}>
        Current: {STATES.find(s => s.key === currentState)?.label}
      </Text>

      <ScrollView style={styles.controls} contentContainerStyle={styles.controlsContent}>
        {STATES.map(({ key, label, description }) => (
          <TouchableOpacity
            key={key}
            style={[styles.stateButton, currentState === key && styles.stateButtonActive]}
            onPress={() => setCurrentState(key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.stateLabel, currentState === key && styles.stateLabelActive]}>
              {label}
            </Text>
            <Text style={styles.stateDesc}>{description}</Text>
          </TouchableOpacity>
        ))}
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  backButton: {
    paddingVertical: Spacing.xs,
    paddingRight: Spacing.sm,
  },
  backText: {
    color: Colors.coral,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  mascotArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    minHeight: 280,
  },
  currentLabel: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  controls: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  controlsContent: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  stateButton: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  stateButtonActive: {
    borderColor: Colors.coral,
    backgroundColor: '#2A1F1B',
  },
  stateLabel: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  stateLabelActive: {
    color: Colors.coral,
  },
  stateDesc: {
    color: Colors.textTertiary,
    fontSize: 13,
  },
});
