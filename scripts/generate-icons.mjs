/**
 * Generates the app icons from one vector mark, so the launcher icon, the
 * adaptive icon, the splash mark and the favicon can never drift apart.
 *
 *   node scripts/generate-icons.mjs
 *
 * The mark is a map pin — the one symbol a directory app can use at 48px and
 * still be read correctly.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'images');

const ACCENT = '#FF5A1F';

/** Teardrop pin on a 1024 canvas, with the counter punched out. */
function pinPaths(fill, counter) {
  return `
    <path d="M512 196 C632 196 724 288 724 404 C724 566 512 836 512 836 C512 836 300 566 300 404 C300 288 392 196 512 196 Z" fill="${fill}"/>
    <circle cx="512" cy="404" r="82" fill="${counter}"/>
  `;
}

/** `scale` shrinks the mark for Android's adaptive-icon safe zone. */
function svg({ background, fill, counter, scale = 1 }) {
  const offset = (1024 - 1024 * scale) / 2;
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
      ${background ? `<rect width="1024" height="1024" fill="${background}"/>` : ''}
      <g transform="translate(${offset} ${offset}) scale(${scale})">
        ${pinPaths(fill, counter)}
      </g>
    </svg>
  `);
}

const targets = [
  {
    file: 'icon.png',
    size: 1024,
    svg: svg({ background: ACCENT, fill: '#FFFFFF', counter: ACCENT }),
  },
  {
    // Android draws its own background layer, so this one is mark-only and
    // pulled in to survive the adaptive-icon mask.
    file: 'android-icon-foreground.png',
    size: 1024,
    svg: svg({ background: null, fill: '#FFFFFF', counter: ACCENT, scale: 0.62 }),
  },
  {
    file: 'android-icon-monochrome.png',
    size: 1024,
    svg: svg({ background: null, fill: '#000000', counter: '#FFFFFF', scale: 0.62 }),
  },
  {
    // Sits on the orange splash background, so the counter has to be orange.
    file: 'splash-icon.png',
    size: 512,
    svg: svg({ background: null, fill: '#FFFFFF', counter: ACCENT }),
  },
  {
    file: 'favicon.png',
    size: 64,
    svg: svg({ background: ACCENT, fill: '#FFFFFF', counter: ACCENT }),
  },
];

await mkdir(OUT, { recursive: true });

for (const target of targets) {
  const png = await sharp(target.svg).resize(target.size, target.size).png().toBuffer();
  await writeFile(join(OUT, target.file), png);
  console.log(`wrote ${target.file} (${target.size}px)`);
}
