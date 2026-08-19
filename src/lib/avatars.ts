/**
 * Profile pictures: the built-in set, and what an upload has to satisfy.
 *
 * All of it is pure. Which preset somebody picked and whether a file is an
 * acceptable image are decisions, and decisions belong where they can be
 * tested without a device or a network.
 */
import type { ToneName } from '../theme/tokens';

/**
 * The built-in avatars.
 *
 * Drawn from the same tone palette the rest of the app uses rather than
 * shipped as images: nothing to download, nothing to go missing, and they
 * stay sharp at any size. Somebody who does not want to upload a photo of
 * themselves still gets something that is theirs.
 */
export type Preset = { id: string; tone: ToneName; icon: string };

export const PRESETS: Preset[] = [
  { id: 'sun', tone: 'orange', icon: 'sunny' },
  { id: 'leaf', tone: 'green', icon: 'leaf' },
  { id: 'wave', tone: 'blue', icon: 'water' },
  { id: 'bloom', tone: 'pink', icon: 'flower' },
  { id: 'star', tone: 'amber', icon: 'star' },
  { id: 'moon', tone: 'violet', icon: 'moon' },
  { id: 'cup', tone: 'brown', icon: 'cafe' },
  { id: 'note', tone: 'teal', icon: 'musical-notes' },
  { id: 'spark', tone: 'plum', icon: 'sparkles' },
  { id: 'peak', tone: 'steel', icon: 'triangle' },
];

/** A preset is stored as `preset:sun`, so one column holds either kind. */
export const PRESET_PREFIX = 'preset:';

export function presetRef(id: string): string {
  return `${PRESET_PREFIX}${id}`;
}

/** The preset a stored value names, or null if it names an uploaded file. */
export function presetFrom(value: string | null | undefined): Preset | null {
  if (!value || !value.startsWith(PRESET_PREFIX)) return null;
  const id = value.slice(PRESET_PREFIX.length);
  return PRESETS.find((p) => p.id === id) ?? null;
}

/** Whether a stored value points at a file rather than a built-in. */
export function isUpload(value: string | null | undefined): boolean {
  return !!value && !value.startsWith(PRESET_PREFIX);
}

/* --------------------------------------------------------- uploaded files */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type ImageCheck = { ok: true; type: string } | { ok: false; reason: string };

/**
 * Whether a picked file is something we will accept.
 *
 * The bucket enforces the same two rules, and that is the enforcement; this
 * exists so somebody hears "that photo is too large" straight away rather
 * than after waiting for five megabytes to upload and be refused.
 *
 * The type is taken from the picker rather than from the file name. An
 * extension is a claim; a mime type from the OS picker is at least the
 * platform's own reading of the file.
 */
export function checkImage(file: {
  mimeType?: string | null;
  fileSize?: number | null;
  fileName?: string | null;
}): ImageCheck {
  const type = (file.mimeType ?? guessType(file.fileName) ?? '').toLowerCase();

  if (!type) {
    return { ok: false, reason: 'We could not tell what kind of file that is.' };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { ok: false, reason: 'Pick a JPEG, PNG or WebP image.' };
  }
  if (typeof file.fileSize === 'number' && file.fileSize > MAX_IMAGE_BYTES) {
    return { ok: false, reason: 'That image is over 5 MB. Pick a smaller one.' };
  }
  return { ok: true, type };
}

/** Last resort when the picker gives no mime type. */
function guessType(name: string | null | undefined): string | null {
  const ext = (name ?? '').toLowerCase().split('.').pop();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return null;
}

/**
 * Where a file goes in its bucket.
 *
 * The first segment is the owner's id, because that is what the storage
 * policy checks: you may write inside a folder named after yourself and
 * nowhere else. Getting this wrong is not a cosmetic problem, it is the
 * difference between a private namespace and one anybody can overwrite.
 */
export function storagePath(userId: string, type: string, now = Date.now()): string {
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  // A fresh name every time, so a replaced picture is never served from a
  // cache under its old URL.
  return `${userId}/${now}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}
