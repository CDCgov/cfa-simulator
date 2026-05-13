<script setup lang="ts">
import { computed } from "vue";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import {
  snap,
  formatTick,
  computeTickValues,
  categoricalToCsv,
  useChartSize,
  useChartTooltip,
  useChartMenu,
  useChartPadding,
  INLINE_LEGEND_HEIGHT,
  type ChartData,
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
}

const props = withDefaults(
  defineProps<{
    /** Single-series values. Equivalent to `y`. */
    data?: BarChartData;
    /** Single-series values (alias for `data`). */
    y?: BarChartData;
    /** Multi-series mode. Each series has its own values. */
    series?: BarSeries[];
    /**
     * Category labels for the categorical axis. Length should match the
     * longest series. When omitted, indices (0, 1, 2, ...) are used.
     */
    categories?: readonly string[];
    /** "vertical" (default, aka column) draws upright bars; "horizontal" draws sideways. */
    orientation?: "vertical" | "horizontal";
    /** "grouped" (default) places series side-by-side; "stacked" stacks them. */
    layout?: "grouped" | "stacked";
    width?: number;
    height?: number;
    title?: string;
    xLabel?: string;
    yLabel?: string;
    /** Force the value axis to start at this value or lower (default 0). */
    valueMin?: number;
    /**
     * Tick placement on the value axis (numeric). Number = interval,
     * array = explicit values. When omitted, ticks are chosen automatically.
     */
    valueTicks?: number | number[];
    /** Formatter for value-axis tick labels. */
    valueTickFormat?: (value: number) => string;
    /**
     * Formatter for numeric values shown in the default tooltip. Receives
     * the raw value. Defaults to the same tick formatter used for axes.
     */
    tooltipValueFormat?: (value: number) => string;
    /** Formatter for category-axis labels. Receives the resolved category string. */
    categoryFormat?: (label: string, index: number) => string;
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
    debounce?: number;
    menu?: boolean | string;
    valueGrid?: boolean;
    /** Custom per-index data passed to the tooltip slot. */
    tooltipData?: unknown[];
    /** Tooltip activation mode. */
    tooltipTrigger?: "hover" | "click";
    /** Boundary for tooltip flip/clamp. Default "chart". */
    tooltipClamp?: "none" | "chart" | "window";
    /** Custom CSV content (string or function). When omitted, generated from the bars. */
    csv?: string | (() => string);
    /** Filename (without extension) for downloaded SVG, PNG, CSV. */
    filename?: string;
    /** Show a plain text link below the chart to download the CSV. */
    downloadLink?: boolean | string;
  }>(),
  {
    orientation: "vertical",
    layout: "grouped",
    valueMin: 0,
    barPadding: 0.2,
    groupGap: 1,
    menu: true,
    tooltipClamp: "chart",
    valueGrid: true,
  },
);

const emit = defineEmits<{
  (e: "hover", payload: { index: number } | null): void;
}>();

defineSlots<{
  tooltip?(props: {
    index: number;
    category: string;
    values: { value: number; color: string; seriesIndex: number }[];
    data: unknown;
  }): unknown;
}>();

const { containerRef, measuredWidth } = useChartSize({
  debounce: () => props.debounce,
});

const width = computed(() => props.width ?? (measuredWidth.value || 400));
const height = computed(() => props.height ?? 200);

const hasInlineLegend = computed(() => allSeries.value.some((s) => s.legend));

const { padding, innerW, innerH } = useChartPadding({
  title: () => props.title,
  xLabel: () => props.xLabel,
  yLabel: () => props.yLabel,
  hasInlineLegend: () => hasInlineLegend.value,
  width: () => width.value,
  height: () => height.value,
});

const EMPTY_DATA: readonly number[] = [];

type ResolvedSeries = {
  data: BarChartData;
  color?: string;
  opacity?: number;
  legend?: string;
};

function resolveSeries(s: BarSeries): ResolvedSeries {
  return {
    data: s.y ?? s.data ?? EMPTY_DATA,
    color: s.color,
    opacity: s.opacity,
    legend: s.legend,
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
    labels[i] = props.categories?.[i] ?? String(i);
  }
  return labels;
});

const isVertical = computed(() => props.orientation === "vertical");

