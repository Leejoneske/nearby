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
import { countdown } from './lib';
import { Banner } from './components';
import { CommandBar } from './CommandBar';
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
import { useIdleSignOut } from './useIdleSignOut';

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
  const [palette, setPalette] = useState(false);
  // Set by the command bar so a section opens already searching for the thing
  // that was picked. A counter rides along, or picking the same listing twice
  // in a row would not look like a change to the page.
  const [focus, setFocus] = useState<{ term: string; nonce: number }>({ term: '', nonce: 0 });

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

  const signOut = useCallback(() => {
    void supabase.auth.signOut();
  }, []);

  /*
   * The session closes itself when the desk is empty. See `lib.ts` for why
   * that is worth having when the real boundary is in the database: this is
   * about the laptop left open, not about anybody's permissions.
   */
  const idle = useIdleSignOut(admin === true, signOut);

  /* One shortcut, and the two spellings of it that people have muscle memory
     for. Skipped while a field has focus, or ⌘K in a search box would open a
     second search box. */
  useEffect(() => {
    if (admin !== true) return;
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && key === 'k') {
        e.preventDefault();
        setPalette(true);
        return;
      }
      if (key === '/' && !e.metaKey && !e.ctrlKey) {
        const on = document.activeElement?.tagName;
        if (on === 'INPUT' || on === 'TEXTAREA' || on === 'SELECT') return;
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [admin]);

  const go = useCallback((next: Page, term?: string) => {
    setPage(next);
    if (term !== undefined) setFocus((f) => ({ term, nonce: f.nonce + 1 }));
  }, []);

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
    <div className={idle.verdict === 'warn' ? 'shell shell--warned' : 'shell'}>
      {idle.verdict === 'warn' ? (
        <div className="idle-bar" role="status">
          <span>
            Still there? This console signs itself out in {countdown(idle.secondsLeft)}.
          </span>
          <button className="btn small" onClick={idle.stayIn}>
            Keep me signed in
          </button>
        </div>
      ) : null}

      {palette ? <CommandBar onClose={() => setPalette(false)} onGo={go} /> : null}

      <nav className="sidebar">
        <div className="brand">
          <span className="brand-dot" aria-hidden="true">
            N
          </span>
          Nearby
        </div>

        <button className="nav-find" onClick={() => setPalette(true)}>
          <span>Go to…</span>
          <kbd>⌘K</kbd>
        </button>

        {/* One scrolling row on a phone, a column on a desktop. The wrapper
            is inert on wide screens and does the scrolling on narrow ones. */}
        <div className="nav-scroller">
        {GROUPS.map((group) => (
          <div className="nav-group" key={group.title}>
            <div className="nav-title">{group.title}</div>
            {group.pages.map((p) => (
              <button
                key={p.id}
                className="nav-item"
                aria-current={page === p.id ? 'page' : undefined}
                onClick={() => go(p.id)}
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
        </div>

        <div className="sidebar-foot">
          <div>{session.user.email}</div>
          <button className="btn small" onClick={signOut}>
            Sign out
          </button>
        </div>
      </nav>

      <main className="main">
        <Body page={page} onGo={go} focus={focus} />
      </main>
    </div>
  );
}

function Body({
  page,
  onGo,
  focus,
}: {
  page: Page;
  onGo: (p: Page) => void;
  /**
   * What the command bar picked, for the two screens that can search for it.
   *
   * Delivered by remounting rather than by a prop the screen watches: the
   * term is that screen's initial state, and "initial state, except when this
   * other thing changes" is an effect that copies a prop into state, which is
   * a render pass nobody needs and a rule the linter is right about.
   */
  focus: { term: string; nonce: number };
}) {
  switch (page) {
    case 'overview':
      return <Overview onGo={onGo} />;
    case 'activity':
      return <Activity />;
    case 'listings':
      return <Listings key={`listings-${focus.nonce}`} initialQuery={focus.term} />;
    case 'fraud':
      return <Fraud />;
    case 'health':
      return <Health />;
    case 'reviews':
      return <Reviews />;
    case 'reports':
      return <Reports />;
    case 'people':
      return <People key={`people-${focus.nonce}`} initialQuery={focus.term} />;
    default:
      return <Banner kind="error">That screen does not exist.</Banner>;
  }
}
