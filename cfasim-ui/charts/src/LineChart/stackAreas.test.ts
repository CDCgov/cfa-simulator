import { describe, it, expect } from "vitest";
import { stackAreas } from "./stackAreas.js";

const bands = (areas: ReturnType<typeof stackAreas>) =>
  areas.map((a) => [Array.from(a.lower), Array.from(a.upper)]);

describe("stackAreas", () => {
  it("stacks by index in array order, positives up and negatives down", () => {
    const areas = stackAreas([
      { y: [1, -2], legend: "A", color: "red" },
      { y: [3, -4] },
      { y: [NaN, 5] },
    ]);
    expect(bands(areas)).toEqual([
      [
        [0, -2],
        [1, 0],
      ],
      [
        [1, -6],
        [4, -2],
      ],
      [
        [4, 0],
        [4, 5],
      ],
    ]);
    expect(areas[0]).toMatchObject({ legend: "A", color: "red" });
    expect(areas[0].x).toBeUndefined();
    // A non-finite value stacks as 0 but stays NaN for the tooltip.
    expect(Array.from(areas[2].value!)).toEqual([NaN, 5]);
  });

  it("matches points by x, sorted, with a missing point as 0", () => {
    const d = (s: string) => new Date(s);
    const areas = stackAreas([
      // An x that is not a date is dropped rather than unsorting the rest.
      { x: [d("2026-01-02"), d("2026-01-01"), d("nope")], y: [2, 1, 9] },
      // A date string matches the same time given as a Date.
      { x: ["2026-01-03", "2026-01-01"], y: [5, 3] },
    ]);
    expect(areas[0].x).toEqual([
      d("2026-01-01"),
      d("2026-01-02"),
      "2026-01-03",
    ]);
    expect(bands(areas)).toEqual([
      [
        [0, 0, 0],
        [1, 2, 0],
      ],
      [
        [1, 2, 0],
        [4, 2, 5],
      ],
    ]);
    expect(Array.from(areas[0].value!)).toEqual([1, 2, 0]);
  });

  it("refuses layers that mix x with index positions", () => {
    expect(() => stackAreas([{ x: [0, 1], y: [1, 2] }, { y: [3, 4] }])).toThrow(
      "give every layer `x`, or none",
    );
  });

  it("normalizes absolute values to fractions of each x's total", () => {
    const areas = stackAreas([{ y: [1, 0, -1] }, { y: [3, 0, 3] }], {
      offset: "normalize",
    });
    expect(bands(areas)).toEqual([
      [
        [0, 0, 0],
        [0.25, 0, 0.25],
      ],
      [
        [0.25, 0, 0.25],
        [1, 0, 1],
      ],
    ]);
  });
});
