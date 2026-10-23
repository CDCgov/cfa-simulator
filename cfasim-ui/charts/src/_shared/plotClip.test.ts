import { describe, it, expect } from "vitest";
import { plotClipRect, PLOT_CLIP_OVERHANG } from "./plotClip.js";

describe("plotClipRect", () => {
  const padding = { top: 10, left: 50 };

  it("covers exactly the plot when every edge cuts through data", () => {
    expect(plotClipRect(padding, 540, 260)).toEqual({
      x: 50,
      y: 10,
      width: 540,
      height: 260,
    });
    expect(
      plotClipRect(padding, 540, 260, {
        top: false,
        right: false,
        bottom: false,
        left: false,
      }),
    ).toEqual({ x: 50, y: 10, width: 540, height: 260 });
  });

  it("extends only the open edges by the overhang", () => {
    expect(plotClipRect(padding, 540, 260, { bottom: true })).toEqual({
      x: 50,
      y: 10,
      width: 540,
      height: 260 + PLOT_CLIP_OVERHANG,
    });
    expect(plotClipRect(padding, 540, 260, { top: true, left: true })).toEqual({
      x: 50 - PLOT_CLIP_OVERHANG,
      y: 10 - PLOT_CLIP_OVERHANG,
      width: 540 + PLOT_CLIP_OVERHANG,
      height: 260 + PLOT_CLIP_OVERHANG,
    });
  });

  it("takes a custom overhang", () => {
    expect(
      plotClipRect(padding, 540, 260, { right: true, bottom: true }, 5),
    ).toEqual({ x: 50, y: 10, width: 545, height: 265 });
  });
});
