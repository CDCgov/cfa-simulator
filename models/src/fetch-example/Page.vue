<script setup lang="ts">
import { ref, watch, computed, onMounted } from "vue";
import { SelectBox, Toggle, Spinner } from "@cfasim-ui/components";
import { ChoroplethMap } from "@cfasim-ui/charts";
import type { StateData } from "@cfasim-ui/charts";
import usStates from "us-atlas/states-10m.json";
import usCounties from "us-atlas/counties-10m.json";
import type { Topology } from "topojson-specification";

type Metric = "covid" | "influenza";

interface WeekData {
  state: Record<string, Record<Metric, number | null>>;
  hsa: Record<string, Record<Metric, number | null>>;
}

const BASE = import.meta.env.BASE_URL;

const loading = ref(true);
const weeks = ref<string[]>([]);
const selectedWeek = ref("");
const metric = ref<Metric>("covid");
const countyLevel = ref(true);
const fipsToHsaNci = ref<Record<string, string>>({});
const weekData = ref<WeekData | null>(null);
const weekLoading = ref(false);

const weekCache = new Map<string, WeekData>();

async function loadWeek(week: string): Promise<WeekData> {
  const cached = weekCache.get(week);
  if (cached) return cached;
  const resp = await fetch(`${BASE}data/weeks/${week}.json`);
  const data: WeekData = await resp.json();
  weekCache.set(week, data);
  return data;
}

onMounted(async () => {
  const [manifest, fipsMap] = await Promise.all([
    fetch(`${BASE}data/manifest.json`).then((r) => r.json()),
    fetch(`${BASE}data/fips_to_hsa_nci.json`).then((r) => r.json()),
  ]);
  weeks.value = manifest.weeks;
  fipsToHsaNci.value = fipsMap;
  selectedWeek.value = weeks.value[weeks.value.length - 1];

  weekData.value = await loadWeek(selectedWeek.value);
  loading.value = false;
});

watch(selectedWeek, async (week) => {
  if (!week || loading.value) return;
  weekLoading.value = true;
  weekData.value = await loadWeek(week);
  weekLoading.value = false;
});

const weekOptions = computed(() =>
  weeks.value.map((w) => ({ value: w, label: w })),
);

const mapData = computed<StateData[]>(() => {
  if (!weekData.value) return [];

  if (!countyLevel.value) {
    const data: StateData[] = [];
    for (const [name, entry] of Object.entries(weekData.value.state)) {
      const v = entry[metric.value];
      if (v != null) data.push({ id: name, value: v });
    }
    return data;
  }

  // County mode: map each county FIPS -> its HSA NCI ID -> value
  const hsaData = weekData.value.hsa;
  const data: StateData[] = [];
  for (const [fips, nciId] of Object.entries(fipsToHsaNci.value)) {
    const v = hsaData[nciId]?.[metric.value];
    if (v != null) data.push({ id: fips, value: v });
  }
  return data;
});

const geoType = computed(() => (countyLevel.value ? "counties" : "states"));
const topology = computed<Topology>(
  () => (countyLevel.value ? usCounties : usStates) as unknown as Topology,
);

const metricLabel = computed(() =>
  metric.value === "covid" ? "COVID" : "Influenza",
);

const title = computed(
  () => `% ED visits — ${metricLabel.value} — ${selectedWeek.value}`,
);

function formatTooltip(data: {
  name: string;
  value?: number | string;
}): string {
  const label = metric.value === "covid" ? "COVID" : "influenza";
  if (data.value != null) {
    return `<strong>${data.name}</strong><br>${data.value}% of ED visits were ${label}`;
  }
  return `<strong>${data.name}</strong><br>No data`;
}
</script>

<template>
  <Teleport to="#model-sidebar">
    <h2>Parameters</h2>
    <SelectBox
      v-model="metric"
      label="Metric"
      :options="[
        { value: 'covid', label: 'COVID' },
        { value: 'influenza', label: 'Influenza' },
      ]"
    />
    <Toggle v-model="countyLevel" label="County-level (HSA)" />
    <SelectBox
      v-model="selectedWeek"
      label="Week ending"
      :options="weekOptions"
    />
  </Teleport>
  <h1>NSSP Emergency Department Visits</h1>
  <p class="subtitle">Percent of ED visits — {{ metricLabel }}</p>
  <Spinner v-if="loading || weekLoading" />
  <ChoroplethMap
    v-else
    :topology="topology"
    :data="mapData"
    :geo-type="geoType"
    :title="title"
    :zoom="countyLevel"
    :pan="countyLevel"
    legend-title="% visits"
    tooltip-trigger="hover"
    :tooltip-format="formatTooltip"
  />
</template>

<style scoped>
.subtitle {
  color: var(--color-text-secondary);
  margin-top: -0.5rem;
  margin-bottom: 1rem;
}
</style>
