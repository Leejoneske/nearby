/**
 * Where the app is looking from.
 *
 * Asks the device once, and falls back to the city centre for the two cases
 * that are not errors: the person said no, and the platform cannot answer.
 * Neither should produce a broken screen — a directory that shows nothing
 * because it could not place you is worse than one that measures from town.
 *
 * The permission is only ever requested once per launch. Asking again after a
 * refusal is how an app gets uninstalled.
 */
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import { DEFAULT_AREA, DEFAULT_CITY, DEFAULT_ORIGIN } from '../data/location';

export type Origin = { lat: number; lng: number };

export type OriginState = {
  origin: Origin;
  /** False while the device is still being asked. */
  ready: boolean;
  /** True once a real fix replaced the fallback. */
  precise: boolean;
  city: string;
  area: string;
};

const FALLBACK: OriginState = {
  origin: DEFAULT_ORIGIN,
  ready: false,
  precise: false,
  city: DEFAULT_CITY,
  area: DEFAULT_AREA,
};

/** "Westlands, Nairobi" from whatever the reverse lookup gives back. */
export function describePlace(
  place: { district?: string | null; subregion?: string | null; city?: string | null; region?: string | null } | undefined,
  fallbackCity: string,
  fallbackArea: string,
): { city: string; area: string } {
  if (!place) return { city: fallbackCity, area: fallbackArea };

  const city = place.city || place.subregion || place.region || fallbackCity;
  // District is the neighbourhood on most providers; subregion is the next
  // step out. Either is more useful than repeating the city twice.
  const neighbourhood = place.district || place.subregion || null;

  return {
    city,
    area: neighbourhood && neighbourhood !== city ? `${neighbourhood}, ${city}` : city,
  };
}

/*
 * Nothing here is allowed to hang.
 *
 * `ready` is what releases the first load, so a location call that never
 * settles leaves the whole app on its loading skeletons for ever. That is not
 * hypothetical: a headless browser never answers the permission prompt at
 * all, and a phone with a confused location service can do the same. Both now
 * fall through to the city after a few seconds, which is exactly the state a
 * refusal produces and which the app already handles.
 */
const PERMISSION_TIMEOUT_MS = 8_000;
const FIX_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(fallback), ms);
    promise.then(finish, () => finish(fallback));
  });
}

export function useOrigin(): OriginState & { refresh: () => void } {
  const [state, setState] = useState<OriginState>(FALLBACK);
  const asked = useRef(false);

  const locate = useCallback(async () => {
    try {
      // null stands for "never answered", which is treated the same as a no.
      const permission = await withTimeout(
        Location.requestForegroundPermissionsAsync(),
        PERMISSION_TIMEOUT_MS,
        null,
      );
      const status = permission?.status;
      if (status !== Location.PermissionStatus.GRANTED) {
        // A refusal is an answer, not a failure. Keep the fallback.
        setState((prev) => ({ ...prev, ready: true }));
        return;
      }

      const position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        FIX_TIMEOUT_MS,
        null,
      );
      if (!position) {
        // A fix that never arrives is the same as no fix.
        setState((prev) => ({ ...prev, ready: true }));
        return;
      }
      const origin = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      setState({ origin, ready: true, precise: true, city: DEFAULT_CITY, area: DEFAULT_AREA });

      // Naming the place is a nicety; failing to name it must not undo the fix.
      try {
        const [place] = await Location.reverseGeocodeAsync({
          latitude: origin.lat,
          longitude: origin.lng,
        });
        const named = describePlace(place, DEFAULT_CITY, DEFAULT_AREA);
        setState((prev) => ({ ...prev, ...named }));
      } catch {
        // Keep the coordinates and the default name.
      }
    } catch (e) {
      console.warn('[location] could not read a position', e);
      setState((prev) => ({ ...prev, ready: true }));
    }
  }, []);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void locate();
  }, [locate]);

  const refresh = useCallback(() => {
    void locate();
  }, [locate]);

  return { ...state, refresh };
}
