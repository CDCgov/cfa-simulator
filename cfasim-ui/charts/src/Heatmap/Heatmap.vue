<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref, useId } from "vue";
import { formatNumber, type NumberFormat } from "@cfasim-ui/shared";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import {
  formatTick,
  categoricalToCsv,
  resolveCsvOverride,
  useChartFoundation,
  useChartCommon,
  ChartAxisLabels,
  ChartTitle,
  ChartTooltipContent,
  ChartColorScaleLegend,
  positionLegendItems,
  layoutColorScaleLegend,
  colorScaleDomain,
  colorScaleFn,
  colorRampStops,
  pickContrastColor,
  textWidthOrEstimate,
  useChartFontFamily,
  resolvePadding,
  CARTESIAN_LEFT_PADDING,
  CARTESIAN_RIGHT_PADDING,
  CARTESIAN_BOTTOM_PADDING,
  type ColorScale,
  type ColorScaleLegendLayout,
  type ChartBaseProps,
  type ChartHoverPayload,
  type ChartTooltipBaseProps,
  type ChartTooltipValue,
  type ChartPadding,
  type InlineLegendLabel,
} from "../_shared/index.js";
import {
  columnLabelSidePadding,
  labelWidthForExtent,
  labelWidthForReach,
  moveCell,
  normalizeLabelAngle,
  pickLabelAngle,
  rotatedLabelExtent,
  rotatedLabelFootprint,
  truncateLabel,
} from "./heatmapLayout.js";

/** Styling for the values printed in the cells. */
export interface HeatmapCellLabels {
  /** Formats the printed value. Defaults to the chart's `valueFormat`. */
  format?: NumberFormat;
  /** Font size in pixels. Default 11. */
  fontSize?: number;
  fontWeight?: number | string;
  /**
   * Text color. When omitted, each label is black or white, whichever
   * reads better on its cell.
   */
  color?: string;
}

/** One cell of the heatmap, as the events and the tooltip slot report it. */
export interface HeatmapCell {
  rowIndex: number;
  columnIndex: number;
  row: string;
  column: string;
  /** The cell's value; `NaN` for a missing one. */
  value: number;
  /** The cell's fill from the color scale; `undefined` for a missing value. */
  color: string | undefined;
}

/** A row or column label, as `row-click` / `column-click` report it. */
export interface HeatmapAxisItem {
  index: number;
  label: string;
}

export interface HeatmapProps extends ChartBaseProps {
  /** Row labels, top to bottom. */
  rows: readonly string[];
  /** Column labels, left to right. */
  columns: readonly string[];
  /**
   * Cell values, one array per row in `rows` order, each with one entry
   * per column (`data[rowIndex][columnIndex]`). A missing or non-finite
   * entry leaves the cell empty. See `pivotCells` for long-format rows.
   */
  data: readonly ArrayLike<number>[];
  /**
   * Maps values to cell colors; defaults to viridis over the extent of
   * `data`. A `domain` of three values with three colors makes a
   * diverging scale. The scale's gradient legend sits in the inline
   * legend strip (`legendPosition`). See `ColorScale`.
   */
  colorScale?: ColorScale;
  /**
   * Formats cell values for the cell labels, the tooltip and the legend's
   * end labels. Accepts a preset, a printf string or a function (see
   * `formatNumber`). Defaults to three significant digits.
   */
  valueFormat?: NumberFormat;
  /**
   * Print each cell's value on it, in black or white for contrast. A
   * label that does not fit its cell is left out. Pass an object to style
   * the text. Default `false`.
   */
  cellLabels?: boolean | HeatmapCellLabels;
  /** Space between neighboring cells in pixels. Default 1. */
  cellGap?: number;
  /** Corner radius of each cell in pixels. Default 0. */
  cellRadius?: number;
  /** Stroke color drawn around each cell; none by default. */
  cellStroke?: string;
  /** Stroke width of `cellStroke`. Default 1. */
  cellStrokeWidth?: number;
  /**
   * Fill for cells with a missing value. By default an empty cell is not
   * drawn at all.
   */
  missingColor?: string;
  /**
   * Row height in pixels when `height` is not set: the chart grows to fit
   * every row. Ignored with an explicit `height`, where the rows share
   * the plot. Default 28.
   */
  cellHeight?: number;
  /**
   * Where the column labels sit: under the plot (default, like an x
   * axis), above it (like a table header), or nowhere.
   */
  columnAxis?: "top" | "bottom" | "none";
  /** Where the row labels sit: beside the plot (default) or nowhere. */
  rowAxis?: "left" | "none";
  /**
   * Angle of the column labels in degrees, as SVG `rotate` reads it:
   * negative turns them counter-clockwise, so `-45` reads upward to the
   * right and `45` downward. `"auto"` (default) keeps them flat while the
   * widest fits its column, else turns them diagonal (-45) or vertical
   * (-90). Other angles are read as their equivalent between -90 and 90,
   * so `270` is `-90`. Labels that would run off the chart get extra side
   * padding, and are shortened with `…` past a fifth of the width or, with
   * an explicit `height`, past 40% of it.
   */
  columnLabelAngle?: number | "auto";
  /**
   * Width in pixels reserved for the row labels. Defaults to the widest
   * label, capped at 40% of the chart width.
   */
  rowLabelWidth?: number;
  /**
   * Heading printed above the row labels, like a table's first column
   * header. In line with the column labels when they are on top.
   */
  rowHeader?: string;
  /**
   * Give every cell and row label a keyboard-reachable button: Tab
   * reaches the grid, the arrow keys move between cells (Home/End to the
   * row label and last column), focus shows the tooltip and Enter or
   * Space emits `cell-click` / `row-click`. Pointer events still go to
   * the plot. Default `false`.
   */
  interactive?: boolean;
}

