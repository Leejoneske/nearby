/**
 * Publishes the privacy policy and terms as pages on the site.
 *
 * An app store submission needs a public privacy URL, and a policy that only
 * exists inside the app is not reachable by somebody deciding whether to
 * install it. The footer linked to `#`, which is worse than not linking at
 * all: it looks like a policy exists and goes nowhere.
 *
 * The words come from `src/data/legal.json`, which is also what the app
 * renders. One copy of the text, so the page and the screen cannot disagree.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LEGAL = JSON.parse(await readFile(join(HERE, '..', 'src', 'data', 'legal.json'), 'utf8'));

const escape = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function page(doc, slug) {
  const sections = doc.sections
    .map(
      (section) =>
        `<section class="legal-section">\n` +
        `  <h2>${escape(section.heading)}</h2>\n` +
        section.paragraphs.map((p) => `  <p>${escape(p)}</p>`).join('\n') +
        `\n</section>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#FF5A1F" />
    <title>${escape(doc.title)} · Nearby</title>
    <meta name="description" content="${escape(doc.intro)}" />
    <link rel="canonical" href="https://nearby-lake.vercel.app/${slug}" />
    <link rel="icon" href="./favicon.png" />
    <link rel="apple-touch-icon" href="./apple-touch-icon.png" />
    <link rel="stylesheet" href="./styles.css" />
    <link rel="stylesheet" href="./listing.css" />
  </head>
  <body class="listing-page">
    <header class="listing-top">
      <a class="listing-brand" href="/">
        <img src="./img/mark.png" alt="" width="30" height="30" />
        <span>Nearby</span>
      </a>
      <a class="btn btn--accent btn--sm" href="/#download">Get the app</a>
    </header>

    <main class="listing-main legal">
      <h1>${escape(doc.title)}</h1>
      <p class="legal-updated">Last updated ${escape(doc.updated)}</p>
      <p class="legal-intro">${escape(doc.intro)}</p>
${sections}
    </main>

    <footer class="listing-foot">
      <p><a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Use</a></p>
      <p class="listing-fine">&copy; 2026 Nearby · Powered by devCrib</p>
    </footer>
  </body>
</html>
`;
}

await writeFile(join(HERE, 'privacy.html'), page(LEGAL.privacy, 'privacy'), 'utf8');
await writeFile(join(HERE, 'terms.html'), page(LEGAL.terms, 'terms'), 'utf8');

console.log('[landing] wrote privacy.html and terms.html');
