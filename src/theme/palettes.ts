/**
 * The two palettes, with identical keys.
 *
 * Identical keys is the whole contract: a screen names a role — `surface`,
 * `textSecondary` — and never a colour, so switching the palette switches
 * everything and nothing has to know which one is in force. A key that exists
 * in one and not the other would be a screen that renders in one theme and
 * crashes in the other.
 *
 * The dark palette is not the light one inverted. Pure black canvases make
 * white text vibrate and lose the sense of cards sitting above a surface, so
 * the ground is a very dark warm grey and each layer above it is lighter,
 * which is the same "cards read as raised" idea the light theme is built on.
 * The warmth is deliberate too: this app's accent is orange, and a neutral
 * grey next to it reads blue.
 */
export type Palette = {
  canvas: string;
  surface: string;
  surfaceWarm: string;
  surfaceSunken: string;

  accent: string;
  accentPressed: string;
  accentSoft: string;

  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textOnAccent: string;

  border: string;
  borderStrong: string;

  star: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerPressed: string;
  dangerSoft: string;

  mapLand: string;
  mapWater: string;
  mapPark: string;
  mapRoad: string;
  mapRoadCasing: string;

  /** The tab bar capsule, which sits over the canvas and must read as raised. */
  tabBar: string;
  /** A control floating over a photo, where the photo is the background. */
  scrim: string;
  /** The verified tick beside an avatar. Blue in both, as everybody expects. */
  verified: string;
  /** Where a photo has not loaded, and the tint over one that has. */
  photoPlaceholder: string;
  photoTint: string;
  /** The drawn map's paper, for the fallback when tiles cannot be reached. */
  paperLand: string;
  paperPark: string;
  paperInk: string;
  paperInkSoft: string;

  overlay: string;
  /** Shadow colour. Black on light; on dark a shadow does nothing, so it is
   *  the border that carries the separation instead. */
  shadow: string;
  shadowOpacity: number;
};

export const light: Palette = {
  canvas: '#F2F2F2',
  surface: '#FFFFFF',
  surfaceWarm: '#FBF1E7',
  surfaceSunken: '#EDEDED',

  accent: '#FF5A1F',
  accentPressed: '#E64A12',
  accentSoft: '#FFE9E0',

  textPrimary: '#111111',
  textSecondary: '#6B6B6B',
  textTertiary: '#9A9A9A',
  textOnAccent: '#FFFFFF',

  border: '#E6E6E6',
  borderStrong: '#D4D4D4',

  star: '#FFB300',
  success: '#1B9C5D',
  successSoft: '#E4F5EC',
  danger: '#D93025',
  dangerPressed: '#B3241B',
  dangerSoft: '#FBE9E7',

  mapLand: '#F3F1EC',
  mapWater: '#CFE3EC',
  mapPark: '#DCE9D5',
  mapRoad: '#FFFFFF',
  mapRoadCasing: '#E8E4DC',

  tabBar: '#DEDEDE',
  scrim: 'rgba(255,255,255,0.92)',
  verified: '#2E9BF0',
  photoPlaceholder: '#DDDDDD',
  photoTint: 'rgba(255,255,255,0.16)',
  paperLand: '#F7E7C8',
  paperPark: '#E9D4AC',
  paperInk: '#9A9384',
  paperInkSoft: '#B0A896',

  overlay: 'rgba(0,0,0,0.45)',
  shadow: '#000000',
  shadowOpacity: 0.06,
};

