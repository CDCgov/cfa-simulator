import {
  geoAlbersUsa,
  geoEquirectangular,
  geoStream,
  type GeoPermissibleObjects,
  type GeoProjection,
  type GeoStream,
} from "d3-geo";

type Box = [[number, number], [number, number]];

interface InsetSpec {
  /** [lon, lat] the inset is centered on. */
  center: [number, number];
  /** Scale relative to the lower 48. */
  scale: number;
  /** Where `center` lands, in lower-48 scale units from the translate. */
  at: [number, number];
  /** The inset's frame (also its clip), in the same units. It is wider than
   * the islands on the side away from the mainland, so a callout label has
   * room inside the fitted extent. */
  frame: Box;
}

// Positions are in units of the lower-48 scale, relative to its translate,
// where the 50 states span about x -0.42..0.36, y -0.23..0.23. The Pacific
// territories stack in the open column west of the coast, Puerto Rico and
// the Virgin Islands sit right of Florida. Islands are enlarged to stay
// legible, so an inset can hold part of a territory: the Northern Marianas
// show only Rota, Tinian and Saipan, and American Samoa is two insets
// (Tutuila, then the Manu'a group) so the gap between them doesn't eat the
// space. Each frame must keep out its neighbors as seen through its own
// projection (Culebra lands just left of the Virgin Islands frame).
const INSETS: InsetSpec[] = [
  // Northern Mariana Islands
  {
    center: [145.48, 14.7],
    scale: 5,
    at: [-0.41, -0.14],
    frame: [
      [-0.48, -0.2],
      [-0.37, -0.08],
    ],
  },
  // Guam
  {
    center: [144.79, 13.45],
    scale: 8,
    at: [-0.41, -0.035],
    frame: [
      [-0.48, -0.075],
      [-0.37, 0.005],
    ],
  },
  // American Samoa: Tutuila and Aunu'u
  {
    center: [-170.7, -14.3],
    scale: 10,
    at: [-0.42, 0.035],
    frame: [
      [-0.48, 0.015],
      [-0.37, 0.058],
    ],
  },
  // American Samoa: the Manu'a group
  {
    center: [-169.56, -14.22],
    scale: 10,
    at: [-0.405, 0.075],
    frame: [
      [-0.48, 0.058],
      [-0.37, 0.1],
    ],
  },
  // Puerto Rico
  {
    center: [-66.58, 18.2],
    scale: 2,
    at: [0.31, 0.205],
    frame: [
      [0.262, 0.175],
      [0.3575, 0.235],
    ],
  },
  // U.S. Virgin Islands
  {
    center: [-64.83, 18.03],
    scale: 4.5,
    at: [0.41, 0.205],
    frame: [
      [0.386, 0.17],
      [0.465, 0.24],
    ],
  },
];

const EPSILON = 1e-6;

function multiplex(streams: GeoStream[]): GeoStream {
  return {
    point: (x, y, z) => streams.forEach((s) => s.point(x, y, z)),
    sphere: () => streams.forEach((s) => s.sphere?.()),
    lineStart: () => streams.forEach((s) => s.lineStart()),
    lineEnd: () => streams.forEach((s) => s.lineEnd()),
    polygonStart: () => streams.forEach((s) => s.polygonStart()),
    polygonEnd: () => streams.forEach((s) => s.polygonEnd()),
  };
}

function boundsSink(box: Box): GeoStream {
  return {
    point(x, y) {
      if (x < box[0][0]) box[0][0] = x;
      if (x > box[1][0]) box[1][0] = x;
      if (y < box[0][1]) box[0][1] = y;
      if (y > box[1][1]) box[1][1] = y;
    },
    lineStart() {},
    lineEnd() {},
    polygonStart() {},
    polygonEnd() {},
  };
}

const emptyBox = (): Box => [
  [Infinity, Infinity],
  [-Infinity, -Infinity],
];

/**
 * Albers USA plus enlarged insets for the island territories: Puerto Rico,
 * the U.S. Virgin Islands, Guam, the Northern Mariana Islands and American
 * Samoa. On a national map the fit also covers the frame of every inset that
 * has geometry, so labels beside the islands stay inside the extent. Like
 * d3's `geoAlbersUsa` it is a fixed composite: it supports scale, translate,
 * precision, invert and the fit methods, not center, rotate or clipping.
 */
