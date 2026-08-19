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
import { download } from '../download';
import { csvFilename, toCsv } from '../lib';

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

  const exportCsv = () => {
    download(
      csvFilename('reviews'),
      toCsv(rows, [
        { header: 'Listing', value: (r: AdminReview) => r.businesses?.name },
        { header: 'Rating', value: (r: AdminReview) => r.rating },
        { header: 'Author', value: (r: AdminReview) => r.author_name },
        { header: 'Review', value: (r: AdminReview) => r.body },
        { header: 'Owner reply', value: (r: AdminReview) => r.owner_reply },
        { header: 'Written', value: (r: AdminReview) => r.created_at },
      ]),
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reviews</h1>
          <p>Everything people have written, newest first.</p>
        </div>
        <button className="btn small" onClick={exportCsv} disabled={rows.length === 0}>
          Export {rows.length} as CSV
        </button>
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
                  <td data-label="Rating" className="num nowrap cell-title">{row.rating} / 5</td>
                  <td data-label="Review" style={{ maxWidth: 420 }}>
                    <div>{row.body}</div>
                    <div className="cell-sub">
                      by {row.author_name}
                      {row.owner_reply ? ' · owner replied' : ''}
                    </div>
                  </td>
                  <td data-label="Listing" className="cell-sub">{row.businesses?.name ?? '—'}</td>
                  <td data-label="When" className="nowrap cell-sub">{ago(row.created_at)}</td>
                  <td data-label="">
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
