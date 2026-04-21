<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from "vue";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import type { ChartMenuItem } from "../ChartMenu/ChartMenu.vue";
import { saveSvg, savePng, downloadCsv } from "../ChartMenu/download.js";
import { placeTooltip } from "../tooltip-position.js";

/**
 * Numeric input accepted by the chart. `number[]` and any standard numeric
 * typed array are supported, so the output of
 * `ModelOutput.column('x')` (e.g. a `Float64Array`) can be passed directly
 * without copying into a plain array.
 */
export type LineChartData =
  | readonly number[]
  | Float64Array
  | Float32Array
  | Int32Array
  | Uint32Array
  | Int16Array
  | Uint16Array
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray;

export interface Series {
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
   * When omitted, points are plotted at indices 0, 1, 2, ...
   */
  x?: LineChartData;
  color?: string;
  dashed?: boolean;
  strokeWidth?: number;
  opacity?: number;
  lineOpacity?: number;
  dotOpacity?: number;
  line?: boolean;
  dots?: boolean;
  dotRadius?: number;
  dotFill?: string;
  dotStroke?: string;
  /** Label shown in the inline legend */
  legend?: string;
}

export interface Area {
  upper: LineChartData;
  lower: LineChartData;
  /** Optional x-values parallel to `upper`/`lower`. See `Series.x`. */
  x?: LineChartData;
  color?: string;
  opacity?: number;
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
}

const props = withDefaults(
  defineProps<{
    /** Y-values. Equivalent to `data`. If both are set, `y` wins. */
    y?: LineChartData;
    /** Y-values (alternative name for `y`). */
    data?: LineChartData;
    /**
     * Optional x-values paired with `y`/`data`. When provided, points
     * are plotted at the given x positions instead of at their indices.
     * Ignored when `series` is used — set `x` on each `Series` instead.
     */
    x?: LineChartData;
    series?: Series[];
    areas?: Area[];
    areaSections?: AreaSection[];
    width?: number;
    height?: number;
    lineOpacity?: number;
    title?: string;
    xLabel?: string;
    yLabel?: string;
    yMin?: number;
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
    /** Formatter for x-axis tick labels. Receives the raw numeric value. */
    xTickFormat?: (value: number, index: number) => string;
    /** Formatter for y-axis tick labels. Receives the raw numeric value. */
    yTickFormat?: (value: number) => string;
    /**
     * @deprecated Use `xTickFormat` (e.g. `(_, i) => labels[i]`) together
     * with `xTicks` for explicit control. Still honored for tooltip x-labels
     * and as a default x-tick formatter when `xTickFormat` is not provided.
     */
    xLabels?: string[];
    debounce?: number;
    menu?: boolean | string;
    xGrid?: boolean;
    yGrid?: boolean;
    /** Custom per-index data passed to the tooltip slot */
    tooltipData?: unknown[];
    /** Tooltip activation mode. Default: 'hover' */
    tooltipTrigger?: "hover" | "click";
    /**
     * Boundary for tooltip flip/clamp. `"none"` always places to the right of
     * the pointer with no clamping. `"chart"` (default) uses the chart
     * container's bounding box. `"window"` uses the viewport.
     */
    tooltipClamp?: "none" | "chart" | "window";
    /**
     * Custom CSV content for the Download CSV menu item. Can be a raw CSV
     * string or a function returning one. When omitted, CSV is generated
     * from the chart series.
     */
    csv?: string | (() => string);
    /** Filename (without extension) for downloaded SVG, PNG and CSV files. */
    filename?: string;
    /**
     * Show a plain text link below the chart to download the CSV data.
     * Pass `true` for the default label ("Download data (CSV)") or a string
     * to customize the link text.
     */
    downloadLink?: boolean | string;
  }>(),
  { lineOpacity: 1, menu: true, tooltipClamp: "chart" },
);

const emit = defineEmits<{
  (e: "hover", payload: { index: number } | null): void;
}>();

