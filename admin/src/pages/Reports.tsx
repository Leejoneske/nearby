/**
 * What people have flagged.
 *
 * Resolving a report is only a decision about the report — actioned or
 * dismissed. Whatever the decision implies for the listing or the review is a
 * separate, deliberate step on its own screen, so nobody suspends a business
 * as a side effect of clearing a queue.
 */
import { useCallback, useEffect, useState } from 'react';

import { fetchReports, resolveReport, type AdminReport, type ReportState } from '../api';
import { Banner, Empty, ReportPill, ago } from '../components';

export function Reports() {
  const [rows, setRows] = useState<AdminReport[]>([]);
  const [state, setState] = useState<ReportState | 'all'>('open');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchReports(state));
      setError(null);
    } catch (e) {
      console.warn('[reports]', e);
      setError('We could not load the reports.');
    } finally {
      setLoading(false);
    }
  }, [state]);

  /*
   * The load runs inside the effect rather than being called out of it, so
   * nothing sets state synchronously as the effect body executes — which is
   * what turns one render into a cascade of them.
   */
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchReports(state);
        if (!alive) return;
        setRows(data);
        setError(null);
      } catch (e) {
        console.warn('[reports]', e);
        if (alive) setError('We could not load this.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [state]);

  const resolve = async (id: string, next: 'actioned' | 'dismissed') => {
    setBusyId(id);
    setError(null);
    try {
      await resolveReport(id, next);
      await load();
    } catch (e) {
      console.warn('[reports] the change was refused', e);
      setError('That change was refused.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p>Listings and reviews people have flagged.</p>
        </div>
      </div>

      {error ? <Banner kind="error">{error}</Banner> : null}

      <div className="toolbar">
        <select
          value={state}
          onChange={(e) => setState(e.target.value as ReportState | 'all')}
          aria-label="Report state"
        >
          <option value="open">Open</option>
          <option value="actioned">Actioned</option>
          <option value="dismissed">Dismissed</option>
          <option value="all">All</option>
        </select>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <Empty
            title={loading ? 'Loading…' : state === 'open' ? 'Nothing waiting' : 'Nothing here'}
            body={
              state === 'open'
                ? 'Reports from the app land here as they come in.'
                : 'Try a different filter.'
            }
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Reason</th>
                <th>About</th>
                <th className="nowrap">State</th>
                <th className="nowrap">When</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ maxWidth: 380 }}>
                    <div className="cell-title">{row.reason}</div>
                    {row.detail ? <div className="cell-sub">{row.detail}</div> : null}
                  </td>
                  <td className="cell-sub nowrap">
                    {row.target_type}
                    <div className="cell-sub">{row.target_id.slice(0, 8)}</div>
                  </td>
                  <td className="nowrap">
                    <ReportPill state={row.state} />
                  </td>
                  <td className="nowrap cell-sub">{ago(row.created_at)}</td>
                  <td>
                    {row.state === 'open' ? (
                      <div className="row-actions">
                        <button
                          className="btn small"
                          disabled={busyId === row.id}
                          onClick={() => void resolve(row.id, 'actioned')}
                        >
                          Actioned
                        </button>
                        <button
                          className="btn small"
                          disabled={busyId === row.id}
                          onClick={() => void resolve(row.id, 'dismissed')}
                        >
                          Dismiss
                        </button>
                      </div>
                    ) : (
                      <div className="row-actions cell-sub nowrap">
                        {ago(row.resolved_at)}
                      </div>
                    )}
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