const props = withDefaults(defineProps<HeatmapProps>(), {
  cellGap: 1,
  cellRadius: 0,
  cellStrokeWidth: 1,
  cellHeight: 28,
  columnAxis: "bottom",
  rowAxis: "left",
  columnLabelAngle: "auto",
  menu: true,
});

defineOptions({ inheritAttrs: false });

const emit = defineEmits<{
  /** The hovered (or focused) cell's row-major index, `null` when none. */
  (e: "hover", payload: ChartHoverPayload): void;
  /** A click (or Enter / Space with `interactive`) on a cell. */
  (e: "cellClick", cell: HeatmapCell): void;
  /** A click on a row label. */
  (e: "rowClick", row: HeatmapAxisItem): void;
  /** A click on a column label. */
  (e: "columnClick", column: HeatmapAxisItem): void;
}>();

/** Props of the `tooltip` slot: the shared chart set plus the hovered cell. */
export type HeatmapTooltipProps = ChartTooltipBaseProps & HeatmapCell;

defineSlots<{
  tooltip?(props: HeatmapTooltipProps): unknown;
}>();

const {
  chartAriaLabel,
  chartRole,
  axisLabelResolved,
  tickLabelResolved,
  legendResolved,
  hasTooltipSlot,
} = useChartCommon(props);

const rowCount = computed(() => props.rows.length);
const columnCount = computed(() => props.columns.length);

/** A missing entry (`null`, `undefined` or `""`) reads as `NaN`. */
function valueAt(r: number, c: number): number {
  const raw: unknown = props.data[r]?.[c];
  return raw == null || raw === "" ? NaN : Number(raw);
}

/** Three significant digits, which `valueFormat` overrides. */
function defaultFormat(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  if (Math.abs(v) >= 1000 || Number.isInteger(v)) return formatTick(v);
  return String(Number(v.toPrecision(3)));
}

const formatValue = computed(() =>
  props.valueFormat !== undefined
    ? (v: number) => formatNumber(v, props.valueFormat)
    : defaultFormat,
);

const tooltipFormat = (v: number) =>
  props.tooltipValueFormat !== undefined
    ? formatNumber(v, props.tooltipValueFormat)
    : formatValue.value(v);

const colorScaleResolved = computed(() => {
  const domain = colorScaleDomain(props.data, props.colorScale?.domain);
  if (!domain) return null;
  const scale = props.colorScale;
  return {
    domain,
    colorAt: colorScaleFn(scale?.range, domain),
    range: scale?.range,
    label: scale?.label,
    format: scale?.format ?? formatValue.value,
    legend: scale?.legend !== false,
  };
});

const gradientId = useId();
const rampStops = computed(() =>
  colorRampStops(colorScaleResolved.value?.range),
);

// --- Label measurement -----------------------------------------------------

/** Gap between the row labels' right edge and the plot. */
const ROW_LABEL_GAP = 8;
/** Gap between the plot and the column labels. */
const COLUMN_LABEL_GAP = 6;
/** Room the rotated `yLabel` takes at the chart's left edge. */
const Y_LABEL_WIDTH = 18;
/** Left padding without a `yLabel`, matching the charts' right padding. */
const BASE_LEFT = CARTESIAN_RIGHT_PADDING;
/** Share of the chart width each side may give up to overhanging column labels. */
const COLUMN_LABEL_MAX_OVERHANG = 0.2;
/** Share of a fixed chart height the column labels may take. */
const COLUMN_LABEL_MAX_EXTENT = 0.4;

const chartFontFamily = useChartFontFamily(() => svgRef.value);

function font(style: { fontSize: number; fontWeight?: number | string }) {
  return `${style.fontWeight ?? 400} ${style.fontSize}px ${chartFontFamily.value}`;
}

function labelWidths(labels: readonly string[]): number[] {
  const style = tickLabelResolved.value;
  const spec = font(style);
  return labels.map((l) => textWidthOrEstimate(l, spec, style.fontSize));
}

const rowLabelTextWidth = computed(() =>
  props.rowAxis === "none" ? 0 : Math.max(0, ...labelWidths(props.rows)),
);

/** Pixels available for the row label text (capped at 40% of the chart). */
const rowLabelMaxWidth = computed(() =>
  props.rowAxis === "none"
    ? 0
    : (props.rowLabelWidth ??
      Math.min(rowLabelTextWidth.value, width.value * 0.4)),
);

/** Pixels left of the plot for the row labels and their gap. */
const rowLabelSpace = computed(() =>
  props.rowAxis === "none" ? 0 : rowLabelMaxWidth.value + ROW_LABEL_GAP,
);

