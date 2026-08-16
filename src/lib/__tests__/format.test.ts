import {
  formatDelta,
  formatDistance,
  formatMoney,
  formatPriceLevel,
  formatPriceRange,
  formatRating,
  formatRelativeDate,
  formatReviewCount,
  initialsOf,
} from '../format';

describe('formatDistance', () => {
  it('rounds metres to the nearest ten under a kilometre', () => {
    expect(formatDistance(423)).toBe('420 m');
    expect(formatDistance(96)).toBe('100 m');
  });

  it('switches to one decimal kilometres', () => {
    expect(formatDistance(2600)).toBe('2.6 km');
  });

  it('drops the decimal past ten kilometres', () => {
    expect(formatDistance(14200)).toBe('14 km');
  });
});

describe('formatPriceLevel', () => {
  it('renders one to four signs', () => {
    expect(formatPriceLevel(1)).toBe('$');
    expect(formatPriceLevel(4)).toBe('$$$$');
  });

  it('clamps out-of-range levels', () => {
    expect(formatPriceLevel(0)).toBe('$');
    expect(formatPriceLevel(9)).toBe('$$$$');
  });
});

describe('money', () => {
  it('groups thousands', () => {
    expect(formatMoney(150000)).toBe('KSh 150,000');
    expect(formatPriceRange(350, 1200)).toBe('KSh 350 to 1,200');
  });
});

describe('formatRating', () => {
  it('always shows one decimal so rows stay aligned', () => {
    expect(formatRating(5)).toBe('5.0');
    expect(formatRating(4.75)).toBe('4.8');
  });
});

describe('formatReviewCount', () => {
  it('handles the singular', () => {
    expect(formatReviewCount(1)).toBe('1 review');
  });

  it('abbreviates thousands and trims a trailing zero', () => {
    expect(formatReviewCount(1284)).toBe('1.3k reviews');
    expect(formatReviewCount(2000)).toBe('2k reviews');
  });
});

describe('formatRelativeDate', () => {
  const now = new Date('2026-08-15T12:00:00Z');

  it('names today and yesterday', () => {
    expect(formatRelativeDate('2026-08-15', now)).toBe('Today');
    expect(formatRelativeDate('2026-08-14', now)).toBe('Yesterday');
  });

  it('counts days, then weeks, then months', () => {
    expect(formatRelativeDate('2026-08-11', now)).toBe('4 days ago');
    expect(formatRelativeDate('2026-08-06', now)).toBe('A week ago');
    expect(formatRelativeDate('2026-06-15', now)).toBe('2 months ago');
  });

  it('counts years', () => {
    expect(formatRelativeDate('2025-01-01', now)).toBe('A year ago');
  });
});

describe('initialsOf', () => {
  it('takes first and last initials', () => {
    expect(initialsOf('John Wanderi')).toBe('JW');
    expect(initialsOf('Mary Jane Watson')).toBe('MW');
  });

  it('falls back for a single name', () => {
    expect(initialsOf('Prince')).toBe('PR');
  });

  it('does not throw on empty input', () => {
    expect(initialsOf('   ')).toBe('?');
  });
});

describe('formatDelta', () => {
  it('signs the percentage', () => {
    expect(formatDelta(1842, 1561)).toBe('+18%');
    expect(formatDelta(80, 100)).toBe('−20%');
  });

  it('handles a zero baseline', () => {
    expect(formatDelta(0, 0)).toBe('No change');
    expect(formatDelta(5, 0)).toBe('New');
  });
});
