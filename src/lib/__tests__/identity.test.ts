/**
 * The two decisions that stand between somebody and getting into the app.
 *
 * Both were exported to be testable and then never tested, which the audit
 * caught. An address the app wrongly rejects is a person who cannot sign in
 * at all, and there is no error message that makes that acceptable.
 */
import {
  boxCount,
  cleanDisplayName,
  isDisposableEmail,
  isPlausibleEmail,
} from '../identity';
import { describePlace } from '../useOrigin';

describe('isPlausibleEmail', () => {
  it.each([
    'a@b.co',
    'john.wanderi@example.com',
    'john+nearby@example.co.ke',
    'JOHN@EXAMPLE.COM',
    '  spaced@example.com  ',
    "o'brien@example.ie",
    'a_b-c@sub.domain.example.org',
  ])('accepts %s', (input) => {
    expect(isPlausibleEmail(input)).toBe(true);
  });

  it.each([
    '',
    '   ',
    'john',
    'john@',
    '@example.com',
    'john@example',
    'john @example.com',
    'john@exa mple.com',
    'john@@example.com',
    'john@example.c',
  ])('rejects %s', (input) => {
    expect(isPlausibleEmail(input)).toBe(false);
  });

  it('is deliberately loose — the code arriving is the real test', () => {
    // Not a deliverable address, but the shape is right and refusing it would
    // be the app guessing at somebody's mail server.
    expect(isPlausibleEmail('x@y.zz')).toBe(true);
  });
});

describe('describePlace', () => {
  const FALLBACK_CITY = 'Nairobi';
  const FALLBACK_AREA = 'Nearby';

  it('names the city and the district when the lookup has both', () => {
    expect(
      describePlace(
        { city: 'Mombasa', district: 'Nyali', region: 'Coast', subregion: null },
        FALLBACK_CITY,
        FALLBACK_AREA,
      ),
    ).toEqual({ city: 'Mombasa', area: 'Nyali, Mombasa' });
  });

  it('falls back to the region when there is no city', () => {
    expect(
      describePlace(
        { city: null, district: null, region: 'Kisumu', subregion: null },
        FALLBACK_CITY,
        FALLBACK_AREA,
      ).city,
    ).toBe('Kisumu');
  });

  it('falls back to the city when the lookup names no neighbourhood', () => {
    // Not the area fallback: once we know the city, printing "Nearby" over
    // the top of it would be less true, not more.
    expect(
      describePlace(
        { city: null, district: null, region: null, subregion: null },
        FALLBACK_CITY,
        FALLBACK_AREA,
      ),
    ).toEqual({ city: FALLBACK_CITY, area: FALLBACK_CITY });
  });

  it('uses both fallbacks when there was no lookup at all', () => {
    expect(describePlace(undefined, FALLBACK_CITY, FALLBACK_AREA)).toEqual({
      city: FALLBACK_CITY,
      area: FALLBACK_AREA,
    });
  });

  it('does not print the same name twice', () => {
    const { area } = describePlace(
      { city: 'Nakuru', district: 'Nakuru', region: null, subregion: null },
      FALLBACK_CITY,
      FALLBACK_AREA,
    );
    expect(area).toBe('Nakuru');
  });
});

describe('boxCount', () => {
  it('never draws fewer than six boxes', () => {
    expect(boxCount(0)).toBe(6);
    expect(boxCount(3)).toBe(6);
    expect(boxCount(6)).toBe(6);
  });

  it('grows to fit a longer code', () => {
    // Supabase allows the OTP length to be set up to ten. An eight digit
    // code silently truncated to six is what sent somebody round in circles.
    expect(boxCount(8)).toBe(8);
    expect(boxCount(10)).toBe(10);
  });

  it('stops at ten', () => {
    expect(boxCount(11)).toBe(10);
    expect(boxCount(99)).toBe(10);
  });
});

describe('isDisposableEmail', () => {
  it('spots the common throwaway providers', () => {
    expect(isDisposableEmail('a@mailinator.com')).toBe(true);
    expect(isDisposableEmail('A@YOPMAIL.COM')).toBe(true);
    expect(isDisposableEmail('  a@10minutemail.com  ')).toBe(true);
  });

  it('lets ordinary providers through', () => {
    expect(isDisposableEmail('a@gmail.com')).toBe(false);
    expect(isDisposableEmail('a@outlook.com')).toBe(false);
    expect(isDisposableEmail('a@mycompany.co.ke')).toBe(false);
  });

  it('does not match on a substring', () => {
    // notmailinator.com is somebody else's domain entirely.
    expect(isDisposableEmail('a@notmailinator.com')).toBe(false);
  });

  it('follows the domain up, because these services hand out subdomains', () => {
    expect(isDisposableEmail('a@team.mailinator.com')).toBe(true);
    expect(isDisposableEmail('a@one.two.yopmail.com')).toBe(true);
    // Not a suffix match on a label boundary, so not blocked.
    expect(isDisposableEmail('a@mailinator.com.example.co.ke')).toBe(false);
  });

  it('says no rather than throwing on nonsense', () => {
    expect(isDisposableEmail('')).toBe(false);
    expect(isDisposableEmail('no-at-sign')).toBe(false);
  });
});

describe('cleanDisplayName', () => {
  it('collapses whitespace and trims', () => {
    expect(cleanDisplayName('  Jones   Admin  ')).toBe('Jones Admin');
  });

  it('turns tabs and newlines into a space rather than deleting them', () => {
    expect(cleanDisplayName('Jones\t\tAdmin')).toBe('Jones Admin');
    expect(cleanDisplayName('Ann\nWanjiku')).toBe('Ann Wanjiku');
  });

  it('removes zero-width and bidirectional marks', () => {
    expect(cleanDisplayName('Jo\u200Bnes')).toBe('Jones');
    expect(cleanDisplayName('abc\u202Edef')).toBe('abcdef');
  });

  it('leaves real punctuation alone', () => {
    // Stripping quotes to "prevent injection" corrupts real names, and every
    // write here goes through a bound parameter anyway.
    expect(cleanDisplayName("O'Brien-Smith")).toBe("O'Brien-Smith");
    expect(cleanDisplayName('Anne-Marie da Silva')).toBe('Anne-Marie da Silva');
  });

  it('caps the length', () => {
    expect(cleanDisplayName('x'.repeat(200))).toHaveLength(60);
  });

  it('can return empty, which the caller has to handle', () => {
    expect(cleanDisplayName('\u200B')).toBe('');
  });
});
