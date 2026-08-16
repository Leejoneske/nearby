/**
 * Every review, newest first, with the one destructive action in the console.
 *
 * Removing a review really deletes it — there is no soft-delete here — but the
 * body is copied into the audit log first, so "what did it actually say" is
 * still answerable after the fact. The listing's rating and count are
 * recomputed by a trigger on the delete, so they cannot drift.
 */
import { useCallback, useEffect, useState } from 'react';

import { fetchReviews, removeReview, type AdminReview } from '../api';
import { Banner, Empty, ago } from '../components';

export function Reviews() {
  const [rows, setRows] = useState<AdminReview[]>([]);
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchReviews({ unansweredOnly }));
      setError(null);
    } catch (e) {
      console.warn('[reviews]', e);
      setError('We could not load the reviews.');
    } finally {
      setLoading(false);
    }
  }, [unansweredOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (row: AdminReview) => {
    const reason = window.prompt(
      `Remove this review of ${row.businesses?.name ?? 'this listing'}?\n\n` +
        `"${row.body.slice(0, 140)}"\n\nWhy? This is recorded in the activity log.`,
      '',
    );
    if (reason === null) return;

    setBusyId(row.id);
    setError(null);
    try {
      await removeReview(row.id, reason);
      await load();
    } catch (e) {
      console.warn('[reviews] the removal was refused', e);
      setError('That removal was refused.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reviews</h1>
          <p>Everything people have written, newest first.</p>
        </div>
      </div>

      {error ? <Banner kind="error">{error}</Banner> : null}

      <div className="toolbar">
        <label className="toggle">
          <input
            type="checkbox"
            checked={unansweredOnly}
            onChange={(e) => setUnansweredOnly(e.target.checked)}
          />
          Without an owner reply
        </label>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <Empty
            title={loading ? 'Loading…' : unansweredOnly ? 'Every review has a reply' : 'No reviews yet'}
            body={
              unansweredOnly
                ? 'Clear the filter to see all of them.'
                : 'Reviews appear here as people write them.'
            }
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th className="nowrap">Rating</th>
                <th>Review</th>
                <th>Listing</th>
                <th className="nowrap">When</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="num nowrap cell-title">{row.rating} / 5</td>
                  <td style={{ maxWidth: 420 }}>
                    <div>{row.body}</div>
                    <div className="cell-sub">
                      by {row.author_name}
                      {row.owner_reply ? ' · owner replied' : ''}
                    </div>
                  </td>
                  <td className="cell-sub">{row.businesses?.name ?? '—'}</td>
                  <td className="nowrap cell-sub">{ago(row.created_at)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn small danger"
                        disabled={busyId === row.id}
                        onClick={() => void remove(row)}
                      >
                        Remove
                      </button>
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
