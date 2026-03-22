<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import type { ChartMenuItem } from "../ChartMenu/ChartMenu.vue";
import { saveSvg, savePng, downloadCsv } from "../ChartMenu/download.js";

export interface Series {
  data: number[];
  color?: string;
  dashed?: boolean;
  strokeWidth?: number;
  opacity?: number;
}

const props = withDefaults(
  defineProps<{
    data?: number[];
    series?: Series[];
    width?: number;
    height?: number;
    lineOpacity?: number;
    title?: string;
    xLabel?: string;
    yLabel?: string;
    debounce?: number;
    menu?: boolean | string;
  }>(),
  { lineOpacity: 1, menu: true },
);

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

const padding = computed(() => ({
  top: props.title ? 30 : 10,
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

const maxLen = computed(() => {
  let m = 0;
  for (const s of allSeries.value) {
    if (s.data.length > m) m = s.data.length;
  }
  return m;
});

const extent = computed(() => {
  let min = Infinity;
  let max = -Infinity;
  for (const s of allSeries.value) {
    for (const v of s.data) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!isFinite(min)) return { min: 0, max: 0, range: 1 };
  return { min, max, range: max - min || 1 };
});

function toPath(data: number[]): string {
  if (data.length === 0) return "";
  const { min, range } = extent.value;
  const len = maxLen.value;
  const xScale = innerW.value / (len - 1 || 1);
  const yScale = innerH.value / range;
  const py = padding.value.top + innerH.value;
  let d = `M${padding.value.left},${py - (data[0] - min) * yScale}`;
  for (let i = 1; i < data.length; i++) {
    d += `L${padding.value.left + i * xScale},${py - (data[i] - min) * yScale}`;
  }
  return d;
}

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
        y: padding.value.top + innerH.value / 2,
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
      y:
        padding.value.top +
        innerH.value -
        ((v - min) / extent.value.range) * innerH.value,
    });
  }
  return ticks;
});

const xTicks = computed(() => {
  const len = maxLen.value;
  if (len <= 1) return [];
  const targetTicks = Math.max(3, Math.floor(innerW.value / 80));
  const step = niceStep(len - 1, targetTicks);
  const ticks: { value: string; x: number }[] = [];
  for (let i = 0; i <= len - 1; i += step) {
    const idx = Math.round(i);
    ticks.push({
      value: idx.toString(),
      x: padding.value.left + (idx / (len - 1)) * innerW.value,
    });
  }
  return ticks;
});

function menuFilename() {
  return typeof props.menu === "string" ? props.menu : "chart";
}

function getSvgEl(): SVGSVGElement | null {
  return svgRef.value;
}

function toCsv(): string {
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

const menuItems = computed<ChartMenuItem[]>(() => {
  const fname = menuFilename();
  return [
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
    { label: "Download CSV", action: () => downloadCsv(toCsv(), fname) },
  ];
});
</script>

<template>
  <div ref="containerRef" class="line-chart-wrapper">
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
      <!-- axes -->
      <line
        :x1="padding.left"
        :y1="padding.top"
        :x2="padding.left"
        :y2="padding.top + innerH"
        stroke="currentColor"
        stroke-opacity="0.3"
      />
      <line
        :x1="padding.left"
        :y1="padding.top + innerH"
        :x2="padding.left + innerW"
        :y2="padding.top + innerH"
        stroke="currentColor"
        stroke-opacity="0.3"
      />
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
      <!-- data lines -->
      <path
        v-for="(s, i) in allSeries"
        :key="i"
        :d="toPath(s.data)"
        fill="none"
        :stroke="s.color ?? 'currentColor'"
        :stroke-width="s.strokeWidth ?? 1.5"
        :stroke-opacity="s.opacity ?? lineOpacity"
        :stroke-dasharray="s.dashed ? '6 3' : undefined"
      />
    </svg>
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
</style>
