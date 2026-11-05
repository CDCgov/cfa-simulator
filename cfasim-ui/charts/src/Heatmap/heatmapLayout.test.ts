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
  truncateLabel,
} from "./heatmapLayout.js";

describe("pivotCells", () => {
  const records = [
    { loc: "AZ", model: "a", score: 1 },
    { loc: "AZ", model: "b", score: 2 },
    { loc: "CA", model: "b", score: 3 },
    { loc: "CA", model: "a", score: null },
  ];

  it("orders rows and columns by first appearance and fills gaps with NaN", () => {
    const m = pivotCells(records, {
      row: "loc",
      column: "model",
      value: "score",
    });
    expect(m.rows).toEqual(["AZ", "CA"]);
    expect(m.columns).toEqual(["a", "b"]);
    expect(m.data).toEqual([
      [1, 2],
      [NaN, 3],
    ]);
  });

  it("keeps an explicit order and drops labels outside it", () => {
    const m = pivotCells(records, {
      row: (r) => r.loc,
      column: "model",
      value: "score",
      rows: ["CA", "NY"],
      columns: ["b"],
    });
    expect(m.rows).toEqual(["CA", "NY"]);
    expect(m.columns).toEqual(["b"]);
    expect(m.data).toEqual([[3], [NaN]]);
  });

  it("lets the last record for a cell win and stringifies labels", () => {
    const m = pivotCells(
      [
        { r: 1, c: 2, v: "5" },
        { r: 1, c: 2, v: 6 },
      ],
      { row: "r", column: "c", value: "v" },
    );
    expect(m.rows).toEqual(["1"]);
    expect(m.data).toEqual([[6]]);
  });
});

describe("pickLabelAngle", () => {
  it("stays flat while the widest label fits the column pitch", () => {
    expect(pickLabelAngle(30, 40, 10)).toBe(0);
    expect(pickLabelAngle(36, 40, 10)).toBe(0);
  });

  it("goes diagonal, then vertical, as columns get narrower", () => {
    expect(pickLabelAngle(60, 40, 10)).toBe(-45);
    expect(pickLabelAngle(60, 17, 10)).toBe(-90);
  });
});

describe("rotatedLabelExtent", () => {
  it("is the font height flat, the text width vertical, and in between diagonal", () => {
    expect(rotatedLabelExtent(50, 10, 0)).toBeCloseTo(10);
    expect(rotatedLabelExtent(50, 10, -90)).toBeCloseTo(50);
    expect(rotatedLabelExtent(50, 10, -45)).toBeCloseTo((50 + 10) / Math.SQRT2);
    expect(rotatedLabelExtent(50, 10, -135)).toBeCloseTo(50);
  });
});

describe("rotatedLabelFootprint", () => {
  it("caps tilted strip spacing at the label's own horizontal span", () => {
    expect(rotatedLabelFootprint(20, 10, 0)).toBeCloseTo(24);
    expect(rotatedLabelFootprint(20, 10, -5)).toBeLessThan(30);
    expect(rotatedLabelFootprint(80, 10, -45)).toBeCloseTo(12 * Math.SQRT2);
    expect(rotatedLabelFootprint(80, 10, -90)).toBeCloseTo(12);
  });
});

describe("normalizeLabelAngle", () => {
  it("keeps angles within a quarter turn and flips upside-down ones", () => {
    expect(normalizeLabelAngle(-45)).toBe(-45);
    expect(normalizeLabelAngle(90)).toBe(90);
    expect(normalizeLabelAngle(-90)).toBe(-90);
    expect(normalizeLabelAngle(270)).toBe(-90);
    expect(normalizeLabelAngle(315)).toBe(-45);
    expect(normalizeLabelAngle(135)).toBe(-45);
    expect(normalizeLabelAngle(-135)).toBe(45);
    expect(normalizeLabelAngle(180)).toBe(0);
    expect(normalizeLabelAngle(NaN)).toBe(0);
  });
});

