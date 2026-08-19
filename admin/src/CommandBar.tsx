/**
 * One box that goes anywhere.
 *
 * The console has eight sections and four of them have their own search
 * field, which means finding one listing is: pick the section, wait for it to
 * load, find the field, type, wait again. This is the same trip in one step,
 * and it is the thing an admin does most.
 *
 * Sections are matched locally and appear instantly. Listings and accounts
 * are a query, so they arrive a moment later and are appended rather than
 * replacing what is already on screen — a list that empties itself while you
 * are still typing is a list you stop trusting.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Page } from './App';
import { fetchBusinesses, fetchPeople } from './api';
import { matches, score } from './lib';

type Hit = {
  key: string;
  kind: 'Section' | 'Listing' | 'Account';
  label: string;
  detail: string;
  rank: number;
  go: () => void;
};

const SECTIONS: { id: Page; label: string; detail: string }[] = [
  { id: 'overview', label: 'Overview', detail: 'The numbers, and what needs a person' },
  { id: 'activity', label: 'Activity', detail: 'Everything that happened, newest first' },
  { id: 'listings', label: 'Listings', detail: 'Review, verify, edit, suspend' },
  { id: 'reviews', label: 'Reviews', detail: 'What people wrote, and what was answered' },
  { id: 'reports', label: 'Reports', detail: 'What was reported, and by whom' },
  { id: 'people', label: 'People', detail: 'Accounts, and what each one has done' },
  { id: 'fraud', label: 'Signals', detail: 'Shared devices and flagged accounts' },
  { id: 'health', label: 'Health', detail: 'Errors people are actually hitting' },
];

export function CommandBar({
  onClose,
  onGo,
}: {
  onClose: () => void;
  /** A section, and optionally something to put in that section's search. */
  onGo: (page: Page, focus?: string) => void;
}) {
  const [term, setTerm] = useState('');
  const [remote, setRemote] = useState<Hit[]>([]);
  const [at, setAt] = useState(0);
  const [searching, setSearching] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const jump = useCallback(
    (page: Page, focus?: string) => {
      onGo(page, focus);
      onClose();
    },
    [onGo, onClose],
  );

  /*
   * Two queries behind one debounce. A remote result that arrives after the
   * term has moved on is dropped by the sequence check rather than shown: out
   * of order responses are how a search box ends up displaying the answer to
   * a question you already retyped.
   */
  const seq = useRef(0);
  useEffect(() => {
    const wanted = term.trim();
    if (wanted.length < 2) {
      const mine = ++seq.current;
      const timer = window.setTimeout(() => {
        if (seq.current === mine) {
          setRemote([]);
          setSearching(false);
        }
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const mine = ++seq.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        setSearching(true);
        const [listings, people] = await Promise.all([
          fetchBusinesses({ query: wanted }).catch(() => []),
          fetchPeople({ query: wanted }).catch(() => []),
        ]);
        if (seq.current !== mine) return;

        const hits: Hit[] = [
          ...listings.slice(0, 6).map((b) => ({
            key: `b:${b.id}`,
            kind: 'Listing' as const,
            label: b.name,
            detail: [b.category, b.neighbourhood, b.status].filter(Boolean).join(' · '),
            rank: score(b.name, wanted) + 1,
            go: () => jump('listings', b.name),
          })),
          ...people.slice(0, 6).map((p) => ({
            key: `p:${p.id}`,
            kind: 'Account' as const,
            label: p.name || 'No name yet',
            detail: [p.email, p.suspended_at ? 'suspended' : null].filter(Boolean).join(' · '),
            rank: score(`${p.name ?? ''} ${p.email ?? ''}`, wanted),
            go: () => jump('people', p.email || p.name || ''),
          })),
        ];

        setRemote(hits);
        setSearching(false);
        setAt(0);
      })();
    }, 220);

    return () => window.clearTimeout(timer);
  }, [term, jump]);

  const local: Hit[] = SECTIONS.filter((s) => matches(`${s.label} ${s.detail}`, term)).map(
    (s) => ({
      key: `s:${s.id}`,
      kind: 'Section' as const,
      label: s.label,
      detail: s.detail,
      rank: score(s.label, term) + 2,
      go: () => jump(s.id),
    }),
  );

  const hits = [...local, ...remote].sort((a, b) => b.rank - a.rank).slice(0, 14);
  const chosen = hits[Math.min(at, Math.max(hits.length - 1, 0))];

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault();
      setAt((n) => (hits.length === 0 ? 0 : (n + 1) % hits.length));
      return;
    }
    if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault();
      setAt((n) => (hits.length === 0 ? 0 : (n - 1 + hits.length) % hits.length));
      return;
    }
    if (e.key === 'Enter' && chosen) {
      e.preventDefault();
      chosen.go();
    }
  };

  // Keep the highlighted row on screen when the arrow keys walk off the end.
  useEffect(() => {
    listRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [at, hits.length]);

  return (
    <div className="palette-backdrop" role="presentation" onClick={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Go to"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          className="palette-input"
          type="text"
          value={term}
          autoFocus
          placeholder="Go to a section, a listing or an account"
          aria-label="Search"
          onChange={(e) => {
            setTerm(e.target.value);
            setAt(0);
          }}
          onKeyDown={onKey}
        />

        <div className="palette-hits" ref={listRef} role="listbox" aria-label="Results">
          {hits.length === 0 ? (
            <div className="palette-none">
              {searching ? 'Looking…' : 'Nothing matches that.'}
            </div>
          ) : (
            hits.map((hit, i) => (
              <button
                key={hit.key}
                type="button"
                role="option"
                aria-selected={hit === chosen}
                className="palette-hit"
                onMouseEnter={() => setAt(i)}
                onClick={hit.go}
              >
                <span className="palette-kind">{hit.kind}</span>
                <span className="palette-label">{hit.label}</span>
                <span className="palette-detail">{hit.detail}</span>
              </button>
            ))
          )}
        </div>

        <div className="palette-foot">
          <span>↑↓ to move · ⏎ to open · esc to close</span>
          {searching ? <span>Searching…</span> : null}
        </div>
      </div>
    </div>
  );
}
