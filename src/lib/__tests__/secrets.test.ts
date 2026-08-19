/**
 * A guard on the one file that is meant to hold configuration and could
 * quietly come to hold a secret.
 *
 * `.env` is committed, and that is deliberate: the Android workflow has no
 * Supabase environment of its own, so without it CI would build an app that
 * throws on launch. The two values in it are the project URL and the
 * publishable key, which is designed to ship inside an app — row level
 * security is what protects the data, not that string.
 *
 * The risk is not what is in there now. It is that a committed `.env` is an
 * inviting place to put the next value, and the next value might be the
 * service role key, which bypasses every policy in the database. This fails
 * the build if that ever happens.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..');

/** Files that ship, or are read by something that ships. */
const WATCHED = [
  '.env',
  '.env.example',
  'app.json',
  'app.config.js',
  'vercel.json',
  'landing/index.html',
  'landing/b.js',
  'landing/build-config.mjs',
];

function read(relative: string): string {
  const path = join(ROOT, relative);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

/**
 * A Supabase key is a JWT, and which kind it is, is inside it. The publishable
 * one says `anon`; the one that must never be committed says `service_role`.
 * Decoding is the only way to tell them apart — they look identical.
 */
function rolesInJwts(text: string): string[] {
  const roles: string[] = [];
  for (const token of text.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g) ?? []) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
      if (typeof payload.role === 'string') roles.push(payload.role);
    } catch {
      // Not a JWT after all. Nothing to say about it.
    }
  }
  return roles;
}

describe('nothing that ships carries a secret', () => {
  it.each(WATCHED)('%s has no service role key', (file) => {
    expect(rolesInJwts(read(file))).not.toContain('service_role');
  });

  it.each(WATCHED)('%s has no private key or obvious secret', (file) => {
    const text = read(file);
    expect(text).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY-----/);
    expect(text).not.toMatch(/\bservice_role\b\s*[:=]/i);
    // Stripe, GitHub and Brevo, being the three this project has touched.
    expect(text).not.toMatch(/\bsk_live_[A-Za-z0-9]/);
    expect(text).not.toMatch(/\bgh[pousr]_[A-Za-z0-9]{20,}/);
    expect(text).not.toMatch(/\bxkeysib-[A-Za-z0-9]/);
  });

  /*
   * The console is a browser page. Anything reachable from it is readable by
   * whoever opens it, so a service key there would hand the entire directory
   * to anyone who found the URL.
   */
  it('the admin console reads only the publishable key', () => {
    const supabase = read('admin/src/supabase.ts');
    expect(supabase).toContain('VITE_SUPABASE_KEY');
    // The file talks about the service role key at length, in a comment
    // explaining why there is not one, so the check is for a variable that
    // would carry it rather than for the words.
    expect(supabase).not.toMatch(/import\.meta\.env\.\w*SERVICE\w*/i);
    expect(rolesInJwts(supabase)).not.toContain('service_role');
  });

  it('.env still holds what CI needs, so the build does not ship unconfigured', () => {
    const env = read('.env');
    expect(env).toMatch(/EXPO_PUBLIC_SUPABASE_URL=\S/);
    expect(env).toMatch(/EXPO_PUBLIC_SUPABASE_KEY=\S/);
  });
});
