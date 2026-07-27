<script setup lang="ts">
import { computed } from "vue";
import { formatNumber, type NumberFormat } from "@cfasim-ui/shared";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import {
  snap,
  formatTick,
  computeTickValues,
  computeLogTickValues,
  scaleFraction,
  clampExtentForScale,
  categoricalToCsv,
  resolveCsvOverride,
  useChartFoundation,
  useChartCommon,
  makeTooltipValueFormatter,
  ChartAnnotations,
  ChartAxisLabels,
  ChartTitle,
  positionLegendItems,
  TICK_LABEL_FONT_SIZE,
  pickContrastColor,
  parseDate,
  isAllDates,
  pickDateTicks,
  formatDate,
  type ChartData,
  type DateFormat,
  type ChartCommonProps,
  type ChartHoverPayload,
  type ChartTooltipBaseProps,
  type ChartTooltipValue,
  type BlendMode,
  type LineMarkStyle,
  type LabelStyle,
  type ChartPadding,
} from "../_shared/index.js";

export type BarChartData = ChartData;

export interface BarSeries {
  /** Bar values; one entry per category. `y` is accepted as an alias. */
  y?: BarChartData;
  data?: BarChartData;
  color?: string;
  opacity?: number;
  /**
   * CSS `mix-blend-mode` applied to each bar in this series. Lets
   * overlapping bars (e.g. `layout="overlay"`) combine their colors
   * instead of one obscuring the other.
   */
  blendMode?: BlendMode;
  /** Label shown in the inline legend. */
  legend?: string;
  /**
   * Whether this series appears in the inline legend. Defaults to true.
   * Has no effect when `legend` is unset (no legend entry to begin with).
   */
  showInLegend?: boolean;
  /**
   * Whether this series contributes a value to the tooltip. Defaults to
   * true. The bars are still drawn.
   */
  showInTooltip?: boolean;
}

/**
 * A line overlay drawn on top of the bars — e.g. a KDE over a histogram,
 * a rolling mean, or any other summary curve. Each line scales to its
 * own value extent (independent of the bars), so a probability-density
 * curve in `[0, 0.02]` and a count histogram in `[0, 500]` can coexist.
 *
 * Sample the curve densely on the input side — `summaryLines` connects
 * points with straight segments (matching matplotlib / seaborn `kde=True`).
 *
 * Shares visual styling (`color`, `strokeWidth`, `dashed`, `opacity`,
 * `blendMode`, `dots`, `dotRadius`, `legend`, `showInLegend`) with
 * `LineChart`'s `Series` via `LineMarkStyle`.
 */
export interface BarSummaryLine extends LineMarkStyle {
  /** Y values along the line. */
  data: BarChartData;
  /**
   * X positions in category-index space (0 = first category center,
   * `categories.length - 1` = last). Fractional values land between
   * category centers. When omitted, points plot at successive category
   * centers — one point per `data` entry.
   */
  x?: BarChartData;
  /**
   * Override the line's value-axis floor. When unset, defaults to the
   * line's own min (clamped to 0 when all data is non-negative).
   */
  valueMin?: number;
  /** Override the line's value-axis ceiling. Defaults to the line's own max. */
  valueMax?: number;
}

/** Context passed to a `barLabels.format` function. */
export interface BarLabelContext {
  value: number;
  categoryIndex: number;
  seriesIndex: number;
  /** The resolved category label string. */
  category: string;
}

/**
 * Styling and behavior for value labels drawn directly on the bars (an
 * alternative to reading values off the value axis — see `valueAxis`).
 * Most useful with `layout="stacked"`, where each segment carries its own
 * value. Extends `LabelStyle` (`fontSize` / `fontWeight`).
 */
export interface BarLabelStyle extends LabelStyle {
  /**
   * How to turn a bar's numeric value into label text. A `NumberFormat`
   * (preset/printf/function), or a function receiving `(value, context)`
   * for fully custom strings (e.g. `">99%"`). Return `""` to omit a
   * label. When unset, falls back to `valueTickFormat`, then a default.
   */
  format?: NumberFormat | ((value: number, ctx: BarLabelContext) => string);
  /**
   * Label text color. `"auto"` (default) picks white or near-black per
   * segment by the fill's luminance for readable contrast; outside-placed
   * labels use the chart's text color. Any other CSS color is used as-is
   * for every label.
   */
  color?: string;
  /**
   * Where to draw each label. `"auto"` (default) centers it inside the
   * segment when the text fits, otherwise just past the segment's
   * high-value edge. `"inside"` / `"outside"` force one placement.
   */
  placement?: "auto" | "inside" | "outside";
  /**
   * Alignment of an *inside* label along the value axis. `"center"`
   * (default) centers it in its segment; `"start"` pins it to the
   * segment's low-value edge (left edge for horizontal bars); `"end"`
   * pins it to the high-value edge. Outside/overflow labels ignore this
   * and always sit just past the high-value edge.
   */
  align?: "start" | "center" | "end";
  /**
   * How to handle labels that would collide along the value axis (common
   * with many small adjacent segments). `"shift"` (default) nudges them
   * apart toward higher values; `"hide"` drops the colliding label. Either
   * way, a label pushed past the chart edge is hidden.
   */
  overlap?: "shift" | "hide";
  /**
   * Segments smaller than this many pixels (along the value axis) never
   * get an *inside* label — they fall back to outside placement (or hide,
   * per `overlap`). Use to suppress labels crammed into thin slivers.
   * Default 0 (size alone never forces a label out; text fit still does).
   */
  minSize?: number;
}

