import { computed } from "vue";
import type { ChartCommonProps } from "./chartProps.js";
import {
  resolveLabelStyle,
  AXIS_LABEL_FONT_SIZE,
  TICK_LABEL_FONT_SIZE,
  TICK_LABEL_OPACITY,
  LEGEND_FONT_SIZE,
} from "./useChartPadding.js";

/**
 * Computeds derived purely from `ChartCommonProps`, shared verbatim by
 * every cartesian chart. Pass the component's reactive `props` object;
 * property reads inside the computeds track as usual.
 */
export function useChartCommon(props: ChartCommonProps) {
  // Accessible name for the chart; falls back to the visible title.
  const chartAriaLabel = computed(() => props.ariaLabel ?? props.title);
  // Expose the <svg> as a single labeled image so screen readers announce
  // the name instead of wandering through the individual marks. The
  // menu/download controls live outside the <svg>, so they stay reachable.
  // An explicit `role` prop always wins.
  const chartRole = computed(
    () => props.role ?? (chartAriaLabel.value ? "img" : undefined),
  );

  /** Resolved style for the x/y axis labels. */
  const axisLabelResolved = computed(() =>
    resolveLabelStyle(props.axisLabelStyle, { fontSize: AXIS_LABEL_FONT_SIZE }),
  );
  /** Resolved style for the axis tick labels. */
  const tickLabelResolved = computed(() =>
    resolveLabelStyle(props.tickLabelStyle, {
      fontSize: TICK_LABEL_FONT_SIZE,
      fillOpacity: TICK_LABEL_OPACITY,
    }),
  );
  /** Resolved style for inline legend item labels. */
  const legendResolved = computed(() =>
    resolveLabelStyle(props.legendStyle, { fontSize: LEGEND_FONT_SIZE }),
  );

  const hasTooltipSlot = computed(
    () => !!props.tooltipData || !!props.tooltipTrigger,
  );

  return {
    chartAriaLabel,
    chartRole,
    axisLabelResolved,
    tickLabelResolved,
    legendResolved,
    hasTooltipSlot,
  };
}
