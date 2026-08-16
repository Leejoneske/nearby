/**
 * Add or claim a listing.
 *
 * Three steps and a confirmation, because asking for everything on one screen
 * is how a small-business owner on a phone gives up halfway. Each step
 * validates only its own fields, so Continue is never a mystery.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import { CATEGORIES, categoryOf } from '../../data/categories';
import { DEFAULT_ORIGIN } from '../../data/location';
import type { Business, CategoryId } from '../../data/types';
import { useStore } from '../../lib/store';
import { colors, radii, spacing, typography } from '../../theme/tokens';

type Verification = 'phone' | 'postcard' | 'email';

const STEPS = ['Business', 'Location', 'Verify'] as const;

export default function ClaimScreen() {
  const router = useRouter();
  const insets = useScreenInsets();
  const { addBusiness } = useStore();

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [tagline, setTagline] = useState('');
  const [address, setAddress] = useState('');
  const [neighbourhood, setNeighbourhood] = useState('');
  const [phone, setPhone] = useState('');
  const [verification, setVerification] = useState<Verification>('phone');

  const stepValid = [
    name.trim().length > 1 && categoryId !== null,
    address.trim().length > 2 && neighbourhood.trim().length > 1,
    phone.trim().length >= 9,
  ][step];

  const finish = () => {
    const created: Business = {
      id: `listing-${Date.now()}`,
      name: name.trim(),
      categoryId: categoryId ?? 'services',
      tagline: tagline.trim() || categoryOf(categoryId ?? 'services').label,
      description: '',
      rating: 0,
      reviewCount: 0,
      priceLevel: 2,
      priceFrom: 0,
      priceTo: 0,
      address: address.trim(),
      neighbourhood: neighbourhood.trim(),
      phone: phone.trim(),
      // Until the owner drops a pin, the listing sits at the city centre.
      lat: DEFAULT_ORIGIN.lat,
      lng: DEFAULT_ORIGIN.lng,
      distanceM: 0,
      photos: [],
      hours: [null, null, null, null, null, null, null],
      amenities: [],
      reviews: [],
      ownedByViewer: true,
      verified: false,
      insights: {
        viewsThisWeek: 0,
        viewsLastWeek: 0,
        callsThisWeek: 0,
        directionsThisWeek: 0,
        searchAppearances: 0,
      },
    };
    addBusiness(created);
    setDone(true);
  };

  if (done) {
    return (
      <View style={[styles.screen, styles.doneScreen, { paddingTop: insets.top + spacing.huge }]}>
        <View style={styles.doneIcon}>
          <Ionicons name="checkmark" size={40} color={colors.textOnAccent} />
        </View>
        <Text style={styles.doneTitle}>{name.trim()} is listed</Text>
        <Text style={styles.doneBody}>
          We have sent a verification code to {phone.trim()}. Once you confirm it, your listing
          goes live in search and on the map.
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
            <Text style={styles.stepTitle}>Let&apos;s confirm it is yours</Text>
            <Text style={styles.stepBody}>
              Verification stops someone else editing your listing. Pick whichever is easiest.
            </Text>
            <Field
              label="Business phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+254 7.. ... ..."
            />

            <View style={styles.methods}>
              <Method
                icon="call-outline"
                title="Text message"
                detail="A code arrives in under a minute"
                selected={verification === 'phone'}
                onPress={() => setVerification('phone')}
              />
              <Method
                icon="mail-outline"
                title="Email"
                detail="Sent to the address on your account"
                selected={verification === 'email'}
                onPress={() => setVerification('email')}
              />
              <Method
                icon="home-outline"
                title="Postcard"
                detail="Mailed to the business address, 5–7 days"
                selected={verification === 'postcard'}
                onPress={() => setVerification('postcard')}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label={step === STEPS.length - 1 ? 'Create listing' : 'Continue'}
          disabled={!stepValid}
          onPress={() => (step === STEPS.length - 1 ? finish() : setStep(step + 1))}
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
                <Ionicons name={category.icon as never} size={19} color={colors.textSecondary} />
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

function Method({
  icon,
  title,
  detail,
  selected,
  onPress,
}: {
  icon: string;
  title: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.method, selected && styles.methodSelected]}
    >
      <View style={[styles.methodIcon, selected && styles.methodIconSelected]}>
        <Ionicons
          name={icon as never}
          size={18}
          color={selected ? colors.textOnAccent : colors.accent}
        />
      </View>
      <View style={styles.methodText}>
        <Text style={styles.methodTitle}>{title}</Text>
        <Text style={styles.methodDetail}>{detail}</Text>
      </View>
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={selected ? colors.accent : colors.borderStrong}
      />
    </Pressable>
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

  methods: { gap: spacing.md, marginTop: spacing.sm },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  methodSelected: { borderColor: colors.accent },
  methodIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodIconSelected: { backgroundColor: colors.accent },
  methodText: { flex: 1, gap: 2 },
  methodTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  methodDetail: { ...typography.meta, color: colors.textSecondary },

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