interface BarChartProps extends ChartCommonProps {
  /** Single-series values. Equivalent to `y`. */
  data?: BarChartData;
  /** Single-series values (alias for `data`). */
  y?: BarChartData;
  /** Multi-series mode. Each series has its own values. */
  series?: BarSeries[];
  /**
   * Line overlays drawn on top of the bars (e.g. a KDE, a rolling mean,
   * or any summary curve). Each line scales to its own value extent —
   * unrelated to the bar value axis. See `BarSummaryLine`.
   */
  summaryLines?: BarSummaryLine[];
  /**
   * Category labels for the categorical axis. Length should match the
   * longest series. When omitted, indices (0, 1, 2, ...) are used.
   * Accepts date strings or `Date` objects: when every category parses
   * as a date, label formatting switches to date mode (bar positions
   * stay ordinal — they are not time-proportional).
   */
  categories?: readonly (string | Date)[];
  /** "vertical" (default, aka column) draws upright bars; "horizontal" draws sideways. */
  orientation?: "vertical" | "horizontal";
  /**
   * "grouped" (default) places series side-by-side; "stacked" stacks
   * them; "overlay" draws each series at full group width from the
   * shared baseline, painting later series on top of earlier ones.
   * In overlay mode set `opacity` per series, or order series so the
   * tallest renders first, so bars behind remain visible.
   */
  layout?: "grouped" | "stacked" | "overlay";
  /** Force the value axis to start at this value or lower (default 0). */
  valueMin?: number;
  /**
   * Scale type for the value axis. `"linear"` (default) maps values
   * directly to pixels; `"log"` uses a base-10 log mapping. On a log
   * axis, non-positive values collapse to the visible minimum, and
   * `valueMin <= 0` is ignored. Stacked layout + log produces a
   * cumulative axis but individual segment sizes are no longer
   * proportional to their values.
   */
  valueScaleType?: "linear" | "log";
  /**
   * Tick placement on the value axis (numeric). Number = interval,
   * array = explicit values. When omitted, ticks are chosen automatically.
   */
  valueTicks?: number | number[];
  /**
   * Formatter for value-axis tick labels. Accepts a preset name, a
   * printf-style format string, or a function. See `formatNumber` in
   * `@cfasim-ui/shared`.
   */
  valueTickFormat?: NumberFormat;
  /** Formatter for category-axis labels. Receives the resolved category string. */
  categoryFormat?: (label: string, index: number) => string;
  /**
   * Alignment of the category labels in horizontal orientation. `"end"`
   * (default) right-aligns them against the plot's left edge; `"start"`
   * left-aligns them at the chart's left margin; `"center"` centers them
   * in the margin. The `categoryHeader`, if set, follows the same
   * alignment. Ignored in vertical orientation (labels stay centered
   * under each column).
   */
  categoryAlign?: "start" | "center" | "end";
  /**
   * Date-tick formatter for date-mode category labels (auto-detected
   * when every entry of `categories` parses as a date). Ignored unless
   * the axis is in date mode. Accepts a `DateFormat` — preset name,
   * `Intl.DateTimeFormatOptions`, or `(ms, unit?) => string`. When
   * omitted, the formatter is picked from the chosen tick unit (e.g.
   * monthly ticks → `"month-year"`). Has no effect when
   * `categoryFormat` is also set.
   */
  dateFormat?: DateFormat;
  /**
   * Fraction of each category slot reserved as gap between groups (0..1).
   * Default 0.2 — i.e. bars/groups fill 80% of their slot.
   */
  barPadding?: number;
  /**
   * Pixel gap between bars within a single category group in `grouped` layout.
   * Default 1.
   */
  groupGap?: number;
  valueGrid?: boolean;
  /**
   * Draw the value axis (its line and tick labels). Default true. Set
   * false for a clean "value-on-bar" look where each segment is labeled
   * via `barLabels` and there's no axis to read against.
   */
  valueAxis?: boolean;
  /**
   * Draw the numeric value directly on each bar instead of (or alongside)
   * reading it off the value axis. `true` uses defaults; pass a
   * `BarLabelStyle` to customize formatting, color, placement, and
   * overlap handling. Most useful with `layout="stacked"`.
   */
  barLabels?: boolean | BarLabelStyle;
  /**
   * Header drawn above the category labels (e.g. "Scenario"). Aligned to
   * match the category labels — right-edge-aligned in horizontal
   * orientation, centered under each column in vertical. Reserves a row
   * of space above the plot.
   */
  categoryHeader?: string;
  /**
   * Header drawn above the bars / value area (e.g. "Proportion of
   * simulations"), left-aligned to where the bars start. Pairs with
   * `categoryHeader` to label both columns of a value-on-bar chart.
   * Reserves a row of space above the plot.
   */
  valueHeader?: string;
}

const props = withDefaults(defineProps<BarChartProps>(), {
  orientation: "vertical",
  layout: "grouped",
  valueMin: 0,
  barPadding: 0.2,
  groupGap: 1,
  menu: true,
  tooltipClamp: "window",
  valueGrid: true,
  valueScaleType: "linear",
  valueAxis: true,
});

const {
  chartAriaLabel,
  chartRole,
  axisLabelResolved,
  tickLabelResolved,
  legendResolved,
  hasTooltipSlot,
} = useChartCommon(props);

// The template root is a <Teleport>, so fallthrough attrs (class, style,
// data-*, id…) can't auto-inherit — forward them onto the wrapper manually.
defineOptions({ inheritAttrs: false });

const emit = defineEmits<{
  (e: "hover", payload: ChartHoverPayload): void;
}>();

defineSlots<{
  tooltip?(props: ChartTooltipBaseProps & { category: string }): unknown;
}>();

const EMPTY_DATA: readonly number[] = [];

type ResolvedSeries = {
  data: BarChartData;
  color?: string;
  opacity?: number;
  blendMode?: BlendMode;
  legend?: string;
  showInLegend?: boolean;
  showInTooltip?: boolean;
};

function resolveSeries(s: BarSeries): ResolvedSeries {
  return {
    data: s.y ?? s.data ?? EMPTY_DATA,
    color: s.color,
    opacity: s.opacity,
    blendMode: s.blendMode,
    legend: s.legend,
    showInLegend: s.showInLegend,
    showInTooltip: s.showInTooltip,
  };
}

const allSeries = computed<ResolvedSeries[]>(() => {
  if (props.series && props.series.length > 0)
    return props.series.map(resolveSeries);
  const topY = props.y ?? props.data;
  if (topY) return [{ data: topY }];
  return [];
});

const categoryCount = computed(() => {
  let n = props.categories?.length ?? 0;
  for (const s of allSeries.value) {
    if (s.data.length > n) n = s.data.length;
  }
  return n;
});

const categoryLabels = computed<string[]>(() => {
  const n = categoryCount.value;
  const labels = new Array<string>(n);
  for (let i = 0; i < n; i++) {
    const c = props.categories?.[i];
    if (c instanceof Date) {
      // Stable string form for CSV / tooltip. Date axis formatting
      // (visible labels) goes through `categoryTickItems` separately.
      labels[i] = c.toISOString().slice(0, 10);
    } else {
      labels[i] = c ?? String(i);
    }
  }
  return labels;
});

/**
 * Parallel array of epoch-ms timestamps when every category parses as
 * a date, otherwise `null`. Drives both date-aware tick thinning and
 * the default tick label formatter.
 */
const categoryDatesMs = computed<number[] | null>(() => {
  const cats = props.categories;
  if (!cats || cats.length === 0) return null;
  if (!isAllDates(cats, "utc")) return null;
  const out = new Array<number>(cats.length);
  for (let i = 0; i < cats.length; i++) {
    out[i] = parseDate(cats[i], "utc") ?? NaN;
  }
  return out;
});

const isVertical = computed(() => props.orientation === "vertical");

