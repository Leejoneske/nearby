import type { WeekHours } from '../../data/types';
import { formatDayRange, formatMinutes, openState } from '../hours';

const h = (open: number, close: number) => ({ open, close });

/** Mon–Fri 9–5, Sat 10–2, Sunday closed. Index 0 is Sunday. */
const OFFICE: WeekHours = [
  null,
  h(9 * 60, 17 * 60),
  h(9 * 60, 17 * 60),
  h(9 * 60, 17 * 60),
  h(9 * 60, 17 * 60),
  h(9 * 60, 17 * 60),
  h(10 * 60, 14 * 60),
];

/** A bar that closes at 2 AM, stored as 26:00 so the shift stays one range. */
const LATE_BAR: WeekHours = [
  null,
  null,
  null,
  null,
  h(17 * 60, 26 * 60),
  h(17 * 60, 26 * 60),
  h(17 * 60, 26 * 60),
];

/** 2026-08-17 is a Monday. */
const monday = (hour: number, minute = 0) => new Date(2026, 7, 17, hour, minute);
const friday = (hour: number, minute = 0) => new Date(2026, 7, 21, hour, minute);
const saturday = (hour: number, minute = 0) => new Date(2026, 7, 22, hour, minute);
const sunday = (hour: number, minute = 0) => new Date(2026, 7, 23, hour, minute);

describe('formatMinutes', () => {
  it('renders whole hours without minutes', () => {
    expect(formatMinutes(9 * 60)).toBe('9 AM');
    expect(formatMinutes(17 * 60)).toBe('5 PM');
  });

  it('renders midnight and noon as 12', () => {
    expect(formatMinutes(0)).toBe('12 AM');
    expect(formatMinutes(12 * 60)).toBe('12 PM');
  });

  it('wraps times past midnight back into the day', () => {
    expect(formatMinutes(26 * 60)).toBe('2 AM');
  });

  it('pads minutes', () => {
    expect(formatMinutes(9 * 60 + 5)).toBe('9:05 AM');
  });
});

describe('openState', () => {
  it('is open inside the day’s range', () => {
    const state = openState(OFFICE, monday(11));
    expect(state.isOpen).toBe(true);
    expect(state.label).toBe('Open · closes 5 PM');
    expect(state.minutesUntilChange).toBe(6 * 60);
  });

  it('is closed before opening, and says when it opens', () => {
    const state = openState(OFFICE, monday(7, 30));
    expect(state.isOpen).toBe(false);
    expect(state.label).toBe('Closed · opens 9 AM');
    expect(state.minutesUntilChange).toBe(90);
  });

  it('treats the closing minute as closed', () => {
    expect(openState(OFFICE, monday(17)).isOpen).toBe(false);
  });

  it('treats the opening minute as open', () => {
    expect(openState(OFFICE, monday(9)).isOpen).toBe(true);
  });

  it('skips a closed day when naming the next opening', () => {
    const state = openState(OFFICE, sunday(12));
    expect(state.isOpen).toBe(false);
    expect(state.label).toBe('Closed · opens tomorrow 9 AM');
  });

  it('names a weekday when the next opening is further out', () => {
    // Saturday after close: Sunday is shut, so the answer is Monday.
    const state = openState(OFFICE, saturday(20));
    expect(state.label).toBe('Closed · opens Mon 9 AM');
  });

  it('stays open past midnight on a late shift', () => {
    // 1 AM Saturday still belongs to Friday's 5 PM–2 AM shift.
    const state = openState(LATE_BAR, saturday(1));
    expect(state.isOpen).toBe(true);
    expect(state.label).toBe('Open · closes 2 AM');
    expect(state.minutesUntilChange).toBe(60);
  });

  it('closes once the late shift ends', () => {
    expect(openState(LATE_BAR, saturday(3)).isOpen).toBe(false);
  });

  it('reports a permanently closed week rather than looping', () => {
    const shut: WeekHours = [null, null, null, null, null, null, null];
    const state = openState(shut, friday(12));
    expect(state.isOpen).toBe(false);
    expect(state.label).toBe('Temporarily closed');
    expect(state.minutesUntilChange).toBeNull();
  });
});

describe('formatDayRange', () => {
  it('renders a range', () => {
    expect(formatDayRange(h(9 * 60, 17 * 60))).toBe('9 AM – 5 PM');
  });

  it('renders a closed day', () => {
    expect(formatDayRange(null)).toBe('Closed');
  });
});
