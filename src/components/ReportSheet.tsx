/**
 * "Report this listing".
 *
 * Without this the moderation queue is empty by construction — somebody has
 * to be able to say a listing is wrong before anybody can act on it.
 *
 * The reasons are fixed rather than a free-text box. A queue of prose takes
 * longer to triage than it takes to write, and a person deciding between five
 * named problems gives a far more useful answer than one staring at "tell us
 * what is wrong".
 *
 * No account needed, and the sheet says so. The people most likely to notice
 * that a listing is a fake or a business that closed two years ago are the
 * people walking past it, and most of them are not signed in.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useScreenInsets } from '../lib/insets';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { Button } from './Button';

export const REASONS = [
  'It has closed down',
  'The details are wrong',
  'It is not a real business',
  'The photos are wrong or offensive',
  'It is a duplicate of another listing',
  'Something else',
] as const;

export function ReportSheet({
  visible,
  subject,
  signedIn,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  /** What is being reported, for the title. */
  subject: string;
  /** Only changes what the sheet says. Either way the report is sent. */
  signedIn?: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const insets = useScreenInsets();
  const [chosen, setChosen] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const close = () => {
    setChosen(null);
    setFailure(null);
    setDone(false);
    onClose();
  };

  const send = async () => {
    if (!chosen || sending) return;
    setSending(true);
    setFailure(null);
    try {
      await onSubmit(chosen);
      setDone(true);
    } catch (e) {
      console.warn('[report] the write was refused', e);
      setFailure('We could not send that just now. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.grabber} />

        {done ? (
          <View style={styles.done}>
            <Ionicons name="checkmark-circle" size={40} color={colors.success} />
            <Text style={styles.doneTitle}>Thank you</Text>
            <Text style={styles.doneBody}>
              We will take a look. You will not hear back about every report, but
              they are all read.
            </Text>
            <Button label="Done" onPress={close} />
          </View>
        ) : (
          <>
            <Text style={styles.title}>Report {subject}</Text>
            <Text style={styles.body}>What is wrong with it?</Text>
            <Text style={styles.privacy}>
              {signedIn
                ? 'Sent with your account, so we can come back to you if we need to.'
                : 'Sent anonymously. Nothing about you goes with it, and you do not need an account.'}
            </Text>

            <ScrollView style={styles.list}>
              {REASONS.map((reason, index) => (
                <Pressable
                  key={reason}
                  onPress={() => setChosen(reason)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: chosen === reason }}
                  style={[styles.option, index < REASONS.length - 1 && styles.divider]}
                >
                  <Ionicons
                    name={chosen === reason ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={chosen === reason ? colors.accent : colors.borderStrong}
                  />
                  <Text style={styles.optionLabel}>{reason}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {failure ? <Text style={styles.failure}>{failure}</Text> : null}

            <View style={styles.actions}>
              <Button
                label="Send report"
                disabled={!chosen}
                loading={sending}
                onPress={send}
              />
              <Button label="Cancel" variant="ghost" size="md" onPress={close} />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  privacy: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    maxHeight: '82%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.lg,
  },
  title: { ...typography.sectionTitle, color: colors.textPrimary },
  body: { ...typography.meta, color: colors.textSecondary, marginTop: 2 },
  list: { flexGrow: 0, marginTop: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg - 2,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
  failure: { ...typography.meta, color: colors.danger, marginTop: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.lg },

  done: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  doneTitle: { ...typography.sectionTitle, color: colors.textPrimary },
  doneBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
