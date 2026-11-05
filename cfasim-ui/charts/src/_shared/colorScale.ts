import { parseRgb, type Rgb } from "./contrast.js";
import type { LineCurve } from "./curve.js";

/**
 * Maps numbers to colors for a continuous color dimension (LineChart
 * series `colorValue`). The chart draws a gradient legend for it in the
 * inline legend row.
 */
export interface ColorScale {
  /**
   * Values the scale spans; values outside are clamped. `[min, max]`
   * spreads `range` evenly between them. More than two values make a
   * piecewise scale: the i-th value lands at the i-th of evenly spaced
   * positions along `range`, so `[-1, 0, 1]` with a three-color range
   * is a diverging scale centered on 0. Defaults to the extent of every
   * series' `colorValue`.
   */
  domain?: readonly number[];
  /**
   * Two or more colors spaced evenly along the scale and interpolated
   * in Oklab. Defaults to `SEQUENTIAL_COLORS` (viridis). Hex and `rgb()`
   * colors are interpolated in JS; anything else (`var()`, named colors)
   * goes through CSS `color-mix()`, so it follows the theme.
   */
  range?: readonly string[];
  /** Legend title, and the tooltip's name for the value. */
  label?: string;
  /** Formats the legend's end labels and the tooltip value. */
  format?: (value: number) => string;
  /** Show the gradient legend. Default true. */
  legend?: boolean;
}

/** Viridis, light enough at the top and dark enough at the bottom for both themes. */
export const SEQUENTIAL_COLORS: readonly string[] = [
  "#440154",
  "#3b528b",
  "#21918c",
  "#5ec962",
  "#fde725",
];

/**
 * The explicit `domain` (sorted ascending when it is not), else `[min,
 * max]` of every finite value. Null when there is nothing to scale. A
 * zero-width extent is widened by 1 either side so every value lands on
 * the middle color.
 */
export function colorScaleDomain(
  values: Iterable<number | ArrayLike<number> | undefined>,
  domain?: readonly number[],
): number[] | null {
  if (domain && domain.length >= 2 && domain.every(Number.isFinite)) {
    const d = [...domain];
    return d.every((v, i) => i === 0 || v >= d[i - 1])
      ? d
      : d.sort((a, b) => a - b);
  }
  let min = Infinity;
  let max = -Infinity;
  const add = (v: number) => {
    if (!Number.isFinite(v)) return;
    if (v < min) min = v;
    if (v > max) max = v;
  };
  for (const vals of values) {
    if (vals == null) continue;
    if (typeof vals === "number") add(vals);
    else
      for (let i = 0; i < vals.length; i++) {
        const v = vals[i];
        if (v != null && (v as unknown) !== "") add(Number(v));
      }
  }
  if (!Number.isFinite(min)) return null;
  return min === max ? [min - 1, max + 1] : [min, max];
}

type Lab = [number, number, number];

const toLinear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (c: number) => {
  const s = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, s)) * 255);
};

export function rgbToOklab([r, g, b]: Rgb): Lab {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
  );
  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
  );
  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
  );
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToRgb([L, a, b]: Lab): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/**
 * Color at `t` in 0..1 along evenly spaced `range` stops, mixed in Oklab.
 * `t` is clamped; NaN gives undefined.
 */
export function colorInterpolator(
  range: readonly string[],
): (t: number) => string | undefined {
  const stops = range.length > 0 ? range : SEQUENTIAL_COLORS;
  if (stops.length === 1) return (t) => (t === t ? stops[0] : undefined);
  const labs = stops.map((c) => {
    const rgb = parseRgb(c);
    return rgb ? rgbToOklab(rgb) : null;
  });
  const n = stops.length - 1;
  return (t) => {
    if (t !== t) return undefined;
    const u = Math.min(1, Math.max(0, t)) * n;
    const i = Math.min(n - 1, Math.floor(u));
    const f = u - i;
    if (f === 0) return stops[i];
    if (f === 1) return stops[i + 1];
    const a = labs[i];
    const b = labs[i + 1];
    if (!a || !b) {
      const pct = Math.round((1 - f) * 1000) / 10;
      return `color-mix(in oklab, ${stops[i]} ${pct}%, ${stops[i + 1]})`;
    }
    const rgb = oklabToRgb([
      a[0] + (b[0] - a[0]) * f,
      a[1] + (b[1] - a[1]) * f,
      a[2] + (b[2] - a[2]) * f,
    ]);
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  };
}

/**
 * Position 0..1 of `v` along a (piecewise) domain: the i-th domain value
 * sits at `i / (n - 1)`. Clamped outside the domain; NaN for non-finite.
 */
export function domainPosition(domain: readonly number[], v: number): number {
  if (!Number.isFinite(v)) return NaN;
  const n = domain.length - 1;
  if (v <= domain[0]) return 0;
  if (v >= domain[n]) return 1;
  let i = 0;
  while (i < n - 1 && v > domain[i + 1]) i++;
  const span = domain[i + 1] - domain[i];
  return (i + (span > 0 ? (v - domain[i]) / span : 0)) / n;
}

/** Value-to-color for a scale over `domain`. */
export function colorScaleFn(
  range: readonly string[] | undefined,
  domain: readonly number[],
): (value: number) => string | undefined {
  const at = colorInterpolator(range ?? SEQUENTIAL_COLORS);
  return (v) => at(domainPosition(domain, v));
}

/**
 * Stops for the legend ramp. SVG gradients mix in sRGB, so the ramp is
 * sampled from the Oklab interpolator rather than given only the range.
 */
export function colorRampStops(
  range: readonly string[] | undefined,
  samples = 9,
): { offset: number; color: string }[] {
  const at = colorInterpolator(range ?? SEQUENTIAL_COLORS);
  return Array.from({ length: samples }, (_, i) => {
    const t = i / (samples - 1);
    return { offset: t, color: at(t)! };
  });
}

export interface GradientStop {
  /** 0..1 along `x1`..`x2`. */
  offset: number;
  color: string;
}

/**
 * A horizontal gradient that colors a line by its points: one stop per
 * point, sorted by pixel x. Step curves get hard stops where the drawn
 * line changes value, so color changes with the step rather than fading
 * across it. Null when fewer than two points have a color, or they all
 * share one x (the caller draws a solid stroke instead).
 */
export function lineColorGradient(
  points: readonly { x: number; color: string | undefined }[],
  curve: LineCurve | undefined,
): { x1: number; x2: number; stops: GradientStop[] } | null {
  const pts = points
    .filter(
      (p): p is { x: number; color: string } =>
        p.color !== undefined && Number.isFinite(p.x),
    )
    .sort((a, b) => a.x - b.x);
  if (pts.length < 2) return null;
  const x1 = pts[0].x;
  const x2 = pts[pts.length - 1].x;
  if (x2 === x1) return null;
  const off = (x: number) => (x - x1) / (x2 - x1);
  const stops: GradientStop[] = [];
  const step =
    curve === "step" || curve === "step-before" || curve === "step-after";
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!step || i === 0) {
      stops.push({ offset: off(p.x), color: p.color });
      continue;
    }
    const prev = pts[i - 1];
    // Where the drawn value switches from prev to p.
    const at =
      curve === "step-after"
        ? p.x
        : curve === "step-before"
          ? prev.x
          : (prev.x + p.x) / 2;
    stops.push({ offset: off(at), color: prev.color });
    stops.push({ offset: off(at), color: p.color });
    if (at !== p.x) stops.push({ offset: off(p.x), color: p.color });
  }
  return { x1, x2, stops };
}
