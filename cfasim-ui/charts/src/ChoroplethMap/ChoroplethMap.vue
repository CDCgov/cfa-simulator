<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, useId } from "vue";
import { geoPath, geoAlbersUsa } from "d3-geo";
import { zoom as d3Zoom, zoomIdentity } from "d3-zoom";
import { select } from "d3-selection";
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import usStates from "us-atlas/states-10m.json";
import usCounties from "us-atlas/counties-10m.json";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import type { ChartMenuItem } from "../ChartMenu/ChartMenu.vue";
import { saveSvg, savePng } from "../ChartMenu/download.js";

export type GeoType = "states" | "counties";

export interface StateData {
  /** FIPS code (e.g. "06" for California, "04015" for a county) or name */
  id: string;
  value: number | string;
}

export interface ChoroplethColorScale {
  /** Minimum color (CSS color string). Default: "#e5f0fa" */
  min?: string;
  /** Maximum color (CSS color string). Default: "#08519c" */
  max?: string;
}

export interface ThresholdStop {
  /** Lower bound (inclusive). Values at or above this threshold get this color. */
  min: number;
  color: string;
  /** Optional label for the legend (defaults to the min value) */
  label?: string;
}

export interface CategoricalStop {
  /** The categorical value to match */
  value: string;
  /** CSS color string */
  color: string;
}

const props = withDefaults(
  defineProps<{
    data?: StateData[];
    /** Geographic type: "states" (default) or "counties" */
    geoType?: GeoType;
    width?: number;
    height?: number;
    colorScale?: ChoroplethColorScale | ThresholdStop[] | CategoricalStop[];
    title?: string;
    noDataColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    menu?: boolean | string;
    /** Show legend. Default: true */
    legend?: boolean;
    /** Title displayed next to the legend */
    legendTitle?: string;
    /** Enable mouse-wheel zooming. Default: false */
    zoom?: boolean;
    /** Enable click-and-drag panning. Default: false */
    pan?: boolean;
  }>(),
  {
    geoType: "states",
    noDataColor: "#ddd",
    strokeColor: "#fff",
    strokeWidth: 0.5,
    menu: true,
    legend: true,
    zoom: false,
    pan: false,
  },
);

const emit = defineEmits<{
  (
    e: "stateClick",
    state: { id: string; name: string; value?: number | string },
  ): void;
  (
    e: "stateHover",
    state: { id: string; name: string; value?: number | string } | null,
  ): void;
}>();

const uid = useId();
const gradientId = `choropleth-gradient-${uid}`;
const containerRef = ref<HTMLElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const mapGroupRef = ref<SVGGElement | null>(null);
const measuredWidth = ref(0);
let hoveredEl: SVGPathElement | null = null;
let observer: ResizeObserver | null = null;
let zoomBehavior: ReturnType<typeof d3Zoom<SVGSVGElement, unknown>> | null =
  null;

onMounted(() => {
  if (containerRef.value) {
    measuredWidth.value = containerRef.value.clientWidth;
    observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) measuredWidth.value = entry.contentRect.width;
    });
    observer.observe(containerRef.value);
  }
  setupZoom();
});

onUnmounted(() => {
  observer?.disconnect();
  teardownZoom();
});

function setupZoom() {
  if (!svgRef.value || !mapGroupRef.value) return;
  if (!props.zoom && !props.pan) return;

  const svg = select(svgRef.value);
  zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
    .scaleExtent(props.zoom ? [1, 12] : [1, 1])
    .on("zoom", (event) => {
      if (mapGroupRef.value) {
        mapGroupRef.value.setAttribute("transform", event.transform);
      }
    });

  if (!props.pan) {
    zoomBehavior.filter(
      (event) => event.type === "wheel" || event.type === "dblclick",
    );
  }

  svg.call(zoomBehavior);
}

function teardownZoom() {
  if (svgRef.value && zoomBehavior) {
    select(svgRef.value).on(".zoom", null);
    zoomBehavior = null;
  }
}

