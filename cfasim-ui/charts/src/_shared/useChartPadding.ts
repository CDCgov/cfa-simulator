import { computed } from "vue";
import type { LabelStyle, TitleStyle } from "./chartProps.js";

/** Vertical space reserved per row of the inline legend strip. */
export const INLINE_LEGEND_ROW_HEIGHT = 20;
/** Default line height (px) for the chart title; overridable per chart. */
export const TITLE_LINE_HEIGHT = 18;
/** Default font size (px) for the chart title; overridable per chart. */
export const TITLE_FONT_SIZE = 14;
/** Default font weight for the chart title; overridable per chart. */
export const TITLE_FONT_WEIGHT: number | string = 600;
/** Default font size (px) for axis labels (`xLabel` / `yLabel`). */
export const AXIS_LABEL_FONT_SIZE = 13;
/** Default font size (px) for axis tick labels (the numbers on each axis). */
export const TICK_LABEL_FONT_SIZE = 10;
/** Default fill-opacity for tick labels when no custom color is set. */
export const TICK_LABEL_OPACITY = 0.6;
/** Default font size (px) for inline legend item labels. */
export const LEGEND_FONT_SIZE = 11;
/** Vertical space below the title's last baseline before the next element. */
const TITLE_BOTTOM_GAP = 8;

/**
 * Resolve a `LabelStyle` against per-element defaults. Returns the
 * fields the chart's `<text>` element needs. When `style.color` is set,
 * the default fill-opacity is dropped so the exact color renders.
 */
export function resolveLabelStyle(
  style: LabelStyle | undefined,
  defaults: { fontSize: number; fillOpacity?: number },
): {
  fontSize: number;
  fill: string;
  fontWeight: number | string | undefined;
  fillOpacity: number | undefined;
} {
  return {
    fontSize: style?.fontSize ?? defaults.fontSize,
    fill: style?.color ?? "currentColor",
    fontWeight: style?.fontWeight,
    fillOpacity: style?.color != null ? undefined : defaults.fillOpacity,
  };
}
/**
 * Estimated character width at font-size 11 used by inline-legend
 * measurement. Matches the value used by LineChart's area-section labels
 * so wrapping behaves consistently across the chart's text overlays.
 */
const LEGEND_CHAR_WIDTH = 7;
/** X offset of legend text from the start of its row slot. */
const LEGEND_TEXT_INDENT = 18;
/** Horizontal gap between adjacent legend items on the same row. */
const LEGEND_ITEM_GAP = 16;

/**
 * Extra space added around the chart's standard layout. A number applies
 * the same amount to all four sides; an object lets you pad sides
 * independently (e.g. `{ top: 24 }` to make room for annotations above
 * the plot). Named to match Altair's `padding` (outer view padding).
 */
export type ChartPadding =
  | number
  | {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };

export interface ChartPaddingOptions {
  title: () => string | undefined;
  titleStyle?: () => TitleStyle | undefined;
  xLabel: () => string | undefined;
  yLabel: () => string | undefined;
  /**
   * Labels for the inline legend items, in render order. Empty array
   * (or omitted) means no legend strip. Drives both row-count for
   * reserving top padding and per-item wrap positions.
   */
  inlineLegendLabels: () => readonly string[];
  width: () => number;
  height: () => number;
  /** Extra pixels added on top of the standard axis spacing. */
  extraPadding?: () => ChartPadding | undefined;
}

/** Position of a single legend item within the legend strip. */
export interface PositionedLegendItem {
  /** X offset relative to `padding.left`. */
  x: number;
  /** Row index, 0-based. */
  row: number;
}

function resolvePadding(p: ChartPadding | undefined) {
  if (p == null) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof p === "number") return { top: p, right: p, bottom: p, left: p };
  return {
    top: p.top ?? 0,
    right: p.right ?? 0,
    bottom: p.bottom ?? 0,
    left: p.left ?? 0,
  };
}

/**
 * Estimated rendered width (in px) of a single legend item — indicator,
 * text, and surrounding spacing. Used to flow items into rows.
 */
function estimateLegendItemWidth(label: string): number {
  return LEGEND_TEXT_INDENT + label.length * LEGEND_CHAR_WIDTH;
}