export function geoAlbersUsaTerritories(): GeoProjection {
  const base = geoAlbersUsa();
  const insets = INSETS.map((spec) => ({
    spec,
    projection: geoEquirectangular().rotate([-spec.center[0], -spec.center[1]]),
  }));
  // Frames in output coordinates for the current scale + translate.
  let frames: Box[] = [];
  let cache: GeoStream | null = null;
  let cacheStream: GeoStream | null = null;

  const inFrame = ([x, y]: [number, number], f: Box) =>
    x >= f[0][0] && x < f[1][0] && y >= f[0][1] && y < f[1][1];

  const projection = ((coordinates: [number, number]) => {
    const p = base(coordinates);
    if (p) return p;
    for (let i = 0; i < insets.length; i++) {
      const q = insets[i].projection(coordinates);
      if (q && inFrame(q, frames[i])) return q;
    }
    return null;
  }) as unknown as GeoProjection;

  const reset = () => {
    cache = cacheStream = null;
    return projection;
  };

  const place = () => {
    const k = base.scale();
    const [x, y] = base.translate();
    frames = insets.map(({ spec, projection: p }) => {
      const frame: Box = [
        [x + spec.frame[0][0] * k, y + spec.frame[0][1] * k],
        [x + spec.frame[1][0] * k, y + spec.frame[1][1] * k],
      ];
      p.scale(k * spec.scale)
        .translate([x + spec.at[0] * k, y + spec.at[1] * k])
        .clipExtent([
          [frame[0][0] + EPSILON, frame[0][1] + EPSILON],
          [frame[1][0] - EPSILON, frame[1][1] - EPSILON],
        ]);
      return frame;
    });
    return reset();
  };

  projection.invert = (coordinates: [number, number]) => {
    for (let i = 0; i < insets.length; i++) {
      if (inFrame(coordinates, frames[i]))
        return insets[i].projection.invert!(coordinates);
    }
    return base.invert!(coordinates);
  };

  projection.stream = (stream: GeoStream) => {
    if (cache && cacheStream === stream) return cache;
    cacheStream = stream;
    cache = multiplex([
      base.stream(stream),
      ...insets.map(({ projection: p }) => p.stream(stream)),
    ]);
    return cache;
  };

  projection.precision = ((p?: number) => {
    if (p === undefined) return base.precision();
    base.precision(p);
    for (const { projection: q } of insets) q.precision(p);
    return reset();
  }) as GeoProjection["precision"];

  projection.scale = ((k?: number) => {
    if (k === undefined) return base.scale();
    base.scale(k);
    return place();
  }) as GeoProjection["scale"];

  projection.translate = ((t?: [number, number]) => {
    if (t === undefined) return base.translate();
    base.translate(t);
    return place();
  }) as GeoProjection["translate"];

  // d3's fit bounds, plus the frame of every inset that drew something
  // when the mainland drew too (a lone territory fits to its islands).
  const fitBounds = (object: GeoPermissibleObjects): Box => {
    projection.scale(150).translate([0, 0]);
    const b = emptyBox();
    const sink = boundsSink(b);
    const hits = insets.map(() => false);
    let mainland = false;
    const flagged = (mark: () => void): GeoStream => ({
      ...sink,
      point(x, y) {
        mark();
        sink.point(x, y);
      },
    });
    geoStream(
      object,
      multiplex([
        base.stream(flagged(() => (mainland = true))),
        ...insets.map(({ projection: p }, i) =>
          p.stream(flagged(() => (hits[i] = true))),
        ),
      ]),
    );
    if (mainland) {
      hits.forEach((hit, i) => {
        if (!hit) return;
        sink.point(frames[i][0][0], frames[i][0][1]);
        sink.point(frames[i][1][0], frames[i][1][1]);
      });
    }
    return b;
  };
  const fit = (
    object: GeoPermissibleObjects,
    place: (b: Box) => [number, number, number],
  ) => {
    const b = fitBounds(object);
    if (!Number.isFinite(b[0][0])) return projection;
    const [k, x, y] = place(b);
    return projection.scale(150 * k).translate([x, y]);
  };
  const fitExtent = (extent: Box, object: GeoPermissibleObjects) =>
    fit(object, (b) => {
      const w = extent[1][0] - extent[0][0];
      const h = extent[1][1] - extent[0][1];
      const k = Math.min(w / (b[1][0] - b[0][0]), h / (b[1][1] - b[0][1]));
      return [
        k,
        extent[0][0] + (w - k * (b[1][0] + b[0][0])) / 2,
        extent[0][1] + (h - k * (b[1][1] + b[0][1])) / 2,
      ];
    });
  projection.fitExtent = fitExtent as GeoProjection["fitExtent"];
  projection.fitSize = ((size: [number, number], object) =>
    fitExtent([[0, 0], size], object)) as GeoProjection["fitSize"];
  projection.fitWidth = ((width: number, object) =>
    fit(object, (b) => {
      const k = width / (b[1][0] - b[0][0]);
      return [k, (width - k * (b[1][0] + b[0][0])) / 2, -k * b[0][1]];
    })) as GeoProjection["fitWidth"];
  projection.fitHeight = ((height: number, object) =>
    fit(object, (b) => {
      const k = height / (b[1][1] - b[0][1]);
      return [k, -k * b[0][0], (height - k * (b[1][1] + b[0][1])) / 2];
    })) as GeoProjection["fitHeight"];

  return projection.scale(1070).translate([480, 250]);
}
