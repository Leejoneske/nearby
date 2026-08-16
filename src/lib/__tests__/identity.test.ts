/**
 * The two decisions that stand between somebody and getting into the app.
 *
 * Both were exported to be testable and then never tested, which the audit
 * caught. An address the app wrongly rejects is a person who cannot sign in
 * at all, and there is no error message that makes that acceptable.
 */
import { isPlausibleEmail } from '../identity';
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