const userPadding = () => resolvePadding(props.chartPadding);

// The plot width is derived here, not read back from the foundation,
// because the column labels feed the padding the foundation computes
// `innerW` from.
const baseLeftPadding = computed(
  () =>
    rowLabelSpace.value +
    (props.yLabel ? Y_LABEL_WIDTH : BASE_LEFT) +
    userPadding().left,
);
const baseRightPadding = computed(
  () => CARTESIAN_RIGHT_PADDING + userPadding().right,
);
const basePlotWidth = computed(
  () => width.value - baseLeftPadding.value - baseRightPadding.value,
);

const columnLabelWidths = computed(() =>
  props.columnAxis === "none" ? [] : labelWidths(props.columns),
);
const columnLabelWidest = computed(() =>
  Math.max(0, ...columnLabelWidths.value),
);

/**
 * Counter-clockwise, a label reads upward to the right: from a bottom tick
 * it ends at the tick, from a top tick it starts there. Clockwise it reads
 * downward, so the anchors swap.
 */
function columnLabelAnchor(angle: number): "start" | "end" {
  return (props.columnAxis === "top") === angle < 0 ? "start" : "end";
}

/**
 * Widest column label text at `angle` that keeps the labels within their
 * share of a fixed height. An auto-height chart grows instead, so nothing
 * is cut.
 */
function columnLabelMaxWidthAt(angle: number): number {
  if (props.height === undefined && !isFullscreen.value) return Infinity;
  return labelWidthForExtent(
    height.value * COLUMN_LABEL_MAX_EXTENT,
    tickLabelResolved.value.fontSize,
    angle,
  );
}

/** Side padding that keeps labels at `angle` inside the chart, capped. */
function columnOverhangAt(angle: number, pitch: number) {
  // Labels a fixed height shortens need no room for their full width.
  const maxWidth = columnLabelMaxWidthAt(angle);
  const overhang = columnLabelSidePadding({
    widths: columnLabelWidths.value.map((w) => Math.min(w, maxWidth)),
    fontSize: tickLabelResolved.value.fontSize,
    angle,
    side: columnLabelAnchor(angle) === "start" ? "right" : "left",
    pitch,
    leftRoom: baseLeftPadding.value,
    rightRoom: baseRightPadding.value,
  });
  const cap = width.value * COLUMN_LABEL_MAX_OVERHANG;
  return {
    left: Math.min(overhang.left, cap),
    right: Math.min(overhang.right, cap),
  };
}

/** The column labels' angle and the side padding their overhang needs. */
const columnLabelLayout = computed(() => {
  const count = columnCount.value;
  if (props.columnAxis === "none" || count === 0) {
    return { angle: 0, left: 0, right: 0 };
  }
  const pitch = basePlotWidth.value / count;
  if (props.columnLabelAngle !== "auto") {
    const angle = normalizeLabelAngle(props.columnLabelAngle);
    return { angle, ...columnOverhangAt(angle, pitch) };
  }
  const widest = columnLabelWidest.value;
  const fontSize = tickLabelResolved.value.fontSize;
  const angle = pickLabelAngle(widest, pitch, fontSize);
  const overhang = columnOverhangAt(angle, pitch);
  // Padding for the overhang narrows the columns, which can tip the pick
  // to a steeper angle; settle on that one instead of going back and forth.
  const narrowedPitch =
    (basePlotWidth.value - overhang.left - overhang.right) / count;
  const narrowedAngle = pickLabelAngle(widest, narrowedPitch, fontSize);
  if (narrowedAngle === angle) return { angle, ...overhang };
  return { angle: narrowedAngle, ...columnOverhangAt(narrowedAngle, pitch) };
});

const columnAngle = computed(() => columnLabelLayout.value.angle);

const leftPadding = computed(
  () => baseLeftPadding.value + columnLabelLayout.value.left,
);

/** The x-axis title joins the column labels when they sit on top. */
const xLabelOnTop = computed(
  () => !!props.xLabel && props.columnAxis === "top",
);

const columnLabelMaxWidth = computed(() =>
  columnLabelMaxWidthAt(columnAngle.value),
);

/** Width of the widest column label as drawn (after truncation). */
const columnLabelDrawnWidest = computed(() =>
  Math.min(columnLabelWidest.value, columnLabelMaxWidth.value),
);

/** Room the column labels need beyond the plot's edge. */
const columnLabelExtent = computed(() =>
  props.columnAxis === "none"
    ? 0
    : rotatedLabelExtent(
        columnLabelDrawnWidest.value,
        tickLabelResolved.value.fontSize,
        columnAngle.value,
      ),
);

/**
 * The foundation pads for the cartesian charts' tick labels
 * (`CARTESIAN_LEFT_PADDING` / `CARTESIAN_BOTTOM_PADDING`). A heatmap's
 * labels have measured widths instead, so the difference (either sign) is
 * passed as the extra padding, with the user's `chartPadding` on top.
 */
