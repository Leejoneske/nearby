/**
 * Telling us what broke in front of somebody.
 *
 * Before this, a failure existed as a `console.warn` on a device we do not
 * have, so "it does not work" was the entire bug report. Now the same failure
 * leaves a row an admin can read, grouped so that one fault hitting fifty
 * people reads as one problem rather than fifty.
 *
 * Three rules it keeps to:
 *
 *   - It never throws. Something that reports errors and then fails loudly is
 *     worse than no reporting at all.
 *   - It never blocks. Every call is fire and forget.
 *   - It sends a message, not a stack. A stack from a minified bundle says
 *     nothing useful and is the field most likely to carry something private
 *     that was passed into an error.
 */
import { Platform } from 'react-native';

import { readAppVersion } from './appInfo';
import { fingerprint, messageOf } from './errors';
import { supabase } from './supabase';

export { fingerprint, messageOf } from './errors';

/**
 * The same fault, over and over, is one report.
 *
 * A render loop can throw thousands of times a second. Without this the app
 * would spend its evening posting the same row and the console would be
 * unreadable by morning.
 */
const seen = new Map<string, number>();
const REPEAT_WINDOW_MS = 5 * 60 * 1000;

export function reportError(
  screen: string,
  error: unknown,
  detail: Record<string, unknown> = {},
): void {
  try {
    const message = messageOf(error).slice(0, 500);
    if (!message) return;

    const id = fingerprint(screen, message);
    const now = Date.now();
    const last = seen.get(id);
    if (last !== undefined && now - last < REPEAT_WINDOW_MS) return;
    seen.set(id, now);

    // Still worth having in the local log: whoever is debugging on a machine
    // should not have to read the database to see what just happened.
    console.warn(`[${screen}]`, message);

    void supabase
      .rpc('report_client_error', {
        in_screen: screen,
        in_message: message,
        in_fingerprint: id,
        in_platform: `${Platform.OS}${Platform.Version ? ` ${Platform.Version}` : ''}`,
        in_version: readAppVersion().version,
        in_detail: detail,
      })
      .then(({ error: refused }) => {
        if (refused) console.warn('[errors] the report was refused', refused);
      });
  } catch {
    // Reporting must never be the thing that breaks.
  }
}
