import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '../../theme';

const BAR_COUNT = 24;
const RADIUS = 110;

interface AudioVisualizerProps {
  audioLevel: number;
  stateColor: string;
  size?: number;
}

export default function AudioVisualizer({
  audioLevel,
  stateColor,
  size = 280,
}: AudioVisualizerProps) {
  const bars = Array.from({ length: BAR_COUNT }, (_, i) => (
    <VisualizerBar
      key={i}
      index={i}
      total={BAR_COUNT}
      audioLevel={audioLevel}
      stateColor={stateColor}
      radius={RADIUS * (size / 280)}
    />
  ));

  return (
    <View style={[styles.container, { width: size, height: size }]} pointerEvents="none">
      {bars}
    </View>
  );
}

interface BarProps {
  index: number;
  total: number;
  audioLevel: number;
  stateColor: string;
  radius: number;
}

function VisualizerBar({ index, total, audioLevel, stateColor, radius }: BarProps) {
  const height = useSharedValue(4);
  const opacity = useSharedValue(0.15);

  useEffect(() => {
    // Each bar gets a slightly different response to create organic wave movement
    const phase = (index / total) * Math.PI * 2;
    const variation = Math.sin(phase * 3 + Date.now() / 200) * 0.3 + 0.7;
    const level = Math.max(0, Math.min(1, audioLevel * variation));

    const minH = 4;
    const maxH = 28;
    const targetH = minH + level * (maxH - minH);

    height.value = withSpring(targetH, { damping: 12, stiffness: 280, mass: 0.4 });
    opacity.value = withTiming(0.15 + level * 0.65, {
      duration: 80,
      easing: Easing.out(Easing.ease),
    });
  }, [audioLevel, index, total, height, opacity]);

  const angle = (index / total) * 360;
  const radians = (angle * Math.PI) / 180;
  const cx = radius * Math.cos(radians);
  const cy = radius * Math.sin(radians);

  const barStyle = useAnimatedStyle(() => ({
    height: height.value,
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          backgroundColor: stateColor,
          width: 3,
          borderRadius: 1.5,
          position: 'absolute',
          left: '50%',
          top: '50%',
          marginLeft: cx - 1.5,
          marginTop: cy,
          transform: [{ rotate: `${angle + 90}deg` }],
        },
        barStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    backgroundColor: Colors.coral,
  },
});