/** Extent of the value axis (across all series, accounting for stacking). */
const valueExtent = computed(() => {
  let min = Infinity;
  let max = -Infinity;
  let smallestPositive = Infinity;
  const visitPositive = (v: number) => {
    if (v > 0 && v < smallestPositive) smallestPositive = v;
  };
  if (props.layout === "stacked") {
    const n = categoryCount.value;
    for (let i = 0; i < n; i++) {
      let pos = 0;
      let neg = 0;
      for (const s of allSeries.value) {
        if (i >= s.data.length) continue;
        const v = Number(s.data[i]);
        if (!isFinite(v)) continue;
        visitPositive(v);
        if (v >= 0) pos += v;
        else neg += v;
      }
      if (pos > max) max = pos;
      if (neg < min) min = neg;
    }
  } else {
    for (const s of allSeries.value) {
      for (const v of s.data) {
        const n = Number(v);
        if (!isFinite(n)) continue;
        visitPositive(n);
        if (n < min) min = n;
        if (n > max) max = n;
      }
    }
  }
  if (!isFinite(min)) min = 0;
  if (!isFinite(max)) max = 0;
  // Extend the value axis down to valueMin (default 0) when data sits
  // above it, so bars share a common baseline. On log scales, only
  // positive valueMin values are honored.
  const floor = props.valueMin ?? 0;
  if (props.valueScaleType === "log") {
    if (floor > 0 && floor < min) min = floor;
  } else if (floor < min) {
    min = floor;
  }
  const clamped = clampExtentForScale(
    min,
    max,
    props.valueScaleType,
    smallestPositive,
  );
  return {
    min: clamped.min,
    max: clamped.max,
    range: clamped.max - clamped.min || 1,
  };
});

/** Size (in pixels) of the categorical axis. */
const categoricalSize = computed(() =>
  isVertical.value ? innerW.value : innerH.value,
);
/** Size (in pixels) of the value axis. */
const valueSize = computed(() =>
  isVertical.value ? innerH.value : innerW.value,
);

const slotSize = computed(() => {
  const n = categoryCount.value;
  return n > 0 ? categoricalSize.value / n : 0;
});

/** Total width allocated to bars within one category slot. */
const groupWidth = computed(() => slotSize.value * (1 - props.barPadding));

/** Width of an individual bar (always; for stacked it's the full group). */
const barWidth = computed(() => {
  const k = allSeries.value.length;
  if (k === 0) return 0;
  if (props.layout === "stacked" || k === 1) return groupWidth.value;
  const totalGap = props.groupGap * (k - 1);
  return Math.max(1, (groupWidth.value - totalGap) / k);
});

/** Pixel position of the start of category slot `i` along the categorical axis. */
function slotStart(i: number): number {
  const base = isVertical.value ? padding.value.left : padding.value.top;
  return base + i * slotSize.value;
}

/**
 * Pixel position of the resting baseline for grouped bars — `valueMin`
 * (default 0) clamped to the visible value extent. This pins positive
 * and negative bars to a common zero line when data is mixed-sign, and
 * to the requested floor when `valueMin` is set inside the data range.
 */
const groupedBaselinePixel = computed(() => {
  const { min, max } = valueExtent.value;
  const target = props.valueMin ?? 0;
  return valuePixel(Math.max(min, Math.min(max, target)));
});

/** Convert a data value to its pixel position along the value axis. */
function valuePixel(v: number): number {
  const { min, max } = valueExtent.value;
  const frac = scaleFraction(v, min, max, props.valueScaleType);
  if (isVertical.value) {
    return padding.value.top + innerH.value - frac * innerH.value;
  }
  return padding.value.left + frac * innerW.value;
}

interface BarRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  opacity: number;
  blendMode?: BlendMode;
  value: number;
  categoryIndex: number;
  seriesIndex: number;
}

/**
 * Build one bar rectangle spanning [aPx..bPx] along the value axis and
 * [start..start+span] along the categorical axis. Orientation flips
 * which pair maps to (x, w) vs (y, h).
 */
function makeBar(
  aPx: number,
  bPx: number,
  start: number,
  span: number,
  color: string,
  opacity: number,
  blendMode: BlendMode | undefined,
  value: number,
  categoryIndex: number,
  seriesIndex: number,
): BarRect {
  const lo = Math.min(aPx, bPx);
  const size = Math.abs(aPx - bPx);
  if (isVertical.value) {
    return {
      x: start,
      y: lo,
      w: span,
      h: size,
      color,
      opacity,
      blendMode,
      value,
      categoryIndex,
      seriesIndex,
    };
  }
  return {
    x: lo,
    y: start,
    w: size,
    h: span,
    color,
    opacity,
    blendMode,
    value,
    categoryIndex,
    seriesIndex,
  };
}

const bars = computed<BarRect[]>(() => {
  const out: BarRect[] = [];
  const seriesList = allSeries.value;
  const k = seriesList.length;
  if (k === 0) return out;
  const n = categoryCount.value;
  const slot = slotSize.value;
  const group = groupWidth.value;
  const bw = barWidth.value;
  const innerOffset = (slot - group) / 2;
  const baseline = groupedBaselinePixel.value;

  for (let i = 0; i < n; i++) {
    const groupStart = slotStart(i) + innerOffset;
    if (props.layout === "stacked") {
      let posCursor = 0;
      let negCursor = 0;
      for (let s = 0; s < k; s++) {
        const series = seriesList[s];
        const raw = Number(series.data[i] ?? NaN);
        if (!isFinite(raw)) continue;
        const bottom = raw >= 0 ? posCursor : negCursor;
        const top = bottom + raw;
        out.push(
          makeBar(
            valuePixel(bottom),
            valuePixel(top),
            groupStart,
            group,
            series.color ?? defaultColor(s),
            series.opacity ?? 1,
            series.blendMode,
            raw,
            i,
            s,
          ),
        );
        if (raw >= 0) posCursor = top;
        else negCursor = top;
      }
    } else if (props.layout === "overlay") {
      for (let s = 0; s < k; s++) {
        const series = seriesList[s];
        const raw = Number(series.data[i] ?? NaN);
        if (!isFinite(raw)) continue;
        out.push(
          makeBar(
            baseline,
            valuePixel(raw),
            groupStart,
            group,
            series.color ?? defaultColor(s),
            series.opacity ?? 1,
            series.blendMode,
            raw,
            i,
            s,
          ),
        );
      }
    } else {
      for (let s = 0; s < k; s++) {
        const series = seriesList[s];
        const raw = Number(series.data[i] ?? NaN);
        if (!isFinite(raw)) continue;
        const barStart = groupStart + (k === 1 ? 0 : s * (bw + props.groupGap));
        out.push(
          makeBar(
            baseline,
            valuePixel(raw),
            barStart,
            bw,
            series.color ?? defaultColor(s),
            series.opacity ?? 1,
            series.blendMode,
            raw,
            i,
            s,
          ),
        );
      }
    }
  }
  return out;
});

/**
 * Per-line styling, resolved with defaults but without pixel work. Kept
 * separate from `ResolvedSummaryLine` so the inline legend can depend on
 * it without pulling in the chart's pixel layout (which depends on the
 * legend row count — a circular reference otherwise).
 */
type StyledSummaryLine = {
  data: BarChartData;
  x?: BarChartData;
  color: string;
  strokeWidth: number;
  dashed: boolean;
  opacity: number;
  blendMode?: BlendMode;
  dots: boolean;
  dotRadius: number;
  extent: { min: number; max: number };
  legend?: string;
  showInLegend: boolean;
};

