import { describe, expect, it } from "vitest";
import {
  colorInterpolator,
  colorRampStops,
  colorScaleDomain,
  colorScaleFn,
  domainPosition,
  lineColorGradient,
  oklabToRgb,
  rgbToOklab,
} from "./colorScale.js";

describe("colorScaleDomain", () => {
  it("spans every finite value across scalars and arrays", () => {
    expect(
      colorScaleDomain([3, [1, NaN, 7], undefined, new Float64Array([-2])]),
    ).toEqual([-2, 7]);
  });

  it("prefers an explicit domain and sorts it", () => {
    expect(colorScaleDomain([[1, 2]], [10, 0, 5])).toEqual([0, 5, 10]);
  });

  it("widens a single value and returns null with no values", () => {
    expect(colorScaleDomain([4])).toEqual([3, 5]);
    expect(colorScaleDomain([undefined, [NaN]])).toBeNull();
  });
});

describe("domainPosition", () => {
  it("places piecewise domain values at even positions and clamps", () => {
    const d = [-10, 0, 1];
    expect(domainPosition(d, -10)).toBe(0);
    expect(domainPosition(d, -5)).toBe(0.25);
    expect(domainPosition(d, 0)).toBe(0.5);
    expect(domainPosition(d, 0.5)).toBe(0.75);
    expect(domainPosition(d, 99)).toBe(1);
    expect(domainPosition(d, NaN)).toBeNaN();
  });
});

describe("colorInterpolator", () => {
  it("round-trips sRGB through Oklab", () => {
    for (const c of [
      [0, 0, 0],
      [255, 255, 255],
      [59, 82, 139],
      [253, 231, 37],
    ] as const) {
      expect(oklabToRgb(rgbToOklab([...c]))).toEqual([...c]);
    }
  });

  it("returns stops exactly at their positions and mixes in Oklab between", () => {
    const at = colorInterpolator(["#000000", "#ffffff"]);
    expect(at(0)).toBe("#000000");
    expect(at(1)).toBe("#ffffff");
    expect(at(-1)).toBe("#000000");
    // Oklab mid-gray is lighter than the sRGB midpoint (128).
    const [r] = at(0.5)!.slice(4, -1).split(", ").map(Number);
    expect(r).toBeGreaterThan(90);
    expect(r).toBeLessThan(128);
    expect(at(NaN)).toBeUndefined();
  });

  it("falls back to color-mix for colors it cannot parse", () => {
    const at = colorInterpolator(["var(--a)", "#fff"]);
    expect(at(0.25)).toBe("color-mix(in oklab, var(--a) 75%, #fff)");
  });

  it("maps values through a diverging piecewise domain", () => {
    const f = colorScaleFn(["#0000ff", "#ffffff", "#ff0000"], [-1, 0, 4]);
    expect(f(-1)).toBe("#0000ff");
    expect(f(0)).toBe("#ffffff");
    expect(f(4)).toBe("#ff0000");
    expect(f(NaN)).toBeUndefined();
  });

  it("samples the ramp from the interpolator", () => {
    const stops = colorRampStops(["#000000", "#ffffff"], 3);
    expect(stops.map((s) => s.offset)).toEqual([0, 0.5, 1]);
    expect(stops[1].color).toBe(colorInterpolator(["#000000", "#ffffff"])(0.5));
  });
});

describe("lineColorGradient", () => {
  const pts = [
    { x: 20, color: "b" },
    { x: 0, color: "a" },
    { x: 40, color: undefined },
    { x: 40, color: "c" },
  ];

  it("puts one stop per colored point, sorted by x", () => {
    expect(lineColorGradient(pts, "linear")).toEqual({
      x1: 0,
      x2: 40,
      stops: [
        { offset: 0, color: "a" },
        { offset: 0.5, color: "b" },
        { offset: 1, color: "c" },
      ],
    });
  });

  it("switches color where each step curve changes value", () => {
    const offsets = (curve: "step" | "step-after" | "step-before") =>
      lineColorGradient(pts, curve)!.stops.map((s) => `${s.offset}${s.color}`);
    expect(offsets("step-after")).toEqual(["0a", "0.5a", "0.5b", "1b", "1c"]);
    expect(offsets("step-before")).toEqual([
      "0a",
      "0a",
      "0b",
      "0.5b",
      "0.5b",
      "0.5c",
      "1c",
    ]);
    expect(offsets("step")).toEqual([
      "0a",
      "0.25a",
      "0.25b",
      "0.5b",
      "0.75b",
      "0.75c",
      "1c",
    ]);
  });

  it("is null without two distinct colored x positions", () => {
    expect(lineColorGradient([{ x: 1, color: "a" }], undefined)).toBeNull();
    expect(
      lineColorGradient(
        [
          { x: 1, color: "a" },
          { x: 1, color: "b" },
        ],
        undefined,
      ),
    ).toBeNull();
  });
});
