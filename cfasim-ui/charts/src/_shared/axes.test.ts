import { describe, it, expect } from "vitest";
import { snap, niceStep, intervalValues, formatTick } from "./axes.js";

describe("snap", () => {
  it("rounds to nearest half-pixel", () => {
    expect(snap(0)).toBe(0.5);
    expect(snap(0.4)).toBe(0.5);
    expect(snap(0.6)).toBe(1.5);
    expect(snap(10.2)).toBe(10.5);
    expect(snap(-1.3)).toBe(-0.5);
  });
});

describe("niceStep", () => {
  it("chooses a 1-2-5-10 base aligned to the range", () => {
    expect(niceStep(100, 5)).toBe(20);
    expect(niceStep(10, 5)).toBe(2);
    expect(niceStep(1, 5)).toBeCloseTo(0.2);
    expect(niceStep(50, 5)).toBe(10);
  });

  it("scales by order of magnitude", () => {
    expect(niceStep(1000, 5)).toBe(200);
    expect(niceStep(10000, 5)).toBe(2000);
  });

  it("scales below 1", () => {
    expect(niceStep(0.5, 5)).toBeCloseTo(0.1);
  });
});

describe("intervalValues", () => {
  it("generates values at the given step", () => {
    expect(intervalValues(0, 10, 2)).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it("starts at the first multiple of step >= min", () => {
    expect(intervalValues(3, 10, 5)).toEqual([5, 10]);
  });

  it("returns empty when step is zero or negative", () => {
    expect(intervalValues(0, 10, 0)).toEqual([]);
    expect(intervalValues(0, 10, -1)).toEqual([]);
  });

  it("returns empty when step is not finite", () => {
    expect(intervalValues(0, 10, NaN)).toEqual([]);
    expect(intervalValues(0, 10, Infinity)).toEqual([]);
  });

  it("caps iteration to avoid runaway loops", () => {
    // Very small step relative to range — iteration cap kicks in.
    const out = intervalValues(0, 1, 1e-10);
    expect(out.length).toBeLessThanOrEqual(1000);
  });

  it("includes max when step divides range exactly (within epsilon)", () => {
    expect(intervalValues(0, 1, 0.1).at(-1)).toBeCloseTo(1);
  });
});

describe("formatTick", () => {
  it("formats integers without a decimal", () => {
    expect(formatTick(5)).toBe("5");
    expect(formatTick(0)).toBe("0");
    expect(formatTick(-3)).toBe("-3");
  });

  it("formats non-integers with one decimal place", () => {
    expect(formatTick(0.5)).toBe("0.5");
    expect(formatTick(-1.2)).toBe("-1.2");
  });

  it("uses thousand separators for >=1000", () => {
    expect(formatTick(1000)).toBe("1,000");
    expect(formatTick(1234567)).toBe("1,234,567");
    expect(formatTick(-5000)).toBe("-5,000");
  });
});
