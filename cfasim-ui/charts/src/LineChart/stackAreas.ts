import {
  parseDate,
  type ChartData,
  type DateTimezone,
} from "../_shared/index.js";
import type { Area, LineChartXInput } from "./LineChart.vue";

/** One layer of a stacked area chart: an `Area` given by its own values. */
export interface StackedAreaLayer extends Omit<
  Area,
  "upper" | "lower" | "value" | "x"
> {
  /** The layer's values; its band is this thick at each x. */
  y: ChartData;
  /**
   * x positions parallel to `y`. Without them, points stack by index; give
   * every layer `x` or none.
   */
  x?: readonly number[] | readonly (string | Date)[];
}

export interface StackAreasOptions {
  /**
   * `"zero"` (default) stacks values on a zero baseline, positive values
   * upward and negative values downward. `"normalize"` stacks absolute
   * values as fractions of each x's total, so the top edge is always 1.
   */
  offset?: "zero" | "normalize";
  /**
   * How offset-less date strings in `x` are read when matching layers'
   * points, as the chart's `timezone` prop. Default `"utc"`.
   */
  timezone?: DateTimezone;
}

/**
 * Stack layers into LineChart `areas`: each layer becomes a band from the
 * total of the layers before it to that total plus its own value, in
 * array order. Layers stack where their x values match (a date string
 * and a `Date` for the same time match); a layer with no point at some x
 * counts as 0 there, and points whose x is not a number or date are
 * dropped. Each band keeps the layer's raw values as `value`, so the
 * tooltip shows the layer's value, not the band (with `"normalize"` too).
 * Hiding a layer from the legend leaves its gap in the stack.
 */
export function stackAreas(
  layers: readonly StackedAreaLayer[],
  opts: StackAreasOptions = {},
): Area[] {
  // Match points by x value, or by index when no layer has x.
  const keyed = layers.some((l) => l.x);
  if (keyed && !layers.every((l) => l.x)) {
    throw new Error("stackAreas: give every layer `x`, or none");
  }
  const tz = opts.timezone ?? "utc";
  // Each distinct x, as first given (a Date stays a Date so the chart
  // keeps a date axis), with the number it matches and sorts by.
  const xs: (number | string | Date)[] = [];
  const keys: number[] = [];
  const at = new Map<number, number>();
  const rows = layers.map((l) => {
    const row = new Map<number, number>();
    for (let i = 0; i < l.y.length; i++) {
      const raw = keyed ? l.x![i] : i;
      const k = typeof raw === "number" ? raw : (parseDate(raw, tz) ?? NaN);
      if (!isFinite(k)) continue;
      let col = at.get(k);
      if (col === undefined) {
        col = xs.length;
        at.set(k, col);
        xs.push(raw);
        keys.push(k);
      }
      row.set(col, Number(l.y[i]));
    }
    return row;
  });

  const order = xs.map((_, i) => i);
  order.sort((a, b) => keys[a] - keys[b]);
  const n = order.length;
  const x = keyed ? (order.map((c) => xs[c]) as LineChartXInput) : undefined;

  const normalize = opts.offset === "normalize";
  const totals = new Float64Array(n);
  if (normalize) {
    for (const row of rows) {
      for (let j = 0; j < n; j++) {
        const v = row.get(order[j]);
        if (v !== undefined && isFinite(v)) totals[j] += Math.abs(v);
      }
    }
  }
  const pos = new Float64Array(n);
  const neg = new Float64Array(n);
  return layers.map((layer, li) => {
    const { y: _y, x: _x, ...style } = layer;
    const lower = new Float64Array(n);
    const upper = new Float64Array(n);
    const value = new Float64Array(n);
    for (let j = 0; j < n; j++) {
      const v = rows[li].get(order[j]);
      value[j] = v ?? 0;
      const d = v !== undefined && isFinite(v) ? v : 0;
      if (normalize) {
        const scale = totals[j] ? 1 / totals[j] : 0;
        lower[j] = pos[j];
        upper[j] = pos[j] += Math.abs(d) * scale;
      } else if (d < 0) {
        upper[j] = neg[j];
        lower[j] = neg[j] += d;
      } else {
        lower[j] = pos[j];
        upper[j] = pos[j] += d;
      }
    }
    return { ...style, x, lower, upper, value };
  });
}
