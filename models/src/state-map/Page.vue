<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { SelectBox, Button } from "@cfasim-ui/components";
import { ChoroplethMap } from "@cfasim-ui/charts";
import type { StateData, GeoType, FocusValue } from "@cfasim-ui/charts";
import { fipsToHsa, hsaNames } from "@cfasim-ui/charts/hsa-mapping";
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

// Deterministic synthetic values so each map has something to color.
const pseudo = (id: string | number): number =>
  parseInt(String(id).slice(-3) || "0", 10) % 100;

const stateData: StateData[] = objects.states.geometries.map((g) => ({
  id: String(g.id).padStart(2, "0"),
  value: pseudo(g.id),
}));
const countyData: StateData[] = objects.counties.geometries.map((g) => ({
  id: String(g.id).padStart(5, "0"),
  value: pseudo(g.id),
}));
const hsaData: StateData[] = [...new Set(Object.values(fipsToHsa))].map(
  (code) => ({ id: code, value: pseudo(code) }),
);

const defaults = {
  // Empty = national view; a state name drills into that state.
  selectedState: "",
  geoType: "counties" as GeoType,
};
const { params } = useModelParams(defaults);

const lastClicked = ref<{ id: string; name: string } | null>(null);
const focus = ref<FocusValue>(null);

// Clear the selection/highlight whenever the map's subject changes.
watch(
  () => [params.selectedState, params.geoType],
  () => {
    lastClicked.value = null;
    focus.value = null;
  },
);

// National view shows clickable states; a state view shows its counties/HSAs.
const mapGeoType = computed<GeoType>(() =>
  params.selectedState ? params.geoType : "states",
);
const mapData = computed(() => {
  if (!params.selectedState) return stateData;
  return params.geoType === "hsas" ? hsaData : countyData;
});

function onMapClick(payload: { id: string; name: string }) {
  if (!params.selectedState) {
    // National view: drill into the clicked state.
    params.selectedState = payload.name;
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
const subtitle = computed(() =>
  params.selectedState
    ? "Counties or HSAs within the state. Click one to see its details."
    : "Click a state to zoom into its counties or HSAs.",
);
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
  </Teleport>

  <div class="state-map-page">
    <p class="subtitle">{{ subtitle }}</p>

    <div class="layout" :class="{ 'is-state': params.selectedState }">
      <div class="map-container">
        <ChoroplethMap
          :topology="topology"
          :state="params.selectedState"
          :geo-type="mapGeoType"
          :data="mapData"
          :focus="focus"
          :focus-zoom="false"
          :legend="false"
          :menu="false"
          :zoom="false"
          tooltip-trigger="hover"
          @state-click="onMapClick"
        />
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