type ResolvedSummaryLine = StyledSummaryLine & {
  pathD: string;
  points: { x: number; y: number }[];
};

/** Compute the line's own value extent. */
function computeLineExtent(line: BarSummaryLine): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const v of line.data) {
    const n = Number(v);
    if (!isFinite(n)) continue;
    if (n < min) min = n;
    if (n > max) max = n;
  }
  if (!isFinite(min)) {
    min = 0;
    max = 1;
  }
  if (line.valueMin !== undefined) {
    min = line.valueMin;
  } else if (min > 0) {
    // Default to a 0 floor for all-positive data so the line shape
    // reads as "rises from zero" rather than filling the full plot.
    min = 0;
  }
  if (line.valueMax !== undefined) max = line.valueMax;
  if (min === max) max = min + 1;
  return { min, max };
}

/**
 * Project a single line point (x in category-index space, y in the
 * line's own value space) to pixels. Orientation flips which axis is
 * categorical vs value.
 */
function projectLinePoint(
  x: number,
  y: number,
  extent: { min: number; max: number },
): { x: number; y: number } {
  const base = isVertical.value ? padding.value.left : padding.value.top;
  const categoricalPx = base + (x + 0.5) * slotSize.value;
  const span = extent.max - extent.min || 1;
  const frac = (y - extent.min) / span;
  if (isVertical.value) {
    return {
      x: categoricalPx,
      y: padding.value.top + innerH.value - frac * innerH.value,
    };
  }
  return {
    x: padding.value.left + frac * innerW.value,
    y: categoricalPx,
  };
}

const summaryLinesStyled = computed<StyledSummaryLine[]>(() => {
  const lines = props.summaryLines;
  if (!lines || lines.length === 0) return [];
  return lines.map((line, i): StyledSummaryLine => {
    return {
      data: line.data ?? EMPTY_DATA,
      x: line.x,
      color: line.color ?? defaultLineColor(i),
      strokeWidth: line.strokeWidth ?? 2,
      dashed: line.dashed ?? false,
      opacity: line.opacity ?? 1,
      blendMode: line.blendMode,
      dots: line.dots ?? false,
      dotRadius: line.dotRadius ?? (line.strokeWidth ?? 2) + 1,
      extent: computeLineExtent(line),
      legend: line.legend,
      showInLegend: line.showInLegend !== false,
    };
  });
});

const summaryLinesResolved = computed<ResolvedSummaryLine[]>(() => {
  if (slotSize.value === 0) return [];
  return summaryLinesStyled.value.map((line): ResolvedSummaryLine => {
    const points: { x: number; y: number }[] = [];
    let d = "";
    let inSeg = false;
    for (let j = 0; j < line.data.length; j++) {
      const yv = Number(line.data[j]);
      const xv = line.x ? Number(line.x[j]) : j;
      if (!isFinite(yv) || !isFinite(xv)) {
        inSeg = false;
        continue;
      }
      const p = projectLinePoint(xv, yv, line.extent);
      points.push(p);
      d += inSeg ? `L${p.x},${p.y}` : `M${p.x},${p.y}`;
      inSeg = true;
    }
    return { ...line, pathD: d, points };
  });
});

const DEFAULT_LINE_COLORS = [
  "var(--color-fg-1, #111)",
  "var(--color-danger, #ef4444)",
  "var(--color-success, #10b981)",
  "var(--color-info, #6366f1)",
];

function defaultLineColor(i: number): string {
  return DEFAULT_LINE_COLORS[i % DEFAULT_LINE_COLORS.length];
}

const DEFAULT_COLORS = [
  "var(--color-primary, #3b82f6)",
  "var(--color-accent, #f59e0b)",
  "var(--color-success, #10b981)",
  "var(--color-danger, #ef4444)",
  "var(--color-info, #6366f1)",
  "var(--color-warning, #d97706)",
];

function defaultColor(i: number): string {
  return DEFAULT_COLORS[i % DEFAULT_COLORS.length];
}

const formatTooltipValue = makeTooltipValueFormatter(
  () => props.tooltipValueFormat,
  () => props.valueTickFormat,
);

const valueTickItems = computed(() => {
  const { min, max } = valueExtent.value;
  const fmt = (v: number) =>
    props.valueTickFormat !== undefined
      ? formatNumber(v, props.valueTickFormat)
      : formatTick(v);
  if (min === max) {
    return [
      {
        value: fmt(min),
        pos: snap(valuePixel(min)),
      },
    ];
  }
  const targetTickPixels = isVertical.value ? 50 : 80;
  const values =
    props.valueScaleType === "log"
      ? computeLogTickValues({ min, max, ticks: props.valueTicks })
      : computeTickValues({
          min,
          max,
          ticks: props.valueTicks,
          targetTickCount: valueSize.value / targetTickPixels,
        });
  return values.map((v) => ({
    value: fmt(v),
    pos: snap(valuePixel(v)),
  }));
});

interface CategoryTickItem {
  label: string;
  pos: number;
  anchor: "start" | "middle" | "end";
}

const categoryTickItems = computed<CategoryTickItem[]>(() => {
  const n = categoryCount.value;
  const dateMs = categoryDatesMs.value;

  // Date mode: thin labels to the closest category index for each
  // tick boundary picked by `pickDateTicks`. Bar positions stay
  // ordinal — only the labels become date-aware.
  if (dateMs && dateMs.length > 0) {
    let min = Infinity;
    let max = -Infinity;
    for (const m of dateMs) {
      if (!Number.isFinite(m)) continue;
      if (m < min) min = m;
      if (m > max) max = m;
    }
    if (!Number.isFinite(min) || min === max) return [];
    const span = isVertical.value ? innerW.value : innerH.value;
    const target = Math.max(2, Math.floor(span / 80));
    const picked = pickDateTicks(min, max, target, "utc");
    const unit = picked.unit;
    const items: CategoryTickItem[] = [];
    const seen = new Set<number>();
    for (const tickMs of picked.values) {
      let nearest = -1;
      let best = Infinity;
      for (let i = 0; i < dateMs.length; i++) {
        const d = Math.abs(dateMs[i] - tickMs);
        if (d < best) {
          best = d;
          nearest = i;
        }
      }
      if (nearest < 0 || seen.has(nearest)) continue;
      seen.add(nearest);
      const center = slotStart(nearest) + slotSize.value / 2;
      const label = props.categoryFormat
        ? props.categoryFormat(categoryLabels.value[nearest], nearest)
        : formatDate(dateMs[nearest], props.dateFormat, "utc", unit);
      items.push({ label, pos: center, anchor: "middle" });
    }
    return items;
  }

  const out: CategoryTickItem[] = [];
  const fmt = (label: string, i: number) =>
    props.categoryFormat ? props.categoryFormat(label, i) : label;
  const formatted = new Array<string>(n);
  let maxLen = 0;
  for (let i = 0; i < n; i++) {
    formatted[i] = fmt(categoryLabels.value[i], i);
    if (formatted[i].length > maxLen) maxLen = formatted[i].length;
  }
  // Skip labels when slots are too narrow (or short) to fit them
  // without overlap. Vertical orientation measures horizontal label
  // width (≈ chars × fontSize × 0.6); horizontal orientation just
  // measures stacked line height (≈ fontSize × 1.2).
  const fontSize = props.tickLabelStyle?.fontSize ?? TICK_LABEL_FONT_SIZE;
  const minGap = 8;
  const needPerLabel = isVertical.value
    ? maxLen * fontSize * 0.6 + minGap
    : fontSize * 1.2 + minGap;
  const stride =
    slotSize.value > 0
      ? Math.max(1, Math.ceil(needPerLabel / slotSize.value))
      : 1;
  for (let i = 0; i < n; i += stride) {
    const center = slotStart(i) + slotSize.value / 2;
    out.push({
      label: formatted[i],
      pos: center,
      anchor: "middle",
    });
  }
  return out;
});

