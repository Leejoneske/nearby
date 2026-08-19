/**
 * Deciding whether there is a newer version, and what to do about it.
 *
 * All of it is pure. Whether an update exists is arithmetic on two version
 * strings, and arithmetic should not need a network to test — the I/O half
 * lives in `updateService.ts`.
 */

/** Where this build came from, which decides how it can be updated. */
export type Channel = 'sideload' | 'play' | 'appStore';

export type Release = {
  /** "1.3.0" */
  version: string;
  /** The build counter, when the source publishes one. */
  build?: number;
  /** Where the installable file is, for a sideloaded build. */
  assetUrl?: string;
  /** Bytes, when known, so the prompt can say how big the download is. */
  sizeBytes?: number;
  notes?: string;
};

export type UpdateDecision =
  | { kind: 'current' }
  | { kind: 'download'; release: Release }
  | { kind: 'store'; release: Release };

/**
 * Compares two dotted version strings. Returns -1, 0 or 1.
 *
 * Missing segments count as zero, so "1.3" and "1.3.0" are the same version.
 * Anything non-numeric in a segment is ignored rather than throwing: a
 * version string we cannot parse must never be the reason the app crashes on
 * launch.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const parse = (v: string) =>
    v
      .trim()
      .replace(/^v/i, '')
      .split(/[.\-+]/)
      .map((part) => Number.parseInt(part, 10))
      .filter((n) => Number.isFinite(n));

  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i += 1) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    if (l < r) return -1;
    if (l > r) return 1;
  }
  return 0;
}

/**
 * Pulls a version and build out of a release tag.
 *
 * Our tags look like `v1.3.0-build.8`. A plain `v1.3.0` is also valid and
 * simply has no build number.
 */
export function parseTag(tag: string): { version: string; build?: number } | null {
  const match = /^v?(\d+(?:\.\d+)*)(?:-build\.(\d+))?/i.exec(tag.trim());
  if (!match) return null;
  return {
    version: match[1],
    build: match[2] ? Number.parseInt(match[2], 10) : undefined,
  };
}

/**
 * Is `release` newer than what is installed?
 *
 * The version decides it. The build number only breaks a tie, which is what
 * makes a rebuild of the same version — a fix that did not move the public
 * version — still offerable.
 */
export function isNewer(
  installed: { version: string; build?: number },
  release: Release,
): boolean {
  const byVersion = compareVersions(release.version, installed.version);
  if (byVersion !== 0) return byVersion > 0;

  if (release.build === undefined || installed.build === undefined) return false;
  return release.build > installed.build;
}

/**
 * What the app should offer.
 *
 * A sideloaded build can fetch and install the new one itself. A build from a
 * store cannot — the store owns installation — so the most it can do is say
 * there is one and open the listing.
 */
export function decide(
  installed: { version: string; build?: number },
  release: Release | null,
  channel: Channel,
): UpdateDecision {
  if (!release || !isNewer(installed, release)) return { kind: 'current' };
  if (channel === 'sideload' && release.assetUrl) return { kind: 'download', release };
  return { kind: 'store', release };
}

/** "47.2 MB". Undefined when the source did not say. */
export function formatSize(bytes: number | undefined): string | undefined {
  if (!bytes || bytes <= 0) return undefined;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/**
 * Should we look again yet?
 *
 * Checking on every launch is a request per cold start for an answer that
 * changes every few days. Once a day is plenty, and a device with no stored
 * answer checks immediately.
 */
/*
 * How long to wait before looking again *while the app is already running*.
 *
 * A cold start never waits at all: see `shouldCheck`. This only paces the
 * re-check that happens when somebody switches back to the app, where
 * checking on every alt-tab would be a request per glance.
 *
 * The number used to be a day, and that is the whole story of "it does not
 * notice updates". Install a build, launch it once, the clock is stamped; a
 * new build ships four hours later and the app cannot see it until tomorrow.
 * Which is exactly what happened between 1.6.0 and 1.7.0.
 */
export const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Should we look again yet?
 *
 * `coldStart` is the important argument. Opening the app fresh is the moment
 * somebody is most likely to be told about a new version, and it happens
 * rarely enough that one small JSON fetch costs nothing. So a cold start
 * always checks, and the interval only paces the re-checks after it.
 */
export function shouldCheck(
  lastCheckedAt: number | null,
  now: number,
  coldStart = false,
): boolean {
  if (coldStart) return true;
  if (lastCheckedAt === null) return true;
  // A clock that has gone backwards would otherwise never check again.
  if (lastCheckedAt > now) return true;
  return now - lastCheckedAt >= CHECK_INTERVAL_MS;
}

/** What a dismissal remembers. */
export type Dismissed = { version: string; build?: number };

/**
 * Has this build already been turned down?
 *
 * Declining an update means "not this one", not "never ask again" — so the
 * dismissal is recorded and a newer release asks afresh.
 *
 * The build counter is part of the record, and that was the bug: it used to
 * compare versions alone, so turning down 1.5.0 build 11 also silenced 1.5.0
 * build 12. Rebuilds of the same version are exactly what a sideloaded app
 * ships most often, which made a single "not now" mute the update prompt for
 * the rest of that version's life.
 */
export function wasDismissed(dismissed: Dismissed | null, release: Release): boolean {
  if (!dismissed) return false;
  return !isNewer(dismissed, release);
}

/** Round-trips a dismissal through storage. "1.5.0" or "1.5.0+11". */
export function serialiseDismissed(release: Release): string {
  return release.build === undefined ? release.version : `${release.version}+${release.build}`;
}

export function parseDismissed(raw: string | null): Dismissed | null {
  if (!raw) return null;
  const [version, build] = raw.split('+');
  if (!version) return null;
  const parsed = Number.parseInt(build ?? '', 10);
  return { version, build: Number.isFinite(parsed) ? parsed : undefined };
}
