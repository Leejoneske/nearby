import {
  accuracyNote,
  areaLine,
  describeAddress,
  streetLine,
  type GeocodedPlace,
} from '../place';

describe('streetLine', () => {
  it('puts the house number in front of the street', () => {
    expect(streetLine({ streetNumber: '12', street: 'Othaya Road' })).toBe('12 Othaya Road');
  });

  it('does not repeat a number the street already starts with', () => {
    expect(streetLine({ streetNumber: '12', street: '12 Othaya Road' })).toBe('12 Othaya Road');
  });

  it('takes the street alone when there is no number', () => {
    expect(streetLine({ street: 'Othaya Road' })).toBe('Othaya Road');
  });

  it('falls back to a name when there is no street', () => {
    expect(streetLine({ name: 'Kahawa House', district: 'Westlands' })).toBe('Kahawa House');
  });

  it('ignores a name that is only a house number', () => {
    expect(streetLine({ name: '12' })).toBe('');
    expect(streetLine({ name: '12-14' })).toBe('');
  });

  it('prefers a real street over a name, which is often the building', () => {
    expect(streetLine({ name: 'Kahawa House', street: 'Peponi Road' })).toBe('Peponi Road');
  });

  it('takes the head of a formatted address, never the country', () => {
    expect(
      streetLine({ formattedAddress: 'Othaya Road, Othaya, Nyeri County, Kenya' }),
    ).toBe('Othaya Road, Othaya');
  });

  it('has nothing to say when the provider gave nothing', () => {
    expect(streetLine({})).toBe('');
    expect(streetLine({ street: '   ' })).toBe('');
  });
});

describe('areaLine', () => {
  it('pairs the neighbourhood with its town', () => {
    expect(areaLine({ district: 'Westlands', city: 'Nairobi' })).toBe('Westlands, Nairobi');
  });

  it('prefers the district over the sub-county, which is the whole bug', () => {
    expect(
      areaLine({ district: 'Kihome', subregion: 'Othaya', city: 'Nyeri' }),
    ).toBe('Kihome, Nyeri');
  });

  it('still uses the sub-county when nothing finer was recorded', () => {
    expect(areaLine({ subregion: 'Othaya', city: 'Nyeri' })).toBe('Othaya, Nyeri');
  });

  it('does not say the same place twice', () => {
    expect(areaLine({ district: 'Nairobi', city: 'Nairobi' })).toBe('Nairobi');
  });

  it('climbs to the region when there is no city', () => {
    expect(areaLine({ region: 'Nyeri County' })).toBe('Nyeri County');
  });

  it('uses the fallback when the provider knew nothing', () => {
    expect(areaLine({}, 'Nairobi')).toBe('Nairobi');
  });
});

describe('describeAddress', () => {
  it('fills both fields from one lookup', () => {
    const place: GeocodedPlace = {
      streetNumber: '12',
      street: 'Othaya Road',
      district: 'Kihome',
      subregion: 'Othaya',
      city: 'Nyeri',
      country: 'Kenya',
    };
    expect(describeAddress(place)).toEqual({
      address: '12 Othaya Road',
      area: 'Kihome, Nyeri',
    });
  });

  it('leaves the address empty rather than putting an area in it', () => {
    const { address, area } = describeAddress({ subregion: 'Othaya', city: 'Nyeri' });
    expect(address).toBe('');
    expect(area).toBe('Othaya, Nyeri');
  });

  it('survives no result at all', () => {
    expect(describeAddress(undefined, 'Nairobi')).toEqual({ address: '', area: 'Nairobi' });
  });
});

describe('accuracyNote', () => {
  it('says nothing about a fix that is good enough', () => {
    expect(accuracyNote(8)).toBeNull();
    expect(accuracyNote(50)).toBeNull();
  });

  it('says nothing when the platform did not report accuracy', () => {
    expect(accuracyNote(undefined)).toBeNull();
  });

  it('warns about a fix that could be the wrong building', () => {
    expect(accuracyNote(120)).toContain('120 m');
    expect(accuracyNote(120)).toContain('Check the address');
  });

  it('is blunter about a fix that could be the wrong block', () => {
    expect(accuracyNote(900)).toContain('more than a block');
  });
});
