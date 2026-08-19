import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useScreenInsets } from '../../lib/insets';

import { Button } from '../../components/Button';
import { MapCanvas } from '../../components/MapCanvas';
import { OwnerCta } from '../../components/OwnerCta';
import { ReportSheet } from '../../components/ReportSheet';
import { Photo } from '../../components/Photo';
import { Stars } from '../../components/Stars';
import { Avatar, Card, EmptyState, Pill } from '../../components/primitives';
import { CATEGORY_TONES, categoryOf } from '../../data/categories';
import {
  formatDistance,
  formatPriceRange,
  formatRelativeDate,
  formatReviewCount,
} from '../../lib/format';
import { DAY_NAMES, formatDayRange, openState } from '../../lib/hours';
import { stateBadge } from '../../lib/listingState';
import { shareBusiness } from '../../lib/sharing';
import { callPhone, openDirections, openWebsite } from '../../lib/openLink';
import { useStore } from '../../lib/store';
import { absoluteFill, colors, radii, shadows, spacing, typography } from '../../theme/tokens';

export default function BusinessScreen() {
  const router = useRouter();
  const insets = useScreenInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    getBusiness, isSaved, toggleSaved, loadDetail, recordEvent, reportBusiness,
    markViewed, session,
  } = useStore();
  const [reporting, setReporting] = useState(false);

  const business = getBusiness(id);
  const now = useMemo(() => new Date(), []);
  const badge = stateBadge(business?.status);

  // Lists carry no reviews, so the page asks for them as it opens.
  useEffect(() => {
    if (id) void loadDetail(id);
  }, [id, loadDetail]);

  /*
   * Both records of a view are made here, because here is where the view
   * happens.
   *
   * `markViewed` used to be called by the list screens instead, so opening a
   * business from the home feed, the map or a notification recorded nothing
   * at all — which is why Recent was empty for somebody who had plainly been
   * looking at businesses. One screen is reached by every route in, and this
   * is it.
   */
  const dbId = business?.dbId;
  useEffect(() => {
    if (dbId) recordEvent(dbId, 'view');
  }, [dbId, recordEvent]);

  useEffect(() => {
    if (id) markViewed(id);
  }, [id, markViewed]);

  // Every hook has to run before the early return below. Navigating from a
  // listing that exists to one that does not would otherwise change the hook
  // order between renders, which React treats as a fatal error.
  const ratingBreakdown = useMemo(() => {
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
          body="This business may have been removed. Try searching for it again."
        />
        <View style={styles.notFoundAction}>
          <Button label="Back to search" onPress={() => router.replace('/search')} size="md" />
        </View>
      </View>
    );
  }

  /*
   * Directions stay inside the app. We already draw a map, and being thrown
   * into a different app to answer "where is this" loses the listing you
   * were reading. Turn-by-turn navigation is a separate ask, and it is on
   * the map card as "Open in Maps" for the times somebody actually wants it.
   */
  const showOnMap = () => {
    if (business.dbId) recordEvent(business.dbId, 'directions');
    router.push({ pathname: '/(tabs)/map', params: { focus: business.id } });
  };

  const state = openState(business.hours, now);
  const saved = isSaved(business.id);
  const category = categoryOf(business.categoryId);
  const today = new Date().getDay();

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Photo
            categoryId={business.categoryId}
            seed={business.id}
            uri={business.photos[0]}
            style={styles.heroPhoto}
            radius={0}
            iconSize={54}
          />
          <View style={[styles.heroBar, { top: insets.top + spacing.sm }]}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.heroButton}
            >
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <View style={styles.heroBarRight}>
              <Pressable
                onPress={() => toggleSaved(business.id)}
                accessibilityRole="button"
                accessibilityLabel={saved ? 'Remove from saved' : 'Save this business'}
                style={styles.heroButton}
              >
                <Ionicons
                  name={saved ? 'heart' : 'heart-outline'}
                  size={20}
                  color={saved ? colors.accent : colors.textPrimary}
                />
              </Pressable>
              <Pressable
                onPress={() => void shareBusiness(business)}
                accessibilityRole="button"
                accessibilityLabel="Share this business"
                style={styles.heroButton}
              >
                {/*
                  * `share-social` rather than `share`. Ionicons' `share` is
                  * the iOS box-with-an-arrow, which on Android reads as
                  * upload or export; the linked nodes read as share on both.
                  */}
                <Ionicons name="share-social-outline" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.sheet}>
          {/* Title block */}
          <View style={styles.titleBlock}>
            <View style={styles.badgeRow}>
              <Pill label={category.label} icon={category.icon} tone="accent" />
              {business.verified ? (
                <Pill label="Verified" icon="checkmark-circle" tone="success" />
              ) : null}
              {business.ownedByViewer ? <Pill label="You manage this" icon="key" /> : null}
            </View>

            <Text style={styles.name}>{business.name}</Text>

            {/*
              * Nobody but the owner can reach a listing in either of these
              * states, so this only ever appears for them — and it is the
              * answer to the question they have straight after submitting.
              */}
            {badge ? (
              <View style={styles.stateNotice}>
                <Ionicons name={badge.icon as never} size={17} color={colors.accentPressed} />
                <Text style={styles.stateNoticeText}>{badge.note}</Text>
              </View>
            ) : null}
            <Text style={styles.tagline}>{business.tagline}</Text>

            <View style={styles.ratingRow}>
              <Stars rating={business.rating} size={15} showAllStars />
              <Text style={styles.ratingValue}>{business.rating.toFixed(1)}</Text>
              <Text style={styles.ratingCount}>({formatReviewCount(business.reviewCount)})</Text>
            </View>

            <View style={styles.statusRow}>
              <Text style={[styles.status, state.isOpen ? styles.open : styles.closed]}>
                {state.label}
              </Text>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.statusMeta}>{formatDistance(business.distanceM)} away</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionRow}>
            <Action
              icon="call"
              label="Call"
              primary
              onPress={() => {
                if (business.dbId) recordEvent(business.dbId, 'call');
                callPhone(business.phone);
              }}
            />
            <Action
              icon="navigate"
              label="Directions"
              onPress={() => showOnMap()}
            />
            <Action
              icon="globe-outline"
              label="Website"
              disabled={!business.website}
              onPress={() => business.website && openWebsite(business.website)}
            />
            <Action
              icon="chatbubble-ellipses-outline"
              label="Review"
              onPress={() => router.push(`/write-review/${business.id}`)}
            />
          </View>

          {/* About */}
          <Section title="About">
            <Text style={styles.body}>{business.description}</Text>
            <View style={styles.amenityRow}>
              {business.amenities.map((amenity) => (
                <Pill key={amenity} label={amenity} />
              ))}
            </View>
          </Section>

          {/* Details */}
          <Section title="Details">
            <Card style={styles.detailCard}>
              <DetailLine icon="location-outline" text={business.address} />
              <DetailLine icon="call-outline" text={business.phone} />
              {business.website ? (
                <DetailLine icon="globe-outline" text={business.website} />
              ) : null}
              <DetailLine
                icon="pricetag-outline"
                text={`Typical spend ${formatPriceRange(business.priceFrom, business.priceTo)}`}
                last
              />
            </Card>
          </Section>

          {/* Hours */}
          <Section title="Opening hours">
            <Card>
              {DAY_NAMES.map((day, index) => (
                <View
                  key={day}
                  style={[styles.hourRow, index < 6 && styles.hourDivider]}
                >
                  <Text style={[styles.hourDay, index === today && styles.hourToday]}>
                    {day}
                    {index === today ? ' · today' : ''}
                  </Text>
                  <Text style={[styles.hourValue, index === today && styles.hourToday]}>
                    {formatDayRange(business.hours[index])}
                  </Text>
                </View>
              ))}
            </Card>
          </Section>

          {/* Location */}
          <Section title="Location">
            <Pressable
              onPress={showOnMap}
              accessibilityRole="button"
              accessibilityLabel={`Show ${business.name} on the map`}
              style={styles.mapCard}
            >
              <MapCanvas
                region={{
                  latitude: business.lat,
                  longitude: business.lng,
                  latitudeDelta: 0.012,
                  longitudeDelta: 0.012,
                }}
                markers={[
                  {
                    id: business.id,
                    lat: business.lat,
                    lng: business.lng,
                    label: business.name,
                    icon: category.icon,
                    tone: CATEGORY_TONES[business.categoryId],
                    selected: true,
                  },
                ]}
              />
              {/* The canvas swallows touches, so the tap target sits over it. */}
              <View style={styles.mapVeil} pointerEvents="none" />
            </Pressable>
            <View style={styles.mapFooter}>
              <Text style={styles.mapAddress}>{business.address}</Text>
              <Pressable
                onPress={() => {
                  if (business.dbId) recordEvent(business.dbId, 'directions');
                  openDirections(business.lat, business.lng, business.name);
                }}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={styles.mapLink}>Open in Maps</Text>
              </Pressable>
            </View>
          </Section>

          {/* Reviews */}
          <Section
            title={`Reviews (${business.reviewCount})`}
            action="See all"
            onAction={() => router.push(`/reviews/${business.id}`)}
          >
            <Card style={styles.summaryCard}>
              <View style={styles.summaryLeft}>
                <Text style={styles.summaryScore}>{business.rating.toFixed(1)}</Text>
                <Stars rating={business.rating} size={13} showAllStars />
                <Text style={styles.summaryCount}>{formatReviewCount(business.reviewCount)}</Text>
              </View>
              <View style={styles.summaryBars}>
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = ratingBreakdown[star - 1];
                  const total = Math.max(1, business.reviews.length);
                  return (
                    <View key={star} style={styles.barRow}>
                      <Text style={styles.barLabel}>{star}</Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[styles.barFill, { width: `${(count / total) * 100}%` }]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>

            {business.reviews.map((review) => (
              <Card key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Avatar initials={review.authorInitials} avatar={review.authorAvatar} size={38} />
                  <View style={styles.reviewMeta}>
                    <Text style={styles.reviewAuthor}>{review.authorName}</Text>
                    <View style={styles.reviewSubRow}>
                      <Stars rating={review.rating} size={12} showAllStars />
                      <Text style={styles.reviewDate}>
                        {formatRelativeDate(review.date, now)}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.reviewBody}>{review.body}</Text>

                {review.ownerReply ? (
                  <View style={styles.reply}>
                    <View style={styles.replyHeader}>
                      <Ionicons name="return-down-forward" size={14} color={colors.accent} />
                      <Text style={styles.replyLabel}>Response from the owner</Text>
                    </View>
                    <Text style={styles.replyBody}>{review.ownerReply.body}</Text>
                  </View>
                ) : null}
              </Card>
            ))}
          </Section>

          {/* Manage, or an invitation to list one of your own */}
          {business.ownedByViewer ? (
            <View style={styles.ownerBlock}>
              <Button
                label="Manage this listing"
                icon="settings-outline"
                onPress={() => router.push(`/owner/edit/${business.id}`)}
              />
            </View>
          ) : (
            /*
             * An invitation to list your own, and nothing else.
             *
             * This is not the place to offer somebody a listing that is not
             * theirs. A business is in this directory because whoever runs it
             * put it there, so the only thing worth saying to a visitor is
             * the same thing the home screen says.
             */
            <View style={styles.ownerWrap}>
              <OwnerCta
                title="Own a business?"
                body="List it free and manage your own profile."
                onPress={() => router.push('/owner/list')}
              />
            </View>
          )}

          <Pressable
            onPress={() => setReporting(true)}
            accessibilityRole="button"
            style={styles.reportRow}
            hitSlop={6}
          >
            <Ionicons name="flag-outline" size={15} color={colors.textTertiary} />
            <Text style={styles.reportText}>Report a problem with this listing</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ReportSheet
        visible={reporting}
        signedIn={session.status === 'signedIn'}
        subject={business.name}
        onClose={() => setReporting(false)}
        onSubmit={async (reason) => {
          await reportBusiness(business.id, reason);
        }}
      />

      {/* Sticky bottom bar */}
      <View style={[styles.stickyBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.stickyPrice}>
          <Text style={styles.stickyLabel}>Typical spend</Text>
          <Text style={styles.stickyValue} numberOfLines={1}>
            {formatPriceRange(business.priceFrom, business.priceTo)}
          </Text>
        </View>
        <Button
          label="Get directions"
          icon="navigate"
          size="md"
          fullWidth={false}
          style={styles.stickyButton}
          onPress={showOnMap}
        />
      </View>
    </View>
  );
}

