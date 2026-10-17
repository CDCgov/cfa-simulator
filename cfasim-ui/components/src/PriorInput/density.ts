import type { PriorSpec } from "./distributions";

// Lanczos approximation, g = 7, n = 9.
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** Natural log of the gamma function. */
export function lgamma(x: number): number {
  if (x < 0.5) {
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  }
  x -= 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < LANCZOS.length; i++) a += LANCZOS[i] / (x + i);
  return (
    0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
  );
}

/** Error function, Abramowitz and Stegun 7.1.26 (abs error < 1.5e-7). */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const poly =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
    t;
  return sign * (1 - poly * Math.exp(-x * x));
}

const SQRT_2PI = Math.sqrt(2 * Math.PI);

function normalPdf(x: number, loc: number, scale: number): number {
  const z = (x - loc) / scale;
  return Math.exp(-0.5 * z * z) / (scale * SQRT_2PI);
}

function normalCdf(x: number, loc: number, scale: number): number {
  return 0.5 * (1 + erf((x - loc) / (scale * Math.SQRT2)));
}

// Power-law edge x^(a-1) at x = 0: finite only when a >= 1.
function edge(a: number, finite: number): number {
  if (a > 1) return 0;
  if (a === 1) return finite;
  return Infinity;
}

/**
 * Density of a numpyro family at `x`, or `undefined` for a family this
 * module does not know. Invalid parameters yield NaN or Infinity.
 */
export function pdf(
  family: string,
  p: Record<string, number>,
  x: number,
): number | undefined {
  switch (family) {
    case "Normal":
      return normalPdf(x, p.loc, p.scale);
    case "LogNormal": {
      if (x <= 0) return 0;
      const z = (Math.log(x) - p.loc) / p.scale;
      return Math.exp(-0.5 * z * z) / (x * p.scale * SQRT_2PI);
    }
    case "HalfNormal":
      return x < 0 ? 0 : 2 * normalPdf(x, 0, p.scale);
    case "Uniform":
      return x < p.low || x > p.high ? 0 : 1 / (p.high - p.low);
    case "Gamma": {
      const a = p.concentration;
      const b = p.rate;
      if (x < 0) return 0;
      if (x === 0) return edge(a, b);
      return Math.exp(
        a * Math.log(b) + (a - 1) * Math.log(x) - b * x - lgamma(a),
      );
    }
    case "Beta": {
      const a = p.concentration1;
      const b = p.concentration0;
      if (x < 0 || x > 1) return 0;
      const norm = lgamma(a + b) - lgamma(a) - lgamma(b);
      if (x === 0) return edge(a, Math.exp(norm));
      if (x === 1) return edge(b, Math.exp(norm));
      return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) + norm);
    }
    case "Exponential":
      return x < 0 ? 0 : p.rate * Math.exp(-p.rate * x);
    case "TruncatedNormal": {
      if (x < p.low || x > p.high) return 0;
      const mass =
        normalCdf(p.high, p.loc, p.scale) - normalCdf(p.low, p.loc, p.scale);
      return normalPdf(x, p.loc, p.scale) / mass;
    }
    case "Cauchy": {
      const z = (x - p.loc) / p.scale;
      return 1 / (Math.PI * p.scale * (1 + z * z));
    }
    case "HalfCauchy": {
      if (x < 0) return 0;
      const z = x / p.scale;
      return 2 / (Math.PI * p.scale * (1 + z * z));
    }
    case "StudentT": {
      const v = p.df;
      const z = (x - p.loc) / p.scale;
      const logNorm =
        lgamma((v + 1) / 2) -
        lgamma(v / 2) -
        0.5 * Math.log(v * Math.PI) -
        Math.log(p.scale);
      return Math.exp(logNorm - ((v + 1) / 2) * Math.log(1 + (z * z) / v));
    }
    case "InverseGamma": {
      const a = p.concentration;
      const b = p.rate;
      if (x <= 0) return 0;
      return Math.exp(
        a * Math.log(b) - (a + 1) * Math.log(x) - b / x - lgamma(a),
      );
    }
    default:
      return undefined;
  }
}

/** The x interval worth drawing for a family, or `undefined` if unknown. */
export function plotRange(
  family: string,
  p: Record<string, number>,
): [number, number] | undefined {
  switch (family) {
    case "Normal":
      return [p.loc - 4 * p.scale, p.loc + 4 * p.scale];
    case "LogNormal":
      return [0, Math.exp(p.loc + 2.5 * p.scale)];
    case "HalfNormal":
      return [0, 4 * p.scale];
    case "Uniform": {
      const pad = 0.1 * (p.high - p.low);
      return [p.low - pad, p.high + pad];
    }
    case "Gamma": {
      const a = p.concentration;
      const hi = (a + 4 * Math.sqrt(a)) / p.rate;
      // The density is unbounded at 0 when a < 1; start just inside.
      return [a < 1 ? hi / 100 : 0, hi];
    }
    case "Beta":
      return [p.concentration1 < 1 ? 0.01 : 0, p.concentration0 < 1 ? 0.99 : 1];
    case "Exponential":
      return [0, 5 / p.rate];
    case "TruncatedNormal":
      return [p.low, p.high];
    case "Cauchy":
      return [p.loc - 6 * p.scale, p.loc + 6 * p.scale];
    case "HalfCauchy":
      return [0, 8 * p.scale];
    case "StudentT":
      return [p.loc - 5 * p.scale, p.loc + 5 * p.scale];
    case "InverseGamma":
      return [0, (4 * p.rate) / Math.max(p.concentration - 1, 0.5)];
    default:
      return undefined;
  }
}

/**
 * Sample the density on `n` evenly spaced points across `plotRange`.
 * Returns `undefined` for unknown families, degenerate ranges, or when any
 * sampled value is not finite (e.g. a zero scale).
 */
export function densityCurve(
  spec: PriorSpec,
  n = 64,
): { xs: Float64Array; ys: Float64Array } | undefined {
  const range = plotRange(spec.family, spec.params);
  if (!range) return undefined;
  const [lo, hi] = range;
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || !(hi > lo)) {
    return undefined;
  }
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const x = lo + ((hi - lo) * i) / (n - 1);
    const y = pdf(spec.family, spec.params, x);
    if (y === undefined || !Number.isFinite(y)) return undefined;
    xs[i] = x;
    ys[i] = y;
  }
  return { xs, ys };
}