/** Extent of the value axis (across all series, accounting for stacking). */
const valueExtent = computed(() => {
  let min = Infinity;
  let max = -Infinity;
  if (props.layout === "stacked") {
    const n = categoryCount.value;
    for (let i = 0; i < n; i++) {
      let pos = 0;
      let neg = 0;
      for (const s of allSeries.value) {
        if (i >= s.data.length) continue;
        const v = Number(s.data[i]);
        if (!isFinite(v)) continue;
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
        if (n < min) min = n;
        if (n > max) max = n;
      }
    }
  }
  if (!isFinite(min)) min = 0;
  if (!isFinite(max)) max = 0;
  // Extend the value axis down to valueMin (default 0) when data sits
  // above it, so bars share a common baseline.
  const floor = props.valueMin ?? 0;
  if (floor < min) min = floor;
  const range = max - min || 1;
  return { min, max, range };
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
  const { min, range } = valueExtent.value;
  const scale = valueSize.value / range;
  if (isVertical.value) {
    return padding.value.top + innerH.value - (v - min) * scale;
  }
  return padding.value.left + (v - min) * scale;
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

function formatTooltipValue(v: number): string {
  if (props.tooltipValueFormat) return props.tooltipValueFormat(v);
  if (props.valueTickFormat) return props.valueTickFormat(v);
  return formatTick(v);
}

const valueTickItems = computed(() => {
  const { min, max } = valueExtent.value;
  const fmt = (v: number) =>
    props.valueTickFormat ? props.valueTickFormat(v) : formatTick(v);
  if (min === max) {
    return [
      {
        value: fmt(min),
        pos: snap(valuePixel(min)),
      },
    ];
  }
  const targetTickPixels = isVertical.value ? 50 : 80;
  const values = computeTickValues({
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
  const out: CategoryTickItem[] = [];
  const n = categoryCount.value;
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
    if (!s.legend) return;
    items.push({ label: s.legend, color: s.color ?? defaultColor(i) });
  });
  return items;
});

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
  hoverIndex,
  tooltipRef,
  tooltipPos,
  handlers: tooltipHandlers,
} = useChartTooltip({
  enabled: () => hasTooltipSlot.value,
  trigger: () => props.tooltipTrigger,
  clamp: () => props.tooltipClamp,
  pointerToIndex,
  containerRef,
  onHover: (payload) => emit("hover", payload),
});

const {
  svgRef,
  items: menuItems,
  downloadLinkText,
  csvHref,
  resolvedFilename: menuFilename,
} = useChartMenu({
  filename: () => props.filename,
  legacyMenuLabel: () => props.menu,
  getCsv: toCsv,
  downloadLink: () => props.downloadLink,
});

const hoveredCategoryLabel = computed(() => {
  const i = hoverIndex.value;
  if (i === null) return undefined;
  return categoryLabels.value[i];
});

const hoverSlotProps = computed(() => {
  const idx = hoverIndex.value;
  if (idx === null) return null;
  return {
    index: idx,
    category: categoryLabels.value[idx] ?? String(idx),
    values: allSeries.value.map((s, i) => ({
      value: Number(s.data[idx] ?? NaN),
      color: s.color ?? defaultColor(i),
      seriesIndex: i,
    })),
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
</script>

<template>
  <div ref="containerRef" class="bar-chart-wrapper">
    <ChartMenu v-if="menu" :items="menuItems" />
    <svg ref="svgRef" :width="width" :height="height">
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
          <rect
            :x="padding.left + i * 120"
            :y="padding.top - INLINE_LEGEND_HEIGHT / 2 - 5"
            width="12"
            height="10"
            :fill="item.color"
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
          font-size="10"
          fill="currentColor"
          fill-opacity="0.6"
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
          font-size="10"
          fill="currentColor"
          fill-opacity="0.6"
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
        font-size="13"
        fill="currentColor"
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
          font-size="10"
          fill="currentColor"
          fill-opacity="0.6"
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
          font-size="10"
          fill="currentColor"
          fill-opacity="0.6"
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
        font-size="13"
        fill="currentColor"
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

.bar-chart-wrapper:hover :deep(.chart-menu-button) {
  opacity: 1;
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
