/**
 * Linear and log scale helpers shared by chart components. The chart
 * computes a `[min, max]` data extent then maps values to pixels via
 * `scaleFraction`; log mode clamps `min` to a positive floor so we
 * never take `log10(0)` or `log10(-x)`.
 */

export type ScaleType = "linear" | "log";

/** Default floor used when a log-scale extent contains no positive data. */
export const LOG_FLOOR = 1;

/**
 * Project a value onto a [0, 1] fraction of the axis range. The caller
 * multiplies by the pixel range and adds the axis origin. On log
 * scales, non-positive values collapse to the visible minimum so they
 * sit on the axis floor instead of producing -Infinity.
 */
export function scaleFraction(
  v: number,
  min: number,
  max: number,
  type: ScaleType,
): number {
  if (type === "log") {
    const lmin = Math.log10(min);
    const lmax = Math.log10(max);
    const range = lmax - lmin || 1;
    const safe = v > 0 ? v : min;
    return (Math.log10(safe) - lmin) / range;
  }
  const range = max - min || 1;
  return (v - min) / range;
}

/** Inverse of `scaleFraction`: the value at a [0, 1] fraction of the axis. */
export function scaleInvert(
  frac: number,
  min: number,
  max: number,
  type: ScaleType,
): number {
  if (type === "log") {
    const lmin = Math.log10(min);
    return Math.pow(10, lmin + frac * (Math.log10(max) - lmin));
  }
  return min + frac * (max - min);
}

/**
 * Extent selected by brushing the fraction span `[f0, f1]` of `current`.
 * The result is never narrower than `1 / maxZoom` of `full`: past that,
 * tick spacing and pixel coordinates run out of floating-point precision,
 * so a too-small brush is widened around its center instead.
 */
export function zoomExtent(
  f0: number,
  f1: number,
  current: { min: number; max: number },
  full: { min: number; max: number },
  type: ScaleType,
  maxZoom: number,
): { min: number; max: number } {
  const lo = scaleInvert(f0, current.min, current.max, type);
  const hi = scaleInvert(f1, current.min, current.max, type);
  if (!(full.max > full.min)) return { min: lo, max: hi };
  const minSpan = 1 / maxZoom;
  let g0 = scaleFraction(lo, full.min, full.max, type);
  const g1 = scaleFraction(hi, full.min, full.max, type);
  if (g1 - g0 >= minSpan) return { min: lo, max: hi };
  g0 = Math.max(0, Math.min(1 - minSpan, (g0 + g1 - minSpan) / 2));
  return {
    min: scaleInvert(g0, full.min, full.max, type),
    max: scaleInvert(g0 + minSpan, full.min, full.max, type),
  };
}

/**
 * Clamp the lower bound of a data extent so it's safe for log scale.
 * For linear scales the inputs are returned unchanged. For log scales,
 * `min` is raised to the smallest positive value in the data (or
 * `LOG_FLOOR` when no positive values exist), and `max` is also
 * floored to that value so a degenerate axis still renders.
 */
export function clampExtentForScale(
  min: number,
  max: number,
  type: ScaleType,
  smallestPositive: number,
): { min: number; max: number } {
  if (type !== "log") return { min, max };
  const floor =
    smallestPositive > 0 && isFinite(smallestPositive)
      ? smallestPositive
      : LOG_FLOOR;
  const lo = min > 0 ? min : floor;
  const hi = max > 0 ? Math.max(max, lo) : lo;
  return { min: lo, max: hi };
}

/**
 * Generate tick values for a log axis. By default returns powers of 10
 * inside `[min, max]`. Pass `ticks` as an explicit array to override;
 * numeric `ticks` (linear interval) is ignored on a log axis since it
 * would produce a swarm of densely-packed labels — use an array for
 * non-default tick placement.
 */
export function computeLogTickValues(opts: {
  min: number;
  max: number;
  ticks?: number | number[];
}): number[] {
  const { min, max, ticks } = opts;
  if (!(min > 0) || !(max > 0) || min === max) return [];

  if (Array.isArray(ticks)) {
    return ticks.filter((v) => v > 0 && v >= min && v <= max);
  }

  const lo = Math.floor(Math.log10(min));
  const hi = Math.ceil(Math.log10(max));
  const out: number[] = [];
  for (let e = lo; e <= hi; e++) {
    const v = Math.pow(10, e);
    if (v >= min && v <= max) out.push(v);
  }
  return out;
}