interface InlineLegendItem {
  label: string;
  color: string;
  kind: "bar" | "line";
  dashed?: boolean;
}

const inlineLegendItems = computed<InlineLegendItem[]>(() => {
  const items: InlineLegendItem[] = [];
  allSeries.value.forEach((s, i) => {
    if (!s.legend || s.showInLegend === false) return;
    items.push({
      label: s.legend,
      color: s.color ?? defaultColor(i),
      kind: "bar",
    });
  });
  summaryLinesStyled.value.forEach((line) => {
    if (!line.legend || !line.showInLegend) return;
    items.push({
      label: line.legend,
      color: line.color,
      kind: "line",
      dashed: line.dashed,
    });
  });
  return items;
});

const inlineLegendLabels = computed(() =>
  inlineLegendItems.value.map((item) => item.label),
);

function toCsv(): string {
  const override = resolveCsvOverride(props.csv);
  if (override !== null) return override;
  const namedSeries = allSeries.value.map((s) => ({
    label: s.legend,
    data: s.data,
  }));
  return categoricalToCsv(categoryLabels.value, namedSeries);
}

function projectAnnotation(
  x: number,
  y: number,
): { x: number; y: number } | null {
  if (!isFinite(x) || !isFinite(y)) return null;
  if (slotSize.value === 0) return null;
  const base = isVertical.value ? padding.value.left : padding.value.top;
  const categoricalPx = base + (x + 0.5) * slotSize.value;
  const valuePx = valuePixel(y);
  return isVertical.value
    ? { x: categoricalPx, y: valuePx }
    : { x: valuePx, y: categoricalPx };
}

function pointerToIndex(clientX: number, clientY: number): number | null {
  const rect = containerRef.value?.getBoundingClientRect();
  if (!rect) return null;
  const n = categoryCount.value;
  if (n === 0 || slotSize.value === 0) return null;
  const local = isVertical.value
    ? clientX - rect.left - padding.value.left
    : clientY - rect.top - padding.value.top;
  return Math.max(0, Math.min(n - 1, Math.floor(local / slotSize.value)));
}

/** Height reserved above the plot for the category/value column headers. */
const HEADER_ROW_HEIGHT = 22;

const hasHeaders = computed(
  () => !!(props.categoryHeader || props.valueHeader),
);

/**
 * `chartPadding` with extra top room reserved for the column headers when
 * either is set, so they don't overlap the legend or the plot.
 */
const effectiveChartPadding = computed<ChartPadding | undefined>(() => {
  const extraTop = hasHeaders.value ? HEADER_ROW_HEIGHT : 0;
  const base = props.chartPadding;
  if (!extraTop) return base;
  if (base == null) return { top: extraTop };
  if (typeof base === "number")
    return { top: base + extraTop, right: base, bottom: base, left: base };
  return { ...base, top: (base.top ?? 0) + extraTop };
});

const {
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
} = useChartFoundation({
  width: () => props.width,
  height: () => props.height,
  title: () => props.title,
  titleStyle: () => props.titleStyle,
  xLabel: () => props.xLabel,
  yLabel: () => props.yLabel,
  debounce: () => props.debounce,
  menu: () => props.menu,
  tooltipTrigger: () => props.tooltipTrigger,
  tooltipClamp: () => props.tooltipClamp,
  filename: () => props.filename,
  downloadLink: () => props.downloadLink,
  downloadButton: () => props.downloadButton,
  fullscreenTarget: () => props.fullscreenTarget,
  chartPadding: () => effectiveChartPadding.value,
  inlineLegendLabels: () => inlineLegendLabels.value,
  hasTooltipSlot: () => hasTooltipSlot.value,
  getCsv: toCsv,
  pointerToIndex,
  // Bars run along the category axis: vertical orientation scrubs across X
  // (keep vertical page scroll), horizontal orientation scrubs down Y.
  scrubAxis: () => (isVertical.value ? "x" : "y"),
  onHover: (payload) => emit("hover", payload),
});

/** Small inset from the chart's left edge for start-aligned category labels. */
const CATEGORY_LABEL_INSET = 2;

/**
 * Left x-anchor for the title and inline legend. When the category labels
 * are start-aligned (horizontal), the title/legend align to that same left
 * edge so the whole header column lines up; otherwise they sit at the
 * plot's left edge.
 */
const headerLeftX = computed(() =>
  props.categoryAlign === "start" && !isVertical.value
    ? CATEGORY_LABEL_INSET
    : padding.value.left,
);

const hoveredCategoryLabel = computed(() => {
  const i = hoverIndex.value;
  if (i === null) return undefined;
  // In date mode, format the tooltip label so it honors `dateFormat`
  // (otherwise the user would see the raw ISO string while the ticks
  // render with a nicer preset).
  const dateMs = categoryDatesMs.value;
  if (dateMs && Number.isFinite(dateMs[i])) {
    return formatDate(dateMs[i], props.dateFormat, "utc");
  }
  return categoryLabels.value[i];
});

const hoverSlotProps = computed(() => {
  const idx = hoverIndex.value;
  if (idx === null) return null;
  const series = allSeries.value;
  const values: ChartTooltipValue[] = [];
  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    if (s.showInTooltip === false) continue;
    values.push({
      value: Number(s.data[idx] ?? NaN),
      color: s.color ?? defaultColor(i),
      seriesIndex: i,
    });
  }
  return {
    index: idx,
    category: categoryLabels.value[idx] ?? String(idx),
    values,
    data: props.tooltipData?.[idx] ?? null,
  };
});

/** Pixel rectangle of the hovered category slot (for the highlight band). */
const hoverBand = computed(() => {
  const i = hoverIndex.value;
  if (i === null) return null;
  const start = slotStart(i);
  if (isVertical.value) {
    return {
      x: start,
      y: padding.value.top,
      w: slotSize.value,
      h: innerH.value,
    };
  }
  return {
    x: padding.value.left,
    y: start,
    w: innerW.value,
    h: slotSize.value,
  };
});

