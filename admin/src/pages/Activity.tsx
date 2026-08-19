/**
 * Everything that happened, in one list.
 *
 * Six tables used to each hold a fragment of a morning, and understanding one
 * meant opening five screens and lining the timestamps up by eye. This is the
 * same rows, ordered by when they happened, filterable by what they are.
 *
 * It reads; it does not act. Acting on a listing belongs on Listings, where
 * the listing and its context are. A feed that also contained buttons would
 * be a place to do things by accident.
 */
import { useCallback, useEffect, useState } from 'react';

import { fetchActivity, type Activity as Row, type ActivityKind } from '../api';
import { ACTIVITY_LOOK, Banner, Empty } from '../components';
import { FeedRow } from './Overview';

const KINDS: ActivityKind[] = ['listing', 'review', 'reply', 'person', 'report', 'admin', 'error'];
const RANGES = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

export function Activity() {
  const [rows, setRows] = useState<Row[]>([]);
  const [kinds, setKinds] = useState<ActivityKind[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchActivity({ kinds, days, limit: 300 }));
      setError(null);
    } catch (e) {
      console.warn('[activity]', e);
      setError('We could not load the activity.');
    } finally {
      setLoading(false);
    }
  }, [kinds, days]);

  // Behind a short timer, so toggling three filters is one query rather
  // than three, and so the effect itself sets no state.
  useEffect(() => {
    const timer = setTimeout(() => void load(), 150);
    return () => clearTimeout(timer);
  }, [load]);

  const toggle = (kind: ActivityKind) =>
    setKinds((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Activity</h1>
          <p>Listings, reviews, replies, sign-ups, reports, admin changes and errors.</p>
        </div>
        <button className="btn small" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {error ? <Banner kind="error">{error}</Banner> : null}

      <div className="toolbar">
        <div className="chips">
          <button
            className={kinds.length === 0 ? 'chip chip--on' : 'chip'}
            onClick={() => setKinds([])}
          >
            Everything
          </button>
          {KINDS.map((kind) => (
            <button
              key={kind}
              className={kinds.includes(kind) ? 'chip chip--on' : 'chip'}
              aria-pressed={kinds.includes(kind)}
              onClick={() => toggle(kind)}
            >
              {ACTIVITY_LOOK[kind].label}
            </button>
          ))}
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

      <div className="table-wrap">
        {rows.length === 0 ? (
          <Empty
            title={loading ? 'Loading…' : 'Nothing in this range'}
            body={
              kinds.length > 0
                ? 'Clear the filters or look further back.'
                : 'Nothing has happened in the period you picked.'
            }
          />
        ) : (
          <ul className="feed">
            {rows.map((row, i) => (
              <FeedRow key={`${row.at}-${i}`} row={row} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
