/**
 * Writes the browser config the share pages need.
 *
 * The landing folder is deployed as-is, so there is nowhere for an
 * environment variable to be substituted. This runs at deploy time and emits
 * one small script the pages load before their own.
 *
 * The key it writes is the publishable one — the same string that ships
 * inside the app. It identifies the project and grants nothing: what a
 * visitor can read is decided by the row level security policies, which for
 * an anonymous reader is live listings and their reviews. There must never be
 * a service role key here.
 */
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const url = process.env.VITE_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.VITE_SUPABASE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

if (!url || !key) {
  // Not fatal. The rest of the site does not need this, and a share page that
  // says "we could not load this listing" beats a failed deployment.
  console.warn('[landing] no Supabase config in the environment; share pages will be blank');
}

await writeFile(
  join(HERE, 'config.js'),
  `window.NEARBY_CONFIG = ${JSON.stringify({ supabaseUrl: url, supabaseKey: key })};\n`,
  'utf8',
);

console.log('[landing] wrote config.js');
