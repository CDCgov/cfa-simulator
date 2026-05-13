<script setup lang="ts">
import {
  computed,
  ref,
  watch,
  onMounted,
  onUnmounted,
  toRaw,
  useSlots,
} from "vue";
import { geoPath, geoAlbersUsa } from "d3-geo";
import { zoom as d3Zoom, zoomIdentity } from "d3-zoom";
import { select } from "d3-selection";
// Side-effect import: enables `selection.transition()` on d3 selections so
// `applyFocus` can animate the zoom transform.
import "d3-transition";
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
    /**
     * Feature id(s) (FIPS code, HSA code, or feature name) to pan/zoom to.
     * Pass `null` or an empty array to clear. Works with `v-model:focus`:
     * clicking an unfocused feature emits its id; clicking a focused
     * feature emits `null` (toggle off). Users can pan/zoom away from the
     * focused area even when `zoom` and `pan` are disabled, and the
     * built-in Reset button also clears focus. If a tooltip is configured,
     * focusing a feature shows its tooltip.
     */
    focus?: string | string[] | null;
    /** Scale factor applied when `focus` is set. Default: 4 */
    focusZoomLevel?: number;
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
    focusZoomLevel: 4,
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
  (e: "update:focus", focus: string | null): void;
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
// Imperative path bookkeeping. Plain Maps rather than refs — Vue never reads
// these from a render scope, so mutating them does not trigger re-renders.
const pathsByFeatureId = new Map<string, SVGPathElement>();
const tooltipDataById = new Map<string, TooltipPayload>();
let bordersPathEl: SVGPathElement | null = null;
let hoveredEl: SVGPathElement | null = null;
// Paths currently styled as focused. Tracked separately from hover so the
// two states compose: hovering a focused path keeps the highlight on
// un-hover, and clearing focus while still hovering keeps the hover style.
const focusedPathEls = new Set<SVGPathElement>();
let isZooming = false;
// TODO: map hover/tooltip causes performance issues on mobile (SVG stroke-width
// changes + compositing layers degrade zoom/pan). Disabled on touch devices.
const isTouchDevice = typeof window !== "undefined" && "ontouchstart" in window;
let tooltipObserver: ResizeObserver | null = null;
const lastTooltipSize = { width: 0, height: 0 };
let lastPointer: { x: number; y: number } | null = null;
let tooltipVisible = false;
let zoomBehavior: ReturnType<typeof d3Zoom<SVGSVGElement, unknown>> | null =
  null;
// True once the user has zoomed or panned away from the identity transform.
// Drives the visibility of the reset button.
const isZoomed = ref(false);
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

// Scroll / resize don't reliably emit mouseout on the underlying path even
// though the cursor's relationship to the map has changed — the tooltip
// would otherwise get stuck at its old `position: fixed` coordinates.
function dismissOnViewportChange() {
  clearHover();
}

onMounted(() => {
  setupZoom();
  setupInteraction();
  rebuildPaths();
  applyFocus();
  attachTooltipObserver();
  window.addEventListener("scroll", dismissOnViewportChange, {
    passive: true,
    capture: true,
  });
  window.addEventListener("resize", dismissOnViewportChange, { passive: true });
});

onUnmounted(() => {
  tooltipObserver?.disconnect();
  if (pendingMoveFrame) cancelAnimationFrame(pendingMoveFrame);
  teardownZoom();
  teardownInteraction();
  window.removeEventListener("scroll", dismissOnViewportChange, {
    capture: true,
  });
  window.removeEventListener("resize", dismissOnViewportChange);
});

