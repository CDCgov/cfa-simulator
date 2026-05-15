<script setup lang="ts">
import { reactive, computed, ref, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { NumberInput, Button } from "@cfasim-ui/components";
import { LineChart, DataTable } from "@cfasim-ui/charts";
import { useModel } from "@cfasim-ui/wasm";
import { useUrlParams } from "@cfasim-ui/shared";
import type { TypedColumn } from "@cfasim-ui/shared";

const defaults = {
  infectionRate: 0.5,
  infectiousPeriod: 3.0,
  population: 1000,
  initialInfections: 5,
  seed: 0,
  maxTime: 100,
  nSimulations: 20,
};
const params = reactive({ ...defaults });
const { reset } = useUrlParams(params, defaults, {
  router: useRouter(),
  route: useRoute(),
});
const { useOutputs } = useModel("ixa_example");
// Bundle params as a JSON string so Rust deserializes a single `SimulateArgs`
// struct (see `model/src/lib.rs`) instead of receiving each field positionally.
const simArgs = computed(() => ({ json: JSON.stringify(params) }));
const { outputs, error, loading } = useOutputs("simulate", simArgs);

// Show a "running" message only if a sim run is still in flight after 500ms,
// so quick re-runs don't flash a message on every slider tick.
const showLoading = ref(false);
let loadingTimer: ReturnType<typeof setTimeout> | undefined;
watch(loading, (l) => {
  clearTimeout(loadingTimer);
  if (l) {
    loadingTimer = setTimeout(() => (showLoading.value = true), 500);
  } else {
    showLoading.value = false;
  }
});

// Live-update sliders only while the total work (population × runs) is
// small enough that each re-run is cheap; above that, fall back to
// commit-on-blur to keep the UI responsive while dragging.
const live = computed(() => params.nSimulations * params.population <= 20000);

function fmtCount(v: number | undefined): string {
  return v != null && Number.isFinite(v) ? Math.round(v).toLocaleString() : "—";
}

// Chart layers, in render order:
//   1. The N stochastic trajectories as a translucent blue "fan" (no legend).
//   2. The pointwise median across the fan (computed in Rust, exposed as
//      `cumulative_infections_median`).
//   3. The deterministic SIR ODE trajectory (dashed).
// Filtering by column name handles re-runs where nSimulations has changed
// and the wasm output has more/fewer trajectories than before.
const isFanColumn = (n: string) => /^cumulative_infections_\d+$/.test(n);

// Incidence = first differences of the cumulative curves. The cumulative
// columns are forward-filled at integer time bins, so incidence[t] is the
// number of new infections during the interval (t-1, t]. incidence[0] is
// defined as 0 to keep array lengths aligned with the time axis.
function diff(arr: ArrayLike<number>): number[] {
  const out = new Array(arr.length);
  out[0] = 0;
  for (let i = 1; i < arr.length; i++) out[i] = arr[i] - arr[i - 1];
  return out;
}

function buildSeries(transform: (col: TypedColumn) => TypedColumn | number[]) {
  const s = outputs.value?.series;
  if (!s) return [];
  const fan = s.names.filter(isFanColumn).map((n) => ({
    data: transform(s.column(n)),
    color: "#2563eb",
    opacity: 0.2,
  }));
  return [
    ...fan,
    {
      data: transform(s.column("cumulative_infections_median")),
      color: "#f87171",
      strokeWidth: 2,
      legend: "Median observed",
    },
    {
      data: transform(s.column("cumulative_infections_expected")),
      legend: "Expected (deterministic SIR)",
      dashed: true,
    },
  ];
}

const charts = computed(() => [
  {
    series: buildSeries((c) => c),
    yLabel: "Cumulative infections",
    height: 400,
  },
  {
    series: buildSeries(diff),
    yLabel: "Incidence (new infections per time unit)",
    height: 300,
  },
]);

// Summary stats are computed in Rust (`model/src/stats.rs`) and exposed as
// a length-1 ModelOutput called `summary`. Observed values are the median
// across the n_simulations runs.
const summary = computed(() => {
  const s = outputs.value?.summary;
  if (!s) return null;
  const get = (name: string) => s.column(name)[0];
  const fmtR0 = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : "—");
  const fmtAr = (v: number) =>
    Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : "—";
  return {
    metric: ["R₀", "Attack rate"],
    observed: [
      fmtR0(get("r0_observed_median")),
      fmtAr(get("attack_rate_observed_median")),
    ],
    expected: [fmtR0(get("r0_expected")), fmtAr(get("attack_rate_expected"))],
  };
});
</script>

<template>
  <Teleport to="#model-sidebar">
    <Button variant="secondary" @click="reset">Reset</Button>
    <h2>Parameters</h2>
    <NumberInput
      v-model="params.infectionRate"
      label="Infection rate"
      slider
      :live="live"
      :min="0.05"
      :max="2"
      :step="0.05"
    />
    <NumberInput
      v-model="params.infectiousPeriod"
      label="Infectious period"
      slider
      :live="live"
      :min="1"
      :max="14"
      :step="0.5"
    />
    <NumberInput
      v-model="params.population"
      label="Population"
      :min="10"
      :max="100000"
    />
    <NumberInput
      v-model="params.initialInfections"
      label="Initial infections"
      :min="1"
    />
    <NumberInput v-model="params.seed" label="Seed" :min="0" />
    <NumberInput v-model="params.maxTime" label="Max time" :min="1" />
    <NumberInput
      v-model="params.nSimulations"
      label="Number of simulations"
      :min="1"
      :max="100"
    />
  </Teleport>
  <h1>Ixa Example</h1>
  <p>
    Stochastic SIR model simulated with the
    <a
      href="https://github.com/CDCgov/ixa"
      target="_blank"
      rel="noopener noreferrer"
      >ixa</a
    >. Each newly infectious person schedules their own recovery and their own
    next transmission attempt; targets are picked uniformly from the population.
  </p>
  <p v-if="error" class="error">{{ error }}</p>
  <p v-if="showLoading" class="loading">Running simulation…</p>
  <template v-for="chart in charts" :key="chart.yLabel">
    <LineChart
      v-if="chart.series.length"
      :series="chart.series"
      :height="chart.height"
      x-label="Time"
      :y-label="chart.yLabel"
      tooltip-trigger="hover"
    >
      <template #tooltip="{ xLabel, values }">
        <div class="chart-tooltip">
          <div v-if="xLabel" class="chart-tooltip-label">{{ xLabel }}</div>
          <div class="chart-tooltip-row">
            <span class="chart-tooltip-median">Median</span>
            <span>{{ fmtCount(values[values.length - 2]?.value) }}</span>
          </div>
          <div class="chart-tooltip-row">
            <span>Expected</span>
            <span>{{ fmtCount(values[values.length - 1]?.value) }}</span>
          </div>
        </div>
      </template>
    </LineChart>
  </template>
  <DataTable
    v-if="summary"
    :data="summary"
    :column-config="{
      metric: { label: 'Metric' },
      observed: { label: 'Observed', align: 'right' },
      expected: { label: 'Expected', align: 'right' },
    }"
    :menu="false"
  />
</template>

<style scoped>
.error {
  color: red;
}
.loading {
  color: var(--cfa-color-text-muted, #666);
  font-style: italic;
}
.chart-tooltip {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 9rem;
}
.chart-tooltip-label {
  font-weight: 500;
}
.chart-tooltip-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.chart-tooltip-median {
  color: #f87171;
}
</style>
