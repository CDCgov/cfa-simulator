<script setup lang="ts">
import {
  computed,
  ref,
  watch,
  onMounted,
  onUnmounted,
  useId,
  toRaw,
  useSlots,
} from "vue";
import { geoPath, geoAlbersUsa } from "d3-geo";
import { zoom as d3Zoom } from "d3-zoom";
import { select } from "d3-selection";
import { feature, mesh, merge } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { fipsToHsa, hsaNames } from "./hsaMapping.js";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import type { ChartMenuItem } from "../ChartMenu/ChartMenu.vue";
import { saveSvg, savePng } from "../ChartMenu/download.js";
import { placeTooltip } from "../tooltip-position.js";
import ChoroplethTooltip from "./ChoroplethTooltip.vue";

const SVG_NS = "http://www.w3.org/2000/svg";

export type GeoType = "states" | "counties" | "hsas";

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
    /** TopoJSON topology object (e.g. from us-atlas/states-10m.json or us-atlas/counties-10m.json).
     * Must contain a "states" object for geoType="states", or both "states" and "counties" objects
     * for geoType="counties" or geoType="hsas". */
    topology: Topology;
    data?: StateData[];
    /** Geographic type: "states" (default), "counties", or "hsas" (Health Service Areas) */
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
    /** Tooltip activation mode */
    tooltipTrigger?: "hover" | "click";
    /**
     * @deprecated Use the `#tooltip` slot instead, which gives you full Vue
     * rendering (components, scoped styles, reactivity). This HTML-string
     * formatter is kept for backwards compatibility and will be removed in a
     * future release.
     */
    tooltipFormat?: (data: {
      id: string;
      name: string;
      value?: number | string;
    }) => string;
    /**
     * Formatter for numeric values shown in the default tooltip. Receives
     * the raw value. Ignored when `tooltipFormat` is provided (the caller
     * controls the entire tooltip in that case).
     */
    tooltipValueFormat?: (value: number) => string;
    /**
     * Boundary for tooltip flip/clamp. `"none"` always places to the right of
     * the pointer with no clamping. `"chart"` (default) uses the map
     * container's bounding box. `"window"` uses the viewport.
     */
    tooltipClamp?: "none" | "chart" | "window";
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
    tooltipClamp: "chart",
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

type ChoroplethFeature = GeoJSON.Feature<
  GeoJSON.Geometry | null,
  { name?: string }
>;

/** Public payload shape — slot props, hover/click emits, tooltip cache. */
interface TooltipPayload {
  id: string;
  name: string;
  value?: number | string;
  feature: ChoroplethFeature;
}

defineSlots<{
  tooltip?(props: TooltipPayload): unknown;
}>();

// The child types `feature` as `unknown` (it has no map-specific knowledge);
// we always store a ChoroplethFeature, so narrow it back at the single point
// where we forward the slot.
const narrowSlotProps = (
  raw: { feature: unknown } & Omit<TooltipPayload, "feature">,
): TooltipPayload => raw as TooltipPayload;

const uid = useId();
const gradientId = `choropleth-gradient-${uid}`;
const containerRef = ref<HTMLElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const mapGroupRef = ref<SVGGElement | null>(null);
const tooltipChildRef = ref<InstanceType<typeof ChoroplethTooltip> | null>(
  null,
);
const slots = useSlots();
// Slot/prop presence doesn't change at runtime, so this is effectively
// computed once. Used to gate the teleported tooltip and the SVG <title>
// fallback.
const hasInteractiveTooltip = computed(
  () => !!props.tooltipTrigger || !!props.tooltipFormat || !!slots.tooltip,
);
const measuredWidth = ref(0);
// Imperative path bookkeeping. Plain Maps rather than refs — Vue never reads
// these from a render scope, so mutating them does not trigger re-renders.
const pathsByFeatureId = new Map<string, SVGPathElement>();
const tooltipDataById = new Map<string, TooltipPayload>();
let bordersPathEl: SVGPathElement | null = null;
let hoveredEl: SVGPathElement | null = null;
let isZooming = false;
// TODO: map hover/tooltip causes performance issues on mobile (SVG stroke-width
// changes + compositing layers degrade zoom/pan). Disabled on touch devices.
const isTouchDevice = typeof window !== "undefined" && "ontouchstart" in window;
let containerObserver: ResizeObserver | null = null;
let tooltipObserver: ResizeObserver | null = null;
const lastTooltipSize = { width: 0, height: 0 };
let lastPointer: { x: number; y: number } | null = null;
let tooltipVisible = false;
let zoomBehavior: ReturnType<typeof d3Zoom<SVGSVGElement, unknown>> | null =
  null;
