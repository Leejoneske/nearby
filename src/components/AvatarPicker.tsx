/**
 * Choosing a profile picture: upload one, or take one of the built-ins.
 *
 * The presets are not decoration. Plenty of people do not want a photo of
 * themselves in a public directory next to a review, and initials on an
 * orange circle is what everybody else already has. A shape and a colour they
 * picked is theirs without being them.
 */
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { checkImage, PRESETS, presetRef } from '../lib/avatars';
import { spacing, typography } from '../theme/tokens';
import { makeStyles, useTheme } from '../theme/ThemeProvider';
import { Avatar } from './primitives';
import { Button } from './Button';

export function AvatarPicker({
  initials,
  current,
  onPick,
  uploading,
}: {
  initials: string;
  current?: string;
  /** A preset reference, an uploaded file, or null to go back to initials. */
  onPick: (value: string | null, file?: { uri: string; type: string }) => void;
  uploading?: boolean;
}) {
  const styles = useStyles();
  const { colors, tones } = useTheme();
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('We need permission to open your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const check = checkImage({
      mimeType: asset.mimeType,
      fileSize: asset.fileSize,
      fileName: asset.fileName,
    });
    if (!check.ok) {
      setError(check.reason);
      return;
    }

    // Where it goes is the caller's business: the path has to start with the
    // uploader's id, and this component does not know whose picture this is.
    onPick(null, { uri: asset.uri, type: check.type });
  };

  return (
    <View style={styles.wrap}>
      <Avatar initials={initials} avatar={current} size={96} />

      <Button
        label={uploading ? 'Uploading' : 'Upload a photo'}
        icon="camera-outline"
        variant="secondary"
        size="md"
        loading={uploading}
        onPress={() => void pick()}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.or}>or pick one</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presets}
      >
        {PRESETS.map((preset) => {
          const ref = presetRef(preset.id);
          const chosen = current === ref;
          return (
            <Pressable
              key={preset.id}
              onPress={() => onPick(ref)}
              accessibilityRole="button"
              accessibilityState={{ selected: chosen }}
              accessibilityLabel={`Use the ${preset.id} picture`}
              style={[
                styles.preset,
                { backgroundColor: tones[preset.tone].fg },
                chosen && styles.presetChosen,
              ]}
            >
              <Ionicons name={preset.icon as never} size={22} color={colors.textOnAccent} />
            </Pressable>
          );
        })}
      </ScrollView>

      {current ? (
        <Pressable onPress={() => onPick(null)} hitSlop={8} accessibilityRole="button">
          <Text style={styles.clear}>Go back to my initials</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors, tones) => ({
  wrap: { alignItems: 'center', gap: spacing.md },
  error: { ...typography.meta, color: colors.danger, textAlign: 'center' },
  or: { ...typography.meta, color: colors.textTertiary, marginTop: spacing.xs },
  presets: { gap: spacing.sm, paddingHorizontal: spacing.xs },
  preset: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  presetChosen: { borderColor: colors.textPrimary },
  clear: { ...typography.metaStrong, color: colors.textSecondary, marginTop: spacing.xs },
}));
