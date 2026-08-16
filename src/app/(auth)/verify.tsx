/**
 * Six digit code entry.
 *
 * One hidden input backs six visible boxes: a real per-box input array fights
 * autofill and backspace on both platforms, and gets the caret stuck. Here the
 * boxes are a rendering of one string, which keeps paste and SMS autofill
 * working for free.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '../../components/Button';
import { useScreenInsets } from '../../lib/insets';
import { supabase } from '../../lib/supabase';
import { colors, radii, spacing, typography } from '../../theme/tokens';

const LENGTH = 6;
const RESEND_SECONDS = 30;

export default function VerifyScreen() {
  const router = useRouter();
  const insets = useScreenInsets();
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const [checking, setChecking] = useState(false);

  const submit = async (value: string) => {
    if (value.length < LENGTH || checking) return;
    setChecking(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: (phone ?? '').replace(/[^\d+]/g, ''),
      token: value,
      type: 'sms',
    });
    setChecking(false);

    if (verifyError) {
      setError('That code did not work. Check it and try again.');
      setCode('');
      return;
    }
    // The store is listening for the session change and reloads from there.
    router.replace('/(tabs)');
  };

  const onChange = (next: string) => {
    const digits = next.replace(/[^\d]/g, '').slice(0, LENGTH);
    setCode(digits);
    if (error) setError(undefined);
    if (digits.length === LENGTH) void submit(digits);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.screen,
          flex: 1,
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

        <Text style={styles.title}>Enter your code</Text>
        <Text style={styles.body}>
          We sent six digits to {phone ? <Text style={styles.phone}>{phone}</Text> : 'your phone'}.
        </Text>

        <Pressable
          style={styles.boxes}
          onPress={() => inputRef.current?.focus()}
          accessibilityRole="button"
          accessibilityLabel="Enter the six digit code"
        >
          {Array.from({ length: LENGTH }).map((_, index) => {
            const char = code[index];
            const active = index === code.length;
            return (
              <View
                key={index}
                style={[styles.box, char && styles.boxFilled, active && styles.boxActive]}
              >
                <Text style={styles.boxText}>{char ?? ''}</Text>
              </View>
            );
          })}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={onChange}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={LENGTH}
          autoFocus
          style={styles.hiddenInput}
          accessibilityLabel="Verification code"
        />

        <View style={styles.actions}>
          <Button
            label="Verify"
            onPress={() => {
              if (code.length < LENGTH) {
                setError('Enter all six digits');
                return;
              }
              void submit(code);
            }}
            disabled={code.length < LENGTH}
            loading={checking}
          />

          <Pressable
            onPress={() => setSecondsLeft(RESEND_SECONDS)}
            disabled={secondsLeft > 0}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={[styles.resend, secondsLeft > 0 && styles.resendWaiting]}>
              {secondsLeft > 0 ? `Send again in ${secondsLeft}s` : 'Send the code again'}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  back: { width: 40, height: 40, justifyContent: 'center', marginBottom: spacing.xl },
  title: { ...typography.display, color: colors.textPrimary, marginBottom: spacing.sm },
  body: { ...typography.body, color: colors.textSecondary },
  phone: { color: colors.textPrimary, fontWeight: '600' },

  boxes: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xxxl },
  box: {
    flex: 1,
    height: 60,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: colors.borderStrong },
  boxActive: { borderColor: colors.accent },
  boxText: { ...typography.title, fontSize: 24, color: colors.textPrimary },

  // Off-screen rather than hidden: a display:none input cannot hold focus.
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1, top: -100 },

  error: { ...typography.meta, color: colors.danger, marginTop: spacing.md },
  actions: { marginTop: spacing.xxxl, gap: spacing.xl, alignItems: 'center' },
  resend: { ...typography.metaStrong, color: colors.accent },
  resendWaiting: { color: colors.textTertiary },
});