watch(
  () => [props.zoom, props.pan],
  () => {
    teardownZoom();
    setupZoom();
  },
);

const width = computed(() => props.width ?? (measuredWidth.value || 600));
const aspectRatio = computed(() => {
  if (props.width && props.height) return props.height / props.width;
  return 0.625;
});
const height = computed(() => width.value * aspectRatio.value);

type NamedGeometry = GeometryCollection<{ name: string }>;
const statesTopo = usStates as unknown as Topology<{ states: NamedGeometry }>;
const countiesTopo = usCounties as unknown as Topology<{
  counties: NamedGeometry;
  states: NamedGeometry;
}>;

const featuresGeo = computed(() => {
  if (props.geoType === "counties") {
    return feature(countiesTopo, countiesTopo.objects.counties);
  }
  return feature(statesTopo, statesTopo.objects.states);
});

const stateBordersPath = computed(() => {
  if (props.geoType !== "counties") return null;
  return mesh(countiesTopo, countiesTopo.objects.states, (a, b) => a !== b);
});

const projection = computed(() =>
  geoAlbersUsa().fitExtent(
    [
      [0, topOffset.value],
      [width.value, height.value + topOffset.value],
    ],
    featuresGeo.value,
  ),
);

const pathGenerator = computed(() => geoPath(projection.value));

const effectiveStrokeWidth = computed(() =>
  props.geoType === "counties" ? props.strokeWidth * 0.5 : props.strokeWidth,
);

const dataMap = computed(() => {
  const map = new Map<string, number | string>();
  if (!props.data) return map;
  for (const d of props.data) {
    map.set(d.id, d.value);
    const geo = featuresGeo.value.features.find(
      (f) => f.properties?.name === d.id,
    );
    if (geo?.id != null) map.set(String(geo.id), d.value);
  }
  return map;
});

const extent = computed(() => {
  if (!props.data || props.data.length === 0) return { min: 0, max: 1 };
  let min = Infinity;
  let max = -Infinity;
  for (const d of props.data) {
    if (typeof d.value === "number") {
      if (d.value < min) min = d.value;
      if (d.value > max) max = d.value;
    }
  }
  if (!isFinite(min)) return { min: 0, max: 1 };
  if (min === max) return { min, max: min + 1 };
  return { min, max };
});

const isCategorical = computed(
  () =>
    Array.isArray(props.colorScale) &&
    props.colorScale.length > 0 &&
    "value" in props.colorScale[0],
);

const isThreshold = computed(
  () => Array.isArray(props.colorScale) && !isCategorical.value,
);

const minColor = computed(() =>
  !isThreshold.value
    ? ((props.colorScale as ChoroplethColorScale | undefined)?.min ?? "#e5f0fa")
    : "",
);
const maxColor = computed(() =>
  !isThreshold.value
    ? ((props.colorScale as ChoroplethColorScale | undefined)?.max ?? "#08519c")
    : "",
);

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function interpolateColor(t: number): string {
  const [r1, g1, b1] = parseHex(minColor.value);
  const [r2, g2, b2] = parseHex(maxColor.value);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}

function thresholdColor(value: number): string {
  const stops = (props.colorScale as ThresholdStop[])
    .slice()
    .sort((a, b) => b.min - a.min);
  for (const stop of stops) {
    if (value >= stop.min) return stop.color;
  }
  return props.noDataColor!;
}

function categoricalColor(value: string | number): string {
  const stops = props.colorScale as CategoricalStop[];
  const match = stops.find((s) => s.value === String(value));
  return match ? match.color : props.noDataColor!;
}

function stateColor(id: string | number): string {
  const value = dataMap.value.get(String(id));
  if (value == null) return props.noDataColor!;
  if (isCategorical.value) return categoricalColor(value);
  if (isThreshold.value) return thresholdColor(value as number);
  const { min, max } = extent.value;
  const t = ((value as number) - min) / (max - min);
  return interpolateColor(t);
}

function stateName(feat: (typeof featuresGeo.value.features)[number]): string {
  return feat.properties?.name ?? String(feat.id);
}

