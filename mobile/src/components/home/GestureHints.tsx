import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '../../theme';

const ease = Easing.inOut(Easing.ease);

export default function GestureHints() {
  const downY = useSharedValue(0);
  const upY = useSharedValue(0);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    const dur = 1200;
    downY.value = withRepeat(
      withSequence(
        withTiming(6, { duration: dur, easing: ease }),
        withTiming(0, { duration: dur, easing: ease }),
      ),
      -1,
    );
    upY.value = withRepeat(
      withDelay(
        600,
        withSequence(
          withTiming(-6, { duration: dur, easing: ease }),
          withTiming(0, { duration: dur, easing: ease }),
        ),
      ),
      -1,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: dur, easing: ease }),
        withTiming(0.3, { duration: dur, easing: ease }),
      ),
      -1,
    );
  }, [downY, upY, opacity]);

  const downStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: downY.value }],
    opacity: opacity.value,
  }));

  const upStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: upY.value }],
    opacity: opacity.value,
  }));

  return (
    <>
      {/* Swipe-down hint (above mascot) */}
      <Animated.Text style={[styles.hint, styles.hintDown, downStyle]}>
        ▾ chat
      </Animated.Text>

      {/* Swipe-up hint (below mascot) */}
      <Animated.Text style={[styles.hint, styles.hintUp, upStyle]}>
        ▴ voice
      </Animated.Text>
    </>
  );
}

const styles = StyleSheet.create({
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    color: Colors.textTertiary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },
  hintDown: {
    top: '22%',
  },
  hintUp: {
    bottom: '18%',
  },
});
