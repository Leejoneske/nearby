import {
  CHECK_INTERVAL_MS,
  compareVersions,
  decide,
  formatSize,
  isNewer,
  parseTag,
  shouldCheck,
  wasDismissed,
  parseDismissed,
  serialiseDismissed,
  type Release,
} from '../updates';

const release = (over: Partial<Release> = {}): Release => ({
  version: '1.4.0',
  build: 9,
  assetUrl: 'https://example.com/nearby.apk',
  ...over,
});

describe('compareVersions', () => {
  it.each([
    ['1.0.0', '1.0.0', 0],
    ['1.0.1', '1.0.0', 1],
    ['1.0.0', '1.0.1', -1],
    ['1.10.0', '1.9.0', 1],
    ['2.0.0', '1.99.99', 1],
    ['1.3', '1.3.0', 0],
    ['1.3', '1.3.1', -1],
    ['v1.3.0', '1.3.0', 0],
    [' 1.3.0 ', '1.3.0', 0],
  ] as const)('%s vs %s is %s', (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected);
  });

  it('does not throw on a version string it cannot read', () => {
    expect(() => compareVersions('nightly', '1.0.0')).not.toThrow();
    expect(compareVersions('nightly', '1.0.0')).toBe(-1);
  });
});

describe('parseTag', () => {
  it('reads our own tag format', () => {
    expect(parseTag('v1.3.0-build.8')).toEqual({ version: '1.3.0', build: 8 });
  });

  it('reads a plain version tag', () => {
    expect(parseTag('v2.0.0')).toEqual({ version: '2.0.0', build: undefined });
  });

  it('returns null for something that is not a version', () => {
    expect(parseTag('latest')).toBeNull();
  });
});

describe('isNewer', () => {
  it('is true when the version has moved', () => {
    expect(isNewer({ version: '1.3.0', build: 8 }, release())).toBe(true);
  });

  it('is false for the same version and build', () => {
    expect(isNewer({ version: '1.4.0', build: 9 }, release())).toBe(false);
  });

  it('is false for an older release, whatever its build number', () => {
    expect(isNewer({ version: '2.0.0', build: 1 }, release({ build: 99 }))).toBe(false);
  });

  it('breaks a tie on the build number, so a rebuild is still offered', () => {
    expect(isNewer({ version: '1.4.0', build: 8 }, release({ build: 9 }))).toBe(true);
  });

  it('does not offer a rebuild when either side has no build number', () => {
    expect(isNewer({ version: '1.4.0' }, release({ build: 9 }))).toBe(false);
    expect(isNewer({ version: '1.4.0', build: 8 }, release({ build: undefined }))).toBe(false);
  });
});

describe('decide', () => {
  const current = { version: '1.3.0', build: 8 };

  it('offers a download to a sideloaded build', () => {
    expect(decide(current, release(), 'sideload')).toEqual({
      kind: 'download',
      release: release(),
    });
  });

  it('sends a store build to its store instead', () => {
    expect(decide(current, release(), 'play').kind).toBe('store');
    expect(decide(current, release(), 'appStore').kind).toBe('store');
  });

  it('sends a sideloaded build to the store when there is no file to fetch', () => {
    expect(decide(current, release({ assetUrl: undefined }), 'sideload').kind).toBe('store');
  });

  it('says nothing when there is no newer release', () => {
    expect(decide(current, release({ version: '1.0.0', build: 1 }), 'sideload')).toEqual({
      kind: 'current',
    });
    expect(decide(current, null, 'sideload')).toEqual({ kind: 'current' });
  });
});

describe('shouldCheck', () => {
  const now = 1_700_000_000_000;

  it('checks when it never has', () => {
    expect(shouldCheck(null, now)).toBe(true);
  });

  it('does not check twice in a day', () => {
    expect(shouldCheck(now - 60_000, now)).toBe(false);
  });

  it('checks once a day has passed', () => {
    expect(shouldCheck(now - CHECK_INTERVAL_MS, now)).toBe(true);
  });

  it('recovers from a clock that went backwards', () => {
    expect(shouldCheck(now + 5_000, now)).toBe(true);
  });
});

describe('wasDismissed', () => {
  it('stays dismissed for the build that was turned down', () => {
    expect(wasDismissed({ version: '1.4.0', build: 9 }, release())).toBe(true);
  });

  it('asks again for a newer version', () => {
    expect(wasDismissed({ version: '1.3.0', build: 8 }, release())).toBe(false);
  });

  /*
   * The bug this replaced. A sideloaded app ships rebuilds of the same
   * version more often than it bumps the version, and comparing versions
   * alone meant one "not now" silenced every one of them.
   */
  it('asks again for a newer build of the same version', () => {
    expect(wasDismissed({ version: '1.4.0', build: 8 }, release())).toBe(false);
  });

  it('asks when nothing has been dismissed', () => {
    expect(wasDismissed(null, release())).toBe(false);
  });
});

describe('a dismissal survives storage', () => {
  it('round-trips a version and a build', () => {
    expect(parseDismissed(serialiseDismissed(release()))).toEqual({
      version: '1.4.0',
      build: 9,
    });
  });

  it('round-trips a release with no build counter', () => {
    expect(parseDismissed(serialiseDismissed(release({ build: undefined })))).toEqual({
      version: '1.4.0',
      build: undefined,
    });
  });

  it('reads a value written before builds were recorded', () => {
    expect(parseDismissed('1.4.0')).toEqual({ version: '1.4.0', build: undefined });
  });

  it('treats nothing stored as nothing dismissed', () => {
    expect(parseDismissed(null)).toBeNull();
    expect(parseDismissed('')).toBeNull();
  });
});

describe('formatSize', () => {
  it('reads in megabytes', () => {
    expect(formatSize(47_200_000)).toBe('47.2 MB');
  });

  it('says nothing when the size is unknown', () => {
    expect(formatSize(undefined)).toBeUndefined();
    expect(formatSize(0)).toBeUndefined();
  });
});
