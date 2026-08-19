/**
 * Getting from where somebody is to a listing, drawn on our own map.
 *
 * "Directions" used to open google.com/maps in a browser, which is a strange
 * thing for a directory to do: it hands the person to a competitor's map,
 * loses the listing, and on a phone without Chrome does nothing at all. The
 * documentation claimed directions stayed in the app. They did not.
 *
 * The route comes from OSRM's public demo server, which needs no key and no
 * account — the same reasoning as the tiles. It is a demo server and it is
 * allowed to be slow or absent, so every caller has to survive getting
 * nothing back, and the "open in a maps app" escape hatch stays.
 *
 * The decoding and the summarising are pure and tested here. The fetch is the
 * only part that needs a network.
 */

export type LatLng = { lat: number; lng: number };

export type Route = {
  /** The line to draw, in order. */
  points: LatLng[];
  metres: number;
  seconds: number;
};

/**
 * Google's encoded polyline, which OSRM speaks by default.
 *
 * Precision 5 is the default; OSRM can be asked for 6. Written out rather
 * than pulled in as a dependency because it is twenty lines and the app
 * already carries enough.
 */
export function decodePolyline(encoded: string, precision = 5): LatLng[] {
  const factor = 10 ** precision;
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      if (Number.isNaN(byte)) return points;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      if (Number.isNaN(byte)) return points;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / factor, lng: lng / factor });
  }

  return points;
}

/** "3.2 km" or "450 m". Metres below a kilometre, because that is walkable. */
export function formatRouteDistance(metres: number): string {
  if (!Number.isFinite(metres) || metres < 0) return '';
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km`;
}

/** "12 min" or "1 h 20 min". Never "0 min" — round up to a minute. */
export function formatRouteTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** "3.2 km · 12 min by car", or just the distance when the time is missing. */
export function describeRoute(route: Route, mode: 'driving' | 'walking' = 'driving'): string {
  const distance = formatRouteDistance(route.metres);
  const time = formatRouteTime(route.seconds);
  if (!time) return distance;
  return `${distance} · ${time} ${mode === 'walking' ? 'on foot' : 'by car'}`;
}

/**
 * Reads OSRM's answer, or returns null.
 *
 * Null rather than throwing, and null for every shape that is not a route:
 * this is a free public server answering over a mobile connection, so a
 * truncated body and an HTML error page are both ordinary. The screen shows
 * the straight-line distance it already had when this returns nothing.
 */
export function parseOsrm(payload: unknown): Route | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as { code?: unknown; routes?: unknown };
  if (body.code !== 'Ok' || !Array.isArray(body.routes) || body.routes.length === 0) return null;

  const first = body.routes[0] as { geometry?: unknown; distance?: unknown; duration?: unknown };
  if (typeof first.geometry !== 'string') return null;

  const points = decodePolyline(first.geometry);
  // A route of one point is not a route; drawing it would be an invisible dot.
  if (points.length < 2) return null;

  return {
    points,
    metres: typeof first.distance === 'number' ? first.distance : 0,
    seconds: typeof first.duration === 'number' ? first.duration : 0,
  };
}

/**
 * Fewer points, same shape.
 *
 * A full-detail route is hundreds of coordinates. The real map hands those to
 * a renderer and does not care; the drawn fallback turns each segment into a
 * view, and hundreds of views to draw one line is not worth the fidelity at
 * the size it appears. Keeps the ends, and evenly spaced points between.
 */
export function thin<T>(points: T[], limit: number): T[] {
  if (limit < 2 || points.length <= limit) return [...points];

  const step = (points.length - 1) / (limit - 1);
  const kept: T[] = [];
  for (let i = 0; i < limit; i += 1) kept.push(points[Math.round(i * step)]);
  return kept;
}

/** Consecutive pairs, which is what a line is made of. */
export function segmentsOf<T>(points: T[]): [T, T][] {
  const pairs: [T, T][] = [];
  for (let i = 1; i < points.length; i += 1) pairs.push([points[i - 1], points[i]]);
  return pairs;
}

const OSRM = 'https://router.project-osrm.org/route/v1';
const TIMEOUT_MS = 8_000;

/**
 * Asks for a route, and gives up quietly.
 *
 * Eight seconds, then nothing. Somebody standing on a street corner wanting
 * to know which way to walk is not helped by a spinner that never stops, and
 * the screen has a straight line and a distance to fall back on.
 */
export async function fetchRoute(
  from: LatLng,
  to: LatLng,
  mode: 'driving' | 'walking' = 'driving',
): Promise<Route | null> {
  const profile = mode === 'walking' ? 'foot' : 'driving';
  const url =
    `${OSRM}/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=full&geometries=polyline&alternatives=false&steps=false`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return parseOsrm(await response.json());
  } catch {
    // No network, a timeout, an HTML error page. All the same answer here.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
