/**
 * Design tokens that do not change with the theme.
 *
 * Colour used to live here too. It moved to `palettes.ts`, which holds one
 * set per theme, and screens reach it through `useTheme()` — so this file is
 * now the things that are the same whichever palette is in force: the grid,
 * the radii, the type scale.
 *
 * Removing `colors` and `tones` from here was deliberate rather than tidy. It
 * turns "did I convert every screen" from a question somebody has to answer
 * by looking into one the compiler answers.
 *
 * Original notes on the values:
 *
 * Two references drive these values:
 *  - the cafe-discovery mockup, for the warm neutrals and the card/list rhythm
 *  - the fintech mockup, for the shapes: light-gray canvas, oversized bold type,
 *    fully-rounded controls and the floating capsule tab bar
 *
 * Everything visual should come from here. A raw hex or a magic number in a
 * screen is how two lists end up with slightly different row heights.
 */

/**
 * Icon tones.
 *
 * Every glyph in the app used to be the brand orange on a pale orange tile,
 * which made ten different things look like ten copies of the same thing —
 * and made the accent stop meaning "this is the action" because everything
 * was already wearing it.
 *
 * Each tone is a pair: `fg` for the glyph, `soft` for the tile behind it when
 * there is one. The soft values are pre-flattened onto the canvas rather than
 * being the fg at low opacity, so they render identically over a card and
 * over the app background.
 *
 * Orange stays reserved for what it always meant: the primary action, the
 * active tab, the price. Reach for another tone when the icon is a label
 * rather than a button.
 */

export type { ToneName } from './palettes';

/** 4pt grid. Screens use `screen` for their horizontal gutter. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  screen: 20,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  /** Anything that should read as a capsule: buttons, chips, the tab bar. */
  pill: 999,
} as const;

/**
 * Type scale. `display` is the fintech reference's headline — deliberately
 * large and tight; it is what makes an otherwise plain screen feel designed.
 */
export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800' },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  cardTitle: { fontSize: 16, lineHeight: 21, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  meta: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  metaStrong: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 11, lineHeight: 15, fontWeight: '500' },
  button: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
} as const;

/**
 * Shadows. iOS reads the shadow* keys, Android reads elevation, and web takes
 * the iOS ones through react-native-web — so all three are always set.
 */
export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  floating: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
} as const;

/**
 * Spreadable absolute fill. `StyleSheet.absoluteFill` is a registered style ID
 * and cannot be spread into another style object, and RN 0.86 no longer types
 * `absoluteFillObject`, so this is the version that composes.
 */
export const absoluteFill = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const;

/** Height of the floating tab bar, so screens can pad their scroll content. */
export const TAB_BAR_HEIGHT = 68;
export const TAB_BAR_INSET = 16;
