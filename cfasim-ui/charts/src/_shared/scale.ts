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