defineSlots<{
  tooltip?(props: {
    index: number;
    xLabel?: string;
    values: { value: number; color: string; seriesIndex: number }[];
    data: unknown;
  }): unknown;
}>();

const containerRef = ref<HTMLElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const measuredWidth = ref(0);
let observer: ResizeObserver | null = null;
let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

onMounted(() => {
  if (containerRef.value) {
    measuredWidth.value = containerRef.value.clientWidth;
    observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      if (props.debounce) {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          measuredWidth.value = entry.contentRect.width;
        }, props.debounce);
      } else {
        measuredWidth.value = entry.contentRect.width;
      }
    });
    observer.observe(containerRef.value);
  }
});

onUnmounted(() => {
  observer?.disconnect();
  if (resizeTimeout) clearTimeout(resizeTimeout);
});

const width = computed(() => props.width ?? (measuredWidth.value || 400));
const height = computed(() => props.height ?? 200);

const INLINE_LEGEND_HEIGHT = 20;

const hasInlineLegend = computed(
  () =>
    allSeries.value.some((s) => s.legend) ||
    props.areaSections?.some(
      (s) => s.legend === "inline" && (s.label || s.description),
    ),
);

const padding = computed(() => ({
  top:
    (props.title ? 30 : 10) +
    (hasInlineLegend.value ? INLINE_LEGEND_HEIGHT : 0),
  right: 10,
  bottom: props.xLabel ? 46 : 30,
  left: props.yLabel ? 66 : 50,
}));

const innerW = computed(
  () => width.value - padding.value.left - padding.value.right,
);
const innerH = computed(
  () => height.value - padding.value.top - padding.value.bottom,
);

/**
 * Internal series shape where `data` (y-values) is always resolved.
 * `Series.y` takes precedence over `Series.data` when both are set.
 */
type ResolvedSeries = Omit<Series, "data" | "y"> & { data: LineChartData };

const EMPTY_DATA: readonly number[] = [];

function resolveSeries(s: Series): ResolvedSeries {
  return { ...s, data: s.y ?? s.data ?? EMPTY_DATA };
}

const allSeries = computed<ResolvedSeries[]>(() => {
  if (props.series && props.series.length > 0)
    return props.series.map(resolveSeries);
  const topY = props.y ?? props.data;
  if (topY) return [{ data: topY, x: props.x }];
  return [];
});

