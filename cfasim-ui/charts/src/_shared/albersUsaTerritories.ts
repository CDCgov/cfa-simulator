import {
  geoConicEqualArea,
  geoEquirectangular,
  geoStream,
  type GeoPermissibleObjects,
  type GeoProjection,
  type GeoStream,
} from "d3-geo";

type Box = [[number, number], [number, number]];

export interface RegionSpec {
  /** Builds the unscaled projection. */
  projection: () => GeoProjection;
  /** Scale relative to the lower 48. */
  scale: number;
  /** Where the projection's own center lands, in lower-48 scale units from
   * the translate. */
  at: [number, number];
  /** The region's frame, in the same units: its clip, and for a territory
   * also the room the fit keeps for a callout label. */
  frame: Box;
  /** `base` is the lower 48, clipped exactly to its frame and the fallback
   * for invert. Every other region clips `EPSILON` inside its frame so
   * neighbors never share an edge (d3's Alaska and Hawaii rule) and inverts
   * through its frame; a `territory` also has the fit cover its frame. */
  kind: "base" | "inset" | "territory";
}

export const EPSILON = 1e-6;

const conic = (
  rotate: number,
  center: [number, number],
  parallels: [number, number],
) =>
  geoConicEqualArea().rotate([rotate, 0]).center(center).parallels(parallels);
const equirectangular = (lon: number, lat: number) =>
  geoEquirectangular().rotate([-lon, -lat]);

// The first three are d3's `geoAlbersUsa` (parallels from USGS, scale ratios
// and boxes from d3). Positions are in units of the lower-48 scale, relative
// to its translate, where the 50 states span about x -0.42..0.36, y
// -0.23..0.23. The Pacific territories stack in the open column west of the
// coast, Puerto Rico and the Virgin Islands sit right of Florida. Islands
// are enlarged to stay legible, so an inset can hold part of a territory:
// the Northern Marianas show only Rota, Tinian and Saipan, and American
// Samoa is two insets (Tutuila, then the Manu'a group) so the gap between
// them doesn't eat the space. Each frame must keep out its neighbors as seen
// through its own projection (Culebra lands just left of the Virgin Islands
// frame), and a territory frame is wider than its islands on the side away
// from the mainland so a callout label has room inside the fitted extent.
export const REGIONS: RegionSpec[] = [
  {
    projection: () => conic(96, [-0.6, 38.7], [29.5, 45.5]),
    scale: 1,
    at: [0, 0],
    frame: [
      [-0.455, -0.238],
      [0.455, 0.238],
    ],
    kind: "base",
  },
  // Alaska (EPSG:3338)
  {
    projection: () => conic(154, [-2, 58.5], [55, 65]),
    scale: 0.35,
    at: [-0.307, 0.201],
    frame: [
      [-0.425, 0.12],
      [-0.214, 0.234],
    ],
    kind: "inset",
  },
  // Hawaii (ESRI:102007)
  {
    projection: () => conic(157, [-3, 19.9], [8, 18]),
    scale: 1,
    at: [-0.205, 0.212],
    frame: [
      [-0.214, 0.166],
      [-0.115, 0.234],
    ],
    kind: "inset",
  },
  // Northern Mariana Islands
  {
    projection: () => equirectangular(145.48, 14.7),
    scale: 5,
    at: [-0.41, -0.14],
    frame: [
      [-0.48, -0.2],
      [-0.37, -0.08],
    ],
    kind: "territory",
  },
  // Guam
  {
    projection: () => equirectangular(144.79, 13.45),
    scale: 8,
    at: [-0.41, -0.035],
    frame: [
      [-0.48, -0.075],
      [-0.37, 0.005],
    ],
    kind: "territory",
  },
  // American Samoa: Tutuila and Aunu'u
  {
    projection: () => equirectangular(-170.7, -14.3),
    scale: 10,
    at: [-0.42, 0.035],
    frame: [
      [-0.48, 0.015],
      [-0.37, 0.058],
    ],
    kind: "territory",
  },
  // American Samoa: the Manu'a group
  {
    projection: () => equirectangular(-169.56, -14.22),
    scale: 10,
    at: [-0.405, 0.075],
    frame: [
      [-0.48, 0.058],
      [-0.37, 0.1],
    ],
    kind: "territory",
  },
  // Puerto Rico
  {
    projection: () => equirectangular(-66.58, 18.2),
    scale: 2,
    at: [0.31, 0.205],
    frame: [
      [0.262, 0.175],
      [0.3575, 0.235],
    ],
    kind: "territory",
  },
  // U.S. Virgin Islands
  {
    projection: () => equirectangular(-64.83, 18.03),
    scale: 4.5,
    at: [0.41, 0.205],
    frame: [
      [0.386, 0.17],
      [0.465, 0.24],
    ],
    kind: "territory",
  },
];

