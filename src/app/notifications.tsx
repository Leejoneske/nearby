import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '../components/primitives';
import type { AppNotification, NotificationKind } from '../data/types';
import { formatRelativeDate } from '../lib/format';
import { useScreenInsets } from '../lib/insets';
import { useStore } from '../lib/store';
import { radii, spacing, typography, type ToneName } from '../theme/tokens';
import { makeStyles, useTheme } from '../theme/ThemeProvider';

/**
 * A glyph and a colour per kind, so a list of notices can be skimmed for the
 * one that matters without reading every title.
 */
const KIND: Record<NotificationKind, { icon: string; tone: ToneName }> = {
  review: { icon: 'star', tone: 'amber' },
  reply: { icon: 'return-down-forward', tone: 'violet' },
  offer: { icon: 'pricetag', tone: 'orange' },
  listing: { icon: 'checkmark-circle', tone: 'green' },
};

export default function NotificationsScreen() {
  const styles = useStyles();
  const { colors, tones } = useTheme();
  const router = useRouter();
  const insets = useScreenInsets();
  const {
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    refreshNotifications,
    session,
  } = useStore();
  const now = useMemo(() => new Date(), []);
  const [refreshing, setRefreshing] = useState(false);

  // New rows arrive on their own through the live subscription. This is for
  // the case where that connection dropped and nobody would otherwise know.
  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  const pullToRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  }, [refreshNotifications]);

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void pullToRefresh()}
            tintColor={colors.textTertiary}
          />
        }
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
            {/*
              * Read notices go grey on purpose: colour here means "this is
              * still waiting for you", not "this is a review".
              */}
            <View
              style={[
                styles.icon,
                !item.read && { backgroundColor: tones[KIND[item.kind].tone].soft },
              ]}
            >
              <Ionicons
                name={KIND[item.kind].icon as never}
                size={17}
                color={item.read ? colors.textTertiary : tones[KIND[item.kind].tone].fg}
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
              body={
                session.status === 'signedIn'
                  ? 'Reviews on your listings, replies to yours and news about a business you added will show up here.'
                  : 'Sign in and we will keep you posted about the reviews you write and the businesses you add.'
              }
            />
          </View>
        }
      />
    </View>
  );
}

const useStyles = makeStyles((colors, tones) => ({
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
}));
