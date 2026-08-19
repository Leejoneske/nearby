/**
 * Sends somebody to the name step once, when we find we do not have one.
 *
 * It lives over the whole app rather than at the end of the sign in flow so
 * that accounts made before the name step existed reach it too. The route is
 * pushed, not replaced, so the screen they were on is still behind it.
 */
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useStore } from '../lib/store';

export function NameGate() {
  const router = useRouter();
  const { needsName } = useStore();
  const asked = useRef(false);

  useEffect(() => {
    if (!needsName) {
      asked.current = false;
      return;
    }
    if (asked.current) return;
    asked.current = true;
    router.push('/(auth)/welcome');
  }, [needsName, router]);

  return null;
}