/** A placed region: its projection, clip box and frame in output
 * coordinates. */
interface Region {
  spec: RegionSpec;
  projection: GeoProjection;
  clip: Box;
  frame: Box;
}

/** Scales, translates and clips `p` for the lower-48 scale `k` and
 * translate `[x, y]`, and returns the frame in output coordinates. */
export function placeRegion(
  p: GeoProjection,
  spec: RegionSpec,
  k: number,
  [x, y]: [number, number],
): Box {
  const frame: Box = [
    [x + spec.frame[0][0] * k, y + spec.frame[0][1] * k],
    [x + spec.frame[1][0] * k, y + spec.frame[1][1] * k],
  ];
  const e = spec.kind === "base" ? 0 : EPSILON;
  p.scale(k * spec.scale)
    .translate([x + spec.at[0] * k, y + spec.at[1] * k])
    .clipExtent([
      [frame[0][0] + e, frame[0][1] + e],
      [frame[1][0] - e, frame[1][1] - e],
    ]);
  return frame;
}

const inBox = ([x, y]: [number, number], b: Box) =>
  x >= b[0][0] && x <= b[1][0] && y >= b[0][1] && y <= b[1][1];

// Frames are half-open so a point on the edge two insets share (the two
// American Samoa frames) inverts through one of them.
const inFrame = ([x, y]: [number, number], f: Box) =>
  x >= f[0][0] && x < f[1][0] && y >= f[0][1] && y < f[1][1];

const scratch: [number, number] = [0, 0];

// Whether the region's clip contains the projected point, like d3's clipped
// point streams (inclusive edges). Leaves the projected point in `scratch`.
function owns(r: Region, lon: number, lat: number): boolean {
  scratch[0] = lon;
  scratch[1] = lat;
  const p = r.projection(scratch);
  if (!p) return false;
  scratch[0] = p[0];
  scratch[1] = p[1];
  return inBox(scratch, r.clip);
}

function ownerIndex(regions: Region[], lon: number, lat: number): number {
  for (let i = 0; i < regions.length; i++)
    if (owns(regions[i], lon, lat)) return i;
  return -1;
}

const NO_OWNER = -1;
const UNDECIDED = -2;

/**
 * Sends each polygon or line to the one sub-projection whose clip owns every
 * one of its points, instead of multiplexing all geometry through all of
 * them, which rotated, resampled and clipped every point nine times. The
 * geometry is buffered until its end so the decision covers every vertex;
 * anything whose vertices disagree, or that no region owns (an enclosing
 * ring, a line between regions, a Northern Marianas island past its frame)
 * is replayed through every stream, which is exactly the multiplex. The
 * only remaining difference is a polygon whose rings all sit in one region
 * but whose interior is the rest of the sphere (counter-clockwise winding),
 * which d3 would also fill in the other regions' clip boxes. The sphere
 * still goes to every stream.
 */