function stateValue(
  feat: (typeof featuresGeo.value.features)[number],
): number | string | undefined {
  return dataMap.value.get(String(feat.id));
}

function handleClick(feat: (typeof featuresGeo.value.features)[number]) {
  emit("stateClick", {
    id: String(feat.id),
    name: stateName(feat),
    value: stateValue(feat),
  });
}

function handleMouseEnter(
  feat: (typeof featuresGeo.value.features)[number],
  event: MouseEvent,
) {
  const el = event.currentTarget as SVGPathElement;
  hoveredEl = el;
  el.setAttribute("stroke-width", String(effectiveStrokeWidth.value + 1));
  emit("stateHover", {
    id: String(feat.id),
    name: stateName(feat),
    value: stateValue(feat),
  });
}

function handleMouseLeave() {
  if (hoveredEl) {
    hoveredEl.setAttribute("stroke-width", String(effectiveStrokeWidth.value));
    hoveredEl = null;
  }
  emit("stateHover", null);
}

function menuFilename() {
  return typeof props.menu === "string" ? props.menu : "choropleth";
}

const showLegend = computed(
  () =>
    props.legend && (isCategorical.value || isThreshold.value || props.data),
);

const sortedThresholdStops = computed(() =>
  (props.colorScale as ThresholdStop[]).slice().sort((a, b) => a.min - b.min),
);

const titleHeight = computed(() => (props.title ? 24 : 0));
const legendHeight = computed(() => (showLegend.value ? 28 : 0));
const topOffset = computed(() => titleHeight.value + legendHeight.value);

const svgHeight = computed(() => height.value + topOffset.value);

const legendY = computed(() => titleHeight.value + 18);

const gradientStops = computed(() => {
  const steps = 10;
  const result: { offset: string; color: string }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    result.push({
      offset: `${(t * 100).toFixed(0)}%`,
      color: interpolateColor(t),
    });
  }
  return result;
});

const continuousTicks = computed(() => {
  const { min, max } = extent.value;
  const range = max - min;
  const count = 3;
  const ticks: { value: string; pct: number }[] = [];
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const v = min + range * t;
    const formatted = Number.isInteger(v)
      ? String(v)
      : v.toFixed(1).replace(/\.0$/, "");
    ticks.push({ value: formatted, pct: t * 100 });
  }
  return ticks;
});

const discreteLegendItems = computed(() => {
  const items: { key: string; color: string; label: string }[] = [];
  if (isCategorical.value) {
    for (const stop of props.colorScale as CategoricalStop[]) {
      items.push({ key: stop.value, color: stop.color, label: stop.value });
    }
  } else if (isThreshold.value) {
    for (const stop of sortedThresholdStops.value) {
      items.push({
        key: String(stop.min),
        color: stop.color,
        label: stop.label ?? String(stop.min),
      });
    }
  }
  return items;
});

const discreteLegendTotalWidth = computed(() => {
  const titleWidth = props.legendTitle ? props.legendTitle.length * 8 + 12 : 0;
  let w = titleWidth;
  for (const item of discreteLegendItems.value) {
    w += 16 + item.label.length * 7 + 12;
  }
  return w - (discreteLegendItems.value.length > 0 ? 12 : 0);
});

const discreteLegendPositions = computed(() => {
  const titleWidth = props.legendTitle ? props.legendTitle.length * 8 + 12 : 0;
  let x = titleWidth;
  return discreteLegendItems.value.map((item) => {
    const pos = x;
    x += 16 + item.label.length * 7 + 12;
    return pos;
  });
});

const legendXOffset = computed(() => {
  if (isCategorical.value || isThreshold.value) {
    return (width.value - discreteLegendTotalWidth.value) / 2;
  }
  const barWidth = 160;
  const titleWidth = props.legendTitle ? props.legendTitle.length * 8 + 12 : 0;
  return (width.value - titleWidth - barWidth) / 2;
});

