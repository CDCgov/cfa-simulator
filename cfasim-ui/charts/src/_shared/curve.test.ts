import { describe, it, expect } from "vitest";
import {
  curvePath,
  curveSegments,
  curveValueAt,
  reverseCurvePath,
  type CurvePoint,
  type LineCurve,
} from "./curve.js";

const pts: CurvePoint[] = [
  { x: 0, y: 10 },
  { x: 10, y: 30 },
  { x: 20, y: 20 },
];

describe("curveSegments", () => {
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
    const segs = curveSegments(pts, "monotone");
    expect(segs).toHaveLength(2);
    expect(segs.every((s) => s.length === 6)).toBe(true);
    expect(segs[0].slice(4)).toEqual([10, 30]);
    expect(segs[1].slice(4)).toEqual([20, 20]);
    // The local maximum gets a flat tangent, so the curve never rises above it.
    expect(segs[0][3]).toBe(30);
    expect(segs[1][1]).toBe(30);
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
  it("traces a step curve backwards", () => {
    expect(reverseCurvePath(pts, "step-after")).toBe(
      "L20,20L20,30L10,30L10,10L0,10",
    );
  });

  it("swaps control points when reversing a cubic", () => {
    const [a, b] = curveSegments(pts, "monotone");
    expect(reverseCurvePath(pts, "monotone", {}, "M")).toBe(
      `M20,20C${b[2]},${b[3]},${b[0]},${b[1]},10,30` +
        `C${a[2]},${a[3]},${a[0]},${a[1]},0,10`,
    );
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
      const full = curveSegments(many, curve);
      const part = curveSegments(many, curve, { from: 2, to: 5 });
      // Segments per gap: 1 for linear / monotone, 2 for steps, plus the
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
