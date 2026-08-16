/**
 * Sign in with a phone number.
 *
 * A phone-first flow rather than email and password: it matches how the claim
 * flow already verifies an owner, and it is what people here actually have.
 * Sending the code is a stub for now — `signIn` in the store is the seam the
 * real auth call slots into.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { useScreenInsets } from '../../lib/insets';
import { colors, radii, spacing, typography } from '../../theme/tokens';

/** Digits only, ignoring spaces and a leading +. */
export function isPlausiblePhone(input: string): boolean {
  const digits = input.replace(/[^\d]/g, '');
  return digits.length >= 9 && digits.length <= 15;
}

export default function SignInScreen() {
  const router = useRouter();
  const insets = useScreenInsets();
  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState(false);

  const valid = isPlausiblePhone(phone);
  const error = touched && !valid ? 'Enter a phone number we can text' : undefined;

  const onContinue = () => {
    setTouched(true);
    if (!valid) return;
    router.push({ pathname: '/(auth)/verify', params: { phone: phone.trim() } });
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.screen,
          paddingBottom: insets.bottom + spacing.huge,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.mark}>
          <Ionicons name="location" size={26} color={colors.textOnAccent} />
        </View>

        <Text style={styles.title}>Welcome to Nearby</Text>
        <Text style={styles.body}>
          Sign in to save places, leave reviews and manage your own business.
        </Text>

        <View style={styles.form}>
          <Field
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="+254 7.. ... ..."
            error={error}
            hint="We will text you a six digit code."
          />
          <Button label="Continue" onPress={onContinue} />
        </View>

        <View style={styles.divider}>
          <View style={styles.rule} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.rule} />
        </View>

        <Button
          label="Keep looking without an account"
          variant="secondary"
          size="md"
          onPress={() => router.replace('/(tabs)')}
        />

        <Text style={styles.legal}>
          By continuing you agree to our{' '}
          <Text style={styles.link} onPress={() => router.push('/legal/terms')}>
            Terms
          </Text>{' '}
          and{' '}
          <Text style={styles.link} onPress={() => router.push('/legal/privacy')}>
            Privacy Policy
          </Text>
          .
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  back: { width: 40, height: 40, justifyContent: 'center', marginBottom: spacing.xl },
  mark: {
    width: 60,
    height: 60,
    borderRadius: radii.xl,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: { ...typography.display, color: colors.textPrimary, marginBottom: spacing.sm },
  body: { ...typography.body, color: colors.textSecondary, maxWidth: '92%' },
  form: { gap: spacing.xl, marginTop: spacing.xxxl },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xxl,
  },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { ...typography.meta, color: colors.textTertiary },
  legal: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xxl,
    lineHeight: 17,
  },
  link: { color: colors.accentPressed, fontWeight: '600' },
});
