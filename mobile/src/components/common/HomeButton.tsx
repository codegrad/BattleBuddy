import { StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

interface HomeButtonProps {
  // Raw pixel offset from the true screen top, bypassing safe-area insets.
  // Use for screens where the caller already accounts for insets elsewhere
  // (e.g. a child overlay with its own paddingTop: insets.top).
  topOffset?: number;
  style?: StyleProp<ViewStyle>;
}

export default function HomeButton({ topOffset, style }: HomeButtonProps) {
  const insets = useSafeAreaInsets();
  const top = topOffset ?? insets.top + 8;

  return (
    <TouchableOpacity
      style={[styles.button, { top }, style]}
      onPress={() => router.replace('/(app)/')}
      activeOpacity={0.7}
      hitSlop={10}
    >
      <Text style={styles.icon}>⌂</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 16,
    zIndex: 50,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
  },
});
