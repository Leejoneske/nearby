import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '../components/primitives';
import type { AppNotification, NotificationKind } from '../data/types';
import { formatRelativeDate } from '../lib/format';
import { useScreenInsets } from '../lib/insets';
import { useStore } from '../lib/store';
import { colors, radii, spacing, typography } from '../theme/tokens';

const ICONS: Record<NotificationKind, string> = {
  review: 'star',
  reply: 'return-down-forward',
  offer: 'pricetag',
  listing: 'checkmark-circle',
};

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useScreenInsets();
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead } =
    useStore();
  const now = useMemo(() => new Date(), []);

  const open = (item: AppNotification) => {
    markNotificationRead(item.id);
    if (item.businessId) router.push(`/business/${item.businessId}`);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.iconButton}
        >
          <Ionicons name="arrow-back" size={21} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <Pressable
            onPress={markAllNotificationsRead}
            hitSlop={8}
            accessibilityRole="button"
            style={styles.markAll}
          >
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        ) : (
          <View style={styles.iconButton} />
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => open(item)}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            style={({ pressed }) => [
              styles.row,
              !item.read && styles.rowUnread,
              index < notifications.length - 1 && styles.divider,
              pressed && { backgroundColor: colors.surfaceSunken },
            ]}
          >
            <View style={[styles.icon, !item.read && styles.iconUnread]}>
              <Ionicons
                name={ICONS[item.kind] as never}
                size={17}
                color={item.read ? colors.textSecondary : colors.accent}
              />
            </View>

            <View style={styles.body}>
              <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.text} numberOfLines={3}>
                {item.body}
              </Text>
              <Text style={styles.date}>{formatRelativeDate(item.date, now)}</Text>
            </View>

            {!item.read ? <View style={styles.dot} /> : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <EmptyState
              icon="notifications-outline"
              title="Nothing new"
              body="Reviews, replies and offers from places you follow will show up here."
            />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.canvas,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.cardTitle, color: colors.textPrimary, flex: 1, textAlign: 'center' },
  markAll: { paddingHorizontal: spacing.sm },
  markAllText: { ...typography.metaStrong, color: colors.accent },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
  },
  rowUnread: { backgroundColor: colors.canvas },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  iconUnread: { backgroundColor: colors.accentSoft },
  body: { flex: 1, gap: 3 },
  title: { ...typography.bodyStrong, color: colors.textPrimary, fontWeight: '600' },
  titleUnread: { fontWeight: '700' },
  text: { ...typography.meta, color: colors.textSecondary },
  date: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginTop: spacing.sm,
  },
  empty: { paddingTop: spacing.huge },
});
