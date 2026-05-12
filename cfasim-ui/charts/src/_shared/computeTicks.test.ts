import { describe, it, expect } from "vitest";
import { computeTickValues } from "./computeTicks.js";

describe("computeTickValues", () => {
  it("returns empty when min === max", () => {
    expect(computeTickValues({ min: 5, max: 5 })).toEqual([]);
  });

  it("respects an explicit number interval", () => {
    expect(computeTickValues({ min: 0, max: 10, ticks: 2 })).toEqual([
      0, 2, 4, 6, 8, 10,
    ]);
  });

  it("filters explicit-array ticks to those inside [min, max]", () => {
    expect(
      computeTickValues({ min: 0, max: 5, ticks: [-1, 0, 3, 5, 99] }),
    ).toEqual([0, 3, 5]);
  });

  it("auto-spaces ticks via niceStep when no ticks are supplied", () => {
    const out = computeTickValues({ min: 0, max: 100, targetTickCount: 5 });
    expect(out).toEqual(expect.arrayContaining([0, 20, 40, 60, 80, 100]));
  });

  it("applies displayOffset to interval ticks (data-space output)", () => {
    // User says "ticks every 5 in display space" with offset 3 — the
    // returned data-space values are 5-offset, 10-offset, ...
    const out = computeTickValues({
      min: 0,
      max: 12,
      ticks: 5,
      displayOffset: 3,
    });
    // Display-space ticks at 5, 10, 15 → data-space 2, 7, 12.
    expect(out).toEqual([2, 7, 12]);
  });

  it("applies displayOffset to explicit array ticks", () => {
    // ticks [5, 10, 15] with offset 3 → data-space [2, 7, 12]. All three
    // fall inside [0, 12] (inclusive on max).
    expect(
      computeTickValues({
        min: 0,
        max: 12,
        ticks: [5, 10, 15],
        displayOffset: 3,
      }),
    ).toEqual([2, 7, 12]);
    // 20 → data-space 17, outside [0, 12]; filtered out.
    expect(
      computeTickValues({
        min: 0,
        max: 12,
        ticks: [5, 10, 20],
        displayOffset: 3,
      }),
    ).toEqual([2, 7]);
  });

  it("clamps tiny targetTickCount values to >= 3", () => {
    const out = computeTickValues({ min: 0, max: 10, targetTickCount: 0.1 });
    expect(out.length).toBeGreaterThan(0);
  });
});
