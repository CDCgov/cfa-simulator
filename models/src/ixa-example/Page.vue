<script setup lang="ts">
import { reactive, computed, ref, watch, onScopeDispose } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  NumberInput,
  Button,
  Toggle,
  ParamEditor,
} from "@cfasim-ui/components";
import type { ParamEditorValue } from "@cfasim-ui/components";
import { LineChart, DataTable } from "@cfasim-ui/charts";
import type { ChartAnnotation } from "@cfasim-ui/charts";
import { runWasm, cancelWasm } from "@cfasim-ui/wasm";
import { useUrlParams, ModelOutput } from "@cfasim-ui/shared";
import type { ColumnDescriptor, TypedColumn } from "@cfasim-ui/shared";

const defaults = {
  infectionRate: 0.5,
  infectiousPeriod: 3.0,
  population: 10000,
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

// When `useEditor` is on, the sidebar shows a JSON/TOML/YAML editor
// instead of the per-field NumberInput form. Both views share the same
// underlying `params` so users can flip back and forth.
const useEditor = ref(false);

function applyParamUpdate(next: ParamEditorValue) {
  // Only assign keys we know about, coercing each one to its default's
  // type so a string "0.5" from a hand-typed JSON value still flows
  // through to the wasm model as a number.
  for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
    if (!(key in next)) continue;
    const raw = next[key];
    const coerced = typeof defaults[key] === "number" ? Number(raw) : raw;
    if (typeof coerced === "number" && Number.isFinite(coerced)) {
      (params as Record<string, unknown>)[key] = coerced;
    }
  }
}
// Workload threshold above which slider inputs commit on blur instead of
// firing on every drag tick (consumed by NumberInput's `:live`).
const LARGE_WORKLOAD = 20_000;

// Per-batch target workload (population × sims-in-batch). Roughly chosen
// so each batch finishes in ~100–200ms on a default-ish machine. Smaller
// batches → faster progressive updates but more postMessage overhead.
const BATCH_TARGET_WORKLOAD = 10_000;

// Single-slot coalescing scheduler with progressive batching. While a run
// is in flight, new param changes overwrite the pending slot rather than
// queueing. Each run streams `simulate_batch` calls one at a time,
// accumulating trajectories and re-assembling `outputs.value` after every
// batch so the chart fills in progressively. Cancellation is implicit:
// when `currentRunId` changes, the in-flight `drain` notices between
// batches and aborts — no worker terminate needed, so the wasm module
// cache survives.
const outputs = ref<Record<string, ModelOutput>>();
const error = ref<string>();
const loading = ref(false);
const progress = ref<{ done: number; total: number } | null>(null);
// Sticks around between runs so the status line can report the last
// natural (non-cancelled) completion as e.g. "Ran 20 simulations".
const lastRunSimCount = ref<number | null>(null);

let currentRunId = 0;
let pendingArgs: string | null = null;

type SimArgs = typeof defaults;

function batchSizeFor(p: SimArgs): number {
  // population is the dominant per-sim cost; one batch ≈ this many sims.
  const perBatch = Math.max(
    1,
    Math.floor(BATCH_TARGET_WORKLOAD / p.population),
  );
  return Math.min(perBatch, p.nSimulations);
}

// Pointwise median across an ensemble of equal-length trajectories.
// Mirrors `stats::pointwise_median` in `model/src/stats.rs`.
function pointwiseMedian(trajectories: TypedColumn[]): Float64Array {
  if (trajectories.length === 0) return new Float64Array(0);
  const len = trajectories[0].length;
  const out = new Float64Array(len);
  const buf: number[] = [];
  for (let i = 0; i < len; i++) {
    buf.length = 0;
    for (const t of trajectories) {
      const v = t[i];
      if (Number.isFinite(v)) buf.push(v);
    }
    buf.sort((a, b) => a - b);
    const n = buf.length;
    if (n === 0) out[i] = NaN;
    else if (n % 2 === 1) out[i] = buf[(n - 1) / 2];
    else out[i] = (buf[n / 2 - 1] + buf[n / 2]) / 2;
  }
  return out;
}

// Linear-interpolation median; mirrors `stats::median` in stats.rs.
function median1D(values: number[]): number {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  const n = finite.length;
  if (n === 0) return NaN;
  return n % 2 === 1
    ? finite[(n - 1) / 2]
    : (finite[n / 2 - 1] + finite[n / 2]) / 2;
}

