/**
 * Listing imagery.
 *
 * A business that has uploaded photos renders them. One that has not gets a
 * generated cover derived from its id and category — deterministic, so the
 * same shop looks the same everywhere in the app, and offline, so a listing
 * never renders as a grey box with a broken-image glyph.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CATEGORY_GRADIENTS, categoryOf } from '../data/categories';
import type { CategoryId } from '../data/types';
import { absoluteFill, radii } from '../theme/tokens';
import { makeStyles } from '../theme/ThemeProvider';

/** Small stable string hash, so the same id always picks the same variant. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

type Props = {
  categoryId: CategoryId;
  seed: string;
  uri?: string;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** Hide the category glyph on very small tiles where it would crowd. */
  showIcon?: boolean;
  iconSize?: number;
};

export function Photo({
  categoryId,
  seed,
  uri,
  style,
  radius = radii.lg,
  showIcon = true,
  iconSize = 28,
}: Props) {
  const styles = useStyles();
  const container = [styles.base, { borderRadius: radius }, style];

  if (uri) {
    return (
      <View style={container}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      </View>
    );
  }

  const [from, to] = CATEGORY_GRADIENTS[categoryId];
  const variant = hash(seed) % 3;
  // Three diagonals keep a grid of tiles from looking rubber-stamped.
  const direction =
    variant === 0
      ? { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } }
      : variant === 1
        ? { start: { x: 1, y: 0 }, end: { x: 0, y: 1 } }
        : { start: { x: 0, y: 0.2 }, end: { x: 0.9, y: 1 } };

  const blobOffset = (hash(seed + 'blob') % 40) - 20;

  return (
    <View style={container}>
      <LinearGradient
        colors={[from, to]}
        start={direction.start}
        end={direction.end}
        style={StyleSheet.absoluteFill}
      />
      {/* A soft highlight blob stops the fill reading as flat colour. */}
      <View
        style={[
          styles.blob,
          { right: blobOffset, top: blobOffset - 10 },
        ]}
      />
      {showIcon ? (
        <View style={styles.iconWrap}>
          <Ionicons
            name={categoryOf(categoryId).icon as never}
            size={iconSize}
            color="rgba(255,255,255,0.92)"
          />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors, tones) => ({
  base: {
    overflow: 'hidden',
    backgroundColor: colors.photoPlaceholder,
  },
  blob: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.photoTint,
  },
  iconWrap: {
    ...absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
