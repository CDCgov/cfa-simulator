// Pure layout for the ChoroplethMap state-abbreviation labels: each state gets
// its label centered inside it when the label fits within the state's shape,
// and otherwise becomes a callout — the label is pushed sideways past any
// intervening land to open water/background, with a leader line pointing back
// at the state (the classic "VT / NH / MA / RI / CT" stack off the US east
// coast). Kept free of Vue/DOM so it can be unit tested in isolation.
//
// Coordinate model matches cityLayout.ts: all output is in the map's canonical
// viewport space AFTER the zoom transform is applied, so labels keep a
// constant on-screen size (px sizes are divided by `viewScale`). Geometry
// (rings, bounds, centroids) comes in PRE-transform canonical space — the
// projection's output — and sample points are inverse-transformed for the
// point-in-polygon tests, so a zoomed-in map re-fits labels against the
// enlarged shapes (a state too small for an inside label at the overview
// gains one once you zoom in).

import {
  estimateTextWidth,
  rectsOverlap,
  type LabelRect,
  type ZoomTransformLike,
} from "./cityLayout.js";

/** 2-digit state FIPS → USPS abbreviation, incl. DC and the territories. */
export const fipsToStateAbbr: Record<string, string> = {
  "01": "AL",
  "02": "AK",
  "04": "AZ",
  "05": "AR",
  "06": "CA",
  "08": "CO",
  "09": "CT",
  "10": "DE",
  "11": "DC",
  "12": "FL",
  "13": "GA",
  "15": "HI",
  "16": "ID",
  "17": "IL",
  "18": "IN",
  "19": "IA",
  "20": "KS",
  "21": "KY",
  "22": "LA",
  "23": "ME",
  "24": "MD",
  "25": "MA",
  "26": "MI",
  "27": "MN",
  "28": "MS",
  "29": "MO",
  "30": "MT",
  "31": "NE",
  "32": "NV",
  "33": "NH",
  "34": "NJ",
  "35": "NM",
  "36": "NY",
  "37": "NC",
  "38": "ND",
  "39": "OH",
  "40": "OK",
  "41": "OR",
  "42": "PA",
  "44": "RI",
  "45": "SC",
  "46": "SD",
  "47": "TN",
  "48": "TX",
  "49": "UT",
  "50": "VT",
  "51": "VA",
  "53": "WA",
  "54": "WV",
  "55": "WI",
  "56": "WY",
  "60": "AS",
  "66": "GU",
  "69": "MP",
  "72": "PR",
  "78": "VI",
};

/** One state's label input: projected geometry in pre-transform canonical space. */
export interface StateLabelFeature {
  id: string;
  /** Label text (normally the USPS abbreviation). */
  abbr: string;
  /** Preferred in-place anchor — d3 `path.centroid` of the whole feature. */
  centroid: [number, number];
  /** Fallback anchor and leader-line target: the largest ring's own centroid
   *  (better than `centroid` for multipolygon states whose combined centroid
   *  can fall between land masses, e.g. Michigan or Hawaii). */
  anchor: [number, number];
  /** Projected bounding box of the feature. */
  bounds: LabelRect;
  /** Projected outer rings (holes dropped), decimated for cheap hit tests. */
  rings: [number, number][][];
}

