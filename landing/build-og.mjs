/**
 * Generates the social preview card at landing/img/og.png.
 *
 *   node landing/build-og.mjs
 *
 * Every platform that unfurls a link wants roughly 1200x630 landscape. A
 * portrait phone screenshot in that slot gets letterboxed or cropped to
 * nonsense, which matters here because sharing the link is how people are
 * meant to find the app.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 1200;
const H = 630;

const GROUND = '#F7F5F2';
const INK = '#14110F';
const MUTED = '#6B635C';
const ACCENT = '#FF5A1F';

/* Phone screenshot, rounded and scaled to sit on the right. */
const PHONE_H = 470;
const shot = await readFile(join(HERE, 'img', 'home.webp'));
const resized = await sharp(shot).resize({ height: PHONE_H }).toBuffer();
const { width: pw, height: ph } = await sharp(resized).metadata();

const rounded = await sharp(resized)
  .composite([
    {
      input: Buffer.from(
        `<svg width="${pw}" height="${ph}"><rect width="${pw}" height="${ph}" rx="26" ry="26" fill="#fff"/></svg>`,
      ),
      blend: 'dest-in',
    },
  ])
  .png()
  .toBuffer();

/* Background, wordmark and copy. */
const background = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${GROUND}"/>

    <!-- soft shapes, echoing the hero -->
    <circle cx="1080" cy="120" r="200" fill="#FFFFFF" opacity="0.8"/>
    <circle cx="880" cy="560" r="130" fill="#FFFFFF" opacity="0.55"/>

    <!-- the mark itself is composited in below, from the shared artwork -->
    <text x="152" y="122" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="bold" fill="${INK}" letter-spacing="-0.5">Nearby</text>

    <!-- headline -->
    <text x="80" y="286" font-family="Helvetica, Arial, sans-serif" font-size="66" font-weight="bold" fill="${INK}" letter-spacing="-2.4">Find the good</text>
    <text x="80" y="360" font-family="Helvetica, Arial, sans-serif" font-size="66" font-weight="bold" fill="${INK}" letter-spacing="-2.4">places near you</text>

    <text x="80" y="418" font-family="Helvetica, Arial, sans-serif" font-size="25" fill="${MUTED}">Search every kind of business around you,</text>
    <text x="80" y="452" font-family="Helvetica, Arial, sans-serif" font-size="25" fill="${MUTED}">and see what is open right now.</text>

    <!-- badge -->
    <rect x="80" y="500" width="290" height="52" rx="26" fill="${ACCENT}"/>
    <text x="112" y="533" font-family="Helvetica, Arial, sans-serif" font-size="21" font-weight="bold" fill="#FFFFFF" letter-spacing="0.4">Free · iOS and Android</text>
  </svg>
`);

// The same mark.png the page's nav uses, rather than a second hand-drawn
// copy of an older pin — which is how a brand ends up with two logos.
const mark = await sharp(join(HERE, 'img', 'mark.png')).resize(60, 60).toBuffer();

const out = join(HERE, 'img', 'og.png');
const info = await sharp(background)
  .composite([
    { input: mark, left: 80, top: 80 },
    { input: rounded, left: W - pw - 96, top: Math.round((H - ph) / 2) },
  ])
  .png({ compressionLevel: 9 })
  .toFile(out);

console.log(`wrote ${out} — ${info.width}x${info.height}, ${(info.size / 1024).toFixed(0)}KB`);
