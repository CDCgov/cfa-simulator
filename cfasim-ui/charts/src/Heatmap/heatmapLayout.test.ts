import { describe, expect, it } from "vitest";
import {
  columnLabelSidePadding,
  labelReach,
  labelWidthForExtent,
  labelWidthForReach,
  moveCell,
  normalizeLabelAngle,
  pickLabelAngle,
  pivotCells,
  rotatedLabelExtent,
  rotatedLabelFootprint,
} from "./heatmapLayout.js";

describe("heatmapLayout", () => {
  it("pivots records by first appearance with NaN gaps and supports explicit order/filter", () => {
    const records = [
      { loc: "AZ", model: "a", score: 1 },
      { loc: "AZ", model: "b", score: 2 },
      { loc: "CA", model: "b", score: 3 },
      { loc: "CA", model: "a", score: null },
    ];
    expect(
      pivotCells(records, { row: "loc", column: "model", value: "score" }),
    ).toEqual({
      rows: ["AZ", "CA"],
      columns: ["a", "b"],
      data: [
        [1, 2],
        [NaN, 3],
      ],
    });
    expect(
      pivotCells(records, {
        row: (r) => r.loc,
        column: "model",
        value: "score",
        rows: ["CA", "NY"],
        columns: ["b"],
      }),
    ).toEqual({ rows: ["CA", "NY"], columns: ["b"], data: [[3], [NaN]] });
  });

  it("picks/normalizes angles and computes rotated extent, reach inverses, and side padding", () => {
    expect([
      pickLabelAngle(30, 40, 10),
      pickLabelAngle(60, 40, 10),
      pickLabelAngle(60, 17, 10),
    ]).toEqual([0, -45, -90]);
    expect([
      normalizeLabelAngle(270),
      normalizeLabelAngle(135),
      normalizeLabelAngle(180),
      normalizeLabelAngle(NaN),
    ]).toEqual([-90, -45, 0, 0]);
    expect(rotatedLabelExtent(50, 10, -45)).toBeCloseTo((50 + 10) / Math.SQRT2);
    expect(rotatedLabelFootprint(80, 10, -45)).toBeCloseTo(12 * Math.SQRT2);
    for (const angle of [0, -30, 45])
      expect(
        labelWidthForReach(labelReach(80, 12, angle), 12, angle),
      ).toBeCloseTo(80);
    expect(labelWidthForReach(10, 12, -90)).toBe(Infinity);
    expect(
      labelWidthForExtent(rotatedLabelExtent(80, 12, -60), 12, -60),
    ).toBeCloseTo(80);

    const shared = { fontSize: 10, pitch: 40, leftRoom: 20, rightRoom: 10 };
    const left = columnLabelSidePadding({
      ...shared,
      widths: [100, 20, 100],
      angle: -45,
      side: "left",
    });
    expect(left.left).toBeCloseTo(
      (labelReach(100, 10, -45) - 40) / (1 - 0.5 / 3),
    );
    expect(left.right).toBe(0);
    const flat = columnLabelSidePadding({
      ...shared,
      widths: [120, 120],
      angle: 0,
      side: "left",
    });
    expect(flat.left).toBeCloseTo(20 / 0.75);
    expect(flat.right).toBeCloseTo(30 / 0.75);
  });

  it("moves across the grid, clamps edges, and reaches -1 only when row labels exist", () => {
    expect(moveCell({ row: 0, column: 0 }, "ArrowRight", 2, 3, false)).toEqual({
      row: 0,
      column: 1,
    });
    expect(moveCell({ row: 0, column: 2 }, "ArrowRight", 2, 3, false)).toEqual({
      row: 0,
      column: 2,
    });
    expect(moveCell({ row: 0, column: 0 }, "ArrowLeft", 2, 3, true)).toEqual({
      row: 0,
      column: -1,
    });
    expect(moveCell({ row: 0, column: 0 }, "ArrowLeft", 2, 3, false)).toEqual({
      row: 0,
      column: 0,
    });
    expect(moveCell({ row: 0, column: 2 }, "Home", 2, 3, true)).toEqual({
      row: 0,
      column: -1,
    });
    expect(moveCell({ row: 0, column: -1 }, "End", 2, 3, true)).toEqual({
      row: 0,
      column: 2,
    });
    expect(moveCell({ row: 0, column: 0 }, "Enter", 2, 3, true)).toBeNull();
  });
});
