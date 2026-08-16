/**
 * Every listing, and the four things an admin can do to one.
 *
 * Suspending is a status change, never a delete: a removed row takes its
 * reviews and its history with it, and "we took this down and here is when"
 * is a question that gets asked later.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  fetchBusinesses,
  setBusinessStatus,
  setVerified,
  type AdminBusiness,
  type BusinessStatus,
} from '../api';
import { Banner, Empty, StatusPill, ago } from '../components';

export function Listings() {
  const [rows, setRows] = useState<AdminBusiness[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<BusinessStatus | 'all'>('all');
  const [unverifiedOnly, setUnverifiedOnly] = useState(false);
  const [unclaimedOnly, setUnclaimedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchBusinesses({ query, status, unverifiedOnly, unclaimedOnly }));
      setError(null);
    } catch (e) {
      console.warn('[listings]', e);
      setError('We could not load the listings.');
    } finally {
      setLoading(false);
    }
  }, [query, status, unverifiedOnly, unclaimedOnly]);

  // Typing in the search box should not fire a query per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  const act = async (id: string, run: () => Promise<void>) => {
    setBusyId(id);
    setError(null);
    try {
      await run();
      await load();
    } catch (e) {
      console.warn('[listings] the change was refused', e);
      setError('That change was refused.');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = query || status !== 'all' || unverifiedOnly || unclaimedOnly;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Listings</h1>
          <p>Verify, suspend or restore anything in the directory.</p>
        </div>
      </div>

      {error ? <Banner kind="error">{error}</Banner> : null}

      <div className="toolbar">
        <input
          className="grow"
          type="search"
          placeholder="Search by name, area or address"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search listings"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as BusinessStatus | 'all')}
          aria-label="Status"
        >
          <option value="all">Any status</option>
          <option value="live">Live</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
        </select>
        <label className="toggle">
          <input
            type="checkbox"
            checked={unverifiedOnly}
            onChange={(e) => setUnverifiedOnly(e.target.checked)}
          />
          Unverified
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={unclaimedOnly}
            onChange={(e) => setUnclaimedOnly(e.target.checked)}
          />
          Unclaimed
        </label>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <Empty
            title={loading ? 'Loading…' : filtered ? 'Nothing matches' : 'No listings yet'}
            body={
              filtered
                ? 'Clear the filters to see everything.'
                : 'Listings appear here as people add them.'
            }
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Business</th>
                <th>Status</th>
                <th>Owner</th>
                <th className="nowrap">Reviews</th>
                <th className="nowrap">Added</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="cell-title">{row.name}</div>
                    <div className="cell-sub">
                      {row.category} · {row.neighbourhood || row.address || 'No address'}
                    </div>
                  </td>
                  <td className="nowrap">
                    <StatusPill status={row.status} />{' '}
                    {row.verified ? (
                      <span className="pill verified">Verified</span>
                    ) : (
                      <span className="pill quiet">Unverified</span>
                    )}
                  </td>
                  <td className="nowrap cell-sub">
                    {row.owner_id ? `Claimed ${ago(row.claimed_at)}` : 'Unclaimed'}
                  </td>
                  <td className="num nowrap">
                    {row.review_count > 0
                      ? `${Number(row.rating).toFixed(1)} · ${row.review_count}`
                      : '—'}
                  </td>
                  <td className="nowrap cell-sub">{ago(row.created_at)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn small"
                        disabled={busyId === row.id}
                        onClick={() => act(row.id, () => setVerified(row.id, !row.verified))}
                      >
                        {row.verified ? 'Unverify' : 'Verify'}
                      </button>
                      {row.status === 'suspended' ? (
                        <button
                          className="btn small"
                          disabled={busyId === row.id}
                          onClick={() => act(row.id, () => setBusinessStatus(row.id, 'live'))}
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          className="btn small danger"
                          disabled={busyId === row.id}
                          onClick={() => {
                            const note = window.prompt(
                              `Why is "${row.name}" being suspended?\n\nThis is recorded in the activity log.`,
                              '',
                            );
                            if (note === null) return;
                            void act(row.id, () =>
                              setBusinessStatus(row.id, 'suspended', note),
                            );
                          }}
                        >
                          Suspend
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
