import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useScreenInsets } from '../../../lib/insets';

import { Button } from '../../../components/Button';
import { Field } from '../../../components/Field';
import { Stars } from '../../../components/Stars';
import { Avatar, Card, EmptyState, Pill } from '../../../components/primitives';
import { formatDelta, formatRelativeDate } from '../../../lib/format';
import { openState } from '../../../lib/hours';
import * as api from '../../../lib/api';
import { useStore } from '../../../lib/store';
import { radii, shadows, spacing, typography, type ToneName } from '../../../theme/tokens';
import { makeStyles, useTheme } from '../../../theme/ThemeProvider';

export default function OwnerDashboard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useScreenInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getBusiness, deleteBusiness } = useStore();
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const business = getBusiness(id);
  const now = useMemo(() => new Date(), []);

  /*
   * Counts come from recorded events, and the database refuses them to
   * anybody but the owner. A brand new listing legitimately has none, so
   * `null` means "not loaded" and zeroes mean "nobody yet" — the screen says
   * different things for each.
   */
  const [insights, setInsights] = useState<api.Insights | null>(null);
  const [insightsLoaded, setInsightsLoaded] = useState(false);

  useEffect(() => {
    const dbId = business?.dbId;
    if (!dbId) return;
    let alive = true;
    (async () => {
      const data = await api.fetchInsights(dbId);
      if (!alive) return;
      setInsights(data);
      setInsightsLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [business?.dbId]);

  /*
   * Taking a listing down, with what it costs said first.
   *
   * Two prompts rather than one. This removes reviews other people wrote
   * about a real place, and there is no claim flow, so nobody can pick the
   * listing up afterwards — it would have to be added again from nothing.
   *
   * The reason is a field on the screen rather than a prompt in the dialog.
   * `Alert.prompt` is iOS only, so a dialog that asks for it would be a
   * question half the people using this app never get shown.
   */
  const confirmRemove = () => {
    if (!business) return;
    const reviews = business.reviews.length;
    const detail = [
      `${business.name} comes off the directory for good.`,
      reviews > 0
        ? `The ${reviews} ${reviews === 1 ? 'review' : 'reviews'} people wrote about it go too.`
        : null,
      'Nobody else can take it over, and it cannot be brought back.',
    ]
      .filter(Boolean)
      .join('\n\n');

    Alert.alert('Remove this listing?', detail, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Last chance', 'This cannot be undone. Remove it now?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove it', style: 'destructive', onPress: () => void remove() },
          ]),
      },
    ]);
  };

  const remove = async () => {
    if (!business) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await deleteBusiness(business.id, reason);
      router.replace('/(tabs)/profile');
    } catch (e) {
      setRemoveError(
        e instanceof Error && e.message.trim()
          ? e.message
          : 'We could not remove that just now. Try again.',
      );
      setRemoving(false);
    }
  };

  if (!business) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <EmptyState
          icon="business-outline"
          title="Listing not found"
          body="This listing may have been removed from your account."
        />
      </View>
    );
  }

  const state = openState(business.hours, now);
  const unanswered = business.reviews.filter((r) => !r.ownerReply);

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: insets.bottom + spacing.huge,
        }}
      >
        {/* Header */}
        <View style={styles.header}>
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
            Dashboard
          </Text>
          <Pressable
            onPress={() => router.push(`/business/${business.id}`)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="View public listing"
            style={styles.iconButton}
          >
            <Ionicons name="eye-outline" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Business identity */}
        <View style={styles.titleBlock}>
          <Text style={styles.name}>{business.name}</Text>
          <View style={styles.titleMeta}>
            <Pill
              label={state.isOpen ? 'Open now' : 'Closed now'}
              tone={state.isOpen ? 'success' : 'danger'}
              icon="time"
            />
            {business.verified ? (
              <Pill label="Verified" icon="checkmark-circle" tone="accent" />
            ) : (
              <Pill label="Verification pending" icon="hourglass" tone="danger" />
            )}
          </View>
        </View>

        {/* Insights */}
        <Text style={styles.sectionTitle}>This week</Text>
        {insights ? (
          <View style={styles.statGrid}>
            <StatTile
              icon="eye"
              value={insights.viewsThisWeek.toLocaleString()}
              label="Profile views"
              tone="blue"
              delta={
                insights.viewsLastWeek > 0
                  ? formatDelta(insights.viewsThisWeek, insights.viewsLastWeek)
                  : undefined
              }
              positive={insights.viewsThisWeek >= insights.viewsLastWeek}
            />
            <StatTile
              icon="call"
              value={String(insights.callsThisWeek)}
              label="Calls"
              tone="green"
            />
            <StatTile
              icon="navigate"
              value={String(insights.directionsThisWeek)}
              label="Direction requests"
              tone="teal"
            />
            <StatTile
              icon="chatbubbles"
              value={String(business.reviewCount)}
              label="Reviews"
              tone="violet"
            />
          </View>
        ) : (
          <View style={styles.section}>
            <Card>
              <Text style={styles.quietNote}>
                {insightsLoaded
                  ? 'Nobody has looked at this listing yet. Numbers appear here as people find you.'
                  : 'Counting…'}
              </Text>
            </Card>
          </View>
        )}

        {/* Manage */}
        <Text style={styles.sectionTitle}>Manage</Text>
        <View style={styles.section}>
          <Card style={styles.actionsCard}>
            <ActionRow
              icon="create-outline"
              label="Edit business details"
              detail="Name, category, description, contact"
              tone="orange"
              onPress={() => router.push(`/owner/edit/${business.id}`)}
            />
            <ActionRow
              icon="time-outline"
              label="Opening hours"
              detail={state.label}
              tone="green"
              onPress={() => router.push(`/owner/edit/${business.id}`)}
            />
            <ActionRow
              icon="images-outline"
              label="Photos"
              tone="pink"
              detail={
                business.photos.length
                  ? `${business.photos.length} uploaded`
                  : 'No photos yet, add some'
              }
              onPress={() => router.push(`/owner/edit/${business.id}`)}
            />
            <ActionRow
              icon="chatbubbles-outline"
              label="Reviews"
              tone="violet"
              detail={
                unanswered.length
                  ? `${unanswered.length} waiting for a reply`
                  : 'All caught up'
              }
              badge={unanswered.length || undefined}
              onPress={() => router.push(`/owner/reviews/${business.id}`)}
              last
            />
          </Card>
        </View>

        {/* Needs a reply */}
        <Text style={styles.sectionTitle}>Needs your reply</Text>
        <View style={styles.section}>
          {unanswered.length === 0 ? (
            <Card>
              <View style={styles.caughtUp}>
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                <Text style={styles.caughtUpText}>
                  Every review has a reply. Nice work.
                </Text>
              </View>
            </Card>
          ) : (
            unanswered.slice(0, 2).map((review) => (
              <Card key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Avatar initials={review.authorInitials} avatar={review.authorAvatar} size={36} />
                  <View style={styles.reviewMeta}>
                    <Text style={styles.reviewAuthor}>{review.authorName}</Text>
                    <View style={styles.reviewSubRow}>
                      <Stars rating={review.rating} size={11} showAllStars />
                      <Text style={styles.reviewDate}>
                        {formatRelativeDate(review.date, now)}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.reviewBody} numberOfLines={3}>
                  {review.body}
                </Text>
                <Button
                  label="Write a reply"
                  variant="secondary"
                  size="sm"
                  onPress={() => router.push(`/owner/reviews/${business.id}`)}
                />
              </Card>
            ))
          )}
        </View>

        {/* Removing it */}
        <Text style={styles.sectionTitle}>Remove this listing</Text>
        <View style={styles.section}>
          <Card style={styles.dangerCard}>
            <Text style={styles.dangerBody}>
              Takes {business.name} off the directory for good, along with any
              reviews people have written about it. Nobody else can take it over,
              and it cannot be brought back.
            </Text>
            <Field
              label="Why are you removing it?"
              value={reason}
              onChangeText={setReason}
              placeholder="Closed down, listed by mistake, something else"
              multiline
              hint="Optional. It helps us understand what is not working."
            />
            {removeError ? <Text style={styles.dangerError}>{removeError}</Text> : null}
            <Button
              label="Remove this listing"
              variant="danger"
              size="md"
              loading={removing}
              onPress={confirmRemove}
            />
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

