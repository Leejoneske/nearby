import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { formatRating, formatReviewCount } from '../lib/format';
import { colors, typography } from '../theme/tokens';

type Props = {
  rating: number;
  reviewCount?: number;
  /** Draw all five stars rather than one star plus the number. */
  showAllStars?: boolean;
  size?: number;
  compact?: boolean;
};

export function Stars({
  rating,
  reviewCount,
  showAllStars = false,
  size = 14,
  compact = false,
}: Props) {
  if (showAllStars) {
    return (
      <View style={styles.row}>
        {[0, 1, 2, 3, 4].map((i) => {
          const filled = rating >= i + 1;
          const half = !filled && rating > i;
          return (
            <Ionicons
              key={i}
              name={filled ? 'star' : half ? 'star-half' : 'star-outline'}
              size={size}
              color={colors.star}
              style={styles.star}
            />
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Ionicons name="star" size={size} color={colors.star} />
      <Text style={[styles.rating, { fontSize: size + 1 }]}>{formatRating(rating)}</Text>
      {reviewCount !== undefined ? (
        <Text style={styles.count} numberOfLines={1}>
          {compact ? `(${reviewCount})` : `(${formatReviewCount(reviewCount)})`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  star: { marginRight: 1 },
  rating: {
    ...typography.metaStrong,
    color: colors.textPrimary,
  },
  count: {
    ...typography.meta,
    color: colors.textSecondary,
    flexShrink: 1,
  },
});
