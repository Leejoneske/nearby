import { ALL_BUSINESSES } from '../../data/businesses';
import { DEFAULT_FILTERS, type Business, type Filters } from '../../data/types';
import {
  activeFilterCount,
  haversineM,
  matchScore,
  searchBusinesses,
} from '../search';

/** Wednesday 2026-08-19, 11am — most listings in the seed data are open. */
const NOW = new Date(2026, 7, 19, 11, 0);

const filters = (patch: Partial<Filters> = {}): Filters => ({ ...DEFAULT_FILTERS, ...patch });

const idsOf = (list: Business[]) => list.map((b) => b.id);

describe('haversineM', () => {
  it('is zero for the same point', () => {
    expect(haversineM({ lat: -1.2673, lng: 36.8065 }, { lat: -1.2673, lng: 36.8065 })).toBe(0);
  });

  it('measures a short city hop within a sane range', () => {
    // Westlands to Kilimani is a few kilometres.
    const d = haversineM({ lat: -1.2673, lng: 36.8065 }, { lat: -1.2921, lng: 36.7856 });
    expect(d).toBeGreaterThan(2000);
    expect(d).toBeLessThan(6000);
  });
});

describe('matchScore', () => {
  const cafe = ALL_BUSINESSES.find((b) => b.id === 'kahawa-collective')!;

  it('matches everything on an empty query', () => {
    expect(matchScore(cafe, '   ')).toBe(1);
  });

  it('ranks a name match above a description match', () => {
    expect(matchScore(cafe, 'Kahawa')).toBeGreaterThan(matchScore(cafe, 'mezzanine'));
  });

  it('ranks an exact name above a prefix above a substring', () => {
    expect(matchScore(cafe, 'kahawa collective')).toBeGreaterThan(matchScore(cafe, 'kahawa'));
    expect(matchScore(cafe, 'kahawa')).toBeGreaterThan(matchScore(cafe, 'collective'));
  });

  it('is case insensitive', () => {
    expect(matchScore(cafe, 'KAHAWA')).toBe(matchScore(cafe, 'kahawa'));
  });

  it('returns zero when nothing matches', () => {
    expect(matchScore(cafe, 'helicopter')).toBe(0);
  });

  it('matches on neighbourhood and amenities', () => {
    expect(matchScore(cafe, 'Westlands')).toBeGreaterThan(0);
    expect(matchScore(cafe, 'wheelchair')).toBeGreaterThan(0);
  });
});

describe('searchBusinesses', () => {
  it('drops everything that does not match the query', () => {
    const results = searchBusinesses(ALL_BUSINESSES, 'helicopter', filters(), NOW);
    expect(results).toHaveLength(0);
  });

  it('puts the named business first', () => {
    const results = searchBusinesses(ALL_BUSINESSES, 'Sarabi', filters(), NOW);
    expect(results[0].id).toBe('sarabi-kitchen');
  });

  it('filters by category', () => {
    const results = searchBusinesses(ALL_BUSINESSES, '', filters({ categoryId: 'cafe' }), NOW);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((b) => b.categoryId === 'cafe')).toBe(true);
  });

  it('filters by price level', () => {
    const results = searchBusinesses(ALL_BUSINESSES, '', filters({ priceLevels: [1] }), NOW);
    expect(results.every((b) => b.priceLevel === 1)).toBe(true);
  });

  it('filters by radius', () => {
    const results = searchBusinesses(ALL_BUSINESSES, '', filters({ radiusM: 1500 }), NOW);
    expect(results.every((b) => b.distanceM <= 1500)).toBe(true);
    expect(results.length).toBeLessThan(ALL_BUSINESSES.length);
  });

  it('filters by minimum rating', () => {
    const results = searchBusinesses(ALL_BUSINESSES, '', filters({ minRating: 4.7 }), NOW);
    expect(results.every((b) => b.rating >= 4.7)).toBe(true);
  });

  it('sorts by distance, nearest first', () => {
    const results = searchBusinesses(ALL_BUSINESSES, '', filters({ sort: 'distance' }), NOW);
    const distances = results.map((b) => b.distanceM);
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
  });

  it('sorts by rating, best first', () => {
    const results = searchBusinesses(ALL_BUSINESSES, '', filters({ sort: 'rating' }), NOW);
    for (let i = 1; i < results.length; i += 1) {
      expect(results[i - 1].rating).toBeGreaterThanOrEqual(results[i].rating);
    }
  });

  it('breaks a rating tie on review count', () => {
    const results = searchBusinesses(ALL_BUSINESSES, '', filters({ sort: 'rating' }), NOW);
    const tied = results.filter((b) => b.rating === results[0].rating);
    for (let i = 1; i < tied.length; i += 1) {
      expect(tied[i - 1].reviewCount).toBeGreaterThanOrEqual(tied[i].reviewCount);
    }
  });

  it('sorts by cheapest entry price', () => {
    const results = searchBusinesses(ALL_BUSINESSES, '', filters({ sort: 'priceLow' }), NOW);
    const prices = results.map((b) => b.priceFrom);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it('honours open-now against the moment it is given', () => {
    // Mama Nia's serves lunch only, so it is shut at 11am and open at 1pm.
    const lunchOnly = 'mama-nias-kitchen';
    const atEleven = searchBusinesses(ALL_BUSINESSES, '', filters({ openNow: true }), NOW);
    const atOne = searchBusinesses(
      ALL_BUSINESSES,
      '',
      filters({ openNow: true }),
      new Date(2026, 7, 19, 13, 0),
    );
    expect(idsOf(atEleven)).not.toContain(lunchOnly);
    expect(idsOf(atOne)).toContain(lunchOnly);
  });

  it('combines filters rather than replacing them', () => {
    const results = searchBusinesses(
      ALL_BUSINESSES,
      '',
      filters({ categoryId: 'cafe', radiusM: 1500 }),
      NOW,
    );
    expect(results.every((b) => b.categoryId === 'cafe' && b.distanceM <= 1500)).toBe(true);
  });

  it('does not mutate the input list', () => {
    const before = idsOf(ALL_BUSINESSES);
    searchBusinesses(ALL_BUSINESSES, '', filters({ sort: 'rating' }), NOW);
    expect(idsOf(ALL_BUSINESSES)).toEqual(before);
  });
});

describe('activeFilterCount', () => {
  it('is zero for the defaults', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
  });

  it('counts each changed facet once', () => {
    expect(
      activeFilterCount(filters({ sort: 'rating', openNow: true, priceLevels: [1, 2] })),
    ).toBe(3);
  });
});
