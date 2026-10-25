import type { ChartData } from "./axes.js";

/**
 * The smallest and largest finite value across `arrays`, to pass to
 * several charts so they share one value axis, as small multiples or
 * Vega-Lite's shared `facet` scales do: as `y-min` / `y-max` on LineChart,
 * and only the max as `value-max` on BarChart, whose `value-min` is also
 * where bars start. Include every array a chart plots on that axis:
 * series, area bounds, interval bounds, and for a stacked BarChart the
 * per-category sums of its positive (and of its negative) segments.
 * `log: true` skips values at or below 0, which a log axis cannot show.
 * Undefined with no such value.
 */
export function sharedExtent(
  arrays: Iterable<ChartData | null | undefined>,
  opts: { log?: boolean } = {},
): { min: number; max: number } | undefined {
  let min = Infinity;
  let max = -Infinity;
  for (const a of arrays) {
    if (!a) continue;
    for (let i = 0; i < a.length; i++) {
      const v = Number(a[i]);
      if (!isFinite(v) || (opts.log && v <= 0)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return min <= max ? { min, max } : undefined;
}
