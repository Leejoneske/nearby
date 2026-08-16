import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * The console is built into the landing site rather than deployed on its own.
 *
 * One domain, one deploy, one Supabase project — and, more usefully, one set
 * of types. A separate deployment would need its own auth setup and its own
 * copy of every row shape, which is two things to keep in step for no gain
 * while it is this small.
 */

/**
 * The console talks to the same project as the app, so it reads the same two
 * values rather than asking anybody to keep a second copy in step. A real
 * VITE_ variable still wins, which is what a deploy would set.
 *
 * These are the publishable URL and key — the ones meant to ship inside a
 * client. Row level security is what protects the data. The service role key
 * must never appear in either file.
 */
function supabaseFromRepoRoot(): { url: string; key: string } {
  const fromEnv = {
    url: process.env.VITE_SUPABASE_URL ?? '',
    key: process.env.VITE_SUPABASE_KEY ?? '',
  };
  if (fromEnv.url && fromEnv.key) return fromEnv;

  try {
    const text = readFileSync(resolve(__dirname, '../.env'), 'utf8');
    const read = (name: string) =>
      text.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim() ?? '';
    return {
      url: fromEnv.url || read('EXPO_PUBLIC_SUPABASE_URL'),
      key: fromEnv.key || read('EXPO_PUBLIC_SUPABASE_KEY'),
    };
  } catch {
    return fromEnv;
  }
}

export default defineConfig(() => {
  const supabase = supabaseFromRepoRoot();

  return {
    plugins: [react()],
    base: '/admin/',
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabase.url),
      'import.meta.env.VITE_SUPABASE_KEY': JSON.stringify(supabase.key),
    },
    build: {
      outDir: '../landing/admin',
      emptyOutDir: true,
    },
  };
});
