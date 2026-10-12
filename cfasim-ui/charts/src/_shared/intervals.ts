/**
 * Shared interval ("whisker" / error-bar) API for charts. Each chart
 * projects an interval's data-space endpoints to pixels with its own
 * scales and hands the resolved segments to `ChartIntervals.vue`.
 */

import type { ChartData } from "./axes.js";
import type { BlendMode } from "./chartProps.js";

/**
 * Visual styling for interval whiskers. Every field is optional: a
 * per-interval value wins over the chart's `intervalStyle`, which wins
 * over the defaults listed here.
 */
export interface IntervalStyle {
  /** Whisker, cap, and (by default) dot color. Default: `currentColor`. */
  color?: string;
  /** Stroke width of the whisker and caps in pixels. Default: 1.5. */
  lineWidth?: number;
  /**
   * Length of the end caps in pixels, drawn perpendicular to the whisker.
   * `0` hides the caps. Default: 8.
   */
  capWidth?: number;
  /** Stroke opacity for the whisker, caps, and dot. Default: 1. */
  opacity?: number;
  /**
   * SVG `stroke-dasharray` for the whisker line. Accepts the raw string
   * form (`"4 4"`), a single number (uniform dash/gap), or an array of
   * numbers. Caps are always solid. Default: solid.
   */
  lineDash?: string | number | readonly number[];
  /**
   * Width of a legibility outline drawn behind the whisker and caps so
   * they stand out from busy series. `0` (default) draws none.
   */
  outlineWidth?: number;
  /** Outline color. Default: `var(--color-bg-0, #fff)`. */
  outlineColor?: string;
  /**
   * Draw a dot at `value` when one is given. Default: true. Set to
   * `false` to show the range only.
   */
  dot?: boolean;
  /** Radius of the `value` dot in pixels. Default: 3. */
  dotRadius?: number;
  /** Fill of the `value` dot. Default: `color`. */
  dotFill?: string;
  /** Stroke of the `value` dot. Default: none. */
  dotStroke?: string;
  /** Stroke width of the `value` dot. Default: 1. */
  dotStrokeWidth?: number;
  /** CSS `mix-blend-mode` applied to the whole interval. */
  blendMode?: BlendMode;
}

/**
 * A range drawn as a whisker at one position on the main axis: a line
 * from `lower` to `upper` with perpendicular end caps, and optionally a
 * dot at `value`. Use for calibration targets, error bars, or any
 * per-point interval that isn't a continuous band (see `areas` for
 * those).
 */
export interface ChartInterval extends IntervalStyle {
  /**
   * Position on the main axis in data coordinates. For `LineChart` this
   * is the same x-space as the series data (epoch ms on a date axis);
   * for `BarChart` it's the category index (fractional values land
   * between categories).
   */
  x: number;
  /** Low end of the range, on the value axis. */
  lower: number;
  /** High end of the range, on the value axis. */
  upper: number;
  /** Optional point estimate, drawn as a dot on the whisker. */
  value?: number;
  /**
   * Tie the whisker to a series: it hides with that series' legend
   * toggle on both charts. On `BarChart` it also centers on that series'
   * bar within a grouped category; on `LineChart` it also defaults
   * `color` to the series color.
   */
  seriesIndex?: number;
}

/** Defaults applied after per-interval and chart-level styles. */
export const INTERVAL_DEFAULTS = {
  color: "currentColor",
  lineWidth: 1.5,
  capWidth: 8,
  opacity: 1,
  outlineWidth: 0,
  outlineColor: "var(--color-bg-0, #fff)",
  dotRadius: 3,
  dotStrokeWidth: 1,
} as const;

/** Fully-resolved style for one interval. */
export interface ResolvedIntervalStyle {
  color: string;
  lineWidth: number;
  capWidth: number;
  opacity: number;
  lineDash?: string;
  outlineWidth: number;
  outlineColor: string;
  dot: boolean;
  dotRadius: number;
  dotFill: string;
  dotStroke?: string;
  dotStrokeWidth: number;
  blendMode?: BlendMode;
}

export function resolveIntervalDash(
  dash: string | number | readonly number[] | undefined,
): string | undefined {
  if (dash === undefined) return undefined;
  if (typeof dash === "number") return `${dash} ${dash}`;
  if (typeof dash === "string") return dash;
  return dash.join(" ");
}

/**
 * Merge an interval's own style over the chart-level style and the
 * defaults. `fallbackColor` is used when neither level sets a color (a
 * chart passes the owning series' color here).
 */