const positionedLegendItems = computed(() =>
  positionLegendItems(
    inlineLegendItems.value,
    inlineLegendLayout.value.positions,
    headerLeftX.value,
    legendY.value,
  ),
);

const BAR_LABEL_FONT_SIZE = 11;
/** Estimated glyph width as a fraction of font size (matches axis logic). */
const BAR_LABEL_CHAR_WIDTH = 0.6;
/** Inset of an inside label / offset of an outside label from the edge. */
const BAR_LABEL_PAD = 4;
/** Minimum gap between two labels when decluttering. */
const BAR_LABEL_GAP = 4;

interface ResolvedBarLabels {
  format?: NumberFormat | ((value: number, ctx: BarLabelContext) => string);
  color: string;
  placement: "auto" | "inside" | "outside";
  align: "start" | "center" | "end";
  overlap: "shift" | "hide";
  minSize: number;
  fontSize: number;
  fontWeight: number | string | undefined;
}

const barLabelOptions = computed<ResolvedBarLabels | null>(() => {
  const b = props.barLabels;
  if (!b) return null;
  const o = b === true ? {} : b;
  return {
    format: o.format,
    color: o.color ?? "auto",
    placement: o.placement ?? "auto",
    align: o.align ?? "center",
    overlap: o.overlap ?? "shift",
    minSize: o.minSize ?? 0,
    fontSize: o.fontSize ?? BAR_LABEL_FONT_SIZE,
    fontWeight: o.fontWeight,
  };
});

function formatBarLabel(value: number, ctx: BarLabelContext): string {
  const f = barLabelOptions.value?.format;
  if (typeof f === "function") return f(value, ctx);
  if (f !== undefined) return formatNumber(value, f);
  if (props.valueTickFormat !== undefined)
    return formatNumber(value, props.valueTickFormat);
  return formatTick(value);
}

/**
 * Fill color of the bar covering pixel (px, py) within category `cat`, or
 * null when no bar sits there (the chart background). Used to choose a
 * readable color for a label that overflows onto a neighboring segment.
 */
function barColorAt(cat: number, px: number, py: number): string | null {
  // Iterate in reverse so the topmost (last-drawn) bar wins under overlap.
  for (let i = bars.value.length - 1; i >= 0; i--) {
    const b = bars.value[i];
    if (b.categoryIndex !== cat) continue;
    if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h)
      return b.color;
  }
  return null;
}

interface BarLabelItem {
  key: string;
  x: number;
  y: number;
  text: string;
  anchor: "start" | "middle" | "end";
  fill: string;
  fontSize: number;
  fontWeight: number | string | undefined;
}

const barLabelItems = computed<BarLabelItem[]>(() => {
  const opts = barLabelOptions.value;
  if (!opts) return [];
  const vertical = isVertical.value;
  const fontSize = opts.fontSize;

  // Build a draft label per bar, computing its placement (inside vs
  // outside) and a 1D extent [lo, hi] along the value axis in a
  // "value-increasing" coordinate `u` (rightward when horizontal, upward
  // when vertical). Collision resolution then runs per category in `u`.
  interface Draft {
    bar: (typeof bars.value)[number];
    text: string;
    textLen: number;
    inside: boolean;
    cross: number; // fixed coordinate on the categorical axis
    lo: number; // low-value edge of the text in u
    hi: number; // high-value edge of the text in u
    // Horizontal text-anchor for this label (vertical bars always center).
    svgAnchor: "start" | "middle" | "end";
    hidden: boolean;
  }

  const drafts: Draft[] = [];
  for (const bar of bars.value) {
    const text = formatBarLabel(bar.value, {
      value: bar.value,
      categoryIndex: bar.categoryIndex,
      seriesIndex: bar.seriesIndex,
      category:
        categoryLabels.value[bar.categoryIndex] ?? String(bar.categoryIndex),
    });
    if (!text) continue;

    const segSize = vertical ? bar.h : bar.w;
    const textLen = text.length * fontSize * BAR_LABEL_CHAR_WIDTH;
    const fits =
      segSize >= textLen + 2 * BAR_LABEL_PAD && segSize >= opts.minSize;
    const inside =
      opts.placement === "inside"
        ? true
        : opts.placement === "outside"
          ? false
          : fits;

    // `u` increases with value: rightward (x) for horizontal bars, upward
    // (-y) for vertical bars. The label occupies a span of `len` in u —
    // its text width when horizontal, its line height when vertical.
    let lo: number;
    let hi: number;
    let cross: number;
    let svgAnchor: "start" | "middle" | "end" = "middle";
    const segHiU = vertical ? -bar.y : bar.x + bar.w; // high-value edge
    const segLoU = vertical ? -(bar.y + bar.h) : bar.x; // low-value edge
    const len = vertical ? fontSize : textLen;
    cross = vertical ? bar.x + bar.w / 2 : bar.y + bar.h / 2;
    if (!inside) {
      // Just past the high-value edge, growing outward.
      lo = segHiU + BAR_LABEL_PAD;
      hi = lo + len;
      svgAnchor = "start";
    } else if (opts.align === "start") {
      lo = segLoU + BAR_LABEL_PAD;
      hi = lo + len;
      svgAnchor = "start";
    } else if (opts.align === "end") {
      hi = segHiU - BAR_LABEL_PAD;
      lo = hi - len;
      svgAnchor = "end";
    } else {
      const c = (segHiU + segLoU) / 2;
      lo = c - len / 2;
      hi = c + len / 2;
      svgAnchor = "middle";
    }
    drafts.push({
      bar,
      text,
      textLen,
      inside,
      cross,
      lo,
      hi,
      svgAnchor,
      hidden: false,
    });
  }

  // Declutter per category along `u`: sweep low→high, pushing or hiding
  // labels that would overlap the previous one. Bounds keep a pushed label
  // from sliding off the chart.
  const uMax = vertical ? -padding.value.top : width.value - 2;
  const byCategory = new Map<number, Draft[]>();
  for (const d of drafts) {
    const arr = byCategory.get(d.bar.categoryIndex);
    if (arr) arr.push(d);
    else byCategory.set(d.bar.categoryIndex, [d]);
  }
  for (const group of byCategory.values()) {
    group.sort((a, b) => a.lo - b.lo);
    let cursor = -Infinity;
    for (const d of group) {
      if (d.lo < cursor + BAR_LABEL_GAP) {
        if (opts.overlap === "hide") {
          d.hidden = true;
          continue;
        }
        const shift = cursor + BAR_LABEL_GAP - d.lo;
        d.lo += shift;
        d.hi += shift;
        d.inside = false; // a shifted label no longer sits in its segment
        d.svgAnchor = "start";
      }
      if (d.hi > uMax) {
        d.hidden = true;
        continue;
      }
      cursor = d.hi;
    }
  }

  const auto = opts.color === "auto";
  const items: BarLabelItem[] = [];
  for (const d of drafts) {
    if (d.hidden) continue;
    let x: number;
    let y: number;
    let anchor: "start" | "middle" | "end";
    if (vertical) {
      // Vertical bars center the text horizontally; align shifted the
      // [lo, hi] band along the value (y) axis, so render at its center.
      x = d.cross;
      y = -((d.lo + d.hi) / 2);
      anchor = "middle";
    } else {
      anchor = d.svgAnchor;
      x =
        anchor === "start" ? d.lo : anchor === "end" ? d.hi : (d.lo + d.hi) / 2;
      y = d.cross;
    }
    // Pick contrast against whatever the label actually sits on. Inside
    // labels are on their own segment; an outside/shifted label commonly
    // lands on a neighboring segment of the same stack — use that
    // segment's fill, falling back to the chart background (currentColor)
    // only when the label clears all bars.
    let fill: string;
    if (!auto) {
      fill = opts.color;
    } else if (d.inside) {
      fill = pickContrastColor(d.bar.color);
    } else {
      const cx = vertical ? d.cross : (d.lo + d.hi) / 2;
      const cy = vertical ? -((d.lo + d.hi) / 2) : d.cross;
      const under = barColorAt(d.bar.categoryIndex, cx, cy);
      fill = under ? pickContrastColor(under) : "currentColor";
    }
    items.push({
      key: `${d.bar.categoryIndex}-${d.bar.seriesIndex}`,
      x,
      y,
      text: d.text,
      anchor,
      fill,
      fontSize,
      fontWeight: opts.fontWeight,
    });
  }
  return items;
});

