// Pure layout for the ChoroplethMap city overlay: project each city, apply the
// current zoom transform, and greedily place its name label so labels never
// overlap. Kept free of Vue/DOM so it can be unit tested in isolation.
//
// All output coordinates are in the map's canonical space (0..width, 0..height)
// — the same space the projection emits — so both render backends can consume
// them. Pixel-denominated sizes (font, dot radius) are divided by `viewScale`
// (rendered-px / canonical-width) to convert into canonical units, which keeps
// markers and labels a constant on-screen size regardless of zoom.

/** A city to render. `coordinates` is `[longitude, latitude]`. */
export interface CityMarker {
  name: string;
  coordinates: [number, number];
  /**
   * Mark as a capital: the label gets first pick during placement and is never
   * dropped for collisions (rendered slightly emphasized). The marker itself is
   * a plain dot, same as any other city.
   */
  capital?: boolean;
  /**
   * Minimum zoom scale at which this city appears (level-of-detail): it shows
   * only once the map is zoomed to `scaleK >= minZoom`. Lets you reveal the
   * biggest cities first and progressively add more as the user zooms in.
   * Falls back to the map's `citiesMinZoom` prop when unset. Only applies on a
   * zoomable map. See `nationalCityMarkers` / `stateCityMarkers`, which assign
   * tiers by population.
   */
  minZoom?: number;
}

/** A resolved label anchor in canonical coordinates. */
export interface PlacedLabel {
  /** Anchor x (interpretation depends on `anchor`). */
  x: number;
  /** Vertical center of the text (render with `dominant-baseline: central`). */
  y: number;
  anchor: "start" | "middle" | "end";
}

/** A city resolved to canonical coordinates, with an optional placed label. */
export interface PlacedCity {
  name: string;
  capital: boolean;
  /** Dot/star center. */
  x: number;
  y: number;
  /** Marker radius in canonical units. */
  radius: number;
  /** Null when no non-overlapping label position was found. */
  label: PlacedLabel | null;
}

/** d3-zoom-style transform: `screen = k * point + [x, y]`. */
export interface ZoomTransformLike {
  k: number;
  x: number;
  y: number;
}

export interface LayoutOptions {
  /** Canonical viewport width (e.g. 1000). */
  width: number;
  /** Canonical viewport height. */
  height: number;
  /** Rendered px per canonical unit; converts px sizes into canonical units. */
  viewScale: number;
  /** Label font size in px. */
  labelPx?: number;
  /** Dot radius in px (capitals render larger, see CAPITAL_SCALE). */
  dotPx?: number;
  /** Gap between marker edge and label in px. */
  gapPx?: number;
  /** How far outside the viewport (canonical units) a dot may sit and still
   *  render. Cities beyond this are culled. */
  margin?: number;
}

/** An axis-aligned bounding box in canonical coordinates. */
export interface LabelRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

type Box = LabelRect;

const IDENTITY: ZoomTransformLike = { k: 1, x: 0, y: 0 };

// Average glyph advance as a fraction of font size for a typical sans font.
// Only used to estimate label width for collision — exactness isn't required.
const AVG_ADVANCE = 0.56;
// Text box height as a multiple of font size (a little vertical padding).
const LINE_HEIGHT = 1.15;

