import type { Business } from '../../data/types';
import {
  buildTaste,
  confidentRating,
  diversify,
  EMPTY_TASTE,
  recommend,
  type Recommendation,
} from '../recommend';
import { TEST_BUSINESSES } from './fixtures';

const at = (id: string) => TEST_BUSINESSES.find((b) => b.id === id)!;
const ids = (list: Recommendation[]) => list.map((r) => r.business.id);

// A Tuesday lunchtime, so the fixtures with weekday hours are open.
const NOW = new Date('2026-08-18T12:00:00+03:00');

describe('confidentRating', () => {
  /*
   * The one piece of arithmetic here that changes what somebody sees. A plain
   * average says one five-star review beats a 4.6 from two hundred people,
   * and it does not.
   */
  it('does not let one five-star review beat a well reviewed place', () => {
    expect(confidentRating(5, 1)).toBeLessThan(confidentRating(4.6, 200));
  });

  it('leaves a heavily reviewed rating almost alone', () => {
    expect(confidentRating(4.6, 2000)).toBeCloseTo(4.6, 1);
  });

  it('answers with the prior when there is nothing to go on', () => {
    expect(confidentRating(0, 0)).toBe(3.9);
  });

  it('pulls a bad rating up as well as a good one down', () => {
    expect(confidentRating(1, 1)).toBeGreaterThan(1);
  });
});

describe('buildTaste', () => {
  it('has no opinion about somebody who has done nothing', () => {
    const taste = buildTaste({ saved: [], recent: [], queries: [] });
    expect(taste.strength).toBe(0);
    expect(taste.categories).toEqual({});
  });

  it('learns the category somebody saves', () => {
    const taste = buildTaste({
      saved: [at('kahawa-collective')],
      recent: [],
      queries: [],
    });
    expect(taste.categories.cafe).toBe(1);
    expect(taste.categories.restaurant).toBeUndefined();
  });

  it('weighs a save more heavily than a glance', () => {
    const saved = buildTaste({ saved: [at('kahawa-collective')], recent: [], queries: [] });
    const viewed = buildTaste({ saved: [], recent: [at('kahawa-collective')], queries: [] });
    expect(saved.strength).toBeGreaterThan(viewed.strength);
  });

  /*
   * The part a "count what they interacted with" model gets backwards: a one
   * star review is evidence against, not for.
   */
  it('treats a bad review as evidence against the category', () => {
    const taste = buildTaste({
      saved: [at('kahawa-collective')],
      recent: [],
      queries: [],
      reviewed: [{ business: at('sarabi-kitchen'), rating: 1 }],
    });
    expect(taste.categories.restaurant!).toBeLessThan(0);
    expect(taste.categories.cafe!).toBeGreaterThan(0);
  });

  it('fades an older view against a newer one', () => {
    const taste = buildTaste({
      saved: [],
      recent: [at('kahawa-collective'), at('sarabi-kitchen')],
      queries: [],
    });
    expect(taste.categories.cafe!).toBeGreaterThan(taste.categories.restaurant!);
  });

  it('reads a search as an intention, without a synonym list', () => {
    const taste = buildTaste({
      saved: [],
      recent: [],
      queries: ['coffee'],
      all: TEST_BUSINESSES,
    });
    expect(taste.categories.cafe ?? 0).toBeGreaterThan(0);
  });

  it('remembers what not to recommend back', () => {
    const taste = buildTaste({ saved: [at('kahawa-collective')], recent: [], queries: [] });
    expect(taste.saved.has('kahawa-collective')).toBe(true);
  });
});

describe('recommend', () => {
  it('answers for somebody with no history at all', () => {
    const out = recommend(TEST_BUSINESSES, EMPTY_TASTE, { now: NOW, limit: 5 });
    // Four fixtures, so asking for five gets four rather than four plus a gap.
    expect(out).toHaveLength(TEST_BUSINESSES.length);
    expect(out.every((r) => typeof r.reason === 'string' && r.reason.length > 0)).toBe(true);
  });

  it('never recommends something already saved', () => {
    const taste = buildTaste({ saved: [at('kahawa-collective')], recent: [], queries: [] });
    expect(ids(recommend(TEST_BUSINESSES, taste, { now: NOW }))).not.toContain(
      'kahawa-collective',
    );
  });

  /*
   * Distance and quality together outweigh taste on purpose. Somebody who
   * likes cafes still wants a good cafe near them, and a recommender that
   * sends them across the city because the category matches has understood
   * the wrong half of the request.
   */
  it('does not send somebody across the city for a category match', () => {
    const near: Business = { ...at('kahawa-collective'), id: 'near-shop', categoryId: 'shopping', distanceM: 200 };
    const far: Business = { ...at('kahawa-collective'), id: 'far-cafe', categoryId: 'cafe', distanceM: 25_000 };
    const taste = buildTaste({
      saved: [at('kahawa-collective')],
      recent: [at('kahawa-collective')],
      queries: [],
    });

    const out = ids(recommend([near, far], taste, { now: NOW, limit: 2 }));
    expect(out[0]).toBe('near-shop');
  });

  it('demotes somewhere they have just looked at', () => {
    const a: Business = { ...at('kahawa-collective'), id: 'one' };
    const b: Business = { ...at('kahawa-collective'), id: 'two' };
    const taste = buildTaste({ saved: [], recent: [a], queries: [] });

    expect(ids(recommend([a, b], taste, { now: NOW, limit: 2 }))[0]).toBe('two');
  });

  it('prefers somewhere open right now, all else equal', () => {
    const open: Business = { ...at('kahawa-collective'), id: 'open-now' };
    const shut: Business = { ...at('kahawa-collective'), id: 'shut-now', hours: [null, null, null, null, null, null, null] };

    expect(ids(recommend([shut, open], EMPTY_TASTE, { now: NOW, limit: 2 }))[0]).toBe('open-now');
  });

  it('explains itself in a sentence', () => {
    const taste = buildTaste({
      saved: [at('kahawa-collective')],
      recent: [at('kahawa-collective')],
      queries: ['coffee'],
      all: TEST_BUSINESSES,
    });
    const cafe: Business = { ...at('kahawa-collective'), id: 'another-cafe', distanceM: 500 };
    const [top] = recommend([cafe], taste, { now: NOW, limit: 1 });
    expect(top.reason).toBe('You have been looking at cafes');
  });
});

describe('diversify', () => {
  const of = (id: string, categoryId: Business['categoryId']): Recommendation => ({
    business: { ...at('kahawa-collective'), id, categoryId },
    score: 1,
    reason: '',
  });

  /*
   * Somebody who saved three cafes already knows they like cafes. The thing a
   * directory is for is the place they have not found yet.
   */
  it('stops one category taking the whole list', () => {
    const list = [
      of('c1', 'cafe'), of('c2', 'cafe'), of('c3', 'cafe'), of('c4', 'cafe'),
      of('r1', 'restaurant'), of('s1', 'shopping'),
    ];
    const out = ids(diversify(list, 4));
    expect(out.filter((id) => id.startsWith('c')).length).toBe(2);
    expect(out).toContain('r1');
    expect(out).toContain('s1');
  });

  it('fills up from what is left rather than returning a short list', () => {
    const list = [of('c1', 'cafe'), of('c2', 'cafe'), of('c3', 'cafe'), of('c4', 'cafe')];
    expect(diversify(list, 3)).toHaveLength(3);
  });

  it('keeps score order within what it picks', () => {
    const list = [of('a', 'cafe'), of('b', 'restaurant'), of('c', 'shopping')];
    expect(ids(diversify(list, 3))).toEqual(['a', 'b', 'c']);
  });
});
