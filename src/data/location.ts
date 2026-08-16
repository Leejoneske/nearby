/**
 * Where the app looks from until the device gives us a real fix.
 *
 * Nairobi city centre. Every distance on screen is measured from here, so a
 * device that refuses the location permission still gets sensible ordering
 * rather than an empty map.
 */
export const DEFAULT_ORIGIN = { lat: -1.2673, lng: 36.8065 };
export const DEFAULT_CITY = 'Nairobi';
export const DEFAULT_AREA = 'Westlands, Nairobi';
