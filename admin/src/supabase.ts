import { createClient } from '@supabase/supabase-js';

/**
 * The same project the app talks to, through the same publishable key.
 *
 * There is no service role key here and there must never be one. It bypasses
 * every row level security policy in the database, and anything shipped to a
 * browser is readable by whoever opens the page — so a service role key in
 * this file would hand full write access to the entire directory to anybody
 * who found the console.
 *
 * What makes an admin an admin is a row in `admins`, checked by `is_admin()`
 * inside the database on every read and every write. Loading this page grants
 * nothing at all.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

if (!url || !key) {
  throw new Error(
    'The console is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_KEY.',
  );
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Nothing here reads a token out of the address bar, and leaving it on
    // means a stray hash fragment can be interpreted as a sign-in.
    detectSessionInUrl: false,
  },
});
