<script setup lang="ts">
import {
  computed,
  nextTick,
  ref,
  watch,
  onMounted,
  onUnmounted,
  toRaw,
  useSlots,
} from "vue";
import { geoPath, geoAlbersUsa, geoMercator } from "d3-geo";
import {
  zoom as d3Zoom,
  zoomIdentity,
  zoomTransform,
  type ZoomTransform,
} from "d3-zoom";
import { select } from "d3-selection";
// Side-effect import: enables `selection.transition()` on d3 selections so
// `applyFocus` can animate the zoom transform.
import "d3-transition";
import { feature, mesh, merge } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { formatNumber, type NumberFormat } from "@cfasim-ui/shared";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import type { ChartMenuItem } from "../ChartMenu/ChartMenu.vue";
import { saveSvg, savePng, saveCanvasPng } from "../ChartMenu/download.js";
import {
  buildScene,
  buildPicking,
  drawScene,
  drawHoverHighlight,
  pickIndexAt,
  type CanvasScene,
  type CanvasDrawState,
  type CanvasOverlayItem,
  type CanvasHighlightItem,
} from "./canvasLayer.js";
import {
  useChartFullscreen,
  isTouchDevice,
  ChartZoomControls,
  resolveColorToRgb,
  TITLE_FONT_SIZE,
  TITLE_LINE_HEIGHT,
  TITLE_FONT_WEIGHT,
  type TitleStyle,
  type LabelStyle,
} from "../_shared/index.js";
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

/**
 * A focused feature. Pass a plain string to focus a feature in the map's
 * current `geoType` with the default solid highlight, or an object to
 * specify a different `geoType` (drawn as an overlay on top of the base
 * map) and/or a `style`.
 */
export type FocusStyle = "solid" | "dashed" | "dotted";

export interface FocusItem {
  /** Feature id (FIPS code, HSA code) or name. */
  id: string;
  /** Defaults to the map's `geoType`. Cross-geoType items render as
   * non-interactive outlines on top of the base map. */
  geoType?: GeoType;
  /** Outline style. `"solid"` (default) matches the hover highlight;
   * `"dashed"` uses long dashes; `"dotted"` uses small round dots —
   * useful when stacking multiple outlines of different geoTypes. */
  style?: FocusStyle;
  /** Stroke color for the outline. In-place highlights (items in the
   * base geoType) default to pure black/white following the theme
   * (`light-dark(#000, #fff)`); cross-geoType overlay paths default to
   * `"#fff"`. */
  stroke?: string;
  /** Outline width in CSS px. Defaults to the map's stroke width + 1
   * for in-place highlights and + 1.5 for cross-geoType overlays. */
  strokeWidth?: number;
}

export type FocusValue = string | FocusItem | Array<string | FocusItem> | null;

const props = withDefaults(
  defineProps<{
    /** TopoJSON topology object (e.g. from us-atlas/states-10m.json or us-atlas/counties-10m.json).
     * Must contain a "states" object for geoType="states", or both "states" and "counties" objects
     * for geoType="counties" or geoType="hsas". */
    topology: Topology;
    data?: StateData[];
    /** Geographic type: "states" (default), "counties", or "hsas" (Health Service Areas) */
    geoType?: GeoType;
    /**
     * GeoType of the entries in `data`, if different from `geoType`. Lets
     * you color a county-level base map by HSA values (each county fills
     * with its parent HSA's value) or by state values, without changing
     * the rendered/interactive geometry. Supported combinations:
     * `counties` ← `hsas`, `counties` ← `states`, `hsas` ← `states`.
     * When unset, data ids must match the base `geoType`.
     */
    dataGeoType?: GeoType;
    /**
     * Scope the map to a single state: render only that state's outline with
     * its `counties` or `hsas` inside it (no surrounding states), and refit
     * the projection to zoom to it. Accepts a state name ("California") or a
     * 2-digit FIPS code ("06"). Requires a counties topology when `geoType`
     * is `"counties"` or `"hsas"`. If the value matches no state, the full
     * national map is rendered and a warning is logged.
     */
    state?: string;
    width?: number;
    height?: number;
    colorScale?: ChoroplethColorScale | ThresholdStop[] | CategoricalStop[];
    /**
     * Map title. `\n` in the string creates additional lines, each
     * adding `titleStyle.lineHeight` (default 18px) of vertical space.
     */
    title?: string;
    /** Styling for the map title. See `TitleStyle`. */
    titleStyle?: TitleStyle;
    /**
     * ARIA role for the map's root element. Defaults to `"figure"` when an
     * accessible name is present (from `ariaLabel` or `title`), so screen
     * readers announce the map as a labeled figure while its controls (menu,
     * reset) stay reachable. Pass `"img"` to expose it as a single image
     * (which hides the inner controls from assistive tech), or your own role.
     */
    role?: string;
    /**
     * Accessible name for the map, announced by screen readers via the root
     * element's `aria-label`. Defaults to the `title` prop. The individual
     * regions aren't exposed to assistive tech, so set this to a short summary
     * of what the map shows.
     */
    ariaLabel?: string;
    /** Styling for the legend (title, swatch labels, and continuous-scale ticks). */
    legendStyle?: LabelStyle;
    noDataColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    menu?: boolean | string;
    /** Show legend. Default: true */
    legend?: boolean;
    /** Title displayed next to the legend */
    legendTitle?: string;
    /**
     * Enable the activate-to-zoom interaction. Default `false` — the map
     * is fully static (tooltips and click-select still work, and
     * programmatic `focus` zoom still applies). When enabled, clicks and
     * taps still only select; the first *zoom* is what switches panning
     * on: desktop double-click (or the always-visible +/−/reset controls,
     * or a programmatic focus zoom) zooms in place, and on touch a double
     * tap expands the map to fill the window, where one finger pans,
     * pinch zooms, and a tap selects. The scroll wheel never zooms
     * inline, so the map can't hijack page scrolling.
     */
    zoom?: boolean;
    /**
     * Interaction style when `zoom` is enabled. `"activate"` (default)
     * keeps the map static until a double-click / tap / feature click, so
     * the page scrolls freely past it. `"scroll"` makes the map immediately
     * interactive — the wheel zooms, dragging pans, and touch gestures work
     * inline with no tap-to-expand step. Use it for full-page experiences
     * where the map is the main surface and there's no page scroll to
     * hijack.
     */
    zoomMode?: "activate" | "scroll";
    /**
     * On touch devices, expand the map to fill the window on a double
     * tap. Default `true`. Set `false` to zoom in place instead: a double
     * tap (or pinch) zooms the inline map on that point, after which
     * one-finger pan / pinch work and the +/−/reset controls render
     * inline. Single taps select in both modes. Note the zoomed in-place
     * map captures touch scrolling over it. No effect on desktop or when
     * `zoom` is off; `zoom-mode="scroll"` already implies inline
     * interaction.
     */
    touchExpand?: boolean;
    /**
     * Show the grey "Double click to zoom" / "Double tap to zoom"
     * affordance over the top of the map while the zoom gesture hasn't
     * been used yet. Default `true`; set `false` to hide it. No effect
     * when `zoom` is off.
     */
    zoomHint?: boolean;
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
     * Formatter for numeric values shown in the default tooltip. Accepts a
     * preset name, a printf-style format string, or a function. Ignored when
     * `tooltipFormat` is provided (the caller controls the entire tooltip in
     * that case). See `formatNumber` in `@cfasim-ui/shared`.
     */
    tooltipValueFormat?: NumberFormat;
    /**
     * Boundary for tooltip flip/clamp. `"none"` always places to the right of
     * the pointer with no clamping. `"chart"` (default) uses the map
     * container's bounding box. `"window"` uses the viewport.
     */
    tooltipClamp?: "none" | "chart" | "window";
    /**
     * Feature(s) to pan/zoom to. Accepts a feature id (FIPS code, HSA
     * code, or feature name), a `FocusItem` object, or an array of
     * either. `FocusItem` lets you pin features from a different
     * `geoType` than the base map (drawn as a non-interactive outline) or
     * pick a `style` ("solid" / "dashed"). All items contribute to the
     * zoom bounds. Pass `null` or an empty array to clear focus — the
     * current pan/zoom transform is preserved; only the highlight is
     * removed. Works with `v-model:focus`: clicking an unfocused feature
     * (in the base geoType) emits its id; clicking the focused feature
     * emits `null`. The built-in reset button clears focus *and* resets
     * the zoom. If a tooltip is configured, focusing a feature in the
     * base geoType shows its tooltip.
     */
    focus?: FocusValue;
    /** Scale factor applied when `focus` is set. Default: 4 */
    focusZoomLevel?: number;
    /**
     * Whether setting `focus` pans/zooms to fit the focused feature.
     * Default `true`. Set `false` to highlight (and draw cross-geoType
     * overlays) without changing the current pan/zoom — useful for a
     * click-to-select interaction where the map should stay put. The
     * built-in reset button is unaffected.
     */
    focusZoom?: boolean;
    /**
     * Rendering backend, fixed at mount. `"svg"` (default) keeps one DOM
     * path per feature — full assistive-tech fallback (per-feature
     * `<title>`) and SVG export. `"canvas"` paints every feature into a
     * single canvas: much faster for dense maps (counties, HSAs) and on
     * mobile WebKit, with identical interactions. In canvas mode the menu
     * offers PNG export only, and there is no per-feature fallback for
     * assistive tech — configure an interactive tooltip.
     */
    renderer?: "svg" | "canvas";
    /**
     * Where to teleport the map while expanded (the Expand menu item). A
     * CSS selector or element; defaults to `body`. Moving it to the
     * document root keeps `position: fixed` resolving against the viewport
     * instead of being trapped by an ancestor's `transform`/`filter`/
     * `contain`/`perspective` or stacking context. Set this when your app
     * doesn't mount at the document root.
     */
    fullscreenTarget?: string | HTMLElement;
  }>(),
  {
    geoType: "states",
    noDataColor: "#ddd",
    strokeColor: "#fff",
    strokeWidth: 0.5,
    menu: true,
    legend: true,
    zoom: false,
    renderer: "svg",
    zoomMode: "activate",
    touchExpand: true,
    zoomHint: true,
    tooltipClamp: "chart",
    focusZoomLevel: 4,
    focusZoom: true,
  },
);

// Accessible name for the whole map; falls back to the visible title.
const chartAriaLabel = computed(() => props.ariaLabel ?? props.title);
// Label the map as a figure when it has a name (keeps inner controls
// reachable, unlike role="img"). An explicit `role` prop always wins.
const chartRole = computed(
  () => props.role ?? (chartAriaLabel.value ? "figure" : undefined),
);

// The template root is a <Teleport>, so fallthrough attrs (class, style,
// data-*, id…) can't auto-inherit — forward them onto the wrapper manually.
defineOptions({ inheritAttrs: false });

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
// `mapGroupRef` is the zoom target. Inside it we split into two layers:
// `baseGroupRef` holds feature paths + the state-borders mesh and absorbs
// click/hover events, while `overlayGroupRef` holds focus overlay paths
// and always sits above so cross-geoType outlines never get covered by a
// hover-raised base path.
const mapGroupRef = ref<SVGGElement | null>(null);
const baseGroupRef = ref<SVGGElement | null>(null);
const overlayGroupRef = ref<SVGGElement | null>(null);
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

