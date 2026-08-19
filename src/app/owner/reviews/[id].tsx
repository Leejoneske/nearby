import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useScreenInsets } from '../../../lib/insets';

import { Button } from '../../../components/Button';
import { Chip } from '../../../components/Chip';
import { Stars } from '../../../components/Stars';
import { Avatar, Card, EmptyState } from '../../../components/primitives';
import { formatRelativeDate } from '../../../lib/format';
import { useStore } from '../../../lib/store';
import { colors, radii, spacing, typography } from '../../../theme/tokens';

type Tab = 'all' | 'needsReply' | 'replied';

export default function OwnerReviewsScreen() {
  const router = useRouter();
  const insets = useScreenInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getBusiness, replyToReview } = useStore();

  const business = getBusiness(id);
  const [tab, setTab] = useState<Tab>('all');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const now = useMemo(() => new Date(), []);

  const reviews = useMemo(() => {
    if (!business) return [];
    switch (tab) {
      case 'needsReply':
        return business.reviews.filter((r) => !r.ownerReply);
      case 'replied':
        return business.reviews.filter((r) => r.ownerReply);
      default:
        return business.reviews;
    }
  }, [business, tab]);

  if (!business) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <EmptyState
          icon="chatbubbles-outline"
          title="Listing not found"
          body="This listing may have been removed from your account."
        />
      </View>
    );
  }

  const needsReply = business.reviews.filter((r) => !r.ownerReply).length;

  const submitReply = (reviewId: string) => {
    const body = draft.trim();
    if (!body) return;
    replyToReview(business.id, reviewId, body);
    setReplyingTo(null);
    setDraft('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.iconButton}
          >
            <Ionicons name="arrow-back" size={21} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Reviews</Text>
          <View style={styles.iconButton} />
        </View>

        <View style={styles.summary}>
          <Text style={styles.score}>{business.rating.toFixed(1)}</Text>
          <View style={styles.summaryText}>
            <Stars rating={business.rating} size={14} showAllStars />
            <Text style={styles.summaryMeta}>
              {business.reviewCount} reviews ·{' '}
              {needsReply === 0 ? 'all answered' : `${needsReply} awaiting a reply`}
            </Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          <Chip label="All" selected={tab === 'all'} onPress={() => setTab('all')} />
          <Chip
            label={needsReply ? `Needs reply (${needsReply})` : 'Needs reply'}
            selected={tab === 'needsReply'}
            onPress={() => setTab('needsReply')}
          />
          <Chip label="Replied" selected={tab === 'replied'} onPress={() => setTab('replied')} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: spacing.screen,
          paddingBottom: insets.bottom + spacing.huge,
          gap: spacing.md,
        }}
      >
        {reviews.length === 0 ? (
          <EmptyState
            icon="checkmark-circle-outline"
            title={tab === 'needsReply' ? 'Nothing waiting' : 'No reviews here yet'}
            body={
              tab === 'needsReply'
                ? 'Every review has a reply. Customers notice when an owner answers.'
                : 'Reviews will appear here as customers leave them.'
            }
          />
        ) : (
          reviews.map((review) => (
            <Card key={review.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Avatar initials={review.authorInitials} avatar={review.authorAvatar} size={40} />
                <View style={styles.cardMeta}>
                  <Text style={styles.author}>{review.authorName}</Text>
                  <View style={styles.subRow}>
                    <Stars rating={review.rating} size={12} showAllStars />
                    <Text style={styles.date}>{formatRelativeDate(review.date, now)}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.body}>{review.body}</Text>

              {review.ownerReply ? (
                <View style={styles.reply}>
                  <View style={styles.replyHeader}>
                    <Ionicons name="return-down-forward" size={14} color={colors.accent} />
                    <Text style={styles.replyLabel}>Your reply</Text>
                    <Text style={styles.replyDate}>
                      {formatRelativeDate(review.ownerReply.date, now)}
                    </Text>
                  </View>
                  <Text style={styles.replyBody}>{review.ownerReply.body}</Text>
                </View>
              ) : replyingTo === review.id ? (
                <View style={styles.composer}>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Thanks for the feedback…"
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    autoFocus
                    style={styles.input}
                    accessibilityLabel={`Reply to ${review.authorName}`}
                  />
                  <View style={styles.composerActions}>
                    <View style={styles.composerButton}>
                      <Button
                        label="Cancel"
                        variant="ghost"
                        size="sm"
                        onPress={() => {
                          setReplyingTo(null);
                          setDraft('');
                        }}
                      />
                    </View>
                    <View style={styles.composerButton}>
                      <Button
                        label="Post reply"
                        size="sm"
                        disabled={draft.trim().length === 0}
                        onPress={() => submitReply(review.id)}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <Button
                  label="Reply"
                  variant="secondary"
                  size="sm"
                  icon="return-down-forward"
                  onPress={() => {
                    setReplyingTo(review.id);
                    setDraft('');
                  }}
                />
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  centered: { justifyContent: 'center' },

  header: {
    backgroundColor: colors.surface,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.cardTitle, color: colors.textPrimary, flex: 1, textAlign: 'center' },

  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.lg,
  },
  score: { ...typography.display, fontSize: 40, color: colors.textPrimary },
  summaryText: { gap: spacing.xs },
  summaryMeta: { ...typography.meta, color: colors.textSecondary },

  tabRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.screen },

  card: { gap: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardMeta: { flex: 1, gap: 2 },
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
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  replyLabel: { ...typography.caption, color: colors.accentPressed, fontWeight: '700', flex: 1 },
  replyDate: { ...typography.caption, color: colors.textTertiary },
  replyBody: { ...typography.meta, color: colors.textSecondary },

  composer: { gap: spacing.md },
  input: {
    minHeight: 92,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvas,
    padding: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
    textAlignVertical: 'top',
    ...(({ outlineStyle: 'none' } as unknown) as object),
  },
  composerActions: { flexDirection: 'row', gap: spacing.sm },
  composerButton: { flex: 1 },
});