export interface StateLabelLeader {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PlacedStateLabel {
  id: string;
  abbr: string;
  /** Text anchor position (post-transform canonical space). */
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  placement: "inside" | "callout";
  /** Leader line from the label edge to the state, callouts only. */
  leader: StateLabelLeader | null;
}

export interface StateLabelLayoutOptions {
  /** Canonical viewport width (e.g. 1000). */
  width: number;
  /** Canonical viewport height. */
  height: number;
  /** Rendered px per canonical unit; converts px sizes into canonical units. */
  viewScale: number;
  /** Label font size in px. */
  labelPx?: number;
  /** Padding (px) the label box must clear inside the state's shape to count
   *  as fitting. */
  fitPadPx?: number;
  /** Gap (px) between a callout label and the geometry it clears. */
  gapPx?: number;
  /** How far outside the viewport (canonical units) a state's box may sit and
   *  still be considered. States beyond this are culled. */
  margin?: number;
}

const IDENTITY: ZoomTransformLike = { k: 1, x: 0, y: 0 };
// Text box height as a multiple of font size (matches cityLayout). Used for
// label-label collision boxes and callout stacking.
const LINE_HEIGHT = 1.15;
// The inside FIT test uses the text's visual (cap) height instead — an
// abbreviation has no descenders, and testing the full line box made states
// that visually hold their label with room to spare (KY, FL, MN) fail on a
// corner poking just past a border.
const FIT_TEXT_HEIGHT = 0.75;
// How far (px) a callout label may sit from its state's anchor before the
// label is dropped instead — a longer leader reads as noise.
const MAX_CALLOUT_DIST_PX = 120;
// How many rows a chained callout label may sink below its anchor's row
// while hunting for open background before it is dropped.
const MAX_CALLOUT_DROP_SLOTS = 6;
// A callout label whose near edge sits within this distance (px) of its own
// state's geometry — and wasn't displaced vertically — reads as adjacent and
// needs no leader line ("HI" right beside the Big Island).
const ADJACENT_LEADER_PX = 14;

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Uniform-stride decimation, preserving first point; enough fidelity for
 *  label hit tests where a few canonical units of coastline slop is fine. */
export function decimateRing(
  ring: [number, number][],
  maxPoints = 150,
): [number, number][] {
  if (ring.length <= maxPoints) return ring;
  const stride = Math.ceil(ring.length / maxPoints);
  const out: [number, number][] = [];
  for (let i = 0; i < ring.length; i += stride) out.push(ring[i]);
  return out;
}

/** Planar shoelace area + centroid of one ring. */
export function ringAreaCentroid(ring: [number, number][]): {
  area: number;
  cx: number;
  cy: number;
} {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j];
    const [x1, y1] = ring[i];
    const cross = x0 * y1 - x1 * y0;
    a += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  a /= 2;
  if (a === 0) {
    return { area: 0, cx: ring[0]?.[0] ?? 0, cy: ring[0]?.[1] ?? 0 };
  }
  return { area: Math.abs(a), cx: cx / (6 * a), cy: cy / (6 * a) };
}

/** Even-odd test per ring; rings are disjoint outer rings, so any hit wins. */
export function pointInRings(
  x: number,
  y: number,
  rings: [number, number][][],
): boolean {
  for (const ring of rings) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    if (inside) return true;
  }
  return false;
}

function within(box: LabelRect, width: number, height: number): boolean {
  return box.x0 >= 0 && box.y0 >= 0 && box.x1 <= width && box.y1 <= height;
}

/** Center + corners + edge midpoints, in post-transform space. */
function rectSamples(rect: LabelRect): [number, number][] {
  const cx = (rect.x0 + rect.x1) / 2;
  const cy = (rect.y0 + rect.y1) / 2;
  return [
    [cx, cy],
    [rect.x0, rect.y0],
    [rect.x1, rect.y0],
    [rect.x0, rect.y1],
    [rect.x1, rect.y1],
    [cx, rect.y0],
    [cx, rect.y1],
    [rect.x0, cy],
    [rect.x1, cy],
  ];
}

interface Kept {
  s: StateLabelFeature;
  boundsT: LabelRect;
  centroidT: [number, number];
  anchorT: [number, number];
  /** Label text width in post-transform canonical units. */
  w: number;
}

/**
 * Project + place state labels. Inside labels are placed first (each fully
 * inside its own shape, padded); everything else becomes a callout, processed
 * top-to-bottom: the label scans outward (toward the nearer horizontal viewport
 * edge) past any land until it sits over background, shifting vertically when
 * it would collide with an already-placed label, with a leader line back to
 * the state. A callout is dropped — not pinned — when its state's anchor is
 * off screen, or when no open background exists within leader range; a
 * zoomed/panned view leaves clipped states unlabeled instead of dragging
 * leaders across the map.
 */
