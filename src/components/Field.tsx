import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';

import { radii, spacing, typography } from '../theme/tokens';
import { makeStyles, useTheme } from '../theme/ThemeProvider';

type Props = {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad' | 'numeric' | 'email-address' | 'url';
  hint?: string;
  error?: string;
  /** Renders as a tappable row that opens a picker instead of an input. */
  select?: boolean;
  onPress?: () => void;
  prefix?: string;
};

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType = 'default',
  hint,
  error,
  select,
  onPress,
  prefix,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>

      {select ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value || placeholder || 'not set'}`}
          style={({ pressed }) => [
            styles.input,
            styles.selectRow,
            error && styles.inputError,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.selectValue, !value && styles.placeholder]} numberOfLines={1}>
            {value || placeholder}
          </Text>
          <Ionicons name="chevron-down" size={17} color={colors.textTertiary} />
        </Pressable>
      ) : (
        <View style={[styles.input, multiline && styles.inputMultiline, error && styles.inputError]}>
          {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
            multiline={multiline}
            keyboardType={keyboardType}
            style={[styles.textInput, multiline && styles.textInputMultiline]}
            accessibilityLabel={label}
            autoCorrect={!multiline ? false : undefined}
          />
        </View>
      )}

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors, tones) => ({
  wrap: { gap: spacing.sm },
  label: { ...typography.metaStrong, color: colors.textSecondary },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputMultiline: { minHeight: 110, alignItems: 'flex-start', paddingVertical: spacing.md },
  inputError: { borderColor: colors.danger },
  pressed: { backgroundColor: colors.surfaceSunken },
  selectRow: { justifyContent: 'space-between' },
  selectValue: { ...typography.body, color: colors.textPrimary, flex: 1 },
  placeholder: { color: colors.textTertiary },
  prefix: { ...typography.body, color: colors.textTertiary },
  textInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
    ...(({ outlineStyle: 'none' } as unknown) as object),
  },
  textInputMultiline: { textAlignVertical: 'top', minHeight: 86, paddingVertical: 0 },
  hint: { ...typography.caption, color: colors.textTertiary },
  error: { ...typography.caption, color: colors.danger },
}));
