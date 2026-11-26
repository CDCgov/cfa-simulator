import { describe, it, expect } from "vitest";
import { binValues } from "./binValues.js";

describe("binValues", () => {
  it("aligns step bins without float drift and counts values", () => {
    expect(binValues([0.2, 0.4, 1.1, 1.3, 1.9], { step: 0.5 })).toEqual({
      x: [0, 0.5, 1, 1.5],
      x2: [0.5, 1, 1.5, 2],
      count: [2, 0, 2, 1],
    });
    const bins = binValues([0.12, 0.31, 0.38, 0.95], { step: 0.1 });
    expect(bins.x[0]).toBe(0.1);
    expect(bins.x2.at(-1)).toBe(1);
    expect(bins.count[bins.x.indexOf(0.3)]).toBe(2);
  });

  it("handles thresholds, Sturges default, explicit edges, domain, and degenerate inputs", () => {
    const equal = binValues([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], {
      thresholds: 5,
    });
    expect(equal.count).toEqual([2, 2, 2, 2, 3]);

    const sturges = binValues(Array.from({ length: 100 }, (_, index) => index));
    expect(sturges.count.length).toBe(Math.ceil(Math.log2(100) + 1));

    expect(
      binValues([-1, 0, 5, 9, 10, 11], { thresholds: [10, 0, 5] }),
    ).toEqual({
      x: [0, 5],
      x2: [5, 10],
      count: [1, 3],
    });
    expect(
      binValues([1, 2, 3, 20], { domain: [0, 10], thresholds: 2 }).count,
    ).toEqual([3, 0]);
    expect(binValues([3, 3, 3])).toEqual({ x: [2.5], x2: [3.5], count: [3] });
    expect(binValues([NaN, Infinity])).toEqual({ x: [], x2: [], count: [] });
  });
});
