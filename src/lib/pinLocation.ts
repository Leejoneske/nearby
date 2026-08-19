/**
 * Taking a pin from the device, for the person listing a business.
 *
 * Separate from `useOrigin`, which answers "where is the person looking
 * from" and is allowed to fall back to the centre of town. A pin is not
 * allowed to do that. A listing placed at the city centre because the fix
 * timed out is worse than one with no pin at all: it sends people to the
 * wrong street and looks deliberate.
 *
 * So this returns a fix or it returns a reason, and never a guess.
 */
import * as Location from 'expo-location';

import { DEFAULT_AREA, DEFAULT_CITY } from '../data/location';
import { describePlace } from './useOrigin';

export type Pin = {
  lat: number;
  lng: number;
  /** Metres, when the platform says. Undefined when it does not. */
  accuracyM?: number;
  /** "Westlands, Nairobi", for filling in the area field. */
  area?: string;
};

export type PinResult =
  | { ok: true; pin: Pin }
  | { ok: false; reason: string };

const FIX_TIMEOUT_MS = 15_000;

/**
 * A fix good enough to put on a map, or a sentence saying why not.
 *
 * The accuracy is asked for at the highest the device will give, because this
 * runs once, deliberately, while somebody stands outside their own shop —
 * which is the one moment in the app where a slow, precise answer beats a
 * fast, vague one.
 */
export async function capturePin(): Promise<PinResult> {
  let permission;
  try {
    permission = await Location.requestForegroundPermissionsAsync();
  } catch (e) {
    console.warn('[pin] asking for permission failed', e);
    return { ok: false, reason: 'We could not reach the location service on this device.' };
  }

  if (permission.status !== Location.PermissionStatus.GRANTED) {
    return {
      ok: false,
      reason: permission.canAskAgain
        ? 'We need permission to read your location.'
        : 'Location is turned off for Nearby. You can turn it back on in Settings.',
    };
  }

  let position: Location.LocationObject | null = null;
  try {
    position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
    ]);
  } catch (e) {
    console.warn('[pin] the fix failed', e);
  }

  if (!position) {
    return {
      ok: false,
      reason: 'We could not get a fix. Step outside or try again in a moment.',
    };
  }

  const pin: Pin = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracyM:
      typeof position.coords.accuracy === 'number' && position.coords.accuracy > 0
        ? Math.round(position.coords.accuracy)
        : undefined,
  };

  // Naming the place is a nicety. Failing to name it must not lose the fix.
  try {
    const [place] = await Location.reverseGeocodeAsync({
      latitude: pin.lat,
      longitude: pin.lng,
    });
    pin.area = describePlace(place, DEFAULT_CITY, DEFAULT_AREA).area;
  } catch {
    // Keep the coordinates.
  }

  return { ok: true, pin };
}

/** "Pinned, accurate to about 12 m" — or just "Pinned" when it did not say. */
export function describePin(pin: Pin): string {
  if (pin.accuracyM === undefined) return 'Pinned to where you are now';
  return `Pinned to where you are now, accurate to about ${pin.accuracyM} m`;
}
