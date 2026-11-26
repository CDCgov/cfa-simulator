import { describe, expect, it } from "vitest";
import { layoutSliderLabels } from "./sliderLabels";

describe("layoutSliderLabels", () => {
  it("clamps labels inside the container and preserves input order", () => {
    expect(
      layoutSliderLabels(
        [
          { center: 295, width: 60 },
          { center: 5, width: 60 },
        ],
        300,
      ),
    ).toEqual([
      { left: 240, row: 0 },
      { left: 0, row: 0 },
    ]);
  });

  it("spreads colliding labels symmetrically", () => {
    const [first, second] = layoutSliderLabels(
      [
        { center: 140, width: 40 },
        { center: 170, width: 40 },
      ],
      300,
      { gap: 6 },
    );
    expect([first.row, second.row]).toEqual([0, 0]);
    expect(second.left - (first.left + 40)).toBeCloseTo(6);
  });

  it("stacks tight collisions into rows and respects maxRows", () => {
    const tight = [
      { center: 100, width: 60 },
      { center: 104, width: 60 },
      { center: 170, width: 60 },
    ];
    expect(layoutSliderLabels(tight, 400).map((item) => item.row)).toEqual([
      0, 1, 0,
    ]);
    expect(
      layoutSliderLabels(tight.slice(0, 2), 300, { maxRows: 1 }).map(
        (item) => item.row,
      ),
    ).toEqual([0, 0]);
  });
});
