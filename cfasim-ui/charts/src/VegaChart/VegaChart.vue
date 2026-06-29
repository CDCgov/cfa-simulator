<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  toRaw,
  watch,
} from "vue";
import type { View } from "vega";
import type { Config } from "vega-lite";
import type {
  VisualizationSpec,
  EmbedOptions,
  Result,
  Actions,
} from "vega-embed";
import ChartMenu from "../ChartMenu/ChartMenu.vue";
import type { ChartMenuItem } from "../ChartMenu/ChartMenu.vue";
import { downloadBlob, downloadCsv } from "../ChartMenu/download.js";
import { useChartSize, useChartFullscreen } from "../_shared/index.js";
import { buildVegaThemeConfig } from "./vegaTheme.js";

/**
 * Vega-Lite (or Vega) spec accepted by {@link VegaChart}. Identical to
 * vega-embed's `VisualizationSpec` except the top-level `data` is made
 * optional — `VegaChart` lets you supply data via the `data` prop instead
 * of embedding it in the spec.
 */
export type VegaSpec = VisualizationSpec extends infer S
  ? S extends { data: infer D }
    ? Omit<S, "data"> & { data?: D }
    : S
  : never;
export type VegaConfig = Config;
export type VegaView = View;

/** A single row of tabular data passed to {@link VegaChartProps.data}. */
export type VegaRow = Record<string, unknown>;

/**
 * Accepted shapes for the `data` prop, all merged into the spec at render
 * time so model output wires in without hand-editing the spec:
 * - `VegaRow[]` — inline rows for the spec's primary (unnamed) dataset.
 * - `Record<string, ArrayLike>` — columnar data (e.g.
 *   `{ time: out.column("time"), y: out.column("y") }`), zipped into rows.
 * - `Record<string, VegaRow[]>` — named datasets (`spec.datasets[name]`),
 *   referenced from the spec via `{ "data": { "name": "..." } }`.
 */
export type VegaChartData =
  | VegaRow[]
  | Record<string, ArrayLike<unknown>>
  | Record<string, VegaRow[]>;

const DEFAULT_HEIGHT = 300;

const props = withDefaults(
  defineProps<{
    /** Vega-Lite (or Vega) spec. Replace the object to update; in-place
     *  mutations are also picked up via a deep watch. */
    spec: VegaSpec;
    /** Data merged into the spec at render time. See {@link VegaChartData}. */
    data?: VegaChartData;
    /** Plot width in px. Omit to size to the container (`"container"`). */
    width?: number;
    /** Plot height in px. Omit for a default responsive height. */
    height?: number;
    /** Vega renderer. `"svg"` (default) is crisp and exports cleanly;
     *  `"canvas"` is faster for very large datasets. */
    renderer?: "svg" | "canvas";
    /** Vega config deep-merged over the auto theme config (user wins). */
    config?: VegaConfig;
    /** Apply the auto theme config derived from `--color-*` tokens.
     *  Default true; set false for Vega defaults. */
    theme?: boolean;
    /** Show vega-embed's built-in actions menu. Default false (the project
     *  ChartMenu is used instead). */
    actions?: boolean | Actions;
    /** Enable vega-tooltip. Default true. */
    tooltip?: boolean;
    /** Show the chart options menu (Fullscreen / export). */
    menu?: boolean | string;
    /** Filename (without extension) for SVG / PNG / CSV downloads. */
    filename?: string;
    /** Where to teleport the chart while expanded. See ChoroplethMap. */
    fullscreenTarget?: string | HTMLElement;
    /** Debounce (ms) applied to resize-driven re-renders. */
    debounce?: number;
    /** Custom CSV for the Download CSV menu item. When omitted, CSV is
     *  generated from tabular `data` (if any). */
    csv?: string | (() => string);
  }>(),
  {
    renderer: "svg",
    theme: true,
    actions: false,
    tooltip: true,
    menu: true,
  },
);

const emit = defineEmits<{
  viewReady: [view: View];
  error: [error: unknown];
}>();

defineSlots<{
  /** Replaces the default error state. */
  error(props: { error: unknown }): unknown;
}>();

defineOptions({ inheritAttrs: false });

// ─── vega-embed lazy loader (shared across instances) ────────────────────
let vegaEmbedModule: Promise<typeof import("vega-embed")> | null = null;
function loadVegaEmbed() {
  if (!vegaEmbedModule) vegaEmbedModule = import("vega-embed");
  return vegaEmbedModule;
}

// ─── Sizing ──────────────────────────────────────────────────────────────
const { containerRef, measuredWidth } = useChartSize({
  debounce: () => props.debounce,
});
const vegaContainer = ref<HTMLElement | null>(null);

