/**
 * The one thing we ask for after a first sign in: a name.
 *
 * An account is created with an empty name, and until this existed there was
 * nowhere to type one, so everybody with an account still appeared as "Guest"
 * on their own profile and on every review they wrote. A picture is offered
 * on the same screen because it is the other half of how somebody appears,
 * and asking twice is asking once too often.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
import { spacing, typography } from '../../theme/tokens';
import { makeStyles } from '../../theme/ThemeProvider';

export default function WelcomeScreen() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useScreenInsets();
  const { updateViewer, userId } = useStore();

  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [avatar, setAvatar] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = cleanDisplayName(name).length < 2;
  const nameError = touched && tooShort ? 'Tell us what to call you' : undefined;

  // Held until Save rather than written on pick, because there is no profile
  // worth updating yet and one write is enough.
  const pick = async (value: string | null, file?: { uri: string; type: string }) => {
    setError(null);
    if (!file) {
      setAvatar(value ?? undefined);
      return;
    }
    if (!userId) return;

    setUploading(true);
    try {
      const url = await api.uploadImage(
        'avatars',
        storagePath(userId, file.type),
        file.uri,
        file.type,
      );
      setAvatar(url);
    } catch (e) {
      setError(reasonFor(e, 'We could not save that picture. Try again.'));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setTouched(true);
    if (tooShort || saving || uploading) return;

    setError(null);
    setSaving(true);
    try {
      await updateViewer({ name, ...(avatar ? { avatar } : {}) });
      router.replace('/(tabs)');
    } catch (e) {
      if (e instanceof NeedsAccountError) return;
      setError(reasonFor(e));
    } finally {
      setSaving(false);
    }
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
          paddingTop: insets.top + spacing.xxl,
          paddingHorizontal: spacing.screen,
          paddingBottom: insets.bottom + spacing.huge,
        }}
      >
        <Text style={styles.title}>Nice to meet you</Text>
        <Text style={styles.body}>
          Your name is what people see on the reviews you write. You can change
          it whenever you like.
        </Text>

        <View style={styles.picker}>
          <AvatarPicker
            initials={initialsOf(name || 'N')}
            current={avatar}
            uploading={uploading}
            onPick={(value, file) => void pick(value, file)}
          />
        </View>

        <View style={styles.form}>
          <Field
            label="Your name"
            value={name}
            onChangeText={setName}
            placeholder="First name, or the name you go by"
            error={nameError}
          />
          <Button
            label="Save and continue"
            loading={saving}
            onPress={() => void save()}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function reasonFor(e: unknown, fallback = 'We could not save that. Try again.'): string {
  const text = e instanceof Error ? e.message.trim() : '';
  return text || fallback;
}

const useStyles = makeStyles((colors, tones) => ({
  screen: { flex: 1, backgroundColor: colors.canvas },
  title: { ...typography.display, color: colors.textPrimary, marginBottom: spacing.sm },
  body: { ...typography.body, color: colors.textSecondary, maxWidth: '92%' },
  picker: { marginTop: spacing.xxl },
  form: { gap: spacing.xl, marginTop: spacing.xxl },
  error: {
    ...typography.meta,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
}));
