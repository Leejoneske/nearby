import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useScreenInsets } from '../../lib/insets';

import { Chip } from '../../components/Chip';
import { MapCanvas } from '../../components/MapCanvas';
import { Photo } from '../../components/Photo';
import { SearchField } from '../../components/SearchField';
import { Stars } from '../../components/Stars';
import { CATEGORIES, CATEGORY_TONES, categoryOf } from '../../data/categories';
import type { CategoryId } from '../../data/types';
import { formatDistance, formatPriceRange } from '../../lib/format';
import { reportError } from '../../lib/errorReporting';
import { openState } from '../../lib/hours';
import { countOutside, frameFor } from '../../lib/mapFrame';
import { openDirections } from '../../lib/openLink';
import { describeRoute, fetchRoute, type Route } from '../../lib/route';
import { useStore } from '../../lib/store';
import { radii, shadows, spacing, TAB_BAR_HEIGHT, TAB_BAR_INSET, typography } from '../../theme/tokens';
import { makeStyles, useTheme } from '../../theme/ThemeProvider';

export default function MapScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useScreenInsets();
  const { businesses, isSaved, toggleSaved, origin, locationPrecise } = useStore();

  // Arriving from a listing's Directions button: open on that one.
  const { focus } = useLocalSearchParams<{ focus?: string }>();

  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  /*
   * Set when somebody asks to be centred on themselves, and cleared the
   * moment they pick a pin.
   *
   * The button used to have an accessibility label reading "Centre on my
   * location" and no handler at all — a control that announces itself to a
   * screen reader and does nothing is worse than no control.
   */
  const [followMe, setFollowMe] = useState(false);
  const now = useMemo(() => new Date(), []);

  const visible = useMemo(
    () => (categoryId ? businesses.filter((b) => b.categoryId === categoryId) : businesses),
    [businesses, categoryId],
  );

  // What the map opened on until somebody taps a different pin. Derived
  // rather than copied into state by an effect, so a new `focus` param does
  // not need syncing.
  const selectedId = followMe ? null : (picked ?? focus ?? null);
  const selected = visible.find((b) => b.id === selectedId) ?? null;

  /*
   * Centre on the listing we were sent to look at, otherwise on wherever the
   * device is. This used to be pinned to the city the app was built around,
   * so anybody outside it opened a map of somewhere else with no pins in
   * frame — which looks exactly like a map that failed to load.
   *
   * The span tightens when there is one place to look at: a 7 km window
   * around a single shop tells you nothing about where it is.
   */
  /*
   * Frame everything, rather than a fixed window around the device.
   *
   * The window used to be 0.075 degrees — eight kilometres — centred on
   * wherever the phone was. Every listing further out than that was on the
   * map, correctly positioned, and off the edge of the screen. From inside
   * the app that is indistinguishable from a map that has lost the listings,
   * and that is exactly what it was reported as.
   *
   * `frameFor` is in `lib/mapFrame.ts` with the awkward cases pinned down by
   * tests: two pins a hundred kilometres apart, pins on top of each other, a
   * 0,0 coordinate from a listing that never got a real one.
   */
  const region = useMemo(
    () => frameFor(visible, origin, selected),
    [visible, origin, selected],
  );

  /*
   * A real route, drawn on our own map.
   *
   * Asked for only when there is somewhere to go and somewhere to go from.
   * The answer is allowed to be nothing — it comes from a free public
   * routing server — and nothing means the card still shows the straight
   * line distance it always did.
   */
  /*
   * The route is stored against the listing it belongs to, not on its own.
   *
   * That is what makes it safe to leave in state while a new one loads: a
   * route to the last place you tapped, drawn over the place you just tapped,
   * is worse than no line at all. Comparing the id at render time means there
   * is nothing to clear and no effect that resets state as it runs.
   */
  const [routed, setRouted] = useState<{ forId: string; route: Route | null } | null>(null);

  const goingToId = selected?.id ?? null;
  const goingToLat = selected?.lat;
  const goingToLng = selected?.lng;

  useEffect(() => {
    if (goingToId === null || goingToLat === undefined || goingToLng === undefined) return;
    if (!locationPrecise) return;

    let alive = true;
    (async () => {
      const found = await fetchRoute(origin, { lat: goingToLat, lng: goingToLng });
      if (alive) setRouted({ forId: goingToId, route: found });
    })();
    return () => {
      alive = false;
    };
  }, [goingToId, goingToLat, goingToLng, origin, locationPrecise]);

  const route = routed && routed.forId === goingToId ? routed.route : null;
  const routing = locationPrecise && goingToId !== null && routed?.forId !== goingToId;

  const markers = useMemo(
    () =>
      visible.map((b) => ({
        id: b.id,
        lat: b.lat,
        lng: b.lng,
        label: b.name,
        icon: categoryOf(b.categoryId).icon,
        tone: CATEGORY_TONES[b.categoryId],
        selected: b.id === selectedId,
      })),
    [visible, selectedId],
  );

  const offscreen = useMemo(() => countOutside(visible, region), [visible, region]);

  const cardBottom = TAB_BAR_HEIGHT + TAB_BAR_INSET + Math.max(insets.bottom, TAB_BAR_INSET) + spacing.sm;

  return (
    <View style={styles.screen}>
      <MapCanvas
        region={region}
        markers={markers}
        route={route?.points}
        onSelectMarker={(id) => {
          setFollowMe(false);
          setPicked(id);
        }}
        /*
         * A basemap that fails renders as one flat colour with pins floating
         * on it, which looks enough like a map that nobody reports it. This
         * puts the reason in `client_errors`, where the console groups it.
         */
        onFailure={(reason) => reportError('map/basemap', new Error(reason))}
      />

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
                setPicked(null);
              }}
            />
          ))}
        </ScrollView>
      </View>

      {/*
        * Says when there is more than what is on screen.
        *
        * Offered rather than done: somebody who panned somewhere on purpose
        * should not have the camera yanked back under them. Tapping clears
        * the selection, which is what re-frames the map around everything.
        */}
      {offscreen > 0 ? (
        <Pressable
          onPress={() => {
            setPicked(null);
            setFollowMe(false);
            router.setParams({ focus: undefined });
          }}
          accessibilityRole="button"
          style={[styles.showAll, { bottom: cardBottom + (selected ? 150 : 8) }]}
        >
          <Ionicons name="scan-outline" size={15} color={colors.textPrimary} />
          <Text style={styles.showAllText}>
            {offscreen} more off screen
          </Text>
        </Pressable>
      ) : null}

      {/* Re-centre control, parked above the detail card */}
      <Pressable
        onPress={() => {
          setFollowMe(true);
          setPicked(null);
        }}
        accessibilityRole="button"
        accessibilityLabel="Centre on my location"
        style={[styles.locateButton, { bottom: cardBottom + (selected ? 150 : 8) }]}
      >
        <Ionicons
          name="locate"
          size={20}
          color={followMe ? colors.accent : colors.textPrimary}
        />
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
              {/*
                * The straight-line distance above is always true. This is the
                * road, and it only appears once a route has actually come
                * back — a spinner that resolves to nothing would be worse
                * than never having offered.
                */}
              {routing || route ? (
                <View style={styles.cardMetaRow}>
                  <Ionicons name="navigate" size={11} color={colors.accent} />
                  <Text style={[styles.cardMeta, styles.cardRoute]} numberOfLines={1}>
                    {route ? describeRoute(route) : 'Working out the route'}
                  </Text>
                </View>
              ) : null}
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
                onPress={() => void openDirections(selected.lat, selected.lng, selected.name)}
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
              Tap a pin to see the business. {visible.length} on this map.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors, tones) => ({
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
  cardRoute: { color: colors.accent, fontWeight: '700' },
  showAll: {
    position: 'absolute',
    left: spacing.screen,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  showAllText: { ...typography.metaStrong, color: colors.textPrimary },
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
}));
