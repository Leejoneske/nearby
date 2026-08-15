/** Vertical card for the home-screen rails. */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Business } from '../data/types';
import { formatDistance, formatPriceRange } from '../lib/format';
import { colors, radii, shadows, spacing, typography } from '../theme/tokens';
import { Photo } from './Photo';
import { Stars } from './Stars';

const CARD_WIDTH = 172;

type Props = {
  business: Business;
  onPress?: () => void;
  saved?: boolean;
  onToggleSave?: () => void;
};

export function BusinessCard({ business, onPress, saved, onToggleSave }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={business.name}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View>
        <Photo
          categoryId={business.categoryId}
          seed={business.id}
          uri={business.photos[0]}
          style={styles.photo}
          radius={radii.lg}
          iconSize={30}
        />
        {onToggleSave ? (
          <Pressable
            onPress={onToggleSave}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={saved ? `Remove ${business.name} from saved` : `Save ${business.name}`}
            style={styles.heart}
          >
            <Ionicons
              name={saved ? 'heart' : 'heart-outline'}
              size={16}
              color={saved ? colors.accent : colors.textPrimary}
            />
          </Pressable>
        ) : null}
        {business.offer ? (
          <View style={styles.offerTag}>
            <Text style={styles.offerText}>{business.offer.label}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {business.name}
        </Text>
        <Stars rating={business.rating} reviewCount={business.reviewCount} size={12} compact />
        <View style={styles.metaRow}>
          <Ionicons name="pricetag" size={11} color={colors.accent} />
          <Text style={styles.meta} numberOfLines={1}>
            {formatPriceRange(business.priceFrom, business.priceTo)}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="location" size={11} color={colors.textTertiary} />
          <Text style={styles.meta} numberOfLines={1}>
            {business.neighbourhood} · {formatDistance(business.distanceM)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

BusinessCard.WIDTH = CARD_WIDTH;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.sm,
    gap: spacing.sm,
    ...shadows.card,
  },
  photo: { width: '100%', height: 116 },
  heart: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerTag: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  offerText: {
    ...typography.caption,
    color: colors.textOnAccent,
    fontWeight: '700',
  },
  body: { paddingHorizontal: spacing.xs, paddingBottom: spacing.xs, gap: 2 },
  name: { ...typography.cardTitle, fontSize: 15, color: colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  meta: { ...typography.caption, fontSize: 11.5, color: colors.textSecondary, flexShrink: 1 },
});