interface Accumulator {
  time: Float64Array;
  expectedCurve: Float64Array;
  r0Expected: number;
  arExpected: number;
  trajectories: TypedColumn[];
  r0PerRun: number[];
  arPerRun: number[];
}

function f64Col(name: string): ColumnDescriptor {
  return { name, type: "f64" };
}

function assembleOutputs(acc: Accumulator): Record<string, ModelOutput> {
  const median = pointwiseMedian(acc.trajectories);
  const seriesColumns: ColumnDescriptor[] = [
    f64Col("time"),
    ...acc.trajectories.map((_, i) => f64Col(`cumulative_infections_${i}`)),
    f64Col("cumulative_infections_median"),
    f64Col("cumulative_infections_expected"),
  ];
  const seriesBuffers: TypedColumn[] = [
    acc.time,
    ...acc.trajectories,
    median,
    acc.expectedCurve,
  ];
  const series = new ModelOutput(acc.time.length, seriesColumns, seriesBuffers);

  const summaryColumns: ColumnDescriptor[] = [
    f64Col("r0_observed_median"),
    f64Col("r0_expected"),
    f64Col("attack_rate_observed_median"),
    f64Col("attack_rate_expected"),
  ];
  const summaryBuffers: TypedColumn[] = [
    Float64Array.of(median1D(acc.r0PerRun)),
    Float64Array.of(acc.r0Expected),
    Float64Array.of(median1D(acc.arPerRun)),
    Float64Array.of(acc.arExpected),
  ];
  const summary = new ModelOutput(1, summaryColumns, summaryBuffers);

  return { series, summary };
}

async function drain() {
  if (pendingArgs === null) return;
  const argsJson = pendingArgs;
  pendingArgs = null;
  const myId = ++currentRunId;
  const p = JSON.parse(argsJson) as SimArgs;
  const batchSize = batchSizeFor(p);
  loading.value = true;
  error.value = undefined;
  progress.value = null;
  console.log(
    `[ixa] run #${myId} started (workload=${(p.population * p.nSimulations).toLocaleString()}, batchSize=${batchSize})`,
  );

  let accumulator: Accumulator | null = null;
  let done = 0;
  try {
    while (done < p.nSimulations) {
      const thisBatch = Math.min(batchSize, p.nSimulations - done);
      const batchArgs = JSON.stringify({
        ...p,
        batchSize: thisBatch,
        seedOffset: done,
      });
      const res = (await runWasm(
        "ixa_example",
        "simulate_batch",
        batchArgs,
      )) as Record<string, ModelOutput>;
      if (myId !== currentRunId) {
        console.log(
          `[ixa] run #${myId} cancelled (${done}/${p.nSimulations} sims completed)`,
        );
        return;
      }
      const batchSeries = res.series;
      const perRun = res.per_run;
      const expSum = res.expected_summary;
      if (accumulator === null) {
        accumulator = {
          time: batchSeries.column("time") as Float64Array,
          expectedCurve: batchSeries.column(
            "cumulative_infections_expected",
          ) as Float64Array,
          r0Expected: expSum.column("r0_expected")[0],
          arExpected: expSum.column("attack_rate_expected")[0],
          trajectories: [],
          r0PerRun: [],
          arPerRun: [],
        };
      }
      for (let i = 0; i < thisBatch; i++) {
        accumulator.trajectories.push(
          batchSeries.column(`cumulative_infections_${i}`),
        );
      }
      const r0Col = perRun.column("r0_per_run");
      const arCol = perRun.column("attack_rate_per_run");
      for (let i = 0; i < thisBatch; i++) {
        accumulator.r0PerRun.push(r0Col[i]);
        accumulator.arPerRun.push(arCol[i]);
      }
      done += thisBatch;
      outputs.value = assembleOutputs(accumulator);
      progress.value = { done, total: p.nSimulations };
      console.log(
        `[ixa] run #${myId} progress: ${done}/${p.nSimulations} sims`,
      );
    }
    // Natural completion (any `return` from cancellation already exited
    // before this line). Stamp the count so the status line can read it.
    lastRunSimCount.value = done;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (myId === currentRunId && msg !== "cancelled") {
      error.value = msg;
    }
  } finally {
    if (myId === currentRunId) {
      loading.value = false;
      progress.value = null;
    }
    if (pendingArgs !== null) drain();
  }
}