const containerStyle = computed(() => ({
  "--vega-chart-height": `${props.height ?? DEFAULT_HEIGHT}px`,
}));

// ─── Theme reactivity ────────────────────────────────────────────────────
// buildVegaThemeConfig() reads the DOM, which Vue can't track, so bump a
// version ref whenever the theme changes and re-embed.
const themeVersion = ref(0);
let themeObserver: MutationObserver | null = null;
let colorSchemeQuery: MediaQueryList | null = null;
function onThemeChange() {
  themeVersion.value++;
}

const mergedConfig = computed<Config>(() => {
  themeVersion.value; // reactive dependency
  const base = props.theme ? buildVegaThemeConfig() : {};
  return props.config
    ? (deepMerge(
        base as Record<string, unknown>,
        props.config as Record<string, unknown>,
      ) as Config)
    : base;
});

// ─── Spec assembly ───────────────────────────────────────────────────────
function isVegaRowArray(d: VegaChartData): d is VegaRow[] {
  return Array.isArray(d);
}

function looksLikeNamedDatasets(
  d: Record<string, unknown>,
): d is Record<string, VegaRow[]> {
  const vals = Object.values(d);
  return (
    vals.length > 0 &&
    vals.every(
      (v) =>
        Array.isArray(v) &&
        (v.length === 0 || (typeof v[0] === "object" && v[0] !== null)),
    )
  );
}

function columnarToRows(cols: Record<string, ArrayLike<unknown>>): VegaRow[] {
  const keys = Object.keys(cols);
  if (!keys.length) return [];
  const len = keys.reduce((m, k) => Math.max(m, cols[k]?.length ?? 0), 0);
  const rows: VegaRow[] = [];
  for (let i = 0; i < len; i++) {
    const row: VegaRow = {};
    for (const k of keys) row[k] = cols[k]?.[i];
    rows.push(row);
  }
  return rows;
}

function applyData(spec: Record<string, unknown>, data: VegaChartData) {
  if (isVegaRowArray(data)) {
    if (spec.data === undefined) spec.data = { values: data };
    return;
  }
  if (looksLikeNamedDatasets(data)) {
    spec.datasets = {
      ...(spec.datasets as Record<string, unknown> | undefined),
      ...data,
    };
    return;
  }
  // Columnar — zip into rows for the primary dataset.
  const rows = columnarToRows(data as Record<string, ArrayLike<unknown>>);
  if (spec.data === undefined) spec.data = { values: rows };
}

const mergedSpec = computed<VisualizationSpec>(() => {
  const spec = structuredClone(toRaw(props.spec)) as Record<string, unknown>;
  if (props.data !== undefined) applyData(spec, props.data);
  spec.width = props.width ?? spec.width ?? "container";
  spec.height = props.height ?? spec.height ?? "container";
  // With "container" sizing, the default `autosize: pad` draws axes/titles
  // *outside* the declared height, so they spill past the fixed-height
  // container and get clipped. `fit` shrinks the plot so the whole chart
  // (including axes) fits within the container box. Single-view only —
  // Vega-Lite ignores it (with a warning) for concat/facet/repeat specs.
  if (
    (spec.width === "container" || spec.height === "container") &&
    spec.autosize === undefined
  ) {
    spec.autosize = { type: "fit", contains: "padding" };
  }
  return spec as VisualizationSpec;
});

// ─── Render lifecycle ────────────────────────────────────────────────────
type State = "loading" | "ready" | "error";
const state = ref<State>("loading");
const error = ref<unknown>(null);
const view = shallowRef<View | null>(null);

let result: Result | null = null;
let renderSeq = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function disposeView() {
  if (result) {
    result.finalize();
    result = null;
  }
  view.value = null;
}

async function render() {
  if (!vegaContainer.value) return;
  const seq = ++renderSeq;

  let embed: typeof import("vega-embed").default;
  try {
    embed = (await loadVegaEmbed()).default;
  } catch (e) {
    if (seq === renderSeq) fail(e);
    return;
  }
  if (seq !== renderSeq || !vegaContainer.value) return;

  disposeView();
  vegaContainer.value.replaceChildren();

  const opts: EmbedOptions = {
    renderer: props.renderer,
    actions: props.actions,
    tooltip: props.tooltip,
    config: mergedConfig.value,
  };

  try {
    const r = await embed(vegaContainer.value, mergedSpec.value, opts);
    if (seq !== renderSeq) {
      // A newer render superseded us mid-flight — drop this one.
      r.finalize();
      return;
    }
    result = r;
    view.value = r.view;
    state.value = "ready";
    error.value = null;
    emit("viewReady", r.view);
  } catch (e) {
    if (seq === renderSeq) fail(e);
  }
}

