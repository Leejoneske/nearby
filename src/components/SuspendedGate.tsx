/**
 * What somebody sees when their account has been suspended.
 *
 * The session has already been ended by the time this appears — a token
 * issued before the suspension would otherwise keep working until it expired,
 * and letting somebody wander a half-working app finding every action refused
 * is worse than telling them plainly.
 *
 * It says why when there is a reason. A refusal that does not say what
 * happened is one nobody can do anything about, and the person on the other
 * end of it is usually somebody who has no idea what they did.
 */
import { Ionicons } from '@expo/vector-icons';
import { Modal, Text, View } from 'react-native';

import { useStore } from '../lib/store';
import { radii, spacing, typography } from '../theme/tokens';
import { makeStyles, useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';

export function SuspendedGate() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { suspension, clearSuspension } = useStore();
  if (suspension === null) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={clearSuspension}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <Ionicons name="lock-closed" size={28} color={colors.danger} />
          </View>

          <Text style={styles.title}>Your account is suspended</Text>
          <Text style={styles.body}>
            You have been signed out, and your listings and reviews are hidden while
            this is in place. Nothing has been deleted.
          </Text>

          {suspension ? (
            <View style={styles.reason}>
              <Text style={styles.reasonLabel}>Why</Text>
              <Text style={styles.reasonText}>{suspension}</Text>
            </View>
          ) : null}

          <Text style={styles.footnote}>
            If you think this is a mistake, get in touch and we will look at it again.
          </Text>

          <Button label="Close" onPress={clearSuspension} />
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors, tones) => ({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.screen,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    padding: spacing.xxl,
    gap: spacing.md,
    width: '100%',
    maxWidth: 420,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: { ...typography.title, color: colors.textPrimary, textAlign: 'center' },
  body: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  reason: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  reasonLabel: { ...typography.metaStrong, color: colors.textSecondary },
  reasonText: { ...typography.meta, color: colors.textPrimary },
  footnote: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
}));
