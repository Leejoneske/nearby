import {
  decodePolyline,
  segmentsOf,
  thin,
  describeRoute,
  formatRouteDistance,
  formatRouteTime,
  parseOsrm,
} from '../route';

describe('decodePolyline', () => {
  it('decodes the example from Google’s own specification', () => {
    // `_p~iF~ps|U_ulLnnqC_mqNvxq`@` is the documented sample.
    const points = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(points).toHaveLength(3);
    expect(points[0].lat).toBeCloseTo(38.5, 5);
    expect(points[0].lng).toBeCloseTo(-120.2, 5);
    expect(points[1].lat).toBeCloseTo(40.7, 5);
    expect(points[1].lng).toBeCloseTo(-120.95, 5);
    expect(points[2].lat).toBeCloseTo(43.252, 5);
    expect(points[2].lng).toBeCloseTo(-126.453, 5);
  });

  it('returns nothing for an empty string rather than throwing', () => {
    expect(decodePolyline('')).toEqual([]);
  });

  it('stops cleanly on a truncated string', () => {
    expect(() => decodePolyline('_p~iF~ps|U_ulL')).not.toThrow();
  });
});

describe('formatRouteDistance', () => {
  it('uses metres under a kilometre, rounded to something readable', () => {
    expect(formatRouteDistance(447)).toBe('450 m');
    expect(formatRouteDistance(30)).toBe('30 m');
  });

  it('uses one decimal for a short drive', () => {
    expect(formatRouteDistance(3247)).toBe('3.2 km');
  });

  it('drops the decimal once it stops meaning anything', () => {
    expect(formatRouteDistance(132_400)).toBe('132 km');
  });

  it('says nothing about a nonsense distance', () => {
    expect(formatRouteDistance(NaN)).toBe('');
    expect(formatRouteDistance(-5)).toBe('');
  });
});

describe('formatRouteTime', () => {
  it('rounds to minutes', () => {
    expect(formatRouteTime(725)).toBe('12 min');
  });

  it('never says zero minutes', () => {
    expect(formatRouteTime(4)).toBe('1 min');
  });

  it('breaks an hour out', () => {
    expect(formatRouteTime(4800)).toBe('1 h 20 min');
    expect(formatRouteTime(7200)).toBe('2 h');
  });

  it('says nothing about a nonsense duration', () => {
    expect(formatRouteTime(NaN)).toBe('');
  });
});

describe('describeRoute', () => {
  const route = { points: [], metres: 3247, seconds: 725 };

  it('reads as one line', () => {
    expect(describeRoute(route)).toBe('3.2 km · 12 min by car');
    expect(describeRoute(route, 'walking')).toBe('3.2 km · 12 min on foot');
  });

  it('falls back to the distance when there is no time', () => {
    expect(describeRoute({ ...route, seconds: NaN })).toBe('3.2 km');
  });
});

describe('parseOsrm', () => {
  const good = {
    code: 'Ok',
    routes: [{ geometry: '_p~iF~ps|U_ulLnnqC_mqNvxq`@', distance: 3247.1, duration: 725.4 }],
  };

  it('reads a route', () => {
    const route = parseOsrm(good);
    expect(route).not.toBeNull();
    expect(route!.points).toHaveLength(3);
    expect(route!.metres).toBeCloseTo(3247.1);
  });

  it('refuses anything that is not a successful answer', () => {
    expect(parseOsrm({ code: 'NoRoute', routes: [] })).toBeNull();
    expect(parseOsrm({ code: 'Ok', routes: [] })).toBeNull();
    expect(parseOsrm({})).toBeNull();
  });

  it('refuses an HTML error page or any other non-object', () => {
    expect(parseOsrm('<html>502</html>')).toBeNull();
    expect(parseOsrm(null)).toBeNull();
    expect(parseOsrm(undefined)).toBeNull();
  });

  it('refuses a route with no drawable line', () => {
    expect(parseOsrm({ code: 'Ok', routes: [{ geometry: '', distance: 1, duration: 1 }] })).toBeNull();
    expect(parseOsrm({ code: 'Ok', routes: [{ distance: 1, duration: 1 }] })).toBeNull();
  });

  it('keeps the line when the numbers are missing', () => {
    const route = parseOsrm({ code: 'Ok', routes: [{ geometry: '_p~iF~ps|U_ulLnnqC' }] });
    expect(route).not.toBeNull();
    expect(route!.metres).toBe(0);
  });
});

describe('thin', () => {
  it('leaves a short line alone', () => {
    expect(thin([1, 2, 3], 60)).toEqual([1, 2, 3]);
  });

  it('keeps both ends, which is where the route starts and finishes', () => {
    const many = Array.from({ length: 500 }, (_, i) => i);
    const kept = thin(many, 60);
    expect(kept).toHaveLength(60);
    expect(kept[0]).toBe(0);
    expect(kept[kept.length - 1]).toBe(499);
  });

  it('does not modify what it was given', () => {
    const points = [1, 2, 3, 4, 5];
    thin(points, 3);
    expect(points).toEqual([1, 2, 3, 4, 5]);
  });

  it('survives a nonsense limit', () => {
    expect(thin([1, 2, 3], 0)).toEqual([1, 2, 3]);
  });
});

describe('segmentsOf', () => {
  it('makes one segment fewer than there are points', () => {
    expect(segmentsOf([1, 2, 3])).toEqual([[1, 2], [2, 3]]);
  });

  it('has no segments for a single point or none', () => {
    expect(segmentsOf([1])).toEqual([]);
    expect(segmentsOf([])).toEqual([]);
  });
});
