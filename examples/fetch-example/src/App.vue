<script setup lang="ts">
import { reactive, ref, watch, computed } from "vue";
import { SidebarLayout, SelectBox, Spinner } from "@cfasim-ui/components";
import { LineChart, DataTable } from "@cfasim-ui/charts";
import type { Series, Area } from "@cfasim-ui/charts";

const BASE_URL =
  "https://raw.githubusercontent.com/CDCgov/covid19-forecast-hub/main/model-output/CovidHub-ensemble";

const DATES = [
  "2026-03-21",
  "2026-03-14",
  "2026-03-07",
  "2026-02-28",
  "2026-02-21",
  "2026-02-14",
  "2026-02-07",
  "2026-01-31",
  "2026-01-24",
  "2026-01-17",
  "2026-01-10",
  "2026-01-03",
  "2025-12-27",
  "2025-12-20",
  "2025-12-13",
];

const LOCATIONS: { value: string; label: string }[] = [
  { value: "US", label: "US (National)" },
  { value: "06", label: "California" },
  { value: "36", label: "New York" },
  { value: "48", label: "Texas" },
  { value: "12", label: "Florida" },
  { value: "17", label: "Illinois" },
  { value: "42", label: "Pennsylvania" },
  { value: "39", label: "Ohio" },
  { value: "13", label: "Georgia" },
  { value: "37", label: "North Carolina" },
  { value: "26", label: "Michigan" },
  { value: "01", label: "Alabama" },
  { value: "04", label: "Arizona" },
  { value: "08", label: "Colorado" },
  { value: "25", label: "Massachusetts" },
  { value: "53", label: "Washington" },
];

const ACCENT = "#4f46e5";

const QUANTILE_BANDS: [string, string, number][] = [["0.025", "0.975", 0.2]];

interface ForecastRow {
  reference_date: string;
  location: string;
  horizon: number;
  target: string;
  target_end_date: string;
  output_type: string;
  output_type_id: string;
  value: number;
}

const params = reactive({
  date: DATES[0],
  location: "US",
});

const loading = ref(false);
const error = ref<string>();
const rows = ref<ForecastRow[]>([]);

function parseCSV(text: string): ForecastRow[] {
  const lines = text.trim().split("\n");
  const header = lines[0];
  if (!header) return [];
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.replace(/^"|"$/g, ""));
    return {
      reference_date: cols[0],
      location: cols[1],
      horizon: Number(cols[2]),
      target: cols[3],
      target_end_date: cols[4],
      output_type: cols[5],
      output_type_id: cols[6],
      value: Number(cols[7]),
    };
  });
}

watch(
  () => ({ ...params }),
  async ({ date, location }) => {
    loading.value = true;
    error.value = undefined;
    try {
      const url = `${BASE_URL}/${date}-CovidHub-ensemble.csv`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      rows.value = parseCSV(text).filter(
        (r) => r.location === location && r.output_type === "quantile",
      );
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      rows.value = [];
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

const horizons = computed(() =>
  [...new Set(rows.value.map((r) => r.horizon))].sort((a, b) => a - b),
);

const targetEndDates = computed(() => {
  const map = new Map<number, string>();
  for (const r of rows.value) map.set(r.horizon, r.target_end_date);
  return map;
});

const medianSeries = computed<Series[]>(() => {
  const h = horizons.value;
  if (!h.length) return [];
  const data = h.map((horizon) => {
    const row = rows.value.find(
      (r) => r.horizon === horizon && r.output_type_id === "0.5",
    );
    return row?.value ?? 0;
  });
  return [{ data, color: ACCENT, strokeWidth: 3 }];
});

function quantileData(id: string): number[] {
  return horizons.value.map((horizon) => {
    const row = rows.value.find(
      (r) => r.horizon === horizon && r.output_type_id === id,
    );
    return row?.value ?? 0;
  });
}

const bandAreas = computed<Area[]>(() => {
  if (!horizons.value.length) return [];
  return QUANTILE_BANDS.map(([lo, hi, opacity]) => ({
    upper: quantileData(hi),
    lower: quantileData(lo),
    color: ACCENT,
    opacity,
  }));
});

const tableData = computed(() => {
  const h = horizons.value;
  if (!h.length) return null;
  const dates = h.map((hz) => targetEndDates.value.get(hz) ?? "");
  const fmt = new Intl.NumberFormat();
  const admissions = h.map((hz) => {
    const med = Math.round(
      rows.value.find((r) => r.horizon === hz && r.output_type_id === "0.5")
        ?.value ?? 0,
    );
    const lo = Math.round(
      rows.value.find((r) => r.horizon === hz && r.output_type_id === "0.025")
        ?.value ?? 0,
    );
    const hi = Math.round(
      rows.value.find((r) => r.horizon === hz && r.output_type_id === "0.975")
        ?.value ?? 0,
    );
    return `${fmt.format(med)} (${fmt.format(lo)}–${fmt.format(hi)})`;
  });
  return {
    target_end_date: dates,
    horizon: h,
    admissions,
  };
});

const locationLabel = computed(
  () => LOCATIONS.find((l) => l.value === params.location)?.label ?? "US",
);
</script>

<template>
  <SidebarLayout>
    <template #sidebar>
      <h2>COVID-19 Forecast</h2>
      <SelectBox
        v-model="params.date"
        label="Reference date"
        :options="DATES.map((d) => ({ value: d, label: d }))"
      />
      <SelectBox
        v-model="params.location"
        label="Location"
        :options="LOCATIONS"
      />
    </template>
    <h1>COVID-19 Hospital Admissions — {{ locationLabel }}</h1>
    <p class="subtitle">CovidHub-ensemble forecast for {{ params.date }}</p>
    <Spinner v-if="loading" />
    <p v-else-if="error" style="color: red">{{ error }}</p>
    <template v-else>
      <LineChart
        v-if="medianSeries.length"
        :series="medianSeries"
        :areas="bandAreas"
        :height="400"
        :y-min="0"
        x-label="Horizon (weeks)"
        y-label="Weekly hospital admissions"
      />
      <DataTable
        v-if="tableData"
        :data="tableData"
        :column-config="{
          target_end_date: { label: 'Week ending' },
          horizon: { label: 'Horizon', width: 'small' },
          admissions: { label: 'Median weekly hospital admissions (95% CI)' },
        }"
      />
    </template>
  </SidebarLayout>
</template>

<style scoped>
.subtitle {
  color: var(--color-text-secondary);
  margin-top: -0.5rem;
  margin-bottom: 1rem;
}
</style>
