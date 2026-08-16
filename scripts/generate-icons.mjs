/**
 * Renders every icon from the one artwork in assets/source/icon.png, so the
 * launcher icon, the adaptive icon, the splash mark, the favicons and the
 * touch icon can never drift apart.
 *
 *   node scripts/generate-icons.mjs
 *
 * The source is a map pin with a storefront in its counter: the pin says
 * "somewhere near you", the storefront says "a business", and a directory app
 * needs both.
 *
 * Two things about that file drive most of what happens below.
 *
 * It is **transparent outside the mark and inside the ring**. The white circle
 * you see when you open it is whatever is behind it. That is the right way to
 * ship artwork — but it means anything compositing the mark onto a colour gets
 * that colour inside the ring too, and an orange counter inside an orange ring
 * is not a ring any more. `fillCounter` closes those interior holes with white
 * before compositing.
 *
 * And it is **not square, and not tightly cropped** — 1278x1230 with a wide
 * transparent margin. Resizing it as-is would centre the canvas rather than
 * the mark, and spend a third of every icon on nothing. So it is trimmed to
 * its content and re-padded square first.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'assets', 'source', 'icon.png');
const APP = join(ROOT, 'assets', 'images');
const LANDING = join(ROOT, 'landing');
const LANDING_IMG = join(LANDING, 'img');

/** The canvas everything is drawn on before its final resize. */
const CANVAS = 1024;

/* ------------------------------------------------------------- preparing -- */

/**
 * Fills the holes inside the mark with white, leaving the outside alone.
 *
 * A flood fill inward from the edges marks every transparent pixel connected
 * to the border. Anything still transparent afterwards is enclosed by the
 * artwork — the pin's counter — and gets filled.
 *
 * Only fully transparent pixels are touched, so the fill does not eat into
 * the antialiasing and leave the ring with a hard, jagged inner edge.
 */
function fillCounter(data, width, height) {
  const size = width * height;
  const outside = new Uint8Array(size);
  const queue = new Int32Array(size);
  let head = 0;
  let tail = 0;

  const transparent = (i) => data[i * 4 + 3] < 8;

  const push = (i) => {
    if (!outside[i] && transparent(i)) {
      outside[i] = 1;
      queue[tail++] = i;
    }
  };

  for (let x = 0; x < width; x += 1) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }

  while (head < tail) {
    const i = queue[head++];
    const x = i % width;
    const y = (i / width) | 0;
    if (x > 0) push(i - 1);
    if (x < width - 1) push(i + 1);
    if (y > 0) push(i - width);
    if (y < height - 1) push(i + width);
  }

  for (let i = 0; i < size; i += 1) {
    if (!outside[i] && transparent(i)) {
      const p = i * 4;
      data[p] = 255;
      data[p + 1] = 255;
      data[p + 2] = 255;
      data[p + 3] = 255;
    }
  }

  return data;
}

/**
 * The artwork trimmed to its content and padded to a square canvas.
 *
 * The padding and the resize happen in two passes on purpose. sharp runs its
 * pipeline in its own order rather than the order the calls are written, and
 * chaining these puts the resize first — which resizes the *unpadded* artwork
 * and then pads it, so the raw buffer that comes out no longer matches the
 * dimensions asked for. Reading that back at the wrong stride is what turned
 * the first run of this script into a page of orange stripes.
 */
