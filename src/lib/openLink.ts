/**
 * Opening a phone number or a website can fail — a tablet with no dialler, a
 * device with no browser, a malformed address in a listing somebody typed.
 * `Linking.openURL` rejects in all of those cases, and an unhandled rejection
 * is a crash in development and complete silence in production.
 *
 * These wrap it so the failure is visible to the person who tapped.
 */
import { Alert, Linking } from 'react-native';

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
 * Hands the coordinates to whatever map app the phone uses. Web falls through
 * to Google Maps in a new tab, which is the only thing a browser can do.
 */
export function openDirections(lat: number, lng: number, label?: string) {
  const query = label ? encodeURIComponent(label) : `${lat},${lng}`;
  void open(
    `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${query}`,
    'No map app is available on this device.',
  );
}
