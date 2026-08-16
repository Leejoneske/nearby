/**
 * Add a listing, or claim one that is already here.
 *
 * Two modes in one screen. With no `business` param it is the three step
 * form: asking for everything at once is how a small-business owner on a
 * phone gives up halfway, and each step validates only its own fields so
 * Continue is never a mystery. With `?business=<id>` it is a single confirm
 * step that takes over an existing listing instead of creating a second copy
 * of it — which is what happened when this screen only knew how to create.
 *
 * Both need a signed-in account, because both write a row that belongs to
 * somebody. The database enforces that; this screen just asks first rather
 * than letting someone fill in three steps and then fail.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useScreenInsets } from '../../lib/insets';

import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Card } from '../../components/primitives';
import { CATEGORIES, CATEGORY_TONES, categoryOf } from '../../data/categories';
import type { CategoryId } from '../../data/types';
import { useStore } from '../../lib/store';
import { colors, radii, spacing, tones, typography } from '../../theme/tokens';

const STEPS = ['Business', 'Location', 'Contact'] as const;

export default function ClaimScreen() {
  const router = useRouter();
  const insets = useScreenInsets();
  const { business: claimId } = useLocalSearchParams<{ business?: string }>();
  const { addBusiness, claimBusiness, getBusiness, session } = useStore();

  const claiming = getBusiness(claimId ?? '');

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [doneName, setDoneName] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [tagline, setTagline] = useState('');
  const [address, setAddress] = useState('');
  const [neighbourhood, setNeighbourhood] = useState('');
  const [phone, setPhone] = useState('');

  const stepValid = [
    name.trim().length > 1 && categoryId !== null,
    address.trim().length > 2 && neighbourhood.trim().length > 1,
    phone.trim().length >= 9,
  ][step];

  const signedOut = session.status === 'signedOut';

  const finish = async () => {
    if (working) return;
    setFailure(null);

    if (signedOut) {
      router.push('/(auth)/sign-in');
      return;
    }

    setWorking(true);
    try {
      if (claiming) {
        await claimBusiness(claiming.id);
        setDoneName(claiming.name);
      } else {
        await addBusiness({
          name: name.trim(),
          categoryId: categoryId ?? 'services',
          tagline: tagline.trim() || categoryOf(categoryId ?? 'services').label,
          address: address.trim(),
          neighbourhood: neighbourhood.trim(),
          phone: phone.trim(),
        });
        setDoneName(name.trim());
      }
      setDone(true);
    } catch (e) {
      console.warn('[claim] the write was refused', e);
      setFailure(
        claiming
          ? 'We could not add that to your account. Somebody may already manage it.'
          : 'We could not save that listing just now. Please try again.',
      );
    } finally {
      setWorking(false);
    }
  };

  if (done) {
    return (
      <View style={[styles.screen, styles.doneScreen, { paddingTop: insets.top + spacing.huge }]}>
        <View style={styles.doneIcon}>
          <Ionicons name="checkmark" size={40} color={colors.textOnAccent} />
        </View>
        <Text style={styles.doneTitle}>
          {claiming ? `${doneName} is yours to manage` : `${doneName} is listed`}
        </Text>
        <Text style={styles.doneBody}>
          It is live in search and on the map now. We will be in touch to confirm the
          business is yours — until then it shows as unverified.
        </Text>
        <Card style={styles.doneCard}>
          <Text style={styles.doneNext}>What to do next</Text>
          <NextStep icon="images-outline" text="Add a few photos — listings with photos get opened far more often" />
          <NextStep icon="time-outline" text="Set your opening hours so people know when to come" />
          <NextStep icon="pricetag-outline" text="Add a typical price range to set expectations" last />
        </Card>
        <View style={styles.doneActions}>
          <Button label="Go to my dashboard" onPress={() => router.replace('/(tabs)/profile')} />
          <Button label="Not now" variant="ghost" size="md" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  if (claiming) {
    return (
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.iconButton}
            >
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.headerTitle}>Claim this listing</Text>
            <View style={styles.iconButton} />
          </View>
        </View>

        <View style={styles.claimBody}>
          <Text style={styles.stepTitle}>{claiming.name}</Text>
          <Text style={styles.stepBody}>
            {claiming.address}
            {claiming.neighbourhood ? `, ${claiming.neighbourhood}` : ''}
          </Text>

          <Card style={styles.doneCard}>
            <Text style={styles.doneNext}>What claiming gets you</Text>
            <NextStep icon="create-outline" text="Edit the details, hours and photos" />
            <NextStep icon="chatbubbles-outline" text="Reply to reviews as the owner" />
            <NextStep icon="eye-outline" text="See how many people are finding you" last />
          </Card>

          <Text style={styles.claimNote}>
            {signedOut
              ? 'Sign in first so we know who to give it to.'
              : 'We will be in touch to confirm the business is yours.'}
          </Text>

          {failure ? <Text style={styles.failure}>{failure}</Text> : null}
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            label={signedOut ? 'Sign in to claim it' : 'Claim this listing'}
            loading={working}
            onPress={finish}
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header + progress */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => (step === 0 ? router.back() : setStep(step - 1))}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={step === 0 ? 'Close' : 'Previous step'}
            style={styles.iconButton}
          >
            <Ionicons
              name={step === 0 ? 'close' : 'arrow-back'}
              size={22}
              color={colors.textPrimary}
            />
          </Pressable>
          <Text style={styles.headerTitle}>List your business</Text>
          <View style={styles.iconButton} />
        </View>

        <View style={styles.progressRow}>
          {STEPS.map((label, index) => (
            <View key={label} style={styles.progressItem}>
              <View style={[styles.progressBar, index <= step && styles.progressBarActive]} />
              <Text style={[styles.progressLabel, index <= step && styles.progressLabelActive]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.screen, paddingBottom: insets.bottom + 120 }}
      >
        {step === 0 ? (
          <View style={styles.group}>
            <Text style={styles.stepTitle}>What is your business called?</Text>
            <Text style={styles.stepBody}>
              This is the name customers will search for, so use the one on your sign.
            </Text>
            <Field
              label="Business name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Kahawa Collective"
            />
            <Field
              label="Category"
              value={categoryId ? categoryOf(categoryId).label : ''}
              placeholder="Choose a category"
              select
              onPress={() => setCategoryOpen(true)}
            />
            <Field
              label="Short description"
              value={tagline}
              onChangeText={setTagline}
              placeholder="e.g. Specialty coffee roaster"
              hint="Optional — one line under your name in search results"
            />
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.group}>
            <Text style={styles.stepTitle}>Where can people find you?</Text>
            <Text style={styles.stepBody}>
              You can drop an exact pin on the map after your listing is verified.
            </Text>
            <Field
              label="Street address"
              value={address}
              onChangeText={setAddress}
              placeholder="e.g. Peponi Road"
            />
            <Field
              label="Area or neighbourhood"
              value={neighbourhood}
              onChangeText={setNeighbourhood}
              placeholder="e.g. Westlands"
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.group}>
            <Text style={styles.stepTitle}>How can people reach you?</Text>
            <Text style={styles.stepBody}>
              This is the number on your listing, and the one we will use to confirm the
              business is yours.
            </Text>
            <Field
              label="Business phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+254 7.. ... ..."
            />
            <Text style={styles.claimNote}>
              {signedOut
                ? 'Sign in on the next step so the listing is saved to your account.'
                : 'Your listing goes live straight away, and shows as unverified until we confirm it.'}
            </Text>
            {failure ? <Text style={styles.failure}>{failure}</Text> : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label={
            step < STEPS.length - 1
              ? 'Continue'
              : signedOut
                ? 'Sign in to finish'
                : 'Create listing'
          }
          disabled={!stepValid}
          loading={working}
          onPress={() => (step === STEPS.length - 1 ? void finish() : setStep(step + 1))}
        />
      </View>

      {/* Category picker */}
      <Modal
        visible={categoryOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCategoryOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setCategoryOpen(false)}
          accessibilityLabel="Close"
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>Choose a category</Text>
          <ScrollView style={styles.sheetScroll}>
            {CATEGORIES.map((category, index) => (
              <Pressable
                key={category.id}
                onPress={() => {
                  setCategoryId(category.id);
                  setCategoryOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: categoryId === category.id }}
                style={[styles.sheetOption, index < CATEGORIES.length - 1 && styles.sheetDivider]}
              >
                <Ionicons
                  name={category.icon as never}
                  size={19}
                  color={tones[CATEGORY_TONES[category.id]].fg}
                />
                <Text style={styles.sheetOptionLabel}>{category.label}</Text>
                {categoryId === category.id ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function NextStep({ icon, text, last }: { icon: string; text: string; last?: boolean }) {
  return (
    <View style={[styles.nextStep, !last && styles.nextStepDivider]}>
      <Ionicons name={icon as never} size={17} color={colors.accent} />
      <Text style={styles.nextStepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },

  header: {
    backgroundColor: colors.canvas,
    paddingBottom: spacing.lg,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.cardTitle, color: colors.textPrimary, flex: 1, textAlign: 'center' },

  progressRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
  },
  progressItem: { flex: 1, gap: spacing.xs + 2 },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressBarActive: { backgroundColor: colors.accent },
  progressLabel: { ...typography.caption, color: colors.textTertiary },
  progressLabelActive: { color: colors.textPrimary, fontWeight: '700' },

  group: { gap: spacing.lg },
  stepTitle: { ...typography.title, color: colors.textPrimary },
  stepBody: { ...typography.body, color: colors.textSecondary, marginTop: -spacing.sm },

  claimBody: { flex: 1, paddingHorizontal: spacing.screen, gap: spacing.md },
  claimNote: { ...typography.meta, color: colors.textSecondary },
  failure: { ...typography.meta, color: colors.danger },

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

  doneScreen: { paddingHorizontal: spacing.screen, alignItems: 'center', gap: spacing.lg },
  doneIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  doneTitle: { ...typography.display, fontSize: 28, color: colors.textPrimary, textAlign: 'center' },
  doneBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  doneCard: { alignSelf: 'stretch', gap: spacing.xs, marginTop: spacing.sm },
  doneNext: { ...typography.metaStrong, color: colors.textPrimary, marginBottom: spacing.xs },
  nextStep: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, alignItems: 'center' },
  nextStepDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  nextStepText: { ...typography.meta, color: colors.textSecondary, flex: 1 },
  doneActions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm },

  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    maxHeight: '70%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.lg,
  },
  sheetTitle: { ...typography.sectionTitle, color: colors.textPrimary, marginBottom: spacing.sm },
  sheetScroll: { flexGrow: 0 },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg - 2,
  },
  sheetDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetOptionLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
});
