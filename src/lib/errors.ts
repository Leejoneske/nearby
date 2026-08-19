/**
 * Turning a thrown thing into something worth storing.
 *
 * Pure, and kept apart from `errorReporting.ts` for the reason everything
 * else in here is: importing that module builds a database client, which
 * throws without configuration, so a test of a hash function would need a
 * Supabase project to run.
 */
/**
 * A stable id for "this fault", so repeats group.
 *
 * Numbers, quoted strings and UUIDs are stripped out first: an error reading
 * "no row with id 4f2c…" is the same fault every time it happens, and keeping
 * the id would make each occurrence its own group and hide the pattern.
 */
export function fingerprint(screen: string, message: string): string {
  const normalised = message
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<id>')
    .replace(/\d+/g, '<n>')
    .replace(/["'`][^"'`]*["'`]/g, '<s>')
    .replace(/\s+/g, ' ')
    .trim();

  // djb2. Short, stable across platforms, and no dependency for something
  // that only has to bucket strings.
  let hash = 5381;
  const input = `${screen}|${normalised}`;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/** The message an unknown thrown value carries, without ever throwing itself. */
export function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error)?.slice(0, 400) ?? 'Unknown error';
  } catch {
    return 'Unknown error';
  }
}
