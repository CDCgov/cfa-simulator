import { describe, it, expect } from "vitest";
import {
  intervalGeometry,
  resolveIntervalStyle,
  seriesIntervals,
  INTERVAL_DEFAULTS,
} from "./intervals.js";

describe("intervals", () => {
  it("computes perpendicular caps for vertical, horizontal, zero-length, and capless whiskers", () => {
    const vertical = intervalGeometry({ x: 50, y: 100 }, { x: 50, y: 20 }, 8);
    expect(vertical.caps).toEqual([
      { x1: 54, y1: 100, x2: 46, y2: 100 },
      { x1: 54, y1: 20, x2: 46, y2: 20 },
    ]);
    expect(
      intervalGeometry({ x: 20, y: 70 }, { x: 120, y: 70 }, 10).caps[0],
    ).toEqual({
      x1: 20,
      y1: 75,
      x2: 20,
      y2: 65,
    });
    expect(
      intervalGeometry({ x: 30, y: 40 }, { x: 30, y: 40 }, 6).caps,
    ).toEqual([{ x1: 27, y1: 40, x2: 33, y2: 40 }]);
    expect(intervalGeometry({ x: 0, y: 10 }, { x: 0, y: 0 }, 0).caps).toEqual(
      [],
    );
  });

  it("layers interval style over chart style and fallback color, normalizing dashes", () => {
    expect(resolveIntervalStyle({}, undefined).color).toBe(
      INTERVAL_DEFAULTS.color,
    );
    const merged = resolveIntervalStyle(
      { lineWidth: 3, lineDash: 4 },
      { lineWidth: 2, capWidth: 12, color: "red" },
      "blue",
    );
    expect(merged).toMatchObject({
      lineWidth: 3,
      capWidth: 12,
      color: "red",
      dotFill: "red",
      lineDash: "4 4",
    });
  });

  it("expands finite parallel bounds and normalizes swapped bounds", () => {
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
    expect(out[2]).toMatchObject({ x: 30, lower: 7, upper: 9, value: 8 });
    expect(
      seriesIntervals({ data: [1], lower: [0], xAt: (i) => i, seriesIndex: 0 }),
    ).toEqual([]);
  });
});
