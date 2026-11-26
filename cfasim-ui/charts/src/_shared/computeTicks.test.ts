import { describe, it, expect } from "vitest";
import { computeTickValues } from "./computeTicks.js";

describe("computeTickValues", () => {
  it("handles degenerate ranges, interval ticks, explicit arrays, and auto niceStep", () => {
    expect(computeTickValues({ min: 5, max: 5 })).toEqual([]);
    expect(computeTickValues({ min: 0, max: 10, ticks: 2 })).toEqual([
      0, 2, 4, 6, 8, 10,
    ]);
    expect(
      computeTickValues({ min: 0, max: 5, ticks: [-1, 0, 3, 5, 99] }),
    ).toEqual([0, 3, 5]);
    expect(computeTickValues({ min: 0, max: 100, targetTickCount: 5 })).toEqual(
      expect.arrayContaining([0, 20, 40, 60, 80, 100]),
    );
    expect(
      computeTickValues({ min: 0, max: 10, targetTickCount: 0.1 }).length,
    ).toBeGreaterThan(0);
  });

  it("applies displayOffset to interval and explicit array ticks in data space", () => {
    expect(
      computeTickValues({ min: 0, max: 12, ticks: 5, displayOffset: 3 }),
    ).toEqual([2, 7, 12]);
    expect(
      computeTickValues({
        min: 0,
        max: 12,
        ticks: [5, 10, 15, 20],
        displayOffset: 3,
      }),
    ).toEqual([2, 7, 12]);
  });
});
