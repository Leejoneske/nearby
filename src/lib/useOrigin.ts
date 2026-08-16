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

export function useOrigin(): OriginState & { refresh: () => void } {
  const [state, setState] = useState<OriginState>(FALLBACK);
  const asked = useRef(false);

  const locate = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        // A refusal is an answer, not a failure. Keep the fallback.
        setState((prev) => ({ ...prev, ready: true }));
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
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
