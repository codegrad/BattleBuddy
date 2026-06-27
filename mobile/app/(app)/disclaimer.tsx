import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { AppConfig } from '../../src/config';
import { Colors, Spacing, Radii } from '../../src/theme';

export default function DisclaimerScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>About BattleBuddy</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What this app is</Text>
          <Text style={styles.body}>
            BattleBuddy is an AI-powered <Text style={styles.bold}>habit-change companion</Text>.
            {' '}It helps you resist everyday urges and build new habits through conversation,
            distraction techniques, and the urge-wave exercise.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What this app is not</Text>
          <Text style={styles.body}>
            BattleBuddy is <Text style={styles.bold}>not</Text> a medical provider, therapist,
            counselor, or crisis service. It does not provide medical advice, diagnose conditions,
            or prescribe treatments.
          </Text>
        </View>

        <View style={[styles.section, styles.crisisSection]}>
          <Text style={styles.sectionTitle}>If you need help now</Text>
          <Text style={styles.body}>
            If you are experiencing a mental health emergency, suicidal thoughts, or are in danger,
            please contact:
          </Text>
          <View style={styles.crisisCard}>
            <Text style={styles.crisisName}>{AppConfig.CRISIS_RESOURCE_LABEL}</Text>
            <Text style={styles.crisisNumber}>
              Call or text {AppConfig.CRISIS_RESOURCE}
            </Text>
            <Text style={styles.crisisNote}>Available 24/7 in the US</Text>
          </View>
          <Text style={styles.body}>
            Or contact your local emergency services.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About the AI</Text>
          <Text style={styles.body}>
            BattleBuddy is powered by AI. It will always be honest that it is an AI.
            It will never shame you, moralize, or give medical advice.
            Your conversations are private and encrypted.
          </Text>
        </View>
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
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  body: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  bold: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  crisisSection: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
  },
  crisisCard: {
    backgroundColor: Colors.background,
    borderRadius: Radii.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  crisisName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  crisisNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.coral,
  },
  crisisNote: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
});
