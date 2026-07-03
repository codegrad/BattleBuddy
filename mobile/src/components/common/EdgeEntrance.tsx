import { useEffect, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { Direction } from '../../lib/navDirections';

// Completes the hub's swipe as a slideshow-style PUSH: the whole scene moves
// as one strip in the direction of the drag. The hub slides off toward the
// swiped edge (HubHomeScreen's exit), and this screen continues that same
// motion by entering from the OPPOSITE edge. Swipe down → hub exits off the
// bottom, destination slides in from the top, still moving downward.
//
// Timing matches the hub's exit (cubic-out, no spring) so the two halves of
// the push read as one continuous motion — a bounce here made the handoff
// feel like the screen arriving from the wrong direction and rebounding.
const ENTRANCE_MS = 300;

interface EdgeEntranceProps {
  // The swipe direction that brings the user to this screen (see
  // navDirections.ts), e.g. 'down' for Voice: swipe down → enters from the
  // top edge, moving downward.
  edge: Direction;
  children: ReactNode;
}

export default function EdgeEntrance({ edge, children }: EdgeEntranceProps) {
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();

  // Opposite-edge start: continue the drag's motion vector.
  const translateX = useSharedValue(edge === 'left' ? SCREEN_W : edge === 'right' ? -SCREEN_W : 0);
  const translateY = useSharedValue(edge === 'up' ? SCREEN_H : edge === 'down' ? -SCREEN_H : 0);

  // Runs once on mount — this is an entrance animation, not a responder to
  // dimension changes, so it intentionally ignores translateX/translateY.
  useEffect(() => {
    const timing = { duration: ENTRANCE_MS, easing: Easing.out(Easing.cubic) };
    translateX.value = withTiming(0, timing);
    translateY.value = withTiming(0, timing);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  return <Animated.View style={[styles.fill, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
