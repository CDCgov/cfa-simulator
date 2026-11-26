import { describe, it, expect } from "vitest";
import {
  curvePath,
  curveValueAt,
  reverseCurvePath,
  type CurvePoint,
  type LineCurve,
} from "./curve.js";

const parse = (path: string) =>
  [...path.matchAll(/([MLC])([^MLC]*)/g)].map(([, cmd, nums]) => [
    cmd,
    ...nums.split(",").map(Number),
  ]);

const pts: CurvePoint[] = [
  { x: 0, y: 10 },
  { x: 10, y: 30 },
  { x: 20, y: 20 },
];

describe("curvePath / reverseCurvePath / curveValueAt", () => {
  it("generates linear, step variants, monotone cubics, y-axis steps, and edge lengths", () => {
    expect(curvePath(pts)).toBe("M0,10L10,30L20,20");
    expect(curvePath(pts, "step")).toBe("M0,10L5,10L5,30L15,30L15,20L20,20");
    expect(curvePath(pts, "step-before")).toBe("M0,10L0,30L10,30L10,20L20,20");
    expect(curvePath(pts, "step-after")).toBe("M0,10L10,10L10,30L20,30L20,20");
    expect(
      curvePath(
        pts.map((p) => ({ x: p.y, y: p.x })),
        "step-after",
        { axis: "y" },
      ),
    ).toBe("M10,0L10,10L30,10L30,20L20,20");
    expect(curvePath([], "step")).toBe("");
    expect(curvePath([{ x: 1, y: 2 }], "monotone")).toBe("M1,2");

    // Monotone local maximum gets a flat tangent so it never overshoots.
    const [, first, second] = parse(curvePath(pts, "monotone"));
    expect([first[0], first[4], second[2]]).toEqual(["C", 30, 30]);
  });

  it("reverses geometry and slices from/to consistently across all curves", () => {
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
    for (const curve of curves) {
      const full = parse(curvePath(many, curve)).slice(1);
      const part = parse(curvePath(many, curve, { from: 2, to: 5 })).slice(1);
      const perGap = curve === "linear" || curve === "monotone" ? 1 : 2;
      expect(part.slice(0, 3 * perGap)).toEqual(
        full.slice(2 * perGap, 5 * perGap),
      );

      const fwd = parse(curvePath(many, curve));
      const ends = fwd.map((cmd) => cmd.slice(-2));
      const back = fwd
        .slice(1)
        .reverse()
        .map((cmd, idx) => {
          const end = ends[fwd.length - 2 - idx];
          return cmd.length === 7
            ? ["C", cmd[3], cmd[4], cmd[1], cmd[2], ...end]
            : ["L", ...end];
        });
      expect(parse(reverseCurvePath(many, curve, {}, "M")), curve).toEqual([
        ["M", ...ends[ends.length - 1]],
        ...back,
      ]);
    }
  });

  it("evaluates held step values and linear interpolation via curveValueAt", () => {
    expect(curveValueAt("step-after", 0, 10, 10, 20, 7)).toBe(10);
    expect(curveValueAt("step-before", 0, 10, 10, 20, 3)).toBe(20);
    expect(curveValueAt("step", 0, 10, 10, 20, 6)).toBe(20);
    expect(curveValueAt("linear", 0, 10, 10, 20, 5)).toBe(15);
  });
});
