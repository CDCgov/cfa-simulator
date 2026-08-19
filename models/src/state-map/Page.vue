<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { SelectBox, Button, ToggleGroup } from "@cfasim-ui/components";
import { ChoroplethMap } from "@cfasim-ui/charts";
import type {
  StateData,
  GeoType,
  FocusValue,
  MapTheme,
  ThresholdStop,
} from "@cfasim-ui/charts";
import { fipsToHsa, hsaNames } from "@cfasim-ui/charts/hsa-mapping";
import {
  nationalCityMarkers,
  stateCityMarkers,
} from "@cfasim-ui/charts/us-cities";
import { useModelParams } from "../useModelParams";
import usCounties from "us-atlas/counties-10m.json";
import type { Topology } from "topojson-specification";

const topology = usCounties as unknown as Topology;

type NamedGeom = { id: string | number; properties: { name: string } };
const objects = (
  usCounties as unknown as {
    objects: {
      states: { geometries: NamedGeom[] };
      counties: { geometries: NamedGeom[] };
    };
  }
).objects;

// State picker, alphabetical, including the island territories so the
// geoMercator fallback (geoAlbersUsa can't project them) is reachable.
const stateOptions = objects.states.geometries
  .map((g) => ({ value: g.properties.name, label: g.properties.name }))
  .sort((a, b) => a.label.localeCompare(b.label));

const nameToFips = new Map(
  objects.states.geometries.map((g) => [
    g.properties.name,
    String(g.id).padStart(2, "0"),
  ]),
);
const fipsToStateName = new Map(
  objects.states.geometries.map((g) => [
    String(g.id).padStart(2, "0"),
    g.properties.name,
  ]),
);

// Deterministic synthetic values so each map has something to color.
const pseudo = (id: string | number): number =>
  parseInt(String(id).slice(-3) || "0", 10) % 100;

// Skew values so most regions read "Not Changing" and ~15% get no row at
// all (grey base fill).
function shaped(u: number): number | null {
  if (u < 15) return null;
  if (u < 65) return 40 + Math.round(((u - 15) / 50) * 19);
  if (u < 77) return 20 + Math.round(((u - 65) / 12) * 19);
  if (u < 89) return 60 + Math.round(((u - 77) / 12) * 19);
  if (u < 95) return Math.round(((u - 89) / 6) * 19);
  return 80 + Math.round(((u - 95) / 5) * 19);
}
const shapedRows = (ids: string[]): StateData[] =>
  ids.flatMap((id) => {
    const value = shaped(pseudo(id));
    return value == null ? [] : [{ id, value }];
  });

const countyData: StateData[] = shapedRows(
  objects.counties.geometries.map((g) => String(g.id).padStart(5, "0")),
);
const hsaData: StateData[] = shapedRows([...new Set(Object.values(fipsToHsa))]);

const defaults = {
  // Empty = national view; a state name drills into that state.
  selectedState: "",
  geoType: "counties" as GeoType,
  // National-view framing: "tight" crops Alaska's overhang so CONUS fills more.
  fit: "full" as "full" | "tight",
  // Overlay the capital (starred) + most-populous cities.
  cities: "off" as "off" | "on",
  // State-abbreviation labels (inside where they fit, callouts elsewhere).
  labels: "off" as "off" | "on",
  // Rendering backend. Canvas scales to thousands of counties; svg keeps
  // per-feature DOM. Fixed at mount, so the map is keyed on it to remount.
  renderer: "canvas" as "canvas" | "svg",
  // Exterior outline (theme.outline) around the rendered geography.
  outline: "on" as "off" | "on",
  // Mix levels: report a couple of states as one whole-state estimate on the
  // otherwise HSA-level national map.
  mixed: "off" as "off" | "on",
  // County boundaries overlaid on the HSA view (theme.countyBorders).
  // "zoom" reveals them only once zoomed in 2x (countyBordersMinZoom).
  hsaDetail: "on" as "off" | "on" | "zoom",
};
const { params } = useModelParams(defaults);

const stateHsaView = computed(
  () => Boolean(params.selectedState) && params.geoType === "hsas",
);
// National default: HSA-level data on county geography (county-level
// hover/focus). Mixed mode re-tiles whole states, so it uses the HSA base.
const nationalCountyView = computed(
  () => !params.selectedState && params.mixed !== "on",
);

// "At zoom" only applies to the state view's county mesh; the national
// county lines are feature strokes, which have no LOD.
const hsaDetailOptions = computed(() =>
  stateHsaView.value
    ? [
        { value: "off", label: "Off" },
        { value: "on", label: "On" },
        { value: "zoom", label: "At zoom" },
      ]
    : [
        { value: "off", label: "Off" },
        { value: "on", label: "On" },
      ],
);

