import { describe, it, expect } from "vitest";
import {
  layoutColorScaleLegend,
  RAMP_GAP,
  RAMP_WIDTH,
} from "./colorScaleLegend.js";

// 6px per character.
const textWidth = (text: string) => text.length * 6;

describe("layoutColorScaleLegend", () => {
  it("has no middle label unless one is given", () => {
    const layout = layoutColorScaleLegend("Score", "0", "1", textWidth);
    expect(layout.mid).toBeUndefined();
    expect(layout.width).toBe(layout.maxX + 6);
  });

  it("centers the middle label under the ramp", () => {
    const layout = layoutColorScaleLegend(
      undefined,
      "-8.2%",
      "+8.2%",
      textWidth,
      {
        mid: "0%",
      },
    );
    expect(layout.rampX).toBe(30 + RAMP_GAP);
    expect(layout.midX).toBe(layout.rampX + RAMP_WIDTH / 2);
    expect(layout.width).toBe(layout.maxX + 30);
  });

  it("widens the item for a middle label longer than the ramp", () => {
    const mid = "x".repeat(40);
    const layout = layoutColorScaleLegend(undefined, "a", "b", textWidth, {
      mid,
    });
    expect(layout.width).toBe(layout.midX! + 120);
  });
});
