import { describe, expect, it } from "vitest";
import { CATEGORICAL_COLORS } from "../_shared/palette.js";
import { groupSeries } from "./groupSeries.js";

describe("groupSeries", () => {
  const cols = {
    x: [1, 2, 3, 4, 5],
    y: new Float64Array([10, 20, 30, 40, 50]),
    group: ["b", "a", "b", null, "a"],
    dotRadius: [1, 2, 3, 4, 5],
  };

  it("splits columns by group in first-seen order with palette colors", () => {
    const out = groupSeries(cols);
    expect(out.map((s) => [s.legend, s.color])).toEqual([
      ["b", CATEGORICAL_COLORS[0]],
      ["a", CATEGORICAL_COLORS[1]],
    ]);
    expect(Array.from(out[0].y!)).toEqual([10, 30]);
    // Typed arrays keep their type; plain arrays stay plain.
    expect(out[0].y).toBeInstanceOf(Float64Array);
    expect(out[0].x).toEqual([1, 3]);
    expect(out[1].dotRadius).toEqual([2, 5]);
  });

  it("honors order, a color map, labels and per-group style", () => {
    const out = groupSeries(cols, {
      order: ["a", "zzz", "b"],
      colors: { b: "#111" },
      label: (k) => `Group ${k}`,
      style: (k) => ({
        line: false,
        dots: true,
        ...(k === "a" && { color: "#222" }),
      }),
    });
    expect(out.map((s) => [s.legend, s.color, s.line])).toEqual([
      ["Group a", "#222", false],
      ["Group b", "#111", false],
    ]);
  });

  it("cycles a color list in group order", () => {
    const out = groupSeries(
      { y: [1, 2, 3], group: [1, 2, 3] },
      { colors: ["red", "blue"] },
    );
    expect(out.map((s) => s.color)).toEqual(["red", "blue", "red"]);
  });
});
