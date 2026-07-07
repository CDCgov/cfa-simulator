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
  seriesToCsv,
  useChartFoundation,
  makeTooltipValueFormatter,
  ChartAnnotations,
  INLINE_LEGEND_ROW_HEIGHT,
  TITLE_LINE_HEIGHT,
  TITLE_FONT_SIZE,
  TITLE_FONT_WEIGHT,
  AXIS_LABEL_FONT_SIZE,
  TICK_LABEL_FONT_SIZE,
  TICK_LABEL_OPACITY,
  LEGEND_FONT_SIZE,
  resolveLabelStyle,
  parseDate,
  isAllDates,
  pickDateTicks,
  formatDate,
  type ChartData,
  type LabelStyle,
  type DateFormat,
  type DateTickUnit,
  type DateTimezone,
  type ChartCommonProps,
  type ChartHoverPayload,
  type ChartTooltipBaseProps,
  type ChartTooltipValue,
  type BlendMode,
  type LineMarkStyle,
} from "../_shared/index.js";

/**
 * Numeric input accepted by the chart. `number[]` and any standard numeric
 * typed array are supported, so the output of
 * `ModelOutput.column('x')` (e.g. a `Float64Array`) can be passed directly
 * without copying into a plain array.
 */
export type LineChartData = ChartData;

/**
 * Accepted shapes for an `x` array. Numeric arrays (typed or plain) plot
 * as numbers; string-or-`Date` arrays trigger date-axis mode when every
 * element parses. See the `timezone` prop and `dateAxis` module.
 */
export type LineChartXInput = LineChartData | readonly (string | Date)[];

/**
 * A single line/dot series. Inherits visual styling
 * (`color`, `strokeWidth`, `dashed`, `opacity`, `blendMode`, `dots`,
 * `dotRadius`, `legend`, `showInLegend`) from `LineMarkStyle`, shared
 * with `BarChart`'s `BarSummaryLine`.
 */
export interface Series extends LineMarkStyle {
  /**
   * Y-values. One of `y` or `data` must be supplied; `y` wins if both
   * are set.
   */
  y?: LineChartData;
  /** Y-values (alternative name for `y`). */
  data?: LineChartData;
  /**
   * Optional x-values, parallel to `y`/`data`. When set, the chart
   * plots points at the given x positions (irregular spacing supported).
   * When omitted, points are plotted at indices 0, 1, 2, ... Accepts
   * date strings or `Date` objects to enable date-axis mode.
   */
  x?: LineChartXInput;
  /** Overrides `opacity` for the line stroke only. */
  lineOpacity?: number;
  /** Overrides `opacity` for the dots only. */
  dotOpacity?: number;
  /** Draw the line. Default true. */
  line?: boolean;
  /**
   * Draw a page-colored stroke behind the line so it stays visually
   * separated from overlapping series and busy backgrounds. Has no
   * effect when `line` is `false`.
   */
  outline?: boolean;
  /**
   * Outline stroke color. Defaults to the page background
   * (`var(--color-bg-0, #fff)`). Only applies when `outline` is true.
   */
  outlineColor?: string;
  /**
   * Total extra width added to the line's `strokeWidth` for the outline
   * (split evenly on each side). Defaults to `4`. Only applies when
   * `outline` is true.
   */
  outlineWidth?: number;
  dotFill?: string;
  dotStroke?: string;
  /**
   * Whether this series contributes a value to the tooltip and shows a
   * hover dot. Defaults to true. The series line/dots are still drawn.
   */
  showInTooltip?: boolean;
}

export interface Area {
  upper: LineChartData;
  lower: LineChartData;
  /** Optional x-values parallel to `upper`/`lower`. See `Series.x`. */
  x?: LineChartXInput;
  color?: string;
  opacity?: number;
  /** Label shown in the inline legend. */
  legend?: string;
  /**
   * Whether this area appears in the inline legend. Defaults to true.
   * Has no effect when `legend` is unset.
   */
  showInLegend?: boolean;
  /**
   * CSS `mix-blend-mode` applied to the area fill. Lets overlapping
   * areas (e.g. confidence bands) combine their colors instead of one
   * obscuring the other.
   */
  blendMode?: BlendMode;
}

export interface AreaSection {
  /** Index into the series array. When omitted, fills the full chart height with no line. */
  seriesIndex?: number;
  /** Start x-index (inclusive) */
  startIndex: number;
  /** End x-index (inclusive) */
  endIndex: number;
  /** Fill color; defaults to referenced series color */
  color?: string;
  /** Fill opacity; defaults to 0.15 */
  opacity?: number;
  /** Primary label text (e.g. "Day 36–63") */
  label?: string;
  /** Secondary description text (e.g. "40.0M vaccines administered") */
  description?: string;
  /** Stroke width for the highlighted line segment (default: 2) */
  strokeWidth?: number;
  /** Dashed stroke pattern */
  dashed?: boolean;
  /** Label placement: "below" (default) renders below chart, "inline" renders in legend row, false hides label */
  legend?: "inline" | "below" | false;
  /**
   * Style for the area section's primary label text. Defaults: font-size
   * 11, font-weight 600, color taken from the section's `color`.
   */
  inlineLabelStyle?: LabelStyle;
  /**
   * Style for the area section's secondary description text. Defaults:
   * font-size 11, currentColor at 0.6 opacity. Providing `color` drops
   * the default opacity.
   */
  inlineDescriptionStyle?: LabelStyle;
}

