<script setup lang="ts">
import { reactive, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { NumberInput, Button } from "@cfasim-ui/components";
import { LineChart, DataTable } from "@cfasim-ui/charts";
import { useModel } from "@cfasim-ui/wasm";
import { useUrlParams } from "@cfasim-ui/shared";

// Keys are passed positionally to `simulate` (via Object.values on the
// reactive params), so they must match the Rust signature order in
// `model/src/lib.rs`.
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
const { outputs, error } = useOutputs("simulate", params);

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
const chartSeries = computed(() => {
  const s = outputs.value?.series;
  if (!s) return [];
  const isFan = (n: string) =>
    n.startsWith("cumulative_infections_") &&
    /^cumulative_infections_\d+$/.test(n);
  const fan = s.names.filter(isFan).map((n) => ({
    data: s.column(n),
    color: "#2563eb",
    opacity: 0.2,
  }));
  return [
    ...fan,
    {
      data: s.column("cumulative_infections_median"),
      color: "#f87171",
      strokeWidth: 2,
      legend: "Median observed",
    },
    {
      data: s.column("cumulative_infections_expected"),
      legend: "Expected (deterministic SIR)",
      dashed: true,
    },
  ];
});

// Summary stats are computed in Rust (`model/src/stats.rs`) and exposed as
// a length-1 ModelOutput called `summary`. Each observed metric is reported
// as a 95% credible interval (linear-interp median, nearest-interp 2.5/97.5
// percentiles) across the n_simulations runs.
const summary = computed(() => {
  const s = outputs.value?.summary;
  if (!s) return null;
  const get = (name: string) => s.column(name)[0];
  const fmtR0 = (v: number) =>
    Number.isFinite(v) ? (v as number).toFixed(2) : "—";
  const fmtAr = (v: number) =>
    Number.isFinite(v) ? `${((v as number) * 100).toFixed(1)}%` : "—";
  const fmtCi = (
    med: number,
    lo: number,
    hi: number,
    fmt: (v: number) => string,
  ) => (Number.isFinite(med) ? `${fmt(med)} (${fmt(lo)}–${fmt(hi)})` : "—");
  return {
    metric: ["R₀", "Attack rate"],
    observed: [
      fmtCi(
        get("r0_observed_median"),
        get("r0_observed_lo"),
        get("r0_observed_hi"),
        fmtR0,
      ),
      fmtCi(
        get("attack_rate_observed_median"),
        get("attack_rate_observed_lo"),
        get("attack_rate_observed_hi"),
        fmtAr,
      ),
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
    Stochastic SIR epidemic simulated with the
    <a
      href="https://github.com/CDCgov/ixa"
      target="_blank"
      rel="noopener noreferrer"
      >ixa</a
    >
    agent-based modelling framework, compiled to WebAssembly. Each newly
    infectious person schedules their own recovery and their own next
    exponential transmission attempt; targets are picked uniformly from the
    population. The chart shows cumulative infections over time.
  </p>
  <p v-if="error" style="color: red">{{ error }}</p>
  <LineChart
    v-if="chartSeries.length"
    :series="chartSeries"
    :height="400"
    x-label="Time"
    y-label="Cumulative infections"
    tooltip-trigger="hover"
  >
    <template #tooltip="{ xLabel, values }">
      <div
        style="display: flex; flex-direction: column; gap: 4px; min-width: 9rem"
      >
        <div v-if="xLabel" style="font-weight: 500">{{ xLabel }}</div>
        <div style="display: flex; justify-content: space-between; gap: 12px">
          <span style="color: #f87171">Median</span>
          <span>{{ fmtCount(values[values.length - 2]?.value) }}</span>
        </div>
        <div style="display: flex; justify-content: space-between; gap: 12px">
          <span>Expected</span>
          <span>{{ fmtCount(values[values.length - 1]?.value) }}</span>
        </div>
      </div>
    </template>
  </LineChart>
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
