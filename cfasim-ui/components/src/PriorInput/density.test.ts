import { describe, expect, it } from "vitest";
import { densityCurve, erf, lgamma, pdf, plotRange } from "./density";
import { NUMPYRO_DISTRIBUTIONS, defaultPrior } from "./distributions";

function integrate(
  fn: (x: number) => number,
  lo: number,
  hi: number,
  steps = 4000,
) {
  const width = (hi - lo) / steps;
  let sum = 0.5 * (fn(lo) + fn(hi));
  for (let i = 1; i < steps; i++) sum += fn(lo + i * width);
  return sum * width;
}

describe("density", () => {
  it("computes lgamma (including reflection) and erf accurately", () => {
    expect(Math.exp(lgamma(5))).toBeCloseTo(24, 8);
    expect(Math.exp(lgamma(0.5))).toBeCloseTo(Math.sqrt(Math.PI), 8);
    expect(erf(1)).toBeCloseTo(0.8427007929, 6);
    expect(erf(-1)).toBeCloseTo(-0.8427007929, 6);
  });

  it("integrates every preset family to ~1 over its plot range", () => {
    for (const descriptor of NUMPYRO_DISTRIBUTIONS) {
      const { family, params } = defaultPrior(descriptor);
      const [lo, hi] = plotRange(family, params)!;
      const mass = integrate((x) => pdf(family, params, x)!, lo, hi);
      const floor = /Cauchy|StudentT|InverseGamma/.test(family) ? 0.8 : 0.98;
      expect(mass, family).toBeGreaterThan(floor);
      expect(mass, family).toBeLessThan(1.01);
    }
    expect(pdf("Mystery", {}, 0)).toBeUndefined();
  });

  it("samples finite density curves and rejects degenerate or unknown specs", () => {
    for (const descriptor of NUMPYRO_DISTRIBUTIONS) {
      expect(
        densityCurve(defaultPrior(descriptor)),
        descriptor.family,
      ).toBeDefined();
    }
    // Unbounded endpoint guards for concentration < 1.
    expect(
      densityCurve({
        family: "Beta",
        params: { concentration1: 0.5, concentration0: 0.5 },
      }),
    ).toBeDefined();
    expect(
      densityCurve({
        family: "Gamma",
        params: { concentration: 0.5, rate: 1 },
      }),
    ).toBeDefined();

    expect(densityCurve({ family: "Mystery", params: {} })).toBeUndefined();
    expect(
      densityCurve({ family: "Normal", params: { loc: 0, scale: 0 } }),
    ).toBeUndefined();
    expect(
      densityCurve({ family: "Uniform", params: { low: 1, high: 1 } }),
    ).toBeUndefined();
  });
});
