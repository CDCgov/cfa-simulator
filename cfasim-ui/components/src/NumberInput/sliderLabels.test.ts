import { describe, expect, it } from "vitest";
import { layoutSliderLabels } from "./sliderLabels";

describe("layoutSliderLabels", () => {
  it("centers labels that do not collide", () => {
    expect(
      layoutSliderLabels(
        [
          { center: 100, width: 40 },
          { center: 200, width: 40 },
        ],
        300,
      ),
    ).toEqual([
      { left: 80, row: 0 },
      { left: 180, row: 0 },
    ]);
  });

  it("keeps labels inside the container", () => {
    expect(layoutSliderLabels([{ center: 5, width: 60 }], 300)).toEqual([
      { left: 0, row: 0 },
    ]);
    expect(layoutSliderLabels([{ center: 295, width: 60 }], 300)).toEqual([
      { left: 240, row: 0 },
    ]);
  });

  it("spreads colliding labels apart symmetrically", () => {
    const [a, b] = layoutSliderLabels(
      [
        { center: 140, width: 40 },
        { center: 170, width: 40 },
      ],
      300,
      { gap: 6 },
    );
    expect(a.row).toBe(0);
    expect(b.row).toBe(0);
    expect(b.left - (a.left + 40)).toBeCloseTo(6);
    expect(140 - (a.left + 20)).toBeCloseTo(b.left + 20 - 170);
  });

  it("moves a label up a row when edge alignment is not enough", () => {
    const out = layoutSliderLabels(
      [
        { center: 150, width: 80 },
        { center: 154, width: 80 },
      ],
      300,
    );
    expect(out.map((p) => p.row)).toEqual([0, 1]);
    // Each label still spans its thumb.
    expect(out[0].left).toBeLessThanOrEqual(150);
    expect(out[0].left + 80).toBeGreaterThanOrEqual(150);
    expect(out[1].left).toBeLessThanOrEqual(154);
    expect(out[1].left + 80).toBeGreaterThanOrEqual(154);
  });

  it("alternates rows for a tight run and reuses row 0", () => {
    const out = layoutSliderLabels(
      [
        { center: 100, width: 60 },
        { center: 104, width: 60 },
        { center: 170, width: 60 },
      ],
      400,
    );
    expect(out.map((p) => p.row)).toEqual([0, 1, 0]);
  });

  it("reports placements in input order regardless of center order", () => {
    const out = layoutSliderLabels(
      [
        { center: 200, width: 40 },
        { center: 100, width: 40 },
      ],
      300,
    );
    expect(out).toEqual([
      { left: 180, row: 0 },
      { left: 80, row: 0 },
    ]);
  });
});

describe("layoutSliderLabels limits", () => {
  it("pins a label wider than the container to the left edge", () => {
    expect(layoutSliderLabels([{ center: 90, width: 130 }], 120)).toEqual([
      { left: 0, row: 0 },
    ]);
  });

  it("overlaps instead of adding a row past maxRows", () => {
    const labels = [
      { center: 150, width: 80 },
      { center: 154, width: 80 },
    ];
    expect(
      layoutSliderLabels(labels, 300, { maxRows: 1 }).map((p) => p.row),
    ).toEqual([0, 0]);
    expect(layoutSliderLabels(labels, 300, { maxRows: 1 })[1].left).toBe(114);
  });
});
