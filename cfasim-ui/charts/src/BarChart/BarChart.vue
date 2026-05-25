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
  type DateFormat,
  type ChartCommonProps,
  type ChartHoverPayload,
  type ChartTooltipBaseProps,
  type ChartTooltipValue,
} from "../_shared/index.js";

export type BarChartData = ChartData;

export interface BarSeries {
  /** Bar values; one entry per category. `y` is accepted as an alias. */
  y?: BarChartData;
  data?: BarChartData;
  color?: string;
  opacity?: number;
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

interface BarChartProps extends ChartCommonProps {
  /** Single-series values. Equivalent to `y`. */
  data?: BarChartData;
  /** Single-series values (alias for `data`). */
  y?: BarChartData;
  /** Multi-series mode. Each series has its own values. */
  series?: BarSeries[];
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
  /** "grouped" (default) places series side-by-side; "stacked" stacks them. */
  layout?: "grouped" | "stacked";
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
}

const props = withDefaults(defineProps<BarChartProps>(), {
  orientation: "vertical",
  layout: "grouped",
  valueMin: 0,
  barPadding: 0.2,
  groupGap: 1,
  menu: true,
  tooltipClamp: "chart",
  valueGrid: true,
  valueScaleType: "linear",
});

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
  legend?: string;
  showInLegend?: boolean;
  showInTooltip?: boolean;
};

function resolveSeries(s: BarSeries): ResolvedSeries {
  return {
    data: s.y ?? s.data ?? EMPTY_DATA,
    color: s.color,
    opacity: s.opacity,
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
            raw,
            i,
            s,
          ),
        );
        if (raw >= 0) posCursor = top;
        else negCursor = top;
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
  for (let i = 0; i < n; i++) {
    const center = slotStart(i) + slotSize.value / 2;
    out.push({
      label: fmt(categoryLabels.value[i], i),
      pos: center,
      anchor: "middle",
    });
  }
  return out;
});

interface InlineLegendItem {
  label: string;
  color: string;
}

const inlineLegendItems = computed<InlineLegendItem[]>(() => {
  const items: InlineLegendItem[] = [];
  allSeries.value.forEach((s, i) => {
    if (!s.legend || s.showInLegend === false) return;
    items.push({ label: s.legend, color: s.color ?? defaultColor(i) });
  });
  return items;
});

const inlineLegendLabels = computed(() =>
  inlineLegendItems.value.map((item) => item.label),
);

function toCsv(): string {
  if (typeof props.csv === "function") return props.csv();
  if (typeof props.csv === "string") return props.csv;
  const namedSeries = allSeries.value.map((s) => ({
    label: s.legend,
    data: s.data,
  }));
  return categoricalToCsv(categoryLabels.value, namedSeries);
}

const hasTooltipSlot = computed(
  () => !!props.tooltipData || !!props.tooltipTrigger,
);

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
  menuFilename,
  isFullscreen,
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
  chartPadding: () => props.chartPadding,
  inlineLegendLabels: () => inlineLegendLabels.value,
  hasTooltipSlot: () => hasTooltipSlot.value,
  getCsv: toCsv,
  pointerToIndex,
  onHover: (payload) => emit("hover", payload),
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
  <div
    ref="containerRef"
    class="bar-chart-wrapper"
    :class="{ 'is-fullscreen': isFullscreen }"
  >
    <ChartMenu v-if="menu" :items="menuItems" />
    <div class="chart-sr-only" aria-live="polite">
      {{ isFullscreen ? "Chart expanded to fill window" : "" }}
    </div>
    <svg ref="svgRef" :width="width" :height="height">
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
        <template v-for="(item, i) in positionedLegendItems" :key="'ileg' + i">
          <rect
            :x="item.x"
            :y="item.y - 5"
            width="12"
            height="10"
            :fill="item.color"
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
      <!-- value grid lines -->
      <template v-if="valueGrid">
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
      <template v-if="isVertical">
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
      <template v-else>
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
          :x="padding.left - 6"
          :y="tick.pos"
          text-anchor="end"
          dominant-baseline="middle"
          :font-size="tickLabelResolved.fontSize"
          :fill="tickLabelResolved.fill"
          :font-weight="tickLabelResolved.fontWeight"
          :fill-opacity="tickLabelResolved.fillOpacity"
        >
          {{ tick.label }}
        </text>
      </template>
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
  </div>
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
