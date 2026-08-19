/**
 * What the map should be looking at.
 *
 * The camera used to sit on a fixed window around the device — 0.075 degrees,
 * call it eight kilometres. Every listing further out than that was on the
 * map, in the marker list, correctly positioned, and off the edge of the
 * screen. From inside the app that is indistinguishable from a map that has
 * lost the listings, which is what it was reported as.
 *
 * So the frame is computed from the pins. Pure, because "which of these am I
 * looking at and how far out" is the part worth being sure about, and it needs
 * no map to check.
 */

export type Point = { lat: number; lng: number };

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

/** One shop with nothing else around it. Any tighter and it is a rooftop. */
export const CLOSE_SPAN = 0.012;

/** Nothing to frame at all: a neighbourhood, so the map is not a whole country. */
export const DEFAULT_SPAN = 0.075;

/** Past this the pins are specks and the map is useless as a map. */
export const MAX_SPAN = 12;

/** Room around the outermost pins, so none of them sits under the edge. */
const PADDING = 1.35;

/**
 * The frame that holds every point given, or a sensible one when there are
 * none.
 *
 * `focus`, when set, wins outright: arriving from a listing's Directions
 * button means the question is "where is this one", not "where is everything".
 */
export function frameFor(
  points: Point[],
  fallback: Point,
  focus?: Point | null,
): Region {
  if (focus) {
    return {
      latitude: focus.lat,
      longitude: focus.lng,
      latitudeDelta: CLOSE_SPAN,
      longitudeDelta: CLOSE_SPAN,
    };
  }

  const usable = points.filter(
    (p) =>
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng) &&
      // 0,0 is in the Atlantic and is what a missing coordinate looks like.
      // One of those in the set would stretch the frame across a hemisphere.
      !(p.lat === 0 && p.lng === 0),
  );

  if (usable.length === 0) {
    return {
      latitude: fallback.lat,
      longitude: fallback.lng,
      latitudeDelta: DEFAULT_SPAN,
      longitudeDelta: DEFAULT_SPAN,
    };
  }

  if (usable.length === 1) {
    return {
      latitude: usable[0].lat,
      longitude: usable[0].lng,
      latitudeDelta: CLOSE_SPAN,
      longitudeDelta: CLOSE_SPAN,
    };
  }

  const lats = usable.map((p) => p.lat);
  const lngs = usable.map((p) => p.lng);
  const north = Math.max(...lats);
  const south = Math.min(...lats);
  const east = Math.max(...lngs);
  const west = Math.min(...lngs);

  /*
   * One span for both axes, taken from the wider one.
   *
   * A rectangle fitted exactly to the pins only fills the screen if the
   * screen happens to be that shape. Squaring it off means the frame is
   * never tighter than the content on either axis, which is the only
   * property that matters here: nothing gets cropped.
   */
  const span = Math.max((north - south) * PADDING, (east - west) * PADDING, CLOSE_SPAN);

  return {
    latitude: (north + south) / 2,
    longitude: (east + west) / 2,
    latitudeDelta: Math.min(span, MAX_SPAN),
    longitudeDelta: Math.min(span, MAX_SPAN),
  };
}

/**
 * Whether some of the pins are outside the frame.
 *
 * Used to offer "show all" rather than to move the map by itself. Somebody
 * who has panned somewhere deliberately should not have the camera yanked
 * back, but they should be told there is more than they can see.
 */
export function countOutside(points: Point[], region: Region): number {
  const halfLat = region.latitudeDelta / 2;
  const halfLng = region.longitudeDelta / 2;

  return points.filter(
    (p) =>
      Math.abs(p.lat - region.latitude) > halfLat ||
      Math.abs(p.lng - region.longitude) > halfLng,
  ).length;
}
