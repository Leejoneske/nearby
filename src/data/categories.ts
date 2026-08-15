import type { Category, CategoryId } from './types';

/** Icons are Ionicons glyph names — bundled with expo, no extra asset. */
export const CATEGORIES: Category[] = [
  { id: 'restaurant', label: 'Restaurants', icon: 'restaurant' },
  { id: 'cafe', label: 'Cafes', icon: 'cafe' },
  { id: 'beauty', label: 'Beauty & spa', icon: 'cut' },
  { id: 'shopping', label: 'Shopping', icon: 'bag-handle' },
  { id: 'auto', label: 'Auto services', icon: 'car-sport' },
  { id: 'health', label: 'Health', icon: 'medkit' },
  { id: 'fitness', label: 'Fitness', icon: 'barbell' },
  { id: 'hotel', label: 'Hotels', icon: 'bed' },
  { id: 'services', label: 'Services', icon: 'construct' },
  { id: 'nightlife', label: 'Nightlife', icon: 'wine' },
];

const BY_ID = new Map<CategoryId, Category>(CATEGORIES.map((c) => [c.id, c]));

export function categoryOf(id: CategoryId): Category {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown category: ${id}`);
  return found;
}

/**
 * Gradient pairs used to generate a listing photo when a business has no
 * uploaded image. Keyed by category so a cafe never comes out surgical blue.
 */
export const CATEGORY_GRADIENTS: Record<CategoryId, [string, string]> = {
  restaurant: ['#E8A87C', '#C4643C'],
  cafe: ['#D6B08C', '#8C5A3C'],
  beauty: ['#E6A9C4', '#A85D82'],
  shopping: ['#F0C070', '#C98A2E'],
  auto: ['#9AB0C4', '#4F6D87'],
  health: ['#8FC9B4', '#3E8A70'],
  fitness: ['#B3A6DC', '#6A5AA8'],
  hotel: ['#C9B79A', '#8A7350'],
  services: ['#B8BFC6', '#6F7B87'],
  nightlife: ['#A78BC4', '#5B3E80'],
};
