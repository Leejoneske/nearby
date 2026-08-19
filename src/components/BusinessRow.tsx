/**
 * The search-result row: square thumbnail, name, rating, price range, address.
 * Laid out to match the listing reference — four lines of decreasing weight,
 * each with a leading glyph so the eye can scan one column at a time.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Business } from '../data/types';
import { formatDistance, formatPriceRange } from '../lib/format';
import { openState } from '../lib/hours';
import { radii, spacing, typography } from '../theme/tokens';
import { makeStyles, useTheme } from '../theme/ThemeProvider';
import { Photo } from './Photo';
import { Stars } from './Stars';

type Props = {
  business: Business;
  onPress?: () => void;
  saved?: boolean;
  onToggleSave?: () => void;
  /** Hide the divider on the last row of a list. */
  last?: boolean;
  now?: Date;
};

export function BusinessRow({
  business,
  onPress,
  saved,
  onToggleSave,
  last,
  now = new Date(),
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const state = openState(business.hours, now);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${business.name}, ${business.rating} stars, ${business.neighbourhood}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Photo
        categoryId={business.categoryId}
        seed={business.id}
        uri={business.photos[0]}
        style={styles.thumb}
        radius={radii.md}
        iconSize={22}
      />

      <View style={[styles.body, !last && styles.divider]}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {business.name}
          </Text>
          {business.verified ? (
            <Ionicons name="checkmark-circle" size={15} color={colors.accent} />
          ) : null}
        </View>

        <Stars rating={business.rating} reviewCount={business.reviewCount} size={13} />

        <View style={styles.metaRow}>
          <Ionicons name="pricetag" size={12} color={colors.accent} />
          <Text style={styles.meta} numberOfLines={1}>
            {formatPriceRange(business.priceFrom, business.priceTo)}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="location" size={12} color={colors.textTertiary} />
          <Text style={styles.meta} numberOfLines={1}>
            {business.address}
          </Text>
        </View>

        <View style={styles.footerRow}>
          <Text style={[styles.state, state.isOpen ? styles.open : styles.closed]}>
            {state.isOpen ? 'Open' : 'Closed'}
          </Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.distance}>{formatDistance(business.distanceM)} away</Text>
        </View>
      </View>

      {onToggleSave ? (
        <Pressable
          onPress={onToggleSave}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={saved ? `Remove ${business.name} from saved` : `Save ${business.name}`}
          style={styles.saveButton}
        >
          <Ionicons
            name={saved ? 'heart' : 'heart-outline'}
            size={20}
            color={saved ? colors.accent : colors.textTertiary}
          />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles((colors, tones) => ({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingLeft: spacing.screen,
    paddingRight: spacing.sm,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.surfaceSunken },
  thumb: { width: 72, height: 72, marginTop: spacing.lg },
  body: {
    flex: 1,
    paddingVertical: spacing.lg,
    gap: 3,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 1 },
  name: {
    ...typography.cardTitle,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 1 },
  meta: {
    ...typography.meta,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 1,
    marginTop: 2,
  },
  state: { ...typography.metaStrong },
  open: { color: colors.success },
  closed: { color: colors.danger },
  dot: { color: colors.textTertiary },
  distance: { ...typography.meta, color: colors.textSecondary },
  saveButton: {
    paddingTop: spacing.lg + 2,
    paddingHorizontal: spacing.sm,
  },
}));