/**
 * Inline style for the legend container. Font properties cascade to
 * children (legend title, swatch labels, continuous-scale ticks).
 */
const legendInlineStyle = computed(() => {
  const s = props.legendStyle;
  const style: Record<string, string> = {};
  if (s?.fontSize != null) style["font-size"] = `${s.fontSize}px`;
  if (s?.fontWeight != null) style["font-weight"] = String(s.fontWeight);
  if (s?.color != null) style.color = s.color;
  return style;
});

/** Inline style for the title element, applying TitleStyle overrides. */
const titleInlineStyle = computed(() => {
  const s = props.titleStyle;
  const style: Record<string, string> = {
    "font-size": `${s?.fontSize ?? TITLE_FONT_SIZE}px`,
    "line-height": `${s?.lineHeight ?? TITLE_LINE_HEIGHT}px`,
    "font-weight": String(s?.fontWeight ?? TITLE_FONT_WEIGHT),
    "text-align": s?.align ?? "left",
    width: "100%",
  };
  if (s?.color) style.color = s.color;
  return style;
});
// Imperative path bookkeeping. Plain Maps rather than refs — Vue never reads
// these from a render scope, so mutating them does not trigger re-renders.
const pathsByFeatureId = new Map<string, SVGPathElement>();
const tooltipDataById = new Map<string, TooltipPayload>();
let bordersPathEl: SVGPathElement | null = null;
let hoveredEl: SVGPathElement | null = null;
// Paths currently styled as focused. Tracked separately from hover so the
// two states compose: hovering a focused path keeps the highlight on
// un-hover, and clearing focus while still hovering keeps the hover style.
// Maps each focused base-geoType path to the FocusItem that styled it so
// a repeat focus with different styling can re-apply without diffing the
// attribute set manually.
const focusedPathStyles = new Map<SVGPathElement, FocusItem>();
// Cross-geoType focus items render as standalone outline paths layered on
// top of the base map. Keyed by `${geoType}:${id}` so we can diff add /
// remove / restyle on each applyFocus. `strokeWidth` (visual CSS px) is
// kept alongside so applyStrokeScale can re-compensate custom widths.
const overlayPathEls = new Map<
  string,
  { el: SVGPathElement; strokeWidth?: number }
>();

// ─── Canvas renderer state (renderer="canvas") ───────────────────────────
// The svg stays as the transparent interaction/zoom surface; the canvas
// underneath paints the scene. Plain module state, mutated imperatively —
// same rationale as the path maps above.
const isCanvas = computed(() => props.renderer === "canvas");
const canvasRef = ref<HTMLCanvasElement | null>(null);
let scene: CanvasScene | null = null;
let pickingCanvas: HTMLCanvasElement | null = null;
let pickingCtx: CanvasRenderingContext2D | null = null;
let canvasHoveredId: string | null = null;
const canvasFocused = new Map<string, CanvasHighlightItem>();
let canvasOverlays: CanvasOverlayItem[] = [];
let redrawFrame = 0;
// xMidYMid-meet letterbox offsets (CSS px) inside the svg/canvas box,
// tracked by the resize observer alongside viewScale.
let meetOffsetX = 0;
let meetOffsetY = 0;

interface CanvasViewState {
  dpr: number;
  meetScale: number;
  offsetX: number;
  offsetY: number;
  zoom: { k: number; x: number; y: number };
}
let isZooming = false;
let tooltipObserver: ResizeObserver | null = null;
const lastTooltipSize = { width: 0, height: 0 };
let lastPointer: { x: number; y: number } | null = null;
let tooltipVisible = false;
let zoomBehavior: ReturnType<typeof d3Zoom<SVGSVGElement, unknown>> | null =
  null;
// True while the transform is away from identity.
const isZoomed = ref(false);
// Current zoom scale — drives the +/− buttons' disabled states and the
// stroke-width compensation in applyStrokeScale.
const scaleK = ref(1);
// How much the browser scales the canonical viewBox to fit the container
// (rendered CSS width / CANONICAL_WIDTH). Tracked by a ResizeObserver so
// stroke widths can stay visually constant without `vector-effect:
// non-scaling-stroke` (see applyStrokeScale).
const viewScale = ref(1);
// The first *zoom* is what activates the pan/zoom interaction — plain
// clicks/taps only select. Latched true the first time the transform
// leaves identity (double-click, double-tap/pinch zoom, +/− press, or a
// programmatic focus zoom) and sticky except in the inline touch flow,
// where reset restores the pre-zoom static mode by clearing it.
const hasZoomed = ref(false);
// `zoom-mode="scroll"`: no activation step at all — the map owns wheel,
// drag, and touch gestures from the start (for full-page experiences).
const isScrollMode = computed(() => props.zoomMode === "scroll");
// Inline touch gestures (one-finger pan, pinch-to-continue) go to the map
// instead of the page: always in scroll mode, and — with tap-to-expand
// opted out — once the first zoom has activated the interaction.
const touchGesturesInline = computed(
  () =>
    props.zoom &&
    (isScrollMode.value || (!props.touchExpand && hasZoomed.value)),
);
// rAF-throttled cursor coords for moveTooltip; we coalesce many mousemove
// events into one transform write per animation frame.
let pendingMoveX = 0;
let pendingMoveY = 0;
let pendingMoveFrame = 0;

// Touch tap-to-select. Touch devices get no synthesized-click guarantee
// (iOS treats the first tap on a hover target as a hover, and the d3-zoom
// touch listeners can swallow the synthetic click), so we resolve taps from
// the raw touch events ourselves. A gesture counts as a tap when a single
// finger lifts close to where it landed, soon after — anything longer or
// draggier is a pan/long-press and is left to d3-zoom.
const TAP_SLOP = 10; // px of movement allowed between touchstart and touchend
const TAP_MAX_MS = 600; // longer presses aren't taps
let tapStart: {
  x: number;
  y: number;
  time: number;
  featId: string | null;
} | null = null;

// Click/tap-vs-double: with the zoom interaction on, a click or tap can be
// the first half of a double-click/double-tap zoom, so selection defers by
// this window and the second click/tap cancels it.
const CLICK_SELECT_DELAY_MS = 250;
let pendingSelectTimer = 0;

// Double-tap detection for the inline touch map (the zoom gesture there).
// Two taps landing this close together within the select-defer window
// count as one double tap.
const DOUBLE_TAP_SLOP = 30;
let lastTap: { x: number; y: number; time: number } | null = null;

function setupInteraction() {
  const svg = svgRef.value;
  const g = mapGroupRef.value;
  if (!svg || !g) return;
  // Tap handling is wired on every device, on the svg itself so taps on the
  // map background (not just feature paths) can expand the touch map.
  // `touchend` is non-passive so a confirmed tap can preventDefault and
  // suppress the compatibility click/hover the browser would otherwise
  // synthesize (the double-fire and iOS first-tap-hover sources).
  // Must run before setupZoom(): d3-zoom stopImmediatePropagation()s
  // touch events once its filter passes, which would starve these.
  svg.addEventListener("touchstart", onTouchStart, { passive: true });
  svg.addEventListener("touchend", onTouchEnd);
  svg.addEventListener("touchcancel", onTouchCancel, { passive: true });
  // Continuous hover tracking stays off on touch (stroke-width churn
  // degrades zoom/pan); taps provide the one-shot hover + tooltip instead
  // (see touchHover).
  if (isTouchDevice()) return;
  if (isCanvas.value) {
    // No per-feature elements to delegate to — clicks resolve through the
    // picking canvas and hover through per-mousemove picking on the svg.
    svg.addEventListener("click", onDelegatedEvent);
    svg.addEventListener("mousemove", onCanvasMouseMove);
    svg.addEventListener("mouseleave", onCanvasMouseLeave);
    return;
  }
  g.addEventListener("click", onDelegatedEvent);
  g.addEventListener("mouseover", onDelegatedEvent);
  g.addEventListener("mousemove", onDelegatedMouseMove);
  g.addEventListener("mouseout", onDelegatedMouseOut);
}

function teardownInteraction() {
  const svg = svgRef.value;
  const g = mapGroupRef.value;
  if (svg) {
    svg.removeEventListener("touchstart", onTouchStart);
    svg.removeEventListener("touchend", onTouchEnd);
    svg.removeEventListener("touchcancel", onTouchCancel);
    svg.removeEventListener("click", onDelegatedEvent);
    svg.removeEventListener("mousemove", onCanvasMouseMove);
    svg.removeEventListener("mouseleave", onCanvasMouseLeave);
  }
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

// Tracks the svg's rendered width so applyStrokeScale can compensate
// stroke widths for the viewBox-to-CSS scale. Fires on container resizes
// only — cheap, and the map itself never relayouts on zoom/pan.
let svgResizeObserver: ResizeObserver | null = null;

onMounted(() => {
  // Order is load-bearing: once its filter passes (zoom activated /
  // expanded), d3-zoom calls stopImmediatePropagation() on touchstart and
  // touchend. Same-element listeners run in registration order, so our
  // tap listeners must be registered BEFORE d3-zoom's or taps (selection,
  // tooltips) go dead the moment the map owns touch gestures.
  setupInteraction();
  setupZoom();
  rebuildPaths();
  applyFocus();
  attachTooltipObserver();
  if (svgRef.value && typeof ResizeObserver !== "undefined") {
    svgResizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect?.width) return;
      // Replicate preserveAspectRatio="xMidYMid meet": a uniform scale to
      // fit, centered — the letterbox offsets matter in fullscreen, where
      // the svg box no longer matches the viewBox aspect ratio.
      const s = rect.height
        ? Math.min(rect.width / width.value, rect.height / height.value)
        : rect.width / width.value;
      viewScale.value = s;
      meetOffsetX = (rect.width - s * width.value) / 2;
      meetOffsetY = rect.height ? (rect.height - s * height.value) / 2 : 0;
      if (isCanvas.value) {
        const canvas = canvasRef.value;
        const svgEl = svgRef.value;
        if (canvas && svgEl) {
          // Pin the canvas over the svg box (the wrapper also contains the
          // in-flow header above the map). SVG elements have no offsetTop,
          // so derive the offset from the two bounding rects.
          const wrapRect = containerRef.value?.getBoundingClientRect();
          const svgRect = svgEl.getBoundingClientRect();
          canvas.style.top = `${svgRect.top - (wrapRect?.top ?? 0)}px`;
          canvas.style.left = `${svgRect.left - (wrapRect?.left ?? 0)}px`;
          canvas.style.width = `${rect.width}px`;
          canvas.style.height = `${rect.height}px`;
          const dpr =
            (typeof window !== "undefined" && window.devicePixelRatio) || 1;
          canvas.width = Math.max(1, Math.round(rect.width * dpr));
          canvas.height = Math.max(1, Math.round(rect.height * dpr));
        }
        requestRedraw();
      } else {
        applyStrokeScale();
      }
    });
    svgResizeObserver.observe(svgRef.value);
  }
  if (isCanvas.value) armDprListener();
  window.addEventListener("scroll", dismissOnViewportChange, {
    passive: true,
    capture: true,
  });
  window.addEventListener("resize", dismissOnViewportChange, { passive: true });
});

