import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';

import { radii, spacing, typography } from '../theme/tokens';
import { makeStyles, useTheme } from '../theme/ThemeProvider';

type Props = {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  /** Renders as a button instead of an input — used on the home hero. */
  readOnly?: boolean;
  onPress?: () => void;
  onSubmit?: () => void;
  autoFocus?: boolean;
  onClear?: () => void;
};

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search businesses near you',
  readOnly,
  onPress,
  onSubmit,
  autoFocus,
  onClear,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (readOnly) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="search"
        accessibilityLabel={placeholder}
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}
      >
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <Text style={styles.placeholder} numberOfLines={1}>
          {placeholder}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.field}>
      <Ionicons name="search" size={18} color={colors.textTertiary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        autoFocus={autoFocus}
        autoCorrect={false}
        accessibilityLabel={placeholder}
      />
      {value && onClear ? (
        <Pressable onPress={onClear} hitSlop={10} accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={17} color={colors.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors, tones) => ({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { backgroundColor: colors.surfaceSunken },
  placeholder: { ...typography.body, color: colors.textTertiary, flex: 1 },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    // react-native-web draws a focus ring on the input itself; the wrapper
    // already carries the border, so suppress it.
    ...(({ outlineStyle: 'none' } as unknown) as object),
  },
}));
