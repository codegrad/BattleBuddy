import { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../theme';

interface UrgeButtonProps {
  onRelease: () => void;
}

const BREATH_DURATION = 4000;
const NUMBER_CYCLE_MS = 1333;
const BUTTON_SIZE = 80;

export default function UrgeButton({ onRelease }: UrgeButtonProps) {
  const scale = useSharedValue(1);
  const numberOpacity = useSharedValue(0);
  const labelOpacity = useSharedValue(1);
  const [currentNumber, setCurrentNumber] = useState(1);
  const [isHeld, setIsHeld] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heldRef = useRef(false);

  useEffect(() => {
    if (!isHeld) return;
    numberOpacity.value = 0;
    numberOpacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withTiming(1, { duration: 933 }),
      withTiming(0, { duration: 200 }),
    );
  }, [currentNumber, isHeld, numberOpacity]);

  const handlePressIn = useCallback(() => {
    heldRef.current = true;
    setIsHeld(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    labelOpacity.value = withTiming(0, { duration: 300 });

    // Spring to max scale, then start breathing loop
    scale.value = withSpring(2, { damping: 10, stiffness: 100 }, (finished) => {
      if (finished) {
        scale.value = withRepeat(
          withSequence(
            withTiming(1, {
              duration: BREATH_DURATION,
              easing: Easing.inOut(Easing.sin),
            }),
            withTiming(2, {
              duration: BREATH_DURATION,
              easing: Easing.inOut(Easing.sin),
            }),
          ),
          -1,
        );
      }
    });

    setCurrentNumber(1);
    let count = 1;
    intervalRef.current = setInterval(() => {
      count = (count % 3) + 1;
      setCurrentNumber(count);
    }, NUMBER_CYCLE_MS);
  }, [scale, labelOpacity]);

  const handlePressOut = useCallback(() => {
    if (!heldRef.current) return;
    heldRef.current = false;
    setIsHeld(false);

    cancelAnimation(scale);
    cancelAnimation(numberOpacity);
    cancelAnimation(labelOpacity);

    scale.value = withTiming(1, { duration: 200 });
    numberOpacity.value = 0;
    labelOpacity.value = withTiming(1, { duration: 200 });

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    onRelease();
  }, [scale, numberOpacity, labelOpacity, onRelease]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const animatedScale = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedLabel = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
  }));

  const animatedNumber = useAnimatedStyle(() => ({
    opacity: numberOpacity.value,
  }));

  return (
    <View style={styles.wrapper}>
      <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Animated.View style={[styles.button, animatedScale]}>
          <Animated.Text style={[styles.label, animatedLabel]}>
            URGE
          </Animated.Text>
          {isHeld && (
            <Animated.Text style={[styles.number, animatedNumber]}>
              {currentNumber}
            </Animated.Text>
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: BUTTON_SIZE / 2,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: Colors.background,
    borderWidth: 3,
    borderColor: Colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    position: 'absolute',
  },
  number: {
    color: Colors.coral,
    fontSize: 32,
    fontWeight: '700',
    position: 'absolute',
  },
});