onUnmounted(() => {
  tooltipObserver?.disconnect();
  svgResizeObserver?.disconnect();
  dprQuery?.removeEventListener("change", onDprChange);
  if (pendingMoveFrame) cancelAnimationFrame(pendingMoveFrame);
  if (redrawFrame) cancelAnimationFrame(redrawFrame);
  window.clearTimeout(pendingSelectTimer);
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
  zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, maxScale.value])
    // d3-zoom swallows the click after any mousedown→mouseup movement
    // beyond this distance. The default of 0 makes clicks unreliable the
    // moment drag-pan is live (a pixel of hand jitter reads as a drag),
    // so allow a few pixels of slack.
    .clickDistance(6)
    .on("start", () => {
      isZooming = true;
    })
    .on("zoom", (event) => {
      // Cleared here, not on gesture start: a plain mousedown opens a
      // gesture once drag-pan is live, and hiding the tooltip on every
      // click press felt broken. The tooltip only needs to go once the
      // map actually moves under the cursor.
      clearHover();
      if (isCanvas.value) {
        // Frames blit + progressively sharpen via the render pipeline.
        requestRedraw();
      } else if (mapGroupRef.value) {
        mapGroupRef.value.setAttribute("transform", event.transform);
      }
      const t = event.transform;
      scaleK.value = t.k;
      applyStrokeScale();
      isZoomed.value = t.k !== 1 || t.x !== 0 || t.y !== 0;
      if (isZoomed.value) hasZoomed.value = true;
    })
    .on("end", () => {
      isZooming = false;
      // Sharpen after gestures: an idle-view frame starts a base refresh.
      if (isCanvas.value) requestRedraw();
    });

  // Dynamic filter deciding which pointer gestures d3-zoom may handle —
  // re-evaluated per event, so mode/activation changes never require
  // tearing down the zoom behavior. Programmatic `.transform()` calls
  // (focus zoom, the +/− controls, reset) bypass it entirely. Scroll mode
  // skips every gate; otherwise, per gesture:
  //  - wheel: only while the map fills the window (body scroll is locked
  //    there, so there's no page scroll to hijack);
  //  - dblclick: desktop's activation + zoom-in gesture (touch uses taps);
  //  - mousedown (drag-pan): once activated or while filling the window;
  //  - touchstart (pan/pinch): while filling the window, or inline once
  //    `touchGesturesInline` says the map owns touch gestures.
  zoomBehavior.filter((event) => {
    if (!props.zoom) return false;
    if (!isScrollMode.value) {
      const expanded = fullscreen.isFullscreen.value;
      switch (event.type) {
        case "wheel":
          if (!expanded) return false;
          break;
        case "dblclick":
          if (isTouchDevice()) return false;
          break;
        case "mousedown":
          if (!expanded && !hasZoomed.value) return false;
          break;
        case "touchstart":
          if (!expanded && !touchGesturesInline.value) {
            // In-place touch mode: a pinch (second finger) is itself the
            // zoom entry gesture; single-finger drags stay with the page
            // until the first zoom.
            const pinchEntry =
              !props.touchExpand &&
              props.zoomMode !== "scroll" &&
              (event as TouchEvent).touches.length >= 2;
            if (!pinchEntry) return false;
          }
          break;
      }
    }
    // Mirror d3-zoom's default rejections (ctrl-click, non-primary
    // buttons); ctrl+wheel is trackpad pinch, so it stays allowed.
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

// Resolved focus item: ties a user-supplied FocusItem to the actual
// GeoJSON feature it refers to plus a stable cross-geoType cache key.
interface ResolvedFocus {
  item: FocusItem;
  geoType: GeoType;
  feature: ChoroplethFeature;
  /** Stable key for overlay-path lifecycle: `${geoType}:${featureId}` */
  key: string;
}

function resolveFocusItems(items: FocusItem[]): ResolvedFocus[] {
  const lookups = featuresByGeoType.value;
  const nameLookups = nameToIdByGeoType.value;
  const out: ResolvedFocus[] = [];
  for (const item of items) {
    const geoType = item.geoType ?? props.geoType;
    const lookup = lookups.get(geoType);
    if (!lookup) continue;
    let f = lookup.get(item.id);
    if (!f) {
      // Name fallback in the item's own geoType.
      const id = nameLookups.get(geoType)?.get(item.id);
      if (id) f = lookup.get(id);
    }
    if (!f) continue;
    out.push({ item, geoType, feature: f, key: `${geoType}:${String(f.id)}` });
  }
  return out;
}

// Click-to-toggle uses only the base-geoType focus ids — clicks on
// overlay paths are blocked by pointer-events: none.
function focusedBaseIds(items: FocusItem[]): Set<string> {
  const out = new Set<string>();
  for (const r of resolveFocusItems(items)) {
    if (r.geoType === props.geoType) out.add(String(r.feature.id));
  }
  return out;
}

// Duration (ms) of focus zoom-in and Reset-button zoom-out transitions.
// Initial mount applies instantly; clearing focus is a no-op on the
// transform (the reset button is the only path back to identity).
const FOCUS_ANIM_MS = 450;
// Tracks whether applyFocus has been called once — initial mount apply
// is instant, subsequent focus-in calls animate.
let focusApplied = false;

function applyFocus() {
  if (!svgRef.value || !zoomBehavior) return;
  const resolved = resolveFocusItems(normalizedFocus.value);

  // Split into items that live in the base geoType (decorate the
  // existing path) and items that need their own overlay path.
  const baseResolved = resolved.filter((r) => r.geoType === props.geoType);
  const overlayResolved = resolved.filter((r) => r.geoType !== props.geoType);

  if (isCanvas.value) {
    // Canvas backend: highlights and overlays are just draw state.
    canvasFocused.clear();
    for (const r of baseResolved) {
      canvasFocused.set(String(r.feature.id), r.item);
    }
    const generator = pathGenerator.value;
    canvasOverlays = overlayResolved.flatMap((r) => {
      const d = generator(r.feature);
      if (!d) return [];
      return [
        {
          path: new Path2D(d),
          stroke: r.item.stroke ?? "#fff",
          strokeWidth: r.item.strokeWidth,
          style: r.item.style,
        },
      ];
    });
    requestRedraw();
  } else {
    // Diff base-geoType highlights, keyed by path element so we can
    // restyle on style change without churning unrelated paths.
    const nextBaseStyles = new Map<SVGPathElement, FocusItem>();
    for (const r of baseResolved) {
      const p = pathsByFeatureId.get(String(r.feature.id));
      if (p) nextBaseStyles.set(p, r.item);
    }
    for (const [p] of focusedPathStyles) {
      if (nextBaseStyles.has(p) || p === hoveredEl) continue;
      restoreDefaultStroke(p);
    }
    for (const [p, item] of nextBaseStyles) {
      const prev = focusedPathStyles.get(p);
      const unchanged =
        prev != null &&
        prev.style === item.style &&
        prev.stroke === item.stroke &&
        prev.strokeWidth === item.strokeWidth;
      if (unchanged && p !== hoveredEl) continue; // already styled
      if (p !== hoveredEl) applyHighlightStroke(p, item);
    }
    focusedPathStyles.clear();
    for (const [p, item] of nextBaseStyles) focusedPathStyles.set(p, item);

    // Cross-geoType outlines render as non-interactive paths on top of
    // the base layer.
    syncOverlayPaths(overlayResolved);
  }

  // Clearing focus doesn't touch the zoom transform — the user keeps
  // whatever pan/zoom they had. Only the reset button snaps back to
  // identity. Drop the highlight + tooltip and we're done.
  if (resolved.length === 0) {
    focusApplied = true;
    clearHover();
    return;
  }

  // Highlight-only mode: the strokes + overlays above are applied; skip the
  // pan/zoom transform so the current view stays put (click-to-select).
  if (props.focusZoom === false) {
    focusApplied = true;
    return;
  }

  const svg = select(svgRef.value);
  // Always cancel any in-flight transition first — d3-transition queues
  // same-named transitions rather than replacing them, so rapid focus
  // changes would otherwise chain animations end-to-end.
  svg.interrupt();
  // First apply (initial mount) is instant; subsequent focus-in animates.
  const animate = focusApplied;
  focusApplied = true;

  // Combined bounding box over every resolved feature (regardless of
  // geoType) so multi-layer focus zooms to fit them all.
  const [[x0, y0], [x1, y1]] = pathGenerator.value.bounds({
    type: "FeatureCollection",
    features: resolved.map((r) => r.feature),
  });
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const k = props.focusZoomLevel;
  const target = zoomIdentity
    .translate(width.value / 2 - k * cx, height.value / 2 - k * cy)
    .scale(k);

  // Tooltip target: prefer the first base-geoType item (overlay paths
  // are non-interactive and don't carry tooltip data). Falls back to
  // skipping the tooltip entirely when only overlays are focused.
  const tooltipTarget = baseResolved[0]?.feature ?? null;
  const showFocusTooltip = () => {
    if (!hasInteractiveTooltip.value || !tooltipTarget) return;
    const firstId = String(tooltipTarget.id);
    // Read positions *after* the transform commits so the tooltip lands
    // at the focused feature's on-screen position.
    if (isCanvas.value) {
      const anchor = featureClientAnchor(firstId);
      if (anchor) showTooltip(firstId, anchor.x, anchor.y);
      return;
    }
    const pathEl = pathsByFeatureId.get(firstId);
    if (!pathEl) return;
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

function syncOverlayPaths(items: ResolvedFocus[]) {
  const g = overlayGroupRef.value;
  if (!g) return;

  const nextKeys = new Set(items.map((i) => i.key));
  for (const [key, entry] of overlayPathEls) {
    if (!nextKeys.has(key)) {
      entry.el.remove();
      overlayPathEls.delete(key);
    }
  }

  const generator = pathGenerator.value;
  // Overlay strokes need extra weight: they paint on top of the base map
  // and the (optional) state-borders mesh, so a stroke that matches the
  // in-place focused base path's weight would visually merge with the
  // layers underneath. The default width lives on the overlay *group*;
  // per-item `strokeWidth` overrides are written per path — both
  // compensated by applyStrokeScale.
  for (const { item, feature: f, key } of items) {
    let entry = overlayPathEls.get(key);
    if (!entry) {
      const el = document.createElementNS(SVG_NS, "path") as SVGPathElement;
      el.setAttribute("d", generator(f) ?? "");
      el.setAttribute("fill", "none");
      el.setAttribute("pointer-events", "none");
      el.setAttribute("stroke-linejoin", "round");
      el.setAttribute("class", "focus-overlay");
      g.appendChild(el);
      entry = { el };
      overlayPathEls.set(key, entry);
    }
    entry.strokeWidth = item.strokeWidth;
    // White contrasts cleanly against the (typically dark) data-colored
    // fill; callers can override per-item via `FocusItem.stroke`.
    entry.el.setAttribute("stroke", item.stroke ?? "#fff");
    applyDasharray(entry.el, item.style);
  }
  applyStrokeScale();
}

function resetZoom() {
  if (!svgRef.value || !zoomBehavior) return;
  // Reset both the zoom transform AND any active focus. The watcher's
  // applyFocus call (post-flush) only tears down the highlight strokes
  // now; this transition handles the actual zoom-out animation.
  if (normalizedFocus.value.length > 0) emit("update:focus", null);
  const svg = select(svgRef.value);
  svg.interrupt();
  hideTooltip();
  // In the inline touch flow (no tap-to-expand step), reset restores the
  // pre-zoom mode: once the zoom-out lands, deactivate so the page gets
  // touch scrolling back and the zoom hint returns. Desktop stays
  // activated (sticky), and inside fullscreen the ✕ handles leaving.
  const deactivate =
    isTouchDevice() && !fullscreen.isFullscreen.value && !isScrollMode.value;
  const transition = svg
    .transition()
    .duration(FOCUS_ANIM_MS)
    .call(zoomBehavior.transform, zoomIdentity);
  if (deactivate) {
    transition.on("end", () => {
      hasZoomed.value = false;
    });
  }
}

// Ceiling always spans focusZoomLevel and at least the standard 12× so the
// user can zoom further in/out of a focused view. Programmatic
// `.transform()` calls are clamped to this range too.
const maxScale = computed(() => Math.max(12, props.focusZoomLevel));

// Scale factor per +/− press and per desktop double-click (d3's built-in).
const ZOOM_STEP = 2;

// The +/−/reset controls — only ever shown while zooming is enabled. On
// desktop they're always present (pressing + is itself an activation
// path). On touch they render inline only when the inline map is (or can
// become) interactive (scroll mode / in-place tap zoom), plus always in
// the expanded view. With `zoom: false` the map never shows them; a
// parent driving `focus` owns its own way back.
const showZoomControls = computed(
  () =>
    props.zoom &&
    (isTouchDevice()
      ? fullscreen.isFullscreen.value ||
        isScrollMode.value ||
        !props.touchExpand
      : true),
);

// Drag-pan cursor affordance — desktop only, once drag-pan is available.
const isPannable = computed(
  () =>
    props.zoom &&
    !isTouchDevice() &&
    (isScrollMode.value || hasZoomed.value || fullscreen.isFullscreen.value),
);

// Grey affordance line shown while the zoom gesture is still the way in:
// on desktop until the first zoom (the controls take over from there), on
// touch whenever the inline map is showing (with tap-to-expand) or until
// the first in-place zoom (without). Never while fullscreen or in scroll
// mode — those are already interactive.
const showZoomHint = computed(
  () =>
    props.zoom &&
    props.zoomHint &&
    !isScrollMode.value &&
    !fullscreen.isFullscreen.value &&
    ((isTouchDevice() && props.touchExpand) || !hasZoomed.value),
);
const zoomHintText = computed(() =>
  isTouchDevice() ? "Double tap to zoom" : "Double click to zoom",
);

// Inline style for the map svg. `touch-action: none` hands pan/pinch to
// d3-zoom (and blocks scroll chaining) wherever touch gestures belong to
// the map. `will-change: transform` gives the svg its own compositor
// layer while the interaction is live — without it WebKit repaints the
// surrounding page layer on every zoom/pan frame (~10× slower on iOS).
// Scoped to active maps so a page of static maps doesn't pay a raster
// layer apiece.
const svgStyle = computed(() => {
  const style: Record<string, string> = {};
  if (fullscreen.isFullscreen.value || touchGesturesInline.value) {
    style["touch-action"] = "none";
  } else if (props.zoom && !isScrollMode.value && isTouchDevice()) {
    // Inline, pre-zoom: keep page panning but claim the zoom gestures.
    // `manipulation` suppresses the browser's double-tap zoom (the expand
    // gesture); in-place mode also blocks browser pinch-zoom so a pinch
    // reaches d3-zoom as the entry gesture.
    style["touch-action"] = props.touchExpand ? "manipulation" : "pan-x pan-y";
  }
  if (
    hasZoomed.value ||
    fullscreen.isFullscreen.value ||
    (props.zoom && (isScrollMode.value || isTouchDevice()))
  ) {
    // Touch maps get the layer up front, not just once zoomed: a tap
    // restyles a feature path, and without the layer WebKit repaints the
    // surrounding page layer (~200ms per mutation on the HSA map — taps
    // felt sluggish inline while fullscreen, already layered, was fast).
    style["will-change"] = "transform";
  }
  return Object.keys(style).length ? style : undefined;
});

function zoomBy(factor: number) {
  if (!svgRef.value || !zoomBehavior) return;
  const svg = select(svgRef.value);
  svg.interrupt();
  hideTooltip();
  // scaleBy centers on the viewBox extent's midpoint; scaleExtent clamps.
  svg.transition().duration(250).call(zoomBehavior.scaleBy, factor);
}

// Zoom level a tap zooms to (expanding or in place).
const TAP_ZOOM_SCALE = 2;

// client → canonical viewBox coordinates via the svg's CTM (which covers
// viewBox scaling, letterboxing, and pinch-zoom quirks). Falls back to a
// rect-proportional mapping when the CTM is unavailable (non-rendering
// test DOMs).
function clientToViewBox(
  clientX: number,
  clientY: number,
): [number, number] | null {
  const svgEl = svgRef.value;
  if (!svgEl) return null;
  let ctm: DOMMatrix | null = null;
  try {
    ctm = svgEl.getScreenCTM();
  } catch {
    ctm = null;
  }
  if (ctm) {
    const inv = ctm.inverse();
    return [
      inv.a * clientX + inv.c * clientY + inv.e,
      inv.b * clientX + inv.d * clientY + inv.f,
    ];
  }
  const rect = svgEl.getBoundingClientRect();
  const sx = rect.width ? width.value / rect.width : 1;
  const sy = rect.height ? height.value / rect.height : 1;
  return [(clientX - rect.left) * sx, (clientY - rect.top) * sy];
}

// Target transform for a tap: TAP_ZOOM_SCALE× centered on the tapped
// point. Falls back to the map center when the point can't be resolved.
function tapZoomTransform(clientX: number, clientY: number): ZoomTransform {
  const svgEl = svgRef.value!;
  const k = TAP_ZOOM_SCALE;
  let mx = width.value / 2;
  let my = height.value / 2;
  const p = clientToViewBox(clientX, clientY);
  if (p) [mx, my] = zoomTransform(svgEl).invert(p);
  return zoomIdentity
    .translate(width.value / 2 - k * mx, height.value / 2 - k * my)
    .scale(k);
}

function animateZoomTo(target: ZoomTransform) {
  if (!svgRef.value || !zoomBehavior) return;
  const svg = select(svgRef.value);
  svg.interrupt();
  svg.transition().duration(FOCUS_ANIM_MS).call(zoomBehavior.transform, target);
}

// Tap on the inline touch map: expand to fill the window, then zoom in
// centered on the tapped point once the expanded layout has committed.
function enterTouchZoom(clientX: number, clientY: number) {
  if (!svgRef.value || !zoomBehavior) return;
  // Resolve the tapped point to map coords before the layout changes.
  const target = tapZoomTransform(clientX, clientY);
  fullscreen.enter();
  nextTick(() => animateZoomTo(target));
}

// `touchExpand: false`: the first tap zooms the inline map in place
// instead of expanding it (the touch analogue of desktop double-click).
function zoomInPlaceAt(clientX: number, clientY: number) {
  if (!svgRef.value || !zoomBehavior) return;
  animateZoomTo(tapZoomTransform(clientX, clientY));
}

// `focusZoomLevel` only affects scaleExtent + the next focus apply. The
// d3-zoom filter reads `props.zoom` and the activation state dynamically,
// so we don't need to tear down zoom on those changes.
watch(
  () => props.focusZoomLevel,
  () => {
    if (zoomBehavior) {
      zoomBehavior.scaleExtent([1, maxScale.value]);
    }
    applyFocus();
  },
);

// Switching the scoped `state` refits the projection to a different region,
// so any leftover pan/zoom transform would leave the new map off-center.
// Reset it instantly (no animation) when the region changes.
watch(
  () => props.state,
  () => {
    if (!svgRef.value || !zoomBehavior) return;
    const svg = select(svgRef.value);
    svg.interrupt();
    zoomBehavior.transform(svg, zoomIdentity);
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

type StateFeature = GeoJSON.Feature<GeoJSON.Geometry | null, { name?: string }>;

// ─── Single-state scoping (`state` prop) ─────────────────────────────────
//
// Resolved directly from the topology's `states` object (not from
// featuresByGeoType) so it stays free of the featuresGeo → featuresById →
// featuresByGeoType chain — that chain reads `stateFips`, so depending on it
// here would form a reactive cycle.
const statesFeatures = computed<StateFeature[]>(() => {
  const topo = toRaw(props.topology) as unknown as {
    objects?: { states?: NamedGeometry };
  };
  const statesObj = topo?.objects?.states;
  if (!statesObj) return [];
  const fc = feature(topo as unknown as Topology, statesObj) as
    | GeoJSON.FeatureCollection<GeoJSON.Geometry | null, { name?: string }>
    | StateFeature;
  return fc.type === "FeatureCollection" ? fc.features : [fc];
});

// 2-digit FIPS for the active `state` prop, or null when unset/unresolved.
const stateFips = computed<string | null>(() => {
  const s = props.state?.trim();
  if (!s) return null;
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0");
  const match = statesFeatures.value.find((f) => f.properties?.name === s);
  return match?.id != null ? String(match.id).padStart(2, "0") : null;
});

// The single state's GeoJSON feature — drives the outline path and the
// projection fit in single-state mode.
const stateOutlineFeature = computed<StateFeature | null>(() => {
  const fips = stateFips.value;
  if (!fips) return null;
  return (
    statesFeatures.value.find((f) => String(f.id).padStart(2, "0") === fips) ??
    null
  );
});

watch(
  () => [props.state, stateFips.value] as const,
  ([state, fips]) => {
    if (state && state.trim() && !fips) {
      console.warn(
        `[ChoroplethMap] state="${state}" matched no state name or FIPS code; rendering the full map.`,
      );
    }
  },
  { immediate: true },
);

// HSA mapping is loaded lazily — it's ~25KB gzipped and only needed when
// geoType or dataGeoType is "hsas". Keeps the main bundle small for users
// who only need states/counties maps.
type HsaModule = typeof import("./hsaMapping.js");
const hsaModule = ref<HsaModule | null>(null);
let hsaModulePromise: Promise<HsaModule> | null = null;
function loadHsaModule() {
  if (!hsaModulePromise) {
    hsaModulePromise = import("./hsaMapping.js").then((m) => {
      hsaModule.value = m;
      return m;
    });
  }
  return hsaModulePromise;
}
watch(
  () => {
    if (props.geoType === "hsas" || props.dataGeoType === "hsas") return true;
    const focus = props.focus;
    if (!focus) return false;
    const items = Array.isArray(focus) ? focus : [focus];
    return items.some((f) => typeof f !== "string" && f.geoType === "hsas");
  },
  (needsHsa) => {
    if (needsHsa) loadHsaModule();
  },
  { immediate: true },
);

const hsaFeaturesGeo = computed(() => {
  const mod = hsaModule.value;
  if (!mod) return { type: "FeatureCollection" as const, features: [] };
  const { fipsToHsa, hsaNames } = mod;
  const topo = toRaw(props.topology) as unknown as CountiesTopo;
  const countyGeometries = topo.objects.counties.geometries;
  const scopeFips = stateFips.value;
  const groups = new Map<string, typeof countyGeometries>();

  for (const geom of countyGeometries) {
    const fips = String(geom.id).padStart(5, "0");
    // Single-state mode: drop counties outside the state before grouping, so
    // the resulting HSAs only cover the selected state.
    if (scopeFips && fips.slice(0, 2) !== scopeFips) continue;
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
  // hsaFeaturesGeo already honors `state` (it scopes the source counties).
  if (props.geoType === "hsas") return hsaFeaturesGeo.value;
  const scopeFips = stateFips.value;
  if (props.geoType === "counties") {
    const topo = toRaw(props.topology) as unknown as CountiesTopo;
    const fc = feature(topo, topo.objects.counties);
    if (!scopeFips) return fc;
    return {
      type: "FeatureCollection" as const,
      features: fc.features.filter(
        (f) => String(f.id).padStart(5, "0").slice(0, 2) === scopeFips,
      ),
    };
  }
  const topo = toRaw(props.topology) as unknown as StatesTopo;
  const fc = feature(topo, topo.objects.states);
  if (!scopeFips) return fc;
  return {
    type: "FeatureCollection" as const,
    features: fc.features.filter(
      (f) => String(f.id).padStart(2, "0") === scopeFips,
    ),
  };
});

const stateBordersPath = computed(() => {
  if (props.geoType !== "counties" && props.geoType !== "hsas") return null;
  // Single-state mode: trace just the selected state's outline instead of
  // the full national state-border mesh.
  if (stateFips.value) return stateOutlineFeature.value;
  const topo = toRaw(props.topology) as unknown as CountiesTopo;
  return mesh(topo, topo.objects.states, (a, b) => a !== b);
});

// Breathing room (canonical px) around a single state so its outline isn't
// flush against the SVG edge. Only applied in single-state mode.
const STATE_FIT_INSET = 12;

const projection = computed(() => {
  const outline = stateOutlineFeature.value;
  if (stateFips.value && outline) {
    const extent: [[number, number], [number, number]] = [
      [STATE_FIT_INSET, STATE_FIT_INSET],
      [width.value - STATE_FIT_INSET, height.value - STATE_FIT_INSET],
    ];
    const albers = geoAlbersUsa().fitExtent(extent, outline);
    // geoAlbersUsa only covers the 50 states + DC (it handles Alaska and
    // Hawaii via insets). The island territories — Puerto Rico, Guam, the
    // US Virgin Islands, American Samoa, the N. Mariana Islands — fall
    // outside it and project to null, so fitExtent yields a NaN transform
    // and every path renders as "MNaN,NaN…". Detect that by projecting the
    // outline's centroid and fall back to a plain Mercator that can render
    // any region.
    const c = geoPath(albers).centroid(outline);
    if (Number.isFinite(c[0]) && Number.isFinite(c[1])) return albers;
    return geoMercator().fitExtent(extent, outline);
  }
  return geoAlbersUsa().fitExtent(
    [
      [0, 0],
      [width.value, height.value],
    ],
    featuresGeo.value,
  );
});

const pathGenerator = computed(() => geoPath(projection.value));

const effectiveStrokeWidth = computed(() =>
  props.geoType === "counties" || props.geoType === "hsas"
    ? props.strokeWidth * 0.5
    : props.strokeWidth,
);

// Per-geoType name → id index, mirroring featuresByGeoType. Drives the
// "pass a feature name instead of an id" fallback for both `data` (with
// dataGeoType applied) and `focus` (where each FocusItem can specify its
// own geoType). O(features) per geoType, computed once per topology change.
const nameToIdByGeoType = computed(() => {
  const map = new Map<GeoType, Map<string, string>>();
  for (const [gt, lookup] of featuresByGeoType.value) {
    const m = new Map<string, string>();
    for (const [id, f] of lookup) {
      if (f.properties?.name != null) m.set(f.properties.name, id);
    }
    map.set(gt, m);
  }
  return map;
});

// Maps a base feature id to the id it should look up in `dataMap` under
// the active `dataGeoType`. Supports county→hsa (via fipsToHsa), county→
// state (FIPS prefix), and hsa→state (HSA-code prefix). Returns the id
// unchanged when dataGeoType is unset or equal to the base geoType.
function baseToDataId(baseId: string): string | undefined {
  const dataGt = props.dataGeoType;
  if (!dataGt || dataGt === props.geoType) return baseId;
  if (props.geoType === "counties" && dataGt === "hsas") {
    return hsaModule.value?.fipsToHsa[baseId];
  }
  if (props.geoType === "counties" && dataGt === "states") {
    return baseId.slice(0, 2);
  }
  if (props.geoType === "hsas" && dataGt === "states") {
    return baseId.slice(0, 2);
  }
  // Other combinations (e.g. coloring HSAs by per-county data) require
  // aggregation rules we haven't specified — silently treat as no data.
  return undefined;
}

// id → feature lookup used by `applyFocus`. Cached so focus changes don't
// trigger a linear scan through 3k+ features per apply.
const featuresById = computed(() => {
  const m = new Map<string, ChoroplethFeature>();
  for (const f of featuresGeo.value.features) {
    if (f.id != null) m.set(String(f.id), f as ChoroplethFeature);
  }
  return m;
});

// Normalized array form of `props.focus`. Bare strings collapse into
// `{ id }` so downstream code only has to deal with FocusItem objects.
const normalizedFocus = computed<FocusItem[]>(() => {
  const f = props.focus;
  if (f == null) return [];
  const arr = Array.isArray(f) ? f : [f];
  return arr.map((x) => (typeof x === "string" ? { id: x } : x));
});

// Per-geoType feature lookups. Populated for any geoType the topology
// supports (states-only topology → just "states"; counties topology →
// all three, with HSAs derived via the FIPS→HSA mapping). Used by
// resolveFocusItems so a single focus call can mix geoTypes.
const featuresByGeoType = computed(() => {
  const map = new Map<GeoType, Map<string, ChoroplethFeature>>();
  // The base geoType is always represented — reuse the existing lookup.
  map.set(props.geoType, featuresById.value);

  const topo = toRaw(props.topology) as unknown as {
    objects?: { states?: NamedGeometry; counties?: NamedGeometry };
  };
  const objs = topo?.objects;
  if (!objs) return map;

  type AnyFeature = GeoJSON.Feature<GeoJSON.Geometry | null>;
  const indexFeatures = (feats: AnyFeature[]) => {
    const m = new Map<string, ChoroplethFeature>();
    for (const f of feats) {
      if (f.id != null) m.set(String(f.id), f as ChoroplethFeature);
    }
    return m;
  };

  if (!map.has("states") && objs.states) {
    const fc = feature(topo as unknown as Topology, objs.states);
    map.set(
      "states",
      indexFeatures(
        (fc as GeoJSON.FeatureCollection<GeoJSON.Geometry | null>).features,
      ),
    );
  }
  if (!map.has("counties") && objs.counties) {
    const fc = feature(topo as unknown as Topology, objs.counties);
    map.set(
      "counties",
      indexFeatures(
        (fc as GeoJSON.FeatureCollection<GeoJSON.Geometry | null>).features,
      ),
    );
  }
  if (!map.has("hsas") && objs.counties) {
    map.set("hsas", indexFeatures(hsaFeaturesGeo.value.features));
  }
  return map;
});

const dataMap = computed(() => {
  const map = new Map<string, number | string>();
  if (!props.data) return map;
  // Name fallback resolves in whichever geoType the data is keyed by.
  const dataGt = props.dataGeoType ?? props.geoType;
  const nameIdx = nameToIdByGeoType.value.get(dataGt);
  for (const d of props.data) {
    map.set(d.id, d.value);
    const fid = nameIdx?.get(d.id);
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

// Unresolvable endpoint colors fall back to the default scale endpoints.
function interpolateColor(t: number): string {
  const [r1, g1, b1] = resolveColorToRgb(minColor.value) ?? [229, 240, 250];
  const [r2, g2, b2] = resolveColorToRgb(maxColor.value) ?? [8, 81, 156];
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

/** Looks up the data value for a base feature id, honoring `dataGeoType`. */
function valueFor(baseId: string): number | string | undefined {
  const dataId = baseToDataId(baseId);
  return dataId == null ? undefined : dataMap.value.get(dataId);
}

/** Single color-resolution path. Returns the noData color for missing rows. */
function colorFor(id: string): string {
  const value = valueFor(id);
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
  if (typeof value === "number" && props.tooltipValueFormat !== undefined) {
    return formatNumber(value, props.tooltipValueFormat);
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
//   3. mousemove  → rAF-throttled; re-runs the same flip/clamp placement as
//      the initial hover (direct DOM write of transform, no reactivity).
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
  // Safari reports client coordinates (events AND element rects) in
  // visual-viewport space, while position: fixed resolves against the
  // layout viewport — under page pinch-zoom the tooltip lands offset from
  // its target (typically "too high" by the pan offset). Rather than
  // sniffing engines, self-calibrate: re-measure where the tooltip
  // actually landed — the rect comes back in the same client space as the
  // target coords — and shift by the residual. Chrome measures ~0.
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  if (!vv || (vv.scale <= 1.01 && vv.offsetTop < 1 && vv.offsetLeft < 1)) {
    return;
  }
  const actual = el.getBoundingClientRect();
  const dx = actual.left - left;
  const dy = actual.top + actual.height / 2 - top;
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
    el.style.transform = `translate3d(${left - dx}px, ${top - dy}px, 0) translateY(-50%)`;
  }
}

// The expanded touch view swaps the pointer-anchored tooltip for a bottom
// sheet: floating fixed positioning is unreliable there (Safari reports
// touch/rect coordinates in visual-viewport space once the page is
// pinch-zoomed), while a sheet pinned to the wrapper is always right.
const tooltipMode = computed<"float" | "sheet">(() =>
  fullscreen.isFullscreen.value && isTouchDevice() ? "sheet" : "float",
);

function showTooltip(featId: string, clientX: number, clientY: number) {
  const data = tooltipDataById.get(featId);
  if (!data) return;
  const child = tooltipChildRef.value;
  if (!child) return;
  child.setData(data);
  tooltipVisible = true;
  if (tooltipMode.value === "sheet") {
    child.setOpen(true);
    return;
  }
  const el = child.getEl();
  if (!el) return;
  lastPointer = { x: clientX, y: clientY };
  applyTooltipPosition(clientX, clientY);
  el.style.visibility = "visible";
}

function moveTooltip(clientX: number, clientY: number) {
  if (!tooltipVisible || tooltipMode.value === "sheet") return;
  pendingMoveX = clientX;
  pendingMoveY = clientY;
  if (pendingMoveFrame) return;
  pendingMoveFrame = requestAnimationFrame(() => {
    pendingMoveFrame = 0;
    if (!tooltipVisible) return;
    lastPointer = { x: pendingMoveX, y: pendingMoveY };
    // Re-run the same flip/clamp as the initial hover. This is already
    // rAF-coalesced (at most once per frame), so the flip/clamp cost is
    // negligible. Hardcoding the right side here instead made the tooltip
    // ignore the boundary while moving and fight showTooltip's per-feature
    // flip on dense maps (the tooltip appeared to switch sides).
    applyTooltipPosition(pendingMoveX, pendingMoveY);
  });
}

function hideTooltip() {
  if (!tooltipVisible) return;
  tooltipVisible = false;
  lastPointer = null;
  tooltipChildRef.value?.setOpen(false);
  const el = tooltipChildRef.value?.getEl();
  if (el) el.style.visibility = "hidden";
}

/**
 * Sets `stroke-dasharray` (and `stroke-linecap` for round dots) on a
 * path element to match the requested FocusStyle. Used both for
 * highlighted base paths and for cross-geoType overlay paths.
 */
function applyDasharray(el: SVGPathElement, style?: FocusStyle) {
  if (style === "dashed") {
    // Long dash + short gap so the pattern reads clearly even when the
    // overlay is painted on top of a similarly-colored parent-border
    // mesh.
    el.setAttribute("stroke-dasharray", "8 4");
    el.removeAttribute("stroke-linecap");
  } else if (style === "dotted") {
    // 0-length dashes with round caps render as evenly-spaced dots.
    el.setAttribute("stroke-dasharray", "0 5");
    el.setAttribute("stroke-linecap", "round");
  } else {
    el.removeAttribute("stroke-dasharray");
    el.removeAttribute("stroke-linecap");
  }
}

// ─── Stroke-width compensation (no `vector-effect`) ──────────────────────
//
// WebKit renders `vector-effect: non-scaling-stroke` across thousands of
// paths dramatically slowly (the docs page dropped to ~3fps on iOS), so
// visual stroke widths are compensated by hand instead: a width of `w`
// CSS px is written as `w / (zoom scale × viewBox-to-CSS scale)`. Base
// feature paths inherit one group-level width; only the borders mesh,
// focus overlays (via their group), and highlighted paths carry their own.

/** Divisor turning a visual CSS-px width into an attribute width. */
function strokeDivisor(): number {
  return scaleK.value * viewScale.value || 1;
}

// Highlight (hover + focus) outline color: pure black on light, pure
// white on dark, following the theme's color-scheme (the same
// light-dark() mechanism the theme tokens use). Applied via inline style
// — SVG presentation attributes don't parse CSS functions.
const HIGHLIGHT_STROKE = "light-dark(#000, #fff)";

/** Visual outline width for an in-place highlight (hover or focus). */
function highlightWidthFor(item?: FocusItem): number {
  return item?.strokeWidth ?? effectiveStrokeWidth.value + 1;
}

// ─── Canvas renderer: redraw, picking, tooltip anchors ───────────────────

function canvasHighlightColor(): string {
  // light-dark() isn't paintable on a canvas context; resolve it through
  // the shared probe. (Cached by input — a mid-session theme flip keeps
  // the first resolution until remount, same tradeoff as resolveColorToRgb
  // elsewhere.)
  const rgb = resolveColorToRgb(HIGHLIGHT_STROKE);
  return rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : "#000";
}

function currentCanvasView(): CanvasViewState {
  const t = zoomTransform(svgRef.value!);
  return {
    dpr: (typeof window !== "undefined" && window.devicePixelRatio) || 1,
    meetScale: viewScale.value,
    offsetX: meetOffsetX,
    offsetY: meetOffsetY,
    zoom: { k: t.k, x: t.x, y: t.y },
  };
}

function canvasDrawState(): CanvasDrawState {
  return {
    strokeColor: props.strokeColor,
    strokeWidth: effectiveStrokeWidth.value,
    highlightStroke: canvasHighlightColor(),
    hoveredId: canvasHoveredId,
    focused: canvasFocused,
    overlays: canvasOverlays,
  };
}

// Direct rendering with an adaptive buffered fallback. With the canvas on
// its own compositor layer and feature outlines stroked as one path, a
// full county-scale pass rasters in single-digit milliseconds, so every
// frame renders the whole scene crisply. If a device proves slower (two
// consecutive full draws over SLOW_FRAME_MS), gesture frames fall back to
// blitting the last crisp render, refreshed at least every
// GESTURE_REFRESH_MS, and always sharpened at rest.
const SLOW_FRAME_MS = 24;
const GESTURE_REFRESH_MS = 350;
let slowDrawStreak = 0;
let fastDrawStreak = 0;
let rendererIsSlow = false;
// Canvas backing stores are sized in device pixels, and ResizeObserver
// doesn't fire when the window moves to a display with a different
// devicePixelRatio. Watch a resolution media query instead — it matches
// only the current DPR, so each change re-arms a fresh query (the
// standard trick), resizes the backing store, and redraws.
let dprQuery: MediaQueryList | null = null;

function armDprListener() {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return;
  }
  dprQuery?.removeEventListener("change", onDprChange);
  dprQuery = window.matchMedia(
    `(resolution: ${window.devicePixelRatio || 1}dppx)`,
  );
  dprQuery.addEventListener("change", onDprChange);
}

function onDprChange() {
  armDprListener();
  const canvas = canvasRef.value;
  const svgEl = svgRef.value;
  if (!isCanvas.value || !canvas || !svgEl) return;
  const rect = svgEl.getBoundingClientRect();
  if (rect.width) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
  }
  requestRedraw();
}

let snapshotCanvas: HTMLCanvasElement | null = null;
let snapshotView: CanvasViewState | null = null;
let lastFullDrawAt = 0;

function blitSnapshot(
  ctx: CanvasRenderingContext2D,
  view: CanvasViewState,
  img: HTMLCanvasElement,
  imgView: CanvasViewState,
) {
  const off = (v: CanvasViewState, axis: "x" | "y") =>
    v.dpr *
    ((axis === "x" ? v.offsetX : v.offsetY) +
      v.meetScale * (axis === "x" ? v.zoom.x : v.zoom.y));
  const r =
    (view.dpr * view.meetScale * view.zoom.k) /
    (imgView.dpr * imgView.meetScale * imgView.zoom.k);
  ctx.setTransform(
    r,
    0,
    0,
    r,
    off(view, "x") - r * off(imgView, "x"),
    off(view, "y") - r * off(imgView, "y"),
  );
  ctx.drawImage(img, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function drawNow() {
  const display = canvasRef.value;
  if (!display) return;
  const ctx = display.getContext("2d");
  if (!ctx) return;
  const now = () =>
    typeof performance !== "undefined" ? performance.now() : 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, display.width, display.height);
  if (!scene) return;
  const view = currentCanvasView();

  // Slow-device fallback: blit between throttled crisp refreshes while a
  // gesture is live.
  if (
    rendererIsSlow &&
    isZooming &&
    snapshotCanvas &&
    snapshotView &&
    typeof ctx.drawImage === "function" &&
    now() - lastFullDrawAt < GESTURE_REFRESH_MS
  ) {
    blitSnapshot(ctx, view, snapshotCanvas, snapshotView);
    if (canvasHoveredId) {
      drawHoverHighlight(ctx, scene, view, canvasDrawState(), canvasHoveredId);
    }
    return;
  }

  const t0 = now();
  drawScene(ctx, scene, view, canvasDrawState());
  const dt = now() - t0;
  lastFullDrawAt = t0 + dt;
  // Symmetric hysteresis: two consecutive slow full draws engage the
  // fallback, two consecutive fast ones release it — so a cold-start
  // hiccup (JIT warmup, first-paint contention) can't lock a fast device
  // into blurry gesture blits forever.
  if (dt > SLOW_FRAME_MS) {
    fastDrawStreak = 0;
    if (++slowDrawStreak >= 2) rendererIsSlow = true;
  } else {
    slowDrawStreak = 0;
    if (++fastDrawStreak >= 2) rendererIsSlow = false;
  }
  if (!rendererIsSlow || typeof document === "undefined") return;
  // Keep a snapshot current for the fallback's gesture blits.
  if (!snapshotCanvas) snapshotCanvas = document.createElement("canvas");
  if (snapshotCanvas.width !== display.width) {
    snapshotCanvas.width = display.width;
  }
  if (snapshotCanvas.height !== display.height) {
    snapshotCanvas.height = display.height;
  }
  const sctx = snapshotCanvas.getContext("2d");
  if (sctx && typeof sctx.drawImage === "function") {
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, snapshotCanvas.width, snapshotCanvas.height);
    sctx.drawImage(display, 0, 0);
    snapshotView = view;
  } else {
    snapshotView = null;
  }
}

// rAF-coalesced: gesture zooms can emit several events per frame.
function requestRedraw() {
  if (!isCanvas.value || redrawFrame) return;
  redrawFrame = requestAnimationFrame(() => {
    redrawFrame = 0;
    drawNow();
  });
}

// Feature under a client point via the picking canvas — O(1) per query
// regardless of feature count. The zoom transform is unwound here; the
// picking bitmap itself is only rebuilt on geometry changes.
function pickFeatureAt(clientX: number, clientY: number): string | null {
  const svgEl = svgRef.value;
  if (!svgEl || !scene || !pickingCtx) return null;
  const p = clientToViewBox(clientX, clientY);
  if (!p) return null;
  const [mx, my] = zoomTransform(svgEl).invert(p);
  const idx = pickIndexAt(pickingCtx, scene, mx, my);
  return idx == null ? null : scene.items[idx].id;
}

// Client-coordinate center of a feature — the canvas-mode stand-in for a
// path element's getBoundingClientRect (tooltip anchoring).
function featureClientAnchor(featId: string): { x: number; y: number } | null {
  const svgEl = svgRef.value;
  const f = featuresById.value.get(featId);
  if (!svgEl || !f) return null;
  const [[x0, y0], [x1, y1]] = pathGenerator.value.bounds(f);
  const [vx, vy] = zoomTransform(svgEl).apply([(x0 + x1) / 2, (y0 + y1) / 2]);
  let ctm: DOMMatrix | null = null;
  try {
    ctm = svgEl.getScreenCTM();
  } catch {
    ctm = null;
  }
  if (!ctm) return null;
  return {
    x: ctm.a * vx + ctm.c * vy + ctm.e,
    y: ctm.b * vx + ctm.d * vy + ctm.f,
  };
}

function applyStrokeScale() {
  if (isCanvas.value) return; // stroke widths are computed at draw time
  const d = strokeDivisor();
  const eff = effectiveStrokeWidth.value;
  baseGroupRef.value?.setAttribute("stroke-width", String(eff / d));
  bordersPathEl?.setAttribute("stroke-width", String(1 / d));
  overlayGroupRef.value?.setAttribute("stroke-width", String((eff + 1.5) / d));
  for (const { el, strokeWidth } of overlayPathEls.values()) {
    if (strokeWidth != null) {
      el.setAttribute("stroke-width", String(strokeWidth / d));
    } else {
      el.removeAttribute("stroke-width");
    }
  }
  for (const [p, item] of focusedPathStyles) {
    p.setAttribute("stroke-width", String(highlightWidthFor(item) / d));
  }
  if (hoveredEl && !focusedPathStyles.has(hoveredEl)) {
    hoveredEl.setAttribute("stroke-width", String(highlightWidthFor() / d));
  }
}

function applyHighlightStroke(pathEl: SVGPathElement, item?: FocusItem) {
  // Bring path to top so its thicker border isn't clipped by neighbors.
  // Skip for overlay paths (they live above everything and own their
  // own z-order via syncOverlayPaths).
  pathEl.parentNode?.appendChild(pathEl);
  pathEl.setAttribute(
    "stroke-width",
    String(highlightWidthFor(item) / strokeDivisor()),
  );
  pathEl.style.stroke = item?.stroke ?? HIGHLIGHT_STROKE;
  applyDasharray(pathEl, item?.style);
}

function restoreDefaultStroke(pathEl: SVGPathElement) {
  // Dropping the attribute lets the path inherit the compensated width
  // from the base group again.
  pathEl.removeAttribute("stroke-width");
  pathEl.style.stroke = "";
  pathEl.setAttribute("stroke", props.strokeColor);
  pathEl.removeAttribute("stroke-dasharray");
  pathEl.removeAttribute("stroke-linecap");
}

function setHover(pathEl: SVGPathElement) {
  if (hoveredEl === pathEl) return;
  if (hoveredEl && !focusedPathStyles.has(hoveredEl)) {
    // Restore previous hover unless it's also focused — focus keeps the
    // highlight on its own.
    restoreDefaultStroke(hoveredEl);
  }
  hoveredEl = pathEl;
  // Hover styling follows whatever focus styling is in effect (or the
  // defaults).
  applyHighlightStroke(pathEl, focusedPathStyles.get(pathEl));
}

// Renderer-agnostic hover entry point: canvas mode tracks an id and
// repaints; svg mode restyles the path element.
function setHoverId(featId: string) {
  if (isCanvas.value) {
    if (canvasHoveredId === featId) return;
    canvasHoveredId = featId;
    requestRedraw();
    return;
  }
  const p = pathsByFeatureId.get(featId);
  if (p) setHover(p);
}

function clearHover() {
  if (isCanvas.value) {
    if (canvasHoveredId != null) {
      canvasHoveredId = null;
      // The hover highlight lives on the display layer, so dropping it
      // is just another cheap composite frame.
      requestRedraw();
      emit("stateHover", null);
    }
    hideTooltip();
    return;
  }
  if (hoveredEl) {
    const focusItem = focusedPathStyles.get(hoveredEl);
    if (focusItem == null) {
      restoreDefaultStroke(hoveredEl);
    } else {
      // Restore the focused styling (in case hover overwrote a dashed
      // or custom-styled item).
      applyHighlightStroke(hoveredEl, focusItem);
    }
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

// Emits stateClick plus the baked-in click-to-focus toggle so
// `v-model:focus="ref"` Just Works: selecting the currently focused feature
// clears focus (emits null); selecting any other feature emits its id. With
// a `focus` array, any selection of a member clears everything — parents
// wanting fine-grained multi-select handle merging via `@update:focus`.
// Shared by the mouse-click and touch-tap paths.
function emitSelection(data: TooltipPayload) {
  emit("stateClick", { id: data.id, name: data.name, value: data.value });
  const wasFocused = focusedBaseIds(normalizedFocus.value).has(data.id);
  emit("update:focus", wasFocused ? null : data.id);
}

function onDelegatedEvent(event: Event) {
  // Only hover is suppressed mid-gesture (stroke churn while the map
  // moves); clicks stay live — even during zoom animations — since d3
  // already swallows genuine post-drag clicks via clickDistance.
  if (event.type === "mouseover" && isZooming) return;
  const me = event as MouseEvent;
  const featId = featureIdFromEvent(me.target, me.clientX, me.clientY);
  if (!featId) return;
  const data = tooltipDataById.get(featId);
  if (!data) return;
  const payload = { id: data.id, name: data.name, value: data.value };
  if (event.type === "click") {
    if (props.zoom) {
      window.clearTimeout(pendingSelectTimer);
      pendingSelectTimer = 0;
      // detail > 1 is the second click of a double-click — that gesture is
      // a zoom (handled by d3), not a select.
      if (me.detail <= 1) {
        pendingSelectTimer = window.setTimeout(() => {
          pendingSelectTimer = 0;
          emitSelection(data);
        }, CLICK_SELECT_DELAY_MS);
      }
    } else {
      emitSelection(data);
    }
  } else if (event.type === "mouseover") {
    setHoverId(featId);
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

// Canvas mode has no per-feature elements to delegate mouseover to —
// hover is resolved by picking on every mousemove instead (a 1px read
// from a CPU canvas; cheap even at mousemove rates).
function onCanvasMouseMove(event: MouseEvent) {
  if (isZooming) return;
  const featId = pickFeatureAt(event.clientX, event.clientY);
  if (featId === canvasHoveredId) {
    if (featId) moveTooltip(event.clientX, event.clientY);
    return;
  }
  if (!featId) {
    clearHover();
    return;
  }
  const data = tooltipDataById.get(featId);
  if (!data) return;
  setHoverId(featId);
  emit("stateHover", { id: data.id, name: data.name, value: data.value });
  if (hasInteractiveTooltip.value) {
    showTooltip(featId, event.clientX, event.clientY);
  }
}

function onCanvasMouseLeave() {
  clearHover();
}

// Renderer-agnostic feature resolution for pointer events.
function featureIdFromEvent(
  target: EventTarget | null,
  clientX: number,
  clientY: number,
): string | null {
  return isCanvas.value
    ? pickFeatureAt(clientX, clientY)
    : eventToFeatureId(target);
}

function onTouchStart(event: TouchEvent) {
  // Single-finger only — a second touch is a pinch-zoom, not a selection.
  if (event.touches.length !== 1) {
    tapStart = null;
    return;
  }
  const t = event.touches[0]!;
  tapStart = {
    x: t.clientX,
    y: t.clientY,
    time: event.timeStamp,
    featId: featureIdFromEvent(event.target, t.clientX, t.clientY),
  };
}

function onTouchEnd(event: TouchEvent) {
  const start = tapStart;
  tapStart = null;
  // A second finger joined in — that's a pinch, not a tap.
  if (!start || event.touches.length > 0) return;
  const t = event.changedTouches[0];
  if (!t) return;
  // Moved too far (a pan) or held too long (a long-press) → not a tap.
  if (Math.abs(t.clientX - start.x) > TAP_SLOP) return;
  if (Math.abs(t.clientY - start.y) > TAP_SLOP) return;
  if (event.timeStamp - start.time > TAP_MAX_MS) return;
  // Inline touch map with zoom on (activate mode): a *double tap*
  // anywhere (features and background alike) is the zoom gesture —
  // expanding to fill the window by default, or zooming in place with
  // `touchExpand: false` (a pinch works there too). Single taps select,
  // deferred by the double-tap window so the second tap of a double tap
  // can cancel them — mirroring the desktop click debounce. Scroll mode
  // and the expanded view skip all of this: taps there select directly.
  if (
    props.zoom &&
    !isScrollMode.value &&
    isTouchDevice() &&
    !fullscreen.isFullscreen.value
  ) {
    // Suppress the synthetic click/hover the browser would replay from
    // this tap (and iOS's hover-first tap). Guard on cancelable: a
    // touchend fired while the page is mid-scroll is non-cancelable, and
    // preventDefault there is a no-op that only logs a console intervention.
    if (event.cancelable) event.preventDefault();
    const prev = lastTap;
    lastTap = { x: t.clientX, y: t.clientY, time: event.timeStamp };
    const isDoubleTap =
      prev != null &&
      event.timeStamp - prev.time <= CLICK_SELECT_DELAY_MS &&
      Math.abs(t.clientX - prev.x) <= DOUBLE_TAP_SLOP &&
      Math.abs(t.clientY - prev.y) <= DOUBLE_TAP_SLOP;
    if (isDoubleTap) {
      lastTap = null;
      window.clearTimeout(pendingSelectTimer);
      pendingSelectTimer = 0;
      if (props.touchExpand) {
        enterTouchZoom(t.clientX, t.clientY);
      } else {
        zoomInPlaceAt(t.clientX, t.clientY);
      }
      return;
    }
    const data = start.featId ? tooltipDataById.get(start.featId) : undefined;
    if (!data) {
      // Background tap: dismiss any tap-hover state.
      clearHover();
      return;
    }
    // Highlight + tooltip respond instantly; only the selection emits
    // wait out the double-tap window.
    touchHover(data, t.clientX, t.clientY);
    window.clearTimeout(pendingSelectTimer);
    pendingSelectTimer = window.setTimeout(() => {
      pendingSelectTimer = 0;
      emitSelection(data);
    }, CLICK_SELECT_DELAY_MS);
    return;
  }
  if (!start.featId) {
    clearHover();
    return;
  }
  const data = tooltipDataById.get(start.featId);
  if (!data) return;
  // Suppress the synthetic click/hover the browser would replay from this
  // tap, so selection fires exactly once and never via iOS's hover-first
  // tap. Guard on cancelable — a touchend fired mid page-scroll is
  // non-cancelable, and preventDefault there only logs an intervention.
  if (event.cancelable) event.preventDefault();
  touchHover(data, t.clientX, t.clientY);
  emitSelection(data);
}

// A tap doubles as the touch replacement for hover: apply the hover-style
// highlight, announce it, and show the tooltip. (Continuous hover
// *tracking* stays off on touch — see setupInteraction — this is the
// one-shot equivalent.)
function touchHover(data: TooltipPayload, clientX: number, clientY: number) {
  setHoverId(data.id);
  emit("stateHover", { id: data.id, name: data.name, value: data.value });
  if (!hasInteractiveTooltip.value) return;
  // Anchor to the feature, not the finger: element rects and fixed
  // positioning share the layout-viewport coordinate space, so this
  // stays put when the page itself is pinch-zoomed — Safari reports
  // touch client coords in *visual*-viewport space, which would skew a
  // finger-anchored tooltip. Also keeps it out from under the finger.
  if (isCanvas.value) {
    const anchor = featureClientAnchor(data.id);
    if (anchor) showTooltip(data.id, anchor.x, anchor.y);
    else showTooltip(data.id, clientX, clientY);
    return;
  }
  const pathEl = pathsByFeatureId.get(data.id);
  if (pathEl) {
    const rect = pathEl.getBoundingClientRect();
    showTooltip(
      data.id,
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
  } else {
    showTooltip(data.id, clientX, clientY);
  }
}

function onTouchCancel() {
  tapStart = null;
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
  const baseG = baseGroupRef.value;
  const overlayG = overlayGroupRef.value;
  if (!baseG || !overlayG) return;
  // Only the base group is wiped — the overlay group stays in place so
  // applyFocus can repopulate it. Overlay path *elements* are dropped
  // from the tracking map so applyFocus rebuilds them against the new
  // base tree (their `d` attributes are derived from `pathGenerator`).
  while (baseG.firstChild) baseG.removeChild(baseG.firstChild);
  while (overlayG.firstChild) overlayG.removeChild(overlayG.firstChild);
  pathsByFeatureId.clear();
  tooltipDataById.clear();
  bordersPathEl = null;
  hoveredEl = null;
  // Old focused / overlay paths are about to be detached — drop refs so
  // applyFocus can re-resolve against the new path tree.
  focusedPathStyles.clear();
  overlayPathEls.clear();
  canvasHoveredId = null;
  canvasFocused.clear();
  canvasOverlays = [];

  const path = pathGenerator.value;
  const features = featuresGeo.value.features;
  // No features (e.g. geoType="hsas" before the lazy HSA module resolves)
  // means the projection was fitted to an empty collection and yields NaN
  // coordinates — skip drawing entirely, including the state-borders mesh,
  // until real features arrive and re-trigger a rebuild.
  if (features.length === 0) {
    scene = null;
    pickingCtx = null;
    snapshotView = null;
    requestRedraw();
    return;
  }

  if (isCanvas.value) {
    // Canvas backend: no DOM per feature — build the scene + picking
    // bitmap, and keep the tooltip payload cache exactly as svg mode does.
    for (const feat of features) {
      const id = String(feat.id);
      tooltipDataById.set(id, {
        id,
        name: featureName(feat),
        value: valueFor(id),
        feature: feat as ChoroplethFeature,
      });
    }
    const borders = stateBordersPath.value;
    scene = buildScene(
      features as Array<{ id?: string | number | null }>,
      path as (feature: never) => string | null,
      colorFor,
      borders ? path(borders) : null,
    );
    if (!pickingCanvas && typeof document !== "undefined") {
      pickingCanvas = document.createElement("canvas");
    }
    pickingCtx = pickingCanvas
      ? buildPicking(scene, width.value, height.value, pickingCanvas)
      : null;
    requestRedraw();
    return;
  }

  const stroke = props.strokeColor;
  const wantsTitleFallback = !hasInteractiveTooltip.value;

  // Single DocumentFragment append → one layout flush for the whole batch.
  // Feature paths carry no stroke-width of their own — they inherit the
  // compensated group-level width from applyStrokeScale.
  const frag = document.createDocumentFragment();
  for (const feat of features) {
    const id = String(feat.id);
    const name = featureName(feat);
    const value = valueFor(id);
    const p = makePath(path(feat));
    p.setAttribute("class", "state-path");
    p.setAttribute("data-feat-id", id);
    p.setAttribute("fill", colorFor(id));
    p.setAttribute("stroke", stroke);
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
    b.setAttribute("stroke-linejoin", "round");
    b.setAttribute("pointer-events", "none");
    frag.appendChild(b);
    bordersPathEl = b;
  }
  baseG.appendChild(frag);
  applyStrokeScale();
}

function updateFills() {
  if (isCanvas.value) {
    if (scene) {
      for (const item of scene.items) item.fill = colorFor(item.id);
    }
    for (const [id, entry] of tooltipDataById) entry.value = valueFor(id);
    requestRedraw();
    return;
  }
  const refreshTitle = !hasInteractiveTooltip.value;
  for (const [id, p] of pathsByFeatureId) {
    const value = valueFor(id);
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
  if (isCanvas.value) {
    // Stroke params are read at render time — refresh both buffers.
    requestRedraw();
    return;
  }
  for (const p of pathsByFeatureId.values()) {
    // Highlighted paths (hover / focus) keep their #555 + thicker stroke.
    if (p === hoveredEl || focusedPathStyles.has(p)) continue;
    restoreDefaultStroke(p);
  }
  if (bordersPathEl) bordersPathEl.setAttribute("stroke", props.strokeColor);
  // Group-level widths track effectiveStrokeWidth.
  applyStrokeScale();
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

const fullscreen = useChartFullscreen({
  target: () => props.fullscreenTarget,
});

const menuItems = computed<ChartMenuItem[]>(() => {
  const fname = menuFilename();
  if (isCanvas.value) {
    // No SVG DOM to serialize in canvas mode; PNG exports straight off
    // the rendering canvas (already devicePixelRatio-sized).
    return [
      fullscreen.menuItem.value,
      {
        label: "Save as PNG",
        action: () => {
          if (canvasRef.value) saveCanvasPng(canvasRef.value, fname);
        },
      },
    ];
  }
  return [
    fullscreen.menuItem.value,
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

// Geometry / projection / tooltip-mode → full rebuild. `featuresGeo` is
// watched explicitly because in single-state mode the projection is pinned
// to the static state outline, so an async change to the feature set (e.g.
// the lazy HSA module resolving) wouldn't otherwise change `pathGenerator`.
watch(
  () => [featuresGeo.value, pathGenerator.value, hasInteractiveTooltip.value],
  () => rebuildPaths(),
);

// Data or scale → repaint fills (and refresh fallback <title>s). Reading
// `props.dataGeoType` directly so a change to the parent-mapping mode
// re-evaluates every county's color even when `dataMap` itself
// (data-id keyed) is unchanged.
watch(
  () =>
    [
      dataMap.value,
      props.colorScale,
      props.noDataColor,
      props.dataGeoType,
    ] as const,
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
// two zoom transforms in the same tick. `hsaModule` is included so a
// cross-geoType focus on an hsa item re-applies once the lazy module
// resolves (the base pathGenerator doesn't depend on hsa data).
watch(
  () => [normalizedFocus.value, pathGenerator.value, hsaModule.value],
  () => applyFocus(),
  { flush: "post" },
);

// Exiting the expanded touch view (✕, Escape) returns to the static inline
// map at full extent — the inline map has no pan gestures, so a preserved
// transform would strand the user off-center. Any toggle also drops the
// tooltip: the presentation mode (float vs sheet) may change with it.
watch(
  () => fullscreen.isFullscreen.value,
  (expanded) => {
    hideTooltip();
    if (expanded || !isTouchDevice()) return;
    if (!svgRef.value || !zoomBehavior) return;
    const svg = select(svgRef.value);
    svg.interrupt();
    zoomBehavior.transform(svg, zoomIdentity);
  },
);
</script>

<template>
  <Teleport
    :to="fullscreen.teleportTarget.value"
    :disabled="!fullscreen.isFullscreen.value"
  >
    <div
      ref="containerRef"
      v-bind="$attrs"
      :class="[
        'choropleth-wrapper',
        {
          pannable: isPannable,
          'is-fullscreen': fullscreen.isFullscreen.value,
        },
      ]"
      :style="fullscreen.fullscreenStyle.value"
      :role="chartRole || undefined"
      :aria-label="chartAriaLabel || undefined"
    >
      <!-- Rendered while expanded even with `menu` off — the ✕ close
      button it swaps to is the way back from the tap-to-expand view. -->
      <ChartMenu
        v-if="menu || fullscreen.isFullscreen.value"
        :items="menuItems"
        :is-fullscreen="fullscreen.isFullscreen.value"
        @close="fullscreen.exit"
      />
      <div class="chart-sr-only" aria-live="polite">
        {{ fullscreen.isFullscreen.value ? "Map expanded to fill window" : "" }}
      </div>
      <!--
      Title + legend live as an HTML overlay on top of the SVG so they keep
      their intrinsic px sizes regardless of how the browser scales the
      viewBox to fit the container.
    -->
      <div v-if="title || showLegend" class="choropleth-header">
        <div v-if="title" class="choropleth-title" :style="titleInlineStyle">
          {{ title }}
        </div>
        <div
          v-if="showLegend"
          class="choropleth-legend"
          :style="legendInlineStyle"
        >
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
      <div v-if="showZoomHint" class="choropleth-zoom-hint">
        {{ zoomHintText }}
      </div>
      <!-- Canvas backend paints here; the (empty) svg after it stays the
      interaction/zoom surface. pointer-events: none lets every event fall
      through to the svg even though the positioned canvas paints above
      the transparent svg. Position/size are pinned to the svg box by the
      resize observer. -->
      <canvas
        v-if="isCanvas"
        ref="canvasRef"
        class="choropleth-canvas"
        aria-hidden="true"
      />
      <svg
        ref="svgRef"
        :viewBox="`0 0 ${width} ${height}`"
        preserveAspectRatio="xMidYMid meet"
        :style="svgStyle"
      >
        <!--
        Path elements are created imperatively in `rebuildPaths()`; Vue never
        diffs the per-feature subtree so reactive state changes don't walk
        thousands of vnodes. `mapGroupRef` carries the zoom transform;
        `baseGroupRef` holds feature paths + the state-borders mesh and is
        the event-delegation target; `overlayGroupRef` is the always-on-top
        focus-overlay layer (separate group so hover-raised base paths
        can't cover an overlay).
      -->
        <g ref="mapGroupRef">
          <g ref="baseGroupRef" />
          <g ref="overlayGroupRef" />
        </g>
      </svg>
      <ChartZoomControls
        v-if="showZoomControls"
        :can-zoom-in="scaleK < maxScale"
        :can-zoom-out="scaleK > 1"
        :can-reset="isZoomed"
        :is-fullscreen="fullscreen.isFullscreen.value"
        @zoom-in="zoomBy(ZOOM_STEP)"
        @zoom-out="zoomBy(1 / ZOOM_STEP)"
        @reset="resetZoom"
      />
      <ChoroplethTooltip
        v-if="hasInteractiveTooltip"
        ref="tooltipChildRef"
        :mode="tooltipMode"
      >
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
  </Teleport>
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
  /* Size container so the zoom hint can reposition on narrow maps. */
  container-type: inline-size;
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

/* While expanded the wrapper is a flex column (inline style); the SVG keeps
   its prop-driven size otherwise, so stretch it to fill the expanded box. */
.choropleth-wrapper.is-fullscreen svg {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  width: 100%;
}

.choropleth-wrapper.pannable svg:active {
  cursor: grabbing;
}

.state-path {
  cursor: pointer;
}

.choropleth-canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  /* Own compositor layer: without it WebKit repaints the surrounding
     page layer on every canvas frame (the same >100ms/frame pathology
     the svg renderer hit). Canvas mode implies interactivity, so the
     layer is always warranted. */
  will-change: transform;
}

/* Overlays the top of the map: absolutely positioned with no `top`, the
   box keeps its static position — the top edge of the svg that follows it
   in the markup — without taking up flow space. The text carries a
   page-color halo so it stays legible over map fills. */
.choropleth-zoom-hint {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 1;
  padding-top: 6px;
  text-align: center;
  font-size: 12px;
  line-height: 1.4;
  color: var(--color-text-secondary, #777);
  opacity: 0.6;
  pointer-events: none;
  text-shadow:
    1px 0 0 var(--color-bg-0, #fff),
    -1px 0 0 var(--color-bg-0, #fff),
    0 1px 0 var(--color-bg-0, #fff),
    0 -1px 0 var(--color-bg-0, #fff),
    0 0 3px var(--color-bg-0, #fff);
}

/* On narrow maps the overlay would cover content that matters — show the
   hint in flow above the map instead (the wrapper is the container). */
@container (max-width: 480px) {
  .choropleth-zoom-hint {
    position: static;
    padding: 0;
  }
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
  white-space: pre-line;
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

/* Continuous legend: the tick labels under the gradient unbalance the
   row's vertical centering, so anchor items to the top and line the title
   up with the gradient bar itself (line-height matches its 12px height). */
.choropleth-legend:has(.choropleth-legend-continuous) {
  align-items: flex-start;
}

.choropleth-legend:has(.choropleth-legend-continuous) .choropleth-legend-title {
  line-height: 12px;
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
