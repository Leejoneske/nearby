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

import { AvatarPicker } from '../../components/AvatarPicker';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import * as api from '../../lib/api';
import { storagePath } from '../../lib/avatars';
import { initialsOf } from '../../lib/format';
import { cleanDisplayName } from '../../lib/identity';
import { useScreenInsets } from '../../lib/insets';
import { NeedsAccountError, useStore } from '../../lib/store';
import { radii, spacing, typography } from '../../theme/tokens';
import { makeStyles, useTheme } from '../../theme/ThemeProvider';

export default function EditProfileScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useScreenInsets();
  const { viewer, updateViewer, session, userId } = useStore();

  const [name, setName] = useState(viewer.name === 'Guest' ? '' : viewer.name);
  const [area, setArea] = useState(viewer.area);
  const [avatar, setAvatar] = useState<string | undefined>(viewer.avatar);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameError =
    cleanDisplayName(name).length < 2 ? 'Tell us what to call you' : undefined;
  const canSave = !nameError && !saving && !uploading;

  /*
   * A picture is uploaded and stored the moment it is picked rather than held
   * until Save. It appears next to every review the person has written, so
   * there is nothing to lose by keeping it and a half finished form to lose
   * by waiting.
   */
  const pick = async (value: string | null, file?: { uri: string; type: string }) => {
    setError(null);

    if (!file) {
      setAvatar(value ?? undefined);
      try {
        await updateViewer({ avatar: value ?? '' });
      } catch (e) {
        setAvatar(viewer.avatar);
        setError(messageFor(e));
      }
      return;
    }

    if (!userId) {
      router.push('/(auth)/sign-in');
      return;
    }

    setUploading(true);
    try {
      const url = await api.uploadImage(
        'avatars',
        storagePath(userId, file.type),
        file.uri,
        file.type,
      );
      setAvatar(url);
      await updateViewer({ avatar: url });
    } catch (e) {
      setError(messageFor(e, 'We could not save that picture. Try again.'));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!canSave) return;
    setError(null);
    setSaving(true);
    try {
      await updateViewer({ name, area: area.trim() });
      setSaved(true);
      router.back();
    } catch (e) {
      if (e instanceof NeedsAccountError) return;
      setError(messageFor(e));
    } finally {
      setSaving(false);
    }
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
          <AvatarPicker
            initials={initialsOf(name || viewer.name)}
            current={avatar}
            uploading={uploading}
            onPick={(value, file) => void pick(value, file)}
          />
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
            label="Where you are"
            value={area}
            onChangeText={setArea}
            placeholder="Neighbourhood, city"
            hint="Used to sort results by how close they are."
          />
          <View style={styles.readonly}>
            <Text style={styles.readonlyLabel}>Email</Text>
            <Text style={styles.readonlyValue}>
              {session.email ?? 'Not signed in'}
            </Text>
            <Text style={styles.readonlyHint}>
              This is how you sign in. Get in touch if it needs to change.
            </Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label={saved ? 'Saved' : 'Save changes'}
          icon={saved ? 'checkmark' : undefined}
          loading={saving}
          onPress={() => void save()}
          disabled={!canSave}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

/** A refusal is worth reading, so the reason is shown rather than swallowed. */
function messageFor(e: unknown, fallback = 'We could not save that. Try again.'): string {
  const text = e instanceof Error ? e.message.trim() : '';
  return text || fallback;
}

const useStyles = makeStyles((colors, tones) => ({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.cardTitle, color: colors.textPrimary, flex: 1, textAlign: 'center' },

  avatarBlock: { paddingVertical: spacing.lg },

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

  error: {
    ...typography.meta,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.lg,
  },

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
}));
