/**
 * Who somebody says they are, before any of it is checked.
 *
 * This lived inside the sign-in screen, which meant testing it dragged in the
 * screen, which dragged in the database client, which refuses to load without
 * configuration. A rule you cannot test without a network is a rule nobody
 * tests.
 */

/**
 * Deliberately loose. The only real test of an address is whether the code
 * arrives, and every clever regex ever written has rejected somebody's real
 * address — which, for an app you cannot get into without one, means turning
 * a customer away at the door.
 *
 * So this rules out the shapes that cannot possibly work: no `@`, nothing
 * before or after it, no dot in the domain, whitespace anywhere inside.
 */
export function isPlausibleEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
}

/*
 * How many digits a sign-in code has is the server's decision.
 *
 * Supabase lets the OTP length be set anywhere from six to ten, and the
 * verify screen used to hard-code six: an eight digit code arrived, the field
 * truncated it to the first six, and the app reported that the code did not
 * work. It was right that it did not work and wrong about why.
 */
export const MIN_CODE_LENGTH = 6;
export const MAX_CODE_LENGTH = 10;

/** Boxes to draw: never fewer than the minimum, never more than the maximum. */
export function boxCount(entered: number): number {
  return Math.min(MAX_CODE_LENGTH, Math.max(MIN_CODE_LENGTH, entered));
}

/**
 * Email providers we do not accept a sign-up from.
 *
 * The database refuses these too, with a trigger on the users table, and that
 * is the enforcement. This list exists so somebody hears "pick a different
 * provider" while they are still looking at the field, rather than after a
 * round trip that ends in a generic failure.
 *
 * The two lists will drift, because the database's can be added to without a
 * release. That is deliberate: this one only has to catch the common cases
 * quickly, and being out of date makes it miss, never over-refuse.
 */
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'sharklasers.com',
  'grr.la',
  '10minutemail.com',
  '10minutemail.net',
  'temp-mail.org',
  'tempmail.com',
  'tempmailo.com',
  'throwawaymail.com',
  'yopmail.com',
  'yopmail.fr',
  'getnada.com',
  'trashmail.com',
  'dispostable.com',
  'fakeinbox.com',
  'maildrop.cc',
  'mohmal.com',
  'emailondeck.com',
  'spamgourmet.com',
  'mailnesia.com',
  'mintemail.com',
  'tempr.email',
  'discard.email',
  'inboxkitten.com',
  'mailsac.com',
  'burnermail.io',
  'anonaddy.me',
  'mail.tm',
]);

/**
 * Whether an address belongs to a throwaway inbox service.
 *
 * Subdomains count. These services hand out `team.mailinator.com` as readily
 * as `mailinator.com`, so an exact match catches the front door and none of
 * the windows. The database checks the same way, and the database is what
 * actually enforces it — this is here so somebody is told before they wait
 * for a code at an address they can never be reached at again.
 */
export function isDisposableEmail(input: string): boolean {
  const host = input.trim().toLowerCase().split('@')[1];
  if (!host) return false;

  const labels = host.split('.');
  for (let i = 0; i < labels.length - 1; i += 1) {
    if (DISPOSABLE_DOMAINS.has(labels.slice(i).join('.'))) return true;
  }
  return false;
}

/**
 * Cleans a name before it is sent.
 *
 * Deliberately the same shape as `clean_display_name` in the database, which
 * is what actually enforces it. Doing it here as well means the field shows
 * what will be stored, rather than something that changes after saving.
 *
 * Note what this does *not* do: it does not strip quotes or angle brackets.
 * Every write goes through a bound parameter, so a name containing a quote is
 * simply a name containing a quote, and O'Brien is a real name that a
 * quote-stripping "sanitiser" would quietly corrupt.
 */
export function cleanDisplayName(input: string): string {
  return (
    input
      // Anything that behaves like a space becomes one, before the rest of
      // the control range is removed. Otherwise two words merge into one.
      .replace(/[\u0009-\u000D]/g, ' ')
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      // Zero-width and bidirectional marks, which hide or reorder what follows.
      .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60)
  );
}
