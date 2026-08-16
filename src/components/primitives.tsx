/** Small shared pieces that would each be too thin for their own file. */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  colors,
  radii,
  shadows,
  spacing,
  tones,
  typography,
  type ToneName,
} from '../theme/tokens';

export function Avatar({
  initials,
  size = 44,
  verified,
}: {
  initials: string;
  size?: number;
  verified?: boolean;
}) {
  return (
    <View>
      <View
        style={[
          styles.avatar,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
      </View>
      {verified ? (
        <View style={[styles.verifyDot, { width: size * 0.34, height: size * 0.34, borderRadius: size * 0.17 }]}>
          <Ionicons name="checkmark" size={size * 0.2} color={colors.textOnAccent} />
        </View>
      ) : null}
    </View>
  );
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/**
 * A labelled row inside a card — icon, label, value, optional chevron.
 *
 * `tone` is what decides whether the glyph gets a tile behind it. A row that
 * leads somewhere is worth marking; a row that only states a fact is not, and
 * giving every row the same coloured square is how a settings list turns into
 * a wall of identical badges.
 */
export function InfoRow({
  icon,
  label,
  value,
  tone,
  onPress,
  last,
}: {
  icon: string;
  label: string;
  value?: string;
  tone?: ToneName;
  onPress?: () => void;
  last?: boolean;
}) {
  const hue = tone ? tones[tone] : undefined;
  const content = (
    <View style={[styles.infoRow, !last && styles.infoDivider]}>
      <View style={[styles.infoIcon, hue && { backgroundColor: hue.soft }]}>
        <Ionicons
          name={icon as never}
          size={hue ? 17 : 19}
          color={hue?.fg ?? colors.textTertiary}
        />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel} numberOfLines={2}>
          {label}
        </Text>
        {value ? (
          <Text style={styles.infoValue} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} /> : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {content}
    </Pressable>
  );
}

export function Pill({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'success' | 'danger';
  icon?: string;
}) {
  const toneStyle = {
    neutral: { bg: colors.surfaceSunken, fg: colors.textSecondary },
    accent: { bg: colors.accentSoft, fg: colors.accentPressed },
    success: { bg: colors.successSoft, fg: colors.success },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  }[tone];

  return (
    <View style={[styles.pill, { backgroundColor: toneStyle.bg }]}>
      {icon ? <Ionicons name={icon as never} size={12} color={toneStyle.fg} /> : null}
      <Text style={[styles.pillText, { color: toneStyle.fg }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon as never} size={30} color={colors.textTertiary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.textOnAccent, fontWeight: '700' },
  verifyDot: {
    position: 'absolute',
    right: -1,
    top: -1,
    backgroundColor: '#2E9BF0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.canvas,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.sectionTitle, color: colors.textPrimary },
  sectionAction: { ...typography.metaStrong, color: colors.accent },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...shadows.card,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
  },
  infoDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  // No background by default — a tone adds one. The fixed width keeps every
  // label in a list aligned whether its glyph is tiled or bare.
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: { flex: 1, gap: 1 },
  infoLabel: { ...typography.bodyStrong, color: colors.textPrimary },
  infoValue: { ...typography.meta, color: colors.textSecondary },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  pillText: { ...typography.caption, fontSize: 11.5, fontWeight: '600' },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.huge,
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { ...typography.sectionTitle, color: colors.textPrimary },
  emptyBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