// White county lines under darker HSA/state separators.
const mapTheme = computed<MapTheme | undefined>(() => {
  const theme: MapTheme = {};
  const countyLineColor = "rgba(255, 255, 255, 0.45)";
  if (params.outline === "on") {
    theme.outline = "#bbb";
    theme.outlineWidth = 1;
  }
  if (stateHsaView.value && params.hsaDetail !== "off") {
    theme.countyBorders = countyLineColor;
    theme.stroke = "#555";
  }
  if (nationalCountyView.value) {
    theme.hsaBorders = "#555";
    theme.borders = "#555";
    theme.bordersWidth = 0.5;
    // County lines are the feature strokes; width 0 hides them.
    if (params.hsaDetail === "off") theme.strokeWidth = 0;
    else theme.stroke = countyLineColor;
    theme.highlight = "#000";
  }
  return Object.keys(theme).length ? theme : undefined;
});

// Epidemic-trend palette (Growing → Declining) as thresholds over 0-99.
const rtColorScale: ThresholdStop[] = [
  { min: 0, color: "#006166", label: "Declining" },
  { min: 20, color: "#33958f", label: "Likely Declining" },
  { min: 40, color: "#fff", label: "Not Changing" },
  { min: 60, color: "#a14d8f", label: "Likely Growing" },
  { min: 80, color: "#6d085a", label: "Growing" },
];

const lastClicked = ref<{ id: string; name: string } | null>(null);
const focus = ref<FocusValue>(null);
const hoveredHsa = ref<string | null>(null);

// Clear the selection/highlight whenever the map's subject changes.
watch(
  () => [params.selectedState, params.geoType, params.mixed],
  () => {
    lastClicked.value = null;
    focus.value = null;
    hoveredHsa.value = null;
  },
);

const mapGeoType = computed<GeoType>(() => {
  if (params.selectedState) return params.geoType;
  return params.mixed === "on" ? "hsas" : "counties";
});
// HSA rows color the national county grid (each county fills with its
// parent HSA's value).
const mapDataGeoType = computed<GeoType | undefined>(() =>
  nationalCountyView.value ? "hsas" : undefined,
);
// States reported as a single whole-state estimate instead of HSA detail.
const MIXED_STATES = ["06", "48"];
const mixedData: StateData[] = [
  ...hsaData,
  ...MIXED_STATES.map((fips) => ({
    id: fips,
    value: pseudo(fips + "7"),
    geoType: "states" as GeoType,
  })),
];

const mapData = computed(() => {
  if (params.selectedState)
    return params.geoType === "hsas" ? hsaData : countyData;
  return params.mixed === "on" ? mixedData : hsaData;
});

// City overlay: national top-100 (+ DC) or, in a state view, that state's
// capital + top cities. Undefined when the toggle is off.
const cityMarkers = computed(() => {
  if (params.cities !== "on") return undefined;
  return params.selectedState && stateFips.value
    ? stateCityMarkers(stateFips.value)
    : nationalCityMarkers();
});

function onMapClick(payload: { id: string; name: string }) {
  if (!params.selectedState) {
    // Drill into the clicked feature's state (county FIPS and HSA codes
    // are both state-prefixed).
    const id = String(payload.id);
    const stateFips =
      id.length <= 2 ? id.padStart(2, "0") : id.padStart(5, "0").slice(0, 2);
    const stateName = fipsToStateName.get(stateFips);
    if (stateName) params.selectedState = stateName;
    return;
  }
  // State view: update the info panel and highlight on the map (no zoom).
  const id = String(payload.id);
  lastClicked.value = { id, name: payload.name };
  if (params.geoType === "counties") {
    const hsa = fipsToHsa[id.padStart(5, "0")];
    // Outline the county and (if mapped) its parent HSA.
    focus.value = hsa ? [id, { id: hsa, geoType: "hsas", stroke: "#111" }] : id;
  } else {
    focus.value = id;
  }
}

// Outline the hovered county's parent HSA; the guard avoids rebuilding
// the overlay while moving within one HSA.
function onMapHover(payload: { id: string; name: string } | null) {
  if (!nationalCountyView.value) return;
  const hsa = payload
    ? (fipsToHsa[String(payload.id).padStart(5, "0")] ?? null)
    : null;
  if (hsa === hoveredHsa.value) return;
  hoveredHsa.value = hsa;
  focus.value = hsa ? [{ id: hsa, geoType: "hsas", stroke: "#000" }] : null;
}

