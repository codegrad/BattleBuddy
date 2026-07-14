import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Colors, Radii } from '../../theme';

// The Rule of Three, inline in the conversation stream — BB's immediate
// answer to an urge. Three breaths, three seconds each. The intensity
// slider brackets the wave: the user rates it before and after, and the
// delta (7→3) is what lands in the receipt. Ported from the web head's
// breathingCard(); the sequence and copy are the spec.

const BREATH_MS = 3000;
const BREATHS = 3;

type Stage = 'idle' | 'breathing' | 'done' | 'closed';

interface BreathingCardProps {
  /** Fired once, when the user confirms the ride-out. from/to = intensity. */
  onDone: (from: number, to: number) => void;
}

export default function BreathingCard({ onDone }: BreathingCardProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [label, setLabel] = useState('How loud is it right now?');
  const [intensity, setIntensity] = useState(7);
  const fromRef = useRef(7);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const scale = useSharedValue(1);
  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const schedule = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const start = useCallback(() => {
    if (stage === 'done') {
      setStage('closed');
      onDone(fromRef.current, intensity);
      return;
    }
    if (stage !== 'idle') return;
    fromRef.current = intensity;
    setStage('breathing');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    let breath = 0;
    const cycle = () => {
      breath++;
      setLabel(`Breath ${breath} of ${BREATHS} — in…`);
      scale.value = withTiming(1.35, { duration: BREATH_MS, easing: Easing.inOut(Easing.ease) });
      schedule(() => {
        setLabel(`Breath ${breath} of ${BREATHS} — out…`);
        scale.value = withTiming(1, { duration: BREATH_MS, easing: Easing.inOut(Easing.ease) });
        schedule(() => {
          if (breath < BREATHS) {
            cycle();
          } else {
            setLabel('Where is it now?');
            setIntensity(Math.min(fromRef.current, 3));
            setStage('done');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
        }, BREATH_MS);
      }, BREATH_MS);
    };
    cycle();
  }, [stage, intensity, onDone, scale]);

  const buttonLabel =
    stage === 'idle' ? 'Start the three'
    : stage === 'breathing' ? 'Breathing…'
    : stage === 'done' ? 'Done — it moved'
    : 'Rode it out';

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Rule of Three</Text>
      <Text style={styles.sub}>Three breaths, three seconds each. Ride the wave with me.</Text>

      <View style={styles.stage}>
        <Animated.View style={[styles.circle, circleStyle]} />
        <Text style={styles.label}>{label}</Text>
      </View>

      <IntensitySlider
        value={intensity}
        onChange={setIntensity}
        disabled={stage === 'breathing' || stage === 'closed'}
      />

      <TouchableOpacity
        style={[styles.cta, (stage === 'breathing' || stage === 'closed') && styles.ctaQuiet]}
        onPress={start}
        disabled={stage === 'breathing' || stage === 'closed'}
        activeOpacity={0.8}
      >
        <Text style={styles.ctaLabel}>{buttonLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

// A 0–10 slider built on the pan gesture — nothing heavier is installed,
// and a receipt-grade rating doesn't need more precision than a thumb drag.
function IntensitySlider({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const [trackWidth, setTrackWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  const setFromX = useCallback(
    (x: number) => {
      if (!trackWidth) return;
      const v = Math.round(Math.min(1, Math.max(0, x / trackWidth)) * 10);
      onChange(v);
    },
    [trackWidth, onChange],
  );

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onBegin((e) => {
      'worklet';
      runOnJS(setFromX)(e.x);
    })
    .onUpdate((e) => {
      'worklet';
      runOnJS(setFromX)(e.x);
    });

  return (
    <View style={styles.sliderRow}>
      <Text style={styles.sliderLabel}>Intensity</Text>
      <GestureDetector gesture={pan}>
        <View style={styles.track} onLayout={onLayout} collapsable={false}>
          <View style={styles.trackLine} />
          <View style={[styles.fill, { width: `${value * 10}%` }]} />
          <View style={[styles.thumb, { left: `${value * 10}%` }]} />
        </View>
      </GestureDetector>
      <Text style={styles.sliderValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(35,35,38,0.96)',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 16,
    marginBottom: 8,
    gap: 8,
    alignSelf: 'stretch',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sub: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  stage: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  circle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(91,159,255,0.25)',
    borderWidth: 2,
    borderColor: Colors.stateIdle,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sliderLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  track: {
    flex: 1,
    height: 26,
    justifyContent: 'center',
  },
  trackLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surfaceLight,
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.coral,
  },
  thumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    marginLeft: -9,
    backgroundColor: Colors.textPrimary,
  },
  sliderValue: {
    width: 20,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    color: Colors.coral,
  },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.coral,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  ctaQuiet: {
    opacity: 0.55,
  },
  ctaLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
