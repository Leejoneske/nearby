import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useScreenInsets } from '../../lib/insets';

import { Chip } from '../../components/Chip';
import { MapCanvas } from '../../components/MapCanvas';
import { Photo } from '../../components/Photo';
import { SearchField } from '../../components/SearchField';
import { Stars } from '../../components/Stars';
import { CATEGORIES, categoryOf } from '../../data/categories';
import { VIEWER_LOCATION } from '../../data/businesses';
import type { CategoryId } from '../../data/types';
import { formatDistance, formatPriceRange } from '../../lib/format';
import { openState } from '../../lib/hours';
import { openDirections } from '../../lib/openLink';
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

export default function MapScreen() {
  const router = useRouter();
  const insets = useScreenInsets();
  const { businesses, isSaved, toggleSaved } = useStore();

  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>('kahawa-collective');
  const now = useMemo(() => new Date(), []);

  const visible = useMemo(
    () => (categoryId ? businesses.filter((b) => b.categoryId === categoryId) : businesses),
    [businesses, categoryId],
  );

  const selected = visible.find((b) => b.id === selectedId) ?? null;

  const region = useMemo(
    () => ({
      latitude: VIEWER_LOCATION.lat,
      longitude: VIEWER_LOCATION.lng,
      latitudeDelta: 0.075,
      longitudeDelta: 0.075,
    }),
    [],
  );

  const markers = useMemo(
    () =>
      visible.map((b) => ({
        id: b.id,
        lat: b.lat,
        lng: b.lng,
        label: b.name,
        icon: categoryOf(b.categoryId).icon,
        selected: b.id === selectedId,
      })),
    [visible, selectedId],
  );

  const cardBottom = TAB_BAR_HEIGHT + TAB_BAR_INSET + Math.max(insets.bottom, TAB_BAR_INSET) + spacing.sm;

  return (
    <View style={styles.screen}>
      <MapCanvas region={region} markers={markers} onSelectMarker={setSelectedId} />

      {/* Floating search + filters */}
      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <SearchField
              readOnly
              placeholder="Search this area"
              onPress={() => router.push('/search')}
            />
          </View>
          <Pressable
            onPress={() => router.push('/search')}
            accessibilityRole="button"
            accessibilityLabel="Show results as a list"
            style={styles.roundButton}
          >
            <Ionicons name="list" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip
            label="All"
            selected={categoryId === null}
            onPress={() => setCategoryId(null)}
          />
          {CATEGORIES.map((category) => (
            <Chip
              key={category.id}
              label={category.label}
              icon={category.icon}
              selected={categoryId === category.id}
              onPress={() => {
                setCategoryId(categoryId === category.id ? null : category.id);
                setSelectedId(null);
              }}
            />
          ))}
        </ScrollView>
      </View>

      {/* Re-centre control, parked above the detail card */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Centre on my location"
        style={[styles.locateButton, { bottom: cardBottom + (selected ? 150 : 8) }]}
      >
        <Ionicons name="locate" size={20} color={colors.textPrimary} />
      </Pressable>

      {/* Selected business card */}
      {selected ? (
        <View style={[styles.cardWrap, { bottom: cardBottom }]} pointerEvents="box-none">
          <Pressable
            onPress={() => router.push(`/business/${selected.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${selected.name}`}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
          >
            <Photo
              categoryId={selected.categoryId}
              seed={selected.id}
              uri={selected.photos[0]}
              style={styles.cardPhoto}
              radius={radii.lg}
              iconSize={24}
            />
            <View style={styles.cardBody}>
              <Text style={styles.cardName} numberOfLines={1}>
                {selected.name}
              </Text>
              <Stars rating={selected.rating} reviewCount={selected.reviewCount} size={12} />
              <View style={styles.cardMetaRow}>
                <Ionicons name="pricetag" size={11} color={colors.accent} />
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {formatPriceRange(selected.priceFrom, selected.priceTo)}
                </Text>
              </View>
              <View style={styles.cardMetaRow}>
                <Ionicons name="location" size={11} color={colors.textTertiary} />
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {selected.address} · {formatDistance(selected.distanceM)}
                </Text>
              </View>
              <Text
                style={[
                  styles.cardState,
                  openState(selected.hours, now).isOpen ? styles.open : styles.closed,
                ]}
                numberOfLines={1}
              >
                {openState(selected.hours, now).label}
              </Text>
            </View>

            <View style={styles.cardActions}>
              <Pressable
                onPress={() => toggleSaved(selected.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={isSaved(selected.id) ? 'Remove from saved' : 'Save'}
                style={styles.cardIconButton}
              >
                <Ionicons
                  name={isSaved(selected.id) ? 'heart' : 'heart-outline'}
                  size={18}
                  color={isSaved(selected.id) ? colors.accent : colors.textTertiary}
                />
              </Pressable>
              <Pressable
                onPress={() => openDirections(selected.lat, selected.lng, selected.name)}
                accessibilityRole="button"
                accessibilityLabel={`Directions to ${selected.name}`}
                style={[styles.cardIconButton, styles.cardIconPrimary]}
              >
                <Ionicons name="navigate" size={18} color={colors.textOnAccent} />
              </Pressable>
            </View>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.hintWrap, { bottom: cardBottom }]} pointerEvents="none">
          <View style={styles.hint}>
            <Ionicons name="hand-left-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.hintText}>
              Tap a pin to see the business — {visible.length} on this map
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.mapLand },

  top: { position: 'absolute', left: 0, right: 0, top: 0, gap: spacing.md },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
  },
  searchWrap: { flex: 1, ...shadows.card },
  roundButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  chipRow: { paddingHorizontal: spacing.screen, gap: spacing.sm, paddingBottom: spacing.xs },

  locateButton: {
    position: 'absolute',
    right: spacing.screen,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },

  cardWrap: { position: 'absolute', left: 0, right: 0, paddingHorizontal: spacing.screen },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    padding: spacing.md,
    ...shadows.floating,
  },
  cardPhoto: { width: 88, height: 100 },
  cardBody: { flex: 1, gap: 2, paddingVertical: 2 },
  cardName: { ...typography.cardTitle, color: colors.textPrimary },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cardMeta: { ...typography.caption, fontSize: 11.5, color: colors.textSecondary, flexShrink: 1 },
  cardState: { ...typography.caption, fontSize: 11.5, marginTop: 2 },
  open: { color: colors.success },
  closed: { color: colors.danger },
  cardActions: { justifyContent: 'space-between', paddingVertical: 2 },
  cardIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconPrimary: { backgroundColor: colors.accent },

  hintWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    ...shadows.card,
  },
  hintText: { ...typography.meta, color: colors.textSecondary },
});
