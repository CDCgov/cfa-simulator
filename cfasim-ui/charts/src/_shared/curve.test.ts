import { describe, it, expect } from "vitest";
import {
  curvePath,
  curveValueAt,
  reverseCurvePath,
  type CurvePoint,
  type LineCurve,
} from "./curve.js";

/** Path commands as `[letter, ...numbers]`. */
const parse = (d: string) =>
  [...d.matchAll(/([MLC])([^MLC]*)/g)].map(([, k, n]) => [
    k,
    ...n.split(",").map(Number),
  ]);

const pts: CurvePoint[] = [
  { x: 0, y: 10 },
  { x: 10, y: 30 },
  { x: 20, y: 20 },
];

describe("curvePath", () => {
  it("draws straight segments for linear", () => {
    expect(curvePath(pts)).toBe("M0,10L10,30L20,20");
  });

  it("steps at the midpoint for step", () => {
    expect(curvePath(pts, "step")).toBe("M0,10L5,10L5,30L15,30L15,20L20,20");
  });

  it("goes vertical first for step-before", () => {
    expect(curvePath(pts, "step-before")).toBe("M0,10L0,30L10,30L10,20L20,20");
  });

  it("goes horizontal first for step-after", () => {
    expect(curvePath(pts, "step-after")).toBe("M0,10L10,10L10,30L20,30L20,20");
  });

  it("draws one cubic per gap for monotone, passing through each point", () => {
    const [, a, b] = parse(curvePath(pts, "monotone"));
    expect([a[0], a.length, b[0], b.length]).toEqual(["C", 7, "C", 7]);
    expect(a.slice(5)).toEqual([10, 30]);
    expect(b.slice(5)).toEqual([20, 20]);
    // The local maximum gets a flat tangent, so the curve never rises above it.
    expect(a[4]).toBe(30);
    expect(b[2]).toBe(30);
  });

  it("falls back to a straight line for monotone with two points", () => {
    expect(curvePath(pts.slice(0, 2), "monotone")).toBe("M0,10L10,30");
  });

  it("steps along y for axis y", () => {
    const vertical = pts.map((p) => ({ x: p.y, y: p.x }));
    expect(curvePath(vertical, "step-after", { axis: "y" })).toBe(
      "M10,0L10,10L30,10L30,20L20,20",
    );
  });

  it("returns nothing for no points and a move for one", () => {
    expect(curvePath([], "step")).toBe("");
    expect(curvePath([{ x: 1, y: 2 }], "monotone")).toBe("M1,2");
  });
});

describe("reverseCurvePath", () => {
  it("traces every curve's own geometry backwards", () => {
    // Irregular spacing and a flat run, so a direction-dependent tangent
    // or step would show.
    const xs = [0, 3, 4, 9, 10, 15, 22];
    const ys = [5, 9, 9, 2, 6, 6, 1];
    const p = xs.map((x, i) => ({ x, y: ys[i] }));
    for (const curve of [
      "step",
      "step-before",
      "step-after",
      "monotone",
    ] as const) {
      const fwd = parse(curvePath(p, curve));
      // Ends of each command: the start point, then each segment's endpoint.
      const ends = fwd.map((c) => c.slice(-2));
      const back = fwd
        .slice(1)
        .reverse()
        .map((c, k) => {
          const end = ends[fwd.length - 2 - k];
          return c.length === 7
            ? ["C", c[3], c[4], c[1], c[2], ...end]
            : ["L", ...end];
        });
      const rev = parse(reverseCurvePath(p, curve, {}, "M"));
      expect(rev, curve).toEqual([["M", ...ends[ends.length - 1]], ...back]);
    }
  });
});

describe("from / to", () => {
  const many: CurvePoint[] = [0, 4, 1, 6, 3, 8, 2].map((y, i) => ({
    x: i * 10,
    y,
  }));
  const curves: LineCurve[] = [
    "linear",
    "step",
    "step-before",
    "step-after",
    "monotone",
  ];

  it("draws the same geometry as the full curve, for every curve", () => {
    for (const curve of curves) {
      const full = parse(curvePath(many, curve)).slice(1);
      const part = parse(curvePath(many, curve, { from: 2, to: 5 })).slice(1);
      // Commands per gap: 1 for linear / monotone, 2 for steps, plus the
      // closing half step of "step", which lands on the last point.
      const per = curve === "linear" || curve === "monotone" ? 1 : 2;
      expect(part.slice(0, 3 * per)).toEqual(full.slice(2 * per, 5 * per));
    }
  });

  it("starts the path at points[from] and reverses within the range", () => {
    expect(curvePath(many, "step-after", { from: 1, to: 2 })).toBe(
      "M10,4L20,4L20,1",
    );
    expect(reverseCurvePath(many, "linear", { from: 1, to: 3 })).toBe(
      "L30,6L20,1L10,4",
    );
    expect(curvePath(many, "step", { from: 3, to: 2 })).toBe("");
  });
});

describe("curveValueAt", () => {
  it("returns the held value for steps and interpolates otherwise", () => {
    expect(curveValueAt("step-after", 0, 10, 10, 20, 7)).toBe(10);
    expect(curveValueAt("step-before", 0, 10, 10, 20, 3)).toBe(20);
    expect(curveValueAt("step", 0, 10, 10, 20, 4)).toBe(10);
    expect(curveValueAt("step", 0, 10, 10, 20, 6)).toBe(20);
    expect(curveValueAt("linear", 0, 10, 10, 20, 5)).toBe(15);
    expect(curveValueAt(undefined, 0, 10, 10, 20, 5)).toBe(15);
  });
});
