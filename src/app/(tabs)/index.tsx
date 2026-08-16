import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useScreenInsets } from '../../lib/insets';

import { BusinessCard } from '../../components/BusinessCard';
import { CategoryTile } from '../../components/Chip';
import { SearchField } from '../../components/SearchField';
import { Avatar, SectionHeader } from '../../components/primitives';
import { CATEGORIES } from '../../data/categories';
import { DEFAULT_FILTERS } from '../../data/types';
import { formatDistance } from '../../lib/format';
import { openState } from '../../lib/hours';
import { searchBusinesses } from '../../lib/search';
import { useStore } from '../../lib/store';
import {
  colors,
  radii,
  shadows,
  spacing,
  TAB_BAR_HEIGHT,
  TAB_BAR_INSET,
  typography,
} from '../../theme/tokens';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useScreenInsets();
  const { businesses, viewer, isSaved, toggleSaved, unreadCount } = useStore();
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
            <Avatar initials={viewer.initials} size={44} verified={viewer.verified} />
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
                {openCount} businesses open near you right now
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
            onPress={() => goToSearch({ openNow: '1' })}
          />
          <QuickFilter
            icon="star"
            label="Top rated"
            onPress={() => goToSearch({ sort: 'rating' })}
          />
          <QuickFilter
            icon="walk"
            label="Under 1 km"
            onPress={() => goToSearch({ radius: '1000' })}
          />
          <QuickFilter
            icon="pricetag"
            label="Budget"
            onPress={() => goToSearch({ price: '1' })}
          />
        </ScrollView>

        {/* Popular */}
        <SectionHeader
          title="Popular nearby"
          actionLabel="View all"
          onAction={() => goToSearch({ sort: 'rating' })}
        />
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

        {/* Owner call to action */}
        <Pressable
          onPress={() => router.push('/owner/claim')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.ownerCta, pressed && { opacity: 0.9 }]}
        >
          <View style={styles.ownerIcon}>
            <Ionicons name="business" size={22} color={colors.textOnAccent} />
          </View>
          <View style={styles.ownerCopy}>
            <Text style={styles.ownerTitle}>Own a business?</Text>
            <Text style={styles.ownerBody}>
              List it free and manage your own profile.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textOnAccent} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

function QuickFilter({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.quickChip, pressed && { opacity: 0.75 }]}
    >
      <Ionicons name={icon as never} size={15} color={colors.accent} />
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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

  ownerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.screen,
    backgroundColor: colors.accent,
    borderRadius: radii.xxl,
    padding: spacing.lg,
  },
  ownerIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerCopy: { flex: 1, gap: 2 },
  ownerTitle: { ...typography.cardTitle, color: colors.textOnAccent },
  ownerBody: { ...typography.meta, color: 'rgba(255,255,255,0.9)' },
});
