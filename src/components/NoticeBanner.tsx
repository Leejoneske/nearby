/**
 * A notification, the moment it arrives.
 *
 * "In-app notifications" has to mean being told when something happens, not
 * finding out later that a list has a number on it. A listing being approved
 * is the case that matters: somebody submitted a business, waited, and the
 * answer arriving silently in a tab is the same as no answer.
 *
 * It slides in over whatever is on screen, dismisses itself after a few
 * seconds, and opens the thing it is about when tapped. Deliberately not a
 * modal: it must never be in the way of what somebody was doing.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { useScreenInsets } from '../lib/insets';
import { useStore } from '../lib/store';
import { colors, radii, shadows, spacing, tones, typography, type ToneName } from '../theme/tokens';

const SHOWN_FOR_MS = 5000;

const KIND: Record<string, { icon: string; tone: ToneName }> = {
  review: { icon: 'star', tone: 'amber' },
  reply: { icon: 'return-down-forward', tone: 'violet' },
  offer: { icon: 'pricetag', tone: 'orange' },
  listing: { icon: 'checkmark-circle', tone: 'green' },
};

export function NoticeBanner() {
  const router = useRouter();
  const insets = useScreenInsets();
  const { incoming, dismissIncoming, markNotificationRead } = useStore();

  /*
   * `useState` rather than `useRef` for the animated value. It is read during
   * render, to build the transform, and a ref read during render is exactly
   * what React tells you not to do — the lazy initialiser gives the same
   * "created once" behaviour without that.
   */
  const [slide] = useState(() => new Animated.Value(-1));

  useEffect(() => {
    if (!incoming) return;

    slide.setValue(-1);
    Animated.timing(slide, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(slide, {
        toValue: -1,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => dismissIncoming());
    }, SHOWN_FOR_MS);

    return () => clearTimeout(timer);
  }, [incoming, slide, dismissIncoming]);

  if (!incoming) return null;

  const look = KIND[incoming.kind] ?? KIND.listing;

  const open = () => {
    markNotificationRead(incoming.id);
    dismissIncoming();
    if (incoming.businessId) router.push(`/business/${incoming.businessId}`);
    else router.push('/notifications');
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + spacing.sm,
          transform: [
            {
              translateY: slide.interpolate({
                inputRange: [-1, 0],
                outputRange: [-160, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${incoming.title}. ${incoming.body}`}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      >
        <View style={[styles.icon, { backgroundColor: tones[look.tone].soft }]}>
          <Ionicons name={look.icon as never} size={18} color={tones[look.tone].fg} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {incoming.title}
          </Text>
          <Text style={styles.text} numberOfLines={2}>
            {incoming.body}
          </Text>
        </View>
        <Pressable
          onPress={dismissIncoming}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Ionicons name="close" size={18} color={colors.textTertiary} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: spacing.md,
    zIndex: 50,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    ...shadows.card,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  title: { ...typography.bodyStrong, color: colors.textPrimary },
  text: { ...typography.caption, color: colors.textSecondary },
});
