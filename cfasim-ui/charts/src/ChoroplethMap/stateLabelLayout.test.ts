import { describe, it, expect } from "vitest";
import {
  fipsToStateAbbr,
  decimateRing,
  ringAreaCentroid,
  pointInRings,
  layoutStateLabels,
  type StateLabelFeature,
  type PlacedStateLabel,
} from "./stateLabelLayout";
import {
  rectsOverlap,
  boxFor,
  LINE_HEIGHT,
  type LabelRect,
} from "./cityLayout";

const OPTS = { width: 1000, height: 600, viewScale: 1 };
const LABEL_PX = 11;

/** Square state helper: axis-aligned square with side `size` at (x0, y0). */
function sq(
  id: string,
  abbr: string,
  x0: number,
  y0: number,
  size: number,
): StateLabelFeature {
  const ring: [number, number][] = [
    [x0, y0],
    [x0 + size, y0],
    [x0 + size, y0 + size],
    [x0, y0 + size],
    [x0, y0],
  ];
  const c: [number, number] = [x0 + size / 2, y0 + size / 2];
  return {
    id,
    abbr,
    centroid: c,
    anchor: c,
    bounds: { x0, y0, x1: x0 + size, y1: y0 + size },
    rings: [ring],
  };
}

/** The label's own box, from the width the layout reports. */
function boxOf(p: PlacedStateLabel): LabelRect {
  return boxFor(p.x, p.y, p.w, LABEL_PX * LINE_HEIGHT, p.anchor);
}

describe("fipsToStateAbbr", () => {
  it("maps the 50 states + DC + 5 territories", () => {
    expect(Object.keys(fipsToStateAbbr)).toHaveLength(56);
    expect(fipsToStateAbbr["06"]).toBe("CA");
    expect(fipsToStateAbbr["11"]).toBe("DC");
    expect(fipsToStateAbbr["72"]).toBe("PR");
  });
});

describe("decimateRing", () => {
  it("returns short rings unchanged", () => {
    const ring: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
    ];
    expect(decimateRing(ring, 150)).toBe(ring);
  });

  it("reduces long rings under the cap, keeping the first point", () => {
    const ring = Array.from(
      { length: 1000 },
      (_, i) => [i, i] as [number, number],
    );
    const out = decimateRing(ring, 150);
    expect(out.length).toBeLessThanOrEqual(150);
    expect(out[0]).toEqual([0, 0]);
  });
});

describe("ringAreaCentroid", () => {
  it("computes area + centroid of a square", () => {
    const { area, cx, cy } = ringAreaCentroid([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ]);
    expect(area).toBeCloseTo(100);
    expect(cx).toBeCloseTo(5);
    expect(cy).toBeCloseTo(5);
  });

  it("handles a degenerate ring without NaN", () => {
    const { area, cx, cy } = ringAreaCentroid([
      [3, 4],
      [3, 4],
    ]);
    expect(area).toBe(0);
    expect(cx).toBe(3);
    expect(cy).toBe(4);
  });
});

describe("pointInRings", () => {
  const rings: [number, number][][] = [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
    [
      [100, 100],
      [110, 100],
      [110, 110],
      [100, 110],
      [100, 100],
    ],
  ];

  it("hits inside any ring, misses between them", () => {
    expect(pointInRings(5, 5, rings)).toBe(true);
    expect(pointInRings(105, 105, rings)).toBe(true);
    expect(pointInRings(50, 50, rings)).toBe(false);
    expect(pointInRings(-1, 5, rings)).toBe(false);
  });
});

