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
  Switch,
  Text,
  View,
} from 'react-native';
import { useScreenInsets } from '../../../lib/insets';

import { Button } from '../../../components/Button';
import { Field } from '../../../components/Field';
import { Photo } from '../../../components/Photo';
import { Card, EmptyState } from '../../../components/primitives';
import { CATEGORIES, categoryOf } from '../../../data/categories';
import type { CategoryId, WeekHours } from '../../../data/types';
import { DAY_NAMES, formatDayRange } from '../../../lib/hours';
import { useStore } from '../../../lib/store';
import { colors, radii, spacing, typography } from '../../../theme/tokens';

export default function EditListingScreen() {
  const router = useRouter();
  const insets = useScreenInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getBusiness, updateBusiness } = useStore();

  const business = getBusiness(id);

  const [name, setName] = useState(business?.name ?? '');
  const [tagline, setTagline] = useState(business?.tagline ?? '');
  const [description, setDescription] = useState(business?.description ?? '');
  const [categoryId, setCategoryId] = useState<CategoryId>(business?.categoryId ?? 'restaurant');
  const [address, setAddress] = useState(business?.address ?? '');
  const [phone, setPhone] = useState(business?.phone ?? '');
  const [website, setWebsite] = useState(business?.website ?? '');
  const [priceFrom, setPriceFrom] = useState(String(business?.priceFrom ?? ''));
  const [priceTo, setPriceTo] = useState(String(business?.priceTo ?? ''));
  const [hours, setHours] = useState<WeekHours>(business?.hours ?? emptyWeek());
  const [amenities, setAmenities] = useState<string[]>(business?.amenities ?? []);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!business) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <EmptyState
          icon="business-outline"
          title="Listing not found"
          body="This listing may have been removed from your account."
        />
      </View>
    );
  }

  const nameError = name.trim().length === 0 ? 'A business needs a name' : undefined;
  const priceError =
    Number(priceTo) > 0 && Number(priceFrom) > Number(priceTo)
      ? 'The lower figure has to be the smaller one'
      : undefined;
  const canSave = !nameError && !priceError;

  const onSave = () => {
    if (!canSave) return;
    updateBusiness(business.id, {
      name: name.trim(),
      tagline: tagline.trim(),
      description: description.trim(),
      categoryId,
      address: address.trim(),
      phone: phone.trim(),
      website: website.trim() || undefined,
      priceFrom: Number(priceFrom) || 0,
      priceTo: Number(priceTo) || 0,
      hours,
      amenities,
    });
    setSaved(true);
    setTimeout(() => router.back(), 500);
  };

  const toggleDay = (index: number) => {
    setHours((prev) => {
      const next = [...prev] as WeekHours;
      // Reopening a closed day lands on a sane default rather than midnight.
      next[index] = prev[index] ? null : { open: 9 * 60, close: 18 * 60 };
      return next;
    });
  };

  const toggleAmenity = (amenity: string) =>
    setAmenities((prev) =>
      prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity],
    );

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
          accessibilityLabel="Discard and go back"
          style={styles.iconButton}
        >
          <Ionicons name="close" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit listing</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.screen, paddingBottom: insets.bottom + 120 }}
      >
        {/* Photos */}
        <Text style={styles.sectionTitle}>Photos</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoRow}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a photo"
            style={styles.addPhoto}
          >
            <Ionicons name="camera-outline" size={22} color={colors.accent} />
            <Text style={styles.addPhotoLabel}>Add photo</Text>
          </Pressable>
          <Photo
            categoryId={categoryId}
            seed={business.id}
            uri={business.photos[0]}
            style={styles.photo}
            radius={radii.lg}
          />
          <Photo
            categoryId={categoryId}
            seed={`${business.id}-2`}
            uri={business.photos[1]}
            style={styles.photo}
            radius={radii.lg}
          />
        </ScrollView>

        {/* Basics */}
        <Text style={styles.sectionTitle}>Basics</Text>
        <View style={styles.group}>
          <Field
            label="Business name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. JW Coffee House"
            error={nameError}
          />
          <Field
            label="Category"
            value={categoryOf(categoryId).label}
            select
            onPress={() => setCategoryOpen(true)}
          />
          <Field
            label="Short description"
            value={tagline}
            onChangeText={setTagline}
            placeholder="e.g. Neighbourhood espresso bar"
            hint="One line, shown under your name in search results"
          />
          <Field
            label="About"
            value={description}
            onChangeText={setDescription}
            placeholder="What should someone know before they visit?"
            multiline
          />
        </View>

        {/* Contact */}
        <Text style={styles.sectionTitle}>Contact & location</Text>
        <View style={styles.group}>
          <Field
            label="Address"
            value={address}
            onChangeText={setAddress}
            placeholder="Street, area"
          />
          <Field
            label="Phone"
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
          />
        </View>

        {/* Pricing */}
        <Text style={styles.sectionTitle}>Typical spend</Text>
        <View style={styles.group}>
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
        </View>

        {/* Hours */}
        <Text style={styles.sectionTitle}>Opening hours</Text>
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

        {/* Amenities */}
        <Text style={styles.sectionTitle}>Amenities</Text>
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
      </ScrollView>

      {/* Save bar */}
      <View style={[styles.saveBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label={saved ? 'Saved' : 'Save changes'}
          icon={saved ? 'checkmark' : undefined}
          onPress={onSave}
          disabled={!canSave}
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
          <Text style={styles.sheetTitle}>Category</Text>
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
                  color={colors.textSecondary}
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

const AMENITY_OPTIONS = [
  'Free wifi',
  'Parking',
  'Card payments',
  'M-Pesa',
  'Outdoor seating',
  'Wheelchair access',
  'Takeaway',
  'Delivery',
  'Air conditioning',
  'Reservations',
  'Vegetarian options',
  'Family friendly',
];

function emptyWeek(): WeekHours {
  return [null, null, null, null, null, null, null];
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  centered: { justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.canvas,
  },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.cardTitle, color: colors.textPrimary, flex: 1, textAlign: 'center' },

  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  group: { gap: spacing.lg, marginBottom: spacing.xxl },

  photoRow: { gap: spacing.md, paddingBottom: spacing.xxl },
  photo: { width: 110, height: 90 },
  addPhoto: {
    width: 110,
    height: 90,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  addPhotoLabel: { ...typography.caption, color: colors.accentPressed, fontWeight: '600' },

  priceRow: { flexDirection: 'row', gap: spacing.md },
  priceField: { flex: 1 },

  hoursCard: { paddingVertical: spacing.xs, marginBottom: spacing.xxl },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  hourDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  hourDay: { ...typography.body, color: colors.textPrimary, width: 88 },
  hourValue: { ...typography.meta, color: colors.textSecondary, flex: 1 },

  amenityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg - 2,
    paddingVertical: spacing.sm + 1,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amenityChipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  amenityLabel: { ...typography.meta, color: colors.textPrimary },
  amenityLabelSelected: { color: colors.textOnAccent, fontWeight: '600' },

  saveBar: {
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