const effectiveChartPadding = computed<ChartPadding>(() => {
  const user = userPadding();
  const baseLeft = props.yLabel
    ? CARTESIAN_LEFT_PADDING.withYLabel
    : CARTESIAN_LEFT_PADDING.plain;
  const baseBottom = props.xLabel
    ? CARTESIAN_BOTTOM_PADDING.withXLabel
    : CARTESIAN_BOTTOM_PADDING.plain;
  const top =
    (props.columnAxis === "top"
      ? columnLabelExtent.value + COLUMN_LABEL_GAP + 4
      : props.rowHeader && props.rowAxis !== "none"
        ? tickLabelResolved.value.fontSize + 8
        : 0) + (xLabelOnTop.value ? axisLabelResolved.value.fontSize + 6 : 0);
  const bottomLabels =
    props.columnAxis === "bottom"
      ? columnLabelExtent.value + COLUMN_LABEL_GAP
      : 0;
  const bottom = bottomLabels + (props.xLabel && !xLabelOnTop.value ? 20 : 8);
  return {
    top: top + user.top,
    right: user.right + columnLabelLayout.value.right,
    bottom: bottom - baseBottom + user.bottom,
    left: leftPadding.value - baseLeft,
  };
});

// --- Foundation ------------------------------------------------------------

const {
  containerRef,
  svgRef,
  width,
  height,
  padding,
  legendY,
  bottomLegendHeight,
  inlineLegendLayout,
  innerW,
  innerH,
  bounds,
  hoverIndex,
  tooltipRef,
  tooltipPos,
  tooltipHandlers,
  menuItems,
  menuAnnouncement,
  downloadLinkText,
  csvHref,
  downloadButtonText,
  triggerCsvDownload,
  menuFilename,
  isFullscreen,
  fullscreenStyle,
  teleportTarget,
  exitFullscreen,
} = useChartFoundation({
  width: () => props.width,
  height: () => props.height ?? autoHeight.value,
  title: () => props.title,
  titleStyle: () => props.titleStyle,
  xLabel: () => props.xLabel,
  yLabel: () => props.yLabel,
  debounce: () => props.debounce,
  menu: () => props.menu,
  tooltipTrigger: () => props.tooltipTrigger,
  tooltipClamp: () => props.tooltipClamp,
  filename: () => props.filename,
  menuItems: () => props.menuItems,
  downloadLink: () => props.downloadLink,
  downloadButton: () => props.downloadButton,
  fullscreenTarget: () => props.fullscreenTarget,
  chartPadding: () => effectiveChartPadding.value,
  inlineLegendLabels: () => inlineLegendLabels.value,
  legendPosition: () => props.legendPosition,
  hasTooltipSlot: () => hasTooltipSlot.value,
  getCsv: toCsv,
  pointerToIndex,
  onHover: (payload) => emit("hover", payload),
});

/** Height that gives every row `cellHeight` pixels, when `height` is unset. */
const autoHeight = computed(
  () =>
    padding.value.top +
    padding.value.bottom +
    Math.max(1, rowCount.value) * props.cellHeight,
);

// --- Legend ----------------------------------------------------------------

function legendTextWidth(text: string): number {
  const style = legendResolved.value;
  return textWidthOrEstimate(text, font(style), style.fontSize);
}

const scaleLegend = computed<ColorScaleLegendLayout | null>(() => {
  const scale = colorScaleResolved.value;
  if (!scale?.legend) return null;
  return layoutColorScaleLegend(
    scale.label,
    scale.format(scale.domain[0]),
    scale.format(scale.domain[scale.domain.length - 1]),
    legendTextWidth,
  );
});

const inlineLegendLabels = computed<InlineLegendLabel[]>(() =>
  scaleLegend.value ? [{ width: scaleLegend.value.width }] : [],
);

const positionedLegend = computed(() => {
  const layout = scaleLegend.value;
  if (!layout) return null;
  return positionLegendItems(
    [{ layout }],
    inlineLegendLayout.value.positions,
    padding.value.left,
    legendY.value,
  )[0];
});

// --- Cells -----------------------------------------------------------------

const cellW = computed(() =>
  columnCount.value > 0 ? innerW.value / columnCount.value : 0,
);
const cellH = computed(() =>
  rowCount.value > 0 ? innerH.value / rowCount.value : 0,
);

const cellLabelStyle = computed(() => {
  const l = props.cellLabels;
  if (!l) return null;
  const style = typeof l === "object" ? l : {};
  const fontSize = style.fontSize ?? 11;
  return {
    fontSize,
    fontWeight: style.fontWeight,
    color: style.color,
    format:
      style.format !== undefined
        ? (v: number) => formatNumber(v, style.format)
        : formatValue.value,
    font: font({ fontSize, fontWeight: style.fontWeight }),
  };
});

interface RenderedCell extends HeatmapCell {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  /** The drawn fill: the scale color, else `missingColor`, else nothing. */
  fill: string | undefined;
  label?: { text: string; fill: string };
}

function cellGeometry(r: number, c: number) {
  const gap = props.cellGap;
  const w = cellW.value;
  const h = cellH.value;
  return {
    x: padding.value.left + c * w + gap / 2,
    y: padding.value.top + r * h + gap / 2,
    w: Math.max(0, w - gap),
    h: Math.max(0, h - gap),
    cx: padding.value.left + (c + 0.5) * w,
    cy: padding.value.top + (r + 0.5) * h,
  };
}

