/** Small shared pieces, each too thin to deserve its own file. */
import type { ReactNode } from 'react';

import type { BusinessStatus, ReportState } from './api';

export function Stat({
  label,
  value,
  note,
  warn,
}: {
  label: string;
  value: number | string;
  note?: string;
  warn?: boolean;
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value num">{value}</div>
      {note ? <div className={warn ? 'stat-note warn' : 'stat-note'}>{note}</div> : null}
    </div>
  );
}

export function StatusPill({ status }: { status: BusinessStatus }) {
  const label = { live: 'Live', pending: 'Pending', suspended: 'Suspended' }[status];
  return <span className={`pill ${status}`}>{label}</span>;
}

export function ReportPill({ state }: { state: ReportState }) {
  const label = { open: 'Open', actioned: 'Actioned', dismissed: 'Dismissed' }[state];
  return <span className={`pill ${state}`}>{label}</span>;
}

/**
 * What a table says when it has nothing in it.
 *
 * Always distinguishes "there is none of this" from "your filter excluded it
 * all" — an empty screen that does not say which is a bug report waiting to
 * be filed.
 */
export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {body}
    </div>
  );
}

export function Banner({ kind, children }: { kind: 'error' | 'info'; children: ReactNode }) {
  return (
    <div className={`banner ${kind}`} role={kind === 'error' ? 'alert' : undefined}>
      {children}
    </div>
  );
}

/** "3 days ago". Dense tables read better than a wall of timestamps. */
export function ago(iso: string | null, now = new Date()): string {
  if (!iso) return '—';
  const then = new Date(iso);
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (days < 0) return then.toISOString().slice(0, 10);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return then.toISOString().slice(0, 10);
}
