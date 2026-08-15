import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useScreenInsets } from '../../lib/insets';

import { BusinessRow } from '../../components/BusinessRow';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/primitives';
import { useStore } from '../../lib/store';
import {
  colors,
  spacing,
  TAB_BAR_HEIGHT,
  TAB_BAR_INSET,
  typography,
} from '../../theme/tokens';

export default function SavedScreen() {
  const router = useRouter();
  const insets = useScreenInsets();
  const { businesses, savedIds, toggleSaved, markViewed } = useStore();
  const now = useMemo(() => new Date(), []);

  // Preserve the order the user saved things in, newest first.
  const saved = useMemo(
    () =>
      savedIds
        .map((id) => businesses.find((b) => b.id === id))
        .filter((b): b is NonNullable<typeof b> => !!b),
    [savedIds, businesses],
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={saved}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: TAB_BAR_HEIGHT + TAB_BAR_INSET + insets.bottom + spacing.xl,
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Saved</Text>
            <Text style={styles.subtitle}>
              {saved.length === 0
                ? 'Places you save show up here'
                : `${saved.length} ${saved.length === 1 ? 'place' : 'places'} you want to come back to`}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <BusinessRow
            business={item}
            now={now}
            last={index === saved.length - 1}
            saved
            onToggleSave={() => toggleSaved(item.id)}
            onPress={() => {
              markViewed(item.id);
              router.push(`/business/${item.id}`);
            }}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <EmptyState
              icon="heart-outline"
              title="Nothing saved yet"
              body="Tap the heart on any business and it will be waiting for you here."
            />
            <View style={styles.emptyAction}>
              <Button label="Find places nearby" onPress={() => router.push('/search')} size="md" />
            </View>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
    backgroundColor: colors.canvas,
  },
  title: { ...typography.display, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary },
  empty: { paddingTop: spacing.xxl },
  emptyAction: { paddingHorizontal: spacing.huge },
});
