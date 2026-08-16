/**
 * Guards the house style for anything a customer reads.
 *
 * The rule that keeps getting broken is the dash. An em dash reads as
 * machine-written to a lot of people, and once one is in a screen the next
 * person matches it. This walks the actual source rather than trusting
 * anybody to remember, and it looks only at string literals and JSX text:
 * comments and commit messages are for developers, and are none of its
 * business.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src/app', 'src/components', 'src/data'];

/**
 * Blanks out comments so their punctuation is not mistaken for copy.
 *
 * A regex cannot do this: `'https://x'` contains `//` and is not a comment,
 * and a `/* *\/` inside a string is not one either. So it is a small scanner
 * that knows which of the three states it is in.
 */
function stripComments(source: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;

  while (i < source.length) {
    const ch = source[i];

    if (quote) {
      if (ch === '\\') {
        out += '  ';
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i);
      const stop = end === -1 ? source.length : end + 2;
      // Newlines are kept so line numbers still line up in a failure.
      out += source.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
      continue;
    }

    if (ch === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      out += ' '.repeat(stop - i);
      i = stop;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === '__tests__') continue;
      found.push(...sourceFiles(path));
    } else if (/\.tsx?$/.test(entry)) {
      found.push(path);
    }
  }
  return found;
}

describe('customer-facing copy', () => {
  const files = ROOTS.flatMap(sourceFiles);

  it('finds the screens to check', () => {
    // A glob that silently matches nothing is a test that always passes.
    expect(files.length).toBeGreaterThan(20);
  });

  it('uses no dashes as punctuation', () => {
    const offences: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const lines = source.split('\n');
      const scannable = stripComments(source).split('\n');

      scannable.forEach((line, index) => {
        if (/[—–]/.test(line)) {
          offences.push(`${file}:${index + 1}  ${lines[index].trim()}`);
        }
      });
    }

    expect(offences).toEqual([]);
  });
});

describe('stripComments', () => {
  it('blanks a block comment', () => {
    expect(stripComments('a /* — */ b').includes('—')).toBe(false);
  });

  it('blanks a line comment', () => {
    expect(stripComments('a // —\nb').includes('—')).toBe(false);
  });

  it('leaves a dash inside a string alone', () => {
    expect(stripComments("const a = 'x — y';").includes('—')).toBe(true);
  });

  it('does not treat a URL as a comment', () => {
    expect(stripComments("const u = 'https://x.test/—';").includes('—')).toBe(true);
  });

  it('keeps line numbers lined up', () => {
    expect(stripComments('/* one\ntwo */\nthree').split('\n')).toHaveLength(3);
  });
});
