/**
 * Opening-hours logic, kept free of React and of `new Date()` defaults so it
 * can be tested by passing an explicit moment in.
 */
import type { WeekHours } from '../data/types';

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** "07:30" / "18:00" from minutes-since-midnight. */
export function formatMinutes(mins: number): string {
  const normalised = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(normalised / 60);
  const m = normalised % 60;
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export type OpenState = {
  isOpen: boolean;
  /** Short line for a listing row, e.g. "Open · closes 10 PM". */
  label: string;
  /** Minutes until the state flips, or null when the next change is unknown. */
  minutesUntilChange: number | null;
};

/**
 * A close time past midnight is stored as a value >= 1440 (e.g. a bar open
 * until 2 AM closes at 1560), so a spill-over shift is just a range check
 * against the previous day.
 */
export function openState(hours: WeekHours, at: Date): OpenState {
  const day = at.getDay();
  const minutes = at.getHours() * 60 + at.getMinutes();

  const today = hours[day];
  if (today && minutes >= today.open && minutes < today.close) {
    return {
      isOpen: true,
      label: `Open · closes ${formatMinutes(today.close)}`,
      minutesUntilChange: today.close - minutes,
    };
  }

  // Still inside yesterday's late shift?
  const yesterday = hours[(day + 6) % 7];
  if (yesterday && yesterday.close > 1440) {
    const spill = yesterday.close - 1440;
    if (minutes < spill) {
      return {
        isOpen: true,
        label: `Open · closes ${formatMinutes(yesterday.close)}`,
        minutesUntilChange: spill - minutes,
      };
    }
  }

  // Closed — find when it next opens.
  if (today && minutes < today.open) {
    return {
      isOpen: false,
      label: `Closed · opens ${formatMinutes(today.open)}`,
      minutesUntilChange: today.open - minutes,
    };
  }

  for (let ahead = 1; ahead <= 7; ahead += 1) {
    const next = hours[(day + ahead) % 7];
    if (next) {
      const dayLabel = ahead === 1 ? 'tomorrow' : DAY_SHORT[(day + ahead) % 7];
      return {
        isOpen: false,
        label: `Closed · opens ${dayLabel} ${formatMinutes(next.open)}`,
        minutesUntilChange: null,
      };
    }
  }

  return { isOpen: false, label: 'Temporarily closed', minutesUntilChange: null };
}

/** "7 AM – 10 PM" or "Closed", for the hours table on a detail page. */
export function formatDayRange(day: WeekHours[number]): string {
  if (!day) return 'Closed';
  return `${formatMinutes(day.open)} to ${formatMinutes(day.close)}`;
}
