<script setup lang="ts">
import { computed, ref, useId, watch } from "vue";
import { formatNumber, type NumberFormat } from "@cfasim-ui/shared";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import {
  snap,
  formatTick,
  tickDecimals,
  zoomExtent,
  computeTickValues,
  computeLogTickValues,
  scaleFraction,
  clampExtentForScale,
  categoricalToCsv,
  resolveCsvOverride,
  useChartFoundation,
  blendStyle,
  useChartCommon,
  makeTooltipValueFormatter,
  ChartAnnotations,
  ChartIntervals,
  ChartTooltipContent,
  ChartGridLines,
  resolveGridStyle,
  type GridStyle,
  seriesIntervals,
  resolveIntervalStyle,
  type ChartInterval,
  type IntervalStyle,
  type ChartTooltipInterval,
  ChartAxisLabels,
  ChartTitle,
  ChartZoomControls,
  ChartPlotClip,
  ChartBrushRect,
  ChartLegendToggles,
  useLegendToggle,
  positionLegendItems,
  TICK_LABEL_FONT_SIZE,
  pickContrastColor,
  parseDate,
  isAllDates,
  pickDateTicks,
  placedDateTicks,
  formatDate,
  isDateXAxis,
  toNumericX,
  tickLabelsFit,
  useChartFontFamily,
  type ChartData,
  type ChartXInput,
  type DateFormat,
  type DateTickUnit,
  type DateTimezone,
  type ChartCommonProps,
  type ChartHoverPayload,
  type ChartTooltipBaseProps,
  type ChartTooltipValue,
  type BlendMode,
  type LineMarkStyle,
  type LabelStyle,
  type ChartPadding,
  type BrushBox,
  type PlotClipEdges,
  curvePath,
  visitCurveWindow,
  type CurvePoint,
  type LineCurve,
} from "../_shared/index.js";
import {
  buildBarSlots,
  reindexToSlots,
  slotIndexAt,
  slotIndexMap,
  type BarPeriod,
  type BarSlots,
} from "./barSlots.js";

export type { BarPeriod } from "./barSlots.js";

export type BarChartData = ChartData;

/**
 * Accepted shapes for an `x` array: numbers, or ISO date strings / `Date`
 * objects for a date axis. See `BarChartProps.x`.
 */
export type BarChartXInput = ChartXInput;

export interface BarSeries {
  /** Bar values; one entry per category. `y` is accepted as an alias. */
  y?: BarChartData;
  data?: BarChartData;
  /**
   * Positions on a continuous x axis, parallel to `y`/`data`. Overrides
   * the chart-level `x` for this series. See `BarChartProps.x`.
   */
  x?: BarChartXInput;
  /** Bar end positions, parallel to `x`. Overrides the chart-level `x2`. */
  x2?: BarChartXInput;
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
  /**
   * Names this series' row in the default tooltip. Defaults to `legend`.
   * Once any row is named, unnamed series drop out of the default
   * tooltip.
   */
  tooltipLabel?: string;
  /**
   * Low bound of an interval per category, parallel to `y`/`data`. With
   * `upper`, draws a whisker on every bar where both bounds are finite,
   * centered on the bar. Whiskers default to `currentColor`, not the
   * series color, which would vanish over the bar. Bounds are absolute
   * values on the value axis (not offsets from the bar), including in
   * `stacked` layout.
   */
  lower?: BarChartData;
  /** High bound of an interval per category, parallel to `y`/`data`. */
  upper?: BarChartData;
  /** Styling for this series' `lower` / `upper` whiskers. */
  intervalStyle?: IntervalStyle;
}

/**
 * A line overlay drawn on top of the bars — e.g. a KDE over a histogram,
 * a rolling mean, or any other summary curve. By default each line scales
 * to its own value extent (independent of the bars), so a
 * probability-density curve in `[0, 0.02]` and a count histogram in
 * `[0, 500]` can coexist; `scale: "shared"` plots it on the bars' value
 * axis instead.
 *
 * Sample the curve densely on the input side: `summaryLines` connects
 * points with straight segments (matching matplotlib / seaborn `kde=True`)
 * unless `curve` says otherwise.
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
   * centers — one point per `data` entry. On a continuous x axis (`x`
   * set on the chart) positions are in that axis' units instead, and
   * may be dates on a date axis.
   */
  x?: BarChartXInput;
  /**
   * Which value scale the line uses. `"independent"` (default) spans the
   * plot with the line's own extent; `"shared"` plots it on the bars'
   * value axis, which then grows to fit the line, for a line in the same
   * units as the bars (a rolling mean of daily counts, a target).
   */
  scale?: "independent" | "shared";
  /**
   * Override the line's value-axis floor. When unset, defaults to the
   * line's own min (clamped to 0 when all data is non-negative). Ignored
   * with `scale: "shared"`.
   */
  valueMin?: number;
  /**
   * Override the line's value-axis ceiling. Defaults to the line's own
   * max. Ignored with `scale: "shared"`.
   */
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
   * or any summary curve). Each line scales to its own value extent
   * unless it sets `scale: "shared"`. See `BarSummaryLine`.
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
  /**
   * Positions on a continuous x axis, parallel to `y`/`data` (and to each
   * series' values unless it sets its own `x`). Numbers give a numeric
   * axis; ISO date strings or `Date` objects give a date axis, as on
   * `LineChart`. Bars sit at their x instead of in evenly spaced
   * category slots, so gaps in the data show as gaps. Series share a
   * slot where their x values are equal (grouped bars split it, stacked
   * bars stack in it). A series with no `x` of its own uses this one, or
   * its indices on a numeric axis (on a date axis it is not drawn).
   * Replaces `categories` when set. In this mode
   * `intervals[].x`, `annotations[].x` and `summaryLines[].x` are in x
   * axis units (epoch ms on a date axis).
   */
  x?: BarChartXInput;
  /**
   * Bar end positions, parallel to `x`: each bar spans `[x, x2)`, for
   * bins of uneven width. Wins over `period`.
   */
  x2?: BarChartXInput;
  /**
   * How far each bar extends from its `x` on a continuous axis: a number
   * in axis units (ms on a date axis), or on a date axis a calendar unit
   * (`"day"`, `"week"`, `"month"`, `"quarter"`, `"year"`), so monthly
   * bars follow month lengths. When unset, bars are centered on their x
   * and as wide as the smallest gap between x values. `barPadding` still
   * applies; set it to 0 for bars that touch.
   */
  period?: BarPeriod;
  /**
   * Tick placement on a continuous x axis. Number = interval in axis
   * units (ms on a date axis, stepping from the first bar's start),
   * array = explicit values. When omitted, ticks are chosen
   * automatically.
   */
  xTicks?: number | number[];
  /**
   * Formatter for continuous x-axis tick labels: a `NumberFormat` on a
   * numeric axis, a `DateFormat` on a date axis (where it wins over
   * `dateFormat`), or a `(value, index) => string` function.
   */
  xTickFormat?:
    NumberFormat | ((value: number, index: number) => string) | DateFormat;
  /**
   * Timezone for parsing offset-less ISO strings in `x` / `x2` and for
   * date tick labels and calendar `period`s. Default `"utc"`.
   */
  timezone?: DateTimezone;
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
  /**
   * Draw a grid line at each value tick. Default `true`, styled by the
   * chart's `gridStyle` (or the defaults); pass a `GridStyle` to style
   * the lines directly. Hidden along with the axis when `valueAxis` is
   * false.
   */
  valueGrid?: boolean | GridStyle;
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

