import {
  looksBusy,
  MANY_DEVICES,
  placeLabel,
  prettyPlatform,
  sortDevices,
  type DeviceRow,
} from '../devices';

const row = (over: Partial<DeviceRow> = {}): DeviceRow => ({
  fingerprint: 'aaa',
  platform: 'android 34',
  country: '',
  lat: null,
  lng: null,
  firstSeen: '2026-08-01T00:00:00Z',
  lastSeen: '2026-08-10T00:00:00Z',
  seenCount: 3,
  ...over,
});

describe('prettyPlatform', () => {
  it('translates an Android API level into the version people know', () => {
    expect(prettyPlatform('android 34')).toBe('Android 14');
    expect(prettyPlatform('android 30')).toBe('Android 11');
  });

  it('keeps an unknown level rather than inventing one', () => {
    expect(prettyPlatform('android 99')).toBe('Android 99');
    expect(prettyPlatform('android')).toBe('Android');
  });

  it('leaves an iOS version alone, because it is already the real one', () => {
    expect(prettyPlatform('ios 18.2')).toBe('iOS 18.2');
  });

  it('names the web build as a browser', () => {
    expect(prettyPlatform('web')).toBe('A web browser');
  });

  it('says so when there is nothing recorded', () => {
    expect(prettyPlatform('')).toBe('Unknown device');
    expect(prettyPlatform('   ')).toBe('Unknown device');
  });
});

describe('placeLabel', () => {
  it('prefers the country when there is one', () => {
    expect(placeLabel({ country: 'ke', lat: 1.29, lng: 36.82 })).toBe('KE');
  });

  it('falls back to a rounded position, which is about a kilometre', () => {
    expect(placeLabel({ country: '', lat: 1.2921, lng: 36.8219 })).toBe('Around 1.29, 36.82');
  });

  it('says nothing was recorded rather than showing a zero', () => {
    expect(placeLabel({ country: '', lat: null, lng: null })).toBe('Location not recorded');
  });
});

describe('sortDevices', () => {
  it('puts the phone in your hand first', () => {
    const rows = [
      row({ fingerprint: 'old', lastSeen: '2026-08-19T00:00:00Z' }),
      row({ fingerprint: 'mine', lastSeen: '2026-08-01T00:00:00Z' }),
    ];
    expect(sortDevices(rows, 'mine').map((r) => r.fingerprint)).toEqual(['mine', 'old']);
  });

  it('orders the rest by when they were last used', () => {
    const rows = [
      row({ fingerprint: 'a', lastSeen: '2026-08-01T00:00:00Z' }),
      row({ fingerprint: 'b', lastSeen: '2026-08-19T00:00:00Z' }),
      row({ fingerprint: 'c', lastSeen: '2026-08-10T00:00:00Z' }),
    ];
    expect(sortDevices(rows, null).map((r) => r.fingerprint)).toEqual(['b', 'c', 'a']);
  });

  it('does not modify what it was given', () => {
    const rows = [row({ fingerprint: 'a' }), row({ fingerprint: 'b' })];
    sortDevices(rows, 'b');
    expect(rows.map((r) => r.fingerprint)).toEqual(['a', 'b']);
  });
});

describe('looksBusy', () => {
  it('is quiet about an ordinary number of devices', () => {
    expect(looksBusy([row(), row()])).toBe(false);
  });

  it('speaks up at the same threshold the fraud rules use', () => {
    expect(looksBusy(Array.from({ length: MANY_DEVICES }, () => row()))).toBe(true);
  });
});