function tooltipHsaLabel(id: string): string {
  const hsa = fipsToHsa[String(id).padStart(5, "0")];
  return hsa ? `HSA: ${hsaNames[hsa] ?? hsa} (${hsa})` : "No HSA mapping";
}

function backToNational() {
  params.selectedState = "";
}

const stateFips = computed(() => nameToFips.get(params.selectedState) ?? null);

const stateCounties = computed(() =>
  stateFips.value
    ? objects.counties.geometries.filter(
        (g) => String(g.id).padStart(5, "0").slice(0, 2) === stateFips.value,
      )
    : [],
);
const countyCount = computed(() => stateCounties.value.length);
const hsaCount = computed(() => {
  const set = new Set<string>();
  for (const g of stateCounties.value) {
    const hsa = fipsToHsa[String(g.id).padStart(5, "0")];
    if (hsa) set.add(hsa);
  }
  return set.size;
});

// Parent HSA of the clicked county (counties view only).
const parentHsa = computed(() => {
  if (params.geoType !== "counties" || !lastClicked.value) return null;
  const code = fipsToHsa[String(lastClicked.value.id).padStart(5, "0")];
  return code ? { code, name: hsaNames[code] ?? code } : null;
});

const heading = computed(() =>
  params.selectedState ? params.selectedState : "United States",
);
const subtitle = computed(() => {
  if (params.selectedState)
    return "Counties or HSAs within the state. Click one to see its details.";
  if (params.mixed === "on")
    return `US Health Service Areas with California and Texas merged (${params.renderer} renderer). Click to drill into a state.`;
  return `HSA-level data on county geography (${params.renderer} renderer). Hover a county to outline its HSA; click to drill into its state.`;
});
</script>

<template>
  <Teleport to="#model-sidebar">
    <h2>Map</h2>
    <SelectBox
      v-model="params.selectedState"
      label="State"
      autocomplete
      :options="stateOptions"
    />
    <SelectBox
      v-if="params.selectedState"
      v-model="params.geoType"
      label="Inner geography"
      :options="[
        { value: 'counties', label: 'Counties' },
        { value: 'hsas', label: 'HSAs (Health Service Areas)' },
      ]"
    />
    <ToggleGroup
      v-if="stateHsaView || nationalCountyView"
      v-model="params.hsaDetail"
      label="HSA detail"
      hint="Show county lines inside each HSA. In a state view, “At zoom” hides them until you zoom in 2× (countyBordersMinZoom)."
      :options="hsaDetailOptions"
    />
    <ToggleGroup
      v-if="!params.selectedState"
      v-model="params.fit"
      label="Fit"
      hint="“Tight” crops Alaska’s overhang so the lower-48 fills more of the frame."
      :options="[
        { value: 'full', label: 'Full' },
        { value: 'tight', label: 'Tight' },
      ]"
    />
    <ToggleGroup
      v-if="!params.selectedState"
      v-model="params.mixed"
      label="Levels"
      hint="“Mixed” reports California and Texas as one whole-state estimate (data[].geoType) while the rest of the map stays HSA-level."
      :options="[
        { value: 'off', label: 'HSAs' },
        { value: 'on', label: 'Mixed' },
      ]"
    />
    <ToggleGroup
      v-model="params.cities"
      label="Cities"
      hint="Overlay the capital and biggest cities; zoom in to reveal more (level-of-detail). Colliding labels are dropped."
      :options="[
        { value: 'off', label: 'Off' },
        { value: 'on', label: 'On' },
      ]"
    />
    <ToggleGroup
      v-model="params.labels"
      label="State labels"
      hint="Label each state with its abbreviation — inside the state where it fits, or as a leader-line callout for the small east-coast states."
      :options="[
        { value: 'off', label: 'Off' },
        { value: 'on', label: 'On' },
      ]"
    />
    <ToggleGroup
      v-model="params.outline"
      label="Outline"
      hint="Draw the exterior boundary (theme.outline) on top of interior borders — the national outline, or the state boundary in a state view."
      :options="[
        { value: 'off', label: 'Off' },
        { value: 'on', label: 'On' },
      ]"
    />
    <ToggleGroup
      v-model="params.renderer"
      label="Renderer"
      hint="Canvas rasterizes the whole map (scales to thousands of counties); SVG keeps a DOM node per feature. Switching swaps the backend in place."
      :options="[
        { value: 'canvas', label: 'Canvas' },
        { value: 'svg', label: 'SVG' },
      ]"
    />
  </Teleport>

  <div class="state-map-page">
    <p class="subtitle">{{ subtitle }}</p>

    <div class="layout" :class="{ 'is-state': params.selectedState }">
      <div class="map-container">
        <ChoroplethMap
          :topology="topology"
          :state="params.selectedState"
          :geo-type="mapGeoType"
          :data-geo-type="mapDataGeoType"
          :data="mapData"
          :color-scale="rtColorScale"
          :renderer="params.renderer"
          :focus="focus"
          :focus-zoom="false"
          :cities="cityMarkers"
          :state-labels="params.labels === 'on'"
          :theme="mapTheme"
          zoom
          :county-borders-min-zoom="params.hsaDetail === 'zoom' ? 2 : 1"
          :tight-fit="params.fit === 'tight'"
          :legend="false"
          :menu="false"
          tooltip-trigger="hover"
          @state-click="onMapClick"
          @state-hover="onMapHover"
        >
          <template v-if="nationalCountyView" #tooltip="{ id, name, value }">
            <div class="tooltip-name">{{ name }}</div>
            <div class="tooltip-hsa">{{ tooltipHsaLabel(String(id)) }}</div>
            <div v-if="value != null">Value: {{ value }}</div>
          </template>
        </ChoroplethMap>
      </div>

      <Transition name="panel">
        <aside v-if="params.selectedState" class="info-panel">
          <div class="info-header">
            <h2>{{ heading }}</h2>
            <Button
              variant="secondary"
              class="back-button"
              @click="backToNational"
            >
              ← Back to US
            </Button>
          </div>
          <dl class="info-stats">
            <div>
              <dt>Counties</dt>
              <dd>{{ countyCount }}</dd>
            </div>
            <div>
              <dt>HSAs</dt>
              <dd>{{ hsaCount }}</dd>
            </div>
          </dl>

          <template v-if="params.geoType === 'counties'">
            <h3>Selected county</h3>
            <p v-if="lastClicked" class="info-selection">
              <strong>{{ lastClicked.name }}</strong>
              <span class="muted"> ({{ lastClicked.id }})</span><br />
              <template v-if="parentHsa">
                Parent HSA: {{ parentHsa.name }}
                <span class="muted">({{ parentHsa.code }})</span>
              </template>
              <span v-else class="muted">No HSA mapping for this county.</span>
            </p>
            <p v-else class="muted">
              Click a county on the map to see its details.
            </p>
          </template>
          <template v-else>
            <h3>Selected HSA</h3>
            <p v-if="lastClicked" class="info-selection">
              <strong>{{ lastClicked.name }}</strong>
              <span class="muted"> ({{ lastClicked.id }})</span>
            </p>
            <p v-else class="muted">
              Click an HSA on the map to see its details.
            </p>
          </template>
        </aside>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.state-map-page {
  container-type: inline-size;
  container-name: state-map;
}

