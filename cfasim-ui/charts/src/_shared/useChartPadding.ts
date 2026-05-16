import { computed } from "vue";

/** Vertical space reserved at the top of the chart for inline legend swatches. */
export const INLINE_LEGEND_HEIGHT = 20;

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
  xLabel: () => string | undefined;
  yLabel: () => string | undefined;
  hasInlineLegend: () => boolean;
  width: () => number;
  height: () => number;
  /** Extra pixels added on top of the standard axis spacing. */
  extraPadding?: () => ChartPadding | undefined;
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
 * Computes the standard chart padding (top/right/bottom/left) and the
 * derived inner plotting region (innerW, innerH). Shared by LineChart
 * and BarChart so the axis label spacing and inline legend strip stay
 * consistent. `extraPadding` adds extra space outside the plot — useful
 * for annotations that need to extend past the data area without
 * clipping.
 */
export function useChartPadding(opts: ChartPaddingOptions) {
  const padding = computed(() => {
    const extra = resolvePadding(opts.extraPadding?.());
    return {
      top:
        (opts.title() ? 26 : 10) +
        (opts.hasInlineLegend() ? INLINE_LEGEND_HEIGHT : 0) +
        extra.top,
      right: 10 + extra.right,
      bottom: (opts.xLabel() ? 38 : 30) + extra.bottom,
      left: (opts.yLabel() ? 56 : 50) + extra.left,
    };
  });
  // Y-center of the inline legend strip. Sits at the top of the padding
  // band (just below any title), so any user-supplied `extraPadding.top`
  // becomes empty room between the legend and the plot — useful for
  // annotations that need to extend above the data area.
  const legendY = computed(
    () => (opts.title() ? 26 : 10) + INLINE_LEGEND_HEIGHT / 2,
  );
  const innerW = computed(
    () => opts.width() - padding.value.left - padding.value.right,
  );
  const innerH = computed(
    () => opts.height() - padding.value.top - padding.value.bottom,
  );
  return { padding, legendY, innerW, innerH };
}