const menuItems = computed<ChartMenuItem[]>(() => {
  const fname = menuFilename();
  return [
    {
      label: "Save as SVG",
      action: () => {
        if (svgRef.value) saveSvg(svgRef.value, fname);
      },
    },
    {
      label: "Save as PNG",
      action: () => {
        if (svgRef.value) savePng(svgRef.value, fname);
      },
    },
  ];
});
</script>

<template>
  <div ref="containerRef" :class="['choropleth-wrapper', { pannable: pan }]">
    <ChartMenu v-if="menu" :items="menuItems" />
    <svg ref="svgRef" :width="width" :height="svgHeight">
      <g ref="mapGroupRef">
        <path
          v-for="feat in featuresGeo.features"
          :key="String(feat.id)"
          :d="pathGenerator(feat) ?? undefined"
          :fill="stateColor(feat.id!)"
          :stroke="strokeColor"
          :stroke-width="effectiveStrokeWidth"
          class="state-path"
          @click="handleClick(feat)"
          @mouseenter="handleMouseEnter(feat, $event)"
          @mouseleave="handleMouseLeave"
        >
          <title>
            {{ stateName(feat)
            }}{{ stateValue(feat) != null ? `: ${stateValue(feat)}` : "" }}
          </title>
        </path>
        <path
          v-if="stateBordersPath"
          :d="pathGenerator(stateBordersPath) ?? undefined"
          fill="none"
          :stroke="strokeColor"
          :stroke-width="1"
          stroke-linejoin="round"
          pointer-events="none"
        />
      </g>
      <!-- Legend -->
      <g
        v-if="showLegend"
        class="choropleth-legend"
        :transform="`translate(${legendXOffset},${legendY})`"
      >
        <!-- Categorical or Threshold: dots with labels -->
        <template v-if="isCategorical || isThreshold">
          <text
            v-if="legendTitle"
            :y="5"
            font-size="13"
            font-weight="600"
            fill="currentColor"
          >
            {{ legendTitle }}
          </text>
          <template v-for="(item, i) in discreteLegendItems" :key="item.key">
            <rect
              :x="discreteLegendPositions[i]"
              :y="-5"
              width="12"
              height="12"
              rx="3"
              :fill="item.color"
            />
            <text
              :x="discreteLegendPositions[i] + 16"
              :y="5"
              font-size="13"
              fill="currentColor"
            >
              {{ item.label }}
            </text>
          </template>
        </template>
        <!-- Continuous: gradient bar with ticks -->
        <template v-else>
          <text
            v-if="legendTitle"
            :y="5"
            font-size="13"
            font-weight="600"
            fill="currentColor"
          >
            {{ legendTitle }}
          </text>
          <defs>
            <linearGradient :id="gradientId" x1="0" x2="1" y1="0" y2="0">
              <stop
                v-for="s in gradientStops"
                :key="s.offset"
                :offset="s.offset"
                :stop-color="s.color"
              />
            </linearGradient>
          </defs>
          <rect
            :x="legendTitle ? legendTitle.length * 8 + 12 : 0"
            :y="-6"
            :width="160"
            :height="12"
            rx="2"
            :fill="`url(#${gradientId})`"
          />
          <text
            v-for="tick in continuousTicks"
            :key="tick.value"
            :x="
              (legendTitle ? legendTitle.length * 8 + 12 : 0) +
              (tick.pct / 100) * 160
            "
            :y="20"
            font-size="11"
            fill="currentColor"
            opacity="0.7"
            text-anchor="middle"
          >
            {{ tick.value }}
          </text>
        </template>
      </g>
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
    </svg>
  </div>
</template>

<style scoped>
.choropleth-wrapper {
  position: relative;
  width: 100%;
}

.choropleth-wrapper.pannable svg {
  cursor: grab;
}

.choropleth-wrapper.pannable svg:active {
  cursor: grabbing;
}

.choropleth-wrapper:hover :deep(.chart-menu-button) {
  opacity: 1;
}

.state-path {
  cursor: pointer;
  transition: fill-opacity 0.15s;
}

.state-path:hover {
  fill-opacity: 0.8;
}
</style>