.subtitle {
  color: var(--color-text-secondary);
  margin-top: -0.5rem;
  margin-bottom: 1rem;
  max-width: 36rem;
}

/* National view: map fills the width. State view: map shrinks to one third
   of the *container* width (cqi units, not the viewport) and an info panel
   fills the rest. Below the stacking breakpoint the map goes full-width
   instead of shrinking further, so that breakpoint is its effective minimum. */
.layout.is-state {
  display: flex;
  align-items: flex-start;
  gap: 1.5rem;
}

.layout.is-state .map-container {
  flex: 0 0 33cqi;
  min-width: 25cqi;
}

.layout.is-state .info-panel {
  flex: 1 1 0;
  min-width: 0;
}

.info-panel {
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 0.5rem;
  padding: 1rem 1.25rem;
}

.info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.info-header h2 {
  margin: 0;
}

.back-button {
  flex: none;
}

.info-stats {
  display: flex;
  gap: 2.5rem;
  margin: 0 0 1.25rem;
}

.info-stats dt {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

.info-stats dd {
  margin: 0.1rem 0 0;
  font-size: 1.75rem;
  font-weight: 600;
}

.info-selection {
  line-height: 1.5;
}

.muted {
  color: var(--color-text-secondary);
}

.tooltip-name {
  font-weight: 600;
}

.tooltip-hsa {
  opacity: 0.7;
  font-size: 0.85em;
}

/* Stack the info panel below the map when the container is narrow (mobile,
   or a wide sidebar squeezing the column). */
@container state-map (max-width: 600px) {
  .layout.is-state {
    flex-direction: column;
  }

  .layout.is-state .map-container,
  .layout.is-state .info-panel {
    flex: none;
    width: 100%;
    min-width: 0;
  }
}

/* Animate the panel in only; leaving is instant so going back to the
   national map doesn't flash. */
.panel-enter-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.panel-enter-from {
  opacity: 0;
  transform: translateX(8px);
}
</style>