export const dark: Palette = {
  canvas: '#121010',
  surface: '#1D1A19',
  surfaceWarm: '#241F1A',
  surfaceSunken: '#2A2523',

  /*
   * The same orange as the light theme, and it has to be.
   *
   * The instinct on a dark ground is to lift the accent so it sings, and that
   * was the first version here: #FF6B33. But the label on an accent button is
   * white, and lifting the orange took that pair from 3.1 to 2.8 to one,
   * under the bar for large text. The button is the most important thing on
   * several screens. It reads perfectly well unlifted against #121010.
   *
   * The pressed state gets darker rather than lighter, or a held button looks
   * like it lit up.
   */
  accent: '#FF5A1F',
  accentPressed: '#D9501C',
  accentSoft: '#3B241A',

  textPrimary: '#F4F1EF',
  textSecondary: '#ADA49F',
  textTertiary: '#7C736E',
  textOnAccent: '#FFFFFF',

  border: '#2E2A28',
  borderStrong: '#443D3A',

  star: '#FFC340',
  success: '#4ECB8D',
  successSoft: '#16301F',
  danger: '#FF7264',
  dangerPressed: '#D9564A',
  dangerSoft: '#3A1C19',

  mapLand: '#1B1817',
  mapWater: '#16272F',
  mapPark: '#182619',
  mapRoad: '#2B2624',
  mapRoadCasing: '#211D1B',

  tabBar: '#2A2523',
  scrim: 'rgba(29,26,25,0.92)',
  verified: '#4FA8F0',
  photoPlaceholder: '#2A2523',
  photoTint: 'rgba(255,255,255,0.08)',
  paperLand: '#241F19',
  paperPark: '#2C2519',
  paperInk: '#6B645A',
  paperInkSoft: '#5A544C',

  overlay: 'rgba(0,0,0,0.65)',
  shadow: '#000000',
  shadowOpacity: 0.5,
};

/**
 * Icon tones, per palette.
 *
 * `soft` is the tile behind a glyph and is pre-flattened onto the canvas
 * rather than being the foreground at low opacity, so it renders identically
 * over a card and over the app background. That means the dark set cannot be
 * derived from the light one and has to be its own list: a pale tint over a
 * dark ground is a light patch, not a tint.
 */
export type Tone = { fg: string; soft: string };

export type ToneName =
  | 'orange' | 'brown' | 'pink' | 'gold' | 'steel' | 'green' | 'violet'
  | 'indigo' | 'slate' | 'plum' | 'blue' | 'teal' | 'amber' | 'red';

export type Tones = Record<ToneName, Tone>;

/*
 * Three of these are a shade darker than the brand values they came from.
 *
 * Orange, gold and amber on their own pale tiles were at 2.7, 2.6 and 2.2 to
 * one, under the 3:1 that a meaningful graphic needs, and a category glyph is
 * meaningful — it is how somebody tells the restaurants row from the cafes
 * row at a glance. `colors.accent` is untouched: this is the tile version,
 * not the button.
 */
export const lightTones: Tones = {
  orange: { fg: '#ED541D', soft: '#FFE9E0' },
  brown: { fg: '#8C5A3C', soft: '#F2E7DE' },
  pink: { fg: '#C2427A', soft: '#FBE6F0' },
  gold: { fg: '#B77E2A', soft: '#FBEFD9' },
  steel: { fg: '#4F6D87', soft: '#E4EBF1' },
  green: { fg: '#1B9C5D', soft: '#E4F5EC' },
  violet: { fg: '#6A5AA8', soft: '#ECE8F8' },
  indigo: { fg: '#3D5A98', soft: '#E5EAF5' },
  slate: { fg: '#6F7B87', soft: '#EAEEF1' },
  plum: { fg: '#7B3FA0', soft: '#F0E6F7' },
  blue: { fg: '#2E7BE6', soft: '#E3EDFC' },
  teal: { fg: '#0E8F9E', soft: '#DDF1F3' },
  amber: { fg: '#BC7C00', soft: '#FFF1D6' },
  red: { fg: '#D93025', soft: '#FBE9E7' },
};

export const darkTones: Tones = {
  orange: { fg: '#FF8552', soft: '#3A241B' },
  brown: { fg: '#C79571', soft: '#2E241D' },
  pink: { fg: '#F07AAC', soft: '#361D28' },
  gold: { fg: '#E7B45C', soft: '#332715' },
  steel: { fg: '#8FB0CB', soft: '#1E2A33' },
  green: { fg: '#4ECB8D', soft: '#16301F' },
  violet: { fg: '#A497E0', soft: '#262038' },
  indigo: { fg: '#7C9AD9', soft: '#1D2436' },
  slate: { fg: '#A6B2BD', soft: '#232A2F' },
  plum: { fg: '#BE85DC', soft: '#2C1D36' },
  blue: { fg: '#6FAAF5', soft: '#182739' },
  teal: { fg: '#4FC2CE', soft: '#152D31' },
  amber: { fg: '#F0B93F', soft: '#33280F' },
  red: { fg: '#FF7264', soft: '#3A1C19' },
};
