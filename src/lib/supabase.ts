/**
 * The Supabase client.
 *
 * The key here is the publishable one, which is designed to ship inside the
 * app — it identifies the project, it does not grant anything. Every table is
 * behind row level security, so what this key can actually read or write is
 * decided by the policies in the database, not by keeping the string secret.
 * The service role key must never appear in this repository.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!url || !key) {
  // Failing loudly beats a screen of empty lists that looks like "no results".
  throw new Error(
    'Supabase is not configured. Copy .env.example to .env and fill in ' +
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY.',
  );
}

export const supabase = createClient(url, key, {
  auth: {
    // AsyncStorage keeps the session across restarts on device. The web build
    // has its own storage, and handing it AsyncStorage there breaks the
    // redirect flow, so it is left to the default.
    ...(Platform.OS === 'web' ? {} : { storage: AsyncStorage }),
    autoRefreshToken: true,
    persistSession: true,
    // Only meaningful for OAuth redirects, which native does not use.
    detectSessionInUrl: Platform.OS === 'web',
  },
});