interface LineChartProps extends ChartCommonProps {
  /** Y-values. Equivalent to `data`. If both are set, `y` wins. */
  y?: LineChartData;
  /** Y-values (alternative name for `y`). */
  data?: LineChartData;
  /**
   * Optional x-values paired with `y`/`data`. When provided, points
   * are plotted at the given x positions instead of at their indices.
   * Ignored when `series` is used — set `x` on each `Series` instead.
   * Accepts date strings or `Date` objects to enable date-axis mode.
   */
  x?: LineChartXInput;
  series?: Series[];
  areas?: Area[];
  areaSections?: AreaSection[];
  lineOpacity?: number;
  yMin?: number;
  /**
   * Scale type for the y axis. `"linear"` (default) maps values directly
   * to pixels; `"log"` uses a base-10 log mapping. On a log axis,
   * non-positive values collapse to the visible minimum, and `yMin <= 0`
   * is ignored.
   */
  yScaleType?: "linear" | "log";
  /**
   * Offset applied to index-based x values (e.g. `xMin: 10` starts the
   * x axis at 10 instead of 0). Ignored when any series or area has
   * explicit `x` values.
   */
  xMin?: number;
  /**
   * Tick placement on the x-axis. Number = interval in data units
   * (respecting `xMin`, e.g. `7` ticks every 7 days). Array = explicit tick
   * values in data space; values outside the data range are dropped.
   * When omitted, ticks are chosen automatically.
   */
  xTicks?: number | number[];
  /**
   * Tick placement on the y-axis. Number = interval in data units. Array =
   * explicit tick values; values outside the data range are dropped. When
   * omitted, ticks are chosen automatically.
   */
  yTicks?: number | number[];
  /**
   * Formatter for x-axis tick labels. On a numeric axis, accepts a
   * preset name, a printf-style format string, or a function (the
   * two-arg `(value, index)` form is also supported for index-based
   * labels — see `formatNumber` in `@cfasim-ui/shared`). On a date
   * axis (auto-detected when every x value parses as a date), accepts
   * a `DateFormat` instead — see the `dateAxis` module.
   */
  xTickFormat?:
    | NumberFormat
    | ((value: number, index: number) => string)
    | DateFormat;
  /**
   * Timezone used when parsing offset-less ISO strings and rendering
   * date-axis tick labels. `"utc"` (default) keeps visuals consistent
   * across viewers; `"local"` uses the browser timezone. Ignored on a
   * numeric axis.
   */
  timezone?: DateTimezone;
  /**
   * Formatter for y-axis tick labels. Accepts a preset name, a printf-style
   * format string, or a function. See `formatNumber` in `@cfasim-ui/shared`.
   */
  yTickFormat?: NumberFormat;
  /**
   * @deprecated Use `xTickFormat` (e.g. `(_, i) => labels[i]`) together
   * with `xTicks` for explicit control. Still honored for tooltip x-labels
   * and as a default x-tick formatter when `xTickFormat` is not provided.
   */
  xLabels?: string[];
  xGrid?: boolean;
  yGrid?: boolean;
}

const props = withDefaults(defineProps<LineChartProps>(), {
  lineOpacity: 1,
  menu: true,
  tooltipClamp: "window",
  yScaleType: "linear",
});

// Accessible name for the chart; falls back to the visible title.
const chartAriaLabel = computed(() => props.ariaLabel ?? props.title);
// Expose the <svg> as a single labeled image so screen readers announce the
// name instead of wandering through the individual marks. The menu/download
// controls live outside the <svg>, so they stay reachable. An explicit `role`
// prop always wins.
const chartRole = computed(
  () => props.role ?? (chartAriaLabel.value ? "img" : undefined),
);

// The template root is a <Teleport>, so fallthrough attrs (class, style,
// data-*, id…) can't auto-inherit — forward them onto the wrapper manually.
defineOptions({ inheritAttrs: false });

const emit = defineEmits<{
  (e: "hover", payload: ChartHoverPayload): void;
}>();

defineSlots<{
  tooltip?(props: ChartTooltipBaseProps & { xLabel?: string }): unknown;
}>();

/**
 * Internal series shape where `data` (y-values) is always resolved and
 * `x` is narrowed to numeric (date inputs have already been parsed to
 * epoch-ms). `Series.y` takes precedence over `Series.data`.
 */
type ResolvedSeries = Omit<Series, "data" | "y" | "x"> & {
  data: LineChartData;
  x?: LineChartData;
};

/** Same shape as `Area` but with `x` narrowed to numeric post-parse. */
type ResolvedArea = Omit<Area, "x"> & { x?: LineChartData };

const EMPTY_DATA: readonly number[] = [];

/**
 * Yields every user-supplied `x` array on the component (top-level,
 * per-series, per-area). Used both for date auto-detection and for the
 * single-pass resolution that converts strings/Dates to numeric ms.
 */
function* xInputs(p: LineChartProps): Iterable<LineChartXInput> {
  if (p.x && p.x.length > 0) yield p.x;
  if (p.series) {
    for (const s of p.series) if (s.x && s.x.length > 0) yield s.x;
  }
  if (p.areas) {
    for (const a of p.areas) if (a.x && a.x.length > 0) yield a.x;
  }
}

/** Convert an x input to numeric. Pre-parsed when `isDate` is true. */
function toNumericX(
  x: LineChartXInput | undefined,
  isDate: boolean,
  tz: DateTimezone,
): LineChartData | undefined {
  if (!x) return undefined;
  if (!isDate) return x as LineChartData;
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const v = parseDate(x[i], tz);
    out[i] = v ?? NaN;
  }
  return out;
}

const formatTooltipValue = makeTooltipValueFormatter(
  () => props.tooltipValueFormat,
  () => props.yTickFormat,
);

const tz = computed<DateTimezone>(() => props.timezone ?? "utc");

/**
 * Single-pass resolution of x-axis mode + resolved series and areas.
 * Date auto-detection (`isAllDates` per input array) and date→ms
 * conversion (`toNumericX`) both call `parseDate`; this computed
 * makes sure each user-supplied x value is parsed exactly once per
 * render even though we have multiple consumers.
 */