function scheduleRun(argsJson: string) {
  pendingArgs = argsJson;
  if (!loading.value) {
    drain();
  } else {
    // Bump so the in-flight drain notices between batches (its
    // `myId !== currentRunId` check) and bails out. Its `finally` then
    // re-enters `drain` for the pending args.
    currentRunId++;
  }
}

watch(() => JSON.stringify(params), scheduleRun, { immediate: true });

onScopeDispose(() => {
  // Drop any queued args first so `drain`'s finally doesn't re-enter on
  // a dead component after `cancelWasm` rejects the in-flight runWasm.
  pendingArgs = null;
  if (loading.value) cancelWasm();
});

// Persistent status line. While a run is in flight it reports
// "Running simulation… (N/M sims)"; once a run completes naturally it
// stays at "Ran X simulations" until the next run starts. Empty before
// the very first run completes.
const statusMessage = computed(() => {
  if (loading.value) {
    const p = progress.value;
    return p
      ? `Running simulation… (${p.done}/${p.total} sims)`
      : "Running simulation…";
  }
  if (lastRunSimCount.value !== null) {
    return `Ran ${lastRunSimCount.value} simulations`;
  }
  return null;
});

// Live-update sliders only when each re-run is cheap; above the workload
// threshold, NumberInput falls back to commit-on-blur to keep the UI
// responsive while dragging.
const live = computed(
  () => params.nSimulations * params.population <= LARGE_WORKLOAD,
);

function fmtCount(v: number | undefined): string {
  return v != null && Number.isFinite(v) ? Math.round(v).toLocaleString() : "—";
}

// Chart layers, in render order:
//   1. The N stochastic trajectories as a translucent blue "fan" (no legend).
//   2. The pointwise median across the fan (computed in JS via
//      `pointwiseMedian` inside `assembleOutputs`, exposed as
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

function argmax(values: ArrayLike<number>): number {
  let bestI = -1;
  let bestV = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (Number.isFinite(v) && v > bestV) {
      bestV = v;
      bestI = i;
    }
  }
  return bestI;
}

const incidenceAnnotations = computed<ChartAnnotation[]>(() => {
  const s = outputs.value?.series;
  if (!s) return [];
  const med = diff(s.column("cumulative_infections_median"));
  const i = argmax(med);
  if (i < 0) return [];
  return [
    {
      x: i,
      y: med[i],
      text: `**Peak**\nt = ${i}, ${fmtCount(med[i])}`,
      offset: { x: 24, y: -28 },
      color: "#f87171",
    },
  ];
});

const charts = computed(() => [
  {
    series: buildSeries((c) => c),
    annotations: [] as ChartAnnotation[],
    padding: undefined,
    yLabel: "Cumulative infections",
    height: 400,
  },
  {
    series: buildSeries(diff),
    annotations: incidenceAnnotations.value,
    // Top padding gives the 2-line "Peak" label room between the
    // inline legend (now pinned to the top) and the curve.
    padding: { top: 40 },
    yLabel: "Incidence (new infections per time unit)",
    height: 300,
  },
]);

// Summary stats are assembled in JS via `assembleOutputs` (using
// `median1D` over the per-run R₀ and attack-rate arrays accumulated
// across batches) and exposed as a length-1 ModelOutput called `summary`,
// kept column-compatible with the original Rust output.
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
    <div class="sidebar-header">
      <h2>Parameters</h2>
      <div class="sidebar-controls">
        <Toggle v-model="useEditor" label="Edit as code" />
        <Button variant="secondary" @click="reset">Reset</Button>
      </div>
    </div>
    <ParamEditor
      v-if="useEditor"
      :value="params"
      format="json"
      @apply="applyParamUpdate"
    />
    <template v-else>
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
    </template>
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
  <p v-if="statusMessage" class="status">{{ statusMessage }}</p>
  <template v-for="chart in charts" :key="chart.yLabel">
    <LineChart
      v-if="chart.series.length"
      :series="chart.series"
      :annotations="chart.annotations"
      :chart-padding="chart.padding"
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
.sidebar-header {
  display: flex;
  flex-direction: column;
  gap: 0.5em;
}
.sidebar-header h2 {
  margin: 0;
}
.sidebar-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5em;
}
.error {
  color: red;
}
.status {
  color: var(--cfa-color-text-muted, #666);
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