const cells = computed<RenderedCell[]>(() => {
  const out: RenderedCell[] = [];
  const scale = colorScaleResolved.value;
  const labels = cellLabelStyle.value;
  const rows = props.rows;
  const columns = props.columns;
  const gap = props.cellGap;
  const labelRoom = cellW.value - gap - 6;
  const labelsFit = labels ? labels.fontSize + 2 <= cellH.value - gap : false;
  // Most cells share a few formatted strings; measure each string once.
  const widths = new Map<string, number>();
  const fits = (text: string) => {
    let w = widths.get(text);
    if (w === undefined) {
      w = textWidthOrEstimate(text, labels!.font, labels!.fontSize);
      widths.set(text, w);
    }
    return w <= labelRoom;
  };
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < columns.length; c++) {
      const value = valueAt(r, c);
      const finite = Number.isFinite(value);
      const color = finite && scale ? scale.colorAt(value) : undefined;
      const geo = cellGeometry(r, c);
      const cell: RenderedCell = {
        rowIndex: r,
        columnIndex: c,
        row: rows[r],
        column: columns[c],
        value,
        color,
        fill: color ?? (finite ? undefined : props.missingColor),
        ...geo,
      };
      if (labels && finite && labelsFit) {
        const text = labels.format(value);
        if (fits(text)) {
          cell.label = {
            text,
            fill: labels.color ?? pickContrastColor(color ?? "#ffffff"),
          };
        }
      }
      out.push(cell);
    }
  }
  return out;
});

function cellAt(index: number): RenderedCell | undefined {
  return cells.value[index];
}

const hoverCell = computed(() =>
  hoverIndex.value === null ? undefined : cellAt(hoverIndex.value),
);

// --- Axis labels -----------------------------------------------------------

/** Every k-th label, so neighbors keep clear of each other. */
function thinned(count: number, footprint: number, pitch: number): number[] {
  const k = pitch > 0 ? Math.max(1, Math.ceil(footprint / pitch)) : 1;
  const out: number[] = [];
  for (let i = 0; i < count; i += k) out.push(i);
  return out;
}

const rowLabelX = computed(() => padding.value.left - ROW_LABEL_GAP);

const rowLabelItems = computed(() => {
  if (props.rowAxis === "none") return [];
  const style = tickLabelResolved.value;
  const maxW = rowLabelMaxWidth.value;
  const needsTruncate = rowLabelTextWidth.value > maxW;
  const spec = needsTruncate ? font(style) : "";
  const measure = (s: string) => textWidthOrEstimate(s, spec, style.fontSize);
  return thinned(rowCount.value, style.fontSize + 2, cellH.value).map((i) => {
    const raw = props.rows[i];
    return {
      index: i,
      raw,
      label: needsTruncate ? truncateLabel(raw, maxW, measure) : raw,
      y: padding.value.top + (i + 0.5) * cellH.value,
    };
  });
});

interface ColumnLabelItem {
  index: number;
  /** The full label, which `label` shortens when it would not fit. */
  raw: string;
  label: string;
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  baseline: string | undefined;
  transform: string | undefined;
}

const columnLabelItems = computed<ColumnLabelItem[]>(() => {
  if (props.columnAxis === "none") return [];
  const style = tickLabelResolved.value;
  const fontSize = style.fontSize;
  const angle = columnAngle.value;
  const top = props.columnAxis === "top";
  const anchor = columnLabelAnchor(angle);
  const widths = columnLabelWidths.value;
  const spec = font(style);
  const measure = (s: string) => textWidthOrEstimate(s, spec, fontSize);
  const footprint = rotatedLabelFootprint(
    columnLabelDrawnWidest.value,
    fontSize,
    angle,
  );
  const edge = top ? padding.value.top : padding.value.top + innerH.value;
  return thinned(columnCount.value, footprint, cellW.value).map((i) => {
    const x = padding.value.left + (i + 0.5) * cellW.value;
    // Room to the chart edge the label reaches toward (both, when flat).
    const toLeft = x;
    const toRight = width.value - x;
    const room =
      angle === 0
        ? Math.min(toLeft, toRight)
        : anchor === "start"
          ? toRight
          : toLeft;
    const maxWidth = Math.min(
      columnLabelMaxWidth.value,
      labelWidthForReach(room, fontSize, angle),
    );
    const raw = props.columns[i];
    // Half a pixel of slack: a label the side padding was sized for sits
    // exactly at its limit, give or take float rounding.
    const label =
      widths[i] > maxWidth + 0.5 ? truncateLabel(raw, maxWidth, measure) : raw;
    if (angle === 0) {
      return {
        index: i,
        raw,
        label,
        x,
        y: top
          ? edge - COLUMN_LABEL_GAP - 2
          : edge + COLUMN_LABEL_GAP + fontSize,
        anchor: "middle" as const,
        baseline: undefined,
        transform: undefined,
      };
    }
    const y = top ? edge - COLUMN_LABEL_GAP : edge + COLUMN_LABEL_GAP;
    return {
      index: i,
      raw,
      label,
      x,
      y,
      anchor,
      baseline: "central",
      transform: `rotate(${angle}, ${x}, ${y})`,
    };
  });
});