const resolvedXAxis = computed<{
  isDate: boolean;
  series: ResolvedSeries[];
  areas: ResolvedArea[];
}>(() => {
  const z = tz.value;
  let isDate = false;
  let any = false;
  for (const x of xInputs(props)) {
    any = true;
    if (!isAllDates(x, z)) {
      isDate = false;
      break;
    }
    isDate = true;
  }
  if (!any) isDate = false;

  const series: ResolvedSeries[] =
    props.series && props.series.length > 0
      ? props.series.map((s) => ({
          ...s,
          data: s.y ?? s.data ?? EMPTY_DATA,
          x: toNumericX(s.x, isDate, z),
        }))
      : (() => {
          const topY = props.y ?? props.data;
          return topY
            ? [{ data: topY, x: toNumericX(props.x, isDate, z) }]
            : [];
        })();

  const areas: ResolvedArea[] = (props.areas ?? []).map((a) => ({
    ...a,
    x: toNumericX(a.x, isDate, z),
  }));

  return { isDate, series, areas };
});

const xIsDate = computed(() => resolvedXAxis.value.isDate);
const allSeries = computed<ResolvedSeries[]>(() => resolvedXAxis.value.series);
const allAreas = computed<ResolvedArea[]>(() => resolvedXAxis.value.areas);

const maxLen = computed(() => {
  let m = 0;
  for (const s of allSeries.value) {
    if (s.data.length > m) m = s.data.length;
  }
  for (const a of allAreas.value) {
    if (a.upper.length > m) m = a.upper.length;
    if (a.lower.length > m) m = a.lower.length;
  }
  return m;
});

/** True when any series/area supplies explicit x-values (irregular x mode). */
const hasExplicitX = computed(
  () =>
    allSeries.value.some((s) => s.x != null) ||
    allAreas.value.some((a) => a.x != null),
);

/** Data-space x value for the i-th point of a series. */
function seriesXAt(s: { x?: LineChartData }, i: number): number {
  return s.x ? Number(s.x[i]) : i;
}

/** Data-space x value for the i-th point of an area. */
function areaXAt(a: ResolvedArea, i: number): number {
  return a.x ? Number(a.x[i]) : i;
}

/**
 * Display-only offset: added to tick values and tooltip x-labels so
 * `xMin: 10` with index-based data shows "10, 11, …" without changing
 * where points are drawn. Ignored when explicit `x` is provided.
 */
const xDisplayOffset = computed(() =>
  hasExplicitX.value ? 0 : (props.xMin ?? 0),
);