export function resolveIntervalStyle(
  own: IntervalStyle,
  chart: IntervalStyle | undefined,
  fallbackColor?: string,
): ResolvedIntervalStyle {
  const pick = <K extends keyof IntervalStyle>(k: K): IntervalStyle[K] =>
    own[k] !== undefined ? own[k] : chart?.[k];
  const color = pick("color") ?? fallbackColor ?? INTERVAL_DEFAULTS.color;
  return {
    color,
    lineWidth: pick("lineWidth") ?? INTERVAL_DEFAULTS.lineWidth,
    capWidth: pick("capWidth") ?? INTERVAL_DEFAULTS.capWidth,
    opacity: pick("opacity") ?? INTERVAL_DEFAULTS.opacity,
    lineDash: resolveIntervalDash(pick("lineDash")),
    outlineWidth: pick("outlineWidth") ?? INTERVAL_DEFAULTS.outlineWidth,
    outlineColor: pick("outlineColor") ?? INTERVAL_DEFAULTS.outlineColor,
    dot: pick("dot") ?? true,
    dotRadius: pick("dotRadius") ?? INTERVAL_DEFAULTS.dotRadius,
    dotFill: pick("dotFill") ?? color,
    dotStroke: pick("dotStroke"),
    dotStrokeWidth: pick("dotStrokeWidth") ?? INTERVAL_DEFAULTS.dotStrokeWidth,
    blendMode: pick("blendMode"),
  };
}

export interface Point {
  x: number;
  y: number;
}

export interface IntervalGeometry {
  /** Whisker endpoints (lower, then upper). */
  line: { x1: number; y1: number; x2: number; y2: number };
  /** Cap segments at each end, perpendicular to the whisker. Empty when `capWidth` is 0. */
  caps: { x1: number; y1: number; x2: number; y2: number }[];
}

/**
 * Whisker geometry between two projected endpoints. Caps are laid
 * perpendicular to the whisker, so a horizontal bar chart gets vertical
 * caps without any orientation flag. A zero-length whisker (lower ==
 * upper) gets a single cap centered on the point, which reads as a tick.
 */
export function intervalGeometry(
  lo: Point,
  hi: Point,
  capWidth: number,
): IntervalGeometry {
  const line = { x1: lo.x, y1: lo.y, x2: hi.x, y2: hi.y };
  if (capWidth <= 0) return { line, caps: [] };
  let dx = hi.x - lo.x;
  let dy = hi.y - lo.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) {
    // Degenerate: assume a vertical whisker so the cap is horizontal.
    dx = 0;
    dy = 1;
  } else {
    dx /= len;
    dy /= len;
  }
  const nx = (-dy * capWidth) / 2;
  const ny = (dx * capWidth) / 2;
  const cap = (p: Point) => ({
    x1: p.x + nx,
    y1: p.y + ny,
    x2: p.x - nx,
    y2: p.y - ny,
  });
  return { line, caps: len === 0 ? [cap(lo)] : [cap(lo), cap(hi)] };
}

/**
 * Expand a series' parallel `lower` / `upper` arrays into one interval
 * per finite point. `value` is taken from `data` when finite so the
 * whisker carries the series' own point estimate. Points where either
 * bound is missing are skipped.
 */
export function seriesIntervals(opts: {
  data: ChartData;
  lower?: ChartData;
  upper?: ChartData;
  xAt: (i: number) => number;
  seriesIndex: number;
  style?: IntervalStyle;
}): ChartInterval[] {
  const { lower, upper } = opts;
  if (!lower || !upper) return [];
  // Bounds are parallel to `data`: anything past it has no point to sit on.
  const n = Math.min(lower.length, upper.length, opts.data.length);
  const out: ChartInterval[] = [];
  for (let i = 0; i < n; i++) {
    const lo = Number(lower[i]);
    const hi = Number(upper[i]);
    const x = opts.xAt(i);
    if (!isFinite(lo) || !isFinite(hi) || !isFinite(x)) continue;
    const v = i < opts.data.length ? Number(opts.data[i]) : NaN;
    out.push({
      ...opts.style,
      x,
      lower: Math.min(lo, hi),
      upper: Math.max(lo, hi),
      value: isFinite(v) ? v : undefined,
      seriesIndex: opts.seriesIndex,
      // Series whiskers never draw their own dot: the series' dots (or
      // bars) already mark the point estimate.
      dot: opts.style?.dot ?? false,
    });
  }
  return out;
}
