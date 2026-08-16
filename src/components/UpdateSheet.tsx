/**
 * "There is a newer version."
 *
 * Never mandatory. Somebody who opened the app to find a plumber has not
 * agreed to a 45 MB download first, and a wall they cannot dismiss is how an
 * app gets deleted. Declining means "not this one" — the version is
 * remembered, and the next one asks again.
 */
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useScreenInsets } from '../lib/insets';
import { formatSize, type Release } from '../lib/updates';
import { colors, radii, spacing, tones, typography } from '../theme/tokens';
import { Button } from './Button';

export type UpdateState =
  | { phase: 'offer' }
  | { phase: 'downloading'; progress: number }
  | { phase: 'installing' }
  | { phase: 'failed' };

export function UpdateSheet({
  visible,
  release,
  state,
  canInstallHere,
  onInstall,
  onDismiss,
}: {
  visible: boolean;
  release: Release | null;
  state: UpdateState;
  /** False on a store build, where the store owns installation. */
  canInstallHere: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}) {
  const insets = useScreenInsets();
  if (!release) return null;

  const size = formatSize(release.sizeBytes);
  const busy = state.phase === 'downloading' || state.phase === 'installing';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      // Dismissible with the back gesture, deliberately — unless a download
      // is already running, where leaving mid-way just wastes it.
      onRequestClose={busy ? () => {} : onDismiss}
    >
      <Pressable
        style={styles.backdrop}
        onPress={busy ? undefined : onDismiss}
        accessibilityLabel="Close"
      />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.grabber} />

        <View style={styles.icon}>
          <Ionicons name="arrow-down-circle" size={26} color={tones.green.fg} />
        </View>

        <Text style={styles.title}>A new version is ready</Text>
        <Text style={styles.body}>
          {canInstallHere
            ? `Version ${release.version}${size ? ` · ${size}` : ''}. It takes a moment and you can keep using the app until it is done.`
            : `Version ${release.version} is available.`}
        </Text>

        {state.phase === 'downloading' ? (
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(state.progress * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressLabel}>
              {Math.round(state.progress * 100)}% downloaded
            </Text>
          </View>
        ) : null}

        {state.phase === 'installing' ? (
          <Text style={styles.note}>
            Your phone will ask you to confirm the install. That is normal.
          </Text>
        ) : null}

        {state.phase === 'failed' ? (
          <Text style={styles.failure}>
            That did not finish. Check your connection and try again.
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            label={
              state.phase === 'failed'
                ? 'Try again'
                : canInstallHere
                  ? 'Update now'
                  : 'Open the store'
            }
            loading={busy}
            onPress={onInstall}
          />
          {busy ? null : (
            <Button label="Not now" variant="ghost" size="md" onPress={onDismiss} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.lg,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: tones.green.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { ...typography.sectionTitle, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  note: { ...typography.meta, color: colors.textSecondary, marginTop: spacing.md },
  failure: { ...typography.meta, color: colors.danger, marginTop: spacing.md },

  progressWrap: { marginTop: spacing.lg, gap: spacing.xs },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  progressLabel: { ...typography.caption, color: colors.textTertiary },

  actions: { gap: spacing.sm, marginTop: spacing.xl },
});
