import { computed } from "vue";
import { formatTick } from "./axes.js";
import { useChartSize } from "./useChartSize.js";
import { useChartPadding, type ChartPadding } from "./useChartPadding.js";
import { useChartTooltip } from "./useChartTooltip.js";
import type { TooltipClamp } from "../tooltip-position.js";
import { useChartMenu } from "./useChartMenu.js";

const DEFAULT_WIDTH_FALLBACK = 400;
const DEFAULT_HEIGHT = 200;

export interface ChartFoundationOptions {
  // Reactive getters for the shared chart props.
  width: () => number | undefined;
  height: () => number | undefined;
  title: () => string | undefined;
  xLabel: () => string | undefined;
  yLabel: () => string | undefined;
  debounce: () => number | undefined;
  menu: () => boolean | string | undefined;
  tooltipTrigger: () => "hover" | "click" | undefined;
  tooltipClamp: () => TooltipClamp | undefined;
  filename: () => string | undefined;
  downloadLink: () => boolean | string | undefined;
  chartPadding: () => ChartPadding | undefined;
  // Chart-specific hooks that the composable can't infer.
  hasInlineLegend: () => boolean;
  hasTooltipSlot: () => boolean;
  getCsv: () => string;
  pointerToIndex: (clientX: number, clientY: number) => number | null;
  onHover: (payload: { index: number } | null) => void;
}

/**
 * Wires up the shared chart plumbing — size measurement, padding, tooltip
 * interaction, and the menu/download wiring — that every cartesian chart
 * needs. Returns the reactive values and refs each chart's template
 * consumes.
 */
export function useChartFoundation(opts: ChartFoundationOptions) {
  const { containerRef, measuredWidth } = useChartSize({
    debounce: opts.debounce,
  });

  const width = computed(
    () => opts.width() ?? (measuredWidth.value || DEFAULT_WIDTH_FALLBACK),
  );
  const height = computed(() => opts.height() ?? DEFAULT_HEIGHT);

  const { padding, legendY, innerW, innerH } = useChartPadding({
    title: opts.title,
    xLabel: opts.xLabel,
    yLabel: opts.yLabel,
    hasInlineLegend: opts.hasInlineLegend,
    width: () => width.value,
    height: () => height.value,
    extraPadding: opts.chartPadding,
  });

  const {
    hoverIndex,
    tooltipRef,
    tooltipPos,
    handlers: tooltipHandlers,
  } = useChartTooltip({
    enabled: opts.hasTooltipSlot,
    trigger: opts.tooltipTrigger,
    clamp: () => opts.tooltipClamp() ?? "chart",
    pointerToIndex: opts.pointerToIndex,
    containerRef,
    onHover: opts.onHover,
  });

  const {
    svgRef,
    items: menuItems,
    downloadLinkText,
    csvHref,
    resolvedFilename: menuFilename,
  } = useChartMenu({
    filename: opts.filename,
    legacyMenuLabel: opts.menu,
    getCsv: opts.getCsv,
    downloadLink: opts.downloadLink,
  });

  return {
    containerRef,
    svgRef,
    width,
    height,
    padding,
    legendY,
    innerW,
    innerH,
    hoverIndex,
    tooltipRef,
    tooltipPos,
    tooltipHandlers,
    menuItems,
    downloadLinkText,
    csvHref,
    menuFilename,
  };
}

/**
 * Build a tooltip value formatter that prefers `tooltipValueFormat`,
 * falls back to the chart's axis tick formatter, and finally to
 * `formatTick`. Both chart components use the same precedence order.
 */
export function makeTooltipValueFormatter(
  tooltipFormat: () => ((v: number) => string) | undefined,
  axisFormat: () => ((v: number) => string) | undefined,
): (v: number) => string {
  return (v: number) => {
    const tf = tooltipFormat();
    if (tf) return tf(v);
    const af = axisFormat();
    if (af) return af(v);
    return formatTick(v);
  };
}
