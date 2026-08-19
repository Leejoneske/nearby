/**
 * Placeholder shapes for content that has not arrived.
 *
 * The point is not decoration — it is that the screen keeps its shape. A
 * spinner in the middle of an empty page tells you nothing about what is
 * coming, and when the content lands everything jumps. A skeleton in the
 * layout the real thing will occupy makes the arrival a fill rather than a
 * reflow.
 *
 * Two rules for using these:
 *
 *   - Only for the first load, when there is genuinely nothing to show.
 *     Refreshing something already on screen keeps the old content; replacing
 *     it with grey boxes is a downgrade.
 *   - Only for the essentials. The home screen needs its listings to be
 *     useful, so those get skeletons; a section that is empty half the time
 *     anyway does not, because a skeleton that resolves to nothing has
 *     promised something that was never coming.
 */
import { useEffect, useState } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';

import { radii, spacing, shadows } from '../theme/tokens';
import { makeStyles, useTheme } from '../theme/ThemeProvider';

/**
 * One shimmering block.
 *
 * The pulse is opacity rather than a moving gradient: a translating highlight
 * needs a mask per shape, and on a low-end phone twenty of them animating at
 * once costs more than the content did.
 */
export function SkeletonBlock({
  width,
  height,
  radius = radii.sm,
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  /*
   * useState with a lazy initialiser rather than a ref: the value is read
   * during render to build the style, and reading a ref during render is the
   * thing the linter here refuses — correctly. This creates it exactly once
   * either way.
   */
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      // Placeholders are not content. A screen reader announcing sixteen
      // blank shapes is worse than it announcing nothing at all.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.surfaceSunken,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
        },
        style,
      ]}
    />
  );
}

/** Stands in for a BusinessCard in a horizontal rail. */
export function SkeletonCard() {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <SkeletonBlock height={124} radius={radii.lg} />
      <SkeletonBlock width="72%" height={14} style={{ marginTop: spacing.md }} />
      <SkeletonBlock width="45%" height={11} style={{ marginTop: spacing.sm }} />
      <SkeletonBlock width="58%" height={11} style={{ marginTop: spacing.xs + 2 }} />
    </View>
  );
}

/** Stands in for a full-width listing row in a list. */
export function SkeletonRow() {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <SkeletonBlock width={84} height={84} radius={radii.lg} />
      <View style={styles.rowBody}>
        <SkeletonBlock width="70%" height={14} />
        <SkeletonBlock width="40%" height={11} />
        <SkeletonBlock width="55%" height={11} />
      </View>
    </View>
  );
}

/** A rail of cards, for a horizontally scrolling section. */
export function SkeletonRail({ count = 3 }: { count?: number }) {
  const styles = useStyles();
  return (
    <View style={styles.rail}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

/** A stack of rows, for a vertical list. */
export function SkeletonList({ count = 5 }: { count?: number }) {
  const styles = useStyles();
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

const useStyles = makeStyles((colors, tones) => ({
  card: {
    width: 208,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    ...shadows.card,
  },
  rail: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    ...shadows.card,
  },
  rowBody: { flex: 1, gap: spacing.sm, paddingVertical: spacing.xs },
  list: { paddingHorizontal: spacing.screen, gap: spacing.md },
}));
