/**
 * Prop / slot / emit types shared by LineChart and BarChart. Component
 * authors compose these with chart-specific props via TypeScript
 * intersection (e.g. `defineProps<ChartCommonProps & MyExtraProps>()`).
 */

import type { NumberFormat } from "@cfasim-ui/shared";
import type { ChartAnnotation } from "./annotations.js";
import type { ChartPadding } from "./useChartPadding.js";

/**
 * Visual styling for the chart title. All fields optional; unspecified
 * fields fall back to the chart's defaults (font-size 14, line-height 18,
 * font-weight 600, currentColor, align "left"). `lineHeight` is in pixels
 * and controls spacing between lines when the title contains `\n`.
 */
export interface TitleStyle {
  fontSize?: number;
  lineHeight?: number;
  color?: string;
  fontWeight?: number | string;
  /** Horizontal alignment of the title. Default: `"left"`. */
  align?: "left" | "center" | "right";
}

/**
 * Visual styling for axis labels, tick labels, and legend text. Each
 * field is optional; unspecified fields fall back to that element's
 * default. When `color` is set, the default fill-opacity (used by tick
 * labels) is dropped so the exact color is rendered.
 */
export interface LabelStyle {
  fontSize?: number;
  color?: string;
  fontWeight?: number | string;
}

/**
 * CSS `mix-blend-mode` values usable on chart series. Drives how a
 * series' pixels combine with what's painted behind them. Useful for
 * overlapping series (e.g. `"multiply"` darkens light fills where bars
 * overlap; `"screen"` lightens dark fills).
 */
export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity";

/**
 * Props common to every cartesian chart component. Anything specific to
 * the chart type (series shape, layout, value-axis details) lives on the
 * component itself.
 */
export interface ChartCommonProps {
  width?: number;
  height?: number;
  /**
   * Chart title. `\n` in the string creates additional lines, each
   * adding `titleStyle.lineHeight` (default 18px) of vertical space.
   */
  title?: string;
  /** Styling for the chart title. See `TitleStyle`. */
  titleStyle?: TitleStyle;
  /** Styling for axis labels (the `xLabel` / `yLabel` text). */
  axisLabelStyle?: LabelStyle;
  /** Styling for axis tick labels (the numbers/categories on each axis). */
  tickLabelStyle?: LabelStyle;
  /** Styling for the inline legend item labels. */
  legendStyle?: LabelStyle;
  xLabel?: string;
  yLabel?: string;
  debounce?: number;
  menu?: boolean | string;
  /**
   * Custom per-index data forwarded to the `tooltip` slot. Accepts a
   * plain array or any `ArrayLike` (e.g. a typed-array column).
   */
  tooltipData?: ArrayLike<unknown>;
  /** Tooltip activation mode. */
  tooltipTrigger?: "hover" | "click";
  /** Boundary for tooltip flip/clamp. Default: `"chart"`. */
  tooltipClamp?: "none" | "chart" | "window";
  /**
   * Formatter for numeric values shown in the default tooltip. Accepts a
   * preset name, a printf-style format string, or a function. When
   * omitted, the chart falls back to its value-axis tick formatter, then
   * `formatTick`. See `formatNumber` in `@cfasim-ui/shared`.
   */
  tooltipValueFormat?: NumberFormat;
  /**
   * Custom CSV content (string or function) for the Download CSV menu
   * item. When omitted, CSV is generated from the chart's series.
   */
  csv?: string | (() => string);
  /** Filename (without extension) for SVG, PNG, and CSV downloads. */
  filename?: string;
  /**
   * Show a plain text link below the chart to download CSV. Pass `true`
   * for the default label or a string to customize.
   */
  downloadLink?: boolean | string;
  /** Annotations rendered as the top layer of the chart. */
  annotations?: readonly ChartAnnotation[];
  /**
   * Extra padding (pixels) added around the plot. Number = same on all
   * sides; object = per-side. Useful for giving annotations or other
   * overlays room to extend past the data area without clipping.
   */
  chartPadding?: ChartPadding;
}

/** Payload emitted on `hover` from a cartesian chart. */
export type ChartHoverPayload = { index: number } | null;

/** One per-series value passed to the tooltip slot. */
export interface ChartTooltipValue {
  value: number;
  color: string;
  seriesIndex: number;
}

/** Properties common to every chart's tooltip slot. */
export interface ChartTooltipBaseProps {
  index: number;
  values: ChartTooltipValue[];
  data: unknown;
}
