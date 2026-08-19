import { hashDevice } from '../deviceId';

describe('hashDevice', () => {
  it('is the same device every time', () => {
    expect(hashDevice('seed-1', 'Samsung SM-A536', 'android 14')).toBe(
      hashDevice('seed-1', 'Samsung SM-A536', 'android 14'),
    );
  });

  /*
   * The seed is what makes two installs on one handset different, and two
   * handsets of the same model different. Without it every Samsung A53 in
   * Nairobi would look like one device and the shared-device rule would flag
   * half the city.
   */
  it('separates two installs on identical hardware', () => {
    expect(hashDevice('seed-1', 'Samsung SM-A536', 'android 14')).not.toBe(
      hashDevice('seed-2', 'Samsung SM-A536', 'android 14'),
    );
  });

  it('separates the same install description on different hardware', () => {
    expect(hashDevice('seed-1', 'Samsung SM-A536', 'android 14')).not.toBe(
      hashDevice('seed-1', 'Apple iPhone 15', 'ios 18'),
    );
  });

  it('gives something short and opaque, never the input back', () => {
    const id = hashDevice('seed-1', 'Samsung SM-A536', 'android 14');
    expect(id).toMatch(/^[0-9a-z]{7,}$/);
    expect(id).not.toContain('Samsung');
    expect(id).not.toContain('seed');
  });

  it('copes with a device that reports nothing about itself', () => {
    expect(hashDevice('seed-1', '', '')).toMatch(/^[0-9a-z]{7,}$/);
  });
});