describe("label reach", () => {
  it("is half the width flat and the projection when tilted", () => {
    expect(labelReach(100, 10, 0)).toBe(50);
    expect(labelReach(100, 10, -90)).toBeCloseTo(5);
    expect(labelReach(100, 10, -45)).toBeCloseTo(105 * Math.SQRT1_2);
  });

  it("inverts to the widest label a reach or an extent allows", () => {
    for (const angle of [0, -30, 45]) {
      const reach = labelReach(80, 12, angle);
      expect(labelWidthForReach(reach, 12, angle)).toBeCloseTo(80);
    }
    expect(labelWidthForReach(10, 12, -90)).toBe(Infinity);
    expect(labelWidthForExtent(40, 12, 0)).toBe(Infinity);
    const extent = rotatedLabelExtent(80, 12, -60);
    expect(labelWidthForExtent(extent, 12, -60)).toBeCloseTo(80);
    expect(labelWidthForExtent(2, 12, -45)).toBe(0);
  });
});

describe("columnLabelSidePadding", () => {
  const shared = { fontSize: 10, pitch: 40, leftRoom: 20, rightRoom: 10 };

  // Padding pulls a tick half a column from the edge inward by 1/6 of it.
  const edgeShare = 1 - 0.5 / 3;

  it("pads the side tilted labels reach toward until they fit", () => {
    const widths = [100, 20, 100];
    const reach = labelReach(100, 10, -45);
    const left = columnLabelSidePadding({
      ...shared,
      widths,
      angle: -45,
      side: "left",
    });
    // The first column's tick sits 20 + 40 / 2 px from the left edge.
    expect(left.left).toBeCloseTo((reach - 40) / edgeShare);
    expect(left.right).toBe(0);
    const right = columnLabelSidePadding({
      ...shared,
      widths,
      angle: -45,
      side: "right",
    });
    expect(right.left).toBe(0);
    expect(right.right).toBeCloseTo((reach - 30) / edgeShare);
  });

  it("is zero when the labels fit and two-sided when they are flat", () => {
    expect(
      columnLabelSidePadding({
        ...shared,
        widths: [30, 30],
        angle: -90,
        side: "left",
      }),
    ).toEqual({ left: 0, right: 0 });
    const flat = columnLabelSidePadding({
      ...shared,
      widths: [120, 120],
      angle: 0,
      side: "left",
    });
    expect(flat.left).toBeCloseTo(20 / 0.75);
    expect(flat.right).toBeCloseTo(30 / 0.75);
  });
});

describe("truncateLabel", () => {
  const measure = (s: string) => s.length * 6;
  it("keeps labels that fit and shortens wider ones with an ellipsis", () => {
    expect(truncateLabel("Arizona", 50, measure)).toBe("Arizona");
    expect(truncateLabel("North Carolina", 36, measure)).toBe("North…");
    expect(truncateLabel("North Carolina", 4, measure)).toBe("…");
  });
});

describe("moveCell", () => {
  it("moves with the arrows and clamps at the grid edges", () => {
    expect(moveCell({ row: 0, column: 0 }, "ArrowRight", 2, 3, false)).toEqual({
      row: 0,
      column: 1,
    });
    expect(moveCell({ row: 0, column: 2 }, "ArrowRight", 2, 3, false)).toEqual({
      row: 0,
      column: 2,
    });
    expect(moveCell({ row: 1, column: 1 }, "ArrowDown", 2, 3, false)).toEqual({
      row: 1,
      column: 1,
    });
    expect(moveCell({ row: 1, column: 1 }, "ArrowUp", 2, 3, false)).toEqual({
      row: 0,
      column: 1,
    });
  });

  it("reaches the row label column at -1 only when row labels are shown", () => {
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
  });

  it("ignores other keys", () => {
    expect(moveCell({ row: 0, column: 0 }, "Enter", 2, 3, true)).toBeNull();
  });
});
