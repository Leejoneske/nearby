/**
 * Accounts that look like one person wearing several hats.
 *
 * The rules that flag an account live in `assess_account` in the database and
 * each of them is a thing a person could check by hand. That is deliberate:
 * an opaque score that suspends somebody's business listing is not a tool,
 * it is a liability — the person cannot be told what they did, and nobody
 * here can tell a false positive from a real one.
 *
 * So this page shows the reasoning, not a number. A device shared by six
 * accounts is the strongest single signal there is, and it is the one thing
 * that only makes sense seen as a group rather than one row at a time.
 */
import { useCallback, useEffect, useState } from 'react';

import { fetchDeviceRings, fetchPeople, type AdminPerson, type DeviceRing } from '../api';
import { Banner, Empty, ago } from '../components';

export function Fraud() {
  const [rings, setRings] = useState<DeviceRing[]>([]);
  const [flagged, setFlagged] = useState<AdminPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([fetchDeviceRings(), fetchPeople({ state: 'flagged' })]);
      setRings(r);
      setFlagged(p);
      setError(null);
    } catch (e) {
      console.warn('[fraud]', e);
      setError('We could not load the signals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Signals</h1>
          <p>
            Named rules, not a model. Every flag says what it saw, so you can
            disagree with it.
          </p>
        </div>
      </div>

      {error ? <Banner kind="error">{error}</Banner> : null}

      <h2 className="section-title">Flagged accounts</h2>
      <div className="table-wrap">
        {flagged.length === 0 ? (
          <Empty
            title={loading ? 'Loading…' : 'Nothing flagged'}
            body="An account appears here when two or more rules agree about it. Acting on one is done from People."
          />
        ) : (
          <ul className="feed">
            {flagged.map((row) => (
              <li key={row.id} className="feed-row">
                <span
                  className={
                    row.suspended_at ? 'feed-tag tone-red' : 'feed-tag tone-amber'
                  }
                >
                  {row.fraud_score}
                </span>
                <div className="feed-body">
                  <div className="feed-title">
                    {row.name || 'Unnamed'}
                    {row.suspended_at ? ' · suspended' : ''}
                  </div>
                  <div className="feed-detail">{row.signals}</div>
                  <div className="feed-actor">
                    {row.email || 'no email'} · {row.listings} listings · {row.reviews} reviews
                  </div>
                </div>
                <time className="feed-when">
                  {row.last_seen ? ago(row.last_seen) : ago(row.created_at)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>

      <h2 className="section-title" style={{ marginTop: 24 }}>
        One device, several accounts
      </h2>
      <div className="table-wrap">
        {rings.length === 0 ? (
          <Empty
            title={loading ? 'Loading…' : 'No shared devices'}
            body="Two accounts on one phone is usually a shared tablet. Three or more is the thing worth looking at."
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th className="num nowrap">Accounts</th>
                <th>Who</th>
                <th className="nowrap">Platform</th>
                <th className="nowrap">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {rings.map((ring) => (
                <tr key={ring.fingerprint}>
                  <td data-label="Accounts" className="num nowrap">
                    <span className={ring.accounts >= 3 ? 'pill open' : 'pill quiet'}>
                      {ring.accounts}
                    </span>
                  </td>
                  <td data-label="Who">
                    <div className="cell-title">{ring.names}</div>
                    <div className="cell-sub mono">{ring.fingerprint}</div>
                  </td>
                  <td data-label="Platform" className="nowrap cell-sub">{ring.platforms || 'unknown'}</td>
                  <td data-label="Last seen" className="nowrap cell-sub">{ago(ring.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
