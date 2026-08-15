/**
 * Filter and category chips — the "Sort / Price / Range area" row from the
 * listing reference, and the round category tiles on the home screen.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme/tokens';

type ChipProps = {
  label: string;
  onPress?: () => void;
  icon?: string;
  /** Renders the caret that marks a chip as opening a menu. */
  dropdown?: boolean;
  selected?: boolean;
  /** Small dot on the caret side, for a filter that is set but collapsed. */
  badge?: boolean;
};

export function Chip({ label, onPress, icon, dropdown, selected, badge }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.chipPressed,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon as never}
          size={15}
          color={selected ? colors.textOnAccent : colors.textSecondary}
        />
      ) : null}
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]} numberOfLines={1}>
        {label}
      </Text>
      {badge && !selected ? <View style={styles.badge} /> : null}
      {dropdown ? (
        <Ionicons
          name="chevron-down"
          size={14}
          color={selected ? colors.textOnAccent : colors.textTertiary}
        />
      ) : null}
    </Pressable>
  );
}

type CategoryTileProps = {
  label: string;
  icon: string;
  selected?: boolean;
  onPress?: () => void;
};

export function CategoryTile({ label, icon, selected, onPress }: CategoryTileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.tileIcon, selected && styles.tileIconSelected]}>
        <Ionicons
          name={icon as never}
          size={22}
          color={selected ? colors.textOnAccent : colors.accent}
        />
      </View>
      <Text style={styles.tileLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    height: 38,
    paddingHorizontal: spacing.lg - 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipPressed: { opacity: 0.75 },
  chipLabel: {
    ...typography.metaStrong,
    fontSize: 14,
    color: colors.textPrimary,
  },
  chipLabelSelected: { color: colors.textOnAccent },
  badge: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  tile: { alignItems: 'center', width: 72, gap: spacing.sm },
  tileIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileIconSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tileLabel: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