async function squared() {
  const trimmed = await sharp(SOURCE).trim({ threshold: 8 }).toBuffer();
  const { width, height } = await sharp(trimmed).metadata();
  const side = Math.max(width, height);

  // Padded rather than stretched, so the mark keeps its proportions.
  const padded = await sharp(trimmed)
    .extend({
      top: Math.floor((side - height) / 2),
      bottom: Math.ceil((side - height) / 2),
      left: Math.floor((side - width) / 2),
      right: Math.ceil((side - width) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp(padded).resize(CANVAS, CANVAS).ensureAlpha().raw().toBuffer();
}

/** The mark, with its counter filled white so it survives a coloured ground. */
async function prepared() {
  const raw = await squared();
  return sharp(fillCounter(raw, CANVAS, CANVAS), {
    raw: { width: CANVAS, height: CANVAS, channels: 4 },
  })
    .png()
    .toBuffer();
}

/**
 * A flat silhouette, for Android's themed icons.
 *
 * Built from the alpha channel: wherever the artwork is opaque, black. The
 * counter is a hole in the artwork and stays a hole here, which is the only
 * thing keeping the mark from collapsing into a solid blob — which is why
 * this starts from the unfilled version.
 */
async function silhouette() {
  const raw = await squared();

  for (let i = 0; i < CANVAS * CANVAS; i += 1) {
    const p = i * 4;
    raw[p] = 0;
    raw[p + 1] = 0;
    raw[p + 2] = 0;
  }

  return sharp(raw, { raw: { width: CANVAS, height: CANVAS, channels: 4 } })
    .png()
    .toBuffer();
}

/**
 * Places the mark on a canvas at `scale`, optionally over a solid colour.
 *
 * `scale` is what keeps the mark clear of whatever mask a platform applies —
 * iOS rounds the corners, and Android's launchers crop adaptive icons to
 * anything from a circle to a squircle.
 */
async function compose(mark, { scale, background = null, size }) {
  const inner = Math.round(CANVAS * scale);
  const pad = Math.round((CANVAS - inner) / 2);
  const scaled = await sharp(mark).resize(inner, inner).toBuffer();

  /*
   * Composited at full size and resized afterwards, in two passes.
   *
   * sharp orders its own pipeline rather than running calls in the order they
   * are written: a resize chained onto this would shrink the canvas *before*
   * the composite, and pasting an 860px mark onto a 96px favicon fails
   * outright.
   */
  const full = await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background: background ? { ...background, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: scaled, top: pad, left: pad }])
    .png()
    .toBuffer();

  return sharp(full)
    .resize(size, size)
    .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
    .toBuffer();
}

/* --------------------------------------------------------------- targets -- */

const WHITE = { r: 255, g: 255, b: 255 };

const mark = await prepared();
const flat = await silhouette();

const targets = [
  // iOS's launcher icon, and the fallback everywhere else. Opaque, because
  // iOS refuses an app icon that carries an alpha channel at all.
  { dir: APP, file: 'icon.png', size: 1024, mark, scale: 0.84, background: WHITE },

  // Android composites this over its own background layer, so it stays
  // transparent outside the mark and is pulled well in — a launcher may crop
  // it to a circle, and the pin's tip is the first thing to go.
  { dir: APP, file: 'android-icon-foreground.png', size: 1024, mark, scale: 0.58 },

  // Themed icons get re-tinted by the launcher, so this has to read as a
  // silhouette rather than as artwork.
  { dir: APP, file: 'android-icon-monochrome.png', size: 1024, mark: flat, scale: 0.58 },

  // The splash mark, transparent so it sits on the splash background.
  { dir: APP, file: 'splash-icon.png', size: 512, mark, scale: 0.94 },

  // Browser tabs. At this size the storefront is a suggestion rather than
  // detail, which is why the pin's outline has to carry it.
  { dir: APP, file: 'favicon.png', size: 96, mark, scale: 0.92, background: WHITE },
  { dir: LANDING, file: 'favicon.png', size: 96, mark, scale: 0.92, background: WHITE },

  // Home-screen bookmarks on iOS. Opaque and unrounded: iOS masks it itself,
  // and a pre-rounded icon gets rounded twice.
  { dir: LANDING, file: 'apple-touch-icon.png', size: 180, mark, scale: 0.8, background: WHITE },

  // The mark on its own, transparent, for the landing page's nav and its
  // social card. Both used to draw their own copy of an older pin in SVG,
  // which is how a brand ends up with two logos.
  { dir: LANDING_IMG, file: 'mark.png', size: 256, mark, scale: 1 },
];

await mkdir(APP, { recursive: true });
await mkdir(LANDING, { recursive: true });
await mkdir(LANDING_IMG, { recursive: true });

for (const target of targets) {
  const png = await compose(target.mark, {
    scale: target.scale,
    background: target.background,
    size: target.size,
  });

  await writeFile(join(target.dir, target.file), png);
  console.log(`wrote ${target.file} (${target.size}px, ${(png.length / 1024).toFixed(1)} kB)`);
}
