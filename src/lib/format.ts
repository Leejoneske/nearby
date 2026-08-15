/** Display formatting. Pure, so the strings can be asserted in tests. */

/** "450 m" under a kilometre, "1.2 km" above it. */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  const km = metres / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** "$$" from a 1–4 price level. */
export function formatPriceLevel(level: number): string {
  const clamped = Math.max(1, Math.min(4, Math.round(level)));
  return '$'.repeat(clamped);
}

const CURRENCY = 'KSh';

/** "KSh 500 – 1,500", the price row from the listing reference. */
export function formatPriceRange(from: number, to: number): string {
  return `${CURRENCY} ${withThousands(from)} – ${withThousands(to)}`;
}

export function formatMoney(amount: number): string {
  return `${CURRENCY} ${withThousands(amount)}`;
}

function withThousands(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** "4.5" — always one decimal, so rows in a list stay aligned. */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/** "423 reviews", "1 review", "1.2k reviews". */
export function formatReviewCount(count: number): string {
  if (count === 1) return '1 review';
  if (count < 1000) return `${count} reviews`;
  return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k reviews`;
}

/** "2 days ago" / "3 weeks ago", relative to `now`. */
export function formatRelativeDate(iso: string, now: Date): string {
  const then = new Date(iso).getTime();
  const days = Math.floor((now.getTime() - then) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? 'A week ago' : `${weeks} weeks ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? 'A month ago' : `${months} months ago`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? 'A year ago' : `${years} years ago`;
}

/** "JW" from "John Wanderi" — used for avatar fallbacks. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "+18%" / "−4%" / "No change" for the owner insight tiles. */
export function formatDelta(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? 'No change' : 'New';
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return 'No change';
  return pct > 0 ? `+${pct}%` : `−${Math.abs(pct)}%`;
}
