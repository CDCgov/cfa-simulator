import { computed } from "vue";
import { formatNumber, type NumberFormat } from "@cfasim-ui/shared";
import { formatTick } from "./axes.js";
import { useChartSize } from "./useChartSize.js";
import { useChartPadding, type ChartPadding } from "./useChartPadding.js";
import { useChartTooltip } from "./useChartTooltip.js";
import type { TooltipClamp } from "../tooltip-position.js";
import { useChartMenu } from "./useChartMenu.js";
import type { TitleStyle } from "./chartProps.js";

const DEFAULT_WIDTH_FALLBACK = 400;
const DEFAULT_HEIGHT = 200;

export interface ChartFoundationOptions {
  // Reactive getters for the shared chart props.
  width: () => number | undefined;
  height: () => number | undefined;
  title: () => string | undefined;
  titleStyle: () => TitleStyle | undefined;
  xLabel: () => string | undefined;
  yLabel: () => string | undefined;
  debounce: () => number | undefined;
  menu: () => boolean | string | undefined;
  tooltipTrigger: () => "hover" | "click" | undefined;
  tooltipClamp: () => TooltipClamp | undefined;
  filename: () => string | undefined;
  downloadLink: () => boolean | string | undefined;
  downloadButton: () => boolean | string | undefined;
  fullscreenTarget: () => string | HTMLElement | undefined;
  chartPadding: () => ChartPadding | undefined;
  // Chart-specific hooks that the composable can't infer.
  /**
   * Labels for the inline legend in render order. Empty array = no
   * legend strip. Drives wrapping into multiple rows and the resulting
   * top-padding reservation.
   */
  inlineLegendLabels: () => readonly string[];
  hasTooltipSlot: () => boolean;
  getCsv: () => string;
  pointerToIndex: (clientX: number, clientY: number) => number | null;
  onHover: (payload: { index: number } | null) => void;
  /**
   * Axis a finger drags along to scrub the tooltip on touch; the
   * orthogonal direction is left to the browser for page scrolling.
   * Defaults to `"x"`.
   */
  scrubAxis?: () => "x" | "y";
  /**
   * Extra height (in px) the chart adds *below* the SVG plot area
   * (e.g. LineChart's area-section labels). Used to keep the SVG total
   * height matched to the container when fullscreen.
   */
  extraBelowHeight?: () => number;
}

/**
 * Wires up the shared chart plumbing — size measurement, padding, tooltip
 * interaction, and the menu/download wiring — that every cartesian chart
 * needs. Returns the reactive values and refs each chart's template
 * consumes.
 */
export function useChartFoundation(opts: ChartFoundationOptions) {
  const { containerRef, measuredWidth, measuredHeight } = useChartSize({
    debounce: opts.debounce,
  });

  const {
    svgRef,
    items: menuItems,
    downloadLinkText,
    csvHref,
    downloadButtonText,
    triggerCsvDownload,
    resolvedFilename: menuFilename,
    isFullscreen,
    fullscreenStyle,
    teleportTarget,
    exitFullscreen,
  } = useChartMenu({
    filename: opts.filename,
    legacyMenuLabel: opts.menu,
    getCsv: opts.getCsv,
    downloadLink: opts.downloadLink,
    downloadButton: opts.downloadButton,
    fullscreen: true,
    fullscreenTarget: opts.fullscreenTarget,
  });

  const width = computed(() => {
    if (isFullscreen.value && measuredWidth.value > 0) {
      return measuredWidth.value;
    }
    return opts.width() ?? (measuredWidth.value || DEFAULT_WIDTH_FALLBACK);
  });

  const height = computed(() => {
    if (isFullscreen.value && measuredHeight.value > 0) {
      const extra = opts.extraBelowHeight?.() ?? 0;
      return measuredHeight.value - extra;
    }
    return opts.height() ?? DEFAULT_HEIGHT;
  });

  const { padding, legendY, inlineLegendLayout, innerW, innerH, bounds } =
    useChartPadding({
      title: opts.title,
      titleStyle: opts.titleStyle,
      xLabel: opts.xLabel,
      yLabel: opts.yLabel,
      inlineLegendLabels: opts.inlineLegendLabels,
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
    scrubAxis: opts.scrubAxis,
    onHover: opts.onHover,
  });

  return {
    containerRef,
    svgRef,
    width,
    height,
    padding,
    legendY,
    inlineLegendLayout,
    innerW,
    innerH,
    bounds,
    hoverIndex,
    tooltipRef,
    tooltipPos,
    tooltipHandlers,
    menuItems,
    downloadLinkText,
    csvHref,
    downloadButtonText,
    triggerCsvDownload,
    menuFilename,
    isFullscreen,
    fullscreenStyle,
    teleportTarget,
    exitFullscreen,
    measuredHeight,
  };
}

/**
 * Build a tooltip value formatter that prefers `tooltipValueFormat`,
 * falls back to the chart's axis tick formatter, and finally to
 * `formatTick`. Both chart components use the same precedence order.
 */
export function makeTooltipValueFormatter(
  tooltipFormat: () => NumberFormat | undefined,
  axisFormat: () => NumberFormat | undefined,
): (v: number) => string {
  return (v: number) => {
    const tf = tooltipFormat();
    if (tf !== undefined) return formatNumber(v, tf);
    const af = axisFormat();
    if (af !== undefined) return formatNumber(v, af);
    return formatTick(v);
  };
}
