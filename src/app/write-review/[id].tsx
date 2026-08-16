import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '../../components/Button';
import { Photo } from '../../components/Photo';
import { EmptyState } from '../../components/primitives';
import { initialsOf } from '../../lib/format';
import { useScreenInsets } from '../../lib/insets';
import { useStore } from '../../lib/store';
import { colors, radii, spacing, typography } from '../../theme/tokens';

const MIN_BODY = 10;
const MAX_BODY = 1000;

/** What each star means, shown as the person picks. */
const RATING_WORDS = ['', 'Poor', 'Not great', 'Fine', 'Good', 'Excellent'];

export default function WriteReviewScreen() {
  const router = useRouter();
  const insets = useScreenInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getBusiness, addReview, viewer } = useStore();

  const business = getBusiness(id);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [touched, setTouched] = useState(false);

  if (!business) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <EmptyState
          icon="alert-circle-outline"
          title="Listing not found"
          body="This business may have been removed."
        />
      </View>
    );
  }

  const trimmed = body.trim();
  const ratingError = touched && rating === 0 ? 'Pick a star rating' : undefined;
  const bodyError =
    touched && trimmed.length > 0 && trimmed.length < MIN_BODY
      ? 'Tell people a little more'
      : undefined;
  const canPost = rating > 0 && trimmed.length >= MIN_BODY;

  const post = () => {
    setTouched(true);
    if (!canPost) return;
    addReview(business.id, {
      id: `r-${Date.now()}`,
      authorName: viewer.name,
      authorInitials: initialsOf(viewer.name),
      rating,
      date: new Date().toISOString().slice(0, 10),
      body: trimmed,
    });
    router.back();
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
          accessibilityLabel="Cancel"
          style={styles.iconButton}
        >
          <Ionicons name="close" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Write a review</Text>
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
        <View style={styles.business}>
          <Photo
            categoryId={business.categoryId}
            seed={business.id}
            uri={business.photos[0]}
            style={styles.thumb}
            radius={radii.md}
            iconSize={20}
          />
          <View style={styles.businessText}>
            <Text style={styles.businessName} numberOfLines={1}>
              {business.name}
            </Text>
            <Text style={styles.businessMeta} numberOfLines={1}>
              {business.neighbourhood}
            </Text>
          </View>
        </View>

        <Text style={styles.question}>How was it?</Text>

        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable
              key={value}
              onPress={() => setRating(value)}
              hitSlop={6}
              accessibilityRole="radio"
              accessibilityState={{ selected: rating === value }}
              accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
            >
              <Ionicons
                name={value <= rating ? 'star' : 'star-outline'}
                size={40}
                color={value <= rating ? colors.star : colors.borderStrong}
              />
            </Pressable>
          ))}
        </View>

        <Text style={[styles.ratingWord, rating === 0 && styles.ratingWordEmpty]}>
          {rating === 0 ? 'Tap a star' : RATING_WORDS[rating]}
        </Text>
        {ratingError ? <Text style={styles.error}>{ratingError}</Text> : null}

        <Text style={styles.label}>Your review</Text>
        <TextInput
          value={body}
          onChangeText={(text) => setBody(text.slice(0, MAX_BODY))}
          placeholder="What should someone know before they go?"
          placeholderTextColor={colors.textTertiary}
          multiline
          style={[styles.input, bodyError && styles.inputError]}
          accessibilityLabel="Your review"
        />
        <View style={styles.inputFooter}>
          <Text style={styles.hint}>{bodyError ?? 'Be specific and be fair.'}</Text>
          <Text style={styles.counter}>
            {trimmed.length}/{MAX_BODY}
          </Text>
        </View>

        <View style={styles.guidelines}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} />
          <Text style={styles.guidelinesText}>
            Reviews are public and show your name. The owner can reply.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button label="Post review" onPress={post} disabled={!canPost} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  centered: { justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.cardTitle, color: colors.textPrimary, flex: 1, textAlign: 'center' },

  business: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: 48, height: 48 },
  businessText: { flex: 1, gap: 2 },
  businessName: { ...typography.cardTitle, fontSize: 15, color: colors.textPrimary },
  businessMeta: { ...typography.meta, color: colors.textSecondary },

  question: {
    ...typography.title,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.xxxl,
  },
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  ratingWord: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  ratingWordEmpty: { color: colors.textTertiary, fontWeight: '400' },
  error: { ...typography.meta, color: colors.danger, textAlign: 'center', marginTop: spacing.xs },

  label: {
    ...typography.metaStrong,
    color: colors.textSecondary,
    marginTop: spacing.xxxl,
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: 150,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    ...typography.body,
    color: colors.textPrimary,
    textAlignVertical: 'top',
    ...(({ outlineStyle: 'none' } as unknown) as object),
  },
  inputError: { borderColor: colors.danger },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  hint: { ...typography.caption, color: colors.textTertiary, flex: 1 },
  counter: { ...typography.caption, color: colors.textTertiary, fontVariant: ['tabular-nums'] },

  guidelines: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginTop: spacing.xxl,
  },
  guidelinesText: { ...typography.caption, color: colors.textTertiary, flex: 1, lineHeight: 16 },

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