export function layoutStateLabels(
  states: readonly StateLabelFeature[],
  transform: ZoomTransformLike = IDENTITY,
  options: StateLabelLayoutOptions,
): PlacedStateLabel[] {
  const {
    width,
    height,
    viewScale,
    labelPx = 11,
    fitPadPx = 2,
    gapPx = 5,
    margin = 8,
  } = options;
  const vs = viewScale || 1;
  const t = transform;
  const font = labelPx / vs;
  const labelH = font * LINE_HEIGHT;
  const fitPad = fitPadPx / vs;
  const gap = gapPx / vs;

  const toT = (p: [number, number]): [number, number] => [
    t.k * p[0] + t.x,
    t.k * p[1] + t.y,
  ];
  const invX = (x: number) => (x - t.x) / t.k;
  const invY = (y: number) => (y - t.y) / t.k;

  // Transform bounds + anchors, cull states fully outside the viewport.
  const kept: Kept[] = [];
  for (const s of states) {
    if (!s.abbr || s.rings.length === 0) continue;
    const b = s.bounds;
    if (![b.x0, b.y0, b.x1, b.y1].every(Number.isFinite)) continue;
    const boundsT: LabelRect = {
      x0: t.k * b.x0 + t.x,
      y0: t.k * b.y0 + t.y,
      x1: t.k * b.x1 + t.x,
      y1: t.k * b.y1 + t.y,
    };
    if (
      boundsT.x1 < -margin ||
      boundsT.x0 > width + margin ||
      boundsT.y1 < -margin ||
      boundsT.y0 > height + margin
    ) {
      continue;
    }
    kept.push({
      s,
      boundsT,
      centroidT: toT(s.centroid),
      anchorT: toT(s.anchor),
      w: estimateTextWidth(s.abbr, labelPx) / vs,
    });
  }

  /** All sample points of `rect` fall inside `rings` (pre-transform). */
  const rectInsideRings = (
    rect: LabelRect,
    rings: [number, number][][],
  ): boolean =>
    rectSamples(rect).every(([x, y]) => pointInRings(invX(x), invY(y), rings));

  /** `rect` touches any kept state's shape: a sample point lands inside it,
   *  or one of its ring vertices lands inside the rect. */
  const rectOverLand = (rect: LabelRect): boolean => {
    for (const k of kept) {
      if (!rectsOverlap(rect, k.boundsT)) continue;
      if (
        rectSamples(rect).some(([x, y]) =>
          pointInRings(invX(x), invY(y), k.s.rings),
        )
      ) {
        return true;
      }
      const rx0 = invX(rect.x0);
      const rx1 = invX(rect.x1);
      const ry0 = invY(rect.y0);
      const ry1 = invY(rect.y1);
      for (const ring of k.s.rings) {
        for (const [x, y] of ring) {
          if (x >= rx0 && x <= rx1 && y >= ry0 && y <= ry1) return true;
        }
      }
    }
    return false;
  };

  const placedBoxes: LabelRect[] = [];
  const result: PlacedStateLabel[] = [];
  const callouts: Kept[] = [];

  // Inside pass: centroid first, then the largest ring's centroid (rescues
  // multipolygon states whose combined centroid falls between land masses),
  // then small nudges of each — a nudge of half a label height is visually
  // still "centered" but rescues shapes whose centroid hugs a border or
  // coast (FL, MI).
  const fitH = font * FIT_TEXT_HEIGHT;
  for (const k of kept) {
    // Nudge distances scale with the label first (imperceptible shifts),
    // then with the state's box — an L-shaped state (FL, LA) can have its
    // centroid right on a coast, and a bbox-proportional shift walks the
    // label back into the shape's meat.
    const bw = (k.boundsT.x1 - k.boundsT.x0) / 8;
    const bh = (k.boundsT.y1 - k.boundsT.y0) / 8;
    const nudges: [number, number][] = [
      [0, 0],
      [0, -labelH / 2],
      [0, labelH / 2],
      [-k.w / 4, 0],
      [k.w / 4, 0],
      [bw, 0],
      [-bw, 0],
      [0, bh],
      [0, -bh],
      [bw, bh],
      [bw, -bh],
      [-bw, bh],
      [-bw, -bh],
    ];
    const candidates: [number, number][] = [];
    for (const [dx, dy] of nudges) {
      candidates.push([k.centroidT[0] + dx, k.centroidT[1] + dy]);
      candidates.push([k.anchorT[0] + dx, k.anchorT[1] + dy]);
    }
    let placed = false;
    for (const c of candidates) {
      const rect: LabelRect = {
        x0: c[0] - k.w / 2 - fitPad,
        x1: c[0] + k.w / 2 + fitPad,
        y0: c[1] - fitH / 2 - fitPad,
        y1: c[1] + fitH / 2 + fitPad,
      };
      if (!within(rect, width, height)) continue;
      if (!rectInsideRings(rect, k.s.rings)) continue;
      result.push({
        id: k.s.id,
        abbr: k.s.abbr,
        x: round(c[0]),
        y: round(c[1]),
        anchor: "middle",
        placement: "inside",
        leader: null,
      });
      placedBoxes.push(rect);
      placed = true;
      break;
    }
    if (!placed) callouts.push(k);
  }

  // ── Callout pass: one label CHAIN per side ───────────────────────────────
  // Callouts are sorted by anchor latitude and each label is placed at or
  // BELOW the previous one on its side, so a column always reads in
  // geographic order — VT, NH, MA, RI, CT down the coast, then NJ, DE, MD,
  // DC — like a hand-made reference map. Per label, only the x is searched
  // (outward from the anchor to the first open-background spot); if a row
  // is fully blocked the label sinks one slot and retries, which is what
  // walks VT/NH below Maine (whose land runs flush to the viewport edge at
  // their own latitude).
  callouts.sort((a, b) => a.anchorT[1] - b.anchorT[1]);
  const step = labelH * 0.9;
  const slotH = labelH * LINE_HEIGHT;
  const adjacentDist = ADJACENT_LEADER_PX / vs;
  const maxDist = MAX_CALLOUT_DIST_PX / vs;
  // Horizontal center of the whole landmass (pre-transform), the anchor for
  // each state's stable callout side: east-coast states always label on the
  // ocean side (right), and pan/zoom never flips it. There is deliberately
  // NO cross-side fallback — anything view-dependent sent zoomed labels
  // hunting across New York into blank background. Own side or nothing.
  let landX0 = Infinity;
  let landX1 = -Infinity;
  for (const s of states) {
    if (s.rings.length === 0) continue;
    if (s.bounds.x0 < landX0) landX0 = s.bounds.x0;
    if (s.bounds.x1 > landX1) landX1 = s.bounds.x1;
  }
  const landCenterX = (landX0 + landX1) / 2;
  // Bottom of the last label placed on each side (the chain state).
  const chainY: Record<"1" | "-1", number> = {
    "1": -Infinity,
    "-1": -Infinity,
  };

  for (const k of callouts) {
    // A callout only makes sense for a state whose anchor is on screen: a
    // state clipped by the viewport edge (common when zoomed in) would need
    // a leader dragged across the view to some pinned label — dropping the
    // label entirely is what a hand-drawn zoomed map does, and it stops
    // labels teleporting to the viewport edges as the transform animates.
    const [ax, ay] = k.anchorT;
    if (ax < 0 || ax > width || ay < 0 || ay > height) continue;

    const dir: 1 | -1 = k.s.anchor[0] >= landCenterX ? 1 : -1;
    const dirKey = String(dir) as "1" | "-1";
    const rectAt = (x: number, y: number): LabelRect =>
      dir > 0
        ? { x0: x, x1: x + k.w, y0: y - labelH / 2, y1: y + labelH / 2 }
        : { x0: x - k.w, x1: x, y0: y - labelH / 2, y1: y + labelH / 2 };

    // Scan outward from the ANCHOR (largest land mass), not the far edge of
    // the whole bbox — for an island chain like Hawaii this puts the label
    // right beside the big island instead of past the whole chain. Gives up
    // past maxDist: a longer leader reads as noise.
    const startX = ax + dir * gap;
    const scanRow = (y: number): { x: number; rect: LabelRect } | null => {
      for (
        let x = startX;
        (dir > 0 ? x + k.w <= width : x - k.w >= 0) &&
        Math.abs(x - startX) <= maxDist;
        x += dir * step
      ) {
        const rect = rectAt(x, y);
        if (!within(rect, width, height)) continue;
        if (rectOverLand(rect)) continue;
        if (placedBoxes.some((b) => rectsOverlap(rect, b))) continue;
        return { x, rect };
      }
      return null;
    };

    // Start at the anchor's row or just below the chain, whichever is
    // lower; sink slot by slot while the row is blocked.
    const y0 = Math.min(Math.max(ay, labelH / 2), height - labelH / 2);
    const yStart = Math.max(y0, chainY[dirKey] + slotH);
    let found: { x: number; y: number; rect: LabelRect } | null = null;
    for (
      let y = yStart;
      y <= height - labelH / 2 && y - y0 <= MAX_CALLOUT_DROP_SLOTS * slotH;
      y += slotH
    ) {
      const row = scanRow(y);
      if (row) {
        found = { x: row.x, y, rect: row.rect };
        break;
      }
    }

    // Nothing reachable — leave the state unlabeled rather than inventing a
    // far-away label. A dropped label does not advance the chain.
    if (!found) continue;

    chainY[dirKey] = found.y;
    placedBoxes.push(found.rect);
    // A label sitting right beside its state at its own latitude reads as
    // adjacent — a leader line would be noise. Only displaced labels
    // (stacked into a column, or pushed past other land) get one.
    const lx = dir > 0 ? found.x - gap * 0.5 : found.x + gap * 0.5;
    const ly = found.y;
    let ownD2 = Infinity;
    for (const ring of k.s.rings) {
      for (const [vx, vy] of ring) {
        const px = t.k * vx + t.x;
        const py = t.k * vy + t.y;
        const d2 = (px - lx) * (px - lx) + (py - ly) * (py - ly);
        if (d2 < ownD2) ownD2 = d2;
      }
    }
    const adjacent =
      ownD2 <= adjacentDist * adjacentDist && Math.abs(found.y - y0) <= labelH;
    // The leader points at the state's bounding-box point nearest the label
    // (clamping is monotone, so the lines of a stacked column keep the fan
    // order and can't cross), pulled a little toward the anchor so it ends
    // visibly inside the state — never all the way to the area centroid,
    // which stretched every line across the map.
    const cx2 = Math.min(Math.max(lx, k.boundsT.x0), k.boundsT.x1);
    const cy2 = Math.min(Math.max(ly, k.boundsT.y0), k.boundsT.y1);
    const tx2 = cx2 * 0.75 + k.anchorT[0] * 0.25;
    const ty2 = cy2 * 0.75 + k.anchorT[1] * 0.25;
    result.push({
      id: k.s.id,
      abbr: k.s.abbr,
      x: round(found.x),
      y: round(found.y),
      anchor: dir > 0 ? "start" : "end",
      placement: "callout",
      leader: adjacent
        ? null
        : {
            x1: round(lx),
            y1: round(ly),
            x2: round(tx2),
            y2: round(ty2),
          },
    });
  }

  return result;
}
