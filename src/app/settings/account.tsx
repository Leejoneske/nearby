/**
 * Account and sessions.
 *
 * Two things somebody should be able to see about their own account without
 * asking anybody: what is signed in to it, and how to be rid of it. Deleting
 * used to live at the bottom of the profile editor, underneath the name and
 * area fields, which is a strange place to find the end of an account — you
 * went there to change your name.
 *
 * The device list is the same data the fraud rules read. Showing it to the
 * person it is about is the right way round: it is theirs before it is our
 * signal, and it is the only way somebody notices a sign-in they did not
 * make.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Card, EmptyState } from '../../components/primitives';
import * as api from '../../lib/api';
import { deviceFingerprint } from '../../lib/deviceId';
import { looksBusy, placeLabel, prettyPlatform, sortDevices } from '../../lib/devices';
import { formatRelativeDate } from '../../lib/format';
import { useScreenInsets } from '../../lib/insets';
import { useStore } from '../../lib/store';
import { radii, spacing, typography } from '../../theme/tokens';
import { makeStyles, useTheme } from '../../theme/ThemeProvider';

export default function AccountScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useScreenInsets();
  const { session, ownedBusinesses, deleteAccount } = useStore();

  const [devices, setDevices] = useState<api.KnownDevice[] | null>(null);
  const [thisDevice, setThisDevice] = useState<string | null>(null);
  const [current, setCurrent] = useState<api.CurrentSession | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const [reason, setReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signedIn = session.status === 'signedIn';
  const now = new Date();

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;

    (async () => {
      const [mine, rows, live] = await Promise.all([
        deviceFingerprint().catch(() => ''),
        api.fetchMyDevices().catch(() => null),
        api.fetchCurrentSession().catch(() => null),
      ]);
      if (!alive) return;
      setThisDevice(mine || null);
      setDevices(rows ?? []);
      setCurrent(live);
      setLoadFailed(rows === null);
    })();

    return () => {
      alive = false;
    };
  }, [signedIn]);

  /*
   * Deleting, with the consequences said out loud first and twice.
   *
   * This removes reviews other people can no longer read and listings that
   * name real businesses, none of which can be recovered and none of which
   * can be handed to anybody else — there is no claim flow. A single "are you
   * sure" is not enough warning for something with no undo.
   */
  const confirmDelete = () => {
    const listings = ownedBusinesses.length;
    const detail = [
      'Your name, email and picture go, along with every review you have written.',
      listings > 0
        ? `Your ${listings} ${listings === 1 ? 'listing' : 'listings'} will be removed too, with the reviews on them. Nobody else can take them over.`
        : null,
      'None of it can be brought back.',
    ]
      .filter(Boolean)
      .join('\n\n');

    Alert.alert('Delete your account?', detail, [
      { text: 'Keep my account', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Last chance', 'This cannot be undone. Delete everything now?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete everything', style: 'destructive', onPress: () => void remove() },
          ]),
      },
    ]);
  };

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount(reason);
      router.replace('/(tabs)');
    } catch (e) {
      setError(
        e instanceof Error && e.message.trim()
          ? e.message
          : 'We could not delete your account just now. Try again.',
      );
      setDeleting(false);
    }
  };

  const ordered = devices ? sortDevices(devices, thisDevice) : [];

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.iconButton}
        >
          <Ionicons name="arrow-back" size={21} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Account and sessions</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: spacing.screen,
          paddingBottom: insets.bottom + spacing.huge,
        }}
      >
        {!signedIn ? (
          <EmptyState
            icon="person-circle-outline"
            title="Not signed in"
            body="Sign in to see what has been into your account."
          />
        ) : (
          <>
            {/* This session */}
            <Text style={styles.sectionTitle}>You are signed in now</Text>
            <Card style={styles.card}>
              <Line label="Account" value={session.email ?? 'Not recorded'} />
              <Line
                label="Signed in"
                value={
                  current?.signedInAt
                    ? formatRelativeDate(current.signedInAt, now)
                    : 'This session'
                }
              />
              <Line
                label="This device"
                value={devices === null ? 'Checking' : platformOfThis(ordered, thisDevice)}
                last
              />
              <Text style={styles.note}>
                Signing out on this device ends this session. It does not touch the
                others.
              </Text>
            </Card>

            {/* Everything that has signed in */}
            <Text style={styles.sectionTitle}>Devices on this account</Text>

            {devices === null ? (
              <Card style={styles.card}>
                <Text style={styles.note}>Checking</Text>
              </Card>
            ) : loadFailed ? (
              <Card style={styles.card}>
                <Text style={styles.note}>
                  We could not load this just now. It is safe to try again later.
                </Text>
              </Card>
            ) : ordered.length === 0 ? (
              <Card style={styles.card}>
                <Text style={styles.note}>
                  Nothing recorded yet. This fills in the next time you open the app.
                </Text>
              </Card>
            ) : (
              <>
                {looksBusy(ordered) ? (
                  <View style={styles.busy}>
                    <Ionicons name="information-circle" size={17} color={colors.textSecondary} />
                    <Text style={styles.busyText}>
                      {ordered.length} devices have signed in. If any of these are not
                      yours, change your email password and get in touch.
                    </Text>
                  </View>
                ) : null}

                {ordered.map((device) => {
                  const mine = device.fingerprint === thisDevice;
                  return (
                    <Card key={device.fingerprint} style={styles.card}>
                      <View style={styles.deviceHead}>
                        <Ionicons
                          name={mine ? 'phone-portrait' : 'phone-portrait-outline'}
                          size={19}
                          color={mine ? colors.accent : colors.textSecondary}
                        />
                        <Text style={styles.deviceName}>{prettyPlatform(device.platform)}</Text>
                        {mine ? <Text style={styles.thisOne}>This device</Text> : null}
                      </View>
                      <Line label="Last used" value={formatRelativeDate(device.lastSeen, now)} />
                      <Line label="First seen" value={formatRelativeDate(device.firstSeen, now)} />
                      <Line label="Around" value={placeLabel(device)} />
                      <Line
                        label="Times opened"
                        value={String(device.seenCount)}
                        last
                      />
                    </Card>
                  );
                })}

                <Text style={styles.footnote}>
                  Positions are rounded to about a kilometre, so this can tell you a
                  town and never a street. We do not keep addresses of the machines
                  that sign in.
                </Text>
              </>
            )}

            {/* Deleting */}
            <Text style={styles.sectionTitle}>Delete your account</Text>
            <Card style={styles.card}>
              <Text style={styles.note}>
                Removes your account and everything on it, for good. If you only want a
                break, signing out leaves it all where it is.
              </Text>
              <View style={styles.reason}>
                <Field
                  label="Why are you leaving?"
                  value={reason}
                  onChangeText={setReason}
                  placeholder="What did not work for you"
                  multiline
                  hint="Optional. Kept without your name on it, so it tells us what to fix and nothing about you."
                />
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button
                label="Delete my account"
                variant="danger"
                size="md"
                loading={deleting}
                onPress={confirmDelete}
              />
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** What the phone in your hand is, once the list has arrived. */
function platformOfThis(rows: api.KnownDevice[], fingerprint: string | null): string {
  const mine = rows.find((row) => row.fingerprint === fingerprint);
  return mine ? prettyPlatform(mine.platform) : 'Not recorded yet';
}

function Line({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.line, last && styles.lineLast]}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.canvas },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    ...typography.cardTitle,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },

  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  card: { gap: 0, marginBottom: spacing.md },

  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.sm + 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lineLast: { borderBottomWidth: 0 },
  lineLabel: { ...typography.meta, color: colors.textSecondary },
  lineValue: { ...typography.metaStrong, color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },

  note: { ...typography.meta, color: colors.textSecondary, paddingTop: spacing.sm },
  footnote: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },

  busy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  busyText: { ...typography.meta, color: colors.textSecondary, flex: 1 },

  deviceHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  deviceName: { ...typography.cardTitle, color: colors.textPrimary, flex: 1 },
  thisOne: { ...typography.caption, color: colors.accent, fontWeight: '700' },

  reason: { paddingTop: spacing.lg, paddingBottom: spacing.md },
  error: { ...typography.meta, color: colors.danger, paddingBottom: spacing.sm },
}));
