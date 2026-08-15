/**
 * Bundles the landing page into one self-contained HTML file.
 *
 *   node landing/build-inline.mjs [outfile]
 *
 * CSS, JS and every image are inlined, so the result can be emailed, dropped
 * on a host with no asset pipeline, or previewed somewhere that blocks
 * external requests. The deployable version is still the plain `landing/`
 * folder — this is for sharing a single file.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] ?? join(HERE, 'nearby-landing.html'));

let html = await readFile(join(HERE, 'index.html'), 'utf8');

const MIME = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
};

async function dataUri(relative) {
  const path = join(HERE, relative.replace(/^\.\//, ''));
  const buf = await readFile(path);
  const ext = path.split('.').pop().toLowerCase();
  return `data:${MIME[ext] ?? 'application/octet-stream'};base64,${buf.toString('base64')}`;
}

// Stylesheet and script become inline blocks.
const css = await readFile(join(HERE, 'styles.css'), 'utf8');
const js = await readFile(join(HERE, 'main.js'), 'utf8');

html = html.replace(
  /<link rel="stylesheet" href="\.\/styles\.css" \/>/,
  `<style>\n${css}\n</style>`,
);
html = html.replace(/<script src="\.\/main\.js"><\/script>/, `<script>\n${js}\n</script>`);

// Every local src / href asset becomes a data URI.
const assets = [...html.matchAll(/(?:src|href)="(\.\/[^"]+\.(?:webp|png|jpe?g|svg))"/g)];
const seen = new Map();
for (const [, relative] of assets) {
  if (seen.has(relative)) continue;
  seen.set(relative, await dataUri(relative));
}
for (const [relative, uri] of seen) {
  html = html.split(`"${relative}"`).join(`"${uri}"`);
}

// The accordion swaps screenshots by path, so those attributes need the same
// substitution — they are data-shot, not src.
for (const [relative, uri] of seen) {
  html = html.split(`data-shot="${relative}"`).join(`data-shot="${uri}"`);
}

/*
 * Drop the document scaffold. A file of <title> + <style> + markup renders
 * correctly in any browser, and some preview hosts wrap the content in their
 * own skeleton and reject a nested <html>.
 */
html = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '')
  .replace(/<\/html>\s*$/i, '')
  .replace(/<head>\s*/i, '')
  .replace(/<\/head>\s*/i, '')
  .replace(/<body>\s*/i, '')
  .replace(/<\/body>\s*/i, '')
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');

await writeFile(out, html);
console.log(
  `wrote ${out} — ${(html.length / 1024 / 1024).toFixed(2)} MB, ${seen.size} assets inlined`,
);
