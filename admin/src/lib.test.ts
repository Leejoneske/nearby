import {
  countdown,
  csvFilename,
  IDLE_LIMIT_MS,
  IDLE_WARN_MS,
  idleVerdict,
  matches,
  score,
  secondsLeft,
  toCsv,
} from './lib';

const minutes = (n: number) => n * 60_000;

describe('idleVerdict', () => {
  const now = 1_700_000_000_000;

  it('leaves a session alone while somebody is using it', () => {
    expect(idleVerdict(now - minutes(1), now)).toBe('active');
    expect(idleVerdict(now - minutes(27), now)).toBe('active');
  });

  it('warns before it closes rather than after', () => {
    expect(idleVerdict(now - (IDLE_LIMIT_MS - IDLE_WARN_MS), now)).toBe('warn');
    expect(idleVerdict(now - minutes(29), now)).toBe('warn');
  });

  it('expires on the limit, not a tick past it', () => {
    expect(idleVerdict(now - IDLE_LIMIT_MS, now)).toBe('expired');
    expect(idleVerdict(now - minutes(90), now)).toBe('expired');
  });

  it('treats a clock that has gone backwards as activity', () => {
    expect(idleVerdict(now + minutes(5), now)).toBe('active');
  });
});

describe('secondsLeft', () => {
  const now = 1_700_000_000_000;

  it('counts down in whole seconds', () => {
    expect(secondsLeft(now - minutes(29), now)).toBe(60);
    expect(secondsLeft(now - minutes(29) - 500, now)).toBe(60);
  });

  it('never goes below zero', () => {
    expect(secondsLeft(now - minutes(120), now)).toBe(0);
  });
});

describe('countdown', () => {
  it('reads as minutes and seconds, not as a big number of seconds', () => {
    expect(countdown(118)).toBe('1:58');
    expect(countdown(60)).toBe('1:00');
    expect(countdown(9)).toBe('0:09');
  });

  it('bottoms out at zero', () => {
    expect(countdown(-5)).toBe('0:00');
  });
});

describe('toCsv', () => {
  const columns = [
    { header: 'Name', value: (r: { name: string; note: string }) => r.name },
    { header: 'Note', value: (r: { name: string; note: string }) => r.note },
  ];

  it('quotes everything, so a comma in a name cannot shift a column', () => {
    const csv = toCsv([{ name: 'Sarabi, Kitchen', note: 'ok' }], columns);
    expect(csv).toContain('"Sarabi, Kitchen","ok"');
  });

  it('doubles a quote mark rather than dropping it', () => {
    const csv = toCsv([{ name: 'The "Cut" Room', note: '' }], columns);
    expect(csv).toContain('"The ""Cut"" Room"');
  });

  it('keeps a newline inside its cell', () => {
    const csv = toCsv([{ name: 'a', note: 'one\ntwo' }], columns);
    expect(csv).toContain('"one\ntwo"');
    // Header, then one row that happens to span two lines.
    expect(csv.trimEnd().split('\r\n')).toHaveLength(2);
  });

  it('writes an empty cell for a missing value rather than "null"', () => {
    const csv = toCsv([{ name: 'a', note: null as unknown as string }], columns);
    expect(csv).toContain('"a",""');
    expect(csv).not.toContain('null');
  });

  it('starts with a BOM so Excel reads it as UTF-8', () => {
    expect(toCsv([], columns).charCodeAt(0)).toBe(0xfeff);
  });

  it('writes a header even with no rows', () => {
    expect(toCsv([], columns)).toContain('"Name","Note"');
  });
});

describe('csvFilename', () => {
  it('dates the file', () => {
    expect(csvFilename('listings', new Date('2026-08-19T11:00:00Z'))).toBe(
      'nearby-listings-2026-08-19.csv',
    );
  });
});

describe('matches', () => {
  it('takes an empty term as matching everything', () => {
    expect(matches('Listings', '')).toBe(true);
  });

  it('finds a substring', () => {
    expect(matches('Open reports', 'report')).toBe(true);
  });

  it('finds letters in order, which is what initials are', () => {
    expect(matches('Open reports', 'opr')).toBe(true);
    expect(matches('Listings', 'lst')).toBe(true);
  });

  it('refuses letters that are not there', () => {
    expect(matches('Listings', 'zzz')).toBe(false);
    expect(matches('Listings', 'sgnil')).toBe(false);
  });
});

describe('score', () => {
  it('puts an exact name above one that merely contains it', () => {
    expect(score('Sarabi Kitchen', 'sarabi kitchen')).toBeGreaterThan(
      score('Sarabi Kitchen Annexe', 'sarabi kitchen'),
    );
  });

  it('puts a prefix above a word start above a bare substring', () => {
    expect(score('Kahawa Collective', 'kah')).toBeGreaterThan(
      score('The Kahawa Place', 'kah'),
    );
    expect(score('The Kahawa Place', 'kah')).toBeGreaterThan(score('Bikahawa', 'kah'));
  });

  it('scores nothing for a term that is not in there at all', () => {
    expect(score('Listings', 'zzz')).toBe(0);
  });

  it('survives a term made of regex punctuation', () => {
    expect(() => score('Cafe (Westlands)', '(west')).not.toThrow();
  });
});
