/**
 * The "this could be your business" card.
 *
 * There are two of these — one on the home screen inviting anybody to list a
 * business, one on a listing offering to hand it to whoever owns it — and
 * they used to be styled separately. They drifted: home was a solid accent
 * slab, the listing was a quiet bordered card, and the same offer read as two
 * different things depending on where you met it.
 *
 * One component, one look. It is the quiet one: a full-width accent block is
 * the loudest thing on a screen, and this is an aside, not the reason anybody
 * opened the app. The accent is still there on the button they land on.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, tones, typography, type ToneName } from '../theme/tokens';

export function OwnerCta({
  title,
  body,
  icon = 'storefront-outline',
  tone = 'steel',
  onPress,
}: {
  title: string;
  body: string;
  icon?: string;
  tone?: ToneName;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surfaceSunken }]}
    >
      <View style={[styles.icon, { backgroundColor: tones[tone].soft }]}>
        <Ionicons name={icon as never} size={21} color={tones[tone].fg} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.screen,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 2 },
  title: { ...typography.cardTitle, color: colors.textPrimary },
  body: { ...typography.meta, color: colors.textSecondary },
});
