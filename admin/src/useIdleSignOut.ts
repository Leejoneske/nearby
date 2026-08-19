/**
 * Closes the console when nobody is at the keyboard.
 *
 * The decision lives in `lib.ts` and is tested there. This is the wiring:
 * what counts as activity, how often the clock is read, and the countdown the
 * banner shows.
 *
 * Deliberately not a timer per event. Listeners record a timestamp — cheap
 * enough to hang off `mousemove` — and one interval reads it. Resetting a
 * `setTimeout` on every pointer move is thousands of timers a minute.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { IDLE_LIMIT_MS, idleVerdict, secondsLeft, type IdleVerdict } from './lib';

const WATCHED = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'focus'] as const;

export function useIdleSignOut(active: boolean, onExpire: () => void) {
  // Zero rather than `Date.now()`: reading the clock while rendering is not
  // idempotent, and the effect below stamps it before anything reads it.
  const lastActive = useRef(0);
  const [verdict, setVerdict] = useState<IdleVerdict>('active');
  const [left, setLeft] = useState(Math.round(IDLE_LIMIT_MS / 1000));
  const expired = useRef(false);

  const stayIn = useCallback(() => {
    lastActive.current = Date.now();
    expired.current = false;
    setVerdict('active');
  }, []);

  useEffect(() => {
    if (!active) return;

    lastActive.current = Date.now();

    const touch = () => {
      // Once the session is gone, moving the mouse must not bring it back.
      if (expired.current) return;
      lastActive.current = Date.now();
    };

    for (const event of WATCHED) window.addEventListener(event, touch, { passive: true });

    const tick = window.setInterval(() => {
      const now = Date.now();
      const next = idleVerdict(lastActive.current, now);
      setVerdict(next);
      setLeft(secondsLeft(lastActive.current, now));
      if (next === 'expired' && !expired.current) {
        expired.current = true;
        onExpire();
      }
    }, 1000);

    return () => {
      for (const event of WATCHED) window.removeEventListener(event, touch);
      window.clearInterval(tick);
    };
  }, [active, onExpire]);

  return { verdict, secondsLeft: left, stayIn };
}