const xExtent = computed(() => {
  let min = Infinity;
  let max = -Infinity;
  for (const s of allSeries.value) {
    for (let i = 0; i < s.data.length; i++) {
      const v = seriesXAt(s, i);
      if (!isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  for (const a of allAreas.value) {
    const n = Math.max(a.upper.length, a.lower.length);
    for (let i = 0; i < n; i++) {
      const v = areaXAt(a, i);
      if (!isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!isFinite(min)) return { min: 0, max: 0 };
  return { min, max };
});

function xPixel(v: number): number {
  const { min, max } = xExtent.value;
  const range = max - min || 1;
  return padding.value.left + ((v - min) / range) * innerW.value;
}

const extent = computed(() => {
  let min = Infinity;
  let max = -Infinity;
  let smallestPositive = Infinity;
  const visit = (v: number) => {
    if (!isFinite(v)) return;
    if (v < min) min = v;
    if (v > max) max = v;
    if (v > 0 && v < smallestPositive) smallestPositive = v;
  };
  for (const s of allSeries.value) for (const v of s.data) visit(v);
  for (const a of allAreas.value) {
    for (const v of a.upper) visit(v);
    for (const v of a.lower) visit(v);
  }
  if (!isFinite(min)) return { min: 0, max: 0, range: 1 };
  if (props.yMin != null && props.yMin < min) min = props.yMin;
  const clamped = clampExtentForScale(
    min,
    max,
    props.yScaleType,
    smallestPositive,
  );
  return {
    min: clamped.min,
    max: clamped.max,
    range: clamped.max - clamped.min || 1,
  };
});

function yPixel(v: number): number {
  const { min, max } = extent.value;
  const py = padding.value.top + innerH.value;
  return py - scaleFraction(v, min, max, props.yScaleType) * innerH.value;
}

function toPath(s: ResolvedSeries): string {
  const data = s.data;
  if (data.length === 0) return "";
  let d = "";
  let inSegment = false;
  for (let i = 0; i < data.length; i++) {
    const xv = seriesXAt(s, i);
    if (!isFinite(data[i]) || !isFinite(xv)) {
      inSegment = false;
      continue;
    }
    const x = xPixel(xv);
    const y = yPixel(data[i]);
    d += inSegment ? `L${x},${y}` : `M${x},${y}`;
    inSegment = true;
  }
  return d;
}

function toPoints(s: ResolvedSeries): { x: number; y: number }[] {
  const data = s.data;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < data.length; i++) {
    const xv = seriesXAt(s, i);
    if (!isFinite(data[i]) || !isFinite(xv)) continue;
    pts.push({ x: xPixel(xv), y: yPixel(data[i]) });
  }
  return pts;
}

function toAreaPath(a: ResolvedArea): string {
  const len = Math.min(a.upper.length, a.lower.length);
  if (len === 0) return "";
  // Collect contiguous segments where both upper/lower and x are finite
  const segments: number[][] = [];
  let seg: number[] = [];
  for (let i = 0; i < len; i++) {
    if (
      isFinite(a.upper[i]) &&
      isFinite(a.lower[i]) &&
      isFinite(areaXAt(a, i))
    ) {
      seg.push(i);
    } else if (seg.length) {
      segments.push(seg);
      seg = [];
    }
  }
  if (seg.length) segments.push(seg);
  let d = "";
  for (const s of segments) {
    d += `M${xPixel(areaXAt(a, s[0]))},${yPixel(a.upper[s[0]])}`;
    for (let j = 1; j < s.length; j++)
      d += `L${xPixel(areaXAt(a, s[j]))},${yPixel(a.upper[s[j]])}`;
    for (let j = s.length - 1; j >= 0; j--)
      d += `L${xPixel(areaXAt(a, s[j]))},${yPixel(a.lower[s[j]])}`;
    d += "Z";
  }
  return d;
}

/**
 * Pixel x of a section boundary. Maps through the referenced series'
 * `x` array when available, then falls back to series 0, then to the
 * raw index (index-mode).
 */
function sectionXPixel(section: AreaSection, which: "start" | "end"): number {
  const idx = which === "start" ? section.startIndex : section.endIndex;
  const s =
    (section.seriesIndex != null && allSeries.value[section.seriesIndex]) ||
    allSeries.value[0];
  if (s) return xPixel(seriesXAt(s, idx));
  return xPixel(idx);
}

function toSectionPath(section: AreaSection, closed = true): string {
  const py = padding.value.top + innerH.value;

  // No seriesIndex: full-height rectangle spanning the range
  if (section.seriesIndex == null) {
    const sx = sectionXPixel(section, "start");
    const ex = sectionXPixel(section, "end");
    if (sx > ex) return "";
    return `M${sx},${padding.value.top}L${ex},${padding.value.top}L${ex},${py}L${sx},${py}Z`;
  }

  const s = allSeries.value[section.seriesIndex];
  if (!s) return "";

  const start = Math.max(0, section.startIndex);
  const end = Math.min(s.data.length - 1, section.endIndex);
  if (start > end) return "";

  let d = `M${xPixel(seriesXAt(s, start))},${yPixel(s.data[start])}`;
  for (let i = start + 1; i <= end; i++) {
    if (!isFinite(s.data[i])) continue;
    d += `L${xPixel(seriesXAt(s, i))},${yPixel(s.data[i])}`;
  }
  if (closed) {
    d += `L${xPixel(seriesXAt(s, end))},${py}`;
    d += `L${xPixel(seriesXAt(s, start))},${py}`;
    d += "Z";
  }
  return d;
}

const SECTION_LABEL_ROW_HEIGHT = 36;
const SECTION_LABEL_TOP_MARGIN = 12;
const SECTION_LABEL_CHAR_WIDTH = 7;
const SECTION_LABEL_H_GAP = 16;

interface PositionedSectionLabel {
  cx: number;
  labelText: string;
  descText: string;
  textWidth: number;
  row: number;
  color: string;
  fillOpacity: number;
  labelStyle: ReturnType<typeof resolveLabelStyle>;
  descStyle: ReturnType<typeof resolveLabelStyle>;
}

const sectionLabels = computed<{
  labels: PositionedSectionLabel[];
  extraHeight: number;
}>(() => {
  const sections = props.areaSections;
  if (!sections?.length) return { labels: [], extraHeight: 0 };

  const items: PositionedSectionLabel[] = [];
  const chartRight = padding.value.left + innerW.value;
  for (const sec of sections) {
    if (!sec.label && !sec.description) continue;
    if (sec.legend === "inline" || sec.legend === false) continue;
    const labelText = sec.label ?? "";
    const descText = sec.description ?? "";
    const maxChars = Math.max(labelText.length, descText.length);
    const textWidth = maxChars * SECTION_LABEL_CHAR_WIDTH;
    // Anchor the indicator circle to the start of the area. The circle is
    // drawn at (cx - textWidth/2 - 2), so solve for cx to place it at the
    // section's start pixel. Clamp so the label's right edge stays within
    // the chart if it would otherwise overflow.
    const startPx = sectionXPixel(sec, "start");
    const labelRightPad = 8;
    const preferred = startPx + textWidth / 2 + 2;
    const maxCx = chartRight - textWidth / 2 - labelRightPad;
    const cx = Math.min(preferred, maxCx);
    const color =
      sec.color ??
      (sec.seriesIndex != null
        ? (allSeries.value[sec.seriesIndex]?.color ?? "currentColor")
        : "#999");
    // Section labels default to the section's data-driven color/weight;
    // user-supplied styles override piece-by-piece.
    const labelStyle = resolveLabelStyle(
      { color, fontWeight: 600, ...sec.inlineLabelStyle },
      { fontSize: 11 },
    );
    const descStyle = resolveLabelStyle(sec.inlineDescriptionStyle, {
      fontSize: 11,
      fillOpacity: 0.6,
    });
    items.push({
      cx,
      labelText,
      descText,
      textWidth,
      row: 0,
      color,
      fillOpacity: sec.opacity ?? 0.15,
      labelStyle,
      descStyle,
    });
  }

  items.sort((a, b) => a.cx - b.cx);

  // Greedy collision detection
  const rowRightEdges: number[] = [];
  for (const item of items) {
    const left = item.cx - item.textWidth / 2;
    let row = 0;
    while (row < rowRightEdges.length) {
      if (left >= rowRightEdges[row] + SECTION_LABEL_H_GAP) break;
      row++;
    }
    item.row = row;
    const right = item.cx + item.textWidth / 2;
    rowRightEdges[row] = Math.max(rowRightEdges[row] ?? -Infinity, right);
  }

  if (items.length === 0) return { labels: [], extraHeight: 0 };
  const maxRow = Math.max(...items.map((it) => it.row));
  const extraHeight =
    (maxRow + 1) * SECTION_LABEL_ROW_HEIGHT + SECTION_LABEL_TOP_MARGIN;
  return { labels: items, extraHeight };
});

interface InlineLegendItem {
  label: string;
  color: string;
  type: "series" | "area" | "section";
  dashed?: boolean;
  fillOpacity?: number;
}

const inlineLegendItems = computed<InlineLegendItem[]>(() => {
  const items: InlineLegendItem[] = [];
  for (const s of allSeries.value) {
    if (!s.legend || s.showInLegend === false) continue;
    items.push({
      label: s.legend,
      color: s.color ?? "currentColor",
      type: "series",
      dashed: s.dashed,
    });
  }
  for (const a of allAreas.value) {
    if (!a.legend || a.showInLegend === false) continue;
    items.push({
      label: a.legend,
      color: a.color ?? "currentColor",
      type: "area",
      fillOpacity: a.opacity ?? 0.2,
    });
  }
  const sections = props.areaSections;
  if (sections) {
    for (const sec of sections) {
      if (sec.legend !== "inline") continue;
      if (!sec.label && !sec.description) continue;
      const label = [sec.label, sec.description].filter(Boolean).join(" ");
      const color =
        sec.color ??
        (sec.seriesIndex != null
          ? (allSeries.value[sec.seriesIndex]?.color ?? "currentColor")
          : "#999");
      items.push({
        label,
        color,
        type: "section",
        fillOpacity: sec.opacity ?? 0.15,
      });
    }
  }
  return items;
});

const inlineLegendLabels = computed(() =>
  inlineLegendItems.value.map((item) => item.label),
);

const totalHeight = computed(
  () => height.value + sectionLabels.value.extraHeight,
);

const sectionLabelBaseY = computed(
  () =>
    padding.value.top +
    innerH.value +
    padding.value.bottom +
    SECTION_LABEL_TOP_MARGIN,
);

const yTickItems = computed(() => {
  const { min, max } = extent.value;
  const fmt = (v: number) =>
    props.yTickFormat !== undefined
      ? formatNumber(v, props.yTickFormat)
      : formatTick(v);

  if (min === max) {
    return [{ value: fmt(min), y: snap(padding.value.top + innerH.value / 2) }];
  }

  const values =
    props.yScaleType === "log"
      ? computeLogTickValues({ min, max, ticks: props.yTicks })
      : computeTickValues({
          min,
          max,
          ticks: props.yTicks,
          targetTickCount: innerH.value / 50,
        });
  return values.map((v) => ({ value: fmt(v), y: snap(yPixel(v)) }));
});

/**
 * Format a single x-axis value into its display label. Used by both
 * tick rendering and the tooltip x-label so the two stay in sync. On
 * a date axis, `unit` (when supplied) drives the default formatter's
 * preset choice (year-tick → "year", month-tick → "month-year", etc.);
 * the tooltip path leaves it undefined and gets the ISO default.
 */
function formatXValue(v: number, i: number, unit?: DateTickUnit): string {
  const xf = props.xTickFormat;
  if (xIsDate.value) {
    if (typeof xf === "function") {
      return (xf as (v: number, i: number) => string)(v, i);
    }
    return formatDate(v, xf as DateFormat | undefined, tz.value, unit);
  }
  const display = v + xDisplayOffset.value;
  if (xf !== undefined) {
    return typeof xf === "function"
      ? (xf as (v: number, i: number) => string)(display, i)
      : formatNumber(display, xf as NumberFormat);
  }
  if (
    !hasExplicitX.value &&
    props.xLabels &&
    Number.isInteger(v) &&
    v >= 0 &&
    v < props.xLabels.length
  ) {
    return props.xLabels[v];
  }
  return formatTick(display);
}

const xTickItems = computed(() => {
  const { min: xMin, max: xMax } = xExtent.value;
  if (xMin === xMax) return [];
  const isDate = xIsDate.value;
  // `xMin` (display offset) is meaningless on a date axis — every x
  // value already lives in absolute ms.
  const offset = isDate ? 0 : xDisplayOffset.value;
  const len = maxLen.value;
  const targetTickCount = innerW.value / 80;

  let values: number[];
  let unit: DateTickUnit | undefined;
  if (isDate) {
    const picked = pickDateTicks(xMin, xMax, targetTickCount, tz.value);
    unit = picked.unit;
    // Run through computeTickValues so the clip-to-range semantics
    // match the numeric path. xMin is already 0, so `ticks` is used
    // directly.
    values = computeTickValues({ min: xMin, max: xMax, ticks: picked.values });
  } else if (
    props.xTicks == null &&
    !hasExplicitX.value &&
    props.xLabels &&
    props.xLabels.length === len
  ) {
    // xLabels fallback: pick evenly-spaced index ticks so every label
    // bucket gets at most one tick. Date mode supersedes xLabels — if
    // both are supplied, only the date axis is used.
    const targetTicks = Math.max(3, Math.floor(targetTickCount));
    const step = Math.max(1, Math.round((len - 1) / targetTicks));
    values = [];
    for (let i = 0; i < len; i += step) values.push(i);
  } else {
    values = computeTickValues({
      min: xMin,
      max: xMax,
      ticks: props.xTicks,
      targetTickCount,
      displayOffset: offset,
    });
  }

  const leftEdge = padding.value.left;
  const rightEdge = padding.value.left + innerW.value;
  const edgeSnapPx = 1;
  return values.map((v, i) => {
    const x = snap(xPixel(v));
    let anchor: "start" | "middle" | "end" = "middle";
    if (x - leftEdge <= edgeSnapPx) anchor = "start";
    else if (rightEdge - x <= edgeSnapPx) anchor = "end";
    return { value: formatXValue(v, i, unit), x, anchor };
  });
});

function toCsv(): string {
  if (typeof props.csv === "function") return props.csv();
  if (typeof props.csv === "string") return props.csv;
  return seriesToCsv(allSeries.value);
}

const hasTooltipSlot = computed(
  () => !!props.tooltipData || !!props.tooltipTrigger,
);

/** Data-space x of the hovered point (via the first series). */
const hoverDataX = computed(() => {
  const idx = hoverIndex.value;
  const s0 = allSeries.value[0];
  if (idx === null || !s0) return null;
  return seriesXAt(s0, idx);
});

const hoverX = computed(() =>
  hoverDataX.value === null ? 0 : xPixel(hoverDataX.value),
);

/** Index of the series point closest to the given data-space x. */
function nearestIndex(s: ResolvedSeries, targetX: number): number | null {
  const len = s.data.length;
  if (len === 0) return null;
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < len; i++) {
    const svx = seriesXAt(s, i);
    if (!isFinite(svx)) continue;
    const d = Math.abs(svx - targetX);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestDist === Infinity ? null : bestIdx;
}

const hoverDots = computed(() => {
  const targetX = hoverDataX.value;
  if (targetX === null) return [];
  const dots: { x: number; y: number; color: string }[] = [];
  for (const s of allSeries.value) {
    if (s.showInTooltip === false) continue;
    const nIdx = nearestIndex(s, targetX);
    if (nIdx === null) continue;
    const yv = s.data[nIdx];
    if (!isFinite(yv)) continue;
    dots.push({
      x: xPixel(seriesXAt(s, nIdx)),
      y: yPixel(yv),
      color: s.color ?? "currentColor",
    });
  }
  return dots;
});

const hoverSlotProps = computed(() => {
  const idx = hoverIndex.value;
  const targetX = hoverDataX.value;
  if (idx === null || targetX === null) return null;
  // Single source of truth for label dispatch — same as the x-axis ticks.
  const xLabel = formatXValue(targetX, idx);
  const series = allSeries.value;
  const values: ChartTooltipValue[] = [];
  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    if (s.showInTooltip === false) continue;
    const nIdx = nearestIndex(s, targetX);
    values.push({
      value: nIdx !== null ? Number(s.data[nIdx]) : NaN,
      color: s.color ?? "currentColor",
      seriesIndex: i,
    });
  }
  return {
    index: idx,
    xLabel,
    values,
    data: props.tooltipData?.[idx] ?? null,
  };
});

function projectAnnotation(
  x: number,
  y: number,
): { x: number; y: number } | null {
  if (!isFinite(x) || !isFinite(y)) return null;
  const internalX = x - xDisplayOffset.value;
  return { x: xPixel(internalX), y: yPixel(y) };
}

function indexFromPointer(clientX: number): number | null {
  const rect = containerRef.value?.getBoundingClientRect();
  if (!rect) return null;
  const s0 = allSeries.value[0];
  if (!s0 || s0.data.length === 0) return null;
  const { min: xMin, max: xMax } = xExtent.value;
  const range = xMax - xMin || 1;
  const mouseX = clientX - rect.left;
  const targetX = xMin + ((mouseX - padding.value.left) / innerW.value) * range;
  return nearestIndex(s0, targetX);
}

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
  chartPadding: () => props.chartPadding,
  inlineLegendLabels: () => inlineLegendLabels.value,
  hasTooltipSlot: () => hasTooltipSlot.value,
  getCsv: toCsv,
  pointerToIndex: indexFromPointer,
  onHover: (payload) => emit("hover", payload),
  extraBelowHeight: () => sectionLabels.value.extraHeight,
});

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

/** Resolved title style with defaults applied. */
const titleResolved = computed(() => {
  const s = props.titleStyle;
  const align = s?.align ?? "left";
  const b = bounds.value;
  const x =
    align === "left"
      ? b.left
      : align === "right"
        ? b.right
        : b.left + b.width / 2;
  const anchor =
    align === "left" ? "start" : align === "right" ? "end" : "middle";
  return {
    lines: (props.title ?? "").split("\n"),
    fontSize: s?.fontSize ?? TITLE_FONT_SIZE,
    lineHeight: s?.lineHeight ?? TITLE_LINE_HEIGHT,
    fontWeight: s?.fontWeight ?? TITLE_FONT_WEIGHT,
    color: s?.color ?? "currentColor",
    x,
    anchor,
  };
});

/**
 * Legend items joined with their wrapped pixel positions. `x` is the
 * left edge of the indicator; `y` is the center of the row.
 */
const positionedLegendItems = computed(() => {
  const positions = inlineLegendLayout.value.positions;
  const pad = padding.value.left;
  const baseY = legendY.value;
  return inlineLegendItems.value.map((item, i) => {
    const pos = positions[i];
    return {
      ...item,
      x: pad + pos.x,
      y: baseY + pos.row * INLINE_LEGEND_ROW_HEIGHT,
    };
  });
});
</script>

<template>
  <Teleport :to="teleportTarget" :disabled="!isFullscreen">
    <div
      ref="containerRef"
      v-bind="$attrs"
      class="line-chart-wrapper"
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
        :height="totalHeight"
        :role="chartRole || undefined"
        :aria-label="chartAriaLabel || undefined"
      >
        <!-- title -->
        <text
          v-if="title"
          :x="titleResolved.x"
          :y="titleResolved.lineHeight"
          :text-anchor="titleResolved.anchor"
          :font-size="titleResolved.fontSize"
          :font-weight="titleResolved.fontWeight"
          :fill="titleResolved.color"
        >
          <tspan
            v-for="(line, i) in titleResolved.lines"
            :key="i"
            :x="titleResolved.x"
            :dy="i === 0 ? 0 : titleResolved.lineHeight"
          >
            {{ line }}
          </tspan>
        </text>
        <!-- inline legend -->
        <g v-if="positionedLegendItems.length > 0">
          <template
            v-for="(item, i) in positionedLegendItems"
            :key="'ileg' + i"
          >
            <!-- series indicator: line -->
            <line
              v-if="item.type === 'series'"
              :x1="item.x"
              :y1="item.y"
              :x2="item.x + 12"
              :y2="item.y"
              :stroke="item.color"
              stroke-width="2"
              :stroke-dasharray="item.dashed ? '4 2' : undefined"
            />
            <!-- area indicator: filled swatch -->
            <rect
              v-else-if="item.type === 'area'"
              :x="item.x"
              :y="item.y - 4"
              width="12"
              height="8"
              :fill="item.color"
              :fill-opacity="item.fillOpacity"
              :stroke="item.color"
              stroke-width="1.5"
            />
            <!-- section indicator: filled circle -->
            <circle
              v-else
              :cx="item.x + 4"
              :cy="item.y"
              r="4"
              :fill="item.color"
              :fill-opacity="item.fillOpacity"
              :stroke="item.color"
              stroke-width="1.5"
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
        <!-- axes -->
        <line
          :x1="snap(padding.left)"
          :y1="snap(padding.top)"
          :x2="snap(padding.left)"
          :y2="snap(padding.top + innerH)"
          stroke="currentColor"
          stroke-opacity="0.3"
        />
        <line
          :x1="snap(padding.left)"
          :y1="snap(padding.top + innerH)"
          :x2="snap(padding.left + innerW)"
          :y2="snap(padding.top + innerH)"
          stroke="currentColor"
          stroke-opacity="0.3"
        />
        <!-- y grid lines -->
        <template v-if="yGrid">
          <line
            v-for="(tick, i) in yTickItems"
            :key="'yg' + i"
            :x1="padding.left"
            :y1="tick.y"
            :x2="padding.left + innerW"
            :y2="tick.y"
            stroke="currentColor"
            stroke-opacity="0.1"
          />
        </template>
        <!-- x grid lines -->
        <template v-if="xGrid">
          <line
            v-for="(tick, i) in xTickItems"
            :key="'xg' + i"
            :x1="tick.x"
            :y1="padding.top"
            :x2="tick.x"
            :y2="padding.top + innerH"
            stroke="currentColor"
            stroke-opacity="0.1"
          />
        </template>
        <!-- y tick labels -->
        <text
          v-for="(tick, i) in yTickItems"
          :key="'y' + i"
          data-testid="y-tick"
          :x="padding.left - 6"
          :y="tick.y"
          text-anchor="end"
          dominant-baseline="middle"
          :font-size="tickLabelResolved.fontSize"
          :fill="tickLabelResolved.fill"
          :font-weight="tickLabelResolved.fontWeight"
          :fill-opacity="tickLabelResolved.fillOpacity"
        >
          {{ tick.value }}
        </text>
        <!-- y axis label -->
        <text
          v-if="yLabel"
          :x="0"
          :y="0"
          :transform="`translate(14, ${padding.top + innerH / 2}) rotate(-90)`"
          text-anchor="middle"
          :font-size="axisLabelResolved.fontSize"
          :fill="axisLabelResolved.fill"
          :font-weight="axisLabelResolved.fontWeight"
        >
          {{ yLabel }}
        </text>
        <!-- x tick labels -->
        <text
          v-for="(tick, i) in xTickItems"
          :key="'x' + i"
          data-testid="x-tick"
          :x="tick.x"
          :y="padding.top + innerH + 16"
          :text-anchor="tick.anchor"
          :font-size="tickLabelResolved.fontSize"
          :fill="tickLabelResolved.fill"
          :font-weight="tickLabelResolved.fontWeight"
          :fill-opacity="tickLabelResolved.fillOpacity"
        >
          {{ tick.value }}
        </text>
        <!-- x axis label -->
        <text
          v-if="xLabel"
          :x="padding.left + innerW / 2"
          :y="height - 4"
          text-anchor="middle"
          :font-size="axisLabelResolved.fontSize"
          :fill="axisLabelResolved.fill"
          :font-weight="axisLabelResolved.fontWeight"
        >
          {{ xLabel }}
        </text>
        <!-- areas -->
        <path
          v-for="(a, i) in allAreas"
          :key="'area' + i"
          :d="toAreaPath(a)"
          :fill="a.color ?? 'currentColor'"
          :fill-opacity="a.opacity ?? 0.2"
          stroke="none"
          :style="a.blendMode ? { mixBlendMode: a.blendMode } : undefined"
        />
        <!-- data lines and dots -->
        <template v-for="(s, i) in allSeries" :key="i">
          <path
            v-if="s.line !== false && s.outline"
            :d="toPath(s)"
            fill="none"
            :stroke="s.outlineColor ?? 'var(--color-bg-0, #fff)'"
            :stroke-width="(s.strokeWidth ?? 1.5) + (s.outlineWidth ?? 4)"
            stroke-linecap="round"
            stroke-linejoin="round"
            data-testid="line-outline"
          />
          <path
            v-if="s.line !== false"
            :d="toPath(s)"
            fill="none"
            :stroke="s.color ?? 'currentColor'"
            :stroke-width="s.strokeWidth ?? 1.5"
            :stroke-opacity="s.lineOpacity ?? s.opacity ?? lineOpacity"
            :stroke-dasharray="s.dashed ? '6 3' : undefined"
            :style="s.blendMode ? { mixBlendMode: s.blendMode } : undefined"
          />
          <template v-if="s.dots">
            <circle
              v-for="(pt, j) in toPoints(s)"
              :key="j"
              :cx="pt.x"
              :cy="pt.y"
              :r="s.dotRadius ?? (s.strokeWidth ?? 1.5) + 1"
              :fill="s.dotFill ?? s.color ?? 'currentColor'"
              :fill-opacity="s.dotOpacity ?? s.opacity ?? lineOpacity"
              :stroke="s.dotStroke ?? 'none'"
              :style="s.blendMode ? { mixBlendMode: s.blendMode } : undefined"
            />
          </template>
        </template>
        <!-- area sections (rendered above series) -->
        <template v-for="(sec, i) in areaSections ?? []" :key="'areasec' + i">
          <path
            :d="toSectionPath(sec)"
            :fill="
              sec.color ??
              (sec.seriesIndex != null
                ? (allSeries[sec.seriesIndex]?.color ?? 'currentColor')
                : '#999')
            "
            :fill-opacity="sec.opacity ?? 0.15"
            stroke="none"
          />
          <path
            v-if="sec.seriesIndex != null"
            :d="toSectionPath(sec, false)"
            fill="none"
            :stroke="
              sec.color ?? allSeries[sec.seriesIndex]?.color ?? 'currentColor'
            "
            :stroke-width="sec.strokeWidth ?? 2"
            :stroke-dasharray="sec.dashed ? '6 3' : undefined"
          />
          <!-- vertical edge lines for full-height sections -->
          <template v-if="sec.seriesIndex == null">
            <line
              :x1="snap(sectionXPixel(sec, 'start'))"
              :y1="padding.top"
              :x2="snap(sectionXPixel(sec, 'start'))"
              :y2="padding.top + innerH"
              :stroke="sec.color ?? '#999'"
              :stroke-width="sec.strokeWidth ?? 2"
              :stroke-dasharray="sec.dashed ? '6 3' : undefined"
            />
            <line
              :x1="snap(sectionXPixel(sec, 'end'))"
              :y1="padding.top"
              :x2="snap(sectionXPixel(sec, 'end'))"
              :y2="padding.top + innerH"
              :stroke="sec.color ?? '#999'"
              :stroke-width="sec.strokeWidth ?? 2"
              :stroke-dasharray="sec.dashed ? '6 3' : undefined"
            />
          </template>
          <!-- tick marks at section boundaries -->
          <line
            :x1="snap(sectionXPixel(sec, 'start'))"
            :y1="padding.top + innerH - 4"
            :x2="snap(sectionXPixel(sec, 'start'))"
            :y2="padding.top + innerH + 4"
            stroke="currentColor"
            stroke-opacity="0.4"
          />
          <line
            :x1="snap(sectionXPixel(sec, 'end'))"
            :y1="padding.top + innerH - 4"
            :x2="snap(sectionXPixel(sec, 'end'))"
            :y2="padding.top + innerH + 4"
            stroke="currentColor"
            stroke-opacity="0.4"
          />
        </template>
        <!-- Tooltip: crosshair line -->
        <line
          v-if="hasTooltipSlot && hoverIndex !== null"
          :x1="snap(hoverX)"
          :y1="padding.top"
          :x2="snap(hoverX)"
          :y2="padding.top + innerH"
          stroke="currentColor"
          stroke-opacity="0.3"
          stroke-dasharray="4 2"
          pointer-events="none"
        />
        <!-- Tooltip: hover dots -->
        <circle
          v-for="(dot, i) in hoverDots"
          :key="'hd' + i"
          :cx="dot.x"
          :cy="dot.y"
          r="4"
          :fill="dot.color"
          stroke="var(--color-bg-0, #fff)"
          stroke-width="2"
          pointer-events="none"
        />
        <!-- Tooltip: interaction overlay -->
        <rect
          v-if="hasTooltipSlot"
          :x="padding.left"
          :y="padding.top"
          :width="innerW"
          :height="innerH"
          fill="transparent"
          style="cursor: crosshair; touch-action: pan-y"
          v-on="tooltipHandlers"
        />
        <!-- annotations (top layer) -->
        <ChartAnnotations
          v-if="annotations && annotations.length > 0"
          :annotations="annotations"
          :project="projectAnnotation"
          :bounds="bounds"
        />
        <!-- area section labels -->
        <g v-for="(item, i) in sectionLabels.labels" :key="'seclab' + i">
          <circle
            :cx="item.cx - item.textWidth / 2 - 2"
            :cy="sectionLabelBaseY + item.row * SECTION_LABEL_ROW_HEIGHT + 4"
            r="4"
            :fill="item.color"
            :fill-opacity="item.fillOpacity"
            :stroke="item.color"
            stroke-width="1.5"
          />
          <text
            v-if="item.labelText"
            :x="item.cx - item.textWidth / 2 + 8"
            :y="sectionLabelBaseY + item.row * SECTION_LABEL_ROW_HEIGHT + 8"
            :font-size="item.labelStyle.fontSize"
            :font-weight="item.labelStyle.fontWeight"
            :fill="item.labelStyle.fill"
          >
            {{ item.labelText }}
          </text>
          <text
            v-if="item.descText"
            :x="item.cx - item.textWidth / 2 + 8"
            :y="sectionLabelBaseY + item.row * SECTION_LABEL_ROW_HEIGHT + 22"
            :font-size="item.descStyle.fontSize"
            :font-weight="item.descStyle.fontWeight"
            :fill="item.descStyle.fill"
            :fill-opacity="item.descStyle.fillOpacity"
          >
            {{ item.descText }}
          </text>
        </g>
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
          <div class="line-chart-tooltip">
            <div v-if="hoverSlotProps.xLabel" class="line-chart-tooltip-label">
              {{ hoverSlotProps.xLabel }}
            </div>
            <div
              v-for="v in hoverSlotProps.values"
              :key="v.seriesIndex"
              class="line-chart-tooltip-row"
            >
              <span
                class="line-chart-tooltip-swatch"
                :style="{ background: v.color }"
              />
              {{ isFinite(v.value) ? formatTooltipValue(v.value) : "—" }}
            </div>
          </div>
        </slot>
      </div>
      <a
        v-if="downloadLinkText"
        class="line-chart-download-link"
        :href="csvHref!"
        :download="`${menuFilename()}.csv`"
      >
        {{ downloadLinkText }}
      </a>
      <button
        v-if="downloadButtonText"
        type="button"
        class="line-chart-download-button"
        @click="triggerCsvDownload"
      >
        {{ downloadButtonText }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.line-chart-wrapper {
  position: relative;
  width: 100%;
}

.line-chart-tooltip-label {
  font-weight: 600;
  margin-bottom: 0.25em;
}

.line-chart-tooltip-row {
  display: flex;
  align-items: center;
  gap: 0.375em;
}

.line-chart-download-link {
  display: block;
  text-align: right;
  font-size: var(--font-size-sm);
  margin-top: 0.25em;
}

.line-chart-tooltip-swatch {
  display: inline-block;
  width: 0.625em;
  height: 0.625em;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>

<style>
.line-chart-download-button {
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

.line-chart-download-button:hover {
  background: var(--color-bg-1, rgba(0, 0, 0, 0.05));
}

.line-chart-download-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>
