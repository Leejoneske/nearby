/** Every review for one business, with the rating breakdown and a sort. */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Stars } from '../../components/Stars';
import { Avatar, Card, EmptyState } from '../../components/primitives';
import type { Review } from '../../data/types';
import { formatRelativeDate, formatReviewCount } from '../../lib/format';
import { useScreenInsets } from '../../lib/insets';
import { useStore } from '../../lib/store';
import { radii, spacing, typography } from '../../theme/tokens';
import { makeStyles, useTheme } from '../../theme/ThemeProvider';

type SortKey = 'recent' | 'highest' | 'lowest';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Most recent' },
  { key: 'highest', label: 'Highest' },
  { key: 'lowest', label: 'Lowest' },
];

function sortReviews(reviews: Review[], key: SortKey): Review[] {
  const copy = [...reviews];
  switch (key) {
    case 'highest':
      return copy.sort((a, b) => b.rating - a.rating || b.date.localeCompare(a.date));
    case 'lowest':
      return copy.sort((a, b) => a.rating - b.rating || b.date.localeCompare(a.date));
    default:
      return copy.sort((a, b) => b.date.localeCompare(a.date));
  }
}

export default function AllReviewsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useScreenInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getBusiness, loadDetail } = useStore();

  const business = getBusiness(id);
  const [sort, setSort] = useState<SortKey>('recent');
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    if (id) void loadDetail(id);
  }, [id, loadDetail]);

  const reviews = useMemo(
    () => (business ? sortReviews(business.reviews, sort) : []),
    [business, sort],
  );

  const breakdown = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    business?.reviews.forEach((r) => {
      const bucket = Math.min(4, Math.max(0, Math.round(r.rating) - 1));
      counts[bucket] += 1;
    });
    return counts;
  }, [business]);

  if (!business) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <EmptyState
          icon="alert-circle-outline"
          title="Listing not found"
          body="This business may have been removed."
        />
      </View>
    );
  }

  const total = Math.max(1, business.reviews.length);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.iconButton}
        >
          <Ionicons name="arrow-back" size={21} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Reviews
        </Text>
        <View style={styles.iconButton} />
      </View>

      <FlatList
        data={reviews}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{
          paddingHorizontal: spacing.screen,
          paddingBottom: insets.bottom + 100,
          gap: spacing.md,
        }}
        ListHeaderComponent={
          <View style={styles.top}>
            <Text style={styles.business} numberOfLines={1}>
              {business.name}
            </Text>

            <Card style={styles.summary}>
              <View style={styles.summaryLeft}>
                <Text style={styles.score}>{business.rating.toFixed(1)}</Text>
                <Stars rating={business.rating} size={13} showAllStars />
                <Text style={styles.count}>{formatReviewCount(business.reviewCount)}</Text>
              </View>
              <View style={styles.bars}>
                {[5, 4, 3, 2, 1].map((star) => (
                  <View key={star} style={styles.barRow}>
                    <Text style={styles.barLabel}>{star}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${(breakdown[star - 1] / total) * 100}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.barCount}>{breakdown[star - 1]}</Text>
                  </View>
                ))}
              </View>
            </Card>

            <View style={styles.sorts}>
              {SORTS.map((option) => (
                <Chip
                  key={option.key}
                  label={option.label}
                  selected={sort === option.key}
                  onPress={() => setSort(option.key)}
                />
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.review}>
            <View style={styles.reviewHead}>
              <Avatar initials={item.authorInitials} avatar={item.authorAvatar} size={38} />
              <View style={styles.reviewMeta}>
                <Text style={styles.author}>{item.authorName}</Text>
                <View style={styles.subRow}>
                  <Stars rating={item.rating} size={12} showAllStars />
                  <Text style={styles.date}>{formatRelativeDate(item.date, now)}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.body}>{item.body}</Text>

            {item.ownerReply ? (
              <View style={styles.reply}>
                <View style={styles.replyHead}>
                  <Ionicons name="return-down-forward" size={14} color={colors.accent} />
                  <Text style={styles.replyLabel}>Response from the owner</Text>
                </View>
                <Text style={styles.replyBody}>{item.ownerReply.body}</Text>
              </View>
            ) : null}
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubble-outline"
            title="No reviews yet"
            body="Been here? Yours would be the first."
          />
        }
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label="Write a review"
          icon="create-outline"
          onPress={() => router.push(`/write-review/${business.id}`)}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors, tones) => ({
  screen: { flex: 1, backgroundColor: colors.canvas },
  centered: { justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.cardTitle, color: colors.textPrimary, flex: 1, textAlign: 'center' },

  top: { gap: spacing.lg, paddingBottom: spacing.md },
  business: { ...typography.title, color: colors.textPrimary },

  summary: { flexDirection: 'row', gap: spacing.xl, alignItems: 'center' },
  summaryLeft: { alignItems: 'center', gap: 3, width: 96 },
  score: { ...typography.display, fontSize: 36, color: colors.textPrimary },
  count: { ...typography.caption, color: colors.textSecondary },
  bars: { flex: 1, gap: 5 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { ...typography.caption, color: colors.textSecondary, width: 8 },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: colors.star },
  barCount: {
    ...typography.caption,
    color: colors.textTertiary,
    width: 20,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },

  sorts: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },

  review: { gap: spacing.md },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reviewMeta: { flex: 1, gap: 2 },
  author: { ...typography.bodyStrong, color: colors.textPrimary },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  date: { ...typography.caption, color: colors.textTertiary },
  body: { ...typography.body, color: colors.textSecondary },
  reply: {
    backgroundColor: colors.canvas,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  replyHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  replyLabel: { ...typography.caption, color: colors.accentPressed, fontWeight: '700' },
  replyBody: { ...typography.meta, color: colors.textSecondary },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
}));
