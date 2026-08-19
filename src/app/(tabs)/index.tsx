import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useScreenInsets } from '../../lib/insets';

import { BusinessCard } from '../../components/BusinessCard';
import { CategoryTile } from '../../components/Chip';
import { OwnerCta } from '../../components/OwnerCta';
import { SkeletonRail } from '../../components/Skeleton';
import { SearchField } from '../../components/SearchField';
import { Avatar, SectionHeader } from '../../components/primitives';
import { CATEGORIES, CATEGORY_TONES } from '../../data/categories';
import { DEFAULT_FILTERS } from '../../data/types';
import { formatDistance } from '../../lib/format';
import { openState } from '../../lib/hours';
import { searchBusinesses } from '../../lib/search';
import { useStore } from '../../lib/store';
import { radii, shadows, spacing, TAB_BAR_HEIGHT, TAB_BAR_INSET, typography, type ToneName } from '../../theme/tokens';
import { makeStyles, useTheme } from '../../theme/ThemeProvider';

export default function HomeScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useScreenInsets();
  const { businesses, loading, viewer, isSaved, toggleSaved, unreadCount, recommendations } =
    useStore();

  /*
   * Only the very first load. A refresh keeps whatever is already on screen —
   * swapping real listings for grey boxes because a background reload started
   * is a downgrade, not a loading state.
   */
  const firstLoad = loading && businesses.length === 0;
  const now = useMemo(() => new Date(), []);

  const popular = useMemo(
    () =>
      searchBusinesses(businesses, '', { ...DEFAULT_FILTERS, sort: 'rating' }, now).slice(0, 6),
    [businesses, now],
  );

  const nearby = useMemo(
    () =>
      searchBusinesses(businesses, '', { ...DEFAULT_FILTERS, sort: 'distance' }, now).slice(0, 6),
    [businesses, now],
  );

  const offers = useMemo(() => businesses.filter((b) => b.offer), [businesses]);

  const openCount = useMemo(
    () => businesses.filter((b) => openState(b.hours, now).isOpen).length,
    [businesses, now],
  );

  const goToSearch = (params?: Record<string, string>) =>
    router.push({ pathname: '/search', params });

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: TAB_BAR_HEIGHT + TAB_BAR_INSET + insets.bottom + spacing.xl,
        }}
      >
        {/* Header — who and where */}
        <View style={styles.header}>
          <Pressable
            style={styles.identity}
            onPress={() => router.push('/(tabs)/profile')}
            accessibilityRole="button"
            accessibilityLabel="Your profile"
          >
            <Avatar initials={viewer.initials} avatar={viewer.avatar} size={44} verified={viewer.verified} />
            <View style={styles.identityText}>
              <Text style={styles.city}>{viewer.city}</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={12} color={colors.accent} />
                <Text style={styles.area} numberOfLines={1}>
                  {viewer.area}
                </Text>
              </View>
            </View>
          </Pressable>

          <Pressable
            style={styles.bell}
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : 'Notifications'
            }
          >
            <Ionicons name="notifications-outline" size={21} color={colors.textPrimary} />
            {unreadCount > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Find the right place</Text>
              <Text style={styles.heroSubtitle}>
                {firstLoad
                  ? 'Looking for places near you'
                  : `${openCount} businesses open near you right now`}
              </Text>
            </View>
            <View style={styles.heroGlyph}>
              <Ionicons name="storefront" size={30} color={colors.accent} />
            </View>
          </View>
          <SearchField
            readOnly
            placeholder="Search businesses near you"
            onPress={() => goToSearch()}
          />
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {CATEGORIES.map((category) => (
            <CategoryTile
              key={category.id}
              label={category.label}
              icon={category.icon}
              tone={CATEGORY_TONES[category.id]}
              onPress={() => goToSearch({ category: category.id })}
            />
          ))}
        </ScrollView>

        {/* Quick filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickRow}
        >
          <QuickFilter
            icon="time"
            label="Open now"
            tone="green"
            onPress={() => goToSearch({ openNow: '1' })}
          />
          <QuickFilter
            icon="star"
            label="Top rated"
            tone="amber"
            onPress={() => goToSearch({ sort: 'rating' })}
          />
          <QuickFilter
            icon="walk"
            label="Under 1 km"
            tone="blue"
            onPress={() => goToSearch({ radius: '1000' })}
          />
          <QuickFilter
            icon="pricetag"
            label="Budget"
            tone="teal"
            onPress={() => goToSearch({ price: '1' })}
          />
        </ScrollView>

        {/*
          * For you.
          *
          * Above Popular, because it is the better answer to the same
          * question once there is anything to go on, and hidden entirely when
          * there is not: a rail called "For you" full of the same listings as
          * the one underneath it is worse than no rail.
          */}
        {!firstLoad && recommendations.length >= 3 ? (
          <>
            <SectionHeader title="For you" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
            >
              {recommendations.map(({ business, reason }) => (
                <View key={business.id} style={styles.pick}>
                  <BusinessCard
                    business={business}
                    saved={isSaved(business.id)}
                    onToggleSave={() => toggleSaved(business.id)}
                    onPress={() => router.push(`/business/${business.id}`)}
                  />
                  {/* Saying why is the point. A recommendation nobody can
                      disagree with is one nobody can trust. */}
                  <Text style={styles.reason} numberOfLines={2}>
                    {reason}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* Popular */}
        <SectionHeader
          title="Popular nearby"
          actionLabel="View all"
          onAction={() => goToSearch({ sort: 'rating' })}
        />
        {firstLoad ? (
          <SkeletonRail />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {popular.map((business) => (
              <BusinessCard
                key={business.id}
                business={business}
                saved={isSaved(business.id)}
                onToggleSave={() => toggleSaved(business.id)}
                onPress={() => router.push(`/business/${business.id}`)}
              />
            ))}
          </ScrollView>
        )}

        {/* Offers */}
        {offers.length > 0 ? (
          <>
            <SectionHeader title="Today's offers" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
            >
              {offers.map((business) => (
                <Pressable
                  key={business.id}
                  onPress={() => router.push(`/business/${business.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${business.offer?.label} at ${business.name}`}
                  style={({ pressed }) => [styles.offerCard, pressed && { opacity: 0.85 }]}
                >
                  <View style={styles.offerBadge}>
                    <Text style={styles.offerBadgeText}>{business.offer?.label}</Text>
                  </View>
                  <Text style={styles.offerName} numberOfLines={1}>
                    {business.name}
                  </Text>
                  <Text style={styles.offerDetail} numberOfLines={2}>
                    {business.offer?.detail}
                  </Text>
                  <View style={styles.offerFooter}>
                    <Ionicons name="location" size={11} color={colors.textTertiary} />
                    <Text style={styles.offerMeta} numberOfLines={1}>
                      {business.neighbourhood} · {formatDistance(business.distanceM)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* Closest to you */}
        <SectionHeader
          title="Closest to you"
          actionLabel="Open map"
          onAction={() => router.push('/(tabs)/map')}
        />
        {firstLoad ? (
          <SkeletonRail />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {nearby.map((business) => (
              <BusinessCard
                key={business.id}
                business={business}
                saved={isSaved(business.id)}
                onToggleSave={() => toggleSaved(business.id)}
                onPress={() => router.push(`/business/${business.id}`)}
              />
            ))}
          </ScrollView>
        )}

        {/* Owner call to action */}
        <OwnerCta
          title="Own a business?"
          body="List it free and manage your own profile."
          onPress={() => router.push('/owner/list')}
        />
      </ScrollView>
    </View>
  );
}

/**
 * A one-tap shortcut into search. The glyph carries the meaning — green for
 * open, amber for a rating, and so on — so the row reads as four different
 * offers rather than four copies of the same button.
 */
function QuickFilter({
  icon,
  label,
  tone,
  onPress,
}: {
  icon: string;
  label: string;
  tone: ToneName;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { tones } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.quickChip, pressed && { opacity: 0.75 }]}
    >
      <Ionicons name={icon as never} size={15} color={tones[tone].fg} />
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors, tones) => ({
  screen: { flex: 1, backgroundColor: colors.canvas },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.lg,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  identityText: { flex: 1, gap: 1 },
  city: { ...typography.cardTitle, color: colors.textPrimary },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  area: { ...typography.meta, color: colors.textSecondary, flexShrink: 1 },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  bellBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  bellBadgeText: { ...typography.caption, fontSize: 9, color: colors.textOnAccent, fontWeight: '700' },

  hero: {
    marginHorizontal: spacing.screen,
    backgroundColor: colors.surfaceWarm,
    borderRadius: radii.xxl,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroCopy: { flex: 1, gap: 3 },
  heroTitle: { ...typography.title, fontSize: 22, color: colors.textPrimary },
  heroSubtitle: { ...typography.meta, color: colors.textSecondary },
  heroGlyph: {
    width: 56,
    height: 56,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  categoryRow: {
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  quickRow: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    height: 36,
    paddingHorizontal: spacing.lg - 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickLabel: { ...typography.metaStrong, fontSize: 13.5, color: colors.textPrimary },

  pick: { width: 172, gap: spacing.xs },
  reason: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingHorizontal: spacing.xs,
  },
  rail: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },

  offerCard: {
    width: 208,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.xs + 2,
    ...shadows.card,
  },
  offerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.pill,
    marginBottom: spacing.xs,
  },
  offerBadgeText: { ...typography.caption, color: colors.accentPressed, fontWeight: '700' },
  offerName: { ...typography.cardTitle, fontSize: 15, color: colors.textPrimary },
  offerDetail: { ...typography.meta, color: colors.textSecondary },
  offerFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  offerMeta: { ...typography.caption, fontSize: 11.5, color: colors.textTertiary, flexShrink: 1 },

}));