/**
 * Computes the standard chart padding (top/right/bottom/left) and the
 * derived inner plotting region (innerW, innerH). Shared by LineChart
 * and BarChart so the axis label spacing and inline legend strip stay
 * consistent. `extraPadding` adds extra space outside the plot — useful
 * for annotations that need to extend past the data area without
 * clipping.
 *
 * The inline legend wraps to multiple rows when items don't fit in the
 * available width; `padding.top` grows by `INLINE_LEGEND_ROW_HEIGHT` per
 * row so the plot stays clear of the legend strip.
 */
export function useChartPadding(opts: ChartPaddingOptions) {
  // Horizontal padding is computed first because `innerW` depends only
  // on left/right (not on legend row count). Splitting padding this way
  // keeps the legend layout — which depends on `innerW` — out of the
  // reactivity cycle for left/right.
  const horizontalPadding = computed(() => {
    const extra = resolvePadding(opts.extraPadding?.());
    return {
      left: (opts.yLabel() ? 56 : 50) + extra.left,
      right: 10 + extra.right,
    };
  });

  const innerW = computed(
    () =>
      opts.width() -
      horizontalPadding.value.left -
      horizontalPadding.value.right,
  );

  const inlineLegendLayout = computed<{
    positions: PositionedLegendItem[];
    rowCount: number;
  }>(() => {
    const labels = opts.inlineLegendLabels();
    if (labels.length === 0) return { positions: [], rowCount: 0 };
    const available = Math.max(0, innerW.value);
    const positions: PositionedLegendItem[] = [];
    let row = 0;
    let x = 0;
    for (const label of labels) {
      const w = estimateLegendItemWidth(label);
      // Wrap to a new row when the item won't fit, except when we're
      // already at row-start (`x === 0`): a single oversized label gets
      // its own row instead of triggering an infinite-wrap loop.
      if (x > 0 && x + w > available) {
        row++;
        x = 0;
      }
      positions.push({ x, row });
      x += w + LEGEND_ITEM_GAP;
    }
    return { positions, rowCount: row + 1 };
  });

  // Title height in px. `\n` in the title creates additional lines, each
  // adding `titleStyle.lineHeight` (default 18). When there is no title,
  // reserve a small top margin so the plot doesn't hug the top edge.
  const titleHeight = computed(() => {
    const t = opts.title();
    if (!t) return 10;
    const lineHeight = opts.titleStyle?.()?.lineHeight ?? TITLE_LINE_HEIGHT;
    const lineCount = t.split("\n").length;
    return lineCount * lineHeight + TITLE_BOTTOM_GAP;
  });

  const padding = computed(() => {
    const extra = resolvePadding(opts.extraPadding?.());
    const rowCount = inlineLegendLayout.value.rowCount;
    return {
      top: titleHeight.value + rowCount * INLINE_LEGEND_ROW_HEIGHT + extra.top,
      bottom: (opts.xLabel() ? 38 : 30) + extra.bottom,
      left: horizontalPadding.value.left,
      right: horizontalPadding.value.right,
    };
  });

  // Y-center of the first inline-legend row. Sits at the top of the
  // padding band (just below any title), so any user-supplied
  // `extraPadding.top` becomes empty room between the legend and the
  // plot. Subsequent rows are offset by `INLINE_LEGEND_ROW_HEIGHT`.
  const legendY = computed(
    () => titleHeight.value + INLINE_LEGEND_ROW_HEIGHT / 2,
  );

  const innerH = computed(
    () => opts.height() - padding.value.top - padding.value.bottom,
  );
  // Pixel-space rect of the plot area. Single source of truth for any
  // consumer that needs to span the full plot (e.g. rule annotations,
  // background fills, clip paths).
  const bounds = computed(() => {
    const p = padding.value;
    return {
      left: p.left,
      top: p.top,
      right: p.left + innerW.value,
      bottom: p.top + innerH.value,
      width: innerW.value,
      height: innerH.value,
    };
  });
  return {
    padding,
    legendY,
    inlineLegendLayout,
    innerW,
    innerH,
    bounds,
  };
}

export type ChartBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};
