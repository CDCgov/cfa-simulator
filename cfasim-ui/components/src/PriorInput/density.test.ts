import { describe, expect, it } from "vitest";
import { densityCurve, erf, lgamma, pdf, plotRange } from "./density";
import { NUMPYRO_DISTRIBUTIONS, defaultPrior } from "./distributions";

// Trapezoid rule over [lo, hi].
function integrate(f: (x: number) => number, lo: number, hi: number, n = 4000) {
  const h = (hi - lo) / n;
  let sum = 0.5 * (f(lo) + f(hi));
  for (let i = 1; i < n; i++) sum += f(lo + i * h);
  return sum * h;
}

describe("lgamma", () => {
  it("recovers Γ(5) = 24", () => {
    expect(Math.exp(lgamma(5))).toBeCloseTo(24, 8);
  });

  it("recovers Γ(0.5) = √π through the reflection branch", () => {
    expect(Math.exp(lgamma(0.5))).toBeCloseTo(Math.sqrt(Math.PI), 8);
    expect(Math.exp(lgamma(0.25))).toBeCloseTo(3.6256099082, 6);
  });
});

describe("erf", () => {
  it("is odd and bounded", () => {
    expect(erf(0)).toBeCloseTo(0, 8);
    expect(erf(1)).toBeCloseTo(0.8427007929, 6);
    expect(erf(-1)).toBeCloseTo(-0.8427007929, 6);
    expect(erf(6)).toBeCloseTo(1, 7);
  });
});

describe("pdf", () => {
  it("Normal(0, 1) at 0 is 1/√(2π)", () => {
    expect(pdf("Normal", { loc: 0, scale: 1 }, 0)).toBeCloseTo(0.39894, 5);
  });

  it("Uniform is flat inside and zero outside", () => {
    const p = { low: 2, high: 6 };
    expect(pdf("Uniform", p, 3)).toBeCloseTo(0.25);
    expect(pdf("Uniform", p, 1)).toBe(0);
    expect(pdf("Uniform", p, 7)).toBe(0);
  });

  it("Gamma(2, 1) matches x e^-x", () => {
    expect(pdf("Gamma", { concentration: 2, rate: 1 }, 1.5)).toBeCloseTo(
      1.5 * Math.exp(-1.5),
      10,
    );
  });

  it("Beta(2, 2) is 6x(1-x)", () => {
    expect(
      pdf("Beta", { concentration1: 2, concentration0: 2 }, 0.3),
    ).toBeCloseTo(6 * 0.3 * 0.7, 10);
  });

  it("TruncatedNormal integrates to one over its bounds", () => {
    const p = { loc: 0, scale: 1, low: -2, high: 2 };
    const mass = integrate((x) => pdf("TruncatedNormal", p, x)!, -2, 2);
    expect(mass).toBeCloseTo(1, 4);
    expect(pdf("TruncatedNormal", p, 2.5)).toBe(0);
  });

  it("every preset family integrates to about one over its plot range", () => {
    for (const d of NUMPYRO_DISTRIBUTIONS) {
      const { family, params } = defaultPrior(d);
      const [lo, hi] = plotRange(family, params)!;
      const mass = integrate((x) => pdf(family, params, x)!, lo, hi);
      // Heavy-tailed families lose mass past the plot window.
      const floor = /Cauchy|StudentT|InverseGamma/.test(family) ? 0.8 : 0.98;
      expect(mass, family).toBeGreaterThan(floor);
      expect(mass, family).toBeLessThan(1.01);
    }
  });

  it("returns undefined for an unknown family", () => {
    expect(pdf("Mystery", {}, 0)).toBeUndefined();
  });
});

describe("densityCurve", () => {
  it("samples n points across the plot range", () => {
    const curve = densityCurve(
      { family: "Normal", params: { loc: 1, scale: 2 } },
      5,
    )!;
    expect(Array.from(curve.xs)).toEqual([-7, -3, 1, 5, 9]);
    expect(curve.ys[2]).toBeCloseTo(pdf("Normal", { loc: 1, scale: 2 }, 1)!);
  });

  it("stays finite for every preset default", () => {
    for (const d of NUMPYRO_DISTRIBUTIONS) {
      expect(densityCurve(defaultPrior(d)), d.family).toBeDefined();
    }
  });

  it("avoids the unbounded endpoints of Beta and Gamma", () => {
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
  });

  it("returns undefined for unknown families and degenerate params", () => {
    expect(densityCurve({ family: "Mystery", params: {} })).toBeUndefined();
    expect(
      densityCurve({ family: "Normal", params: { loc: 0, scale: 0 } }),
    ).toBeUndefined();
    expect(
      densityCurve({ family: "Uniform", params: { low: 1, high: 1 } }),
    ).toBeUndefined();
  });
});
