/**
 * Businesses for the tests to rank.
 *
 * These live here rather than in `src/data` on purpose: the app's listings now
 * come from the database, and a test that needs a network round trip is a test
 * nobody runs. These are shaped to exercise the ranking rules — a tie on
 * rating, a lunch-only opening pattern, a spread of distances and prices.
 */
import type { Business, WeekHours } from '../../data/types';

const t = (hours: number) => Math.round(hours * 60);

function week(weekday: [number, number] | null, sat?: [number, number] | null, sun?: [number, number] | null): WeekHours {
  const wd = weekday ? { open: weekday[0], close: weekday[1] } : null;
  return [
    sun ? { open: sun[0], close: sun[1] } : null,
    wd, wd, wd, wd, wd,
    sat ? { open: sat[0], close: sat[1] } : null,
  ];
}

const base: Omit<Business, 'id' | 'name' | 'categoryId'> = {
  tagline: '',
  description: '',
  rating: 4,
  reviewCount: 100,
  priceLevel: 2,
  priceFrom: 500,
  priceTo: 1500,
  address: '',
  neighbourhood: '',
  phone: '',
  lat: -1.2673,
  lng: 36.8065,
  distanceM: 1000,
  photos: [],
  hours: week([t(9), t(17)]),
  amenities: [],
  reviews: [],
};

export const TEST_BUSINESSES: Business[] = [
  {
    ...base,
    id: 'kahawa-collective',
    name: 'Kahawa Collective',
    categoryId: 'cafe',
    tagline: 'Specialty coffee roaster',
    description: 'Beans roasted in-house on a mezzanine full of laptops.',
    rating: 4.8,
    reviewCount: 423,
    neighbourhood: 'Westlands',
    address: 'Peponi Road, Westlands',
    amenities: ['Free wifi', 'Wheelchair access'],
    distanceM: 420,
    priceFrom: 350,
    priceTo: 1200,
    hours: week([t(6.5), t(20)], [t(7), t(21)], [t(8), t(18)]),
  },
  {
    ...base,
    id: 'sarabi-kitchen',
    name: 'Sarabi Kitchen',
    categoryId: 'restaurant',
    rating: 4.6,
    reviewCount: 1284,
    neighbourhood: 'Kilimani',
    distanceM: 2600,
    priceLevel: 3,
    priceFrom: 1800,
    priceTo: 4500,
    hours: week([t(12), t(22.5)]),
  },
  {
    ...base,
    id: 'the-cut-room',
    name: 'The Cut Room',
    categoryId: 'beauty',
    // Same rating as Mama Nia's, more reviews — exercises the tie-break.
    rating: 4.9,
    reviewCount: 612,
    neighbourhood: 'Adams Arcade',
    distanceM: 3400,
    priceFrom: 800,
    priceTo: 2500,
    hours: week([t(8), t(19)]),
  },
  {
    ...base,
    id: 'mama-nias-kitchen',
    name: "Mama Nia's Kitchen",
    categoryId: 'restaurant',
    rating: 4.9,
    reviewCount: 88,
    neighbourhood: 'CBD',
    distanceM: 4700,
    priceLevel: 1,
    priceFrom: 250,
    priceTo: 600,
    // Lunch only, so "open now" depends on the hour it is asked about.
    hours: week([t(11.5), t(15.5)], [t(11.5), t(15)], null),
  },
];
