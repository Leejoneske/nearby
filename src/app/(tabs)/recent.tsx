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

export default function RecentScreen() {
  const router = useRouter();
  const insets = useScreenInsets();
  const { businesses, recentIds, isSaved, toggleSaved } = useStore();
  const now = useMemo(() => new Date(), []);

  const recent = useMemo(
    () =>
      recentIds
        .map((id) => businesses.find((b) => b.id === id))
        .filter((b): b is NonNullable<typeof b> => !!b),
    [recentIds, businesses],
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={recent}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: TAB_BAR_HEIGHT + TAB_BAR_INSET + insets.bottom + spacing.xl,
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Recent</Text>
            <Text style={styles.subtitle}>Businesses you have looked at lately</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <BusinessRow
            business={item}
            now={now}
            last={index === recent.length - 1}
            saved={isSaved(item.id)}
            onToggleSave={() => toggleSaved(item.id)}
            onPress={() => router.push(`/business/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <EmptyState
              icon="time-outline"
              title="No history yet"
              body="Businesses you open will appear here so you can find your way back."
            />
            <View style={styles.emptyAction}>
              <Button label="Start browsing" onPress={() => router.push('/search')} size="md" />
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
