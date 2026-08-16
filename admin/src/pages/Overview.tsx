/**
 * What the directory looks like right now.
 *
 * Every figure here is counted in `admin_overview()`. Nothing on this screen
 * is estimated, projected or filled in to make the layout look complete — a
 * plausible-looking number on a moderation console is worse than no number,
 * because somebody will act on it.
 */
import { useEffect, useState } from 'react';

import { fetchActions, fetchOverview, type AdminAction, type Overview as Counts } from '../api';
import { Banner, Empty, Stat, ago } from '../components';

export function Overview({ onGo }: { onGo: (page: 'reports' | 'listings') => void }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [actions, setActions] = useState<AdminAction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, a] = await Promise.all([fetchOverview(), fetchActions()]);
        if (!alive) return;
        setCounts(c);
        setActions(a);
      } catch (e) {
        console.warn('[overview]', e);
        if (alive) setError('We could not load the numbers.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p>Everything in the directory, counted just now.</p>
        </div>
      </div>

      {error ? <Banner kind="error">{error}</Banner> : null}

      {counts ? (
        <>
          <div className="stats">
            <Stat
              label="Live listings"
              value={counts.listings_live}
              note={`${counts.listings_new_week} added this week`}
            />
            <Stat
              label="Waiting to verify"
              value={counts.listings_unverified}
              note={counts.listings_unverified > 0 ? 'Needs a look' : 'All caught up'}
              warn={counts.listings_unverified > 0}
            />
            <Stat
              label="Unclaimed"
              value={counts.listings_unclaimed}
              note="Nobody manages these yet"
            />
            <Stat
              label="Suspended"
              value={counts.listings_suspended}
              note="Hidden from search and the map"
            />
            <Stat
              label="People"
              value={counts.people}
              note={`${counts.people_new_week} joined this week`}
            />
            <Stat
              label="Reviews"
              value={counts.reviews_total}
              note={`${counts.reviews_new_week} written this week`}
            />
            <Stat
              label="Open reports"
              value={counts.reports_open}
              note={counts.reports_open > 0 ? 'Waiting on you' : 'Nothing reported'}
              warn={counts.reports_open > 0}
            />
          </div>

          {counts.reports_open > 0 ? (
            <Banner kind="info">
              {counts.reports_open} report{counts.reports_open === 1 ? '' : 's'} waiting.{' '}
              <a
                href="#reports"
                onClick={(e) => {
                  e.preventDefault();
                  onGo('reports');
                }}
              >
                Open the queue
              </a>
            </Banner>
          ) : null}
        </>
      ) : null}

      <div className="page-head" style={{ marginTop: 8 }}>
        <div>
          <h2 style={{ fontSize: 16 }}>Recent activity</h2>
          <p>Every change made from this console, and who made it.</p>
        </div>
      </div>

      <div className="table-wrap">
        {actions.length === 0 ? (
          <Empty
            title={loading ? 'Loading…' : 'Nothing has been changed yet'}
            body="Suspending a listing, verifying one or resolving a report all show up here."
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>What</th>
                <th>Detail</th>
                <th className="nowrap">When</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id}>
                  <td className="cell-title nowrap">{a.action}</td>
                  <td>
                    <span className="cell-sub">{describe(a.detail)}</span>
                  </td>
                  <td className="nowrap cell-sub">{ago(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/** The audit log's detail is free-form JSON; print it without pretending. */
function describe(detail: Record<string, unknown>): string {
  const parts = Object.entries(detail)
    .filter(([, v]) => v !== null && v !== '' && v !== undefined)
    .map(([k, v]) => `${k}: ${String(v)}`);
  return parts.length ? parts.join(' · ') : '—';
}