/** Rough label width in px (no DOM measurement). */
export function estimateTextWidth(text: string, fontPx: number): number {
  return text.length * AVG_ADVANCE * fontPx;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** True when two axis-aligned boxes overlap (shared edges don't count). */
export function rectsOverlap(a: LabelRect, b: LabelRect): boolean {
  return !(a.x1 <= b.x0 || a.x0 >= b.x1 || a.y1 <= b.y0 || a.y0 >= b.y1);
}

/**
 * The canonical bounding box of a placed label, or null if it has none. Uses
 * the same width/height model as the layout, so callers can reason about label
 * extents (e.g. tests asserting non-overlap).
 */
export function placedLabelBox(
  placed: PlacedCity,
  opts: { labelPx?: number; viewScale: number },
): LabelRect | null {
  if (!placed.label) return null;
  const { labelPx = 11, viewScale } = opts;
  const vs = viewScale || 1;
  const w = estimateTextWidth(placed.name, labelPx) / vs;
  const h = (labelPx * LINE_HEIGHT) / vs;
  return boxFor(placed.label.x, placed.label.y, w, h, placed.label.anchor);
}

function within(box: Box, width: number, height: number): boolean {
  return box.x0 >= 0 && box.y0 >= 0 && box.x1 <= width && box.y1 <= height;
}

function boxFor(
  anchorX: number,
  centerY: number,
  w: number,
  h: number,
  anchor: PlacedLabel["anchor"],
): Box {
  const y0 = centerY - h / 2;
  const y1 = centerY + h / 2;
  if (anchor === "start") return { x0: anchorX, y0, x1: anchorX + w, y1 };
  if (anchor === "end") return { x0: anchorX - w, y0, x1: anchorX, y1 };
  return { x0: anchorX - w / 2, y0, x1: anchorX + w / 2, y1 };
}

/**
 * Project + place cities. Returns one `PlacedCity` per city that projects
 * inside the (margin-expanded) viewport, in draw order. `label` is null when no
 * candidate anchor avoided every already-placed label and every dot.
 */
export function layoutCities(
  cities: readonly CityMarker[],
  project: (lngLat: [number, number]) => [number, number] | null,
  transform: ZoomTransformLike = IDENTITY,
  options: LayoutOptions,
): PlacedCity[] {
  const {
    width,
    height,
    viewScale,
    labelPx = 11,
    dotPx = 2.4,
    gapPx = 4,
    margin = 0,
  } = options;
  const vs = viewScale || 1;
  const font = labelPx / vs;
  const dotR = dotPx / vs;
  const gap = gapPx / vs;
  const labelH = font * LINE_HEIGHT;

  // Project + cull, preserving input order and capital priority.
  type Kept = {
    marker: CityMarker;
    x: number;
    y: number;
    radius: number;
    order: number;
  };
  const kept: Kept[] = [];
  cities.forEach((marker, i) => {
    const p = project(marker.coordinates);
    if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return;
    const x = transform.k * p[0] + transform.x;
    const y = transform.k * p[1] + transform.y;
    if (x < -margin || x > width + margin || y < -margin || y > height + margin)
      return;
    kept.push({
      marker,
      x,
      y,
      radius: dotR,
      order: i,
    });
  });

  // Capitals first (stable), then input order.
  kept.sort(
    (a, b) =>
      (b.marker.capital ? 1 : 0) - (a.marker.capital ? 1 : 0) ||
      a.order - b.order,
  );

  // Every dot is an obstacle for every label, so precompute all dot boxes.
  const dotBoxes: Box[] = kept.map((k) => ({
    x0: k.x - k.radius,
    y0: k.y - k.radius,
    x1: k.x + k.radius,
    y1: k.y + k.radius,
  }));

  const placedLabels: Box[] = [];
  const result: PlacedCity[] = [];

  for (const k of kept) {
    const w = estimateTextWidth(k.marker.name, labelPx) / vs;
    const mR = k.radius;
    const candidates: {
      anchorX: number;
      cy: number;
      anchor: PlacedLabel["anchor"];
    }[] = [
      { anchorX: k.x + mR + gap, cy: k.y, anchor: "start" },
      { anchorX: k.x - mR - gap, cy: k.y, anchor: "end" },
      { anchorX: k.x, cy: k.y - mR - gap - labelH / 2, anchor: "middle" },
      { anchorX: k.x, cy: k.y + mR + gap + labelH / 2, anchor: "middle" },
      { anchorX: k.x + mR * 0.7 + gap, cy: k.y - mR - gap, anchor: "start" },
      { anchorX: k.x + mR * 0.7 + gap, cy: k.y + mR + gap, anchor: "start" },
      { anchorX: k.x - mR * 0.7 - gap, cy: k.y - mR - gap, anchor: "end" },
      { anchorX: k.x - mR * 0.7 - gap, cy: k.y + mR + gap, anchor: "end" },
    ];

    // Capitals are placed first (so no labels exist yet to collide with) and
    // are exempt from dot-avoidance: the capital is the most important label
    // and must not be dropped just because it sits amid dense neighboring
    // dots (e.g. DC in the mid-Atlantic). It still stays label-to-label
    // disjoint and in-bounds, and other labels then avoid its box.
    const avoidDots = !k.marker.capital;
    let label: PlacedLabel | null = null;
    for (const c of candidates) {
      const box = boxFor(c.anchorX, c.cy, w, labelH, c.anchor);
      if (!within(box, width, height)) continue;
      if (placedLabels.some((b) => rectsOverlap(box, b))) continue;
      if (avoidDots && dotBoxes.some((b) => rectsOverlap(box, b))) continue;
      label = { x: round(c.anchorX), y: round(c.cy), anchor: c.anchor };
      placedLabels.push(box);
      break;
    }

    result.push({
      name: k.marker.name,
      capital: !!k.marker.capital,
      x: round(k.x),
      y: round(k.y),
      radius: round(mR),
      label,
    });
  }

  return result;
}
