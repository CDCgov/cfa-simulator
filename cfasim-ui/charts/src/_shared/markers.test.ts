import { describe, it, expect } from "vitest";
import { layoutMarkerLabels, markerDashArray } from "./markers.js";

const bounds = { left: 50, right: 550 };

describe("layoutMarkerLabels", () => {
  it("places non-colliding labels on row 0, left edge aligned over the line", () => {
    const placements = layoutMarkerLabels(
      [
        { x: 100, width: 60 },
        { x: 300, width: 60 },
      ],
      bounds,
    );
    expect(placements).toEqual([
      { x: 100, anchor: "start", row: 0 },
      { x: 300, anchor: "start", row: 0 },
    ]);
  });

  it("offsets the label from the line by pad on its anchored side", () => {
    const placements = layoutMarkerLabels([{ x: 100, width: 60 }], bounds, {
      pad: 5,
    });
    expect(placements[0]).toEqual({ x: 105, anchor: "start", row: 0 });
  });

  it("moves a colliding label down to the next row", () => {
    const placements = layoutMarkerLabels(
      [
        { x: 100, width: 80 },
        { x: 140, width: 80 },
      ],
      bounds,
    );
    expect(placements[0].row).toBe(0);
    expect(placements[1].row).toBe(1);
  });

  it("stacks three mutually colliding labels on three rows", () => {
    const placements = layoutMarkerLabels(
      [
        { x: 100, width: 80 },
        { x: 110, width: 80 },
        { x: 120, width: 80 },
      ],
      bounds,
    );
    expect(placements.map((p) => p.row).sort()).toEqual([0, 1, 2]);
  });

  it("reuses row 0 once there is enough horizontal room", () => {
    const placements = layoutMarkerLabels(
      [
        { x: 100, width: 60 },
        { x: 120, width: 60 },
        { x: 400, width: 60 },
      ],
      bounds,
    );
    expect(placements[0].row).toBe(0);
    expect(placements[1].row).toBe(1);
    expect(placements[2].row).toBe(0);
  });

  it("flips a label to the left side when it would overflow the right bound", () => {
    const placements = layoutMarkerLabels([{ x: 540, width: 80 }], bounds);
    expect(placements[0]).toEqual({ x: 540, anchor: "end", row: 0 });
  });

  it("keeps the start anchor when a flip would overflow the left bound", () => {
    const tight = { left: 0, right: 100 };
    const placements = layoutMarkerLabels([{ x: 60, width: 80 }], tight);
    expect(placements[0].anchor).toBe("start");
  });

  it("detects collisions between a flipped label and an earlier one", () => {
    const placements = layoutMarkerLabels(
      [
        { x: 400, width: 80 },
        { x: 540, width: 100 },
      ],
      bounds,
    );
    // The second label flips left (would overflow right) and its span
    // [440, 540] overlaps the first label's span [400, 480].
    expect(placements[1].anchor).toBe("end");
    expect(placements[1].row).toBe(1);
  });

  it("returns placements in input order regardless of x order", () => {
    const placements = layoutMarkerLabels(
      [
        { x: 300, width: 60 },
        { x: 100, width: 60 },
      ],
      bounds,
    );
    expect(placements[0].x).toBe(300);
    expect(placements[1].x).toBe(100);
    expect(placements.map((p) => p.row)).toEqual([0, 0]);
  });
});

describe("markerDashArray", () => {
  it("defaults to a dashed pattern", () => {
    expect(markerDashArray({ x: 0 })).toBe("4 4");
  });

  it("returns undefined for solid lines", () => {
    expect(markerDashArray({ x: 0, dashed: false })).toBeUndefined();
  });

  it("accepts string, number, and array dash overrides", () => {
    expect(markerDashArray({ x: 0, dash: "2 6" })).toBe("2 6");
    expect(markerDashArray({ x: 0, dash: 3 })).toBe("3");
    expect(markerDashArray({ x: 0, dash: [8, 2, 1, 2] })).toBe("8 2 1 2");
    // dash wins over dashed: false
    expect(markerDashArray({ x: 0, dash: "2 6", dashed: false })).toBe("2 6");
  });
});