// rAF-throttled cursor coords for moveTooltip; we coalesce many mousemove
// events into one transform write per animation frame.
let pendingMoveX = 0;
let pendingMoveY = 0;
let pendingMoveFrame = 0;

function setupInteraction() {
  if (isTouchDevice) return;
  const g = mapGroupRef.value;
  if (!g) return;
  g.addEventListener("click", onDelegatedEvent);
  g.addEventListener("mouseover", onDelegatedEvent);
  g.addEventListener("mousemove", onDelegatedMouseMove);
  g.addEventListener("mouseout", onDelegatedMouseOut);
}

function teardownInteraction() {
  const g = mapGroupRef.value;
  if (!g) return;
  g.removeEventListener("click", onDelegatedEvent);
  g.removeEventListener("mouseover", onDelegatedEvent);
  g.removeEventListener("mousemove", onDelegatedMouseMove);
  g.removeEventListener("mouseout", onDelegatedMouseOut);
}

onMounted(() => {
  if (containerRef.value) {
    measuredWidth.value = containerRef.value.clientWidth;
    containerObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) measuredWidth.value = entry.contentRect.width;
    });
    containerObserver.observe(containerRef.value);
  }
  setupZoom();
  setupInteraction();
  rebuildPaths();
  attachTooltipObserver();
});

onUnmounted(() => {
  containerObserver?.disconnect();
  tooltipObserver?.disconnect();
  if (pendingMoveFrame) cancelAnimationFrame(pendingMoveFrame);
  teardownZoom();
  teardownInteraction();
});