const valueGridStyle = computed(() =>
  resolveGridStyle(props.valueGrid, props.gridStyle),
);

// The template root is a <Teleport>, so fallthrough attrs (class, style,
// data-*, id…) can't auto-inherit — forward them onto the wrapper manually.
defineOptions({ inheritAttrs: false });

const emit = defineEmits<{
  (e: "hover", payload: ChartHoverPayload): void;
  (e: "update:hiddenSeries", hidden: string[]): void;
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
  tooltipLabel?: string;
  lower?: BarChartData;
  upper?: BarChartData;
  intervalStyle?: IntervalStyle;
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
    tooltipLabel: s.tooltipLabel,
    lower: s.lower,
    upper: s.upper,
    intervalStyle: s.intervalStyle,
  };
}

const tz = computed<DateTimezone>(() => props.timezone ?? "utc");

/** Each series as given, with the x / x2 it uses on a continuous axis. */
const inputSeries = computed<
  { series: ResolvedSeries; x?: BarChartXInput; x2?: BarChartXInput }[]
>(() => {
  if (props.series && props.series.length > 0)
    return props.series.map((s) => ({
      series: resolveSeries(s),
      x: s.x ?? props.x,
      x2: s.x2 ?? props.x2,
    }));
  const topY = props.y ?? props.data;
  if (topY) return [{ series: { data: topY }, x: props.x, x2: props.x2 }];
  return [];
});

/** Continuous x axis: any series positioned by `x`. */
const isContinuous = computed(() =>
  inputSeries.value.some(({ x }) => x !== undefined && x.length > 0),
);

const xIsDate = computed(
  () =>
    isContinuous.value &&
    isDateXAxis(
      inputSeries.value.flatMap(({ x, x2 }) => [x, x2]),
      tz.value,
    ),
);

/**
 * Continuous-axis layout: the slots every series' bars share, and each
 * series' values re-laid onto them, so everything downstream indexes
 * slots the way category mode indexes categories.
 */
const continuous = computed<{
  slots: BarSlots;
  series: ResolvedSeries[];
} | null>(() => {
  if (!isContinuous.value) return null;
  const isDate = xIsDate.value;
  const inputs = inputSeries.value.map(({ series, x, x2 }) => {
    // A series without x falls back to its indices, which only mean
    // something on a numeric axis; on a date axis it draws nothing.
    const xs =
      toNumericX(x, isDate, tz.value) ??
      (isDate
        ? new Float64Array(0)
        : Float64Array.from(series.data, (_, i) => i));
    return { series, x: xs, x2: toNumericX(x2, isDate, tz.value) };
  });
  const slots = buildBarSlots(inputs, {
    period: props.period,
    isDate,
    tz: tz.value,
  });
  const index = slotIndexMap(slots);
  const n = slots.x.length;
  const series = inputs.map(({ series: s, x }) => ({
    ...s,
    data: reindexToSlots(s.data, x, index, n),
    lower: s.lower && reindexToSlots(s.lower, x, index, n),
    upper: s.upper && reindexToSlots(s.upper, x, index, n),
  }));
  return { slots, series };
});

const allSeries = computed<ResolvedSeries[]>(
  () =>
    continuous.value?.series ?? inputSeries.value.map(({ series }) => series),
);

let warnedMissingX = false;
watch(
  () =>
    xIsDate.value &&
    inputSeries.value.some(({ x }) => x === undefined || x.length === 0),
  (missing) => {
    if (!missing || warnedMissingX) return;
    warnedMissingX = true;
    console.warn(
      "[BarChart] A series has no `x` on a date axis and is not drawn; set `x` on it or on the chart.",
    );
  },
  { immediate: true },
);

