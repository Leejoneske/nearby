/**
 * Drives the update prompt: when to look, when to ask, what happens next.
 *
 * The automatic check is quiet. It runs at most once every few hours, never
 * blocks anything, and a failure is silence rather than an error — somebody
 * who opened the app to find a coffee shop does not need to hear that a
 * version lookup timed out.
 *
 * `checkNow` is the opposite and is meant to be: somebody who taps "Check for
 * updates" is owed an answer, including "you are on the latest one", and it
 * ignores both the interval and any earlier dismissal.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { UpdateState } from '../components/UpdateSheet';
import { channel, checkForUpdate, downloadAndInstall, openStore } from './updateService';
import {
  parseDismissed,
  serialiseDismissed,
  shouldCheck,
  wasDismissed,
  type Release,
} from './updates';

const LAST_CHECK = 'nearby.updateCheckedAt.v1';
const DISMISSED = 'nearby.updateDismissed.v1';

type Offer = { release: Release; canInstallHere: boolean };

export type ManualCheck =
  | { kind: 'checking' }
  | { kind: 'current' }
  | { kind: 'available' }
  | { kind: 'failed' };

export function useUpdatePrompt() {
  const [release, setRelease] = useState<Release | null>(null);
  const [canInstallHere, setCanInstallHere] = useState(false);
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<UpdateState>({ phase: 'offer' });
  const [manual, setManual] = useState<ManualCheck | null>(null);

  /** Stops two checks overlapping, whatever triggered them. */
  const running = useRef(false);

  /**
   * Looks, and reports. Deliberately sets no state of its own.
   *
   * Its callers apply the result after their own await, which is the shape
   * the hooks rules want and, more usefully, keeps "what did we find" apart
   * from "what should the screen do about it".
   */
  const look = useCallback(
    async (
      forced: boolean,
      coldStart = false,
    ): Promise<{ manual: ManualCheck; offer: Offer | null }> => {
      if (running.current) return { manual: { kind: 'checking' }, offer: null };
      running.current = true;

      try {
        const [lastRaw, dismissedRaw] = await Promise.all([
          AsyncStorage.getItem(LAST_CHECK),
          AsyncStorage.getItem(DISMISSED),
        ]);

        const last = lastRaw ? Number.parseInt(lastRaw, 10) : null;
        if (
          !forced &&
          !shouldCheck(Number.isFinite(last as number) ? last : null, Date.now(), coldStart)
        ) {
          return { manual: { kind: 'current' }, offer: null };
        }

        const decision = await checkForUpdate();
        // Record the attempt either way, so a run of failures does not turn
        // into a request on every single launch.
        await AsyncStorage.setItem(LAST_CHECK, String(Date.now()));

        if (decision.kind === 'current') return { manual: { kind: 'current' }, offer: null };

        // A dismissal means "not this one". Asking again is exactly what
        // somebody who tapped Check for updates wants.
        if (!forced && wasDismissed(parseDismissed(dismissedRaw), decision.release)) {
          return { manual: { kind: 'current' }, offer: null };
        }

        return {
          manual: { kind: 'available' },
          offer: { release: decision.release, canInstallHere: decision.kind === 'download' },
        };
      } catch (e) {
        console.warn('[updates] the check could not run', e);
        return { manual: { kind: 'failed' }, offer: null };
      } finally {
        running.current = false;
      }
    },
    [],
  );

  const offer = useCallback((found: Offer) => {
    setRelease(found.release);
    setCanInstallHere(found.canInstallHere);
    setState({ phase: 'offer' });
    setVisible(true);
  }, []);

  /*
   * On launch, and again whenever the app comes back to the front after long
   * enough. Coming back is when somebody has just been told about a new
   * version somewhere else, which is the moment the old once-a-day check
   * most often missed.
   */
  useEffect(() => {
    let alive = true;

    const check = async (coldStart: boolean) => {
      const { offer: found } = await look(false, coldStart);
      if (alive && found) offer(found);
    };

    // Opening the app is the moment to be told, so it always looks.
    void check(true);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void check(false);
    });

    return () => {
      alive = false;
      sub.remove();
    };
  }, [look, offer]);

  const checkNow = useCallback(async () => {
    const { manual: outcome, offer: found } = await look(true);
    if (found) offer(found);
    setManual(outcome);
  }, [look, offer]);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (release) {
      void AsyncStorage.setItem(DISMISSED, serialiseDismissed(release)).catch(() => {});
    }
  }, [release]);

  const install = useCallback(async () => {
    if (!release) return;

    if (!canInstallHere) {
      await openStore();
      setVisible(false);
      return;
    }

    setState({ phase: 'downloading', progress: 0 });
    try {
      await downloadAndInstall(release, (progress) =>
        setState({ phase: 'downloading', progress }),
      );
      // Android's installer is now in front of the app. Leaving the sheet on
      // "installing" means that if they back out, the button is still here.
      setState({ phase: 'installing' });
    } catch (e) {
      console.warn('[updates] the install failed', e);
      setState({ phase: 'failed' });
    }
  }, [release, canInstallHere]);

  return {
    release,
    visible,
    state,
    canInstallHere,
    install: () => void install(),
    dismiss,
    /** What a manual check found, or null if nobody has asked. */
    manual,
    checkNow: () => void checkNow(),
    /** Where this build came from, for the settings row. */
    channel: channel(),
  };
}
