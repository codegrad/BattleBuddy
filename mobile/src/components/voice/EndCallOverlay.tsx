import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BBMascot } from '../mascot';
import { Colors } from '../../theme';

interface EndCallOverlayProps {
  onComplete: () => void;
}

export default function EndCallOverlay({ onComplete }: EndCallOverlayProps) {
  const overlayOpacity = useSharedValue(0);
  const mascotScale = useSharedValue(1);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    overlayOpacity.value = withTiming(1, { duration: 200 });

    mascotScale.value = withSequence(
      withTiming(1.1, { duration: 200, easing: Easing.out(Easing.ease) }),
      withTiming(0.9, { duration: 300, easing: Easing.inOut(Easing.ease) }),
      withTiming(0.85, { duration: 400, easing: Easing.in(Easing.ease) }),
    );

    textOpacity.value = withDelay(200, withTiming(1, { duration: 300 }));

    // After the animation, trigger outcome capture
    const timer = setTimeout(() => {
      overlayOpacity.value = withTiming(0, { duration: 200 }, () => {
        runOnJS(onComplete)();
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [overlayOpacity, mascotScale, textOpacity, onComplete]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const mascotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: mascotScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <Animated.View style={mascotStyle}>
        <BBMascot state="empathy" size={180} showRing={false} />
      </Animated.View>
      <Animated.Text style={[styles.message, textStyle]}>
        Call ended
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  message: {
    marginTop: 24,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
