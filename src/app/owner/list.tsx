/**
 * Listing a business.
 *
 * Four steps rather than one page: asking for everything at once is how a
 * small-business owner on a phone gives up halfway, and each step validates
 * only its own fields so Continue is never a mystery. The last step is
 * optional throughout — a listing is useful without opening hours and
 * useless without a name.
 *
 * There is deliberately no way to take over somebody else's listing from
 * here. A business is in this directory because whoever runs it put it
 * there, which is the only claim of ownership the directory can actually
 * stand behind.
 *
 * It needs a signed-in account, because it writes a row that belongs to
 * somebody. The database enforces that; this screen asks first rather than
 * letting somebody fill in four steps and then be refused.
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
  Switch,
  Text,
  View,
} from 'react-native';
import { useScreenInsets } from '../../lib/insets';

import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { PhotoUploader } from '../../components/PhotoUploader';
import { Card } from '../../components/primitives';
import { AMENITY_OPTIONS } from '../../data/amenities';
import { CATEGORIES, CATEGORY_TONES, categoryOf } from '../../data/categories';
import type { CategoryId, WeekHours } from '../../data/types';
import { DAY_NAMES, formatDayRange } from '../../lib/hours';
import { capturePin, describePin, type Pin } from '../../lib/pinLocation';
import { useStore } from '../../lib/store';
import { radii, spacing, typography } from '../../theme/tokens';
import { makeStyles, useTheme } from '../../theme/ThemeProvider';

const STEPS = ['Business', 'Location', 'Contact', 'Details'] as const;

/** A week with nothing set, which is what a new listing starts from. */
function emptyWeek(): WeekHours {
  return [null, null, null, null, null, null, null];
}