function setupZoom() {
  if (!svgRef.value || !mapGroupRef.value) return;

  const svg = select(svgRef.value);
  // Always span focusZoomLevel and at least the standard 12× ceiling so the
  // user can wheel further in/out of a focused view. Programmatic
  // `.transform()` calls are clamped to this range too.
  const maxScale = Math.max(12, props.focusZoomLevel);
  zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, maxScale])
    .on("start", () => {
      isZooming = true;
      clearHover();
    })
    .on("zoom", (event) => {
      if (mapGroupRef.value) {
        mapGroupRef.value.setAttribute("transform", event.transform);
      }
      const t = event.transform;
      isZoomed.value = t.k !== 1 || t.x !== 0 || t.y !== 0;
    })
    .on("end", () => {
      isZooming = false;
    });

  // Dynamic filter: re-evaluated per event, so toggling `focus`,
  // `zoom`, or `pan` doesn't require tearing down the zoom behavior.
  // When focus is active we always allow drag + wheel so users can
  // explore away from the focused area regardless of `zoom`/`pan`.
  // Programmatic `.transform()` calls bypass this filter entirely.
  zoomBehavior.filter((event) => {
    const focused = normalizedFocus.value.length > 0;
    const allowZoom = !!props.zoom || focused;
    const allowPan = !!props.pan || focused;
    if (event.type === "wheel" || event.type === "dblclick") {
      if (!allowZoom) return false;
    } else if (event.type === "mousedown" || event.type === "touchstart") {
      if (!allowPan) return false;
    } else if (!allowZoom && !allowPan) {
      return false;
    }
    // Mirror d3-zoom's default rejections (ctrl-click, non-primary buttons).
    return (!event.ctrlKey || event.type === "wheel") && !event.button;
  });

  svg.call(zoomBehavior);
}

function teardownZoom() {
  if (svgRef.value && zoomBehavior) {
    select(svgRef.value).on(".zoom", null);
    zoomBehavior = null;
  }
}

// Resolve user-facing focus identifiers (FIPS, HSA codes, or feature names)
// to canonical feature ids. Used both for highlighting/zoom and for the
// click-to-toggle "is this feature currently focused?" check.
function resolveFocusIds(rawIds: string[]): Set<string> {
  const byId = featuresById.value;
  const nameIdx = nameToFeatureId.value;
  const out = new Set<string>();
  for (const raw of rawIds) {
    const id = byId.has(raw) ? raw : nameIdx.get(raw);
    if (id != null) out.add(id);
  }
  return out;
}

function resolveFocusFeatures(rawIds: string[]): ChoroplethFeature[] {
  const byId = featuresById.value;
  const out: ChoroplethFeature[] = [];
  for (const id of resolveFocusIds(rawIds)) {
    const f = byId.get(id);
    if (f) out.push(f);
  }
  return out;
}

// Duration of the focus zoom transition (ms). Initial mount and explicit
// "clear focus" still snap instantly; only focus-prop changes animate.
const FOCUS_ANIM_MS = 450;
// Tracks whether applyFocus has been called once — initial mount apply
// is instant, subsequent updates animate.
let focusApplied = false;

