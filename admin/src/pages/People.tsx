/**
 * Who has an account, and what they have done.
 *
 * Read-only on purpose. Suspending a person is a bigger decision than
 * suspending a listing — it touches their reviews, their saved places and
 * anything they manage — and shipping the button before the rules exist is
 * how somebody gets removed by accident. Listings are the lever that exists
 * today.
 *
 * Reading, though, is most of what this is for. "This account was reported"
 * and "this is the one hitting the error" are both questions the table alone
 * could not answer, so a row opens into everything that account has written,
 * listed and run into.
 */
import { useEffect, useState } from 'react';

import { fetchPeople, fetchPerson, type AdminPerson, type PersonDetail } from '../api';
import { Banner, Empty, StatusPill, ago } from '../components';

export function People() {
  const [rows, setRows] = useState<AdminPerson[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

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
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id}>
                  <td className="cell-title">{row.name || '—'}</td>
                  <td className="cell-sub">{row.email || '—'}</td>
                  <td className="cell-sub">{row.area || '—'}</td>
                  <td className="nowrap cell-sub">{ago(row.created_at)}</td>
                  <td>
                    <button className="btn small" onClick={() => setOpenId(row.id)}>
                      Open
                    </button>
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