export default function ClaimScreen() {
  const styles = useStyles();
  const { colors, tones } = useTheme();
  const router = useRouter();
  const insets = useScreenInsets();
  const { addBusiness, session, userId } = useStore();

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [doneName, setDoneName] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [neighbourhood, setNeighbourhood] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [hours, setHours] = useState<WeekHours>(emptyWeek());
  const [amenities, setAmenities] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [pin, setPin] = useState<Pin | null>(null);
  const [pinning, setPinning] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const priceError =
    Number(priceTo) > 0 && Number(priceFrom) > Number(priceTo)
      ? 'The lower figure has to be the smaller one'
      : undefined;

  const stepValid = [
    name.trim().length > 1 && categoryId !== null,
    address.trim().length > 2 && neighbourhood.trim().length > 1,
    phone.trim().length >= 9,
    !priceError,
  ][step];

  const toggleDay = (index: number) => {
    setHours((prev) => {
      const next = [...prev] as WeekHours;
      // Reopening a closed day lands on a sane default rather than midnight.
      next[index] = prev[index] ? null : { open: 9 * 60, close: 18 * 60 };
      return next;
    });
  };

  /*
   * A pin is only ever a real fix. If the device cannot give one, the field
   * stays empty and the listing is placed at the centre of the area instead,
   * which the step says out loud — a listing quietly dropped on the middle of
   * town looks deliberate and sends people to the wrong street.
   */
  const dropPin = async () => {
    setPinning(true);
    setPinError(null);
    const result = await capturePin();
    setPinning(false);

    if (!result.ok) {
      setPinError(result.reason);
      return;
    }
    setPin(result.pin);
    // The area is usually the thing they were about to type anyway.
    if (!neighbourhood.trim() && result.pin.area) setNeighbourhood(result.pin.area);
  };

  const toggleAmenity = (amenity: string) =>
    setAmenities((prev) =>
      prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity],
    );

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
      await addBusiness({
        name: name.trim(),
        categoryId: categoryId ?? 'services',
        tagline: tagline.trim() || categoryOf(categoryId ?? 'services').label,
        description: description.trim(),
        address: address.trim(),
        neighbourhood: neighbourhood.trim(),
        phone: phone.trim(),
        website: website.trim(),
        priceFrom: Number(priceFrom) || 0,
        priceTo: Number(priceTo) || 0,
        hours: hours.some(Boolean) ? hours : undefined,
        amenities,
        photos,
        ...(pin ? { lat: pin.lat, lng: pin.lng } : {}),
      });
      setDoneName(name.trim());
      setDone(true);
    } catch (e) {
      console.warn('[list] the write was refused', e);
      setFailure('We could not save that listing just now. Please try again.');
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
        <Text style={styles.doneTitle}>{doneName} has been sent for review</Text>
        <Text style={styles.doneBody}>
          We read every listing before it goes live, which usually takes a day. You
          will get a notification either way, and you can keep editing it in the
          meantime.
        </Text>
        <Card style={styles.doneCard}>
          <Text style={styles.doneNext}>What to do next</Text>
          <NextStep icon="images-outline" text="Add a few photos, because listings with photos get opened far more often" />
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
              hint="Optional. One line under your name in search results."
            />
            <Field
              label="About"
              value={description}
              onChangeText={setDescription}
              placeholder="What should somebody know before they visit?"
              multiline
              hint="Optional. Shown on your listing page."
            />
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.group}>
            <Text style={styles.stepTitle}>Where can people find you?</Text>
            <Text style={styles.stepBody}>
              Standing at the shop? Drop a pin and the map will send people to the
              door rather than to the middle of the area.
            </Text>

            <Pressable
              onPress={() => void dropPin()}
              disabled={pinning}
              accessibilityRole="button"
              accessibilityLabel="Use my current location"
              style={[styles.pinCard, pin && styles.pinCardSet]}
            >
              <View style={[styles.pinIcon, pin && styles.pinIconSet]}>
                <Ionicons
                  name={pin ? 'checkmark' : 'locate'}
                  size={19}
                  color={pin ? colors.textOnAccent : colors.accent}
                />
              </View>
              <View style={styles.pinText}>
                <Text style={styles.pinTitle}>
                  {pinning
                    ? 'Finding you'
                    : pin
                      ? 'Location pinned'
                      : 'Use my current location'}
                </Text>
                <Text style={styles.pinBody}>
                  {pinning
                    ? 'This takes a few seconds outdoors, longer inside.'
                    : pin
                      ? describePin(pin)
                      : 'Only works if you are at the business right now.'}
                </Text>
              </View>
              {pin ? (
                <Text style={styles.pinRedo}>Redo</Text>
              ) : (
                <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
              )}
            </Pressable>

            {pinError ? <Text style={styles.failure}>{pinError}</Text> : null}

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

            {!pin ? (
              <Text style={styles.note}>
                Without a pin we will place it at the centre of the area you typed,
                and you can move it later from your dashboard.
              </Text>
            ) : null}
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
            <Field
              label="Website"
              value={website}
              onChangeText={setWebsite}
              keyboardType="url"
              prefix="https://"
              placeholder="yourbusiness.co.ke"
              hint="Optional."
            />
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.group}>
            <Text style={styles.stepTitle}>Anything else you want to show</Text>
            <Text style={styles.stepBody}>
              All of this is optional, and you can add it later from your dashboard.
            </Text>

            <Text style={styles.groupTitle}>Photos</Text>
            <PhotoUploader photos={photos} onChange={setPhotos} userId={userId} />

            <Text style={styles.groupTitle}>Typical spend</Text>
            <View style={styles.priceRow}>
              <View style={styles.priceField}>
                <Field
                  label="From (KSh)"
                  value={priceFrom}
                  onChangeText={setPriceFrom}
                  keyboardType="numeric"
                  placeholder="300"
                />
              </View>
              <View style={styles.priceField}>
                <Field
                  label="To (KSh)"
                  value={priceTo}
                  onChangeText={setPriceTo}
                  keyboardType="numeric"
                  placeholder="900"
                  error={priceError}
                />
              </View>
            </View>

            <Text style={styles.groupTitle}>Opening hours</Text>
            <Card style={styles.hoursCard}>
              {DAY_NAMES.map((day, index) => (
                <View key={day} style={[styles.hourRow, index < 6 && styles.hourDivider]}>
                  <Text style={styles.hourDay}>{day}</Text>
                  <Text style={styles.hourValue}>{formatDayRange(hours[index])}</Text>
                  <Switch
                    value={!!hours[index]}
                    onValueChange={() => toggleDay(index)}
                    trackColor={{ true: colors.accent, false: colors.borderStrong }}
                    thumbColor={colors.surface}
                    accessibilityLabel={`${day} open`}
                  />
                </View>
              ))}
            </Card>

            <Text style={styles.groupTitle}>Amenities</Text>
            <View style={styles.amenityRow}>
              {AMENITY_OPTIONS.map((amenity) => {
                const selected = amenities.includes(amenity);
                return (
                  <Pressable
                    key={amenity}
                    onPress={() => toggleAmenity(amenity)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[styles.amenityChip, selected && styles.amenityChipSelected]}
                  >
                    {selected ? (
                      <Ionicons name="checkmark" size={13} color={colors.textOnAccent} />
                    ) : null}
                    <Text style={[styles.amenityLabel, selected && styles.amenityLabelSelected]}>
                      {amenity}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.note}>
              {signedOut
                ? 'Sign in on the next step so the listing is saved to your account.'
                : 'We read every listing before it goes live, which usually takes a day.'}
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
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.nextStep, !last && styles.nextStepDivider]}>
      <Ionicons name={icon as never} size={17} color={colors.accent} />
      <Text style={styles.nextStepText}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors, tones) => ({
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
  groupTitle: { ...typography.sectionTitle, color: colors.textPrimary, marginTop: spacing.sm },
  stepTitle: { ...typography.title, color: colors.textPrimary },
  stepBody: { ...typography.body, color: colors.textSecondary, marginTop: -spacing.sm },

  pinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  pinCardSet: { borderColor: colors.accent },
  pinIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinIconSet: { backgroundColor: colors.accent },
  pinText: { flex: 1, gap: 2 },
  pinTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  pinBody: { ...typography.caption, color: colors.textSecondary },
  pinRedo: { ...typography.metaStrong, color: colors.accent },

  priceRow: { flexDirection: 'row', gap: spacing.md },
  priceField: { flex: 1 },

  hoursCard: { paddingVertical: spacing.xs },
  hourRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  hourDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  hourDay: { ...typography.bodyStrong, color: colors.textPrimary, width: 44 },
  hourValue: { ...typography.meta, color: colors.textSecondary, flex: 1 },

  amenityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  amenityChipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  amenityLabel: { ...typography.meta, color: colors.textSecondary },
  amenityLabelSelected: { color: colors.textOnAccent, fontWeight: '600' },

  note: { ...typography.meta, color: colors.textSecondary },
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
}));
