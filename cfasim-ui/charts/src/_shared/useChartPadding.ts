import { computed } from "vue";

/** Vertical space reserved at the top of the chart for inline legend swatches. */
export const INLINE_LEGEND_HEIGHT = 20;

export interface ChartPaddingOptions {
  title: () => string | undefined;
  xLabel: () => string | undefined;
  yLabel: () => string | undefined;
  hasInlineLegend: () => boolean;
  width: () => number;
  height: () => number;
}

/**
 * Computes the standard chart padding (top/right/bottom/left) and the
 * derived inner plotting region (innerW, innerH). Shared by LineChart
 * and BarChart so the axis label spacing and inline legend strip stay
 * consistent.
 */
export function useChartPadding(opts: ChartPaddingOptions) {
  const padding = computed(() => ({
    top:
      (opts.title() ? 30 : 10) +
      (opts.hasInlineLegend() ? INLINE_LEGEND_HEIGHT : 0),
    right: 10,
    bottom: opts.xLabel() ? 46 : 30,
    left: opts.yLabel() ? 66 : 50,
  }));
  const innerW = computed(
    () => opts.width() - padding.value.left - padding.value.right,
  );
  const innerH = computed(
    () => opts.height() - padding.value.top - padding.value.bottom,
  );
  return { padding, innerW, innerH };
}
