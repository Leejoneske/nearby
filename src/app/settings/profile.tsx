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
import { Avatar } from '../../components/primitives';
import { initialsOf } from '../../lib/format';
import { useScreenInsets } from '../../lib/insets';
import { useStore } from '../../lib/store';
import { colors, radii, spacing, typography } from '../../theme/tokens';

/** Accepts an empty address; a profile does not have to carry one. */
export function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useScreenInsets();
  const { viewer, updateViewer, session } = useStore();

  const [name, setName] = useState(viewer.name);
  const [email, setEmail] = useState(viewer.email);
  const [area, setArea] = useState(viewer.area);
  const [saved, setSaved] = useState(false);

  const nameError = name.trim().length < 2 ? 'Tell us what to call you' : undefined;
  const emailError = isValidEmail(email) ? undefined : 'That email does not look right';
  const canSave = !nameError && !emailError;

  const save = () => {
    if (!canSave) return;
    updateViewer({
      name: name.trim(),
      initials: initialsOf(name),
      email: email.trim(),
      area: area.trim(),
    });
    setSaved(true);
    setTimeout(() => router.back(), 450);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.iconButton}
        >
          <Ionicons name="arrow-back" size={21} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Your profile</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: spacing.screen,
          paddingBottom: insets.bottom + 120,
        }}
      >
        <View style={styles.avatarBlock}>
          <Avatar initials={initialsOf(name)} size={84} verified={viewer.verified} />
          <Text style={styles.avatarNote}>
            Your initials stand in until photo uploads arrive.
          </Text>
        </View>

        <View style={styles.form}>
          <Field
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            error={nameError}
            hint="Shown on any review you write."
          />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="you@example.com"
            error={emailError}
          />
          <Field
            label="Where you are"
            value={area}
            onChangeText={setArea}
            placeholder="Neighbourhood, city"
            hint="Used to sort results by how close they are."
          />
          <View style={styles.readonly}>
            <Text style={styles.readonlyLabel}>Phone</Text>
            <Text style={styles.readonlyValue}>{session.phone ?? 'Not set'}</Text>
            <Text style={styles.readonlyHint}>
              This is how you sign in. Get in touch if it needs to change.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label={saved ? 'Saved' : 'Save changes'}
          icon={saved ? 'checkmark' : undefined}
          onPress={save}
          disabled={!canSave}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.cardTitle, color: colors.textPrimary, flex: 1, textAlign: 'center' },

  avatarBlock: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  avatarNote: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    maxWidth: '80%',
  },

  form: { gap: spacing.xl, marginTop: spacing.lg },

  readonly: { gap: spacing.xs },
  readonlyLabel: { ...typography.metaStrong, color: colors.textSecondary },
  readonlyValue: {
    ...typography.body,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    overflow: 'hidden',
  },
  readonlyHint: { ...typography.caption, color: colors.textTertiary },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
