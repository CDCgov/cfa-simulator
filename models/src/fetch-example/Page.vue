<script setup lang="ts">
import { reactive, ref, watch, computed, onMounted } from "vue";
import { SelectBox, Spinner } from "@cfasim-ui/components";
import { LineChart, DataTable } from "@cfasim-ui/charts";
import type { Series, Area } from "@cfasim-ui/charts";

const MODEL_NAME = "CFA_Pyrenew-PyrenewHEW_COVID";

const BASE_URL = `https://raw.githubusercontent.com/CDCgov/covid19-forecast-hub/main/model-output/${MODEL_NAME}`;

const DIR_URL = `https://api.github.com/repos/CDCgov/covid19-forecast-hub/contents/model-output/${MODEL_NAME}/`;

const FIPS_NAMES: Record<string, string> = {
  "01": "Alabama",
  "02": "Alaska",
  "04": "Arizona",
  "05": "Arkansas",
  "06": "California",
  "08": "Colorado",
  "09": "Connecticut",
  "10": "Delaware",
  "11": "District of Columbia",
  "12": "Florida",
  "13": "Georgia",
  "15": "Hawaii",
  "16": "Idaho",
  "17": "Illinois",
  "18": "Indiana",
  "19": "Iowa",
  "20": "Kansas",
  "21": "Kentucky",
  "22": "Louisiana",
  "23": "Maine",
  "24": "Maryland",
  "25": "Massachusetts",
  "26": "Michigan",
  "27": "Minnesota",
  "28": "Mississippi",
  "29": "Missouri",
  "30": "Montana",
  "31": "Nebraska",
  "32": "Nevada",
  "33": "New Hampshire",
  "34": "New Jersey",
  "35": "New Mexico",
  "36": "New York",
  "37": "North Carolina",
  "38": "North Dakota",
  "39": "Ohio",
  "40": "Oklahoma",
  "41": "Oregon",
  "42": "Pennsylvania",
  "44": "Rhode Island",
  "45": "South Carolina",
  "46": "South Dakota",
  "47": "Tennessee",
  "48": "Texas",
  "49": "Utah",
  "50": "Vermont",
  "51": "Virginia",
  "53": "Washington",
  "54": "West Virginia",
  "55": "Wisconsin",
  "56": "Wyoming",
  US: "US (National)",
};

const TARGETS: { value: string; label: string }[] = [
  { value: "wk inc covid hosp", label: "Weekly hospital admissions" },
  {
    value: "wk inc covid prop ed visits",
    label: "Weekly proportion of ED visits",
  },
];

const TARGET_DATA_URL =
  "https://raw.githubusercontent.com/CDCgov/covid19-forecast-hub/refs/heads/main/target-data/covid-hospital-admissions.csv";

const ACCENT = "#4f46e5";
const ACTUAL_COLOR = "currentColor";

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

interface TargetRow {
  date: string;
  location: string;
  value: number;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const dates = ref<string[]>([]);
const locations = ref<{ value: string; label: string }[]>([]);
const targetData = ref<TargetRow[]>([]);
const initialLoading = ref(true);

const params = reactive({
  date: "",
  location: "",
  target: TARGETS[0].value,
});

const loading = ref(false);
const error = ref<string>();
const rows = ref<ForecastRow[]>([]);

function parseForecastCSV(text: string): ForecastRow[] {
  const lines = text.trim().split("\n");
  const header = lines[0];
  if (!header) return [];
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.replace(/^"|"$/g, ""));
    return {
      output_type: cols[0],
      output_type_id: cols[1],
      value: Number(cols[2]),
      reference_date: cols[3],
      target: cols[4],
      horizon: Number(cols[5]),
      target_end_date: cols[6],
      location: cols[7],
    };
  });
}

function parseTargetCSV(text: string): TargetRow[] {
  const lines = text.trim().split("\n");
  if (!lines[0]) return [];
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.replace(/^"|"$/g, ""));
    return { date: cols[1], value: Number(cols[2]), location: cols[3] };
  });
}

