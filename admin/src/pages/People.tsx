/**
 * Who has an account.
 *
 * Read-only on purpose. Suspending a person is a bigger decision than
 * suspending a listing — it touches their reviews, their saved places and
 * anything they manage — and shipping the button before the rules exist is
 * how somebody gets removed by accident. Listings are the lever that exists
 * today.
 */
import { useEffect, useState } from 'react';

import { fetchPeople, type AdminPerson } from '../api';
import { Banner, Empty, ago } from '../components';

export function People() {
  const [rows, setRows] = useState<AdminPerson[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchPeople();
        if (alive) setRows(data);
      } catch (e) {
        console.warn('[people]', e);
        if (alive) setError('We could not load the accounts.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const term = query.trim().toLowerCase();
  const shown = term
    ? rows.filter((r) =>
        `${r.name ?? ''} ${r.email ?? ''} ${r.area ?? ''}`.toLowerCase().includes(term),
      )
    : rows;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>People</h1>
          <p>Everyone with an account.</p>
        </div>
      </div>

      {error ? <Banner kind="error">{error}</Banner> : null}

      <div className="toolbar">
        <input
          className="grow"
          type="search"
          placeholder="Search by name, email or area"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search people"
        />
      </div>

      <div className="table-wrap">
        {shown.length === 0 ? (
          <Empty
            title={loading ? 'Loading…' : term ? 'Nobody matches' : 'No accounts yet'}
            body={term ? 'Try a different search.' : 'People appear here as they sign up.'}
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Area</th>
                <th className="nowrap">Joined</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id}>
                  <td className="cell-title">{row.name || '—'}</td>
                  <td className="cell-sub">{row.email || '—'}</td>
                  <td className="cell-sub">{row.area || '—'}</td>
                  <td className="nowrap cell-sub">{ago(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
