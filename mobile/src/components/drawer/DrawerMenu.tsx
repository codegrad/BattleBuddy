import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../../theme';

export interface DrawerItem {
  key: string;
  label: string;
  icon: string;
}

const ITEMS: DrawerItem[] = [
  { key: 'history',     label: 'History',     icon: '📋' },
  { key: 'insights',    label: 'Insights',    icon: '🧠' },
  { key: 'analytics',   label: 'Analytics',   icon: '📊' },
  { key: 'goals',       label: 'Goals',       icon: '🎯' },
  { key: 'routines',    label: 'Routines',    icon: '⏰' },
  { key: 'preferences', label: 'Preferences', icon: '⚙️' },
];

interface DrawerMenuProps {
  onSelect: (key: string) => void;
  onClose: () => void;
}

export default function DrawerMenu({ onSelect, onClose }: DrawerMenuProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>BattleBuddy</Text>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.items}>
        {ITEMS.map(({ key, label, icon }) => (
          <TouchableOpacity
            key={key}
            style={styles.item}
            onPress={() => onSelect(key)}
            activeOpacity={0.7}
          >
            <Text style={styles.itemIcon}>{icon}</Text>
            <Text style={styles.itemLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Your companion for building new habits</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingTop: 60,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.coral,
  },
  closeText: {
    color: Colors.textSecondary,
    fontSize: 18,
    fontWeight: '600',
  },
  items: {
    gap: Spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: 14,
    gap: Spacing.md,
  },
  itemIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  itemLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: Spacing.lg,
    right: Spacing.lg,
  },
  footerText: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});
