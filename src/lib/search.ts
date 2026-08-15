/**
 * Search, filtering and ranking.
 *
 * This is the decision layer: it takes a list of businesses and a filter state
 * and returns the list to render. No React, no data fetching — so the ranking
 * rules can be asserted directly.
 */
import type { Business, Filters, SortKey } from '../data/types';
import { openState } from './hours';

/** Great-circle distance in metres. */
export function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * How well a business matches a typed query, 0 when it does not match at all.
 * Name matches beat category matches beat address matches, so typing "coffee"
 * does not bury the shop actually called Coffee.
 */
export function matchScore(business: Business, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;

  const name = business.name.toLowerCase();
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (name.includes(q)) return 60;

  if (business.tagline.toLowerCase().includes(q)) return 40;
  if (business.categoryId.includes(q)) return 30;
  if (business.neighbourhood.toLowerCase().includes(q)) return 25;
  if (business.address.toLowerCase().includes(q)) return 20;
  if (business.amenities.some((a) => a.toLowerCase().includes(q))) return 15;
  if (business.description.toLowerCase().includes(q)) return 10;

  return 0;
}

function passesFilters(business: Business, filters: Filters, now: Date): boolean {
  if (filters.categoryId && business.categoryId !== filters.categoryId) return false;
  if (filters.priceLevels.length > 0 && !filters.priceLevels.includes(business.priceLevel)) {
    return false;
  }
  if (filters.radiusM !== null && business.distanceM > filters.radiusM) return false;
  if (filters.minRating !== null && business.rating < filters.minRating) return false;
  if (filters.openNow && !openState(business.hours, now).isOpen) return false;
  return true;
}

function comparator(sort: SortKey, query: string) {
  return (a: Business, b: Business): number => {
    switch (sort) {
      case 'rating':
        return b.rating - a.rating || b.reviewCount - a.reviewCount;
      case 'distance':
        return a.distanceM - b.distanceM;
      case 'priceLow':
        return a.priceFrom - b.priceFrom || a.distanceM - b.distanceM;
      case 'relevance':
      default: {
        // With a query, text match leads. Without one, "relevance" is the
        // nearby-and-well-reviewed blend a user expects from a home feed.
        if (query.trim()) {
          const diff = matchScore(b, query) - matchScore(a, query);
          if (diff !== 0) return diff;
        }
        return relevanceScore(b) - relevanceScore(a);
      }
    }
  };
}

/** Rating weighted by review volume, penalised by distance. */
export function relevanceScore(business: Business): number {
  const confidence = Math.min(1, business.reviewCount / 200);
  const quality = business.rating * (0.6 + 0.4 * confidence);
  const proximity = Math.max(0, 1 - business.distanceM / 10_000);
  return quality * 2 + proximity * 3;
}

export function searchBusinesses(
  businesses: Business[],
  query: string,
  filters: Filters,
  now: Date = new Date(),
): Business[] {
  return businesses
    .filter((b) => passesFilters(b, filters, now))
    .filter((b) => matchScore(b, query) > 0)
    .sort(comparator(filters.sort, query));
}

export const SORT_LABELS: Record<SortKey, string> = {
  relevance: 'Relevance',
  rating: 'Top rated',
  distance: 'Nearest',
  priceLow: 'Price: low to high',
};

/** Count of filters the user has actively changed, for the filter-button badge. */
export function activeFilterCount(filters: Filters): number {
  let n = 0;
  if (filters.sort !== 'relevance') n += 1;
  if (filters.priceLevels.length > 0) n += 1;
  if (filters.radiusM !== null) n += 1;
  if (filters.openNow) n += 1;
  if (filters.minRating !== null) n += 1;
  if (filters.categoryId) n += 1;
  return n;
}
