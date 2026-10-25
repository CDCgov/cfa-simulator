import { describe, it, expect } from "vitest";
import { sharedExtent } from "./extent.js";

describe("sharedExtent", () => {
  it("spans the finite values of every array", () => {
    expect(
      sharedExtent([[3, NaN, 7], new Float64Array([-2, 5]), undefined, []]),
    ).toEqual({ min: -2, max: 7 });
  });

  it("skips non-positive values for a log axis, and is undefined when empty", () => {
    expect(sharedExtent([[0, -1, 0.5, 40]], { log: true })).toEqual({
      min: 0.5,
      max: 40,
    });
    expect(sharedExtent([[NaN], [0]], { log: true })).toBeUndefined();
  });
});
