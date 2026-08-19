/**
 * The oversized, fully-rounded CTA from the fintech reference, plus the
 * quieter variants it needs to sit next to.
 */
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { radii, spacing, typography } from '../theme/tokens';
import { makeStyles, useTheme } from '../theme/ThemeProvider';
import { dark, light } from '../theme/palettes';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'lg' | 'md' | 'sm';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: string;
  iconRight?: string;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

const HEIGHTS: Record<Size, number> = { lg: 60, md: 48, sm: 38 };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconRight,
  disabled = false,
  loading = false,
  fullWidth = true,
  style,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const look = variantStyles[useTheme().scheme];

  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        { height: HEIGHTS[size] },
        fullWidth && styles.fullWidth,
        look[variant].container,
        pressed && !inactive && look[variant].pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? colors.textOnAccent : colors.textPrimary}
        />
      ) : (
        <View style={styles.content}>
          {icon ? (
            <Ionicons
              name={icon as never}
              size={size === 'sm' ? 16 : 19}
              color={look[variant].label.color}
            />
          ) : null}
          <Text
            style={[
              styles.label,
              size === 'sm' && styles.labelSm,
              size === 'md' && styles.labelMd,
              look[variant].label,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {iconRight ? (
            <Ionicons
              name={iconRight as never}
              size={size === 'sm' ? 16 : 19}
              color={look[variant].label.color}
            />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((colors, tones) => ({
  base: {
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { ...typography.button },
  labelMd: { fontSize: 15 },
  labelSm: { fontSize: 14 },
  disabled: { opacity: 0.45 },
}));

/**
 * The four looks a button comes in, per palette.
 *
 * These are not in the stylesheet because a variant is three related styles
 * rather than one, and the component picks between them. Building both
 * palettes once, at module load, keeps that cheap.
 */
const variantStyles = (
  ['light', 'dark'] as const
).reduce(
  (all, scheme) => {
    const c = scheme === 'dark' ? dark : light;
    all[scheme] = {
      primary: {
        container: { backgroundColor: c.accent },
        pressed: { backgroundColor: c.accentPressed },
        label: { color: c.textOnAccent },
      },
      secondary: {
        container: {
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
        },
        pressed: { backgroundColor: c.surfaceSunken },
        label: { color: c.textPrimary },
      },
      ghost: {
        container: { backgroundColor: 'transparent' },
        pressed: { backgroundColor: c.surfaceSunken },
        label: { color: c.textPrimary },
      },
      danger: {
        container: { backgroundColor: c.danger },
        pressed: { backgroundColor: c.dangerPressed },
        label: { color: c.textOnAccent },
      },
    };
    return all;
  },
  {} as Record<
    'light' | 'dark',
    Record<Variant, { container: ViewStyle; pressed: ViewStyle; label: { color: string } }>
  >,
);
