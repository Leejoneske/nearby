/**
 * The console shell: sign in, prove you are an admin, then the sections.
 *
 * There are three states here and they are deliberately different: not signed
 * in, signed in but not an admin, and in. The middle one matters — somebody
 * with an ordinary Nearby account who finds this URL should be told plainly
 * that it is not for them, not left staring at empty tables wondering whether
 * the page is broken.
 *
 * None of this is the security boundary. Every query and every write is
 * refused by the database for anybody without a row in `admins`; hiding the
 * screens is a courtesy, not a lock.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { amIAdmin, fetchOverview } from './api';
import { Banner } from './components';
import { SignIn } from './SignIn';
import { Activity } from './pages/Activity';
import { Fraud } from './pages/Fraud';
import { Health } from './pages/Health';
import { Listings } from './pages/Listings';
import { Overview } from './pages/Overview';
import { People } from './pages/People';
import { Reports } from './pages/Reports';
import { Reviews } from './pages/Reviews';
import { supabase } from './supabase';

export type Page =
  | 'overview'
  | 'activity'
  | 'listings'
  | 'reviews'
  | 'reports'
  | 'people'
  | 'fraud'
  | 'health';

/*
 * Grouped, because a flat list of seven is a list you scan every time.
 * Watching what is happening, moderating what is in the directory, and
 * checking whether the thing works are three different jobs.
 */
const GROUPS: { title: string; pages: { id: Page; label: string }[] }[] = [
  {
    title: 'Watch',
    pages: [
      { id: 'overview', label: 'Overview' },
      { id: 'activity', label: 'Activity' },
    ],
  },
  {
    title: 'Moderate',
    pages: [
      { id: 'listings', label: 'Listings' },
      { id: 'reviews', label: 'Reviews' },
      { id: 'reports', label: 'Reports' },
      { id: 'people', label: 'People' },
    ],
  },
  {
    title: 'Diagnose',
    pages: [
      { id: 'fraud', label: 'Signals' },
      { id: 'health', label: 'Health' },
    ],
  },
];

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [page, setPage] = useState<Page>('overview');
  // The three counts worth carrying in the sidebar: things waiting on a
  // person. Anything else there would be decoration on a navigation bar.
  const [openReports, setOpenReports] = useState(0);
  const [pending, setPending] = useState(0);
  const [errors, setErrors] = useState(0);
  const [flagged, setFlagged] = useState(0);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setChecked(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setChecked(true);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  /*
   * Being signed in and being an admin are different questions, and the
   * second one is answered by the database rather than by anything here.
   *
   * The clear-on-signed-out happens inside the async body with the rest of
   * it, so no branch of this effect sets state as it runs — a synchronous
   * setState in an effect body is a second render before the first has been
   * painted.
   */
  useEffect(() => {
    let alive = true;
    (async () => {
      const yes = session ? await amIAdmin() : null;
      if (alive) setAdmin(yes);
    })();
    return () => {
      alive = false;
    };
  }, [session]);

  const refreshBadge = useCallback(() => {
    if (admin !== true) return;
    void fetchOverview()
      .then((c) => {
        setOpenReports(c.reports_open);
        setPending(c.listings_pending);
        setErrors(c.errors_people_week);
        setFlagged(c.people_flagged);
      })
      .catch(() => {
        setOpenReports(0);
        setPending(0);
        setErrors(0);
        setFlagged(0);
      });
  }, [admin]);

  useEffect(refreshBadge, [refreshBadge, page]);

  if (!checked) {
    return (
      <div className="gate">
        <div className="gate-card">
          <p style={{ margin: 0 }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!session) return <SignIn />;

  if (admin === null) {
    return (
      <div className="gate">
        <div className="gate-card">
          <p style={{ margin: 0 }}>Checking your account…</p>
        </div>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="gate">
        <div className="gate-card">
          <h1>Not your console</h1>
          <p>
            You are signed in as {session.user.email}, but that account does not have
            access here. If that seems wrong, ask whoever set up your access.
          </p>
          <button className="btn" onClick={() => void supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">
          <span className="brand-dot" aria-hidden="true">
            N
          </span>
          Nearby
        </div>

        {GROUPS.map((group) => (
          <div className="nav-group" key={group.title}>
            <div className="nav-title">{group.title}</div>
            {group.pages.map((p) => (
              <button
                key={p.id}
                className="nav-item"
                aria-current={page === p.id ? 'page' : undefined}
                onClick={() => setPage(p.id)}
              >
                {p.label}
                {p.id === 'reports' && openReports > 0 ? (
                  <span className="nav-count">{openReports}</span>
                ) : null}
                {p.id === 'listings' && pending > 0 ? (
                  <span className="nav-count">{pending}</span>
                ) : null}
                {p.id === 'health' && errors > 0 ? (
                  <span className="nav-count">{errors}</span>
                ) : null}
                {p.id === 'fraud' && flagged > 0 ? (
                  <span className="nav-count">{flagged}</span>
                ) : null}
              </button>
            ))}
          </div>
        ))}

        <div className="sidebar-foot">
          <div>{session.user.email}</div>
          <button className="btn small" onClick={() => void supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </nav>

      <main className="main">
        <Body page={page} onGo={setPage} />
      </main>
    </div>
  );
}

function Body({ page, onGo }: { page: Page; onGo: (p: Page) => void }) {
  switch (page) {
    case 'overview':
      return <Overview onGo={onGo} />;
    case 'activity':
      return <Activity />;
    case 'listings':
      return <Listings />;
    case 'fraud':
      return <Fraud />;
    case 'health':
      return <Health />;
    case 'reviews':
      return <Reviews />;
    case 'reports':
      return <Reports />;
    case 'people':
      return <People />;
    default:
      return <Banner kind="error">That screen does not exist.</Banner>;
  }
}