const allAreas = computed<Area[]>(() => props.areas ?? []);

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
function areaXAt(a: Area, i: number): number {
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
  for (const s of allSeries.value) {
    for (const v of s.data) {
      if (!isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  for (const a of allAreas.value) {
    for (const v of a.upper) {
      if (!isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    for (const v of a.lower) {
      if (!isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!isFinite(min)) return { min: 0, max: 0, range: 1 };
  if (props.yMin != null && props.yMin < min) min = props.yMin;
  return { min, max, range: max - min || 1 };
});

function toPath(s: ResolvedSeries): string {
  const data = s.data;
  if (data.length === 0) return "";
  const { min, range } = extent.value;
  const yScale = innerH.value / range;
  const py = padding.value.top + innerH.value;
  let d = "";
  let inSegment = false;
  for (let i = 0; i < data.length; i++) {
    const xv = seriesXAt(s, i);
    if (!isFinite(data[i]) || !isFinite(xv)) {
      inSegment = false;
      continue;
    }
    const x = xPixel(xv);
    const y = py - (data[i] - min) * yScale;
    d += inSegment ? `L${x},${y}` : `M${x},${y}`;
    inSegment = true;
  }
  return d;
}

function toPoints(s: ResolvedSeries): { x: number; y: number }[] {
  const data = s.data;
  const { min, range } = extent.value;
  const yScale = innerH.value / range;
  const py = padding.value.top + innerH.value;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < data.length; i++) {
    const xv = seriesXAt(s, i);
    if (!isFinite(data[i]) || !isFinite(xv)) continue;
    pts.push({ x: xPixel(xv), y: py - (data[i] - min) * yScale });
  }
  return pts;
}

function toAreaPath(a: Area): string {
  const len = Math.min(a.upper.length, a.lower.length);
  if (len === 0) return "";
  const { min, range } = extent.value;
  const yScale = innerH.value / range;
  const py = padding.value.top + innerH.value;
  const y = (v: number) => py - (v - min) * yScale;
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
    d += `M${xPixel(areaXAt(a, s[0]))},${y(a.upper[s[0]])}`;
    for (let j = 1; j < s.length; j++)
      d += `L${xPixel(areaXAt(a, s[j]))},${y(a.upper[s[j]])}`;
    for (let j = s.length - 1; j >= 0; j--)
      d += `L${xPixel(areaXAt(a, s[j]))},${y(a.lower[s[j]])}`;
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
  const { min, range } = extent.value;
  const yScale = innerH.value / range;
  const y = (v: number) => py - (v - min) * yScale;

  const start = Math.max(0, section.startIndex);
  const end = Math.min(s.data.length - 1, section.endIndex);
  if (start > end) return "";

  let d = `M${xPixel(seriesXAt(s, start))},${y(s.data[start])}`;
  for (let i = start + 1; i <= end; i++) {
    if (!isFinite(s.data[i])) continue;
    d += `L${xPixel(seriesXAt(s, i))},${y(s.data[i])}`;
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
    items.push({
      cx,
      labelText,
      descText,
      textWidth,
      row: 0,
      color,
      fillOpacity: sec.opacity ?? 0.15,
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
  type: "series" | "section";
  dashed?: boolean;
  fillOpacity?: number;
}

const inlineLegendItems = computed<InlineLegendItem[]>(() => {
  const items: InlineLegendItem[] = [];
  for (const s of allSeries.value) {
    if (!s.legend) continue;
    items.push({
      label: s.legend,
      color: s.color ?? "currentColor",
      type: "series",
      dashed: s.dashed,
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

function niceStep(range: number, targetTicks: number): number {
  const rough = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  let step: number;
  if (norm <= 1.5) step = 1;
  else if (norm <= 3) step = 2;
  else if (norm <= 7) step = 5;
  else step = 10;
  return step * mag;
}

/** Round to nearest half-pixel so 1px SVG strokes stay sharp. */
function snap(v: number): number {
  return Math.round(v) + 0.5;
}

const numFmt = new Intl.NumberFormat();
function formatTick(v: number): string {
  if (Math.abs(v) >= 1000) return numFmt.format(v);
  if (Number.isInteger(v)) return v.toString();
  return v.toFixed(1);
}

/** Generate interval-spaced values in [min, max], inclusive. */
function intervalValues(min: number, max: number, step: number): number[] {
  if (!(step > 0) || !isFinite(step)) return [];
  const out: number[] = [];
  const start = Math.ceil(min / step) * step;
  // Cap iteration to avoid runaway loops from pathological inputs.
  const maxIterations = 1000;
  for (
    let i = 0, v = start;
    v <= max + 1e-9 && i < maxIterations;
    i++, v = start + i * step
  ) {
    out.push(v);
  }
  return out;
}

const yTickItems = computed(() => {
  const { min, max } = extent.value;
  const toY = (v: number) =>
    snap(
      padding.value.top +
        innerH.value -
        ((v - min) / extent.value.range) * innerH.value,
    );
  const fmt = (v: number) =>
    props.yTickFormat ? props.yTickFormat(v) : formatTick(v);

  if (min === max) {
    return [{ value: fmt(min), y: snap(padding.value.top + innerH.value / 2) }];
  }

  let values: number[];
  if (Array.isArray(props.yTicks)) {
    values = props.yTicks.filter((v) => v >= min && v <= max);
  } else if (typeof props.yTicks === "number") {
    values = intervalValues(min, max, props.yTicks);
  } else {
    const targetTicks = Math.max(3, Math.floor(innerH.value / 50));
    values = intervalValues(min, max, niceStep(max - min, targetTicks));
  }
  return values.map((v) => ({ value: fmt(v), y: toY(v) }));
});

const xTickItems = computed(() => {
  const { min: xMin, max: xMax } = xExtent.value;
  if (xMin === xMax) return [];
  const offset = xDisplayOffset.value;
  const len = maxLen.value;

  // Tick values are in data-space; display labels add `xDisplayOffset`.
  const fmt = (v: number, i: number) => {
    const display = v + offset;
    if (props.xTickFormat) return props.xTickFormat(display, i);
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
  };

  let values: number[];
  if (Array.isArray(props.xTicks)) {
    // User supplies display-space values; shift to data-space.
    values = props.xTicks
      .map((v) => v - offset)
      .filter((v) => v >= xMin && v <= xMax);
  } else if (typeof props.xTicks === "number") {
    // Align to multiples of the step in display space (preserves
    // e.g. `xMin: 3, xTicks: 5` → display ticks 5, 10, 15 behavior).
    values = intervalValues(xMin + offset, xMax + offset, props.xTicks).map(
      (v) => v - offset,
    );
  } else if (
    !hasExplicitX.value &&
    props.xLabels &&
    props.xLabels.length === len
  ) {
    const targetTicks = Math.max(3, Math.floor(innerW.value / 80));
    const step = Math.max(1, Math.round((len - 1) / targetTicks));
    values = [];
    for (let i = 0; i < len; i += step) values.push(i);
  } else {
    const targetTicks = Math.max(3, Math.floor(innerW.value / 80));
    const step = niceStep(xMax - xMin, targetTicks);
    values = intervalValues(xMin + offset, xMax + offset, step).map(
      (v) => v - offset,
    );
  }

  const leftEdge = padding.value.left;
  const rightEdge = padding.value.left + innerW.value;
  const edgeSnapPx = 1;
  return values.map((v, i) => {
    const x = snap(xPixel(v));
    let anchor: "start" | "middle" | "end" = "middle";
    if (x - leftEdge <= edgeSnapPx) anchor = "start";
    else if (rightEdge - x <= edgeSnapPx) anchor = "end";
    return { value: fmt(v, i), x, anchor };
  });
});

function menuFilename() {
  if (props.filename) return props.filename;
  return typeof props.menu === "string" ? props.menu : "chart";
}

function getSvgEl(): SVGSVGElement | null {
  return svgRef.value;
}

function toCsv(): string {
  if (typeof props.csv === "function") return props.csv();
  if (typeof props.csv === "string") return props.csv;
  const series = allSeries.value;
  if (series.length === 0) return "";
  const len = maxLen.value;
  // Use an `x` column when every series shares the same x source;
  // otherwise fall back to `index`.
  const sharedX = series.every((s) => s.x === series[0].x)
    ? series[0].x
    : undefined;
  const xHeader = sharedX ? "x" : "index";
  const headers =
    series.length === 1
      ? [xHeader, "value"]
      : [xHeader, ...series.map((_, i) => `series_${i}`)];
  const rows = [headers.join(",")];
  for (let r = 0; r < len; r++) {
    const xCell = sharedX ? String(sharedX[r]) : r.toString();
    const cells = [xCell];
    for (const s of series) {
      cells.push(r < s.data.length ? String(s.data[r]) : "");
    }
    rows.push(cells.join(","));
  }
  return rows.join("\n");
}

// Tooltip hover state
const TOUCH_Y_OFFSET = 50;
const hoverIndex = ref<number | null>(null);
const isTouching = ref(false);
const tooltipRef = ref<HTMLElement | null>(null);
const pointer = ref<{ clientX: number; clientY: number } | null>(null);
const tooltipPos = ref<{ left: number; top: number } | null>(null);
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
  const { min, range } = extent.value;
  const yScale = innerH.value / range;
  const py = padding.value.top + innerH.value;
  const dots: { x: number; y: number; color: string }[] = [];
  for (const s of allSeries.value) {
    const nIdx = nearestIndex(s, targetX);
    if (nIdx === null) continue;
    const yv = s.data[nIdx];
    if (!isFinite(yv)) continue;
    dots.push({
      x: xPixel(seriesXAt(s, nIdx)),
      y: py - (yv - min) * yScale,
      color: s.color ?? "currentColor",
    });
  }
  return dots;
});

const hoverSlotProps = computed(() => {
  const idx = hoverIndex.value;
  const targetX = hoverDataX.value;
  if (idx === null || targetX === null) return null;
  const offset = xDisplayOffset.value;
  const displayX = targetX + offset;
  let xLabel: string | undefined;
  if (props.xTickFormat) {
    xLabel = props.xTickFormat(displayX, idx);
  } else if (!hasExplicitX.value) {
    xLabel = props.xLabels?.[idx];
  } else {
    xLabel = formatTick(displayX);
  }
  return {
    index: idx,
    xLabel,
    values: allSeries.value.map((s, i) => {
      const nIdx = nearestIndex(s, targetX);
      return {
        value: nIdx !== null ? Number(s.data[nIdx]) : NaN,
        color: s.color ?? "currentColor",
        seriesIndex: i,
      };
    }),
    data: props.tooltipData?.[idx] ?? null,
  };
});

function pointerFromEvent(
  event: MouseEvent | TouchEvent,
): { clientX: number; clientY: number } | null {
  if ("touches" in event) {
    return event.touches[0] ?? null;
  }
  return event;
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

function updateHover(event: MouseEvent | TouchEvent) {
  const pt = pointerFromEvent(event);
  if (!pt) return;
  const idx = indexFromPointer(pt.clientX);
  if (idx === null) return;
  hoverIndex.value = idx;
  pointer.value = { clientX: pt.clientX, clientY: pt.clientY };
  emit("hover", { index: idx });
}

watch(
  [pointer, hoverIndex],
  () => {
    if (hoverIndex.value === null || !pointer.value) {
      tooltipPos.value = null;
      return;
    }
    const el = tooltipRef.value;
    const container = containerRef.value;
    if (!el || !container) return;
    const rect = container.getBoundingClientRect();
    const offset = isTouching.value ? TOUCH_Y_OFFSET : 0;
    const { left, top } = placeTooltip(
      pointer.value.clientX,
      pointer.value.clientY - offset,
      el.offsetWidth,
      el.offsetHeight,
      props.tooltipClamp,
      rect,
    );
    tooltipPos.value = { left: left - rect.left, top: top - rect.top };
  },
  { flush: "post" },
);

function onChartMouseMove(event: MouseEvent) {
  updateHover(event);
}

function onChartMouseLeave() {
  if (props.tooltipTrigger !== "click") {
    hoverIndex.value = null;
    emit("hover", null);
  }
}

function onChartClick(event: MouseEvent) {
  if (props.tooltipTrigger !== "click") return;
  const pt = pointerFromEvent(event);
  if (!pt) return;
  const idx = indexFromPointer(pt.clientX);
  if (idx === null) return;
  hoverIndex.value = hoverIndex.value === idx ? null : idx;
  emit("hover", hoverIndex.value !== null ? { index: idx } : null);
}

function onTouchStart(event: TouchEvent) {
  isTouching.value = true;
  updateHover(event);
}

function onTouchMove(event: TouchEvent) {
  updateHover(event);
}

function onTouchEnd() {
  isTouching.value = false;
  hoverIndex.value = null;
  emit("hover", null);
}

const downloadLinkText = computed(() => {
  if (!props.downloadLink) return null;
  return typeof props.downloadLink === "string"
    ? props.downloadLink
    : "Download data (CSV)";
});

const csvHref = computed(() => {
  if (!props.downloadLink) return null;
  return `data:text/csv;charset=utf-8,${encodeURIComponent(toCsv())}`;
});

const menuItems = computed<ChartMenuItem[]>(() => {
  const fname = menuFilename();
  const items: ChartMenuItem[] = [
    {
      label: "Save as SVG",
      action: () => {
        const el = getSvgEl();
        if (el) saveSvg(el, fname);
      },
    },
    {
      label: "Save as PNG",
      action: () => {
        const el = getSvgEl();
        if (el) savePng(el, fname);
      },
    },
  ];
  if (!props.downloadLink) {
    items.push({
      label: "Download CSV",
      action: () => downloadCsv(toCsv(), fname),
    });
  }
  return items;
});
</script>

<template>
  <div ref="containerRef" class="line-chart-wrapper">
    <ChartMenu v-if="menu" :items="menuItems" />
    <svg ref="svgRef" :width="width" :height="totalHeight">
      <!-- title -->
      <text
        v-if="title"
        :x="width / 2"
        :y="18"
        text-anchor="middle"
        font-size="14"
        font-weight="600"
        fill="currentColor"
      >
        {{ title }}
      </text>
      <!-- inline legend -->
      <g v-if="inlineLegendItems.length > 0">
        <template v-for="(item, i) in inlineLegendItems" :key="'ileg' + i">
          <!-- series indicator: line -->
          <line
            v-if="item.type === 'series'"
            :x1="padding.left + i * 120"
            :y1="padding.top - INLINE_LEGEND_HEIGHT / 2"
            :x2="padding.left + i * 120 + 12"
            :y2="padding.top - INLINE_LEGEND_HEIGHT / 2"
            :stroke="item.color"
            stroke-width="2"
            :stroke-dasharray="item.dashed ? '4 2' : undefined"
          />
          <!-- section indicator: filled circle -->
          <circle
            v-else
            :cx="padding.left + i * 120 + 4"
            :cy="padding.top - INLINE_LEGEND_HEIGHT / 2"
            r="4"
            :fill="item.color"
            :fill-opacity="item.fillOpacity"
            :stroke="item.color"
            stroke-width="1.5"
          />
          <text
            :x="padding.left + i * 120 + 18"
            :y="padding.top - INLINE_LEGEND_HEIGHT / 2 + 4"
            font-size="11"
            fill="currentColor"
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
        font-size="10"
        fill="currentColor"
        fill-opacity="0.6"
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
        font-size="13"
        fill="currentColor"
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
        font-size="10"
        fill="currentColor"
        fill-opacity="0.6"
      >
        {{ tick.value }}
      </text>
      <!-- x axis label -->
      <text
        v-if="xLabel"
        :x="padding.left + innerW / 2"
        :y="height - 4"
        text-anchor="middle"
        font-size="13"
        fill="currentColor"
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
      />
      <!-- data lines and dots -->
      <template v-for="(s, i) in allSeries" :key="i">
        <path
          v-if="s.line !== false"
          :d="toPath(s)"
          fill="none"
          :stroke="s.color ?? 'currentColor'"
          :stroke-width="s.strokeWidth ?? 1.5"
          :stroke-opacity="s.lineOpacity ?? s.opacity ?? lineOpacity"
          :stroke-dasharray="s.dashed ? '6 3' : undefined"
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
        style="cursor: crosshair; touch-action: none"
        @mousemove="onChartMouseMove"
        @mouseleave="onChartMouseLeave"
        @click="onChartClick"
        @touchstart.prevent="onTouchStart"
        @touchmove.prevent="onTouchMove"
        @touchend="onTouchEnd"
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
          font-size="11"
          font-weight="600"
          :fill="item.color"
        >
          {{ item.labelText }}
        </text>
        <text
          v-if="item.descText"
          :x="item.cx - item.textWidth / 2 + 8"
          :y="sectionLabelBaseY + item.row * SECTION_LABEL_ROW_HEIGHT + 22"
          font-size="11"
          fill="currentColor"
          fill-opacity="0.6"
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
            {{ isFinite(v.value) ? formatTick(v.value) : "—" }}
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
  </div>
</template>

<style scoped>
.line-chart-wrapper {
  position: relative;
  width: 100%;
}

.line-chart-wrapper:hover :deep(.chart-menu-button) {
  opacity: 1;
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