onMounted(async () => {
  try {
    const [dirResp, targetResp] = await Promise.all([
      fetch(DIR_URL),
      fetch(TARGET_DATA_URL),
    ]);
    if (!dirResp.ok) throw new Error(`HTTP ${dirResp.status}`);
    const files: { name: string }[] = await dirResp.json();
    const suffix = `-${MODEL_NAME}.csv`;
    dates.value = files
      .map((f) => f.name)
      .filter((n) => n.endsWith(suffix))
      .map((n) => n.replace(suffix, ""))
      .sort()
      .reverse();

    if (targetResp.ok) {
      targetData.value = parseTargetCSV(await targetResp.text());
    }

    if (!dates.value.length) return;

    const csvResp = await fetch(
      `${BASE_URL}/${dates.value[0]}-${MODEL_NAME}.csv`,
    );
    if (!csvResp.ok) throw new Error(`HTTP ${csvResp.status}`);
    const allRows = parseForecastCSV(await csvResp.text());
    const codes = [...new Set(allRows.map((r) => r.location))].sort();
    locations.value = codes.map((c) => ({
      value: c,
      label: FIPS_NAMES[c] ?? c,
    }));

    params.location = codes.includes("US") ? "US" : codes[0];
    params.date = dates.value[0];
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    initialLoading.value = false;
  }
});