function applyFocus() {
  if (!svgRef.value || !zoomBehavior) return;
  const ids = normalizedFocus.value;
  const features = ids.length > 0 ? resolveFocusFeatures(ids) : [];

  // Compute the new highlight set first so we can diff against the
  // previous one without re-resolving twice.
  const nextFocused = new Set<SVGPathElement>();
  for (const f of features) {
    const p = pathsByFeatureId.get(String(f.id));
    if (p) nextFocused.add(p);
  }

  // Restore strokes on paths that are no longer focused. Skip those still
  // hovered — hover keeps its own highlight.
  for (const p of focusedPathEls) {
    if (nextFocused.has(p) || p === hoveredEl) continue;
    restoreDefaultStroke(p);
  }
  // Apply highlight to newly-focused paths (skip those already hovered:
  // hover style is visually identical, no DOM churn needed).
  for (const p of nextFocused) {
    if (!focusedPathEls.has(p) && p !== hoveredEl) applyHighlightStroke(p);
  }
  focusedPathEls.clear();
  for (const p of nextFocused) focusedPathEls.add(p);

  const svg = select(svgRef.value);
  // Always cancel any in-flight transition first — d3-transition queues
  // same-named transitions rather than replacing them, so rapid focus
  // changes would otherwise chain animations end-to-end. Also lets a
  // straight-snap path actually take effect mid-animation.
  svg.interrupt();
  // First apply (initial mount) is instant. Only zoom-IN animates;
  // clearing snaps back. Matches resetZoom's instant feel.
  const animate = focusApplied && features.length > 0;
  focusApplied = true;

  if (features.length === 0) {
    zoomBehavior.transform(svg, zoomIdentity);
    clearHover();
    return;
  }

  // Compute pan + scale onto the focused features' bounding box, in
  // viewBox (canonical) coordinates.
  const [[x0, y0], [x1, y1]] = pathGenerator.value.bounds({
    type: "FeatureCollection",
    features,
  });
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const k = props.focusZoomLevel;
  const target = zoomIdentity
    .translate(width.value / 2 - k * cx, height.value / 2 - k * cy)
    .scale(k);

  const showFocusTooltip = () => {
    if (!hasInteractiveTooltip.value) return;
    const firstId = String(features[0].id);
    const pathEl = pathsByFeatureId.get(firstId);
    if (!pathEl) return;
    // Read the rect *after* the transform commits so the tooltip lands at
    // the focused feature's on-screen position.
    const rect = pathEl.getBoundingClientRect();
    showTooltip(
      firstId,
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
  };

  if (animate) {
    // d3-zoom + d3-transition: `transition.call(zoomBehavior.transform,
    // target)` interpolates the transform smoothly, firing the zoom
    // callback per frame so pan + scale animate together. Hide any prior
    // tooltip up front so it doesn't track the moving viewport; re-show
    // once the new target is reached.
    hideTooltip();
    svg
      .transition()
      .duration(FOCUS_ANIM_MS)
      .call(zoomBehavior.transform, target)
      .on("end", showFocusTooltip);
  } else {
    zoomBehavior.transform(svg, target);
    showFocusTooltip();
  }
}

function resetZoom() {
  if (!svgRef.value || !zoomBehavior) return;
  const svg = select(svgRef.value);
  // Cancel any in-flight focus animation before snapping so the transition
  // can't keep writing transforms after we set identity.
  svg.interrupt();
  zoomBehavior.transform(svg, zoomIdentity);
  // Keep v-model:focus in sync when the user resets a focused view.
  if (normalizedFocus.value.length > 0) emit("update:focus", null);
}

// `focusZoomLevel` only affects scaleExtent + the next focus apply. The
// d3-zoom filter reads `props.zoom` / `props.pan` dynamically, so we don't
// need to tear down zoom on those changes.
watch(
  () => props.focusZoomLevel,
  () => {
    if (zoomBehavior) {
      zoomBehavior.scaleExtent([1, Math.max(12, props.focusZoomLevel)]);
    }
    applyFocus();
  },
);

// Canonical internal coordinate system. All layout (projection, legend,
// title) is computed at this size; the SVG's viewBox makes the browser
// scale the entire canvas to whatever the container provides, so there's no
// JS work on container resize. `props.width` / `props.height`, when set,
// drive the rendered SVG element size but not these canonical coords.
const CANONICAL_WIDTH = 1000;
const aspectRatio = computed(() => {
  if (props.width && props.height) return props.height / props.width;
  return 0.625;
});
const width = computed(() => CANONICAL_WIDTH);
const height = computed(() => CANONICAL_WIDTH * aspectRatio.value);

// Layout is fluid: the wrapper fills its parent's width and the SVG fills
// the wrapper via CSS. `props.width` / `props.height`, when both are
// passed, only shape the viewBox aspect ratio — they don't pin a display
// size, so the map always scales to the available width without overflow.

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
      [0, 0],
      [width.value, height.value],
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

// id → feature lookup used by `applyFocus`. Cached so focus changes don't
// trigger a linear scan through 3k+ features per apply.
const featuresById = computed(() => {
  const m = new Map<string, ChoroplethFeature>();
  for (const f of featuresGeo.value.features) {
    if (f.id != null) m.set(String(f.id), f as ChoroplethFeature);
  }
  return m;
});

// Stable, deduped array form of `props.focus`. Drives the focus watcher;
// scalar `string` and `string[]` collapse to the same shape so the watcher
// only fires on a real change.
const normalizedFocus = computed<string[]>(() => {
  const f = props.focus;
  if (f == null) return [];
  if (Array.isArray(f)) return f;
  return [f];
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
  // First measurement bootstraps placement (the very first hover used the
  // 0×0 fallback). After that we just silently refresh the cached size —
  // every hover uses whatever was measured on the previous render, so
  // switching between hover targets never causes the tooltip to re-flip
  // mid-hover.
  let primed = false;
  tooltipObserver = new ResizeObserver((entries) => {
    const r = entries[0]?.contentRect;
    if (!r) return;
    lastTooltipSize.width = r.width;
    lastTooltipSize.height = r.height;
    if (!primed && tooltipVisible && lastPointer) {
      primed = true;
      applyTooltipPosition(lastPointer.x, lastPointer.y);
    } else {
      primed = true;
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

function applyHighlightStroke(pathEl: SVGPathElement) {
  // Bring path to top so its thicker border isn't clipped by neighbors.
  pathEl.parentNode?.appendChild(pathEl);
  pathEl.setAttribute("stroke-width", String(effectiveStrokeWidth.value + 1));
  pathEl.setAttribute("stroke", "#555");
}

function restoreDefaultStroke(pathEl: SVGPathElement) {
  pathEl.setAttribute("stroke-width", String(effectiveStrokeWidth.value));
  pathEl.setAttribute("stroke", props.strokeColor);
}

function setHover(pathEl: SVGPathElement) {
  if (hoveredEl === pathEl) return;
  if (hoveredEl && !focusedPathEls.has(hoveredEl)) {
    // Restore previous hover unless it's also focused — focus keeps the
    // highlight on its own.
    restoreDefaultStroke(hoveredEl);
  }
  hoveredEl = pathEl;
  applyHighlightStroke(pathEl);
}

function clearHover() {
  if (hoveredEl) {
    if (!focusedPathEls.has(hoveredEl)) restoreDefaultStroke(hoveredEl);
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
    // Click-to-focus toggle, baked in so `v-model:focus="ref"` Just Works:
    // clicking the currently focused feature clears focus (emits null);
    // clicking any other feature emits its id. With a `focus` array, any
    // click on a member clears everything — parents wanting fine-grained
    // multi-select handle merging themselves via `@update:focus`.
    const wasFocused = resolveFocusIds(normalizedFocus.value).has(data.id);
    emit("update:focus", wasFocused ? null : data.id);
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
  // Old focused paths are about to be detached — drop refs so applyFocus
  // can re-resolve against the new path tree.
  focusedPathEls.clear();

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
    // Keep stroke width pixel-accurate regardless of how the browser scales
    // the viewBox to fit the container — otherwise borders appear thicker
    // as the map is enlarged.
    p.setAttribute("vector-effect", "non-scaling-stroke");
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
    b.setAttribute("vector-effect", "non-scaling-stroke");
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
  for (const p of pathsByFeatureId.values()) {
    // Highlighted paths (hover / focus) keep their #555 + thicker stroke.
    if (p === hoveredEl || focusedPathEls.has(p)) continue;
    restoreDefaultStroke(p);
  }
  if (bordersPathEl) bordersPathEl.setAttribute("stroke", props.strokeColor);
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

// Compact formatter so legend ticks for large ranges (e.g. populations in
// the millions) don't render wide enough to collide with each other.
const compactTickFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const continuousTicks = computed(() => {
  const { min, max } = extent.value;
  const range = max - min;
  const count = 3;
  const ticks: { value: string; pct: number }[] = [];
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const v = min + range * t;
    const formatted =
      Math.abs(v) >= 1000
        ? compactTickFormat.format(v)
        : Number.isInteger(v)
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

// Linear-gradient CSS for the continuous legend bar, derived from the same
// stops the SVG version used.
const gradientCss = computed(() => {
  const stops = gradientStops.value
    .map((s) => `${s.color} ${s.offset}`)
    .join(", ");
  return `linear-gradient(to right, ${stops})`;
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

// Focus or projection changed → re-apply the focus transform imperatively.
// `flush: "post"` so any pending path rebuild from the watcher above has
// already run; we still use the GeoJSON pathGenerator directly so the SVG
// path tree isn't actually required, but keeping the order avoids stacking
// two zoom transforms in the same tick.
watch(
  () => [normalizedFocus.value, pathGenerator.value],
  () => applyFocus(),
  { flush: "post" },
);
</script>

<template>
  <div ref="containerRef" :class="['choropleth-wrapper', { pannable: pan }]">
    <ChartMenu v-if="menu" :items="menuItems" />
    <!--
      Title + legend live as an HTML overlay on top of the SVG so they keep
      their intrinsic px sizes regardless of how the browser scales the
      viewBox to fit the container.
    -->
    <div v-if="title || showLegend" class="choropleth-header">
      <div v-if="title" class="choropleth-title">{{ title }}</div>
      <div v-if="showLegend" class="choropleth-legend">
        <span v-if="legendTitle" class="choropleth-legend-title">
          {{ legendTitle }}
        </span>
        <template v-if="isCategorical || isThreshold">
          <span
            v-for="item in discreteLegendItems"
            :key="item.key"
            class="choropleth-legend-item"
          >
            <span
              class="choropleth-legend-swatch"
              :style="{ background: item.color }"
            />
            {{ item.label }}
          </span>
        </template>
        <div v-else class="choropleth-legend-continuous">
          <div
            class="choropleth-legend-gradient"
            :style="{ background: gradientCss }"
          />
          <div class="choropleth-legend-ticks">
            <span
              v-for="tick in continuousTicks"
              :key="tick.value"
              :style="{ left: tick.pct + '%' }"
            >
              {{ tick.value }}
            </span>
          </div>
        </div>
      </div>
    </div>
    <svg
      ref="svgRef"
      :viewBox="`0 0 ${width} ${height}`"
      preserveAspectRatio="xMidYMid meet"
    >
      <!--
        Path elements are created imperatively in `rebuildPaths()`; Vue never
        diffs the per-feature subtree so reactive state changes don't walk
        thousands of vnodes. This <g> is the mount point + event delegation
        target.
      -->
      <g ref="mapGroupRef" />
    </svg>
    <button
      v-if="isZoomed"
      type="button"
      class="choropleth-reset"
      aria-label="Reset zoom"
      @click="resetZoom"
    >
      Reset
    </button>
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
  /*
   * Override at the consumer level to change the legend/title panel fill:
   *   .my-map { --choropleth-legend-bg: rgba(0, 0, 0, 0.6); }
   * Defaults to the theme's page background so the panel reads as a
   * floating extension of the page surface.
   */
  --choropleth-legend-bg: var(--color-bg-0, #fff);

  position: relative;
  width: 100%;
}

.choropleth-wrapper svg {
  display: block;
  /* Fluid scaling via viewBox: the SVG fills its container's width and the
   * browser derives height from the viewBox aspect ratio. Overridden when
   * `props.width` / `props.height` are explicitly set on the component. */
  width: 100%;
  height: auto;
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

.choropleth-reset {
  position: absolute;
  bottom: 8px;
  left: 8px;
  padding: 4px 10px;
  font: inherit;
  font-size: 12px;
  color: var(--color-text-secondary, #555);
  background: var(--color-bg-0, #fff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 4px;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.choropleth-reset:hover {
  background: var(--color-bg-1, #f8f9fa);
  color: var(--color-text, #212529);
}

/*
 * Title + legend overlay. Lives in HTML so its sizes are independent of
 * the SVG viewBox scaling — text stays at its declared px size at any
 * container width.
 */
.choropleth-header {
  /*
   * In-flow above the map — the map gets its full canvas, no overlap to
   * worry about. Centered via `width: fit-content` + `margin: auto`.
   */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: fit-content;
  margin: 0 auto;
  padding: 8px 14px;
  border-radius: 4px;
  background: var(--choropleth-legend-bg);
  color: currentColor;
}

.choropleth-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
}

.choropleth-legend {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 13px;
  line-height: 1.2;
}

.choropleth-legend-title {
  font-weight: 600;
}

.choropleth-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.choropleth-legend-swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  display: inline-block;
}

.choropleth-legend-continuous {
  display: flex;
  flex-direction: column;
  width: 160px;
}

.choropleth-legend-gradient {
  height: 12px;
  border-radius: 2px;
}

.choropleth-legend-ticks {
  position: relative;
  height: 14px;
  margin-top: 4px;
  font-size: 11px;
  opacity: 0.7;
}

.choropleth-legend-ticks > span {
  position: absolute;
  transform: translateX(-50%);
}
</style>
