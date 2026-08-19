/**
 * Working out which places to put in front of somebody.
 *
 * Pure, like the rest of the decision layer: it takes a list of businesses and
 * a picture of what a person has done, and returns an ordered list with a
 * reason attached to each. No React, no fetching, so every rule here can be
 * asserted directly rather than eyeballed on a screen.
 *
 * The shape of it is deliberately plain, and it is worth saying why rather
 * than reaching for something that sounds cleverer. A directory of a few
 * thousand listings in one city, used by somebody who has looked at perhaps
 * twenty of them, does not have the data for collaborative filtering: there
 * are not enough overlapping pairs to learn from, and a model trained on that
 * would mostly be repeating the popularity it already knows. What it does
 * have is a handful of strong, legible signals, so this scores those and can
 * explain every result in a sentence.
 *
 * Legible matters. "Because you saved two other cafes" is something a person
 * can agree or disagree with, and something we can debug. A number out of a
 * model is neither.
 */
import type { Business, CategoryId } from '../data/types';
import { openState } from './hours';
import { matchScore } from './search';

/* ------------------------------------------------------------- the taste -- */

/**
 * What we think somebody likes, built from what they have done.
 *
 * Everything in here is derived on the device from their own activity. None
 * of it is sent anywhere, and none of it is about anybody else.
 */
export type Taste = {
  /** Category to affinity, 0 to 1. Empty when there is nothing to go on. */
  categories: Partial<Record<CategoryId, number>>;
  /** Price level, 1 to 4, to affinity. */
  priceLevels: Partial<Record<number, number>>;
  /** Neighbourhood to affinity, lowercased. */
  areas: Partial<Record<string, number>>;
  /** Slugs already saved, which should not be recommended back. */
  saved: Set<string>;
  /** Slugs already opened, in order, newest first. */
  seen: string[];
  /** How much evidence there is, 0 to 1. Drives how far the taste is trusted. */
  strength: number;
};

export const EMPTY_TASTE: Taste = {
  categories: {},
  priceLevels: {},
  areas: {},
  saved: new Set(),
  seen: [],
  strength: 0,
};

/**
 * The weight one piece of evidence carries.
 *
 * Saving is worth far more than looking: one is a decision, the other is a
 * tap. A review is worth most of all, and a bad review is evidence *against*
 * the category rather than for it — which is the part a naive "count what
 * they interacted with" model gets backwards.
 */
const WEIGHT = {
  saved: 3,
  reviewedWell: 4,
  reviewedBadly: -3,
  searched: 1.5,
  /** Multiplied by a recency factor, so the tenth-most-recent view is faint. */
  viewed: 1,
} as const;

/** Enough evidence that the taste is worth trusting fully. */
const FULL_STRENGTH = 12;

function bump<K extends string | number>(
  into: Partial<Record<K, number>>,
  key: K | undefined,
  amount: number,
) {
  if (key === undefined || key === null || key === '') return;
  into[key] = (into[key] ?? 0) + amount;
}

/** Scales a map so its largest value is 1, leaving the shape intact. */
function normalise<K extends string | number>(
  map: Partial<Record<K, number>>,
): Partial<Record<K, number>> {
  const values = Object.values(map) as number[];
  const peak = Math.max(0, ...values);
  if (peak <= 0) return {};

  const out: Partial<Record<K, number>> = {};
  for (const [key, value] of Object.entries(map) as [K, number][]) {
    // Negative evidence is kept, because "they disliked two of these" should
    // push a category down rather than merely fail to push it up.
    out[key] = value / peak;
  }
  return out;
}

export function buildTaste(input: {
  saved: Business[];
  /** Newest first. */
  recent: Business[];
  /** Newest first. */
  queries: string[];
  /** The viewer's own reviews, with the business they were about. */
  reviewed?: { business: Business; rating: number }[];
  all?: Business[];
}): Taste {
  const categories: Partial<Record<CategoryId, number>> = {};
  const priceLevels: Partial<Record<number, number>> = {};
  const areas: Partial<Record<string, number>> = {};
  let evidence = 0;

  const record = (business: Business, weight: number) => {
    bump(categories, business.categoryId, weight);
    bump(priceLevels, business.priceLevel, weight);
    bump(areas, business.neighbourhood.toLowerCase(), weight * 0.6);
    evidence += Math.abs(weight);
  };

  input.saved.forEach((b) => record(b, WEIGHT.saved));

  /*
   * Views decay. Somewhere looked at ten minutes ago says more about what
   * somebody wants now than somewhere looked at last week, and without this
   * the twentieth-oldest view counts as much as the newest one.
   */
  input.recent.forEach((b, index) => record(b, WEIGHT.viewed * (1 / (1 + index * 0.35))));

  input.reviewed?.forEach(({ business, rating }) =>
    record(business, rating >= 4 ? WEIGHT.reviewedWell : rating <= 2 ? WEIGHT.reviewedBadly : 0),
  );

  /*
   * A search is a stated intention, which is worth more than a glance. The
   * text is matched against the catalogue to find out what it was about, so
   * "nyama choma" counts towards restaurants without anybody maintaining a
   * list of synonyms.
   */
  const catalogue = input.all ?? [];
  input.queries.slice(0, 10).forEach((query, index) => {
    const decay = 1 / (1 + index * 0.3);
    const hits = catalogue
      .map((b) => ({ b, score: matchScore(b, query) }))
      .filter(({ score }) => score >= 25)
      .slice(0, 8);
    hits.forEach(({ b }) => record(b, WEIGHT.searched * decay * (1 / Math.max(1, hits.length / 3))));
  });

  return {
    categories: normalise(categories),
    priceLevels: normalise(priceLevels),
    areas: normalise(areas),
    saved: new Set(input.saved.map((b) => b.id)),
    seen: input.recent.map((b) => b.id),
    strength: Math.min(1, evidence / FULL_STRENGTH),
  };
}

