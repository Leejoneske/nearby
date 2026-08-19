/**
 * The console's front door.
 *
 * Two ways in. The emailed code is the same one the app uses and is the one
 * to prefer: no password to leak, reuse or reset. A password is offered as
 * well because the code depends on an email provider being configured, and a
 * console you cannot reach when mail is down is a console you cannot fix mail
 * from.
 *
 * Getting through this proves who you are. It does not make you an admin —
 * that is a row in `admins`, checked inside the database on every read and
 * every write. This page is a courtesy, not a lock, and the copy on it is
 * careful not to imply otherwise.
 */
import { useState } from 'react';

import { Banner } from './components';
import { supabase } from './supabase';

function isPlausibleEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
}

/*
 * The code length is a project setting and has been changed at least once.
 * This screen used to hard-code six: `maxLength={6}` and a Sign in button
 * disabled below six characters, which meant that the day the project moved
 * to eight digits, the console could not be signed into at all with a code.
 * The app hit exactly the same bug. So: a range, and no auto-submit.
 */
const MIN_CODE = 6;
const MAX_CODE = 10;

type Method = 'code' | 'password';

export function SignIn() {
  const [method, setMethod] = useState<Method>('code');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const address = email.trim().toLowerCase();

  const signInWithPassword = async () => {
    setError(null);
    if (!isPlausibleEmail(email)) {
      setError('Enter an email address we can reach.');
      return;
    }
    setBusy(true);
    const { error: failed } = await supabase.auth.signInWithPassword({ email: address, password });
    setBusy(false);
    if (failed) setError('That email and password did not match.');
  };

  const send = async () => {
    setError(null);
    if (!isPlausibleEmail(email)) {
      setError('Enter an email address we can reach.');
      return;
    }
    setBusy(true);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: address,
      // No account is created from here. An address that is not already an
      // admin has nothing to sign in to, and letting the console mint users
      // would make it a signup form for the whole project.
      options: { shouldCreateUser: false },
    });
    setBusy(false);

    /*
     * The same screen either way, and deliberately.
     *
     * Saying "we could not send a code to that address" tells whoever typed
     * it whether that address has an account, which is a question this page
     * should not answer to somebody who cannot already read the inbox.
     */
    setSent(true);
    if (sendError) console.warn('[signin] the code could not be sent', sendError);
  };

  const verify = async () => {
    setError(null);
    setBusy(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: address,
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);

    if (verifyError) {
      setError('That code did not work. Check it and try again.');
      setCode('');
    }
    // On success the auth listener in App swaps this screen out.
  };

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-mark" aria-hidden="true">
          N
        </div>
        <h1>Nearby console</h1>
        <p className="gate-lede">
          {sent
            ? `If ${address} has access, a code is on its way. It is good for a few minutes.`
            : 'For the people who moderate the directory.'}
        </p>

        {error ? <Banner kind="error">{error}</Banner> : null}

        {sent ? (
          <form
            className="gate-form"
            onSubmit={(e) => {
              e.preventDefault();
              void verify();
            }}
          >
            <label className="gate-label" htmlFor="code">
              Your code
            </label>
            <input
              id="code"
              className="code-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={MAX_CODE}
              value={code}
              autoFocus
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, MAX_CODE))}
            />
            <button
              className="btn primary block"
              type="submit"
              disabled={busy || code.length < MIN_CODE}
            >
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <button
              className="btn block quiet"
              type="button"
              onClick={() => {
                setSent(false);
                setCode('');
                setError(null);
              }}
            >
              Use a different address
            </button>
          </form>
        ) : (
          <form
            className="gate-form"
            onSubmit={(e) => {
              e.preventDefault();
              void (method === 'code' ? send() : signInWithPassword());
            }}
          >
            <label className="gate-label" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              autoFocus
              onChange={(e) => setEmail(e.target.value)}
            />

            {method === 'password' ? (
              <>
                <label className="gate-label" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </>
            ) : null}

            <button className="btn primary block" type="submit" disabled={busy}>
              {busy ? 'Working…' : method === 'code' ? 'Email me a code' : 'Sign in'}
            </button>
            <button
              className="btn block quiet"
              type="button"
              onClick={() => {
                setMethod(method === 'code' ? 'password' : 'code');
                setError(null);
              }}
            >
              {method === 'code' ? 'Use a password instead' : 'Email me a code instead'}
            </button>
          </form>
        )}

        <p className="gate-fine">
          Signing in proves who you are. What you can do here is decided
          separately, and in the database.
        </p>
      </div>
    </div>
  );
}