function StatTile({
  icon,
  value,
  label,
  tone,
  delta,
  positive,
}: {
  icon: string;
  value: string;
  label: string;
  tone: ToneName;
  delta?: string;
  positive?: boolean;
}) {
  const styles = useStyles();
  const { tones } = useTheme();
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIcon, { backgroundColor: tones[tone].soft }]}>
        <Ionicons name={icon as never} size={16} color={tones[tone].fg} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      {delta ? (
        <Text style={[styles.statDelta, positive ? styles.deltaUp : styles.deltaDown]}>
          {delta} vs last week
        </Text>
      ) : null}
    </View>
  );
}

function ActionRow({
  icon,
  label,
  detail,
  tone,
  onPress,
  badge,
  last,
}: {
  icon: string;
  label: string;
  detail: string;
  tone: ToneName;
  onPress: () => void;
  badge?: number;
  last?: boolean;
}) {
  const styles = useStyles();
  const { colors, tones } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.actionRow,
        !last && styles.actionDivider,
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: tones[tone].soft }]}>
        <Ionicons name={icon as never} size={17} color={tones[tone].fg} />
      </View>
      <View style={styles.actionText}>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={styles.actionDetail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
    </Pressable>
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

  dangerCard: { gap: spacing.md },
  dangerBody: { ...typography.meta, color: colors.textSecondary },
  dangerError: { ...typography.meta, color: colors.danger },
  headerTitle: { ...typography.cardTitle, color: colors.textPrimary, flex: 1, textAlign: 'center' },

  titleBlock: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xl, gap: spacing.md },
  name: { ...typography.display, color: colors.textPrimary },
  titleMeta: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },

  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.textPrimary,
    paddingHorizontal: spacing.screen,
    marginBottom: spacing.md,
  },
  section: { paddingHorizontal: spacing.screen, gap: spacing.md, marginBottom: spacing.xxl },

  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.screen,
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  statTile: {
    // Two per row: half the space minus half the gap.
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: 2,
    ...shadows.card,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: { ...typography.title, fontSize: 22, color: colors.textPrimary },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  statDelta: { ...typography.caption, fontSize: 10.5, marginTop: 2 },
  deltaUp: { color: colors.success },
  deltaDown: { color: colors.danger },

  actionsCard: { paddingVertical: 0 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
  },
  actionDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1, gap: 1 },
  actionLabel: { ...typography.bodyStrong, color: colors.textPrimary },
  actionDetail: { ...typography.meta, color: colors.textSecondary },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...typography.caption, fontSize: 11, color: colors.textOnAccent, fontWeight: '700' },

  quietNote: { ...typography.body, color: colors.textSecondary },
  caughtUp: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  caughtUpText: { ...typography.body, color: colors.textSecondary, flex: 1 },

  reviewCard: { gap: spacing.md },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reviewMeta: { flex: 1, gap: 2 },
  reviewAuthor: { ...typography.bodyStrong, color: colors.textPrimary },
  reviewSubRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewDate: { ...typography.caption, color: colors.textTertiary },
  reviewBody: { ...typography.body, color: colors.textSecondary },
}));
