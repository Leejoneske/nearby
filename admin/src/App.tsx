/**
 * The console shell: sign in, prove you are an admin, then five screens.
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
import { Listings } from './pages/Listings';
import { Overview } from './pages/Overview';
import { People } from './pages/People';
import { Reports } from './pages/Reports';
import { Reviews } from './pages/Reviews';
import { supabase } from './supabase';

type Page = 'overview' | 'listings' | 'reviews' | 'reports' | 'people';

const PAGES: { id: Page; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'listings', label: 'Listings' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'reports', label: 'Reports' },
  { id: 'people', label: 'People' },
];

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [page, setPage] = useState<Page>('overview');
  const [openReports, setOpenReports] = useState(0);

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

  // Being signed in and being an admin are different questions, and the
  // second one is answered by the database rather than by anything here.
  useEffect(() => {
    if (!session) {
      setAdmin(null);
      return;
    }
    let alive = true;
    void amIAdmin().then((yes) => {
      if (alive) setAdmin(yes);
    });
    return () => {
      alive = false;
    };
  }, [session]);

  const refreshBadge = useCallback(() => {
    if (admin !== true) return;
    void fetchOverview()
      .then((c) => setOpenReports(c.reports_open))
      .catch(() => setOpenReports(0));
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

        {PAGES.map((p) => (
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
          </button>
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
    case 'listings':
      return <Listings />;
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