/**
 * Anchor + x for the category labels (and matching `categoryHeader`) in
 * horizontal orientation, driven by `categoryAlign`. Vertical orientation
 * doesn't use this (labels stay centered under each column).
 */
const categoryLabelLayout = computed<{
  anchor: "start" | "middle" | "end";
  x: number;
}>(() => {
  const right = padding.value.left - 6;
  switch (props.categoryAlign ?? "end") {
    case "start":
      return { anchor: "start", x: CATEGORY_LABEL_INSET };
    case "center":
      return { anchor: "middle", x: (CATEGORY_LABEL_INSET + right) / 2 };
    default:
      return { anchor: "end", x: right };
  }
});

interface ColumnHeader {
  key: string;
  text: string;
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
}

/**
 * Positioned column headers (`categoryHeader` / `valueHeader`), drawn in
 * the reserved row just above the plot. The category header is aligned to
 * match the category labels; the value header starts where the bars do.
 */
const columnHeaders = computed<ColumnHeader[]>(() => {
  const out: ColumnHeader[] = [];
  const y = padding.value.top - 7;
  if (props.valueHeader) {
    out.push({
      key: "vh",
      text: props.valueHeader,
      x: padding.value.left,
      y,
      anchor: "start",
    });
  }
  if (props.categoryHeader) {
    const horizontal = !isVertical.value;
    const cat = categoryLabelLayout.value;
    out.push({
      key: "ch",
      text: props.categoryHeader,
      x: horizontal ? cat.x : padding.value.left,
      y,
      anchor: horizontal ? cat.anchor : "start",
    });
  }
  return out;
});
</script>

