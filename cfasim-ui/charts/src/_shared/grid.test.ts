import { describe, it, expect } from "vitest";
import { resolveGridStyle, gridDash, GRID_DEFAULTS } from "./grid.js";

describe("resolveGridStyle", () => {
  it("returns null when the grid is off", () => {
    expect(resolveGridStyle(undefined, undefined)).toBeNull();
    expect(resolveGridStyle(false, undefined)).toBeNull();
    expect(resolveGridStyle(false, { color: "red" })).toBeNull();
  });

  it("falls back to the defaults for `true`", () => {
    expect(resolveGridStyle(true, undefined)).toEqual({
      color: GRID_DEFAULTS.color,
      opacity: GRID_DEFAULTS.opacity,
      lineWidth: GRID_DEFAULTS.lineWidth,
      lineDash: undefined,
      lineCap: "butt",
    });
  });

  it("applies the chart-level style under `true`", () => {
    const s = resolveGridStyle(true, { color: "#ccc", lineStyle: "dashed" });
    expect(s?.color).toBe("#ccc");
    expect(s?.lineDash).toBe("4 4");
  });

  it("lets the axis style win field by field", () => {
    const s = resolveGridStyle(
      { opacity: 0.5, lineWidth: 2 },
      { color: "#ccc", opacity: 0.2, lineStyle: "dotted" },
    );
    expect(s).toEqual({
      color: "#ccc",
      opacity: 0.5,
      lineWidth: 2,
      lineDash: "0 6",
      lineCap: "round",
    });
  });
});

describe("gridDash", () => {
  it("scales named patterns with the line width", () => {
    expect(gridDash("dashed", undefined, 2)).toEqual({
      lineDash: "8 8",
      lineCap: "butt",
    });
    expect(gridDash("dotted", undefined, 1)).toEqual({
      lineDash: "0 3",
      lineCap: "round",
    });
    expect(gridDash("solid", undefined, 1)).toEqual({
      lineDash: undefined,
      lineCap: "butt",
    });
  });

  it("prefers an explicit lineDash over lineStyle", () => {
    expect(gridDash("dotted", "2 6", 1).lineDash).toBe("2 6");
    expect(gridDash("dotted", 3, 1).lineDash).toBe("3 3");
    expect(gridDash("dotted", [1, 2, 3], 1).lineDash).toBe("1 2 3");
    expect(gridDash("dotted", 3, 1).lineCap).toBe("butt");
  });
});