describe("layoutStateLabels", () => {
  it("places a fitting label inside the state, centered, without a leader", () => {
    const big = sq("01", "AA", 100, 100, 200);
    const [placed] = layoutStateLabels([big], undefined, OPTS);
    expect(placed.placement).toBe("inside");
    expect(placed.anchor).toBe("middle");
    expect(placed.leader).toBeNull();
    expect(placed.x).toBeCloseTo(200);
    expect(placed.y).toBeCloseTo(200);
  });

  it("places a too-small state's label right beside it, with no leader", () => {
    const tiny = sq("02", "BB", 700, 300, 8);
    const [placed] = layoutStateLabels([tiny], undefined, OPTS);
    expect(placed.placement).toBe("callout");
    // Right half of the viewport → label sits to the right, start-anchored,
    // adjacent to the state (no intervening land) — so no leader line.
    expect(placed.anchor).toBe("start");
    expect(placed.x).toBeGreaterThan(704);
    expect(placed.x).toBeLessThan(740);
    expect(placed.leader).toBeNull();
  });

  it("calls out to the left for a state on the west side of the landmass", () => {
    const tiny = sq("02", "BB", 200, 300, 8);
    // A big landmass to the east puts the tiny state on the map's west side.
    const land = sq("03", "CC", 240, 100, 400);
    const placed = layoutStateLabels([tiny, land], undefined, OPTS);
    const callout = placed.find((p) => p.id === "02")!;
    expect(callout.placement).toBe("callout");
    expect(callout.anchor).toBe("end");
    expect(callout.x).toBeLessThan(200);
    expect(callout.leader).toBeNull();
  });

  it("pushes past a neighbor's land when the other side is blocked too", () => {
    const tiny = sq("02", "BB", 600, 300, 8);
    const landEast = sq("03", "CC", 620, 250, 100);
    // West land flush against the state, wide enough that clearing it
    // exceeds the leader range.
    const landWest = sq("04", "DD", 480, 250, 120);
    const placed = layoutStateLabels(
      [tiny, landEast, landWest],
      undefined,
      OPTS,
    );
    const callout = placed.find((p) => p.id === "02")!;
    expect(callout.placement).toBe("callout");
    // The label cleared the east landmass (which spans x 620..720).
    expect(callout.anchor).toBe("start");
    expect(boxOf(callout).x0).toBeGreaterThan(720);
    // Displaced far from its state → leader line pointing back at it,
    // ending just inside the state's near edge (not its distant centroid).
    expect(callout.leader).not.toBeNull();
    expect(callout.leader!.x2).toBeGreaterThanOrEqual(600);
    expect(callout.leader!.x2).toBeLessThanOrEqual(612);
    expect(callout.leader!.y2).toBeGreaterThanOrEqual(296);
    expect(callout.leader!.y2).toBeLessThanOrEqual(312);
    expect(callout.leader!.x1).toBeLessThan(callout.x);
    // The neighbors themselves got inside labels.
    expect(placed.find((p) => p.id === "03")!.placement).toBe("inside");
    expect(placed.find((p) => p.id === "04")!.placement).toBe("inside");
  });

  it("drops the label when no open background is within leader range", () => {
    const tiny = sq("02", "BB", 600, 300, 8);
    // Land flush on BOTH sides, stretching far past the leader-distance cap.
    const landEast = sq("03", "CC", 620, 100, 300);
    const landWest = sq("04", "DD", 300, 100, 300);
    const placed = layoutStateLabels(
      [tiny, landEast, landWest],
      undefined,
      OPTS,
    );
    // Better no label than one pinned far away with a leader across the map.
    expect(placed.find((p) => p.id === "02")).toBeUndefined();
    expect(placed.find((p) => p.id === "03")!.placement).toBe("inside");
    expect(placed.find((p) => p.id === "04")!.placement).toBe("inside");
  });

  it("drops callouts whose anchor is outside the viewport (zoom/pan)", () => {
    const tiny = sq("02", "BB", 995, 300, 8);
    // Panned right by 10: the state's box still grazes the cull margin, but
    // its anchor is off screen — no label rather than an edge-pinned one.
    const placed = layoutStateLabels([tiny], { k: 1, x: 10, y: 0 }, OPTS);
    expect(placed).toHaveLength(0);
  });

  it("stacks colliding callout labels without overlap", () => {
    const a = sq("02", "BB", 700, 300, 8);
    const b = sq("03", "CC", 700, 306, 8);
    const placed = layoutStateLabels([a, b], undefined, OPTS);
    expect(placed).toHaveLength(2);
    expect(placed.every((p) => p.placement === "callout")).toBe(true);
    expect(rectsOverlap(boxOf(placed[0]), boxOf(placed[1]))).toBe(false);
  });

  it("uses the largest-ring anchor when the combined centroid is off-land", () => {
    // Two islands; the area centroid falls in the water between them.
    const bigRing: [number, number][] = [
      [100, 100],
      [250, 100],
      [250, 250],
      [100, 250],
      [100, 100],
    ];
    const smallRing: [number, number][] = [
      [400, 400],
      [440, 400],
      [440, 440],
      [400, 440],
      [400, 400],
    ];
    const state: StateLabelFeature = {
      id: "26",
      abbr: "MI",
      centroid: [320, 320],
      anchor: [175, 175],
      bounds: { x0: 100, y0: 100, x1: 440, y1: 440 },
      rings: [bigRing, smallRing],
    };
    const [placed] = layoutStateLabels([state], undefined, OPTS);
    expect(placed.placement).toBe("inside");
    expect(placed.x).toBeCloseTo(175);
    expect(placed.y).toBeCloseTo(175);
  });

  it("re-fits under zoom: a callout state gains an inside label zoomed in", () => {
    const tiny = sq("02", "BB", 700, 300, 8);
    const base = layoutStateLabels([tiny], undefined, OPTS);
    expect(base[0].placement).toBe("callout");
    // k=10 centered on the state: the 8-unit square becomes 80 units.
    const zoomed = layoutStateLabels(
      [tiny],
      { k: 10, x: -6500, y: -2700 },
      OPTS,
    );
    expect(zoomed).toHaveLength(1);
    expect(zoomed[0].placement).toBe("inside");
  });

  it("culls states outside the viewport", () => {
    const off = sq("02", "BB", 2000, 300, 100);
    expect(layoutStateLabels([off], undefined, OPTS)).toHaveLength(0);
  });

  it("skips states with no abbreviation or no rings", () => {
    const noAbbr = sq("02", "", 100, 100, 200);
    const noRings = { ...sq("03", "CC", 400, 100, 200), rings: [] };
    expect(layoutStateLabels([noAbbr, noRings], undefined, OPTS)).toHaveLength(
      0,
    );
  });

  it("never places a label outside the viewport", () => {
    // A small state embedded in land that reaches the right viewport edge:
    // no reachable background → dropped, not pinned outside/at the edge.
    const tiny = sq("02", "BB", 800, 300, 8);
    const land = sq("03", "CC", 600, 0, 600); // spans past x=1000
    const placed = layoutStateLabels([tiny, land], undefined, OPTS);
    for (const p of placed) {
      const box = boxOf(p);
      expect(box.x0).toBeGreaterThanOrEqual(0);
      expect(box.x1).toBeLessThanOrEqual(OPTS.width);
    }
    expect(placed.find((p) => p.id === "02")).toBeUndefined();
  });
});
