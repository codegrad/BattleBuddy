import { useCallback } from 'react';
import { View, StyleSheet, Dimensions, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import DrawerMenu from './DrawerMenu';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = SCREEN_WIDTH * 0.78;
const VELOCITY_THRESHOLD = 500;

interface AppDrawerProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (key: string) => void;
  children: React.ReactNode;
}

export default function AppDrawer({ open, onClose, onNavigate, children }: AppDrawerProps) {
  const translateX = useSharedValue(-DRAWER_WIDTH);
  const backdropOpacity = useSharedValue(0);

  const animateTo = useCallback(
    (toOpen: boolean) => {
      const config = { duration: 280, easing: Easing.out(Easing.cubic) };
      translateX.value = withTiming(toOpen ? 0 : -DRAWER_WIDTH, config);
      backdropOpacity.value = withTiming(toOpen ? 0.5 : 0, config);
    },
    [translateX, backdropOpacity],
  );

  // React to prop changes
  if (open && translateX.value <= -DRAWER_WIDTH + 1) {
    animateTo(true);
  } else if (!open && translateX.value >= -1) {
    animateTo(false);
  }

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      'worklet';
      const next = Math.max(-DRAWER_WIDTH, Math.min(0, e.translationX + (open ? 0 : -DRAWER_WIDTH)));
      translateX.value = next;
      backdropOpacity.value = ((next + DRAWER_WIDTH) / DRAWER_WIDTH) * 0.5;
    })
    .onEnd((e) => {
      'worklet';
      const shouldOpen =
        e.velocityX > VELOCITY_THRESHOLD ||
        (e.velocityX > -VELOCITY_THRESHOLD && translateX.value > -DRAWER_WIDTH / 2);
      const config = { duration: 280, easing: Easing.out(Easing.cubic) };
      translateX.value = withTiming(shouldOpen ? 0 : -DRAWER_WIDTH, config);
      backdropOpacity.value = withTiming(shouldOpen ? 0.5 : 0, config);
      if (!shouldOpen) {
        runOnJS(onClose)();
      }
    });

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
    pointerEvents: backdropOpacity.value > 0.01 ? 'auto' as const : 'none' as const,
  }));

  const handleSelect = useCallback(
    (key: string) => {
      animateTo(false);
      onClose();
      onNavigate(key);
    },
    [animateTo, onClose, onNavigate],
  );

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.root}>
        {children}

        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { animateTo(false); onClose(); }} />
        </Animated.View>

        {/* Drawer panel */}
        <Animated.View style={[styles.drawer, { width: DRAWER_WIDTH }, drawerStyle]}>
          <DrawerMenu onSelect={handleSelect} onClose={() => { animateTo(false); onClose(); }} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    zIndex: 10,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
  },
});
