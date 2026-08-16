/**
 * Drives the update prompt: when to look, when to ask, what happens next.
 *
 * The check is quiet. It runs once a day at most, never blocks anything, and
 * a failure is silence rather than an error — somebody who opened the app to
 * find a coffee shop does not need to hear that a version lookup timed out.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { UpdateState } from '../components/UpdateSheet';
import { channel, checkForUpdate, downloadAndInstall, openStore } from './updateService';
import { shouldCheck, wasDismissed, type Release } from './updates';

const LAST_CHECK = 'nearby.updateCheckedAt.v1';
const DISMISSED = 'nearby.updateDismissed.v1';

export function useUpdatePrompt() {
  const [release, setRelease] = useState<Release | null>(null);
  const [canInstallHere, setCanInstallHere] = useState(false);
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<UpdateState>({ phase: 'offer' });

  // One check per launch, whatever else re-renders.
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;

    let alive = true;

    (async () => {
      try {
        const [lastRaw, dismissed] = await Promise.all([
          AsyncStorage.getItem(LAST_CHECK),
          AsyncStorage.getItem(DISMISSED),
        ]);

        const last = lastRaw ? Number.parseInt(lastRaw, 10) : null;
        if (!shouldCheck(Number.isFinite(last as number) ? last : null, Date.now())) return;

        const decision = await checkForUpdate();
        // Record the attempt either way, so a run of failures does not turn
        // into a request on every single launch.
        await AsyncStorage.setItem(LAST_CHECK, String(Date.now()));

        if (!alive || decision.kind === 'current') return;
        if (wasDismissed(dismissed, decision.release)) return;

        setRelease(decision.release);
        setCanInstallHere(decision.kind === 'download');
        setVisible(true);
      } catch (e) {
        console.warn('[updates] the check could not run', e);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (release) {
      void AsyncStorage.setItem(DISMISSED, release.version).catch(() => {});
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
    /** Where this build came from, for the settings row. */
    channel: channel(),
  };
}
