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
 * Visual styling shared by anything drawn as "a stroked line with
 * optional dots" — used by `LineChart`'s `Series` and `BarChart`'s
 * `BarSummaryLine`. Chart-specific data (y/x arrays, scaling overrides,
 * tooltip/outline behavior) lives on the extending type.
 */
export interface LineMarkStyle {
  color?: string;
  strokeWidth?: number;
  dashed?: boolean;
  opacity?: number;
  /**
   * CSS `mix-blend-mode` applied to the line and dots. Lets overlapping
   * marks combine their colors instead of one obscuring the other.
   */
  blendMode?: BlendMode;
  /** Draw a dot at each sample point. Default false. */
  dots?: boolean;
  /** Radius of each dot in pixels. */
  dotRadius?: number;
  /** Label shown in the inline legend. */
  legend?: string;
  /**
   * Whether this mark appears in the inline legend. Defaults to true.
   * Has no effect when `legend` is unset.
   */
  showInLegend?: boolean;
}

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
  /**
   * ARIA role for the chart's `<svg>`. Defaults to `"img"` when an accessible
   * name is present (from `ariaLabel` or `title`), so screen readers announce
   * the chart as a single labeled image instead of exposing the individual
   * marks. The menu and download controls sit outside the `<svg>`, so they
   * stay reachable regardless. Pass your own role to override.
   */
  role?: string;
  /**
   * Accessible name for the chart, announced by screen readers via the
   * `<svg>`'s `aria-label`. Defaults to the `title` prop. The individual
   * marks aren't exposed to assistive tech, so set this to a short summary of
   * what the chart shows.
   */
  ariaLabel?: string;
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
  /**
   * Show a `<button>` below the chart to download CSV. Pass `true` for
   * the default label or a string to customize. When set, the CSV menu
   * item is suppressed. Mutually exclusive with `downloadLink`; if both
   * are set, `downloadButton` wins.
   */
  downloadButton?: boolean | string;
  /**
   * Where to teleport the chart while expanded (the Expand menu item). A
   * CSS selector or element; defaults to `body`. The expanded chart is
   * moved here so its `position: fixed` resolves against the viewport
   * instead of being trapped by an ancestor's `transform`/`filter`/
   * `contain`/`perspective` (which would otherwise become its containing
   * block) or stacking context. Set this when your app doesn't mount at
   * the document root (e.g. inside a shadow root or a dedicated overlay).
   */
  fullscreenTarget?: string | HTMLElement;
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
