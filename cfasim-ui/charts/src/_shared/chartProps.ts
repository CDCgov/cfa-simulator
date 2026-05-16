/**
 * Prop / slot / emit types shared by LineChart and BarChart. Component
 * authors compose these with chart-specific props via TypeScript
 * intersection (e.g. `defineProps<ChartCommonProps & MyExtraProps>()`).
 */

import type { ChartAnnotation } from "./annotations.js";
import type { ChartPadding } from "./useChartPadding.js";

/**
 * Props common to every cartesian chart component. Anything specific to
 * the chart type (series shape, layout, value-axis details) lives on the
 * component itself.
 */
export interface ChartCommonProps {
  width?: number;
  height?: number;
  title?: string;
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
   * Formatter for numeric values shown in the default tooltip. Receives
   * the raw value. When omitted, the chart falls back to its value-axis
   * tick formatter, then `formatTick`.
   */
  tooltipValueFormat?: (value: number) => string;
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
