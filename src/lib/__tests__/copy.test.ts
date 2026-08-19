/**
 * Guards the house style for anything a customer reads.
 *
 * Two rules, both of which keep getting broken.
 *
 * The dash: an em dash reads as machine-written to a lot of people, and once
 * one is in a screen the next person matches it.
 *
 * The role: anything a customer reads is Nearby talking to them. Which
 * internal role acted is not information they can use, and naming it makes a
 * routine action sound like an escalation. "We read every listing" rather
 * than "an admin reviews every listing".
 *
 * Both walk the actual source rather than trusting anybody to remember, and
 * both look only at string literals and JSX text: comments and commit
 * messages are for developers, and are none of this file's business.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src/app', 'src/components', 'src/data'];

/*
 * The landing page and the legal copy, which the walk above cannot see.
 *
 * Both had drifted for exactly that reason. `legal.json` is data rather than
 * source, and `landing/index.html` is not in `src` at all — so the page went
 * on carrying three em dashes and a link to a privacy policy that did not
 * exist, while every screen in the app obeyed the rule.
 */
const EXTRA_FILES = ['src/data/legal.json', 'landing/index.html'];

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

  /*
   * Words that name whoever is on our side of the app. Checked against copy
   * only, so a variable called `isAdmin` and a comment about admins are both
   * fine — it is the sentence somebody reads that has to say "we".
   */
  const ROLE_WORDS = /\b(admins?|administrators?|moderators?|operators?|staff|support agents?)\b/i;

  it('never names an internal role in copy', () => {
    const offences: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const lines = source.split('\n');

      stripComments(source)
        .split('\n')
        .forEach((line, index) => {
          // Only inside a quoted string or JSX text, not an identifier.
          const copy = line.match(/(['\`"])((?:\\.|(?!\1)[^\\])*)\1/g) ?? [];
          if (copy.some((literal) => ROLE_WORDS.test(literal))) {
            offences.push(`${file}:${index + 1}  ${lines[index].trim()}`);
          }
        });
    }

    expect(offences).toEqual([]);
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

describe('the pages outside src', () => {
  /**
   * Blanks HTML comments, keeping the newlines so line numbers still line up.
   *
   * Per-line detection is not enough: a comment that opens on one line and
   * carries prose on the next looks like copy to anything that reads a line
   * at a time, and the note in `landing/index.html` explaining this very rule
   * is written exactly that way.
   */
  function stripHtmlComments(text: string): string {
    return text.replace(/<!--[\s\S]*?-->/g, (block) => block.replace(/[^\n]/g, ' '));
  }

  it.each(EXTRA_FILES)('%s uses no dashes as punctuation', (file) => {
    const text = readFileSync(join(__dirname, '..', '..', '..', file), 'utf8');
    const lines = text.split('\n');
    const offences = stripHtmlComments(text)
      .split('\n')
      // In HTML the same character also arrives spelled out as an entity.
      .map((line, index) => (/[—–]|&[mn]dash;/.test(line) ? `${file}:${index + 1}  ${lines[index].trim()}` : null))
      .filter((offence): offence is string => offence !== null);

    expect(offences).toEqual([]);
  });

  /*
   * A link that names a destination and goes to "#" is the same fault as a
   * button with no handler: it announces itself, to a screen reader most of
   * all, and does nothing. The store badges are the exception — they say
   * "coming soon" in the text next to them and are marked aria-disabled.
   */
  it('the landing page has no links that go nowhere', () => {
    const html = readFileSync(join(__dirname, '..', '..', '..', 'landing/index.html'), 'utf8');
    const dead = (html.match(/<a\b[^>]*href="#"[^>]*>/g) ?? []).filter(
      (tag) => !tag.includes('aria-disabled'),
    );
    expect(dead).toEqual([]);
  });

  it('the landing page links to the policy pages the app promises', () => {
    const html = readFileSync(join(__dirname, '..', '..', '..', 'landing/index.html'), 'utf8');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/terms"');
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
