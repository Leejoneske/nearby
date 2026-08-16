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
