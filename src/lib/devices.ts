/**
 * Turning device rows into something a person can read.
 *
 * These rows exist because one phone signing in as ten accounts is the only
 * reliable sign of a ring. Shown to the person they belong to, they answer a
 * different and more ordinary question: what has been into my account, and
 * from roughly where.
 *
 * Everything here is a pure function of a row, so what the screen says can be
 * tested without a database and without a phone.
 */

export type DeviceRow = {
  fingerprint: string;
  platform: string;
  country: string;
  lat: number | null;
  lng: number | null;
  firstSeen: string;
  lastSeen: string;
  seenCount: number;
};

/*
 * Android reports an API level, not the version people know.
 *
 * "android 34" is Android 14, and telling somebody their phone is "Android
 * 34" is telling them a number from our world rather than theirs. Only the
 * levels that are actually out there; anything newer or older falls through
 * to the raw value, which is wrong-looking but never a lie.
 */
const ANDROID_RELEASE: Record<string, string> = {
  '28': '9',
  '29': '10',
  '30': '11',
  '31': '12',
  '32': '12L',
  '33': '13',
  '34': '14',
  '35': '15',
  '36': '16',
};

/** "android 34" becomes "Android 14"; "ios 18.2" becomes "iOS 18.2". */
export function prettyPlatform(platform: string): string {
  const text = platform.trim();
  if (!text) return 'Unknown device';

  const [name, ...rest] = text.split(/\s+/);
  const version = rest.join(' ');
  const family = name.toLowerCase();

  if (family === 'android') {
    const release = ANDROID_RELEASE[version];
    return release ? `Android ${release}` : version ? `Android ${version}` : 'Android';
  }
  if (family === 'ios' || family === 'ipados') {
    return version ? `iOS ${version}` : 'iPhone or iPad';
  }
  if (family === 'web') return 'A web browser';

  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Roughly where a sign-in came from.
 *
 * The position was rounded to two decimal places before it was ever stored —
 * about a kilometre — so this can say "around here" and cannot say which
 * building. That is the whole point: enough to notice a sign-in from a
 * country you have never visited, not enough to be a log of somebody's
 * movements that we would then have to justify keeping.
 */
export function placeLabel(row: Pick<DeviceRow, 'country' | 'lat' | 'lng'>): string {
  if (row.country.trim()) return row.country.trim().toUpperCase();
  if (row.lat !== null && row.lng !== null) {
    return `Around ${row.lat.toFixed(2)}, ${row.lng.toFixed(2)}`;
  }
  return 'Location not recorded';
}

/**
 * This device first, then whatever was used most recently.
 *
 * The one somebody is holding is the one they can check against what they
 * see, so it is the anchor for reading the rest of the list.
 */
export function sortDevices(rows: DeviceRow[], thisFingerprint: string | null): DeviceRow[] {
  return [...rows].sort((a, b) => {
    const aMine = thisFingerprint !== null && a.fingerprint === thisFingerprint;
    const bMine = thisFingerprint !== null && b.fingerprint === thisFingerprint;
    if (aMine !== bMine) return aMine ? -1 : 1;
    return Date.parse(b.lastSeen) - Date.parse(a.lastSeen);
  });
}

/**
 * Whether this list is worth a second look.
 *
 * Not a security verdict and not phrased as one. Somebody with a tablet and
 * two phones is not in trouble; somebody who has only ever owned one phone
 * and sees four rows has something to ask about. The threshold is where the
 * fraud rules already sit, so the app and the console agree about what
 * "several" means.
 */
export const MANY_DEVICES = 3;

export function looksBusy(rows: DeviceRow[]): boolean {
  return rows.length >= MANY_DEVICES;
}
