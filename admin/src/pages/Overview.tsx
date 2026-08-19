/**
 * What the directory looks like right now, and what people did with it.
 *
 * The old version counted rows: seven listings, four people. That is a fact
 * about the database, not about the product, and an admin opening this page
 * is asking the second question — is anybody using it, is anything broken,
 * what needs me today.
 *
 * Every figure is counted in `admin_overview()` and `admin_daily()`. Nothing
 * is estimated, projected, or filled in to make the layout look complete: a
 * plausible-looking number on a moderation console is worse than no number,
 * because somebody will act on it.
 */
import { useEffect, useState } from 'react';

import {
  fetchActivity,
  fetchDaily,
  fetchOverview,
  type Activity,
  type DailyRow,
  type Overview as Counts,
} from '../api';
import { ACTIVITY_LOOK, Banner, Empty, Sparkbars, Stat, ago } from '../components';

type Page = 'overview' | 'listings' | 'reviews' | 'reports' | 'people' | 'activity' | 'health';

export function Overview({ onGo }: { onGo: (page: Page) => void }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [feed, setFeed] = useState<Activity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const [c, d, a] = await Promise.all([
          fetchOverview(),
          fetchDaily(30),
          fetchActivity({ days: 7, limit: 12 }),
        ]);
        if (!alive) return;
        setCounts(c);
        setDaily(d);
        setFeed(a);
        setError(null);
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
  }, [reloads]);

  const labels = daily.map((row) => row.day);
  const rating = counts?.rating_average == null ? null : Number(counts.rating_average);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p>Counted just now. The last seven days unless a tile says otherwise.</p>
        </div>
        <button
          className="btn small"
          onClick={() => {
            setLoading(true);
            setReloads((n) => n + 1);
          }}
        >
          Refresh
        </button>
      </div>

      {error ? <Banner kind="error">{error}</Banner> : null}

      {/* What needs somebody today, before anything that is merely interesting. */}
      {counts ? (
        <div className="attention">
          <Todo
            label="Waiting for review"
            count={counts.listings_pending}
            done="No listings waiting"
            onGo={() => onGo('listings')}
          />
          <Todo
            label="Open reports"
            count={counts.reports_open}
            done="Nothing reported"
            onGo={() => onGo('reports')}
          />
          <Todo
            label="People hit an error"
            count={counts.errors_people_week}
            done="No errors this week"
            onGo={() => onGo('health')}
          />
        </div>
      ) : null}

      {counts ? (
        <>
          <h2 className="section-title">Use</h2>
          <div className="stats">
            <Stat
              label="Listings opened"
              value={counts.views_week}
              note="in the last seven days"
              chart={
                <Sparkbars values={daily.map((r) => r.views)} labels={labels} />
              }
            />
            <Stat
              label="Calls"
              value={counts.calls_week}
              note="tapped from a listing"
              chart={<Sparkbars values={daily.map((r) => r.calls)} labels={labels} />}
            />
            <Stat
              label="Directions"
              value={counts.directions_week}
              note="somebody set off"
              chart={<Sparkbars values={daily.map((r) => r.directions)} labels={labels} />}
            />
            <Stat
              label="People who did something"
              value={counts.people_active_week}
              note={`of ${counts.people} accounts`}
            />
          </div>

          <h2 className="section-title">The directory</h2>
          <div className="stats">
            <Stat
              label="Live listings"
              value={counts.listings_live}
              note={`${counts.listings_new_week} added this week`}
              chart={<Sparkbars values={daily.map((r) => r.listings)} labels={labels} accent="steel" />}
            />
            <Stat
              label="Waiting to verify"
              value={counts.listings_unverified}
              note={counts.listings_unverified > 0 ? 'Live, unconfirmed' : 'All confirmed'}
              warn={counts.listings_unverified > 0}
            />
            <Stat label="Suspended" value={counts.listings_suspended} note="Hidden from search" />
            <Stat
              label="Average rating"
              value={rating === null ? '—' : rating.toFixed(2)}
              note="across listings with a review"
            />
          </div>

          <h2 className="section-title">People and reviews</h2>
          <div className="stats">
            <Stat
              label="People"
              value={counts.people}
              note={`${counts.people_new_week} joined this week`}
              chart={<Sparkbars values={daily.map((r) => r.people)} labels={labels} accent="steel" />}
            />
            <Stat
              label="Reviews"
              value={counts.reviews_total}
              note={`${counts.reviews_new_week} written this week`}
              chart={<Sparkbars values={daily.map((r) => r.reviews)} labels={labels} accent="steel" />}
            />
            <Stat
              label="Awaiting an owner reply"
              value={counts.reviews_unanswered}
              note="nobody has answered these"
            />
            <Stat
              label="Unread notifications"
              value={counts.notifications_unread}
              note="sent, not yet opened"
            />
          </div>

          <h2 className="section-title">Health</h2>
          <div className="stats">
            <Stat
              label="Errors"
              value={counts.errors_week}
              note={`${counts.errors_people_week} ${
                counts.errors_people_week === 1 ? 'person' : 'people'
              } affected`}
              warn={counts.errors_week > 0}
              chart={<Sparkbars values={daily.map((r) => r.errors)} labels={labels} accent="red" />}
            />
          </div>
        </>
      ) : null}

      <div className="page-head" style={{ marginTop: 24 }}>
        <div>
          <h2 style={{ fontSize: 16 }}>Latest activity</h2>
          <p>Everything from the last week, newest first.</p>
        </div>
        <button className="btn small" onClick={() => onGo('activity')}>
          See all
        </button>
      </div>

      <div className="table-wrap">
        {feed.length === 0 ? (
          <Empty
            title={loading ? 'Loading…' : 'Nothing has happened yet'}
            body="Listings, reviews, reports, admin changes and errors all show up here."
          />
        ) : (
          <ul className="feed">
            {feed.map((row, i) => (
              <FeedRow key={`${row.at}-${i}`} row={row} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/**
 * One thing that might need doing.
 *
 * Zero is not hidden. "No listings waiting" is information; an absent tile is
 * ambiguous between nothing to do and a page that failed to load.
 */
function Todo({
  label,
  count,
  done,
  onGo,
}: {
  label: string;
  count: number;
  done: string;
  onGo: () => void;
}) {
  if (count === 0) {
    return (
      <div className="todo todo--clear">
        <span className="todo-check" aria-hidden="true">
          ✓
        </span>
        {done}
      </div>
    );
  }
  return (
    <button className="todo todo--waiting" onClick={onGo}>
      <span className="todo-count num">{count}</span>
      <span>{label}</span>
      <span className="todo-go" aria-hidden="true">
        →
      </span>
    </button>
  );
}

export function FeedRow({ row }: { row: Activity }) {
  const look = ACTIVITY_LOOK[row.kind] ?? { label: row.kind, tone: 'quiet' };
  return (
    <li className="feed-row">
      <span className={`feed-tag tone-${look.tone}`}>{look.label}</span>
      <div className="feed-body">
        <div className="feed-title">{row.title}</div>
        {row.detail ? <div className="feed-detail">{row.detail}</div> : null}
        {row.actor_name ? <div className="feed-actor">{row.actor_name}</div> : null}
      </div>
      <time className="feed-when" dateTime={row.at}>
        {ago(row.at)}
      </time>
    </li>
  );
}
