import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography } from '../../theme/tokens';

interface OfflineBadgeProps {
  visible: boolean;
  message?: string;
}

export function OfflineBadge({ visible, message }: OfflineBadgeProps) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.dot} />
      <Text style={styles.label}>{message || 'Offline'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    gap: 6,
    opacity: 0.85,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.warning,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: Typography.caption.fontSize,
    fontWeight: '500',
  },
});
