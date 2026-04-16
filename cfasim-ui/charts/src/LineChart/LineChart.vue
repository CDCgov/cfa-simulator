<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from "vue";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import type { ChartMenuItem } from "../ChartMenu/ChartMenu.vue";
import { saveSvg, savePng, downloadCsv } from "../ChartMenu/download.js";
import { placeTooltip } from "../tooltip-position.js";

export interface Series {
  data: number[];
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
  upper: number[];
  lower: number[];
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
    data?: number[];
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
    xMin?: number;
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

const allSeries = computed<Series[]>(() => {
  if (props.series && props.series.length > 0) return props.series;
  if (props.data) return [{ data: props.data }];
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

function toPath(data: number[]): string {
  if (data.length === 0) return "";
  const { min, range } = extent.value;
  const len = maxLen.value;
  const xScale = innerW.value / (len - 1 || 1);
  const yScale = innerH.value / range;
  const py = padding.value.top + innerH.value;
  let d = "";
  let inSegment = false;
  for (let i = 0; i < data.length; i++) {
    if (!isFinite(data[i])) {
      inSegment = false;
      continue;
    }
    const x = padding.value.left + i * xScale;
    const y = py - (data[i] - min) * yScale;
    d += inSegment ? `L${x},${y}` : `M${x},${y}`;
    inSegment = true;
  }
  return d;
}

function toPoints(data: number[]): { x: number; y: number }[] {
  const { min, range } = extent.value;
  const len = maxLen.value;
  const xScale = innerW.value / (len - 1 || 1);
  const yScale = innerH.value / range;
  const py = padding.value.top + innerH.value;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < data.length; i++) {
    if (!isFinite(data[i])) continue;
    pts.push({
      x: padding.value.left + i * xScale,
      y: py - (data[i] - min) * yScale,
    });
  }
  return pts;
}

function toAreaPath(upper: number[], lower: number[]): string {
  const len = Math.min(upper.length, lower.length);
  if (len === 0) return "";
  const { min, range } = extent.value;
  const ml = maxLen.value;
  const xScale = innerW.value / (ml - 1 || 1);
  const yScale = innerH.value / range;
  const py = padding.value.top + innerH.value;
  const x = (i: number) => padding.value.left + i * xScale;
  const y = (v: number) => py - (v - min) * yScale;
  // Collect contiguous segments where both upper and lower are finite
  const segments: number[][] = [];
  let seg: number[] = [];
  for (let i = 0; i < len; i++) {
    if (isFinite(upper[i]) && isFinite(lower[i])) {
      seg.push(i);
    } else if (seg.length) {
      segments.push(seg);
      seg = [];
    }
  }
  if (seg.length) segments.push(seg);
  let d = "";
  for (const s of segments) {
    d += `M${x(s[0])},${y(upper[s[0]])}`;
    for (let j = 1; j < s.length; j++) d += `L${x(s[j])},${y(upper[s[j]])}`;
    for (let j = s.length - 1; j >= 0; j--)
      d += `L${x(s[j])},${y(lower[s[j]])}`;
    d += "Z";
  }
  return d;
}

function toSectionPath(section: AreaSection, closed = true): string {
  const len = maxLen.value;
  const xScale = innerW.value / (len - 1 || 1);
  const py = padding.value.top + innerH.value;
  const x = (i: number) => padding.value.left + i * xScale;

  // No seriesIndex: full-height rectangle spanning the range
  if (section.seriesIndex == null) {
    const start = Math.max(0, section.startIndex);
    const end = Math.min(len - 1, section.endIndex);
    if (start > end) return "";
    return `M${x(start)},${padding.value.top}L${x(end)},${padding.value.top}L${x(end)},${py}L${x(start)},${py}Z`;
  }

  const s = allSeries.value[section.seriesIndex];
  if (!s) return "";
  const { min, range } = extent.value;
  const yScale = innerH.value / range;
  const y = (v: number) => py - (v - min) * yScale;

  const start = Math.max(0, section.startIndex);
  const end = Math.min(s.data.length - 1, section.endIndex);
  if (start > end) return "";

  let d = `M${x(start)},${y(s.data[start])}`;
  for (let i = start + 1; i <= end; i++) {
    if (!isFinite(s.data[i])) continue;
    d += `L${x(i)},${y(s.data[i])}`;
  }
  if (closed) {
    d += `L${x(end)},${py}`;
    d += `L${x(start)},${py}`;
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

  const len = maxLen.value;
  const xScale = innerW.value / (len - 1 || 1);

  const items: PositionedSectionLabel[] = [];
  for (const sec of sections) {
    if (!sec.label && !sec.description) continue;
    if (sec.legend === "inline" || sec.legend === false) continue;
    const cx =
      padding.value.left + ((sec.startIndex + sec.endIndex) / 2) * xScale;
    const labelText = sec.label ?? "";
    const descText = sec.description ?? "";
    const maxChars = Math.max(labelText.length, descText.length);
    const textWidth = maxChars * SECTION_LABEL_CHAR_WIDTH;
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

const yTicks = computed(() => {
  const { min, max } = extent.value;
  if (min === max) {
    return [
      {
        value: formatTick(min),
        y: snap(padding.value.top + innerH.value / 2),
      },
    ];
  }
  const targetTicks = Math.max(3, Math.floor(innerH.value / 50));
  const step = niceStep(max - min, targetTicks);
  const start = Math.ceil(min / step) * step;
  const ticks: { value: string; y: number }[] = [];
  for (let v = start; v <= max; v += step) {
    ticks.push({
      value: formatTick(v),
      y: snap(
        padding.value.top +
          innerH.value -
          ((v - min) / extent.value.range) * innerH.value,
      ),
    });
  }
  return ticks;
});

const xTicks = computed(() => {
  const len = maxLen.value;
  if (len <= 1) return [];
  const labels = props.xLabels;
  if (labels && labels.length === len) {
    const targetTicks = Math.max(3, Math.floor(innerW.value / 80));
    const step = Math.max(1, Math.round((len - 1) / targetTicks));
    const ticks: { value: string; x: number }[] = [];
    for (let i = 0; i < len; i += step) {
      ticks.push({
        value: labels[i],
        x: snap(padding.value.left + (i / (len - 1)) * innerW.value),
      });
    }
    return ticks;
  }
  const offset = props.xMin ?? 0;
  const targetTicks = Math.max(3, Math.floor(innerW.value / 80));
  const step = niceStep(len - 1, targetTicks);
  const ticks: { value: string; x: number }[] = [];
  for (let i = 0; i <= len - 1; i += step) {
    const idx = Math.round(i);
    ticks.push({
      value: formatTick(idx + offset),
      x: snap(padding.value.left + (idx / (len - 1)) * innerW.value),
    });
  }
  return ticks;
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
  const headers =
    series.length === 1
      ? ["index", "value"]
      : ["index", ...series.map((_, i) => `series_${i}`)];
  const rows = [headers.join(",")];
  for (let r = 0; r < len; r++) {
    const cells = [r.toString()];
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

const hoverX = computed(() => {
  if (hoverIndex.value === null) return 0;
  const len = maxLen.value;
  const xScale = innerW.value / (len - 1 || 1);
  return padding.value.left + hoverIndex.value * xScale;
});

const hoverDots = computed(() => {
  const idx = hoverIndex.value;
  if (idx === null) return [];
  const { min, range } = extent.value;
  const yScale = innerH.value / range;
  const py = padding.value.top + innerH.value;
  return allSeries.value
    .filter((s) => idx < s.data.length && isFinite(s.data[idx]))
    .map((s) => ({
      x: hoverX.value,
      y: py - (s.data[idx] - min) * yScale,
      color: s.color ?? "currentColor",
    }));
});

const hoverSlotProps = computed(() => {
  const idx = hoverIndex.value;
  if (idx === null) return null;
  return {
    index: idx,
    xLabel: props.xLabels?.[idx],
    values: allSeries.value.map((s, i) => ({
      value: s.data[idx],
      color: s.color ?? "currentColor",
      seriesIndex: i,
    })),
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
  const len = maxLen.value;
  if (len <= 1) return null;
  const mouseX = clientX - rect.left;
  const xScale = innerW.value / (len - 1 || 1);
  const dataX = (mouseX - padding.value.left) / xScale;
  return Math.round(Math.max(0, Math.min(len - 1, dataX)));
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
          v-for="(tick, i) in yTicks"
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
          v-for="(tick, i) in xTicks"
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
        v-for="(tick, i) in yTicks"
        :key="'y' + i"
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
        v-for="(tick, i) in xTicks"
        :key="'x' + i"
        :x="tick.x"
        :y="padding.top + innerH + 16"
        text-anchor="middle"
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
        :d="toAreaPath(a.upper, a.lower)"
        :fill="a.color ?? 'currentColor'"
        :fill-opacity="a.opacity ?? 0.2"
        stroke="none"
      />
      <!-- data lines and dots -->
      <template v-for="(s, i) in allSeries" :key="i">
        <path
          v-if="s.line !== false"
          :d="toPath(s.data)"
          fill="none"
          :stroke="s.color ?? 'currentColor'"
          :stroke-width="s.strokeWidth ?? 1.5"
          :stroke-opacity="s.lineOpacity ?? s.opacity ?? lineOpacity"
          :stroke-dasharray="s.dashed ? '6 3' : undefined"
        />
        <template v-if="s.dots">
          <circle
            v-for="(pt, j) in toPoints(s.data)"
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
            :x1="
              snap(padding.left + sec.startIndex * (innerW / (maxLen - 1 || 1)))
            "
            :y1="padding.top"
            :x2="
              snap(padding.left + sec.startIndex * (innerW / (maxLen - 1 || 1)))
            "
            :y2="padding.top + innerH"
            :stroke="sec.color ?? '#999'"
            :stroke-width="sec.strokeWidth ?? 2"
            :stroke-dasharray="sec.dashed ? '6 3' : undefined"
          />
          <line
            :x1="
              snap(padding.left + sec.endIndex * (innerW / (maxLen - 1 || 1)))
            "
            :y1="padding.top"
            :x2="
              snap(padding.left + sec.endIndex * (innerW / (maxLen - 1 || 1)))
            "
            :y2="padding.top + innerH"
            :stroke="sec.color ?? '#999'"
            :stroke-width="sec.strokeWidth ?? 2"
            :stroke-dasharray="sec.dashed ? '6 3' : undefined"
          />
        </template>
        <!-- tick marks at section boundaries -->
        <line
          :x1="
            snap(padding.left + sec.startIndex * (innerW / (maxLen - 1 || 1)))
          "
          :y1="padding.top + innerH - 4"
          :x2="
            snap(padding.left + sec.startIndex * (innerW / (maxLen - 1 || 1)))
          "
          :y2="padding.top + innerH + 4"
          stroke="currentColor"
          stroke-opacity="0.4"
        />
        <line
          :x1="snap(padding.left + sec.endIndex * (innerW / (maxLen - 1 || 1)))"
          :y1="padding.top + innerH - 4"
          :x2="snap(padding.left + sec.endIndex * (innerW / (maxLen - 1 || 1)))"
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