function Section({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action ? (
          <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
            <Text style={styles.sectionAction}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Action({
  icon,
  label,
  onPress,
  primary,
  disabled,
}: {
  icon: string;
  label: string;
  onPress?: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }, disabled && { opacity: 0.4 }]}
    >
      <View style={[styles.actionIcon, primary && styles.actionIconPrimary]}>
        <Ionicons
          name={icon as never}
          size={19}
          color={primary ? colors.textOnAccent : colors.textPrimary}
        />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function DetailLine({ icon, text, last }: { icon: string; text: string; last?: boolean }) {
  return (
    <View style={[styles.detailLine, !last && styles.detailDivider]}>
      <Ionicons name={icon as never} size={17} color={colors.textSecondary} />
      <Text style={styles.detailText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  centered: { justifyContent: 'center' },
  notFoundAction: { paddingHorizontal: spacing.huge },

  hero: { height: 260 },
  heroPhoto: { ...absoluteFill },
  heroBar: {
    position: 'absolute',
    left: spacing.screen,
    right: spacing.screen,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroBarRight: { flexDirection: 'row', gap: spacing.sm },
  heroButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },

  sheet: {
    marginTop: -spacing.xxl,
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingTop: spacing.xl,
  },

  titleBlock: { paddingHorizontal: spacing.screen, gap: spacing.sm },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  stateNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  stateNoticeText: { ...typography.meta, color: colors.accentPressed, flex: 1 },
  name: { ...typography.display, fontSize: 28, lineHeight: 34, color: colors.textPrimary },
  tagline: { ...typography.body, color: colors.textSecondary, marginTop: -spacing.xs },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ratingValue: { ...typography.bodyStrong, color: colors.textPrimary },
  ratingCount: { ...typography.meta, color: colors.textSecondary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  status: { ...typography.metaStrong },
  open: { color: colors.success },
  closed: { color: colors.danger },
  dot: { color: colors.textTertiary },
  statusMeta: { ...typography.meta, color: colors.textSecondary },

  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.xl,
  },
  action: { alignItems: 'center', gap: spacing.sm, width: 72 },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  actionIconPrimary: { backgroundColor: colors.accent },
  actionLabel: { ...typography.caption, fontSize: 11.5, color: colors.textSecondary },

  section: { paddingHorizontal: spacing.screen, marginBottom: spacing.xxl, gap: spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { ...typography.sectionTitle, color: colors.textPrimary },
  sectionAction: { ...typography.metaStrong, color: colors.accent },
  body: { ...typography.body, color: colors.textSecondary },
  amenityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  detailCard: { paddingVertical: spacing.xs },
  detailLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  detailDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailText: { ...typography.body, color: colors.textPrimary, flex: 1 },

  hourRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md - 2,
  },
  hourDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  hourDay: { ...typography.body, color: colors.textSecondary },
  hourValue: { ...typography.body, color: colors.textPrimary },
  hourToday: { fontWeight: '700', color: colors.textPrimary },

  mapCard: {
    height: 180,
    borderRadius: radii.xl,
    overflow: 'hidden',
    ...shadows.card,
  },
  mapVeil: { ...absoluteFill },
  mapFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  mapLink: { ...typography.metaStrong, color: colors.accent },
  mapAddress: { ...typography.meta, color: colors.textSecondary },

  summaryCard: { flexDirection: 'row', gap: spacing.xl, alignItems: 'center' },
  summaryLeft: { alignItems: 'center', gap: 3, width: 96 },
  summaryScore: { ...typography.display, fontSize: 36, color: colors.textPrimary },
  summaryCount: { ...typography.caption, color: colors.textSecondary },
  summaryBars: { flex: 1, gap: 5 },
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

  reviewCard: { gap: spacing.md },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reviewMeta: { flex: 1, gap: 2 },
  reviewAuthor: { ...typography.bodyStrong, color: colors.textPrimary },
  reviewSubRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewDate: { ...typography.caption, color: colors.textTertiary },
  reviewBody: { ...typography.body, color: colors.textSecondary },
  reply: {
    backgroundColor: colors.canvas,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  replyLabel: { ...typography.caption, color: colors.accentPressed, fontWeight: '700' },
  replyBody: { ...typography.meta, color: colors.textSecondary },

  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  reportText: { ...typography.meta, color: colors.textTertiary },

  ownerBlock: { paddingHorizontal: spacing.screen, marginBottom: spacing.xxl },
  ownerWrap: { marginBottom: spacing.xxl },

  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  stickyPrice: { flex: 1, gap: 1 },
  stickyLabel: { ...typography.caption, color: colors.textTertiary },
  stickyValue: { ...typography.bodyStrong, color: colors.textPrimary },
  stickyButton: { paddingHorizontal: spacing.xl },
});
