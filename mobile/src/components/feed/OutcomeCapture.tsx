import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  interpolateColor,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../theme';

type Outcome = 'resisted' | 'gave_in';

interface OutcomeCaptureProps {
  onComplete: (outcome: Outcome) => void;
}

const SWIPE_THRESHOLD = 100;
const CLAMP = 160;

export default function OutcomeCapture({ onComplete }: OutcomeCaptureProps) {
  const translateX = useSharedValue(0);
  const settled = useSharedValue(false);

  function completeWithOutcome(outcome: Outcome) {
    Haptics.notificationAsync(
      outcome === 'resisted'
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );
    onComplete(outcome);
  }

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-20, 20])
    .onUpdate((e) => {
      if (settled.value) return;
      translateX.value = Math.max(-CLAMP, Math.min(CLAMP, e.translationX));
    })
    .onEnd((e) => {
      if (settled.value) return;
      if (e.translationX > SWIPE_THRESHOLD || e.velocityX > 600) {
        settled.value = true;
        translateX.value = withTiming(CLAMP + 40, { duration: 200 }, () => {
          runOnJS(completeWithOutcome)('resisted');
        });
      } else if (e.translationX < -SWIPE_THRESHOLD || e.velocityX < -600) {
        settled.value = true;
        translateX.value = withTiming(-CLAMP - 40, { duration: 200 }, () => {
          runOnJS(completeWithOutcome)('gave_in');
        });
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const resistedOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0.3, 1], Extrapolation.CLAMP),
  }));

  const gaveInOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0.3], Extrapolation.CLAMP),
  }));

  const trackColor = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      translateX.value,
      [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
      ['rgba(255,69,58,0.15)', 'rgba(255,255,255,0.05)', 'rgba(52,199,89,0.15)'],
    ),
  }));

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.heading}>How did it go?</Text>
        <Text style={styles.subtext}>Swipe to answer — no judgment, just data.</Text>

        <View style={styles.trackWrapper}>
          {/* Side labels */}
          <Animated.View style={[styles.sideLabel, styles.leftLabel, gaveInOpacity]}>
            <Text style={styles.sideLabelEmoji}>🫤</Text>
            <Text style={styles.sideLabelText}>Gave in</Text>
          </Animated.View>

          <Animated.View style={[styles.sideLabel, styles.rightLabel, resistedOpacity]}>
            <Text style={styles.sideLabelEmoji}>💪</Text>
            <Text style={styles.sideLabelText}>Resisted</Text>
          </Animated.View>

          {/* Track background */}
          <Animated.View style={[styles.track, trackColor]} />

          {/* Swipe knob */}
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.knob, cardStyle]}>
              <Text style={styles.knobArrows}>← →</Text>
            </Animated.View>
          </GestureDetector>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 20,
  },
  trackWrapper: {
    width: '100%',
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  track: {
    position: 'absolute',
    width: '100%',
    height: 72,
    borderRadius: 36,
  },
  sideLabel: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 1,
  },
  leftLabel: {
    left: 24,
  },
  rightLabel: {
    right: 24,
  },
  sideLabelEmoji: {
    fontSize: 20,
  },
  sideLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  knob: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  knobArrows: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
