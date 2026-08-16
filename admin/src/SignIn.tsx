/**
 * The console's front door.
 *
 * Two ways in. The six digit email code is the same one the app uses and is
 * the one to prefer — no password to leak, reuse or reset. A password is
 * offered as well because the code depends on an email provider being
 * configured, and an admin console you cannot reach when mail is down is an
 * admin console you cannot fix mail from.
 *
 * Getting through this proves who you are. It does not make you an admin;
 * that check happens next, and in the database.
 */
import { useState } from 'react';

import { Banner } from './components';
import { supabase } from './supabase';

function isPlausibleEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
}

type Method = 'code' | 'password';

export function SignIn() {
  const [method, setMethod] = useState<Method>('code');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithPassword = async () => {
    setError(null);
    if (!isPlausibleEmail(email)) {
      setError('Enter an email address we can reach.');
      return;
    }
    setBusy(true);
    const { error: failed } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
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
      email: email.trim().toLowerCase(),
      // No account is created from here. An address that is not already an
      // admin has nothing to sign in to, and letting the console mint users
      // makes it a signup form for the whole project.
      options: { shouldCreateUser: false },
    });
    setBusy(false);

    if (sendError) {
      setError('We could not send a code to that address.');
      return;
    }
    setSent(true);
  };

  const verify = async () => {
    setError(null);
    setBusy(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
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
        <h1>Nearby Console</h1>
        <p>
          {sent
            ? `Enter the six digit code sent to ${email.trim().toLowerCase()}.`
            : 'Sign in with the address on your account.'}
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
            <input
              className="code-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              autoFocus
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              aria-label="Six digit code"
            />
            <button className="btn primary" type="submit" disabled={busy || code.length < 6}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <button
              className="btn"
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
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              autoFocus
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email address"
            />
            {method === 'password' ? (
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-label="Password"
              />
            ) : null}
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? 'Working…' : method === 'code' ? 'Send me a code' : 'Sign in'}
            </button>
            <button
              className="btn"
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
      </div>
    </div>
  );
}