function fail(e: unknown) {
  state.value = "error";
  error.value = e;
  emit("error", e);
}

function scheduleRender() {
  const delay = props.debounce ?? 0;
  if (debounceTimer) clearTimeout(debounceTimer);
  if (!delay) {
    void render();
    return;
  }
  debounceTimer = setTimeout(() => void render(), delay);
}

// ─── Menu / export / fullscreen ──────────────────────────────────────────
const fullscreen = useChartFullscreen({
  target: () => props.fullscreenTarget,
});
const showMenu = computed(() => props.menu !== false);

function fname(): string {
  return props.filename || "chart";
}

async function saveSvg() {
  if (!view.value) return;
  const svg = await view.value.toSVG();
  downloadBlob(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    `${fname()}.svg`,
  );
}

async function savePng() {
  if (!view.value) return;
  const url = await view.value.toImageURL("png", 2);
  const blob = await (await fetch(url)).blob();
  downloadBlob(blob, `${fname()}.png`);
}

function rowsToCsv(rows: VegaRow[]): string {
  if (!rows.length) return "";
  const cols = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>()),
  );
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(",")];
  for (const r of rows) lines.push(cols.map((c) => escape(r[c])).join(","));
  return lines.join("\n");
}

function csvContent(): string | null {
  if (props.csv)
    return typeof props.csv === "function" ? props.csv() : props.csv;
  if (props.data === undefined) return null;
  if (isVegaRowArray(props.data)) return rowsToCsv(props.data);
  if (!looksLikeNamedDatasets(props.data)) {
    return rowsToCsv(
      columnarToRows(props.data as Record<string, ArrayLike<unknown>>),
    );
  }
  return null;
}

const menuItems = computed<ChartMenuItem[]>(() => {
  const items: ChartMenuItem[] = [
    fullscreen.menuItem.value,
    { label: "Save as SVG", action: () => void saveSvg() },
    { label: "Save as PNG", action: () => void savePng() },
  ];
  const csv = csvContent();
  if (csv) {
    items.push({
      label: "Download CSV",
      action: () => downloadCsv(csv, `${fname()}.csv`),
    });
  }
  return items;
});

// ─── Generic deep merge for the config (plain objects only) ──────────────
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    const cur = out[k];
    out[k] = isPlainObject(cur) && isPlainObject(v) ? deepMerge(cur, v) : v;
  }
  return out;
}

// ─── Wiring ──────────────────────────────────────────────────────────────
onMounted(() => {
  if (typeof document !== "undefined") {
    themeObserver = new MutationObserver(onThemeChange);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
    colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    colorSchemeQuery.addEventListener("change", onThemeChange);
  }
  void nextTick().then(render);
});

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  themeObserver?.disconnect();
  colorSchemeQuery?.removeEventListener("change", onThemeChange);
  disposeView();
});

watch(
  () => [
    props.spec,
    props.data,
    props.config,
    props.theme,
    props.renderer,
    props.actions,
    props.tooltip,
    props.width,
    props.height,
    measuredWidth.value,
    fullscreen.isFullscreen.value,
    themeVersion.value,
  ],
  scheduleRender,
  { deep: true },
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
      class="vega-chart-wrapper"
      :class="{ 'is-fullscreen': fullscreen.isFullscreen.value }"
      :style="[containerStyle, fullscreen.fullscreenStyle.value]"
    >
      <ChartMenu
        v-if="showMenu"
        :items="menuItems"
        :is-fullscreen="fullscreen.isFullscreen.value"
        @close="fullscreen.exit"
      />
      <div ref="vegaContainer" class="vega-chart-container" />
      <div
        v-if="state === 'loading'"
        class="vega-chart-status"
        aria-live="polite"
      >
        Loading chart…
      </div>
      <div
        v-else-if="state === 'error'"
        class="vega-chart-status vega-chart-error"
      >
        <slot name="error" :error="error">Failed to render chart.</slot>
      </div>
    </div>
  </Teleport>
</template>

<style>
.vega-chart-wrapper {
  position: relative;
  width: 100%;
}
.vega-chart-container {
  width: 100%;
  height: var(--vega-chart-height, 300px);
}
.vega-chart-wrapper.is-fullscreen .vega-chart-container {
  flex: 1;
  height: auto;
}
.vega-chart-status {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary, #666);
  font-size: 0.875rem;
  pointer-events: none;
}
.vega-chart-error {
  color: var(--color-error, #dc3545);
}
</style>
