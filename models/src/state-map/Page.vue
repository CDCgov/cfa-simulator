<script setup lang="ts">
import { ref, reactive, computed, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { SelectBox, Button } from "@cfasim-ui/components";
import { ChoroplethMap } from "@cfasim-ui/charts";
import type { StateData, FocusItem, GeoType } from "@cfasim-ui/charts";
import { fipsToHsa } from "@cfasim-ui/charts/hsa-mapping";
import { useUrlParams } from "@cfasim-ui/shared";
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
// geoMercator fallback (geoAlbersUsa can't project them) is demoable.
const stateOptions = objects.states.geometries
  .map((g) => ({ value: g.properties.name, label: g.properties.name }))
  .sort((a, b) => a.label.localeCompare(b.label));

// Deterministic synthetic values so each map has something to color.
const pseudo = (id: string | number): number =>
  parseInt(String(id).slice(-3) || "0", 10) % 100;

const countyData: StateData[] = objects.counties.geometries.map((g) => ({
  id: String(g.id).padStart(5, "0"),
  value: pseudo(g.id),
}));

const hsaData: StateData[] = [...new Set(Object.values(fipsToHsa))].map(
  (code) => ({ id: code, value: pseudo(code) }),
);

const defaults = {
  selectedState: "California",
  geoType: "counties" as GeoType,
};
const params = reactive({ ...defaults });
const { reset } = useUrlParams(params, defaults, {
  router: useRouter(),
  route: useRoute(),
});

const focus = ref<FocusItem | null>(null);

// Clear the highlight whenever the map's subject changes.
watch(
  () => [params.selectedState, params.geoType],
  () => {
    focus.value = null;
  },
);

// Click a county → outline its parent HSA as a cross-geoType overlay.
// In HSA mode, clicking just focuses the HSA itself.
function onStateClick(payload: { id: string }) {
  if (params.geoType === "counties") {
    const hsa = fipsToHsa[String(payload.id).padStart(5, "0")];
    focus.value = hsa ? { id: hsa, geoType: "hsas", stroke: "#111" } : null;
  } else {
    focus.value = { id: payload.id, geoType: "hsas" };
  }
}

const mapData = computed(() =>
  params.geoType === "hsas" ? hsaData : countyData,
);

const title = computed(
  () =>
    `${params.selectedState} — ${params.geoType === "hsas" ? "HSAs" : "counties"}`,
);
</script>

<template>
  <Teleport to="#model-sidebar">
    <Button variant="secondary" @click="reset">Reset</Button>
    <h2>Map</h2>
    <SelectBox
      v-model="params.selectedState"
      label="State"
      autocomplete
      :options="stateOptions"
    />
    <SelectBox
      v-model="params.geoType"
      label="Inner geography"
      :options="[
        { value: 'counties', label: 'Counties' },
        { value: 'hsas', label: 'HSAs (Health Service Areas)' },
      ]"
    />
    <Button v-if="focus" variant="secondary" @click="focus = null">
      Clear highlight
    </Button>
  </Teleport>
  <h1>State-level map</h1>
  <p class="subtitle">
    One state's outline filled with its counties or HSAs. Click a county to
    highlight its parent HSA.
  </p>
  <ChoroplethMap
    :topology="topology"
    :state="params.selectedState"
    :geo-type="params.geoType"
    :data="mapData"
    :focus="focus"
    :pan="true"
    :title="title"
    legend-title="Value"
    tooltip-trigger="hover"
    @state-click="onStateClick"
  />
</template>

<style scoped>
.subtitle {
  color: var(--color-text-secondary);
  margin-top: -0.5rem;
  margin-bottom: 1rem;
  max-width: 36rem;
}
</style>