function setupZoom() {
  if (!svgRef.value || !mapGroupRef.value) return;
  if (!props.zoom && !props.pan) return;

  const svg = select(svgRef.value);
  zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
    .scaleExtent(props.zoom ? [1, 12] : [1, 1])
    .on("start", () => {
      isZooming = true;
      clearHover();
    })
    .on("zoom", (event) => {
      if (mapGroupRef.value) {
        mapGroupRef.value.setAttribute("transform", event.transform);
      }
    })
    .on("end", () => {
      isZooming = false;
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
    teardownInteraction();
    setupZoom();
    setupInteraction();
  },
);

const width = computed(() => props.width ?? (measuredWidth.value || 600));
const aspectRatio = computed(() => {
  if (props.width && props.height) return props.height / props.width;
  return 0.625;
});
const height = computed(() => width.value * aspectRatio.value);

type NamedGeometry = GeometryCollection<{ name: string }>;
type StatesTopo = Topology<{ states: NamedGeometry }>;
type CountiesTopo = Topology<{
  counties: NamedGeometry;
  states: NamedGeometry;
}>;

const hsaFeaturesGeo = computed(() => {
  const topo = toRaw(props.topology) as unknown as CountiesTopo;
  const countyGeometries = topo.objects.counties.geometries;
  const groups = new Map<string, typeof countyGeometries>();

  for (const geom of countyGeometries) {
    const fips = String(geom.id).padStart(5, "0");
    const hsaCode = fipsToHsa[fips];
    if (!hsaCode) continue;
    if (!groups.has(hsaCode)) groups.set(hsaCode, []);
    groups.get(hsaCode)!.push(geom);
  }

  const features: GeoJSON.Feature[] = [];
  for (const [hsaCode, geoms] of groups) {
    features.push({
      type: "Feature",
      id: hsaCode,
      properties: { name: hsaNames[hsaCode] ?? hsaCode },
      geometry: merge(topo as unknown as Topology, geoms as any),
    });
  }

  return { type: "FeatureCollection" as const, features };
});

const featuresGeo = computed(() => {
  if (props.geoType === "hsas") return hsaFeaturesGeo.value;
  if (props.geoType === "counties") {
    const topo = toRaw(props.topology) as unknown as CountiesTopo;
    return feature(topo, topo.objects.counties);
  }
  const topo = toRaw(props.topology) as unknown as StatesTopo;
  return feature(topo, topo.objects.states);
});

const stateBordersPath = computed(() => {
  if (props.geoType !== "counties" && props.geoType !== "hsas") return null;
  const topo = toRaw(props.topology) as unknown as CountiesTopo;
  return mesh(topo, topo.objects.states, (a, b) => a !== b);
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
  props.geoType === "counties" || props.geoType === "hsas"
    ? props.strokeWidth * 0.5
    : props.strokeWidth,
);

// O(features + data) name→id index, so `dataMap` doesn't fall back to a
// linear scan per data point (previously O(features × data)).
const nameToFeatureId = computed(() => {
  const m = new Map<string, string>();
  for (const f of featuresGeo.value.features) {
    if (f.properties?.name != null && f.id != null) {
      m.set(f.properties.name, String(f.id));
    }
  }
  return m;
});

const dataMap = computed(() => {
  const map = new Map<string, number | string>();
  if (!props.data) return map;
  const nameIdx = nameToFeatureId.value;
  for (const d of props.data) {
    map.set(d.id, d.value);
    const fid = nameIdx.get(d.id);
    if (fid) map.set(fid, d.value);
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

// Sorted high-to-low so the first match wins (highest threshold ≤ value).
// Cached so we don't re-sort 3k+ times during a rebuild.
const thresholdStopsDesc = computed(() =>
  isThreshold.value
    ? (props.colorScale as ThresholdStop[])
        .slice()
        .sort((a, b) => b.min - a.min)
    : null,
);

const categoricalByValue = computed(() => {
  if (!isCategorical.value) return null;
  const m = new Map<string, string>();
  for (const s of props.colorScale as CategoricalStop[])
    m.set(s.value, s.color);
  return m;
});

/** Single color-resolution path. Returns the noData color for missing rows. */
function colorFor(id: string): string {
  const value = dataMap.value.get(id);
  const noData = props.noDataColor!;
  if (value == null) return noData;
  const cat = categoricalByValue.value;
  if (cat) return cat.get(String(value)) ?? noData;
  const thresholds = thresholdStopsDesc.value;
  if (thresholds) {
    const n = value as number;
    for (const stop of thresholds) if (n >= stop.min) return stop.color;
    return noData;
  }
  const { min, max } = extent.value;
  return interpolateColor(((value as number) - min) / (max - min));
}

const featureName = (
  feat: (typeof featuresGeo.value.features)[number],
): string => feat.properties?.name ?? String(feat.id);

function formatTooltipValue(value: number | string | undefined): string {
  if (value == null) return "";
  if (typeof value === "number" && props.tooltipValueFormat) {
    return props.tooltipValueFormat(value);
  }
  return String(value);
}

/** "Name" or "Name: formatted-value" — used for the SVG <title> fallback. */
function titleText(name: string, value: number | string | undefined): string {
  return value == null ? name : `${name}: ${formatTooltipValue(value)}`;
}

// ─── Tooltip (fully synchronous; positioning uses cached size) ───────────
//
// The flow is:
//   1. mouseover  → setData (Vue patches slot props on the *child*) → position
//      using lastTooltipSize (possibly stale by one frame) → visibility:visible
//   2. tooltipObserver fires when the slot DOM has actually committed → we
//      refresh lastTooltipSize and re-apply the position if still visible.
//   3. mousemove  → rAF-throttled direct DOM write of transform; no reactivity.
//   4. mouseout (leaving the map) → visibility:hidden.
//
// There is no `await` and no token: out-of-order completion is impossible
// because every step is synchronous from the event handler's perspective.

function attachTooltipObserver() {
  const el = tooltipChildRef.value?.getEl();
  if (!el) return;
  tooltipObserver?.disconnect();
  tooltipObserver = new ResizeObserver((entries) => {
    const r = entries[0]?.contentRect;
    if (!r) return;
    lastTooltipSize.width = r.width;
    lastTooltipSize.height = r.height;
    if (tooltipVisible && lastPointer) {
      applyTooltipPosition(lastPointer.x, lastPointer.y);
    }
  });
  tooltipObserver.observe(el);
}

function applyTooltipPosition(clientX: number, clientY: number) {
  const el = tooltipChildRef.value?.getEl();
  if (!el) return;
  // Use the cached size — accurate after the first ResizeObserver tick. On
  // the very first show before the observer has fired, this falls through
  // placeTooltip's no-flip path (size 0 → no flip), which simply pins the
  // tooltip to the right of the cursor.
  const chartRect = containerRef.value?.getBoundingClientRect();
  const { left, top } = placeTooltip(
    clientX,
    clientY,
    lastTooltipSize.width,
    lastTooltipSize.height,
    props.tooltipClamp,
    chartRect,
  );
  el.style.transform = `translate3d(${left}px, ${top}px, 0) translateY(-50%)`;
}

function showTooltip(featId: string, clientX: number, clientY: number) {
  const data = tooltipDataById.get(featId);
  if (!data) return;
  const child = tooltipChildRef.value;
  const el = child?.getEl();
  if (!child || !el) return;
  child.setData(data);
  lastPointer = { x: clientX, y: clientY };
  tooltipVisible = true;
  applyTooltipPosition(clientX, clientY);
  el.style.visibility = "visible";
}

function moveTooltip(clientX: number, clientY: number) {
  if (!tooltipVisible) return;
  pendingMoveX = clientX;
  pendingMoveY = clientY;
  if (pendingMoveFrame) return;
  pendingMoveFrame = requestAnimationFrame(() => {
    pendingMoveFrame = 0;
    const el = tooltipChildRef.value?.getEl();
    if (!el || !tooltipVisible) return;
    lastPointer = { x: pendingMoveX, y: pendingMoveY };
    // Mid-hover: don't re-run flip/clamp on every pixel; just translate.
    el.style.transform = `translate3d(${pendingMoveX + 16}px, ${pendingMoveY}px, 0) translateY(-50%)`;
  });
}

function hideTooltip() {
  if (!tooltipVisible) return;
  tooltipVisible = false;
  lastPointer = null;
  const el = tooltipChildRef.value?.getEl();
  if (el) el.style.visibility = "hidden";
}

function setHover(pathEl: SVGPathElement) {
  if (hoveredEl === pathEl) return;
  if (hoveredEl) {
    hoveredEl.setAttribute("stroke-width", String(effectiveStrokeWidth.value));
    hoveredEl.setAttribute("stroke", props.strokeColor);
  }
  hoveredEl = pathEl;
  // Bring hovered path to top so its thicker border is not clipped by neighbors.
  pathEl.parentNode?.appendChild(pathEl);
  pathEl.setAttribute("stroke-width", String(effectiveStrokeWidth.value + 1));
  pathEl.setAttribute("stroke", "#555");
}

function clearHover() {
  if (hoveredEl) {
    hoveredEl.setAttribute("stroke-width", String(effectiveStrokeWidth.value));
    hoveredEl.setAttribute("stroke", props.strokeColor);
    hoveredEl = null;
    emit("stateHover", null);
  }
  hideTooltip();
}

// ─── Delegated event handlers (single set of listeners on the <g>) ───────

function eventToFeatureId(target: EventTarget | null): string | null {
  let el = target as Element | null;
  while (el && !(el as HTMLElement).dataset?.featId) el = el.parentElement;
  return el ? ((el as HTMLElement).dataset.featId ?? null) : null;
}

function onDelegatedEvent(event: Event) {
  if (isZooming) return;
  const me = event as MouseEvent;
  const featId = eventToFeatureId(me.target);
  if (!featId) return;
  const data = tooltipDataById.get(featId);
  if (!data) return;
  const payload = { id: data.id, name: data.name, value: data.value };
  if (event.type === "click") {
    emit("stateClick", payload);
  } else if (event.type === "mouseover") {
    setHover(pathsByFeatureId.get(featId)!);
    if (hasInteractiveTooltip.value)
      showTooltip(featId, me.clientX, me.clientY);
    emit("stateHover", payload);
  }
}

function onDelegatedMouseMove(event: MouseEvent) {
  if (isZooming) return;
  moveTooltip(event.clientX, event.clientY);
}

function onDelegatedMouseOut(event: MouseEvent) {
  const related = event.relatedTarget as Element | null;
  if (related && mapGroupRef.value?.contains(related)) return;
  clearHover();
}

// ─── Imperative SVG path management ──────────────────────────────────────
//
// 3,000+ counties are too many to round-trip through Vue's render scheduler
// on every reactive change. We build the SVG path tree once per feature set
// and mutate attributes directly when data/styling changes.

function makePath(d: string | null): SVGPathElement {
  const p = document.createElementNS(SVG_NS, "path") as SVGPathElement;
  if (d) p.setAttribute("d", d);
  return p;
}

function rebuildPaths() {
  const g = mapGroupRef.value;
  if (!g) return;
  while (g.firstChild) g.removeChild(g.firstChild);
  pathsByFeatureId.clear();
  tooltipDataById.clear();
  bordersPathEl = null;
  hoveredEl = null;

  const path = pathGenerator.value;
  const features = featuresGeo.value.features;
  const stroke = props.strokeColor;
  const sw = String(effectiveStrokeWidth.value);
  const wantsTitleFallback = !hasInteractiveTooltip.value;

  // Single DocumentFragment append → one layout flush for the whole batch.
  const frag = document.createDocumentFragment();
  for (const feat of features) {
    const id = String(feat.id);
    const name = featureName(feat);
    const value = dataMap.value.get(id);
    const p = makePath(path(feat));
    p.setAttribute("class", "state-path");
    p.setAttribute("data-feat-id", id);
    p.setAttribute("fill", colorFor(id));
    p.setAttribute("stroke", stroke);
    p.setAttribute("stroke-width", sw);
    if (wantsTitleFallback) {
      const title = document.createElementNS(SVG_NS, "title");
      title.textContent = titleText(name, value);
      p.appendChild(title);
    }
    frag.appendChild(p);
    pathsByFeatureId.set(id, p);
    tooltipDataById.set(id, {
      id,
      name,
      value,
      feature: feat as ChoroplethFeature,
    });
  }

  // State-borders overlay (counties / hsas mode).
  const borders = stateBordersPath.value;
  if (borders) {
    const b = makePath(path(borders));
    b.setAttribute("fill", "none");
    b.setAttribute("stroke", stroke);
    b.setAttribute("stroke-width", "1");
    b.setAttribute("stroke-linejoin", "round");
    b.setAttribute("pointer-events", "none");
    frag.appendChild(b);
    bordersPathEl = b;
  }
  g.appendChild(frag);
}

function updateFills() {
  const refreshTitle = !hasInteractiveTooltip.value;
  for (const [id, p] of pathsByFeatureId) {
    const value = dataMap.value.get(id);
    const entry = tooltipDataById.get(id);
    p.setAttribute("fill", colorFor(id));
    // Refresh cached tooltip payload so a later hover (or the SVG <title>
    // fallback below) reflects the new value.
    if (entry) entry.value = value;
    if (refreshTitle && entry) {
      // First child is the <title> appended in rebuildPaths when fallback
      // mode is active.
      const title = p.firstElementChild;
      if (title) title.textContent = titleText(entry.name, value);
    }
  }
}

function updateStrokes() {
  const stroke = props.strokeColor;
  const sw = String(effectiveStrokeWidth.value);
  for (const p of pathsByFeatureId.values()) {
    if (p === hoveredEl) continue;
    p.setAttribute("stroke", stroke);
    p.setAttribute("stroke-width", sw);
  }
  if (bordersPathEl) bordersPathEl.setAttribute("stroke", stroke);
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

// ─── Reactive triggers for the imperative SVG tree ───────────────────────
// Registered last so the eagerly-evaluated source getters can read every
// computed defined above without hitting a TDZ.

// Geometry / projection / tooltip-mode → full rebuild.
watch(
  () => [pathGenerator.value, hasInteractiveTooltip.value],
  () => rebuildPaths(),
);

// Data or scale → repaint fills (and refresh fallback <title>s).
watch(
  () => [dataMap.value, props.colorScale, props.noDataColor],
  () => updateFills(),
);

// Stroke styling → refresh stroke attrs (skipping the currently hovered path).
watch(
  () => [props.strokeColor, effectiveStrokeWidth.value],
  () => updateStrokes(),
);
</script>

<template>
  <div ref="containerRef" :class="['choropleth-wrapper', { pannable: pan }]">
    <ChartMenu v-if="menu" :items="menuItems" />
    <svg ref="svgRef" :width="width" :height="svgHeight">
      <!--
        Path elements are created imperatively in `rebuildPaths()`; Vue never
        diffs the per-feature subtree so reactive state changes don't walk
        thousands of vnodes. This <g> is the mount point + event delegation
        target.
      -->
      <g ref="mapGroupRef" />
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
    <ChoroplethTooltip v-if="hasInteractiveTooltip" ref="tooltipChildRef">
      <template #default="raw">
        <slot name="tooltip" v-bind="narrowSlotProps(raw)">
          <span v-if="tooltipFormat" v-html="tooltipFormat(raw)" />
          <template v-else-if="raw.value == null">{{ raw.name }}</template>
          <template v-else>
            {{ raw.name }}: {{ formatTooltipValue(raw.value) }}
          </template>
        </slot>
      </template>
    </ChoroplethTooltip>
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
}
</style>
