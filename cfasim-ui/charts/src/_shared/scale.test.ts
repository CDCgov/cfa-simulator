import { describe, it, expect } from "vitest";
import {
  scaleFraction,
  clampExtentForScale,
  computeLogTickValues,
  LOG_FLOOR,
} from "./scale.js";

describe("scaleFraction", () => {
  it("linear: maps value linearly to [0, 1]", () => {
    expect(scaleFraction(0, 0, 10, "linear")).toBe(0);
    expect(scaleFraction(5, 0, 10, "linear")).toBe(0.5);
    expect(scaleFraction(10, 0, 10, "linear")).toBe(1);
  });

  it("log: maps value via natural log to [0, 1]", () => {
    expect(scaleFraction(1, 1, 100, "log")).toBe(0);
    expect(scaleFraction(10, 1, 100, "log")).toBeCloseTo(0.5);
    expect(scaleFraction(100, 1, 100, "log")).toBe(1);
  });

  it("log: clamps non-positive values to min", () => {
    expect(scaleFraction(0, 1, 100, "log")).toBe(0);
    expect(scaleFraction(-5, 1, 100, "log")).toBe(0);
  });

  it("linear: returns 0 when range is zero", () => {
    // (v - min)/0 → defended via `|| 1` fallback so we don't NaN.
    expect(scaleFraction(5, 5, 5, "linear")).toBe(0);
  });
});

describe("clampExtentForScale", () => {
  it("returns input unchanged for linear scale", () => {
    expect(clampExtentForScale(-5, 10, "linear", 2)).toEqual({
      min: -5,
      max: 10,
    });
  });

  it("clamps log min up to smallest positive data value", () => {
    expect(clampExtentForScale(0, 100, "log", 2)).toEqual({ min: 2, max: 100 });
    expect(clampExtentForScale(-50, 100, "log", 0.1)).toEqual({
      min: 0.1,
      max: 100,
    });
  });

  it("uses LOG_FLOOR when no positive data exists", () => {
    expect(clampExtentForScale(-10, -1, "log", Infinity)).toEqual({
      min: LOG_FLOOR,
      max: LOG_FLOOR,
    });
  });

  it("leaves positive min alone", () => {
    expect(clampExtentForScale(5, 100, "log", 5)).toEqual({ min: 5, max: 100 });
  });
});

describe("computeLogTickValues", () => {
  it("returns powers of 10 inside the range by default", () => {
    expect(computeLogTickValues({ min: 1, max: 1000 })).toEqual([
      1, 10, 100, 1000,
    ]);
  });

  it("filters powers of 10 to the visible range", () => {
    expect(computeLogTickValues({ min: 5, max: 500 })).toEqual([10, 100]);
  });

  it("honors an explicit array of ticks", () => {
    expect(
      computeLogTickValues({ min: 1, max: 100, ticks: [2, 5, 50] }),
    ).toEqual([2, 5, 50]);
  });

  it("filters explicit ticks outside the range", () => {
    expect(
      computeLogTickValues({ min: 1, max: 100, ticks: [0.5, 1, 50, 500] }),
    ).toEqual([1, 50]);
  });

  it("ignores numeric ticks and falls back to powers of 10", () => {
    // Numeric (linear-interval) ticks on a log axis would swarm the
    // axis with labels, so they're ignored — pass an array for custom
    // log ticks.
    expect(computeLogTickValues({ min: 1, max: 100, ticks: 2 })).toEqual([
      1, 10, 100,
    ]);
  });

  it("returns empty when range is degenerate or non-positive", () => {
    expect(computeLogTickValues({ min: 1, max: 1 })).toEqual([]);
    expect(computeLogTickValues({ min: 0, max: 10 })).toEqual([]);
    expect(computeLogTickValues({ min: -1, max: 10 })).toEqual([]);
  });
});