<template>
  <Teleport :to="teleportTarget" :disabled="!isFullscreen">
    <div
      ref="containerRef"
      v-bind="$attrs"
      class="bar-chart-wrapper"
      :class="{ 'is-fullscreen': isFullscreen }"
      :style="fullscreenStyle"
    >
      <ChartMenu
        v-if="menu"
        :items="menuItems"
        :is-fullscreen="isFullscreen"
        @close="exitFullscreen"
      />
      <div class="chart-sr-only" aria-live="polite">
        {{ isFullscreen ? "Chart expanded to fill window" : "" }}
      </div>
      <svg
        ref="svgRef"
        :width="width"
        :height="height"
        :role="chartRole || undefined"
        :aria-label="chartAriaLabel || undefined"
      >
        <ChartTitle
          :title="title"
          :title-style="titleStyle"
          :bounds="bounds"
          :left-x="headerLeftX"
        />
        <!-- column headers (category / value), in the reserved row above the plot -->
        <text
          v-for="h in columnHeaders"
          :key="h.key"
          :data-testid="h.key === 'ch' ? 'category-header' : 'value-header'"
          :x="h.x"
          :y="h.y"
          :text-anchor="h.anchor"
          :font-size="axisLabelResolved.fontSize"
          :fill="axisLabelResolved.fill"
          font-weight="600"
        >
          {{ h.text }}
        </text>
        <!-- inline legend -->
        <g v-if="positionedLegendItems.length > 0">
          <template
            v-for="(item, i) in positionedLegendItems"
            :key="'ileg' + i"
          >
            <rect
              v-if="item.kind === 'bar'"
              :x="item.x"
              :y="item.y - 5"
              width="12"
              height="10"
              :fill="item.color"
            />
            <line
              v-else
              :x1="item.x"
              :y1="item.y"
              :x2="item.x + 12"
              :y2="item.y"
              :stroke="item.color"
              stroke-width="2"
              :stroke-dasharray="item.dashed ? '4 2' : undefined"
            />
            <text
              :x="item.x + 18"
              :y="item.y + 4"
              :font-size="legendResolved.fontSize"
              :fill="legendResolved.fill"
              :font-weight="legendResolved.fontWeight"
            >
              {{ item.label }}
            </text>
          </template>
        </g>
        <!-- axes (the value axis line is suppressed when valueAxis is false) -->
        <line
          v-if="!isVertical || valueAxis"
          :x1="snap(padding.left)"
          :y1="snap(padding.top)"
          :x2="snap(padding.left)"
          :y2="snap(padding.top + innerH)"
          stroke="currentColor"
          stroke-opacity="0.3"
        />
        <line
          v-if="isVertical || valueAxis"
          :x1="snap(padding.left)"
          :y1="snap(padding.top + innerH)"
          :x2="snap(padding.left + innerW)"
          :y2="snap(padding.top + innerH)"
          stroke="currentColor"
          stroke-opacity="0.3"
        />
        <!-- value grid lines -->
        <template v-if="valueGrid && valueAxis">
          <line
            v-for="(tick, i) in valueTickItems"
            :key="'vg' + i"
            :x1="isVertical ? padding.left : tick.pos"
            :y1="isVertical ? tick.pos : padding.top"
            :x2="isVertical ? padding.left + innerW : tick.pos"
            :y2="isVertical ? tick.pos : padding.top + innerH"
            stroke="currentColor"
            stroke-opacity="0.1"
          />
        </template>
        <!-- hover highlight band (rendered behind bars) -->
        <rect
          v-if="hoverBand && hasTooltipSlot"
          :x="hoverBand.x"
          :y="hoverBand.y"
          :width="hoverBand.w"
          :height="hoverBand.h"
          fill="currentColor"
          fill-opacity="0.06"
          pointer-events="none"
        />
        <!-- value tick labels -->
        <template v-if="valueAxis && isVertical">
          <text
            v-for="(tick, i) in valueTickItems"
            :key="'vt' + i"
            data-testid="value-tick"
            :x="padding.left - 6"
            :y="tick.pos"
            text-anchor="end"
            dominant-baseline="middle"
            :font-size="tickLabelResolved.fontSize"
            :fill="tickLabelResolved.fill"
            :font-weight="tickLabelResolved.fontWeight"
            :fill-opacity="tickLabelResolved.fillOpacity"
          >
            {{ tick.value }}
          </text>
        </template>
        <template v-else-if="valueAxis">
          <text
            v-for="(tick, i) in valueTickItems"
            :key="'vt' + i"
            data-testid="value-tick"
            :x="tick.pos"
            :y="padding.top + innerH + 16"
            text-anchor="middle"
            :font-size="tickLabelResolved.fontSize"
            :fill="tickLabelResolved.fill"
            :font-weight="tickLabelResolved.fontWeight"
            :fill-opacity="tickLabelResolved.fillOpacity"
          >
            {{ tick.value }}
          </text>
        </template>
        <ChartAxisLabels
          :x-label="xLabel"
          :y-label="yLabel"
          :padding="padding"
          :inner-w="innerW"
          :inner-h="innerH"
          :height="height"
          :label-style="axisLabelResolved"
        />
        <!-- category tick labels -->
        <template v-if="isVertical">
          <text
            v-for="(tick, i) in categoryTickItems"
            :key="'ct' + i"
            data-testid="category-tick"
            :x="tick.pos"
            :y="padding.top + innerH + 16"
            :text-anchor="tick.anchor"
            :font-size="tickLabelResolved.fontSize"
            :fill="tickLabelResolved.fill"
            :font-weight="tickLabelResolved.fontWeight"
            :fill-opacity="tickLabelResolved.fillOpacity"
          >
            {{ tick.label }}
          </text>
        </template>
        <template v-else>
          <text
            v-for="(tick, i) in categoryTickItems"
            :key="'ct' + i"
            data-testid="category-tick"
            :x="categoryLabelLayout.x"
            :y="tick.pos"
            :text-anchor="categoryLabelLayout.anchor"
            dominant-baseline="middle"
            :font-size="tickLabelResolved.fontSize"
            :fill="tickLabelResolved.fill"
            :font-weight="tickLabelResolved.fontWeight"
            :fill-opacity="tickLabelResolved.fillOpacity"
          >
            {{ tick.label }}
          </text>
        </template>
        <!-- bars -->
        <rect
          v-for="(bar, i) in bars"
          :key="'bar' + i"
          data-testid="bar"
          :data-category="bar.categoryIndex"
          :data-series="bar.seriesIndex"
          :x="bar.x"
          :y="bar.y"
          :width="bar.w"
          :height="bar.h"
          :fill="bar.color"
          :fill-opacity="bar.opacity"
          :style="bar.blendMode ? { mixBlendMode: bar.blendMode } : undefined"
        />
        <!-- value-on-bar labels -->
        <text
          v-for="item in barLabelItems"
          :key="'blbl' + item.key"
          data-testid="bar-label"
          :x="item.x"
          :y="item.y"
          :text-anchor="item.anchor"
          dominant-baseline="middle"
          :font-size="item.fontSize"
          :font-weight="item.fontWeight"
          :fill="item.fill"
          pointer-events="none"
        >
          {{ item.text }}
        </text>
        <!-- summary lines (drawn above bars, below annotations) -->
        <template v-for="(line, i) in summaryLinesResolved" :key="'sl' + i">
          <path
            v-if="line.pathD"
            data-testid="summary-line"
            :d="line.pathD"
            fill="none"
            :stroke="line.color"
            :stroke-width="line.strokeWidth"
            :stroke-opacity="line.opacity"
            :stroke-dasharray="line.dashed ? '6 3' : undefined"
            stroke-linecap="round"
            stroke-linejoin="round"
            :style="
              line.blendMode ? { mixBlendMode: line.blendMode } : undefined
            "
          />
          <template v-if="line.dots">
            <circle
              v-for="(pt, j) in line.points"
              :key="'sld' + i + '-' + j"
              :cx="pt.x"
              :cy="pt.y"
              :r="line.dotRadius"
              :fill="line.color"
              :fill-opacity="line.opacity"
              :style="
                line.blendMode ? { mixBlendMode: line.blendMode } : undefined
              "
            />
          </template>
        </template>
        <!-- Tooltip: interaction overlay -->
        <rect
          v-if="hasTooltipSlot"
          :x="padding.left"
          :y="padding.top"
          :width="innerW"
          :height="innerH"
          fill="transparent"
          :style="`cursor: crosshair; touch-action: ${isVertical ? 'pan-y' : 'pan-x'}`"
          v-on="tooltipHandlers"
        />
        <!-- annotations (top layer) -->
        <ChartAnnotations
          v-if="annotations && annotations.length > 0"
          :annotations="annotations"
          :project="projectAnnotation"
          :bounds="bounds"
        />
      </svg>
      <!-- Tooltip floating content -->
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
          <div class="bar-chart-tooltip">
            <div v-if="hoveredCategoryLabel" class="bar-chart-tooltip-label">
              {{ hoveredCategoryLabel }}
            </div>
            <div
              v-for="v in hoverSlotProps.values"
              :key="v.seriesIndex"
              class="bar-chart-tooltip-row"
            >
              <span
                class="bar-chart-tooltip-swatch"
                :style="{ background: v.color }"
              />
              {{ isFinite(v.value) ? formatTooltipValue(v.value) : "—" }}
            </div>
          </div>
        </slot>
      </div>
      <a
        v-if="downloadLinkText"
        class="bar-chart-download-link"
        :href="csvHref!"
        :download="`${menuFilename()}.csv`"
      >
        {{ downloadLinkText }}
      </a>
      <button
        v-if="downloadButtonText"
        type="button"
        class="bar-chart-download-button"
        @click="triggerCsvDownload"
      >
        {{ downloadButtonText }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.bar-chart-wrapper {
  position: relative;
  width: 100%;
}

.bar-chart-tooltip-label {
  font-weight: 600;
  margin-bottom: 0.25em;
}

.bar-chart-tooltip-row {
  display: flex;
  align-items: center;
  gap: 0.375em;
}

.bar-chart-download-link {
  display: block;
  text-align: right;
  font-size: var(--font-size-sm);
  margin-top: 0.25em;
}

.bar-chart-tooltip-swatch {
  display: inline-block;
  width: 0.625em;
  height: 0.625em;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>

<style>
.bar-chart-download-button {
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

.bar-chart-download-button:hover {
  background: var(--color-bg-1, rgba(0, 0, 0, 0.05));
}

.bar-chart-download-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>
