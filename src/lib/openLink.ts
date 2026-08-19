/**
 * Opening a phone number or a website can fail — a tablet with no dialler, a
 * device with no browser, a malformed address in a listing somebody typed.
 * `Linking.openURL` rejects in all of those cases, and an unhandled rejection
 * is a crash in development and complete silence in production.
 *
 * These wrap it so the failure is visible to the person who tapped.
 */
import { Alert, Linking, Platform } from 'react-native';

async function open(url: string, whenItFails: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('We could not open that', whenItFails);
  }
}

export function callPhone(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned) {
    Alert.alert('No phone number', 'This business has not added one yet.');
    return;
  }
  void open(`tel:${cleaned}`, `Try dialling ${phone} yourself.`);
}

export function openWebsite(website: string) {
  const trimmed = website.trim();
  if (!trimmed) return;
  // Listings store bare hostnames, so add the scheme when it is missing.
  const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  void open(url, 'Check the address and try again.');
}

/**
 * Hands the coordinates to whatever map app the phone actually has.
 *
 * This used to build a `google.com/maps/search` URL on every platform, which
 * opens a browser rather than a map app, and put the listing's name into
 * `query_place_id` — a parameter that expects one of Google's own place ids,
 * so a name in it is either ignored or breaks the link.
 *
 * Now it asks the platform first and falls back to the web:
 *
 *   Android  `geo:` is the documented intent for "show me this point", and
 *            every map app on the device registers for it, so the person
 *            gets whichever one they chose rather than whichever one we did.
 *   iOS      `maps://` is Apple Maps. Google Maps registers `comgooglemaps://`
 *            but only when it is installed, and probing for that needs a
 *            declared URL scheme for no real gain.
 *   Web      A browser can only ever open a web map.
 *
 * The label rides along as the pin's name where the scheme supports it, which
 * is what makes the destination read as the business rather than as a pair of
 * numbers.
 */
export async function openDirections(lat: number, lng: number, label?: string) {
  const name = (label ?? '').trim();
  const web =
    `https://www.google.com/maps/search/?api=1&query=${lat}%2C${lng}`;

  const native =
    Platform.OS === 'android'
      ? `geo:${lat},${lng}?q=${lat},${lng}${name ? `(${encodeURIComponent(name)})` : ''}`
      : Platform.OS === 'ios'
        ? `maps://?ll=${lat},${lng}${name ? `&q=${encodeURIComponent(name)}` : ''}`
        : null;

  if (native) {
    try {
      // `canOpenURL` rather than a bare attempt: on Android a device with no
      // map app at all throws, and the web fallback is a better answer than
      // an alert saying we could not do it.
      if (await Linking.canOpenURL(native)) {
        await Linking.openURL(native);
        return;
      }
    } catch {
      // Fall through to the browser.
    }
  }

  void open(web, 'No map app is available on this device.');
}