function route(regions: Region[], streams: GeoStream[]): GeoStream {
  let inPolygon = false;
  let inLine = false;
  let owner = UNDECIDED;
  // The buffered polygon or line: flat lon/lat pairs and where each ring ends.
  const coords: number[] = [];
  const ringEnds: number[] = [];

  const see = (lon: number, lat: number) => {
    coords.push(lon, lat);
    if (owner === NO_OWNER) return;
    if (owner >= 0 && owns(regions[owner], lon, lat)) return;
    const i = ownerIndex(regions, lon, lat);
    owner = owner === UNDECIDED || i === owner ? i : NO_OWNER;
  };
  const replay = (s: GeoStream, polygon: boolean) => {
    if (polygon) s.polygonStart();
    let j = 0;
    for (const end of ringEnds) {
      s.lineStart();
      for (; j < end; j += 2) s.point(coords[j], coords[j + 1]);
      s.lineEnd();
    }
    if (polygon) s.polygonEnd();
  };
  const flush = (polygon: boolean) => {
    if (owner >= 0) replay(streams[owner], polygon);
    else for (const s of streams) replay(s, polygon);
    coords.length = 0;
    ringEnds.length = 0;
    owner = UNDECIDED;
  };

  return {
    point(lon, lat, z) {
      if (inLine) see(lon, lat);
      else {
        const i = ownerIndex(regions, lon, lat);
        if (i >= 0) streams[i].point(lon, lat, z);
      }
    },
    sphere() {
      for (const s of streams) s.sphere?.();
    },
    lineStart() {
      inLine = true;
    },
    lineEnd() {
      inLine = false;
      ringEnds.push(coords.length);
      if (!inPolygon) flush(false);
    },
    polygonStart() {
      inPolygon = true;
    },
    polygonEnd() {
      inPolygon = false;
      flush(true);
    },
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
 * The lower 48, Alaska and Hawaii are d3's own sub-projections, built here
 * so the routed stream can address them directly.
 */
export const geoAlbersUsaTerritories = (): GeoProjection => composite(REGIONS);

/**
 * d3's `geoAlbersUsa` (the 50 states and DC) with the routed stream: the
 * same projection, fit and invert, drawing the same paths, at about a third
 * of the cost, since d3's own composite streams every geometry through all
 * three clipped sub-projections.
 */
export const geoAlbersUsa = (): GeoProjection =>
  composite(REGIONS.filter((r) => r.kind !== "territory"));

function composite(specs: RegionSpec[]): GeoProjection {
  const regions: Region[] = specs.map((spec) => ({
    spec,
    projection: spec.projection(),
    clip: emptyBox(),
    frame: emptyBox(),
  }));
  const base = regions[0];
  let k = 1070;
  let t: [number, number] = [480, 250];
  let cache: GeoStream | null = null;
  let cacheStream: GeoStream | null = null;

  const projection = ((coordinates: [number, number]) => {
    const i = ownerIndex(regions, coordinates[0], coordinates[1]);
    return i >= 0 ? ([scratch[0], scratch[1]] as [number, number]) : null;
  }) as unknown as GeoProjection;

  const reset = () => {
    cache = cacheStream = null;
    return projection;
  };

  const place = () => {
    for (const r of regions) {
      r.frame = placeRegion(r.projection, r.spec, k, t);
      r.clip = r.projection.clipExtent() as Box;
    }
    return reset();
  };

  projection.invert = (coordinates: [number, number]) => {
    for (const r of regions) {
      if (r !== base && inFrame(coordinates, r.frame))
        return r.projection.invert!(coordinates);
    }
    return base.projection.invert!(coordinates);
  };

  projection.stream = (stream: GeoStream) => {
    if (cache && cacheStream === stream) return cache;
    cacheStream = stream;
    cache = route(
      regions,
      regions.map((r) => r.projection.stream(stream)),
    );
    return cache;
  };

  projection.precision = ((p?: number) => {
    if (p === undefined) return base.projection.precision();
    for (const r of regions) r.projection.precision(p);
    return reset();
  }) as GeoProjection["precision"];

  projection.scale = ((s?: number) => {
    if (s === undefined) return k;
    k = s;
    return place();
  }) as GeoProjection["scale"];

  projection.translate = ((p?: [number, number]) => {
    if (p === undefined) return t;
    t = [+p[0], +p[1]];
    return place();
  }) as GeoProjection["translate"];

  // d3's fit bounds, plus the frame of every territory that drew something
  // when the mainland drew too (a lone territory fits to its islands).
  const fitBounds = (object: GeoPermissibleObjects): Box => {
    projection.scale(150).translate([0, 0]);
    const b = emptyBox();
    const sink = boundsSink(b);
    const hits = regions.map(() => false);
    const flagged = (i: number): GeoStream => ({
      ...sink,
      point(x, y) {
        hits[i] = true;
        sink.point(x, y);
      },
    });
    geoStream(
      object,
      route(
        regions,
        regions.map((r, i) => r.projection.stream(flagged(i))),
      ),
    );
    const mainland = regions.some(
      (r, i) => hits[i] && r.spec.kind !== "territory",
    );
    if (mainland) {
      regions.forEach(({ spec, frame }, i) => {
        if (spec.kind !== "territory" || !hits[i]) return;
        sink.point(frame[0][0], frame[0][1]);
        sink.point(frame[1][0], frame[1][1]);
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

  return place();
}
