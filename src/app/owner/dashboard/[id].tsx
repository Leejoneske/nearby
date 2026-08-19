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
  const { getBusiness, deleteBusiness, setBusinessListed } = useStore();
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [listing, setListing] = useState(false);

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
   * Two different actions, deliberately not the same weight.
   *
   * Taking a listing off the directory is a status change: the reviews, the
   * photos and the history all stay, and it goes back up with one tap. That
   * is what an owner closing for a fortnight actually wants, and it is the
   * one offered first.
   *
   * Deleting is the rare one — a duplicate, a test, a business that will
   * never exist again — and it destroys the reviews other people wrote. It
   * used to be the only option, which meant the screen had to warn like a
   * deletion for what is usually a pause, and ended up looking exactly like
   * ending an account. That was reported as confusing, and it was.
   */
  const unlist = async (listed: boolean) => {
    if (!business) return;
    setListing(true);
    setRemoveError(null);
    try {
      await setBusinessListed(business.id, listed, reason);
    } catch (e) {
      setRemoveError(
        e instanceof Error && e.message.trim()
          ? e.message
          : 'We could not change that just now. Try again.',
      );
    } finally {
      setListing(false);
    }
  };

  const confirmDelete = () => {
    if (!business) return;
    const reviews = business.reviews.length;
    const detail = [
      `${business.name} and everything on it goes for good.`,
      reviews > 0
        ? `The ${reviews} ${reviews === 1 ? 'review' : 'reviews'} people wrote about it go too, and cannot be recovered.`
        : null,
      'If you only want it off the directory for a while, close it instead and put it back whenever you like.',
    ]
      .filter(Boolean)
      .join('\n\n');

    Alert.alert('Delete this listing for good?', detail, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete it', style: 'destructive', onPress: () => void remove() },
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

  const hidden = business.status === 'hidden';
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

        {/* Taking it down, and the rarer, heavier thing underneath */}
        <Text style={styles.sectionTitle}>
          {hidden ? 'Put it back' : 'Close this listing'}
        </Text>
        <View style={styles.section}>
          <Card style={styles.manageCard}>
            <Text style={styles.manageBody}>
              {hidden
                ? `${business.name} is off the directory, so only you can see it. Everything is still here, including your reviews.`
                : `Takes ${business.name} off the directory for now. Your reviews, photos and hours all stay, and you can put it back whenever you like.`}
            </Text>
            <Field
              label={hidden ? 'Anything to note?' : 'Why are you closing it?'}
              value={reason}
              onChangeText={setReason}
              placeholder={hidden ? 'Reopened, back to normal hours' : 'Closed for renovation, on holiday, something else'}
              multiline
              hint="Optional."
            />
            {removeError ? <Text style={styles.dangerError}>{removeError}</Text> : null}
            <Button
              label={hidden ? 'Put it back on the directory' : 'Take it off the directory'}
              icon={hidden ? 'eye-outline' : 'eye-off-outline'}
              variant="secondary"
              size="md"
              loading={listing}
              onPress={() => void unlist(hidden)}
            />

            {/*
              * Below the fold and much quieter, because it is the rare one.
              * A plain link rather than a red button: this is for a listing
              * that should never have existed, not for one that is shut for
              * the week, and the button above is what almost everybody wants.
              */}
            <Pressable
              onPress={confirmDelete}
              disabled={removing}
              hitSlop={8}
              accessibilityRole="button"
              style={styles.deleteRow}
            >
              <Text style={styles.deleteLink}>
                {removing ? 'Deleting…' : 'Or delete it permanently'}
              </Text>
            </Pressable>
            <Text style={styles.deleteNote}>
              Removes the listing and the reviews people wrote about it, for good.
            </Text>
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

  manageCard: { gap: spacing.md },
  manageBody: { ...typography.meta, color: colors.textSecondary },
  dangerError: { ...typography.meta, color: colors.danger },
  deleteRow: { alignItems: 'center', paddingTop: spacing.sm },
  deleteLink: { ...typography.metaStrong, color: colors.danger },
  deleteNote: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: -spacing.xs,
  },
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
