import {
  checkImage,
  isUpload,
  MAX_IMAGE_BYTES,
  PRESETS,
  presetFrom,
  presetRef,
  storagePath,
} from '../avatars';

describe('presets', () => {
  it('round-trips a preset through its stored form', () => {
    const ref = presetRef('sun');
    expect(ref).toBe('preset:sun');
    expect(presetFrom(ref)?.id).toBe('sun');
  });

  it('gives nothing for a preset that does not exist', () => {
    expect(presetFrom('preset:nope')).toBeNull();
  });

  it('treats a URL as an upload, not a preset', () => {
    const url = 'https://example.test/storage/a.jpg';
    expect(presetFrom(url)).toBeNull();
    expect(isUpload(url)).toBe(true);
    expect(isUpload('preset:sun')).toBe(false);
    expect(isUpload(null)).toBe(false);
  });

  it('has no duplicate ids', () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
  });
});

describe('checkImage', () => {
  it('accepts the three formats a phone camera produces', () => {
    for (const mimeType of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(checkImage({ mimeType, fileSize: 1000 })).toEqual({ ok: true, type: mimeType });
    }
  });

  it('is not fooled by case', () => {
    expect(checkImage({ mimeType: 'IMAGE/JPEG', fileSize: 10 }).ok).toBe(true);
  });

  it('refuses anything else, including things that merely look like images', () => {
    expect(checkImage({ mimeType: 'image/svg+xml', fileSize: 10 }).ok).toBe(false);
    expect(checkImage({ mimeType: 'application/pdf', fileSize: 10 }).ok).toBe(false);
    expect(checkImage({ mimeType: 'text/html', fileSize: 10 }).ok).toBe(false);
  });

  it('refuses anything over five megabytes', () => {
    expect(checkImage({ mimeType: 'image/jpeg', fileSize: MAX_IMAGE_BYTES + 1 }).ok).toBe(false);
    expect(checkImage({ mimeType: 'image/jpeg', fileSize: MAX_IMAGE_BYTES }).ok).toBe(true);
  });

  it('falls back to the extension when the picker gives no type', () => {
    expect(checkImage({ fileName: 'holiday.PNG', fileSize: 10 })).toEqual({
      ok: true,
      type: 'image/png',
    });
  });

  it('gives up rather than guessing when there is nothing to go on', () => {
    expect(checkImage({ fileName: 'mystery', fileSize: 10 }).ok).toBe(false);
    expect(checkImage({}).ok).toBe(false);
  });

  it('accepts a file whose size the picker did not report', () => {
    // Better to try the upload and let the bucket refuse it than to block a
    // real photo because the platform was vague about it.
    expect(checkImage({ mimeType: 'image/jpeg' }).ok).toBe(true);
  });
});

describe('storagePath', () => {
  it('puts the file in a folder named after the owner', () => {
    // This is what the storage policy checks. Anything else and one account
    // could overwrite another's picture.
    expect(storagePath('user-1', 'image/jpeg').startsWith('user-1/')).toBe(true);
  });

  it('uses the extension that matches the type', () => {
    expect(storagePath('u', 'image/png')).toMatch(/\.png$/);
    expect(storagePath('u', 'image/webp')).toMatch(/\.webp$/);
    expect(storagePath('u', 'image/jpeg')).toMatch(/\.jpg$/);
  });

  it('never reuses a name, so a replacement cannot be served from cache', () => {
    const a = storagePath('u', 'image/jpeg', 1000);
    const b = storagePath('u', 'image/jpeg', 1000);
    expect(a).not.toBe(b);
  });
});