const rowHeaderY = computed(() => padding.value.top - COLUMN_LABEL_GAP - 2);

/** Baseline of the x-axis title above the column labels (`xLabelOnTop`). */
const xLabelTopY = computed(
  () =>
    padding.value.top - (columnLabelExtent.value + COLUMN_LABEL_GAP + 4) - 6,
);

// --- Interaction -----------------------------------------------------------

const instance = getCurrentInstance();

// The vnode's props are not reactive, so these are read on each render
// instead of being cached in a computed.
function hasListener(camel: string, kebab: string): boolean {
  const vnodeProps = instance?.vnode.props;
  return !!(vnodeProps?.[camel] ?? vnodeProps?.[kebab]);
}
function hasRowClick(): boolean {
  return props.interactive || hasListener("onRowClick", "onRow-click");
}
function hasColumnClick(): boolean {
  return hasListener("onColumnClick", "onColumn-click");
}

function pointerToIndex(clientX: number, clientY: number): number | null {
  const rect = svgRef.value?.getBoundingClientRect();
  if (!rect || cellW.value <= 0 || cellH.value <= 0) return null;
  const c = Math.floor(
    (clientX - rect.left - padding.value.left) / cellW.value,
  );
  const r = Math.floor((clientY - rect.top - padding.value.top) / cellH.value);
  if (c < 0 || c >= columnCount.value || r < 0 || r >= rowCount.value) {
    return null;
  }
  return r * columnCount.value + c;
}

function publicCell(cell: RenderedCell): HeatmapCell {
  const { rowIndex, columnIndex, row, column, value, color } = cell;
  return { rowIndex, columnIndex, row, column, value, color };
}

const overlayHandlers = {
  ...tooltipHandlers,
  click: (e: MouseEvent) => {
    tooltipHandlers.click(e);
    const i = pointerToIndex(e.clientX, e.clientY);
    const cell = i === null ? undefined : cellAt(i);
    if (cell) emit("cellClick", publicCell(cell));
  },
};

/** The cell (or row label, column -1) holding the roving tabindex. */
const focusPos = ref({ row: 0, column: 0 });

/** `focusPos` clamped to the current grid, so a tab stop always exists. */
const focusStop = computed(() => ({
  row: Math.max(0, Math.min(rowCount.value - 1, focusPos.value.row)),
  column: Math.max(
    props.rowAxis === "none" ? 0 : -1,
    Math.min(columnCount.value - 1, focusPos.value.column),
  ),
}));

function isFocusStop(row: number, column: number): boolean {
  return focusStop.value.row === row && focusStop.value.column === column;
}

function cellButton(row: number, column: number): HTMLButtonElement | null {
  return (
    containerRef.value?.querySelector<HTMLButtonElement>(
      `[data-cell="${row}:${column}"]`,
    ) ?? null
  );
}

function onCellKeydown(row: number, column: number, event: KeyboardEvent) {
  const next = moveCell(
    { row, column },
    event.key,
    rowCount.value,
    columnCount.value,
    props.rowAxis !== "none",
  );
  if (!next) return;
  event.preventDefault();
  focusPos.value = next;
  nextTick(() => cellButton(next.row, next.column)?.focus());
}

/** Show the tooltip for a focused cell as if the pointer sat on its center. */
function onCellFocus(row: number, column: number) {
  focusPos.value = { row, column };
  const svg = svgRef.value;
  const cell =
    column < 0 ? undefined : cellAt(row * columnCount.value + column);
  // A row label has no tooltip: drop the one a neighboring cell left up.
  if (!svg || !cell) {
    onCellBlur();
    return;
  }
  const rect = svg.getBoundingClientRect();
  tooltipHandlers.mousemove({
    clientX: rect.left + cell.cx,
    clientY: rect.top + cell.cy,
  } as MouseEvent);
}

function onCellBlur() {
  if (hoverIndex.value !== null) {
    hoverIndex.value = null;
    emit("hover", null);
  }
}

function cellButtonLabel(cell: RenderedCell): string {
  const v = Number.isFinite(cell.value) ? formatValue.value(cell.value) : "—";
  return `${cell.row}, ${cell.column}: ${v}`;
}

const hoverSlotProps = computed<HeatmapTooltipProps | null>(() => {
  const idx = hoverIndex.value;
  const cell = hoverCell.value;
  if (idx === null || !cell) return null;
  const values: ChartTooltipValue[] = [
    {
      value: cell.value,
      color: cell.fill ?? "transparent",
      seriesIndex: cell.columnIndex,
      label: cell.column,
    },
  ];
  return {
    ...publicCell(cell),
    index: idx,
    values,
    intervals: [],
    data: props.tooltipData?.[idx],
    title: props.tooltipTitle ? props.tooltipTitle(cell.row, idx) : cell.row,
    format: tooltipFormat,
  };
});

// --- CSV -------------------------------------------------------------------

function toCsv(): string {
  const override = resolveCsvOverride(props.csv);
  if (override !== null) return override;
  const series = props.columns.map((label, c) => ({
    label,
    data: props.rows.map((_, r) => valueAt(r, c)),
  }));
  return categoricalToCsv(props.rows, series, props.yLabel || "row");
}
</script>

