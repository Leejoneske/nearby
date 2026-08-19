/**
 * The contract between the two palettes.
 *
 * A screen names a role, never a colour, so switching palette switches
 * everything and nothing has to know which one is in force. A key that
 * existed in one and not the other would be a screen that renders in one
 * theme and shows `undefined` in the other, which React Native quietly
 * accepts and draws as transparent.
 */
import { dark, darkTones, light, lightTones } from '../../theme/palettes';

/** Relative luminance, per WCAG. */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const channels = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe('the two palettes', () => {
  it('describe exactly the same roles', () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it('name the same tones', () => {
    expect(Object.keys(darkTones).sort()).toEqual(Object.keys(lightTones).sort());
  });

  it('give every tone both halves', () => {
    for (const [name, tone] of Object.entries(darkTones)) {
      expect(typeof tone.fg).toBe('string');
      expect(typeof tone.soft).toBe('string');
      expect(tone.fg).not.toBe(tone.soft);
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('leaves nothing undefined, which renders as transparent rather than failing', () => {
    for (const value of Object.values(light)) expect(value).toBeDefined();
    for (const value of Object.values(dark)) expect(value).toBeDefined();
  });
});

describe('text stays readable', () => {
  const readable: [string, string, string, number][] = [
    ['light body on canvas', light.textPrimary, light.canvas, 4.5],
    ['light body on a card', light.textPrimary, light.surface, 4.5],
    ['light secondary on a card', light.textSecondary, light.surface, 4.5],
    ['dark body on canvas', dark.textPrimary, dark.canvas, 4.5],
    ['dark body on a card', dark.textPrimary, dark.surface, 4.5],
    ['dark secondary on a card', dark.textSecondary, dark.surface, 4.5],
    // Large bold text on a filled button, which is AA Large.
    ['light button label', light.textOnAccent, light.accent, 3],
    ['dark button label', dark.textOnAccent, dark.accent, 3],
  ];

  it.each(readable)('%s', (_name, fg, bg, minimum) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(minimum);
  });

  /*
   * The reason the dark canvas is not black. Cards have to read as sitting
   * above the ground, and two shades that close together is a flat screen
   * with rounded rectangles drawn on it.
   */
  it('keeps the dark card distinct from the dark canvas', () => {
    expect(luminance(dark.surface)).toBeGreaterThan(luminance(dark.canvas));
    expect(dark.canvas).not.toBe('#000000');
  });

  it('keeps every tone glyph legible on its own tile', () => {
    for (const [name, tone] of Object.entries(darkTones)) {
      expect([name, contrast(tone.fg, tone.soft)]).toEqual([
        name,
        expect.any(Number),
      ]);
      expect(contrast(tone.fg, tone.soft)).toBeGreaterThanOrEqual(3);
    }
    for (const [name, tone] of Object.entries(lightTones)) {
      expect(contrast(tone.fg, tone.soft)).toBeGreaterThanOrEqual(3);
      expect(name).toBeTruthy();
    }
  });
});
