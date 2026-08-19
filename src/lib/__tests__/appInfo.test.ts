import { formatVersion, formatVersionWithBuild, parseBuild } from '../appInfo';

describe('parseBuild', () => {
  it('reads the number both platforms report as a string', () => {
    expect(parseBuild('12')).toBe(12);
    expect(parseBuild(12)).toBe(12);
  });

  it('treats a missing or unusable value as no build number', () => {
    expect(parseBuild(null)).toBeNull();
    expect(parseBuild(undefined)).toBeNull();
    expect(parseBuild('')).toBeNull();
    expect(parseBuild('not-a-number')).toBeNull();
  });

  it('keeps zero, which is a real build number and not an absence', () => {
    expect(parseBuild(0)).toBe(0);
    expect(parseBuild('0')).toBe(0);
  });
});

describe('formatVersion', () => {
  it('shows the version alone, because the build counter is for the machine', () => {
    expect(formatVersion({ version: '1.0.0', build: 7 })).toBe('1.0.0');
  });

  it('reads the same where there is no counter, as on the web build', () => {
    expect(formatVersion({ version: '1.2.3', build: null })).toBe('1.2.3');
  });

  it('keeps a build of zero rather than treating it as missing', () => {
    expect(formatVersionWithBuild({ version: '1.0.0', build: 0 })).toBe('1.0.0 (0)');
  });

  it('does not invent a version it does not have', () => {
    expect(formatVersion({ version: '', build: 4 })).toBe('Unknown');
  });
});

describe('formatVersionWithBuild', () => {
  it('keeps both, for a bug report or a log line', () => {
    expect(formatVersionWithBuild({ version: '1.6.0', build: 12 })).toBe('1.6.0 (12)');
    expect(formatVersionWithBuild({ version: '1.6.0', build: null })).toBe('1.6.0');
  });
});