<template>
  <Teleport :to="teleportTarget" :disabled="!isFullscreen">
    <div
      ref="containerRef"
      v-bind="$attrs"
      class="heatmap-wrapper"
      :class="{ 'is-fullscreen': isFullscreen, 'is-interactive': interactive }"
      :style="fullscreenStyle"
    >
      <ChartMenu
        v-if="menu"
        :items="menuItems"
        :is-fullscreen="isFullscreen"
        @close="exitFullscreen"
      />
      <div class="chart-sr-only" aria-live="polite">
        {{
          menuAnnouncement ||
          (isFullscreen ? "Chart expanded to fill window" : "")
        }}
      </div>
      <!--
        Keyboard access: one button per cell (and row label) laid over the
        svg, which is exposed as a single image. Pointer events pass
        through to the plot, so hover and click behave the same either way.
        The buttons share a wrapper with the svg so their offsets are svg
        coordinates, whatever padding or centering surrounds the chart.
      -->
      <div class="heatmap-plot">
        <div
          v-if="interactive"
          class="heatmap-cells"
          role="group"
          :aria-label="`${chartAriaLabel ?? 'Heatmap'} cells`"
        >
          <template v-for="(row, r) in rows" :key="r">
            <button
              v-if="rowAxis !== 'none'"
              type="button"
              class="heatmap-cell-button heatmap-row-button"
              :data-cell="`${r}:-1`"
              :tabindex="isFocusStop(r, -1) ? 0 : -1"
              :aria-label="row"
              :style="{
                left: `${padding.left - rowLabelSpace}px`,
                top: `${padding.top + r * cellH}px`,
                width: `${rowLabelSpace - 2}px`,
                height: `${cellH}px`,
              }"
              @click="$emit('rowClick', { index: r, label: row })"
              @keydown="onCellKeydown(r, -1, $event)"
              @focus="onCellFocus(r, -1)"
            />
            <button
              v-for="(column, c) in columns"
              :key="c"
              type="button"
              class="heatmap-cell-button"
              :data-cell="`${r}:${c}`"
              :tabindex="isFocusStop(r, c) ? 0 : -1"
              :aria-label="cellButtonLabel(cells[r * columnCount + c])"
              :style="{
                left: `${padding.left + c * cellW}px`,
                top: `${padding.top + r * cellH}px`,
                width: `${cellW}px`,
                height: `${cellH}px`,
              }"
              @click="
                $emit('cellClick', publicCell(cells[r * columnCount + c]))
              "
              @keydown="onCellKeydown(r, c, $event)"
              @focus="onCellFocus(r, c)"
              @blur="onCellBlur"
            />
          </template>
        </div>
        <svg
          ref="svgRef"
          :width="width"
          :height="height"
          :role="chartRole || undefined"
          :aria-label="chartAriaLabel || undefined"
        >
          <defs v-if="colorScaleResolved">
            <linearGradient :id="`${gradientId}-ramp`">
              <stop
                v-for="(st, j) in rampStops"
                :key="j"
                :offset="st.offset"
                :stop-color="st.color"
              />
            </linearGradient>
          </defs>
          <ChartTitle
            :title="title"
            :title-style="titleStyle"
            :bounds="bounds"
          />
          <ChartColorScaleLegend
            v-if="positionedLegend"
            :layout="positionedLegend.layout"
            :x="positionedLegend.x"
            :y="positionedLegend.y"
            :fill="`url(#${gradientId}-ramp)`"
            :font-size="legendResolved.fontSize"
            :text-fill="legendResolved.fill"
            :font-weight="legendResolved.fontWeight"
          />
          <!-- row labels -->
          <text
            v-for="item in rowLabelItems"
            :key="'r' + item.index"
            data-testid="row-label"
            class="heatmap-axis-label"
            :class="{ 'is-clickable': hasRowClick() }"
            :x="rowLabelX"
            :y="item.y"
            text-anchor="end"
            dominant-baseline="middle"
            :font-size="tickLabelResolved.fontSize"
            :fill="tickLabelResolved.fill"
            :font-weight="tickLabelResolved.fontWeight"
            :fill-opacity="tickLabelResolved.fillOpacity"
            @click="$emit('rowClick', { index: item.index, label: item.raw })"
          >
            {{ item.label }}
          </text>
          <text
            v-if="rowHeader && rowAxis !== 'none'"
            data-testid="row-header"
            :x="rowLabelX"
            :y="rowHeaderY"
            text-anchor="end"
            :font-size="tickLabelResolved.fontSize"
            :fill="tickLabelResolved.fill"
            font-weight="600"
            :fill-opacity="tickLabelResolved.fillOpacity"
          >
            {{ rowHeader }}
          </text>
          <!-- column labels -->
          <text
            v-for="item in columnLabelItems"
            :key="'c' + item.index"
            data-testid="column-label"
            class="heatmap-axis-label"
            :class="{ 'is-clickable': hasColumnClick() }"
            :x="item.x"
            :y="item.y"
            :text-anchor="item.anchor"
            :dominant-baseline="item.baseline"
            :transform="item.transform"
            :font-size="tickLabelResolved.fontSize"
            :fill="tickLabelResolved.fill"
            :font-weight="tickLabelResolved.fontWeight"
            :fill-opacity="tickLabelResolved.fillOpacity"
            @click="
              $emit('columnClick', { index: item.index, label: item.raw })
            "
          >
            {{ item.label }}
          </text>
          <text
            v-if="xLabelOnTop"
            data-testid="x-label-top"
            :x="
              xLabelAlign === 'left' ? padding.left : padding.left + innerW / 2
            "
            :y="xLabelTopY"
            :text-anchor="xLabelAlign === 'left' ? 'start' : 'middle'"
            :font-size="axisLabelResolved.fontSize"
            :fill="axisLabelResolved.fill"
            :font-weight="axisLabelResolved.fontWeight"
          >
            {{ xLabel }}
          </text>
          <ChartAxisLabels
            :x-label="xLabelOnTop ? undefined : xLabel"
            :x-label-align="xLabelAlign"
            :y-label="yLabel"
            :padding="padding"
            :inner-w="innerW"
            :inner-h="innerH"
            :height="height - bottomLegendHeight"
            :label-style="axisLabelResolved"
          />
          <!-- cells -->
          <g>
            <template
              v-for="cell in cells"
              :key="cell.rowIndex + ':' + cell.columnIndex"
            >
              <rect
                v-if="cell.fill"
                data-testid="cell"
                :data-row="cell.rowIndex"
                :data-column="cell.columnIndex"
                :x="cell.x"
                :y="cell.y"
                :width="cell.w"
                :height="cell.h"
                :rx="cellRadius || undefined"
                :fill="cell.fill"
                :stroke="cellStroke"
                :stroke-width="cellStroke ? cellStrokeWidth : undefined"
              />
            </template>
          </g>
          <g v-if="cellLabelStyle" pointer-events="none">
            <template
              v-for="cell in cells"
              :key="cell.rowIndex + ':' + cell.columnIndex"
            >
              <text
                v-if="cell.label"
                data-testid="cell-label"
                :x="cell.cx"
                :y="cell.cy"
                text-anchor="middle"
                dominant-baseline="central"
                :font-size="cellLabelStyle.fontSize"
                :font-weight="cellLabelStyle.fontWeight"
                :fill="cell.label.fill"
              >
                {{ cell.label.text }}
              </text>
            </template>
          </g>
          <!-- hovered / focused cell outline -->
          <rect
            v-if="hoverCell && hasTooltipSlot"
            data-testid="cell-highlight"
            :x="hoverCell.x"
            :y="hoverCell.y"
            :width="hoverCell.w"
            :height="hoverCell.h"
            :rx="cellRadius || undefined"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            pointer-events="none"
          />
          <!-- hit-test overlay -->
          <rect
            data-testid="chart-overlay"
            :x="padding.left"
            :y="padding.top"
            :width="Math.max(0, innerW)"
            :height="Math.max(0, innerH)"
            fill="transparent"
            style="touch-action: pan-y"
            v-on="overlayHandlers"
          />
        </svg>
      </div>
      <div
        v-if="hasTooltipSlot && hoverIndex !== null && hoverSlotProps"
        ref="tooltipRef"
        class="chart-tooltip-content"
        :style="{
          position: 'absolute',
          top: '0',
          left: '0',
          willChange: 'transform',
          transform: tooltipPos
            ? `translate3d(${tooltipPos.left}px, ${tooltipPos.top}px, 0) translateY(-50%)`
            : 'translateY(-50%)',
          visibility: tooltipPos ? 'visible' : 'hidden',
        }"
      >
        <slot name="tooltip" v-bind="hoverSlotProps">
          <ChartTooltipContent
            :title="hoverSlotProps.title"
            :values="hoverSlotProps.values"
            :format="hoverSlotProps.format"
            show-missing
          />
        </slot>
      </div>
      <a
        v-if="downloadLinkText"
        class="heatmap-download-link"
        :href="csvHref!"
        :download="`${menuFilename()}.csv`"
      >
        {{ downloadLinkText }}
      </a>
      <button
        v-if="downloadButtonText"
        type="button"
        class="heatmap-download-button"
        @click="triggerCsvDownload"
      >
        {{ downloadButtonText }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.heatmap-wrapper {
  position: relative;
  width: 100%;
}

.heatmap-axis-label.is-clickable {
  cursor: pointer;
}

.heatmap-plot {
  position: relative;
}

.heatmap-cells {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 0;
  z-index: 1;
}

.heatmap-cell-button {
  position: absolute;
  padding: 0;
  border: 0;
  background: transparent;
  pointer-events: none;
}

.heatmap-cell-button:focus-visible {
  outline: 2px solid var(--color-primary, #0057b7);
  outline-offset: -2px;
}

.heatmap-download-link {
  display: block;
  text-align: right;
  font-size: var(--font-size-sm);
  margin-top: 0.25em;
}
</style>

<style>
.heatmap-download-button {
  display: inline-flex;
  align-items: center;
  margin-top: 0.5em;
  padding: 0.5em 1em;
  border: 1px solid var(--color-border);
  border-radius: 0.25em;
  background: var(--color-bg-0, #fff);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.heatmap-download-button:hover {
  background: var(--color-bg-1, rgba(0, 0, 0, 0.05));
}

.heatmap-download-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>
