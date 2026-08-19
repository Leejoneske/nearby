import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useScreenInsets } from '../lib/insets';

import { BusinessRow } from '../components/BusinessRow';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { SearchField } from '../components/SearchField';
import { SkeletonList } from '../components/Skeleton';
import { EmptyState } from '../components/primitives';
import { CATEGORIES, CATEGORY_TONES, categoryOf } from '../data/categories';
import { DEFAULT_FILTERS, type CategoryId, type Filters, type SortKey } from '../data/types';
import { formatDistance, formatPriceLevel } from '../lib/format';
import { activeFilterCount, searchBusinesses, SORT_LABELS } from '../lib/search';
import { useStore } from '../lib/store';
import { colors, radii, spacing, tones, typography, type ToneName } from '../theme/tokens';

type SheetKind = 'sort' | 'price' | 'radius' | 'all' | null;

const RADIUS_OPTIONS = [500, 1000, 2000, 5000, 10000];

export default function SearchScreen() {
  const router = useRouter();
  const insets = useScreenInsets();
  const { businesses, loading, isSaved, toggleSaved } = useStore();
  const params = useLocalSearchParams<{
    q?: string;
    category?: string;
    sort?: string;
    openNow?: string;
    radius?: string;
    price?: string;
  }>();

  const [query, setQuery] = useState(params.q ?? '');
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [filters, setFilters] = useState<Filters>({
    ...DEFAULT_FILTERS,
    categoryId: (params.category as CategoryId) ?? null,
    sort: (params.sort as SortKey) ?? 'relevance',
    openNow: params.openNow === '1',
    radiusM: params.radius ? Number(params.radius) : null,
    priceLevels: params.price ? [Number(params.price)] : [],
  });

  const now = useMemo(() => new Date(), []);
  const results = useMemo(
    () => searchBusinesses(businesses, query, filters, now),
    [businesses, query, filters, now],
  );

  const filterCount = activeFilterCount(filters);
  const patch = (next: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...next }));

  const togglePriceLevel = (level: number) =>
    patch({
      priceLevels: filters.priceLevels.includes(level)
        ? filters.priceLevels.filter((l) => l !== level)
        : [...filters.priceLevels, level].sort(),
    });

  const heading = filters.categoryId
    ? categoryOf(filters.categoryId).label
    : query.trim()
      ? `Results for "${query.trim()}"`
      : 'All businesses';

  return (
    <View style={styles.screen}>
      {/* Header */}
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

          <View style={styles.searchWrap}>
            <SearchField
              value={query}
              onChangeText={setQuery}
              onClear={() => setQuery('')}
              placeholder="Search businesses"
              autoFocus={!params.category && !params.sort}
            />
          </View>

          <Pressable
            onPress={() => router.push('/(tabs)/map')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Show results on map"
            style={styles.iconButton}
          >
            <Ionicons name="map-outline" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Filter chips */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['sort', 'price', 'radius', 'openNow', 'category'] as const}
          keyExtractor={(k) => k}
          contentContainerStyle={styles.chipRow}
          renderItem={({ item }) => {
            switch (item) {
              case 'sort':
                return (
                  <Chip
                    label={SORT_LABELS[filters.sort]}
                    icon="swap-vertical"
                    dropdown
                    selected={filters.sort !== 'relevance'}
                    onPress={() => setSheet('sort')}
                  />
                );
              case 'price':
                return (
                  <Chip
                    label={
                      filters.priceLevels.length
                        ? filters.priceLevels.map(formatPriceLevel).join(', ')
                        : 'Price'
                    }
                    dropdown
                    selected={filters.priceLevels.length > 0}
                    onPress={() => setSheet('price')}
                  />
                );
              case 'radius':
                return (
                  <Chip
                    label={filters.radiusM ? `Within ${formatDistance(filters.radiusM)}` : 'Distance'}
                    dropdown
                    selected={filters.radiusM !== null}
                    onPress={() => setSheet('radius')}
                  />
                );
              case 'openNow':
                return (
                  <Chip
                    label="Open now"
                    icon="time-outline"
                    selected={filters.openNow}
                    onPress={() => patch({ openNow: !filters.openNow })}
                  />
                );
              case 'category':
                return (
                  <Chip
                    label={filters.categoryId ? categoryOf(filters.categoryId).label : 'Category'}
                    dropdown
                    selected={filters.categoryId !== null}
                    onPress={() => setSheet('all')}
                  />
                );
            }
          }}
        />
      </View>

      {/* Results */}
      <FlatList
        data={results}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        ListHeaderComponent={
          <View style={styles.resultHeader}>
            <Text style={styles.resultHeading} numberOfLines={1}>
              {heading}
            </Text>
            <Text style={styles.resultCount}>
              {results.length} {results.length === 1 ? 'place' : 'places'}
              {filterCount > 0 ? ` · ${filterCount} filter${filterCount === 1 ? '' : 's'}` : ''}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <BusinessRow
            business={item}
            now={now}
            last={index === results.length - 1}
            saved={isSaved(item.id)}
            onToggleSave={() => toggleSaved(item.id)}
            onPress={() => router.push(`/business/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          // "Nothing matches" is a claim about the results, and we cannot
          // make it before they arrive.
          loading && businesses.length === 0 ? (
            <View style={styles.emptyWrap}>
              <SkeletonList />
            </View>
          ) : (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="search"
              title="Nothing matches yet"
              body="Try a different search, or clear a filter or two to widen the net."
            />
            {filterCount > 0 ? (
              <View style={styles.emptyAction}>
                <Button
                  label="Clear all filters"
                  variant="secondary"
                  size="md"
                  onPress={() => setFilters(DEFAULT_FILTERS)}
                />
              </View>
            ) : null}
          </View>
          )
        }
      />

      {/* Filter sheets */}
      <Sheet
        visible={sheet === 'sort'}
        title="Sort by"
        onClose={() => setSheet(null)}
        options={(Object.keys(SORT_LABELS) as SortKey[]).map((key) => ({
          key,
          label: SORT_LABELS[key],
          selected: filters.sort === key,
          onPress: () => {
            patch({ sort: key });
            setSheet(null);
          },
        }))}
      />

      <Sheet
        visible={sheet === 'price'}
        title="Price range"
        onClose={() => setSheet(null)}
        onClear={filters.priceLevels.length ? () => patch({ priceLevels: [] }) : undefined}
        options={[1, 2, 3, 4].map((level) => ({
          key: String(level),
          label: `${formatPriceLevel(level)}  ${priceHint(level)}`,
          selected: filters.priceLevels.includes(level),
          onPress: () => togglePriceLevel(level),
        }))}
      />

      <Sheet
        visible={sheet === 'radius'}
        title="Distance"
        onClose={() => setSheet(null)}
        onClear={filters.radiusM ? () => patch({ radiusM: null }) : undefined}
        options={RADIUS_OPTIONS.map((metres) => ({
          key: String(metres),
          label: `Within ${formatDistance(metres)}`,
          selected: filters.radiusM === metres,
          onPress: () => {
            patch({ radiusM: metres });
            setSheet(null);
          },
        }))}
      />

      <Sheet
        visible={sheet === 'all'}
        title="Category"
        onClose={() => setSheet(null)}
        onClear={filters.categoryId ? () => patch({ categoryId: null }) : undefined}
        options={CATEGORIES.map((category) => ({
          key: category.id,
          label: category.label,
          icon: category.icon,
          tone: CATEGORY_TONES[category.id],
          selected: filters.categoryId === category.id,
          onPress: () => {
            patch({ categoryId: filters.categoryId === category.id ? null : category.id });
            setSheet(null);
          },
        }))}
      />
    </View>
  );
}

function priceHint(level: number): string {
  return ['Budget', 'Moderate', 'Pricey', 'Premium'][level - 1] ?? '';
}

type SheetOption = {
  key: string;
  label: string;
  icon?: string;
  /** Colours the glyph. Omitted for lists where every row is the same kind. */
  tone?: ToneName;
  selected: boolean;
  onPress: () => void;
};

function Sheet({
  visible,
  title,
  options,
  onClose,
  onClear,
}: {
  visible: boolean;
  title: string;
  options: SheetOption[];
  onClose: () => void;
  onClear?: () => void;
}) {
  const insets = useScreenInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.grabber} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          {onClear ? (
            <Pressable onPress={onClear} hitSlop={8} accessibilityRole="button">
              <Text style={styles.sheetClear}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        {options.map((option, index) => (
          <Pressable
            key={option.key}
            onPress={option.onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: option.selected }}
            style={({ pressed }) => [
              styles.sheetOption,
              index < options.length - 1 && styles.sheetDivider,
              pressed && { backgroundColor: colors.surfaceSunken },
            ]}
          >
            {option.icon ? (
              <Ionicons
                name={option.icon as never}
                size={18}
                color={option.tone ? tones[option.tone].fg : colors.textSecondary}
              />
            ) : null}
            <Text style={styles.sheetOptionLabel}>{option.label}</Text>
            {option.selected ? (
              <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
            ) : null}
          </Pressable>
        ))}

        <View style={styles.sheetFooter}>
          <Button label="Done" onPress={onClose} size="md" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },

  header: {
    backgroundColor: colors.canvas,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  searchWrap: { flex: 1 },
  chipRow: { paddingHorizontal: spacing.screen, gap: spacing.sm },

  resultHeader: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: 2,
  },
  resultHeading: { ...typography.title, fontSize: 21, color: colors.textPrimary },
  resultCount: { ...typography.meta, color: colors.textSecondary },

  emptyWrap: { paddingTop: spacing.xl },
  emptyAction: { paddingHorizontal: spacing.huge },

  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sheetTitle: { ...typography.sectionTitle, color: colors.textPrimary },
  sheetClear: { ...typography.metaStrong, color: colors.accent },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg - 2,
  },
  sheetDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetOptionLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
  sheetFooter: { paddingTop: spacing.lg },
});
