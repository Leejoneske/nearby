import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useScreenInsets } from '../../lib/insets';

import { Button } from '../../components/Button';
import { Photo } from '../../components/Photo';
import { Avatar, Card, InfoRow, Pill, SectionHeader } from '../../components/primitives';
import { appVersionLabel } from '../../lib/appInfo';

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

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useScreenInsets();
  const { viewer, savedIds, recentIds, ownedBusinesses, signOut, unreadCount } =
    useStore();

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: TAB_BAR_HEIGHT + TAB_BAR_INSET + insets.bottom + spacing.xl,
        }}
      >
        {/* Identity */}
        <View style={styles.header}>
          <Avatar initials={viewer.initials} size={72} verified={viewer.verified} />
          <View style={styles.headerText}>
            <Text style={styles.name}>{viewer.name}</Text>
            <Text style={styles.email}>{viewer.email}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/settings/profile')}
            accessibilityRole="button"
            accessibilityLabel="Edit your profile"
            style={styles.editButton}
          >
            <Ionicons name="create-outline" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Stats */}
        <View style={styles.statRow}>
          <Stat value={savedIds.length} label="Saved" />
          <View style={styles.statDivider} />
          <Stat value={recentIds.length} label="Viewed" />
          <View style={styles.statDivider} />
          <Stat value={ownedBusinesses.length} label="Listings" />
        </View>

        {/* Owned listings */}
        <SectionHeader title="Your businesses" />
        <View style={styles.section}>
          {ownedBusinesses.map((business) => {
            return (
              <Pressable
                key={business.id}
                onPress={() => router.push(`/owner/dashboard/${business.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Manage ${business.name}`}
                style={({ pressed }) => [styles.ownedCard, pressed && { opacity: 0.9 }]}
              >
                <Photo
                  categoryId={business.categoryId}
                  seed={business.id}
                  uri={business.photos[0]}
                  style={styles.ownedPhoto}
                  radius={radii.lg}
                  iconSize={22}
                />
                <View style={styles.ownedBody}>
                  <Text style={styles.ownedName} numberOfLines={1}>
                    {business.name}
                  </Text>
                  <Text style={styles.ownedMeta} numberOfLines={1}>
                    {business.neighbourhood}
                  </Text>
                  <View style={styles.ownedPills}>
                    {business.verified ? (
                      <Pill label="Verified" icon="checkmark-circle" tone="success" />
                    ) : (
                      <Pill label="Unverified" icon="alert-circle" tone="danger" />
                    )}
                    <Pill label={`${business.reviewCount} reviews`} tone="accent" />
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </Pressable>
            );
          })}

          <View style={styles.addWrap}>
            <Button
              label="Add a business"
              icon="add"
              variant={ownedBusinesses.length > 0 ? 'secondary' : 'primary'}
              size="md"
              onPress={() => router.push('/owner/claim')}
            />
          </View>
        </View>

        {/* Settings */}
        <SectionHeader title="Settings" />
        <View style={styles.section}>
          <Card style={styles.settingsCard}>
            <InfoRow
              icon="person-outline"
              label="Your details"
              value={viewer.name}
              tone="blue"
              onPress={() => router.push('/settings/profile')}
            />
            <InfoRow
              icon="notifications-outline"
              label="Notifications"
              value={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              tone="orange"
              onPress={() => router.push('/notifications')}
            />
            <InfoRow
              icon="shield-checkmark-outline"
              label="Privacy Policy"
              tone="green"
              onPress={() => router.push('/legal/privacy')}
            />
            <InfoRow
              icon="document-text-outline"
              label="Terms of Use"
              tone="steel"
              onPress={() => router.push('/legal/terms')}
            />
            {/* No tone: nothing to tap, so nothing to draw the eye. */}
            <InfoRow
              icon="information-circle-outline"
              label="Version"
              value={appVersionLabel()}
              last
            />
          </Card>
        </View>

        <View style={styles.signOut}>
          <Button
            label="Sign out"
            variant="ghost"
            size="md"
            onPress={() => {
              signOut();
              router.replace('/(auth)/sign-in');
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerText: { flex: 1, gap: 3 },
  name: { ...typography.title, color: colors.textPrimary },
  email: { ...typography.meta, color: colors.textSecondary },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },

  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.screen,
    marginBottom: spacing.xxl,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    paddingVertical: spacing.lg,
    ...shadows.card,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { ...typography.title, fontSize: 22, color: colors.textPrimary },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.border },

  section: { paddingHorizontal: spacing.screen, gap: spacing.md, marginBottom: spacing.xxl },

  ownedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    ...shadows.card,
  },
  ownedPhoto: { width: 60, height: 60 },
  ownedBody: { flex: 1, gap: 3 },
  ownedName: { ...typography.cardTitle, color: colors.textPrimary },
  ownedMeta: { ...typography.meta, color: colors.textSecondary },
  ownedPills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2, marginTop: 2 },
  addWrap: { marginTop: spacing.xs },

  settingsCard: { paddingVertical: 0 },
  signOut: { paddingHorizontal: spacing.huge },
});
