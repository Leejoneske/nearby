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
import { download } from '../download';
import { csvFilename, toCsv } from '../lib';

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
   * One implementation of the fetch, not two. This used to carry a copy of
   * `load` inline to keep a synchronous setState out of the effect body; the
   * copy drifted, and the two of them ended up reporting the same failure in
   * two different words. Deferring by a tick keeps the effect clean and keeps
   * the message in one place.
   */
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

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

  const exportCsv = () => {
    download(
      csvFilename('reports'),
      toCsv(rows, [
        { header: 'Reason', value: (r: AdminReport) => r.reason },
        { header: 'Detail', value: (r: AdminReport) => r.detail },
        { header: 'About', value: (r: AdminReport) => r.target_type },
        { header: 'Target', value: (r: AdminReport) => r.target_id },
        { header: 'State', value: (r: AdminReport) => r.state },
        { header: 'Reported', value: (r: AdminReport) => r.created_at },
        { header: 'Resolved', value: (r: AdminReport) => r.resolved_at },
      ]),
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p>Listings and reviews people have flagged.</p>
        </div>
        <button className="btn small" onClick={exportCsv} disabled={rows.length === 0}>
          Export {rows.length} as CSV
        </button>
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
                  <td data-label="Reason" style={{ maxWidth: 380 }}>
                    <div className="cell-title">{row.reason}</div>
                    {row.detail ? <div className="cell-sub">{row.detail}</div> : null}
                  </td>
                  <td data-label="About" className="cell-sub nowrap">
                    {row.target_type}
                    <div className="cell-sub">{row.target_id.slice(0, 8)}</div>
                  </td>
                  <td data-label="State" className="nowrap">
                    <ReportPill state={row.state} />
                  </td>
                  <td data-label="When" className="nowrap cell-sub">{ago(row.created_at)}</td>
                  <td data-label="">
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