watch(
  () => ({ ...params }),
  async ({ date, location, target }) => {
    if (!date) return;
    loading.value = true;
    error.value = undefined;
    try {
      const url = `${BASE_URL}/${date}-${MODEL_NAME}.csv`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      rows.value = parseForecastCSV(text).filter(
        (r) =>
          r.location === location &&
          r.target === target &&
          r.output_type === "quantile",
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

// Build a date-based timeline: forecast target_end_dates ± 7 days
const forecastDateMap = computed(() => {
  const map = new Map<string, ForecastRow[]>();
  for (const r of rows.value) {
    const existing = map.get(r.target_end_date) ?? [];
    existing.push(r);
    map.set(r.target_end_date, existing);
  }
  return map;
});

const timeline = computed(() => {
  const forecastDates = [...forecastDateMap.value.keys()].sort();
  if (!forecastDates.length) return [];
  const earliest = forecastDates[0];
  const latest = forecastDates[forecastDates.length - 1];
  const allDates = new Set(forecastDates);
  // Add previous month of weekly dates (up to 4 weeks before), no dates after forecast
  for (let w = 1; w <= 4; w++) {
    allDates.add(shiftDate(earliest, -7 * w));
  }
  // Also include any actual data dates in between that align to the weekly cadence
  const actual = actualByDate.value;
  const cutoff = latest;
  const start = shiftDate(earliest, -28);
  for (const date of actual.keys()) {
    if (date >= start && date <= cutoff) allDates.add(date);
  }
  return [...allDates].sort();
});

const actualByDate = computed(() => {
  const map = new Map<string, number>();
  for (const r of targetData.value) {
    if (r.location === params.location) map.set(r.date, r.value);
  }
  return map;
});

const medianSeries = computed<Series[]>(() => {
  const tl = timeline.value;
  if (!tl.length) return [];
  const forecastMap = forecastDateMap.value;
  const forecastData = tl.map((date) => {
    const fRows = forecastMap.get(date);
    const med = fRows?.find((r) => r.output_type_id === "0.5");
    return med ? med.value : NaN;
  });
  const series: Series[] = [
    { data: forecastData, color: ACCENT, strokeWidth: 3 },
  ];
  // Only show actual data line for hospital admissions target
  if (params.target === "wk inc covid hosp") {
    const actual = actualByDate.value;
    const actualData = tl.map((date) => actual.get(date) ?? NaN);
    if (actualData.some(isFinite)) {
      series.push({
        data: actualData,
        color: ACTUAL_COLOR,
        strokeWidth: 1,
      });
    }
  }
  return series;
});

function quantileData(id: string): number[] {
  const forecastMap = forecastDateMap.value;
  return timeline.value.map((date) => {
    const fRows = forecastMap.get(date);
    const row = fRows?.find((r) => r.output_type_id === id);
    return row ? row.value : NaN;
  });
}

const bandAreas = computed<Area[]>(() => {
  if (!timeline.value.length) return [];
  return QUANTILE_BANDS.map(([lo, hi, opacity]) => ({
    upper: quantileData(hi),
    lower: quantileData(lo),
    color: ACCENT,
    opacity,
  }));
});

const xLabels = computed(() => timeline.value.map(formatDate));

const tableData = computed(() => {
  const forecastDates = [...forecastDateMap.value.keys()].sort();
  if (!forecastDates.length) return null;
  const isProp = isProportionTarget.value;
  const fmt = isProp
    ? new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      })
    : new Intl.NumberFormat();
  const fmtVal = isProp
    ? (v: number) => fmt.format(v)
    : (v: number) => fmt.format(Math.round(v));
  const forecastMap = forecastDateMap.value;
  const actual = actualByDate.value;
  const values = forecastDates.map((date) => {
    const fRows = forecastMap.get(date) ?? [];
    const med = fRows.find((r) => r.output_type_id === "0.5")?.value ?? 0;
    const lo = fRows.find((r) => r.output_type_id === "0.025")?.value ?? 0;
    const hi = fRows.find((r) => r.output_type_id === "0.975")?.value ?? 0;
    return `${fmtVal(med)} (${fmtVal(lo)}–${fmtVal(hi)})`;
  });
  const observed = forecastDates.map((date) => {
    const v = actual.get(date);
    return v != null ? fmtVal(v) : "—";
  });
  const result: Record<string, (string | number)[]> = {
    target_end_date: forecastDates,
    forecast: values,
  };
  if (params.target === "wk inc covid hosp") result.observed = observed;
  return result;
});

const locationLabel = computed(
  () => FIPS_NAMES[params.location] ?? params.location,
);

const targetLabel = computed(
  () => TARGETS.find((t) => t.value === params.target)?.label ?? params.target,
);

const isProportionTarget = computed(
  () => params.target === "wk inc covid prop ed visits",
);

const yLabel = computed(() =>
  isProportionTarget.value
    ? "Proportion of ED visits"
    : "Weekly hospital admissions",
);
</script>

<template>
  <Teleport to="#model-sidebar">
    <h2>Parameters</h2>
    <SelectBox
      v-model="params.date"
      label="Reference date"
      :options="dates.map((d) => ({ value: d, label: d }))"
    />
    <SelectBox v-model="params.target" label="Target" :options="TARGETS" />
    <SelectBox
      v-model="params.location"
      label="Location"
      :options="locations"
    />
  </Teleport>
  <h1>COVID-19 {{ targetLabel }} — {{ locationLabel }}</h1>
  <p class="subtitle">CFA Pyrenew forecast for {{ params.date }}</p>
  <Spinner v-if="loading || initialLoading" />
  <p v-else-if="error" style="color: red">{{ error }}</p>
  <template v-else>
    <LineChart
      v-if="medianSeries.length"
      :series="medianSeries"
      :areas="bandAreas"
      :height="400"
      :y-min="0"
      :x-labels="xLabels"
      x-label="Week ending"
      :y-label="yLabel"
    />
    <p v-if="medianSeries.length" class="legend">
      <span class="swatch" :style="{ background: ACCENT }" /> Forecast
      <template v-if="params.target === 'wk inc covid hosp'">
        <span class="swatch" :style="{ background: ACTUAL_COLOR }" />
        Observed
      </template>
    </p>
    <DataTable
      v-if="tableData"
      :data="tableData"
      :column-config="{
        target_end_date: { label: 'Week ending' },
        forecast: { label: `Forecast ${yLabel} (95% CI)` },
        ...(params.target === 'wk inc covid hosp'
          ? { observed: { label: 'Observed', width: 'small' } }
          : {}),
      }"
    />
  </template>
</template>

<style scoped>
.subtitle {
  color: var(--color-text-secondary);
  margin-top: -0.5rem;
  margin-bottom: 1rem;
}

.legend {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.swatch {
  display: inline-block;
  width: 1rem;
  height: 3px;
  border-radius: 1px;
}
</style>
