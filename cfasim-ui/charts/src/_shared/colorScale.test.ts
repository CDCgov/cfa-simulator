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

describe("colorScale", () => {
  it("computes domain, explicit sort, single-value widening, and piecewise position", () => {
    expect(
      colorScaleDomain([3, [1, NaN, 7], undefined, new Float64Array([-2])]),
    ).toEqual([-2, 7]);
    expect(colorScaleDomain([[1, 2]], [10, 0, 5])).toEqual([0, 5, 10]);
    expect(colorScaleDomain([4])).toEqual([3, 5]);
    expect(colorScaleDomain([undefined, [NaN]])).toBeNull();

    const domain = [-10, 0, 1];
    expect(domainPosition(domain, -5)).toBe(0.25);
    expect(domainPosition(domain, 0.5)).toBe(0.75);
    expect(domainPosition(domain, 99)).toBe(1);
    expect(domainPosition(domain, NaN)).toBeNaN();
  });

  it("interpolates in Oklab, falls back to color-mix for CSS vars, and samples ramps", () => {
    expect(oklabToRgb(rgbToOklab([59, 82, 139]))).toEqual([59, 82, 139]);

    const bw = colorInterpolator(["#000000", "#ffffff"]);
    expect(bw(0)).toBe("#000000");
    expect(bw(1)).toBe("#ffffff");
    expect(bw(NaN)).toBeUndefined();
    const [red] = bw(0.5)!.slice(4, -1).split(", ").map(Number);
    expect(red).toBeGreaterThan(90);
    expect(red).toBeLessThan(128);

    expect(colorInterpolator(["var(--a)", "#fff"])(0.25)).toBe(
      "color-mix(in oklab, var(--a) 75%, #fff)",
    );

    const diverging = colorScaleFn(
      ["#0000ff", "#ffffff", "#ff0000"],
      [-1, 0, 4],
    );
    expect([diverging(-1), diverging(0), diverging(4), diverging(NaN)]).toEqual(
      ["#0000ff", "#ffffff", "#ff0000", undefined],
    );

    const stops = colorRampStops(["#000000", "#ffffff"], 3);
    expect(stops.map((stop) => stop.offset)).toEqual([0, 0.5, 1]);
  });

  it("builds lineColorGradient stops for linear and step curves", () => {
    const points = [
      { x: 20, color: "b" },
      { x: 0, color: "a" },
      { x: 40, color: undefined },
      { x: 40, color: "c" },
    ];
    expect(lineColorGradient(points, "linear")).toEqual({
      x1: 0,
      x2: 40,
      stops: [
        { offset: 0, color: "a" },
        { offset: 0.5, color: "b" },
        { offset: 1, color: "c" },
      ],
    });
    expect(
      lineColorGradient(points, "step-after")!.stops.map(
        (s) => `${s.offset}${s.color}`,
      ),
    ).toEqual(["0a", "0.5a", "0.5b", "1b", "1c"]);
    expect(lineColorGradient([{ x: 1, color: "a" }], undefined)).toBeNull();
  });
});
