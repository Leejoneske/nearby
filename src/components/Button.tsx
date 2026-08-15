/**
 * The oversized, fully-rounded CTA from the fintech reference, plus the
 * quieter variants it needs to sit next to.
 */
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radii, spacing, typography } from '../theme/tokens';

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
  const inactive = disabled || loading;

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
        variantStyles[variant].container,
        pressed && !inactive && variantStyles[variant].pressed,
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
              color={variantStyles[variant].label.color}
            />
          ) : null}
          <Text
            style={[
              styles.label,
              size === 'sm' && styles.labelSm,
              size === 'md' && styles.labelMd,
              variantStyles[variant].label,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {iconRight ? (
            <Ionicons
              name={iconRight as never}
              size={size === 'sm' ? 16 : 19}
              color={variantStyles[variant].label.color}
            />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
});

const variantStyles: Record<
  Variant,
  { container: ViewStyle; pressed: ViewStyle; label: { color: string } }
> = {
  primary: {
    container: { backgroundColor: colors.accent },
    pressed: { backgroundColor: colors.accentPressed },
    label: { color: colors.textOnAccent },
  },
  secondary: {
    container: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pressed: { backgroundColor: colors.surfaceSunken },
    label: { color: colors.textPrimary },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    pressed: { backgroundColor: colors.surfaceSunken },
    label: { color: colors.textPrimary },
  },
  danger: {
    container: { backgroundColor: colors.danger },
    pressed: { backgroundColor: '#B3241B' },
    label: { color: colors.textOnAccent },
  },
};
