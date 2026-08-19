import {
  CLOSE_SPAN,
  countOutside,
  DEFAULT_SPAN,
  frameFor,
  MAX_SPAN,
  type Point,
} from '../mapFrame';

const HOME: Point = { lat: -1.29, lng: 36.82 };

/** Every pin has to be inside the frame, or it is off the edge of the screen. */
const holds = (frame: ReturnType<typeof frameFor>, points: Point[]) =>
  points.every(
    (p) =>
      Math.abs(p.lat - frame.latitude) <= frame.latitudeDelta / 2 &&
      Math.abs(p.lng - frame.longitude) <= frame.longitudeDelta / 2,
  );

describe('frameFor', () => {
  it('falls back to a neighbourhood around the device when there is nothing', () => {
    const frame = frameFor([], HOME);
    expect(frame.latitude).toBe(HOME.lat);
    expect(frame.latitudeDelta).toBe(DEFAULT_SPAN);
  });

  it('sits close on a single listing', () => {
    const frame = frameFor([{ lat: -0.55, lng: 36.95 }], HOME);
    expect(frame.latitude).toBe(-0.55);
    expect(frame.latitudeDelta).toBe(CLOSE_SPAN);
  });

  it('holds two listings a long way apart, which is the reported bug', () => {
    // Nairobi and Othaya, about 130 km. The old fixed 0.075 window showed one.
    const points: Point[] = [
      { lat: -1.29, lng: 36.82 },
      { lat: -0.55, lng: 36.95 },
    ];
    const frame = frameFor(points, HOME);
    expect(holds(frame, points)).toBe(true);
  });

  it('holds a whole scatter of listings', () => {
    const points: Point[] = [
      { lat: -1.29, lng: 36.82 },
      { lat: -0.55, lng: 36.95 },
      { lat: -1.31, lng: 36.79 },
      { lat: -4.04, lng: 39.66 },
    ];
    expect(holds(frameFor(points, HOME), points)).toBe(true);
  });

  it('centres between the outermost pins', () => {
    const frame = frameFor(
      [
        { lat: 0, lng: 10 },
        { lat: 2, lng: 14 },
      ],
      HOME,
    );
    expect(frame.latitude).toBeCloseTo(1, 6);
    expect(frame.longitude).toBeCloseTo(12, 6);
  });

  it('never gets tighter than one shop, even for pins on top of each other', () => {
    const frame = frameFor(
      [
        { lat: -1.29, lng: 36.82 },
        { lat: -1.29, lng: 36.82 },
      ],
      HOME,
    );
    expect(frame.latitudeDelta).toBe(CLOSE_SPAN);
  });

  it('stops widening before the map becomes a globe', () => {
    const frame = frameFor(
      [
        { lat: -40, lng: -70 },
        { lat: 60, lng: 120 },
      ],
      HOME,
    );
    expect(frame.latitudeDelta).toBe(MAX_SPAN);
  });

  it('lets a focused listing win over everything else', () => {
    const frame = frameFor(
      [
        { lat: -1.29, lng: 36.82 },
        { lat: -4.04, lng: 39.66 },
      ],
      HOME,
      { lat: -0.55, lng: 36.95 },
    );
    expect(frame.latitude).toBe(-0.55);
    expect(frame.latitudeDelta).toBe(CLOSE_SPAN);
  });

  it('ignores a null island coordinate rather than spanning a hemisphere', () => {
    const real: Point[] = [
      { lat: -1.29, lng: 36.82 },
      { lat: -1.31, lng: 36.79 },
    ];
    const frame = frameFor([...real, { lat: 0, lng: 0 }], HOME);
    expect(holds(frame, real)).toBe(true);
    expect(frame.latitudeDelta).toBeLessThan(1);
  });

  it('ignores a coordinate that is not a number', () => {
    const frame = frameFor(
      [{ lat: -1.29, lng: 36.82 }, { lat: NaN, lng: 36.8 }],
      HOME,
    );
    expect(Number.isFinite(frame.latitude)).toBe(true);
    expect(frame.latitude).toBe(-1.29);
  });
});

describe('countOutside', () => {
  const region = { latitude: 0, longitude: 0, latitudeDelta: 2, longitudeDelta: 2 };

  it('counts nothing when everything is in frame', () => {
    expect(countOutside([{ lat: 0.5, lng: -0.5 }], region)).toBe(0);
  });

  it('counts what has fallen off either edge', () => {
    expect(
      countOutside([{ lat: 5, lng: 0 }, { lat: 0, lng: -9 }, { lat: 0.2, lng: 0.2 }], region),
    ).toBe(2);
  });

  it('treats a pin exactly on the edge as inside', () => {
    expect(countOutside([{ lat: 1, lng: 1 }], region)).toBe(0);
  });
});
