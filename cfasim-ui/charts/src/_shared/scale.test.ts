import { describe, it, expect } from "vitest";
import {
  scaleFraction,
  zoomExtent,
  clampExtentForScale,
  computeLogTickValues,
  LOG_FLOOR,
} from "./scale.js";

describe("scale", () => {
  it("maps linear and log fractions and defends zero/non-positive inputs", () => {
    expect(scaleFraction(5, 0, 10, "linear")).toBe(0.5);
    expect(scaleFraction(5, 5, 5, "linear")).toBe(0);
    expect(scaleFraction(10, 1, 100, "log")).toBeCloseTo(0.5);
    expect(scaleFraction(-5, 1, 100, "log")).toBe(0);
  });

  it("clamps non-positive log extents to smallest positive value or LOG_FLOOR", () => {
    expect(clampExtentForScale(-5, 10, "linear", 2)).toEqual({
      min: -5,
      max: 10,
    });
    expect(clampExtentForScale(0, 100, "log", 2)).toEqual({ min: 2, max: 100 });
    expect(clampExtentForScale(-10, -1, "log", Infinity)).toEqual({
      min: LOG_FLOOR,
      max: LOG_FLOOR,
    });
  });

  it("computes power-of-10 and explicit log ticks, ignoring numeric intervals", () => {
    expect(computeLogTickValues({ min: 5, max: 500 })).toEqual([10, 100]);
    expect(
      computeLogTickValues({ min: 1, max: 100, ticks: [0.5, 1, 50, 500] }),
    ).toEqual([1, 50]);
    expect(computeLogTickValues({ min: 1, max: 100, ticks: 2 })).toEqual([
      1, 10, 100,
    ]);
    expect(computeLogTickValues({ min: 0, max: 10 })).toEqual([]);
  });

  it("zooms linear and log extents while respecting maxZoom and full bounds", () => {
    const full = { min: 0, max: 100 };
    expect(zoomExtent(0.25, 0.5, full, full, "linear", 1e4)).toEqual({
      min: 25,
      max: 50,
    });

    const logZoom = zoomExtent(
      0,
      0.5,
      { min: 1, max: 100 },
      { min: 1, max: 1000 },
      "log",
      1e4,
    );
    expect(logZoom.min).toBeCloseTo(1);
    expect(logZoom.max).toBeCloseTo(10);

    const clamped = zoomExtent(0.9999, 1, full, full, "linear", 100);
    expect(clamped.min).toBeCloseTo(99);
    expect(clamped.max).toBeCloseTo(100);
  });
});