/* ------------------------------------------------------------- the score -- */

/**
 * Quality, adjusted for how much the rating is worth believing.
 *
 * A single five-star review is not better than a 4.6 from two hundred people,
 * and a plain average says it is. This pulls a rating towards the middle in
 * proportion to how little evidence sits behind it, which is the standard
 * Bayesian shrinkage and the one piece of arithmetic here that genuinely
 * changes what somebody sees.
 */
export function confidentRating(rating: number, reviewCount: number, prior = 3.9, weight = 8): number {
  if (reviewCount <= 0) return prior;
  return (reviewCount * rating + weight * prior) / (reviewCount + weight);
}

/** 1 at the door, falling away with distance and reaching 0 at about 8 km. */
function proximity(distanceM: number): number {
  if (!Number.isFinite(distanceM) || distanceM <= 0) return 1;
  return Math.max(0, 1 - distanceM / 8000);
}

export type Recommendation = {
  business: Business;
  score: number;
  /** One line saying why, shown under the card. */
  reason: string;
};

/**
 * How much each part counts.
 *
 * Distance and quality together outweigh taste, on purpose. Somebody who has
 * saved three cafes still wants a good cafe *near them*, and a recommender
 * that sends them across the city because the category matches has understood
 * the wrong half of the request.
 */
const PART = {
  taste: 0.3,
  quality: 0.24,
  proximity: 0.24,
  openNow: 0.1,
  price: 0.06,
  area: 0.06,
} as const;

function reasonFor(
  business: Business,
  taste: Taste,
  parts: { taste: number; open: boolean; area: number },
): string {
  const category = business.categoryId;
  if (parts.taste > 0.55 && taste.strength > 0.25) {
    return `You have been looking at ${categoryPhrase(category)}`;
  }
  if (parts.area > 0.55) {
    return `In ${business.neighbourhood}, where you have been before`;
  }
  if (business.reviewCount >= 5 && business.rating >= 4.3) {
    return `Well reviewed by ${business.reviewCount} people`;
  }
  if (parts.open && business.distanceM < 1500) {
    return 'Open now, and close by';
  }
  if (business.distanceM < 800) {
    return 'A short walk away';
  }
  return 'Worth a look';
}

function categoryPhrase(category: CategoryId): string {
  const plural: Partial<Record<CategoryId, string>> = {
    restaurant: 'places to eat',
    cafe: 'cafes',
    beauty: 'beauty places',
    shopping: 'shops',
    auto: 'car places',
    health: 'health services',
    fitness: 'gyms',
    hotel: 'places to stay',
    services: 'services',
    nightlife: 'places to go out',
  };
  return plural[category] ?? 'places like this';
}

/**
 * Ranks everything, best first.
 *
 * `limit` is applied after a diversity pass rather than before, so the answer
 * is the best of each kind rather than the best six of one kind.
 */
export function recommend(
  businesses: Business[],
  taste: Taste,
  options: { now?: Date; limit?: number; excludeSaved?: boolean } = {},
): Recommendation[] {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 10;

  const scored = businesses
    .filter((b) => !(options.excludeSaved !== false && taste.saved.has(b.id)))
    .map((business) => {
      const affinity = taste.categories[business.categoryId] ?? 0;
      const priceFit = taste.priceLevels[business.priceLevel] ?? 0;
      const areaFit = taste.areas[business.neighbourhood.toLowerCase()] ?? 0;
      const open = openState(business.hours, now).isOpen;

      /*
       * A taste we barely have evidence for should not steer much. Below
       * about a dozen actions this fades towards a plain "good and near",
       * which is the right answer for somebody who has just arrived.
       */
      const trust = taste.strength;

      const quality = (confidentRating(business.rating, business.reviewCount) - 1) / 4;

      let score =
        PART.taste * affinity * trust +
        PART.quality * quality +
        PART.proximity * proximity(business.distanceM) +
        PART.openNow * (open ? 1 : 0) +
        PART.price * priceFit * trust +
        PART.area * areaFit * trust;

      /*
       * Somewhere already opened is not a recommendation, it is a reminder.
       * The most recent view is damped hardest, because that is the one they
       * have just come back from.
       */
      const seenAt = taste.seen.indexOf(business.id);
      if (seenAt >= 0) score *= 0.45 + Math.min(0.4, seenAt * 0.05);

      return {
        business,
        score,
        reason: reasonFor(business, taste, { taste: affinity, open, area: areaFit }),
      };
    })
    .sort((a, b) => b.score - a.score || a.business.distanceM - b.business.distanceM);

  return diversify(scored, limit);
}

/**
 * Stops one category taking the whole list.
 *
 * Without this a person who has saved three cafes gets six cafes, which is
 * both boring and wrong: they already know they like cafes, and the thing a
 * directory is for is the place they have not found yet. Two per category
 * until the list is full, then whatever is left over in score order.
 */
export function diversify(scored: Recommendation[], limit: number, perCategory = 2): Recommendation[] {
  const picked: Recommendation[] = [];
  const held: Recommendation[] = [];
  const counts = new Map<CategoryId, number>();

  for (const item of scored) {
    if (picked.length >= limit) break;
    const seen = counts.get(item.business.categoryId) ?? 0;
    if (seen < perCategory) {
      counts.set(item.business.categoryId, seen + 1);
      picked.push(item);
    } else {
      held.push(item);
    }
  }

  for (const item of held) {
    if (picked.length >= limit) break;
    picked.push(item);
  }

  return picked;
}
