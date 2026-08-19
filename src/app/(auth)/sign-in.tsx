/**
 * Sign in with an email address.
 *
 * Email rather than phone because it works anywhere without an SMS provider
 * in every country the app reaches, and costs nothing to send. A short
 * code rather than a magic link: a link has to survive being opened in the
 * wrong browser and handed back to the app, and a code does not.
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
import { isDisposableEmail, isPlausibleEmail } from '../../lib/identity';
import { useScreenInsets } from '../../lib/insets';
import { supabase } from '../../lib/supabase';
import { colors, radii, spacing, typography } from '../../theme/tokens';

export default function SignInScreen() {
  const router = useRouter();
  const insets = useScreenInsets();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const valid = isPlausibleEmail(email);
  /*
   * A throwaway address is refused here as well as in the database. The
   * database is the enforcement, since anything can call the API; this is so
   * somebody hears about it before they wait for a code that they can never
   * be reached at again.
   */
  const disposable = valid && isDisposableEmail(email);
  const error =
    failure ??
    (touched && !valid ? 'Enter an email address we can reach' : undefined) ??
    (touched && disposable
      ? 'Use an address you will still have later. Temporary inboxes cannot be recovered.'
      : undefined);

  const onContinue = async () => {
    setTouched(true);
    setFailure(null);
    if (!valid || disposable) return;

    setSending(true);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    setSending(false);

    if (sendError) {
      setFailure('We could not send the code just now. Please try again shortly.');
      console.warn('[auth] sending the code failed', sendError);
      return;
    }
    router.push({ pathname: '/(auth)/verify', params: { email: email.trim().toLowerCase() } });
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
            label="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="you@example.com"
            error={error}
            hint="We will email you a code to sign in with. No password to remember."
          />
          <Button label="Continue" onPress={onContinue} loading={sending} />
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
