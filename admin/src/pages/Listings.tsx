/**
 * Every listing, and everything an admin can do to one.
 *
 * Two jobs on one screen. New listings arrive as `pending` and are invisible
 * to everybody but their owner until somebody here reads them, so the queue
 * comes first and the rest of the directory sits underneath it.
 *
 * Suspending is a status change, never a delete: a removed row takes its
 * reviews and its history with it, and "we took this down and here is when"
 * is a question that gets asked later. Delete is kept for rows that should
 * never have existed, and it asks twice.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  deleteBusiness,
  fetchBusinesses,
  reviewListing,
  setBusinessStatus,
  setVerified,
  updateBusiness,
  type AdminBusiness,
  type BusinessEdit,
  type BusinessStatus,
} from '../api';
import { Banner, Empty, StatusPill, ago } from '../components';
import { download } from '../download';
import { csvFilename, toCsv } from '../lib';

const CATEGORIES = [
  'restaurant',
  'cafe',
  'beauty',
  'shopping',
  'auto',
  'health',
  'fitness',
  'hotel',
  'services',
  'nightlife',
];

export function Listings({ initialQuery = '' }: { initialQuery?: string }) {
  const [rows, setRows] = useState<AdminBusiness[]>([]);
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<BusinessStatus | 'all'>('all');
  const [unverifiedOnly, setUnverifiedOnly] = useState(false);
  const [unclaimedOnly, setUnclaimedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminBusiness | null>(null);
  const [bulk, setBulk] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchBusinesses({ query, status, unverifiedOnly, unclaimedOnly }));
      setError(null);
    } catch (e) {
      console.warn('[listings]', e);
      setError('We could not load the listings.');
    } finally {
      setLoading(false);
    }
  }, [query, status, unverifiedOnly, unclaimedOnly]);

  // Typing in the search box should not fire a query per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  const act = async (id: string, run: () => Promise<void>) => {
    setBusyId(id);
    setError(null);
    try {
      await run();
      await load();
    } catch (e) {
      console.warn('[listings] the change was refused', e);
      setError('That change was refused.');
    } finally {
      setBusyId(null);
    }
  };

  /*
   * Approving the whole queue, one call at a time.
   *
   * Sequential rather than Promise.all: each approval writes an audit row and
   * sends the owner a notification, and twenty at once is twenty writes
   * racing the same counters. It also means a refusal halfway through leaves
   * a queue that is half done and says so, rather than an unknown number of
   * them having landed.
   */
  const approveAll = async () => {
    const queue = rows.filter((row) => row.status === 'pending');
    if (queue.length === 0) return;
    if (
      !window.confirm(
        `Publish all ${queue.length} of these? Read them first: this puts every one of them in the directory.`,
      )
    ) {
      return;
    }

    setBulk(true);
    setError(null);
    let done = 0;
    try {
      for (const row of queue) {
        await reviewListing(row.id, true);
        done += 1;
      }
    } catch (e) {
      console.warn('[listings] a bulk approval was refused', e);
      setError(
        done === 0
          ? 'That was refused. Nothing was published.'
          : `${done} were published, then one was refused. The rest are still waiting.`,
      );
    } finally {
      setBulk(false);
      await load();
    }
  };

  const exportCsv = () => {
    download(
      csvFilename('listings'),
      toCsv(rows, [
        { header: 'Name', value: (r: AdminBusiness) => r.name },
        { header: 'Slug', value: (r: AdminBusiness) => r.slug },
        { header: 'Category', value: (r: AdminBusiness) => r.category },
        { header: 'Neighbourhood', value: (r: AdminBusiness) => r.neighbourhood },
        { header: 'Address', value: (r: AdminBusiness) => r.address },
        { header: 'Phone', value: (r: AdminBusiness) => r.phone },
        { header: 'Website', value: (r: AdminBusiness) => r.website },
        { header: 'Status', value: (r: AdminBusiness) => r.status },
        { header: 'Verified', value: (r: AdminBusiness) => (r.verified ? 'yes' : 'no') },
        { header: 'Owner', value: (r: AdminBusiness) => (r.owner_id ? 'claimed' : 'unclaimed') },
        { header: 'Rating', value: (r: AdminBusiness) => r.rating },
        { header: 'Reviews', value: (r: AdminBusiness) => r.review_count },
        { header: 'Added', value: (r: AdminBusiness) => r.created_at },
      ]),
    );
  };

  const filtered = query || status !== 'all' || unverifiedOnly || unclaimedOnly;
  // The queue is drawn from whatever is on screen, so a search narrows both.
  const pending = rows.filter((row) => row.status === 'pending');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Listings</h1>
          <p>Read what people submit, then verify, edit, suspend or restore it.</p>
        </div>
        <button className="btn small" onClick={exportCsv} disabled={rows.length === 0}>
          Export {rows.length} as CSV
        </button>
      </div>

      {error ? <Banner kind="error">{error}</Banner> : null}

      {pending.length > 0 ? (
        <section className="queue">
          <h2 className="queue-title">
            Waiting for review <span className="pill quiet">{pending.length}</span>
            {pending.length > 1 ? (
              <button
                className="btn small"
                disabled={bulk || busyId !== null}
                onClick={() => void approveAll()}
              >
                {bulk ? 'Publishing…' : `Approve all ${pending.length}`}
              </button>
            ) : null}
          </h2>
          {pending.map((row) => (
            <article key={row.id} className="queue-card">
              <header className="queue-head">
                <div>
                  <div className="cell-title">{row.name}</div>
                  <div className="cell-sub">
                    {row.category} · {row.address || 'No address'}
                    {row.neighbourhood ? `, ${row.neighbourhood}` : ''} · added {ago(row.created_at)}
                  </div>
                </div>
                <div className="row-actions">
                  <button
                    className="btn small primary"
                    disabled={busyId === row.id}
                    onClick={() => void act(row.id, () => reviewListing(row.id, true))}
                  >
                    Approve
                  </button>
                  <button
                    className="btn small danger"
                    disabled={busyId === row.id}
                    onClick={() => {
                      const note = window.prompt(
                        `Why can "${row.name}" not be published?\n\nThe owner is sent this, so write it to them.`,
                        '',
                      );
                      if (note === null) return;
                      void act(row.id, () => reviewListing(row.id, false, note));
                    }}
                  >
                    Decline
                  </button>
                  <button className="btn small" onClick={() => setEditing(row)}>
                    Edit
                  </button>
                </div>
              </header>

              {row.tagline ? <p className="queue-line">{row.tagline}</p> : null}
              {row.description ? <p className="queue-body">{row.description}</p> : null}

              <dl className="queue-facts">
                <Fact label="Phone" value={row.phone} />
                <Fact label="Website" value={row.website} />
                <Fact
                  label="Typical spend"
                  value={row.price_to > 0 ? `KSh ${row.price_from} to ${row.price_to}` : null}
                />
                <Fact label="Owner" value={row.owner_id ? 'Signed in account' : 'Unclaimed'} />
              </dl>

              {row.photos?.length ? (
                <div className="queue-photos">
                  {row.photos.map((src) => (
                    <img key={src} src={src} alt="" loading="lazy" />
                  ))}
                </div>
              ) : (
                <p className="cell-sub">No photos yet.</p>
              )}
            </article>
          ))}
        </section>
      ) : null}

      <div className="toolbar">
        <input
          className="grow"
          type="search"
          placeholder="Search by name, area or address"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search listings"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as BusinessStatus | 'all')}
          aria-label="Status"
        >
          <option value="all">Any status</option>
          <option value="live">Live</option>
          <option value="pending">Waiting for review</option>
          <option value="suspended">Suspended</option>
        </select>
        <label className="toggle">
          <input
            type="checkbox"
            checked={unverifiedOnly}
            onChange={(e) => setUnverifiedOnly(e.target.checked)}
          />
          Unverified
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={unclaimedOnly}
            onChange={(e) => setUnclaimedOnly(e.target.checked)}
          />
          Unclaimed
        </label>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <Empty
            title={loading ? 'Loading…' : filtered ? 'Nothing matches' : 'No listings yet'}
            body={
              filtered
                ? 'Clear the filters to see everything.'
                : 'Listings appear here as people add them.'
            }
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Business</th>
                <th>Status</th>
                <th>Owner</th>
                <th className="nowrap">Reviews</th>
                <th className="nowrap">Added</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td data-label="Business">
                    <div className="cell-title">
                      {row.name}{' '}
                      {/* The console is served from the same origin as the
                          share page, so this is the page a customer sees. */}
                      <a
                        className="cell-link"
                        href={`/b/${row.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Open the public page"
                      >
                        ↗
                      </a>
                    </div>
                    <div className="cell-sub">
                      {row.category} · {row.neighbourhood || row.address || 'No address'}
                    </div>
                  </td>
                  <td data-label="Status" className="nowrap">
                    <StatusPill status={row.status} />{' '}
                    {row.verified ? (
                      <span className="pill verified">Verified</span>
                    ) : (
                      <span className="pill quiet">Unverified</span>
                    )}
                  </td>
                  <td data-label="Owner" className="nowrap cell-sub">
                    {row.owner_id ? `Claimed ${ago(row.claimed_at)}` : 'Unclaimed'}
                  </td>
                  <td data-label="Reviews" className="num nowrap">
                    {row.review_count > 0
                      ? `${Number(row.rating).toFixed(1)} · ${row.review_count}`
                      : '—'}
                  </td>
                  <td data-label="Added" className="nowrap cell-sub">{ago(row.created_at)}</td>
                  <td data-label="">
                    <div className="row-actions">
                      <button className="btn small" onClick={() => setEditing(row)}>
                        Edit
                      </button>
                      <button
                        className="btn small"
                        disabled={busyId === row.id}
                        onClick={() => act(row.id, () => setVerified(row.id, !row.verified))}
                      >
                        {row.verified ? 'Unverify' : 'Verify'}
                      </button>
                      {row.status === 'pending' ? (
                        <button
                          className="btn small primary"
                          disabled={busyId === row.id}
                          onClick={() => void act(row.id, () => reviewListing(row.id, true))}
                        >
                          Approve
                        </button>
                      ) : row.status === 'suspended' ? (
                        <button
                          className="btn small"
                          disabled={busyId === row.id}
                          onClick={() => act(row.id, () => setBusinessStatus(row.id, 'live'))}
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          className="btn small danger"
                          disabled={busyId === row.id}
                          onClick={() => {
                            const note = window.prompt(
                              `Why is "${row.name}" being suspended?\n\nThe owner is sent this, so write it to them.`,
                              '',
                            );
                            if (note === null) return;
                            void act(row.id, () =>
                              setBusinessStatus(row.id, 'suspended', note),
                            );
                          }}
                        >
                          Suspend
                        </button>
                      )}
                      <button
                        className="btn small danger"
                        disabled={busyId === row.id}
                        onClick={() => {
                          /*
                           * Two prompts, and the second wants the name typed
                           * out. This takes the reviews and the history with
                           * it and there is no undo behind it.
                           */
                          const reason = window.prompt(
                            `Delete "${row.name}" for good?\n\nThis removes its reviews and its history too. Suspending hides it and keeps all of that. Say why:`,
                            '',
                          );
                          if (reason === null) return;
                          const typed = window.prompt(
                            `Type the name to confirm: ${row.name}`,
                            '',
                          );
                          if (typed?.trim() !== row.name) return;
                          void act(row.id, () => deleteBusiness(row.id, reason));
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing ? (
        <EditDialog
          business={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      ) : null}
    </>
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

/**
 * Editing somebody else's listing.
 *
 * Only the columns `admin_update_business` accepts appear here. Hours and
 * amenities are the owner's to set from the app, and a half-built editor for
 * them here would be a way to overwrite their work with blanks.
 */
function EditDialog({
  business,
  onClose,
  onSaved,
}: {
  business: AdminBusiness;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<BusinessEdit>({
    name: business.name,
    category: business.category,
    tagline: business.tagline ?? '',
    description: business.description ?? '',
    address: business.address ?? '',
    neighbourhood: business.neighbourhood ?? '',
    phone: business.phone ?? '',
    website: business.website ?? '',
    price_from: business.price_from ?? 0,
    price_to: business.price_to ?? 0,
    photos: business.photos ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof BusinessEdit>(key: K, value: BusinessEdit[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!form.name.trim()) {
      setError('A listing needs a name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateBusiness(business.id, { ...form, name: form.name.trim() });
      onSaved();
    } catch (e) {
      console.warn('[listings] the edit was refused', e);
      setError('That change was refused.');
      setSaving(false);
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${business.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dialog-head">
          <h2>Edit listing</h2>
          <button className="btn small" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>

        {error ? <Banner kind="error">{error}</Banner> : null}

        <div className="dialog-body">
          <label>
            Name
            <input value={form.name} onChange={(e) => set('name', e.target.value)} />
          </label>
          <label>
            Category
            <select value={form.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Short description
            <input value={form.tagline} onChange={(e) => set('tagline', e.target.value)} />
          </label>
          <label className="wide">
            About
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </label>
          <label>
            Address
            <input value={form.address} onChange={(e) => set('address', e.target.value)} />
          </label>
          <label>
            Area
            <input
              value={form.neighbourhood}
              onChange={(e) => set('neighbourhood', e.target.value)}
            />
          </label>
          <label>
            Phone
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </label>
          <label>
            Website
            <input value={form.website} onChange={(e) => set('website', e.target.value)} />
          </label>
          <label>
            Spend from (KSh)
            <input
              type="number"
              value={form.price_from}
              onChange={(e) => set('price_from', Number(e.target.value) || 0)}
            />
          </label>
          <label>
            Spend to (KSh)
            <input
              type="number"
              value={form.price_to}
              onChange={(e) => set('price_to', Number(e.target.value) || 0)}
            />
          </label>

          <div className="wide">
            <span className="field-label">Photos</span>
            {form.photos.length === 0 ? (
              <p className="cell-sub">No photos on this listing.</p>
            ) : (
              <div className="queue-photos">
                {form.photos.map((src) => (
                  <figure key={src}>
                    <img src={src} alt="" loading="lazy" />
                    <button
                      className="btn small danger"
                      onClick={() =>
                        set('photos', form.photos.filter((p) => p !== src))
                      }
                    >
                      Remove
                    </button>
                  </figure>
                ))}
              </div>
            )}
            <p className="cell-sub">
              Photos are uploaded by the owner from the app. Removing one here takes it
              off the listing.
            </p>
          </div>
        </div>

        <footer className="dialog-foot">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </footer>
      </div>
    </div>
  );
}