let warnedCategories = false;
watch(
  () => isContinuous.value && (props.categories?.length ?? 0) > 0,
  (both) => {
    if (!both || warnedCategories) return;
    warnedCategories = true;
    console.warn("[BarChart] `x` is set, so `categories` is ignored.");
  },
  { immediate: true },
);

const { isHidden, toggle: toggleLegend } = useLegendToggle({
  hidden: () => props.hiddenSeries,
  onUpdate: (hidden) => emit("update:hiddenSeries", hidden),
});

/** Series still drawn, each with its index into `allSeries`. */
const visibleSeries = computed(() =>
  allSeries.value
    .map((series, index) => ({ series, index }))
    .filter(({ series }) => !isHidden(series.legend)),
);

const categoryCount = computed(() => {
  if (continuous.value) return continuous.value.slots.x.length;
  let n = props.categories?.length ?? 0;
  for (const s of allSeries.value) {
    if (s.data.length > n) n = s.data.length;
  }
  return n;
});

/** A continuous-axis position as CSV / slot text: ISO on a date axis. */
function xText(v: number): string {
  if (!xIsDate.value) return String(Number(v.toPrecision(12)));
  const iso = new Date(v).toISOString();
  return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
}

const categoryLabels = computed<string[]>(() => {
  if (continuous.value) return continuous.value.slots.x.map(xText);
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
  if (isContinuous.value) return null;
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

/** Brushed category window (inclusive indices); null shows every category. */
const zoomRange = ref<{ start: number; end: number } | null>(null);
/** Brushed value window from a box zoom; null rescales to the visible bars. */
const zoomValue = ref<{ min: number; max: number } | null>(null);

/** Brushed x window on a continuous axis; null shows the full extent. */
const zoomX = ref<{ min: number; max: number } | null>(null);

/** Full continuous x extent: every bar's span and standalone interval. */
const xFullDomain = computed(() => {
  const c = continuous.value;
  let min = Infinity;
  let max = -Infinity;
  if (c) {
    for (const v of c.slots.start) if (v < min) min = v;
    for (const v of c.slots.end) if (v > max) max = v;
    for (const iv of props.intervals ?? []) {
      if (!isFinite(iv.x)) continue;
      if (iv.x < min) min = iv.x;
      if (iv.x > max) max = iv.x;
    }
  }
  if (!isFinite(min)) return { min: 0, max: 1 };
  return max > min ? { min, max } : { min: min - 0.5, max: max + 0.5 };
});

/** Visible continuous x range: the zoom window clamped to the full extent. */
const xDomain = computed(() => {
  const full = xFullDomain.value;
  const z = props.zoom ? zoomX.value : null;
  if (!z) return full;
  const min = Math.max(full.min, z.min);
  const max = Math.min(full.max, z.max);
  return max > min ? { min, max } : full;
});

/** Visible categories: the zoom window clamped to the data, else all of them. */
const visibleRange = computed(() => {
  const full = { start: 0, end: categoryCount.value - 1 };
  const c = continuous.value;
  if (c) {
    // Slots whose span reaches into the visible x range.
    const { min, max } = xDomain.value;
    let start = 0;
    while (start < full.end && c.slots.end[start] <= min) start++;
    let end = full.end;
    while (end > start && c.slots.start[end] >= max) end--;
    return { start, end };
  }
  const z = props.zoom ? zoomRange.value : null;
  if (!z) return full;
  const start = Math.max(full.start, z.start);
  const end = Math.min(full.end, z.end);
  return end >= start ? { start, end } : full;
});

const visibleCount = computed(
  () => visibleRange.value.end - visibleRange.value.start + 1,
);

/** Active box-zoom value window (box zoom needs `zoom === true`). */
const valueWindow = computed(() =>
  props.zoom === true ? zoomValue.value : null,
);

const xZoomed = computed(
  () =>
    xDomain.value.min !== xFullDomain.value.min ||
    xDomain.value.max !== xFullDomain.value.max,
);

const isZoomed = computed(
  () =>
    (continuous.value
      ? xZoomed.value
      : visibleCount.value < categoryCount.value) || valueWindow.value !== null,
);

/**
 * The box-zoomed value window as a [0, 1] slice of the unzoomed value
 * axis; null when the value axis isn't box-zoomed.
 */
const valueZoomSlice = computed(() => {
  const w = valueWindow.value;
  if (!w) return null;
  const { min, max } = fullValueExtent.value;
  const lo = scaleFraction(w.min, min, max, props.valueScaleType);
  const hi = scaleFraction(w.max, min, max, props.valueScaleType);
  return hi > lo ? { lo, hi } : null;
});

/** Deepest value-axis zoom, as a multiple of the full value range. */
const MAX_VALUE_ZOOM = 1e4;

const clipId = useId();

function onZoomSelect(box: BrushBox) {
  const slot = slotSize.value;
  if (!hasLayout.value || valueSize.value <= 0) return;
  const { start, end } = visibleRange.value;
  const vertical = isVertical.value;
  const base = vertical ? padding.value.left : padding.value.top;
  const loPx = vertical ? box.x0 : box.y0;
  const hiPx = vertical ? box.x1 : box.y1;
  if (!box.band) {
    // Read the current value extent before the category window changes.
    const bottom = padding.value.top + innerH.value;
    const f0 = vertical
      ? (bottom - box.y1) / innerH.value
      : (box.x0 - padding.value.left) / innerW.value;
    const f1 = vertical
      ? (bottom - box.y0) / innerH.value
      : (box.x1 - padding.value.left) / innerW.value;
    zoomValue.value = zoomExtent(
      f0,
      f1,
      valueExtent.value,
      fullValueExtent.value,
      props.valueScaleType,
      MAX_VALUE_ZOOM,
    );
  }
  if (continuous.value) {
    zoomX.value = zoomExtent(
      (loPx - base) / categoricalSize.value,
      (hiPx - base) / categoricalSize.value,
      xDomain.value,
      xFullDomain.value,
      "linear",
      MAX_VALUE_ZOOM,
    );
    return;
  }
  const clamp = (i: number) => Math.max(start, Math.min(end, i));
  // Every slot the brush touches; ceil - 1 keeps a brush that ends exactly
  // on a slot boundary from pulling in the next category.
  zoomRange.value = {
    start: clamp(start + Math.floor((loPx - base) / slot)),
    end: clamp(start + Math.ceil((hiPx - base) / slot) - 1),
  };
}

function resetZoom() {
  zoomRange.value = null;
  zoomX.value = null;
  zoomValue.value = null;
}

/** Top-level `intervals`, dropping any pinned to a legend-hidden series. */
const topIntervals = computed<ChartInterval[]>(() =>
  (props.intervals ?? []).filter((iv) => {
    if (iv.seriesIndex === undefined) return true;
    const s = allSeries.value[iv.seriesIndex];
    return s !== undefined && !isHidden(s.legend);
  }),
);

/** Whiskers expanded from each visible series' `lower` / `upper`. */
const seriesIntervalList = computed<ChartInterval[]>(() => {
  const out: ChartInterval[] = [];
  for (const { series: s, index } of visibleSeries.value) {
    if (!s.lower || !s.upper) continue;
    out.push(
      ...seriesIntervals({
        data: s.data,
        lower: s.lower,
        upper: s.upper,
        xAt: slotCenter,
        seriesIndex: index,
        // Not the series color: a whisker in the bar's own color vanishes
        // where it overlaps the bar, so it falls back to currentColor.
        style: s.intervalStyle,
      }),
    );
  }
  return out;
});

/**
 * Pixel position of an interval endpoint. With a `seriesIndex` in a
 * grouped layout the whisker centers on that series' bar; otherwise on
 * the category slot. Nothing is dropped while zoomed: the whiskers sit
 * inside the plot clip.
 */
function projectInterval(
  iv: ChartInterval,
  value: number,
): { x: number; y: number } | null {
  if (!isFinite(iv.x) || !isFinite(value) || !hasLayout.value) {
    return null;
  }
  // Off the category axis entirely: the plot clip only applies while
  // zoomed, so this would otherwise paint over the padding.
  if (!onCategoricalAxis(iv.x)) return null;
  let categoricalPx = positionPixel(iv.x);
  const k = visibleSeries.value.length;
  if (iv.seriesIndex !== undefined && props.layout === "grouped" && k > 1) {
    const pos = visibleSeries.value.findIndex(
      ({ index }) => index === iv.seriesIndex,
    );
    if (pos < 0) return null;
    const slot = continuous.value
      ? slotIndexAt(continuous.value.slots, iv.x)
      : iv.x;
    if (slot === null) return null;
    const g = slotGroup(slot);
    categoricalPx = g.start + pos * (g.bar + props.groupGap) + g.bar / 2;
  }
  return placePoint(categoricalPx, valuePixel(value));
}

/** A point from its categorical- and value-axis pixels, per orientation. */
function placePoint(
  categoricalPx: number,
  valuePx: number,
): { x: number; y: number } {
  return isVertical.value
    ? { x: categoricalPx, y: valuePx }
    : { x: valuePx, y: categoricalPx };
}

/**
 * Value extent across all series (accounting for stacking) for the
 * categories `start..end`. `win` is that stretch of the categorical axis,
 * in `positionPixel` units, for shared-scale summary lines, whose points
 * need not sit on a slot.
 */
function dataValueExtent(
  start: number,
  end: number,
  win: { min: number; max: number },
) {
  let min = Infinity;
  let max = -Infinity;
  let smallestPositive = Infinity;
  const visitPositive = (v: number) => {
    if (v > 0 && v < smallestPositive) smallestPositive = v;
  };
  if (props.layout === "stacked") {
    for (let i = start; i <= end; i++) {
      let pos = 0;
      let neg = 0;
      for (const { series: s } of visibleSeries.value) {
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
    for (const { series: s } of visibleSeries.value) {
      const last = Math.min(end, s.data.length - 1);
      for (let i = start; i <= last; i++) {
        const n = Number(s.data[i]);
        if (!isFinite(n)) continue;
        visitPositive(n);
        if (n < min) min = n;
        if (n > max) max = n;
      }
    }
  }
  summaryLinesStyled.value.forEach((line, i) => {
    if (line.extent || isHidden(line.legend)) return;
    const xs = summaryLinePositions.value[i];
    visitCurveWindow(
      line.data.length,
      (j) => xs[j],
      (j) => Number(line.data[j]),
      win,
      line.curve,
      (v) => {
        visitPositive(v);
        if (v < min) min = v;
        if (v > max) max = v;
      },
    );
  });
  for (const list of [topIntervals.value, seriesIntervalList.value]) {
    for (const iv of list) {
      if (!inSlotRange(iv.x, start, end)) continue;
      for (const v of [iv.lower, iv.upper, iv.value]) {
        if (v === undefined || !isFinite(v)) continue;
        visitPositive(v);
        if (v < min) min = v;
        if (v > max) max = v;
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
}

const fullValueExtent = computed(() =>
  dataValueExtent(
    0,
    categoryCount.value - 1,
    continuous.value
      ? xFullDomain.value
      : { min: -0.5, max: categoryCount.value - 0.5 },
  ),
);

/**
 * Visible value extent: a box zoom's window, else the extent of the
 * visible categories (so the axis rescales while zoomed along them).
 */
/** Value extent of the visible categories' data. */
const visibleValueExtent = computed(() => {
  const { start, end } = visibleRange.value;
  return dataValueExtent(
    start,
    end,
    continuous.value ? xDomain.value : { min: start - 0.5, max: end + 0.5 },
  );
});

const valueExtent = computed(() => {
  const w = valueWindow.value;
  if (w) return { min: w.min, max: w.max, range: w.max - w.min || 1 };
  return visibleValueExtent.value;
});

/**
 * Plot edges the zoom window does not cut through: the category edges
 * clamped to the first/last category, and the value edges while the value
 * axis rescales to the visible bars (or a box edge at or past their
 * extent). Whisker dots and caps on those edges are left whole.
 */
const clipOpen = computed<PlotClipEdges>(() => {
  const { start, end } = visibleRange.value;
  const catLo = continuous.value
    ? xDomain.value.min <= xFullDomain.value.min
    : start <= 0;
  const catHi = continuous.value
    ? xDomain.value.max >= xFullDomain.value.max
    : end >= categoryCount.value - 1;
  const v = valueExtent.value;
  const dv = visibleValueExtent.value;
  const valLo = v.min <= dv.min;
  const valHi = v.max >= dv.max;
  return isVertical.value
    ? { left: catLo, right: catHi, bottom: valLo, top: valHi }
    : { top: catLo, bottom: catHi, left: valLo, right: valHi };
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
  const n = visibleCount.value;
  return n > 0 ? categoricalSize.value / n : 0;
});

/** Total width allocated to bars within one category slot. */
const groupWidth = computed(() => slotSize.value * (1 - props.barPadding));

/** Width of an individual bar (always; for stacked it's the full group). */
const barWidth = computed(() => {
  const k = visibleSeries.value.length;
  if (k === 0) return 0;
  if (props.layout === "stacked" || k === 1) return groupWidth.value;
  const totalGap = props.groupGap * (k - 1);
  return Math.max(1, (groupWidth.value - totalGap) / k);
});

/** Pixel position of the start of category slot `i` along the categorical axis. */
function slotStart(i: number): number {
  const base = isVertical.value ? padding.value.left : padding.value.top;
  return base + (i - visibleRange.value.start) * slotSize.value;
}

/** Whether the chart has room and slots to lay bars out in. */
const hasLayout = computed(
  () =>
    categoryCount.value > 0 &&
    categoricalSize.value > 0 &&
    (continuous.value !== null || slotSize.value > 0),
);

/** Pixel position of a continuous-axis value along the categorical axis. */
function xPixel(v: number): number {
  const { min, max } = xDomain.value;
  const base = isVertical.value ? padding.value.left : padding.value.top;
  return base + ((v - min) / (max - min || 1)) * categoricalSize.value;
}

/**
 * Pixel position of a point on the categorical axis: a category index
 * (fractions land between categories) or a continuous-axis value.
 */
function positionPixel(v: number): number {
  return continuous.value ? xPixel(v) : slotStart(v + 0.5);
}

/** Center of slot `i`, in the units `positionPixel` takes. */
function slotCenter(i: number): number {
  const c = continuous.value;
  return c ? (c.slots.start[i] + c.slots.end[i]) / 2 : i;
}

/** Whether a categorical-axis position falls on the chart's slots at all. */
function onCategoricalAxis(v: number): boolean {
  if (!continuous.value) return v >= -0.5 && v <= categoryCount.value - 0.5;
  const { min, max } = xFullDomain.value;
  return v >= min && v <= max;
}

/** Whether a categorical-axis position falls within slots `start..end`. */
function inSlotRange(v: number, start: number, end: number): boolean {
  const c = continuous.value;
  if (!c) return v >= start - 0.5 && v <= end + 0.5;
  if (end < start) return false;
  return v >= c.slots.start[start] && v <= c.slots.end[end];
}

/** Pixel extent of slot `i` along the categorical axis. */
function slotSpan(i: number): { start: number; size: number } {
  const c = continuous.value;
  if (!c) return { start: slotStart(i), size: slotSize.value };
  const a = xPixel(c.slots.start[i]);
  return { start: a, size: xPixel(c.slots.end[i]) - a };
}

/**
 * Where slot `i`'s bar group starts, how wide the group is, and the width
 * of one bar in it (the whole group when stacked or single-series).
 */
function slotGroup(i: number): { start: number; width: number; bar: number } {
  if (!continuous.value) {
    return {
      start: slotStart(i) + (slotSize.value - groupWidth.value) / 2,
      width: groupWidth.value,
      bar: barWidth.value,
    };
  }
  const span = slotSpan(i);
  const width = span.size * (1 - props.barPadding);
  const k = visibleSeries.value.length;
  const bar =
    props.layout === "stacked" || k <= 1
      ? width
      : Math.max(1, (width - props.groupGap * (k - 1)) / k);
  return { start: span.start + (span.size - width) / 2, width, bar };
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
  const seriesList = visibleSeries.value;
  const k = seriesList.length;
  if (k === 0) return out;
  if (!hasLayout.value) return out;
  const { start, end } = visibleRange.value;
  const baseline = groupedBaselinePixel.value;

  for (let i = start; i <= end; i++) {
    const { start: groupStart, width: group, bar: bw } = slotGroup(i);
    if (props.layout === "stacked") {
      let posCursor = 0;
      let negCursor = 0;
      for (let s = 0; s < k; s++) {
        const { series, index } = seriesList[s];
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
            series.color ?? defaultColor(index),
            series.opacity ?? 1,
            series.blendMode,
            raw,
            i,
            index,
          ),
        );
        if (raw >= 0) posCursor = top;
        else negCursor = top;
      }
    } else if (props.layout === "overlay") {
      for (let s = 0; s < k; s++) {
        const { series, index } = seriesList[s];
        const raw = Number(series.data[i] ?? NaN);
        if (!isFinite(raw)) continue;
        out.push(
          makeBar(
            baseline,
            valuePixel(raw),
            groupStart,
            group,
            series.color ?? defaultColor(index),
            series.opacity ?? 1,
            series.blendMode,
            raw,
            i,
            index,
          ),
        );
      }
    } else {
      for (let s = 0; s < k; s++) {
        const { series, index } = seriesList[s];
        const raw = Number(series.data[i] ?? NaN);
        if (!isFinite(raw)) continue;
        const barStart = groupStart + (k === 1 ? 0 : s * (bw + props.groupGap));
        out.push(
          makeBar(
            baseline,
            valuePixel(raw),
            barStart,
            bw,
            series.color ?? defaultColor(index),
            series.opacity ?? 1,
            series.blendMode,
            raw,
            i,
            index,
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
  x?: BarChartXInput;
  color: string;
  strokeWidth: number;
  dashed: boolean;
  opacity: number;
  blendMode?: BlendMode;
  curve?: LineCurve;
  dots: boolean;
  dotRadius: number;
  /** Null on the bars' shared value axis. */
  extent: { min: number; max: number } | null;
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
  const categoricalPx = positionPixel(x);
  const span = extent.max - extent.min || 1;
  let frac = (y - extent.min) / span;
  // A line has its own scale spanning the full plot; under a box zoom it
  // follows the same slice of the plot the bars' value axis shows.
  const slice = valueZoomSlice.value;
  if (slice) frac = (frac - slice.lo) / (slice.hi - slice.lo);
  const valuePx = isVertical.value
    ? padding.value.top + innerH.value - frac * innerH.value
    : padding.value.left + frac * innerW.value;
  return placePoint(categoricalPx, valuePx);
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
      curve: line.curve,
      dots: line.dots ?? false,
      dotRadius: line.dotRadius ?? (line.strokeWidth ?? 2) + 1,
      extent: line.scale === "shared" ? null : computeLineExtent(line),
      legend: line.legend,
      showInLegend: line.showInLegend !== false,
    };
  });
});

/**
 * Each summary line's point positions on the categorical axis, in
 * `positionPixel` units, parallel to `summaryLinesStyled`. Kept out of the
 * styled lines, which must not depend on layout.
 */
const summaryLinePositions = computed(() =>
  summaryLinesStyled.value.map((line) => {
    const xs = toNumericX(line.x, xIsDate.value, tz.value);
    const out = new Float64Array(line.data.length);
    for (let j = 0; j < out.length; j++) {
      out[j] = xs
        ? Number(xs[j])
        : j < categoryCount.value
          ? slotCenter(j)
          : NaN;
    }
    return out;
  }),
);

const summaryLinesResolved = computed<ResolvedSummaryLine[]>(() => {
  if (!hasLayout.value) return [];
  const positions = summaryLinePositions.value;
  return summaryLinesStyled.value.flatMap((line, i): ResolvedSummaryLine[] => {
    if (isHidden(line.legend)) return [];
    const points: CurvePoint[] = [];
    let d = "";
    let run: CurvePoint[] = [];
    const axis = isVertical.value ? "x" : "y";
    for (let j = 0; j < line.data.length; j++) {
      const yv = Number(line.data[j]);
      const xv = positions[i][j];
      if (!isFinite(yv) || !isFinite(xv)) {
        d += curvePath(run, line.curve, { axis });
        run = [];
        continue;
      }
      const p = line.extent
        ? projectLinePoint(xv, yv, line.extent)
        : placePoint(positionPixel(xv), valuePixel(yv));
      points.push(p);
      run.push(p);
    }
    d += curvePath(run, line.curve, { axis });
    return [{ ...line, pathD: d, points }];
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
  let decimals = 0;
  const fmt = (v: number) =>
    props.valueTickFormat !== undefined
      ? formatNumber(v, props.valueTickFormat)
      : formatTick(v, decimals);
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
  decimals = tickDecimals(values);
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

const chartFontFamily = useChartFontFamily(() => svgRef.value);

/** Smallest gap kept between neighboring x tick labels. */
const X_TICK_LABEL_GAP = 8;

/** A continuous x tick label. */
function formatXTick(
  v: number,
  i: number,
  unit?: DateTickUnit,
  decimals = 0,
): string {
  const f = props.xTickFormat;
  if (typeof f === "function") {
    return (f as (value: number, index: number) => string)(v, i);
  }
  if (xIsDate.value) {
    return formatDate(
      v,
      (f as DateFormat | undefined) ?? props.dateFormat,
      tz.value,
      unit,
    );
  }
  return f !== undefined
    ? formatNumber(v, f as NumberFormat)
    : formatTick(v, decimals);
}

/** Tick values on a continuous x axis, and the date unit they count in. */
const xTickValues = computed<{ values: number[]; unit?: DateTickUnit }>(() => {
  const { min, max } = xDomain.value;
  const size = categoricalSize.value;
  if (!(max > min) || size <= 0) return { values: [] };
  const vertical = isVertical.value;
  if (xIsDate.value) {
    const picked =
      props.xTicks != null
        ? placedDateTicks(min, max, props.xTicks)
        : pickDateTicks(
            min,
            max,
            size / (vertical ? 60 : 40),
            tz.value,
            vertical
              ? (values, unit) => {
                  const { fontSize, fontWeight } = tickLabelResolved.value;
                  return tickLabelsFit(values, {
                    min,
                    max,
                    size,
                    font: `${fontWeight ?? 400} ${fontSize}px ${chartFontFamily.value}`,
                    gap: X_TICK_LABEL_GAP,
                    label: (v, i) => formatXTick(v, i, unit),
                  });
                }
              : undefined,
          );
    return {
      values: computeTickValues({ min, max, ticks: picked.values }),
      unit: picked.unit,
    };
  }
  return {
    values: computeTickValues({
      min,
      max,
      ticks: props.xTicks,
      targetTickCount: size / (vertical ? 80 : 40),
    }),
  };
});

const categoryTickItems = computed<CategoryTickItem[]>(() => {
  if (continuous.value) {
    const { values, unit } = xTickValues.value;
    const decimals = xIsDate.value ? 0 : tickDecimals(values);
    const lo = isVertical.value ? padding.value.left : padding.value.top;
    const hi = lo + categoricalSize.value;
    return values.map((v, i) => {
      const pos = snap(xPixel(v));
      const anchor = pos - lo <= 1 ? "start" : hi - pos <= 1 ? "end" : "middle";
      return { label: formatXTick(v, i, unit, decimals), pos, anchor };
    });
  }
  const n = categoryCount.value;
  const { start, end } = visibleRange.value;
  const dateMs = categoryDatesMs.value;

  // Date mode: thin labels to the closest category index for each
  // tick boundary picked by `pickDateTicks`. Bar positions stay
  // ordinal — only the labels become date-aware.
  if (dateMs && dateMs.length > 0) {
    let min = Infinity;
    let max = -Infinity;
    const last = Math.min(end, dateMs.length - 1);
    for (let i = start; i <= last; i++) {
      const m = dateMs[i];
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
      for (let i = start; i <= last; i++) {
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
  for (let i = start; i <= end; i++) {
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
  for (let i = start; i <= end; i += stride) {
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
    lower: s.lower,
    upper: s.upper,
  }));
  const c = continuous.value;
  if (!c) return categoricalToCsv(categoryLabels.value, namedSeries);
  const ends = c.slots.explicit.some(Boolean)
    ? [{ header: "x_end", values: c.slots.end.map(xText) }]
    : [];
  return categoricalToCsv(categoryLabels.value, namedSeries, "x", ends);
}

function projectAnnotation(
  x: number,
  y: number,
): { x: number; y: number } | null {
  if (!isFinite(x) || !isFinite(y)) return null;
  if (!hasLayout.value) return null;
  if (isZoomed.value) {
    if (continuous.value) {
      if (x < xDomain.value.min || x > xDomain.value.max) return null;
    } else {
      const { start, end } = visibleRange.value;
      if (x < start - 0.5 || x > end + 0.5) return null;
    }
    if (y < valueExtent.value.min || y > valueExtent.value.max) return null;
  }
  const categoricalPx = positionPixel(x);
  const valuePx = valuePixel(y);
  return isVertical.value
    ? { x: categoricalPx, y: valuePx }
    : { x: valuePx, y: categoricalPx };
}

function pointerToIndex(clientX: number, clientY: number): number | null {
  const rect = containerRef.value?.getBoundingClientRect();
  if (!rect) return null;
  if (!hasLayout.value) return null;
  const { start, end } = visibleRange.value;
  const local = isVertical.value
    ? clientX - rect.left - padding.value.left
    : clientY - rect.top - padding.value.top;
  const c = continuous.value;
  if (c) {
    const { min, max } = xDomain.value;
    const v = min + (local / categoricalSize.value) * (max - min);
    const i = slotIndexAt(c.slots, v);
    return i === null ? null : Math.max(start, Math.min(end, i));
  }
  return Math.max(
    start,
    Math.min(end, start + Math.floor(local / slotSize.value)),
  );
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
  overlayHandlers,
  brushRect,
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
  zoom: {
    mode: () =>
      props.zoom
        ? { axis: isVertical.value ? "x" : "y", box: props.zoom === true }
        : null,
    onSelect: onZoomSelect,
    onReset: resetZoom,
  },
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

/** A continuous-axis position as tooltip text. */
function formatXTooltip(v: number): string {
  if (xIsDate.value) return formatDate(v, props.dateFormat, tz.value);
  const f = props.xTickFormat;
  if (f !== undefined && typeof f !== "object") {
    return typeof f === "function"
      ? (f as (value: number, index: number) => string)(v, 0)
      : formatNumber(v, f as NumberFormat);
  }
  return String(Number(v.toPrecision(6)));
}

const MS_PER_DAY = 86_400_000;

/**
 * Tooltip heading for a continuous slot: its x, or its span for bars
 * with an `x2` or `period`. Day-aligned date spans show their last day,
 * so a week reads "2026-01-05 – 2026-01-11".
 */
function continuousSlotLabel(slots: BarSlots, i: number): string {
  if (!slots.explicit[i]) return formatXTooltip(slots.x[i]);
  const a = slots.start[i];
  let b = slots.end[i];
  if (xIsDate.value && (b - a) % MS_PER_DAY === 0) b -= MS_PER_DAY;
  if (b === a) return formatXTooltip(a);
  return `${formatXTooltip(a)} – ${formatXTooltip(b)}`;
}

const hoveredCategoryLabel = computed(() => {
  const i = hoverIndex.value;
  if (i === null) return undefined;
  const c = continuous.value;
  if (c) return continuousSlotLabel(c.slots, i);
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
    if (s.showInTooltip === false || isHidden(s.legend)) continue;
    const lower = s.lower ? Number(s.lower[idx] ?? NaN) : NaN;
    const upper = s.upper ? Number(s.upper[idx] ?? NaN) : NaN;
    const hasBounds = isFinite(lower) && isFinite(upper);
    values.push({
      value: Number(s.data[idx] ?? NaN),
      color: s.color ?? defaultColor(i),
      seriesIndex: i,
      label: s.tooltipLabel || s.legend || undefined,
      lower: hasBounds ? Math.min(lower, upper) : undefined,
      upper: hasBounds ? Math.max(lower, upper) : undefined,
    });
  }
  const intervals: ChartTooltipInterval[] = [];
  for (const iv of topIntervals.value) {
    const at = continuous.value
      ? slotIndexAt(continuous.value.slots, iv.x)
      : Math.round(iv.x);
    if (at !== idx) continue;
    intervals.push({
      lower: Math.min(iv.lower, iv.upper),
      upper: Math.max(iv.lower, iv.upper),
      value: iv.value,
      color: resolveIntervalStyle(iv, props.intervalStyle).color,
      label: iv.label,
    });
  }
  const label = hoveredCategoryLabel.value ?? "";
  return {
    index: idx,
    category: categoryLabels.value[idx] ?? String(idx),
    title: label && props.tooltipTitle ? props.tooltipTitle(label, idx) : label,
    values,
    intervals,
    data: props.tooltipData?.[idx] ?? null,
    format: formatTooltipValue,
  };
});

/** Pixel rectangle of the hovered category slot (for the highlight band). */
const hoverBand = computed(() => {
  const i = hoverIndex.value;
  if (i === null) return null;
  const { start, size } = slotSpan(i);
  if (isVertical.value) {
    return {
      x: start,
      y: padding.value.top,
      w: size,
      h: innerH.value,
    };
  }
  return {
    x: padding.value.left,
    y: start,
    w: innerW.value,
    h: size,
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
      <ChartLegendToggles
        v-if="legendToggle && positionedLegendItems.length > 0"
        :items="positionedLegendItems"
        :is-hidden="isHidden"
        :font-size="legendResolved.fontSize"
        :font-weight="legendResolved.fontWeight"
        @toggle="toggleLegend"
      />
      <svg
        ref="svgRef"
        :width="width"
        :height="height"
        :role="chartRole || undefined"
        :aria-label="chartAriaLabel || undefined"
      >
        <ChartPlotClip
          v-if="isZoomed"
          :id="clipId"
          :padding="padding"
          :inner-w="innerW"
          :inner-h="innerH"
          :open="clipOpen"
        />
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
          <g
            v-for="(item, i) in positionedLegendItems"
            :key="'ileg' + i"
            :opacity="isHidden(item.label) ? 0.4 : undefined"
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
              :text-decoration="
                isHidden(item.label) ? 'line-through' : undefined
              "
            >
              {{ item.label }}
            </text>
          </g>
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
        <ChartGridLines
          v-if="valueGridStyle && valueAxis"
          :axis="isVertical ? 'y' : 'x'"
          :positions="valueTickItems.map((t) => t.pos)"
          :start="isVertical ? padding.left : padding.top"
          :end="isVertical ? padding.left + innerW : padding.top + innerH"
          :grid-style="valueGridStyle"
        />
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
          :x-label-align="xLabelAlign"
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
        <!-- plot marks, clipped to the plot while zoomed -->
        <g :clip-path="isZoomed ? `url(#${clipId})` : undefined">
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
            :style="blendStyle(bar.blendMode)"
          />
          <!-- interval whiskers: per-series first, then standalone ones -->
          <ChartIntervals
            v-if="seriesIntervalList.length > 0"
            :intervals="seriesIntervalList"
            :defaults="intervalStyle"
            :project="projectInterval"
          />
          <ChartIntervals
            v-if="topIntervals.length > 0"
            :intervals="topIntervals"
            :defaults="intervalStyle"
            :project="projectInterval"
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
              :style="blendStyle(line.blendMode)"
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
                :style="blendStyle(line.blendMode)"
              />
            </template>
          </template>
        </g>
        <!-- drag-to-zoom selection -->
        <ChartBrushRect v-if="brushRect" :rect="brushRect" />
        <!-- Tooltip / zoom: interaction overlay -->
        <rect
          v-if="hasTooltipSlot || zoom"
          data-testid="chart-overlay"
          :x="padding.left"
          :y="padding.top"
          :width="innerW"
          :height="innerH"
          fill="transparent"
          :style="`cursor: crosshair; touch-action: ${isVertical ? 'pan-y' : 'pan-x'}`"
          v-on="overlayHandlers"
        />
        <!-- annotations (top layer) -->
        <ChartAnnotations
          v-if="annotations && annotations.length > 0"
          :annotations="annotations"
          :project="projectAnnotation"
          :bounds="bounds"
        />
      </svg>
      <ChartZoomControls
        v-if="isZoomed"
        reset-only
        :position="menu ? 'beside-menu' : 'right'"
        :is-fullscreen="isFullscreen"
        @reset="resetZoom"
      />
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
          <ChartTooltipContent
            :title="hoverSlotProps.title"
            :values="hoverSlotProps.values"
            :intervals="hoverSlotProps.intervals"
            :format="hoverSlotProps.format"
          />
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

.bar-chart-download-link {
  display: block;
  text-align: right;
  font-size: var(--font-size-sm);
  margin-top: 0.25em;
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
