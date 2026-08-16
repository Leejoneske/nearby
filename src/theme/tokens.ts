/**
 * Design tokens for Nearby.
 *
 * Two references drive these values:
 *  - the cafe-discovery mockup, for the warm neutrals and the card/list rhythm
 *  - the fintech mockup, for the shapes: light-gray canvas, oversized bold type,
 *    fully-rounded controls and the floating capsule tab bar
 *
 * Everything visual should come from here. A raw hex or a magic number in a
 * screen is how two lists end up with slightly different row heights.
 */

export const colors = {
  /** App canvas. Slightly gray so white cards read as raised. */
  canvas: '#F2F2F2',
  /** Cards, sheets, the tab bar capsule. */
  surface: '#FFFFFF',
  /** Warm tint behind the home hero, from the cafe reference. */
  surfaceWarm: '#FBF1E7',
  /** Pressed/selected state on a white surface. */
  surfaceSunken: '#EDEDED',

  /** Brand accent — CTAs, active tab, price tags, map pins. */
  accent: '#FF5A1F',
  accentPressed: '#E64A12',
  /** Accent at low opacity, for chips and badges. Pre-flattened onto canvas. */
  accentSoft: '#FFE9E0',

  textPrimary: '#111111',
  textSecondary: '#6B6B6B',
  textTertiary: '#9A9A9A',
  /** Text on top of the accent. */
  textOnAccent: '#FFFFFF',

  border: '#E6E6E6',
  borderStrong: '#D4D4D4',

  star: '#FFB300',
  success: '#1B9C5D',
  successSoft: '#E4F5EC',
  danger: '#D93025',
  dangerSoft: '#FBE9E7',

  /** Map surface colors, so the web fallback and native styling agree. */
  mapLand: '#F3F1EC',
  mapWater: '#CFE3EC',
  mapPark: '#DCE9D5',
  mapRoad: '#FFFFFF',
  mapRoadCasing: '#E8E4DC',

  overlay: 'rgba(0,0,0,0.45)',
} as const;

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
