/** Small shared pieces, each too thin to deserve its own file. */
import type { ReactNode } from 'react';

import type { BusinessStatus, ReportState } from './api';

export function Stat({
  label,
  value,
  note,
  warn,
  chart,
}: {
  label: string;
  value: number | string;
  note?: string;
  warn?: boolean;
  /** A shape behind the number. Optional: not every figure has a history. */
  chart?: ReactNode;
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value num">{value}</div>
      {note ? <div className={warn ? 'stat-note warn' : 'stat-note'}>{note}</div> : null}
      {chart ? <div className="stat-chart">{chart}</div> : null}
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

/**
 * A row of days, drawn as bars.
 *
 * Inline SVG rather than a charting library: this is one shape, the console
 * ships to a browser, and 40 kB of dependency to draw thirty rectangles is a
 * poor trade. The scale is always from zero — a bar chart cropped to its own
 * range makes a flat week look like a crisis.
 */
export function Sparkbars({
  values,
  labels,
  accent,
  height = 56,
}: {
  values: number[];
  labels: string[];
  accent?: 'accent' | 'red' | 'steel';
  height?: number;
}) {
  if (values.length === 0) return null;

  const peak = Math.max(...values, 1);
  const gap = 2;
  const width = 100;
  const slot = width / values.length;

  return (
    <svg
      className={`spark spark--${accent ?? 'accent'}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ height }}
      role="img"
      aria-label={`${values.reduce((a, b) => a + b, 0)} in total over ${values.length} days`}
    >
      {values.map((value, i) => {
        const h = Math.max((value / peak) * height, value > 0 ? 1.5 : 0);
        return (
          <rect
            key={labels[i] ?? i}
            x={i * slot}
            y={height - h}
            width={Math.max(slot - gap, 0.5)}
            height={h}
          >
            <title>{`${labels[i]}: ${value}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

/** The glyph and colour for one kind of activity. */
export const ACTIVITY_LOOK: Record<string, { label: string; tone: string }> = {
  listing: { label: 'Listing', tone: 'accent' },
  review: { label: 'Review', tone: 'amber' },
  reply: { label: 'Reply', tone: 'steel' },
  person: { label: 'Joined', tone: 'green' },
  report: { label: 'Report', tone: 'red' },
  admin: { label: 'Admin', tone: 'violet' },
  error: { label: 'Error', tone: 'red' },
};
