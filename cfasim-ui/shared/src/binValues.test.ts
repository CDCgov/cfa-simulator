import { describe, it, expect } from "vitest";
import { binValues } from "./binValues.js";

describe("binValues", () => {
  it("matches the docs example", () => {
    expect(binValues([0.2, 0.4, 1.1, 1.3, 1.9], { step: 0.5 })).toEqual({
      x: [0, 0.5, 1, 1.5],
      x2: [0.5, 1, 1.5, 2],
      count: [2, 0, 2, 1],
    });
  });

  it("splits the extent into equal-width bins", () => {
    const bins = binValues([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], {
      thresholds: 5,
    });
    expect(bins.x).toEqual([0, 2, 4, 6, 8]);
    expect(bins.x2).toEqual([2, 4, 6, 8, 10]);
    // The last bin also holds the upper bound.
    expect(bins.count).toEqual([2, 2, 2, 2, 3]);
  });

  it("defaults to Sturges' rule", () => {
    const bins = binValues(Array.from({ length: 100 }, (_, i) => i));
    expect(bins.count.length).toBe(Math.ceil(Math.log2(100) + 1));
    expect(bins.count.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("aligns a step to its multiples without float drift", () => {
    const bins = binValues([0.12, 0.31, 0.38, 0.95], { step: 0.1 });
    expect(bins.x[0]).toBe(0.1);
    expect(bins.x).toContain(0.3);
    expect(bins.x2.at(-1)).toBe(1);
    expect(bins.count.reduce((a, b) => a + b, 0)).toBe(4);
    expect(bins.count[bins.x.indexOf(0.3)]).toBe(2);
  });

  it("uses explicit edges and drops values outside them", () => {
    const bins = binValues([-1, 0, 5, 9, 10, 11, 50], {
      thresholds: [10, 0, 5],
    });
    expect(bins.x).toEqual([0, 5]);
    expect(bins.x2).toEqual([5, 10]);
    expect(bins.count).toEqual([1, 3]);
  });

  it("bins over a fixed domain", () => {
    const bins = binValues([1, 2, 3, 20], { domain: [0, 10], thresholds: 2 });
    expect(bins.x).toEqual([0, 5]);
    expect(bins.count).toEqual([3, 0]);
  });

  it("gives one bin for identical values and none for no values", () => {
    expect(binValues([3, 3, 3])).toEqual({ x: [2.5], x2: [3.5], count: [3] });
    expect(binValues([NaN, Infinity])).toEqual({ x: [], x2: [], count: [] });
  });
});
