/**
 * Whether this build can draw a real map.
 *
 * Android's Maps SDK needs an API key. Without one it does not fail loudly —
 * it renders a blank grey rectangle with a watermark in the corner, which is
 * indistinguishable from a map that failed to load, and is exactly what
 * shipped in an earlier build.
 *
 * iOS uses Apple Maps through `PROVIDER_DEFAULT`, which needs no key at all,
 * so it always has a real map.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function hasRealMap(): boolean {
  if (Platform.OS === 'ios') return true;
  if (Platform.OS !== 'android') return false;

  const key = (
    Constants.expoConfig?.android as { config?: { googleMaps?: { apiKey?: string } } } | undefined
  )?.config?.googleMaps?.apiKey;

  return typeof key === 'string' && key.trim().length > 0;
}
