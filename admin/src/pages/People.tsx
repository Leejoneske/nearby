/**
 * Who has an account, what they have done, and whether to trust it.
 *
 * The queue is the point of the ordering: flagged and not yet suspended
 * first, worst score at the top. What somebody opens this page to find is the
 * account nobody has looked at yet, not an alphabetical census.
 *
 * Suspending is a real lever now and it is a heavy one — no sign in, no
 * writes, listings and reviews out of the directory, nothing sent — so it
 * asks for a reason, and the reason is shown to the person it happens to. A
 * suspension nobody can understand is one nobody can appeal.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  clearSignals,
  fetchPeople,
  fetchPerson,
  restoreAccount,
  suspendAccount,
  type AccountState,
  type AdminPerson,
  type PersonDetail,
} from '../api';
import { Banner, Empty, StatusPill, ago } from '../components';

const STATES: { id: AccountState; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'flagged', label: 'Flagged' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'active', label: 'Active' },
];

export function People() {
  const [rows, setRows] = useState<AdminPerson[]>([]);
  const [query, setQuery] = useState('');
  const [state, setState] = useState<AccountState>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchPeople({ query, state }));
      setError(null);
    } catch (e) {
      console.warn('[people]', e);
      setError('We could not load the accounts.');
    } finally {
      setLoading(false);
    }
  }, [query, state]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 200);
    return () => clearTimeout(timer);
  }, [load]);

  const act = async (id: string, run: () => Promise<void>) => {
    setBusyId(id);
    setError(null);
    try {
      await run();
      await load();
    } catch (e) {
      console.warn('[people] the change was refused', e);
      setError(e instanceof Error ? e.message : 'That change was refused.');
    } finally {
      setBusyId(null);
    }
  };

  const suspend = (row: AdminPerson) => {
    const reason = window.prompt(
      `Why is ${row.name || 'this account'} being suspended?\n\n` +
        'They are shown this, so write it to them. Everything they have made is ' +
        'hidden while it is in place and comes back untouched if you restore it.',
      row.signals ?? '',
    );
    if (reason === null) return;
    void act(row.id, () => suspendAccount(row.id, reason));
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>People</h1>
          <p>Everyone with an account. Flagged ones come first.</p>
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
        <div className="chips">
          {STATES.map((option) => (
            <button
              key={option.id}
              className={state === option.id ? 'chip chip--on' : 'chip'}
              aria-pressed={state === option.id}
              onClick={() => setState(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <Empty
            title={loading ? 'Loading…' : query || state !== 'all' ? 'Nobody matches' : 'No accounts yet'}
            body={
              query || state !== 'all'
                ? 'Try a different search, or clear the filter.'
                : 'People appear here as they sign up.'
            }
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>State</th>
                <th className="num nowrap">Listings</th>
                <th className="num nowrap">Reviews</th>
                <th className="nowrap">Last seen</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={row.suspended_at ? 'row-muted' : undefined}>
                  <td>
                    <div className="cell-title">{row.name || 'Unnamed'}</div>
                    <div className="cell-sub">
                      {row.email || 'No email'}
                      {row.area ? ` · ${row.area}` : ''}
                      {row.devices > 1 ? ` · ${row.devices} devices` : ''}
                    </div>
                    {row.signals ? <div className="cell-flag">{row.signals}</div> : null}
                  </td>
                  <td className="nowrap">
                    {row.is_admin ? <span className="pill verified">Admin</span> : null}
                    {row.suspended_at ? (
                      <span className="pill suspended">Suspended</span>
                    ) : row.fraud_score > 0 ? (
                      <span className="pill open">Flagged {row.fraud_score}</span>
                    ) : (
                      <span className="pill live">Active</span>
                    )}
                    {row.reports_against > 0 ? (
                      <span className="pill quiet">{row.reports_against} reported</span>
                    ) : null}
                  </td>
                  <td className="num nowrap">{row.listings || '—'}</td>
                  <td className="num nowrap">{row.reviews || '—'}</td>
                  <td className="nowrap cell-sub">
                    {row.last_seen ? ago(row.last_seen) : 'Never'}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn small" onClick={() => setOpenId(row.id)}>
                        Open
                      </button>
                      {row.fraud_score > 0 && !row.suspended_at ? (
                        <button
                          className="btn small"
                          disabled={busyId === row.id}
                          onClick={() => {
                            const note = window.prompt(
                              `Clear the flags on ${row.name || 'this account'}? Say why, for the log.`,
                              '',
                            );
                            if (note === null) return;
                            void act(row.id, () => clearSignals(row.id, note));
                          }}
                        >
                          Clear flags
                        </button>
                      ) : null}
                      {row.is_admin ? null : row.suspended_at ? (
                        <button
                          className="btn small"
                          disabled={busyId === row.id}
                          onClick={() => void act(row.id, () => restoreAccount(row.id))}
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          className="btn small danger"
                          disabled={busyId === row.id}
                          onClick={() => suspend(row)}
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

      {openId ? <PersonDialog id={openId} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}

/** Everything one account has done, on one screen. */
function PersonDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchPerson(id);
        if (alive) setPerson(data);
      } catch (e) {
        console.warn('[people] could not open that account', e);
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Account"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dialog-head">
          <h2>{person?.profile.name || 'Account'}</h2>
          <button className="btn small" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>

        <div className="dialog-body dialog-body--single">
          {failed ? <Banner kind="error">We could not load that account.</Banner> : null}
          {!person && !failed ? <p className="cell-sub">Loading…</p> : null}

          {person ? (
            <>
              <dl className="queue-facts">
                <Fact label="Email" value={person.profile.email} />
                <Fact label="Area" value={person.profile.area} />
                <Fact label="Joined" value={ago(person.profile.created_at)} />
                <Fact label="Last seen" value={person.last_seen ? ago(person.last_seen) : 'Never'} />
                <Fact label="Devices" value={person.platforms || 'Unknown'} />
                <Fact label="Saved" value={String(person.saved_count)} />
                <Fact label="Reports filed" value={String(person.reports_filed)} />
              </dl>

              <Group title="Listings" count={person.listings.length}>
                {person.listings.map((listing) => (
                  <li key={listing.id} className="feed-row">
                    <StatusPill status={listing.status} />
                    <div className="feed-body">
                      <div className="feed-title">{listing.name}</div>
                      <div className="feed-detail">
                        {listing.review_count > 0
                          ? `${Number(listing.rating).toFixed(1)} from ${listing.review_count}`
                          : 'No reviews yet'}
                        {listing.verified ? ' · verified' : ''}
                      </div>
                    </div>
                    <time className="feed-when">{ago(listing.created_at)}</time>
                  </li>
                ))}
              </Group>

              <Group title="Reviews" count={person.reviews.length}>
                {person.reviews.map((review) => (
                  <li key={review.id} className="feed-row">
                    <span className="feed-tag tone-amber">{review.rating}★</span>
                    <div className="feed-body">
                      <div className="feed-title">{review.business}</div>
                      <div className="feed-detail">{review.body}</div>
                    </div>
                    <time className="feed-when">{ago(review.created_at)}</time>
                  </li>
                ))}
              </Group>

              <Group title="Errors they hit" count={person.errors.length}>
                {person.errors.map((row, i) => (
                  <li key={`${row.created_at}-${i}`} className="feed-row">
                    <span className="feed-tag tone-red">Error</span>
                    <div className="feed-body">
                      <div className="feed-title mono">{row.message}</div>
                      <div className="feed-detail">
                        {row.screen || 'unknown screen'} · {row.platform || 'unknown'} ·{' '}
                        {row.app_version || 'unknown version'}
                      </div>
                    </div>
                    <time className="feed-when">{ago(row.created_at)}</time>
                  </li>
                ))}
              </Group>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Group({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="person-group">
      <h3>
        {title} <span className="pill quiet">{count}</span>
      </h3>
      {count === 0 ? <p className="cell-sub">Nothing here.</p> : <ul className="feed">{children}</ul>}
    </section>
  );
}
