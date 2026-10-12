import { describe, it, expect } from "vitest";
import {
  intervalGeometry,
  resolveIntervalStyle,
  seriesIntervals,
  INTERVAL_DEFAULTS,
} from "./intervals.js";

describe("intervalGeometry", () => {
  it("lays caps perpendicular to a vertical whisker", () => {
    const g = intervalGeometry({ x: 50, y: 100 }, { x: 50, y: 20 }, 8);
    expect(g.line).toEqual({ x1: 50, y1: 100, x2: 50, y2: 20 });
    expect(g.caps).toHaveLength(2);
    expect(g.caps[0]).toEqual({ x1: 54, y1: 100, x2: 46, y2: 100 });
    expect(g.caps[1]).toEqual({ x1: 54, y1: 20, x2: 46, y2: 20 });
  });

  it("lays caps perpendicular to a horizontal whisker", () => {
    const g = intervalGeometry({ x: 20, y: 70 }, { x: 120, y: 70 }, 10);
    expect(g.caps[0]).toEqual({ x1: 20, y1: 75, x2: 20, y2: 65 });
    expect(g.caps[1]).toEqual({ x1: 120, y1: 75, x2: 120, y2: 65 });
  });

  it("draws a single horizontal cap for a zero-length whisker", () => {
    const g = intervalGeometry({ x: 30, y: 40 }, { x: 30, y: 40 }, 6);
    expect(g.caps).toEqual([{ x1: 27, y1: 40, x2: 33, y2: 40 }]);
  });

  it("omits caps when capWidth is 0", () => {
    const g = intervalGeometry({ x: 0, y: 10 }, { x: 0, y: 0 }, 0);
    expect(g.caps).toEqual([]);
  });
});

describe("resolveIntervalStyle", () => {
  it("falls back to the defaults", () => {
    const s = resolveIntervalStyle({}, undefined);
    expect(s.color).toBe(INTERVAL_DEFAULTS.color);
    expect(s.lineWidth).toBe(INTERVAL_DEFAULTS.lineWidth);
    expect(s.capWidth).toBe(INTERVAL_DEFAULTS.capWidth);
    expect(s.outlineWidth).toBe(0);
    expect(s.dot).toBe(true);
    expect(s.dotFill).toBe(INTERVAL_DEFAULTS.color);
  });

  it("layers interval style over chart style over the fallback color", () => {
    const s = resolveIntervalStyle(
      { lineWidth: 3 },
      { lineWidth: 2, capWidth: 12, color: "red" },
      "blue",
    );
    expect(s.lineWidth).toBe(3);
    expect(s.capWidth).toBe(12);
    expect(s.color).toBe("red");
    expect(resolveIntervalStyle({}, {}, "blue").color).toBe("blue");
  });

  it("derives the dot fill from the color and normalizes the dash", () => {
    const s = resolveIntervalStyle({ color: "#f00", lineDash: 4 }, undefined);
    expect(s.dotFill).toBe("#f00");
    expect(s.lineDash).toBe("4 4");
    expect(resolveIntervalStyle({ lineDash: [2, 6] }, undefined).lineDash).toBe(
      "2 6",
    );
    expect(resolveIntervalStyle({ dotFill: "#fff" }, undefined).dotFill).toBe(
      "#fff",
    );
  });
});

describe("seriesIntervals", () => {
  it("expands parallel bounds into one interval per finite point", () => {
    const out = seriesIntervals({
      data: [5, 6, 7, 8],
      lower: [4, NaN, 6, 9],
      upper: [6, 7, 8, 7],
      xAt: (i) => i * 10,
      seriesIndex: 2,
      style: { color: "teal" },
    });
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({
      x: 0,
      lower: 4,
      upper: 6,
      value: 5,
      seriesIndex: 2,
      color: "teal",
      dot: false,
    });
    // Swapped bounds are normalized.
    expect(out[2]).toMatchObject({ x: 30, lower: 7, upper: 9, value: 8 });
  });

  it("stops at the end of data", () => {
    const out = seriesIntervals({
      data: [1],
      lower: [0, 1],
      upper: [2, 3],
      xAt: (i) => i,
      seriesIndex: 0,
    });
    expect(out).toHaveLength(1);
  });

  it("returns nothing when a bound is missing", () => {
    expect(
      seriesIntervals({
        data: [1, 2],
        lower: [0, 1],
        xAt: (i) => i,
        seriesIndex: 0,
      }),
    ).toEqual([]);
  });
});
