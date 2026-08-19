/**
 * The console's decisions, with nothing plugged into them.
 *
 * Same rule as the app: the part worth being sure about does not import
 * Supabase and does not touch the DOM, so it can be run in a test without
 * either. What is left in the screens is wiring.
 */

/* ------------------------------------------------------- idle sessions -- */

/*
 * A console session ends itself.
 *
 * Nothing here is a lock — the database refuses anybody without a row in
 * `admins` regardless of what this page does. What an idle timeout actually
 * buys is the ordinary case: a laptop left open on a desk, in a café, at a
 * conference, with a signed-in moderator's tab still on screen. Supabase
 * refreshes its token forever, so without this a session that started on
 * Monday is still good on Friday.
 *
 * Thirty minutes, with two of them as warning. Long enough to read a report
 * and think about it, short enough that a walk to lunch closes the door.
 */
export const IDLE_LIMIT_MS = 30 * 60_000;
export const IDLE_WARN_MS = 2 * 60_000;

export type IdleVerdict = 'active' | 'warn' | 'expired';

export function idleVerdict(
  lastActive: number,
  now: number,
  limit = IDLE_LIMIT_MS,
  warn = IDLE_WARN_MS,
): IdleVerdict {
  const idle = now - lastActive;
  if (idle >= limit) return 'expired';
  if (idle >= limit - warn) return 'warn';
  return 'active';
}

/** Whole seconds left before the session closes, never below zero. */
export function secondsLeft(lastActive: number, now: number, limit = IDLE_LIMIT_MS): number {
  return Math.max(0, Math.ceil((lastActive + limit - now) / 1000));
}

/** "1:58". A raw count of 118 seconds is a number nobody reads as two minutes. */
export function countdown(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

/* -------------------------------------------------------------- export -- */

/**
 * Rows to CSV.
 *
 * Everything is quoted. A business name with a comma in it, a review body
 * with a newline, an address with a quote mark — all three are ordinary here,
 * and quoting only when it looks necessary is how a file gets one row wrong
 * six months after anybody remembers writing this.
 *
 * The BOM is for Excel, which otherwise reads a UTF-8 file as Latin-1 and
 * turns every accented name into mojibake.
 */
export function toCsv<T>(
  rows: T[],
  columns: { header: string; value: (row: T) => unknown }[],
): string {
  const cell = (value: unknown): string => {
    if (value === null || value === undefined) return '""';
    const text = value instanceof Date ? value.toISOString() : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const lines = [columns.map((c) => cell(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => cell(c.value(row))).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** `nearby-listings-2026-08-19.csv`. Dated, because these get kept. */
export function csvFilename(what: string, now = new Date()): string {
  return `nearby-${what}-${now.toISOString().slice(0, 10)}.csv`;
}

/* ------------------------------------------------------- command match -- */

/**
 * Does this command match what has been typed?
 *
 * Subsequence rather than substring, so "opr" finds "Open reports" and "lst"
 * finds "Listings". Anything cleverer is a fuzzy matcher, and a fuzzy matcher
 * with eight things to search is a lot of code to rank a list you can see all
 * of at once.
 */
export function matches(haystack: string, needle: string): boolean {
  const term = needle.trim().toLowerCase();
  if (!term) return true;

  const text = haystack.toLowerCase();
  if (text.includes(term)) return true;

  let at = 0;
  for (const ch of term) {
    if (ch === ' ') continue;
    at = text.indexOf(ch, at);
    if (at === -1) return false;
    at += 1;
  }
  return true;
}

/**
 * Exact, then prefix, then a word start, then anything.
 *
 * Sorting by score matters more than the scores themselves: what it has to
 * get right is that typing a listing's full name puts that listing first.
 */
export function score(haystack: string, needle: string): number {
  const term = needle.trim().toLowerCase();
  if (!term) return 0;
  const text = haystack.toLowerCase();

  if (text === term) return 100;
  if (text.startsWith(term)) return 80;
  if (new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(text)) return 60;
  if (text.includes(term)) return 40;
  return matches(text, term) ? 20 : 0;
}
