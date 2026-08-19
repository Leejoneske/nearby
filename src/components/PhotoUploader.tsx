/**
 * The photos on a listing: add, look at, remove.
 *
 * The advice above the row is the point of the whole component. A listing
 * whose first picture is the shopfront gets recognised from the pavement; one
 * whose first picture is a plate of food could be anywhere, and somebody
 * standing outside cannot tell whether they have arrived.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import * as api from '../lib/api';
import { checkImage, storagePath } from '../lib/avatars';
import { colors, radii, spacing, typography } from '../theme/tokens';

export const MAX_PHOTOS = 6;

export function PhotoUploader({
  photos,
  onChange,
  userId,
}: {
  photos: string[];
  onChange: (next: string[]) => void;
  /** Uploads land in a folder named after this, which storage checks. */
  userId: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const full = photos.length >= MAX_PHOTOS;

  const add = async () => {
    setError(null);
    if (!userId) {
      setError('Sign in first so the photo is saved to your listing.');
      return;
    }
    if (full) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('We need permission to open your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.8,
    });
    if (result.canceled) return;

    setBusy(true);
    const added: string[] = [];
    try {
      for (const asset of result.assets) {
        const check = checkImage({
          mimeType: asset.mimeType,
          fileSize: asset.fileSize,
          fileName: asset.fileName,
        });
        if (!check.ok) {
          setError(check.reason);
          continue;
        }
        added.push(
          await api.uploadImage(
            'business-photos',
            storagePath(userId, check.type),
            asset.uri,
            check.type,
          ),
        );
      }
      if (added.length > 0) onChange([...photos, ...added].slice(0, MAX_PHOTOS));
    } catch (e) {
      console.warn('[photos] upload failed', e);
      setError('We could not upload that. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.advice}>
        Lead with the front of the shop, taken from across the street, so people
        recognise you when they arrive. Add the inside and what you sell after that.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {!full ? (
          <Pressable
            onPress={() => void add()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Add a photo"
            style={styles.add}
          >
            <Ionicons
              name={busy ? 'cloud-upload-outline' : 'camera-outline'}
              size={22}
              color={colors.accent}
            />
            <Text style={styles.addLabel}>{busy ? 'Uploading' : 'Add photo'}</Text>
          </Pressable>
        ) : null}

        {photos.map((uri, index) => (
          <View key={uri} style={styles.item}>
            <Image source={{ uri }} style={styles.photo} contentFit="cover" transition={120} />
            {index === 0 ? (
              <View style={styles.mainTag}>
                <Text style={styles.mainTagText}>Main</Text>
              </View>
            ) : null}
            <Pressable
              onPress={() => onChange(photos.filter((p) => p !== uri))}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${index + 1}`}
              style={styles.remove}
            >
              <Ionicons name="close" size={14} color={colors.textOnAccent} />
            </Pressable>
          </View>
        ))}
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  advice: { ...typography.meta, color: colors.textSecondary },
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  add: {
    width: 104,
    height: 104,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  addLabel: { ...typography.caption, color: colors.accent, fontWeight: '600' },
  item: { width: 104, height: 104 },
  photo: {
    width: 104,
    height: 104,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSunken,
  },
  mainTag: {
    position: 'absolute',
    left: spacing.xs,
    bottom: spacing.xs,
    backgroundColor: colors.overlay,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  mainTagText: { ...typography.caption, fontSize: 10.5, color: colors.textOnAccent, fontWeight: '700' },
  remove: {
    position: 'absolute',
    right: -4,
    top: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { ...typography.meta, color: colors.danger },
});
