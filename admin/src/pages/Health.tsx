/**
 * What is failing in front of people.
 *
 * Grouped by fault rather than listed by time, because a hundred rows of the
 * same error is one problem and a list sorted by timestamp hides that behind
 * whatever broke most recently. The count of people affected is the number
 * that decides whether it matters: one person hitting something forty times
 * is a bad afternoon, forty people hitting it once is an outage.
 *
 * Nothing here is actionable from this page on purpose. An error is a thing
 * to go and fix in the code, not a row to resolve.
 */
import { useCallback, useEffect, useState } from 'react';

import { fetchErrorGroups, type ErrorGroup } from '../api';
import { Banner, Empty, ago } from '../components';

const RANGES = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

export function Health() {
  const [groups, setGroups] = useState<ErrorGroup[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGroups(await fetchErrorGroups(days));
      setError(null);
    } catch (e) {
      console.warn('[health]', e);
      setError('We could not load the errors.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  // Behind a short timer, so toggling three filters is one query rather
  // than three, and so the effect itself sets no state.
  useEffect(() => {
    const timer = setTimeout(() => void load(), 150);
    return () => clearTimeout(timer);
  }, [load]);

  const total = groups.reduce((sum, g) => sum + g.occurrences, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Health</h1>
          <p>
            {loading
              ? 'Loading…'
              : total === 0
                ? 'Nothing has failed in this period.'
                : `${total} ${total === 1 ? 'failure' : 'failures'} across ${groups.length} ${
                    groups.length === 1 ? 'fault' : 'faults'
                  }.`}
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          aria-label="How far back"
        >
          {RANGES.map((range) => (
            <option key={range.days} value={range.days}>
              {range.label}
            </option>
          ))}
        </select>
      </div>

      {error ? <Banner kind="error">{error}</Banner> : null}

      <div className="table-wrap">
        {groups.length === 0 ? (
          <Empty
            title={loading ? 'Loading…' : 'Nothing has failed'}
            body="When somebody in the app hits an error, it appears here grouped by what went wrong."
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>What went wrong</th>
                <th className="num nowrap">Times</th>
                <th className="num nowrap">People</th>
                <th className="nowrap">Where</th>
                <th className="nowrap">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.fingerprint}>
                  <td data-label="What went wrong">
                    <div className="cell-title mono">{group.message}</div>
                    <div className="cell-sub">
                      {group.screen || 'unknown screen'} · first seen {ago(group.first_seen)}
                    </div>
                  </td>
                  <td data-label="Times" className="num nowrap">{group.occurrences}</td>
                  <td data-label="People" className="num nowrap">
                    <span className={group.people > 1 ? 'pill open' : 'pill quiet'}>
                      {group.people}
                    </span>
                  </td>
                  <td data-label="Where" className="nowrap cell-sub">
                    {group.platforms || 'unknown'}
                    {group.versions ? <div>{group.versions}</div> : null}
                  </td>
                  <td data-label="Last seen" className="nowrap cell-sub">{ago(group.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
