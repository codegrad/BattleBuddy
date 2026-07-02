import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../../theme';
import { NAV_ROUTES, NAV_LABELS, type Direction } from '../../lib/navDirections';

const SMALL_SIZE = 40;
const LARGE_SIZE = 80;
const SMALL_SCALE = SMALL_SIZE / LARGE_SIZE;
const ARROW_SIZE = 56;
const ARROW_OFFSET = 118;

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

const ARROW_ICON: Record<Direction, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};

interface BBNavOverlayProps {
  // Direction whose destination is the screen this overlay sits on — that
  // arrow renders disabled/grayed instead of navigable.
  currentDirection: Direction;
  anchor?: 'bottom-center' | 'bottom-right';
}

export default function BBNavOverlay({ currentDirection, anchor = 'bottom-center' }: BBNavOverlayProps) {
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const [open, setOpen] = useState(false);

  const initial = useMemo(
    () =>
      anchor === 'bottom-right'
        ? { x: SCREEN_W - 46, y: SCREEN_H - 100 }
        : { x: SCREEN_W / 2, y: SCREEN_H - 90 },
    [anchor, SCREEN_W, SCREEN_H],
  );
  const center = useMemo(() => ({ x: SCREEN_W / 2, y: SCREEN_H / 2 }), [SCREEN_W, SCREEN_H]);

  const posX = useSharedValue(initial.x);
  const posY = useSharedValue(initial.y);
  const scale = useSharedValue(SMALL_SCALE);
  const backdropOpacity = useSharedValue(0);
  const arrowsOpacity = useSharedValue(0);

  const animateClosed = useCallback(() => {
    posX.value = withTiming(initial.x, { duration: 220, easing: Easing.in(Easing.cubic) });
    posY.value = withTiming(initial.y, { duration: 220, easing: Easing.in(Easing.cubic) });
    scale.value = withTiming(SMALL_SCALE, { duration: 220, easing: Easing.in(Easing.cubic) });
    backdropOpacity.value = withTiming(0, { duration: 180 });
    arrowsOpacity.value = withTiming(0, { duration: 120 });
  }, [initial, posX, posY, scale, backdropOpacity, arrowsOpacity]);

  const animateOpen = useCallback(() => {
    posX.value = withTiming(center.x, { duration: 260, easing: Easing.out(Easing.cubic) });
    posY.value = withTiming(center.y, { duration: 260, easing: Easing.out(Easing.cubic) });
    scale.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
    backdropOpacity.value = withTiming(1, { duration: 200 });
    arrowsOpacity.value = withDelay(140, withTiming(1, { duration: 180 }));
  }, [center, posX, posY, scale, backdropOpacity, arrowsOpacity]);

  const handleToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (open) {
      setOpen(false);
      animateClosed();
    } else {
      setOpen(true);
      animateOpen();
    }
  }, [open, animateOpen, animateClosed]);

  const handleDismiss = useCallback(() => {
    setOpen(false);
    animateClosed();
  }, [animateClosed]);

  const navigate = useCallback(
    (dir: Direction) => {
      if (dir === currentDirection) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setOpen(false);
      animateClosed();
      router.replace(NAV_ROUTES[dir] as never);
    },
    [currentDirection, animateClosed],
  );

  const circleStyle = useAnimatedStyle(() => ({
    left: posX.value - LARGE_SIZE / 2,
    top: posY.value - LARGE_SIZE / 2,
    transform: [{ scale: scale.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const arrowsStyle = useAnimatedStyle(() => ({ opacity: arrowsOpacity.value }));

  const arrowPositions: Record<Direction, { left: number; top: number }> = {
    up: { left: center.x - ARROW_SIZE / 2, top: center.y - ARROW_OFFSET - ARROW_SIZE / 2 },
    down: { left: center.x - ARROW_SIZE / 2, top: center.y + ARROW_OFFSET - ARROW_SIZE / 2 },
    left: { left: center.x - ARROW_OFFSET - ARROW_SIZE / 2, top: center.y - ARROW_SIZE / 2 },
    right: { left: center.x + ARROW_OFFSET - ARROW_SIZE / 2, top: center.y - ARROW_SIZE / 2 },
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents={open ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
      </Animated.View>

      <Animated.View style={[styles.arrowLayer, arrowsStyle]} pointerEvents={open ? 'box-none' : 'none'}>
        {DIRECTIONS.map((dir) => {
          const disabled = dir === currentDirection;
          return (
            <View key={dir} style={[styles.arrowWrap, arrowPositions[dir]]}>
              <Pressable
                style={[styles.arrowButton, disabled && styles.arrowButtonDisabled]}
                onPress={() => navigate(dir)}
                disabled={disabled}
                hitSlop={8}
              >
                <Text style={[styles.arrowIcon, disabled && styles.arrowTextDisabled]}>{ARROW_ICON[dir]}</Text>
              </Pressable>
              <Text style={[styles.arrowLabel, disabled && styles.arrowTextDisabled]}>{NAV_LABELS[dir]}</Text>
            </View>
          );
        })}
      </Animated.View>

      <Animated.View style={[styles.bbCircle, circleStyle]} pointerEvents="box-none">
        <Pressable style={styles.bbTouchable} onPress={handleToggle} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  arrowLayer: {
    ...StyleSheet.absoluteFill,
  },
  arrowWrap: {
    position: 'absolute',
    alignItems: 'center',
    gap: 6,
  },
  arrowButton: {
    width: ARROW_SIZE,
    height: ARROW_SIZE,
    borderRadius: ARROW_SIZE / 2,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowButtonDisabled: {
    borderColor: Colors.surfaceBorder,
    opacity: 0.4,
  },
  arrowIcon: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  arrowLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Colors.textSecondary,
  },
  arrowTextDisabled: {
    opacity: 0.5,
  },
  bbCircle: {
    position: 'absolute',
    width: LARGE_SIZE,
    height: LARGE_SIZE,
    borderRadius: LARGE_SIZE / 2,
    backgroundColor: 'rgba(232,98,74,0.55)',
  },
  bbTouchable: {
    flex: 1,
    borderRadius: LARGE_SIZE / 2,
  },
});
