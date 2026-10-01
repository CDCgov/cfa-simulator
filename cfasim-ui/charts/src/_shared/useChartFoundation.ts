import { computed } from "vue";
import { formatNumber, type NumberFormat } from "@cfasim-ui/shared";
import { formatTick } from "./axes.js";
import { useChartSize } from "./useChartSize.js";
import { useChartPadding, type ChartPadding } from "./useChartPadding.js";
import { useChartTooltip } from "./useChartTooltip.js";
import {
  useChartBrush,
  type BrushBox,
  type BrushMode,
} from "./useChartBrush.js";
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
  /**
   * Drag-to-zoom wiring. The composable owns the brush gesture and the
   * selection rectangle; the chart maps the brushed svg-pixel box to its
   * own data domain in `onSelect`.
   */
  zoom?: {
    /** Brush behavior, or null when zoom is off. */
    mode: () => BrushMode | null;
    onSelect: (box: BrushBox) => void;
    onReset: () => void;
  };
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
    clamp: () => opts.tooltipClamp() ?? "window",
    pointerToIndex: opts.pointerToIndex,
    containerRef,
    scrubAxis: opts.scrubAxis,
    onHover: opts.onHover,
  });

  const zoomMode = () => opts.zoom?.mode() ?? null;
  const zoomEnabled = () => zoomMode() !== null;

  const brush = useChartBrush({
    mode: zoomMode,
    originRef: svgRef,
    bounds: () => ({
      x0: padding.value.left,
      x1: padding.value.left + innerW.value,
      y0: padding.value.top,
      y1: padding.value.top + innerH.value,
    }),
    // Drop the hover tooltip so it doesn't trail the brush.
    onStart: () => tooltipHandlers.mouseleave(),
    onSelect: (box) => opts.zoom?.onSelect(box),
  });

  /** Selection rectangle in svg pixels while a brush is in progress. */
  const brushRect = computed(() => {
    const s = brush.selection.value;
    if (!s) return null;
    return { x: s.x0, y: s.y0, width: s.x1 - s.x0, height: s.y1 - s.y0 };
  });

  /** Handlers for the plot's hit-test overlay: tooltip plus drag-to-zoom. */
  const overlayHandlers = {
    ...tooltipHandlers,
    mousemove: (e: MouseEvent) => {
      if (!brush.selection.value) tooltipHandlers.mousemove(e);
    },
    click: (e: MouseEvent) => {
      if (!brush.shouldSwallowClick()) tooltipHandlers.click(e);
    },
    pointerdown: brush.onPointerDown,
    // Keeps the drag from starting a text selection.
    mousedown: (e: MouseEvent) => {
      if (zoomEnabled()) e.preventDefault();
    },
    dblclick: () => {
      if (zoomEnabled()) opts.zoom?.onReset();
    },
  };

  return {
    overlayHandlers,
    brushRect,
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
