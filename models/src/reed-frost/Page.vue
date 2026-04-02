<script setup lang="ts">
import { reactive, computed } from "vue";
import { NumberInput } from "@cfasim-ui/components";
import { LineChart, DataTable } from "@cfasim-ui/charts";
import type { Series } from "@cfasim-ui/charts";
import { useModel } from "@cfasim-ui/wasm";

const params = reactive({
  population: 20,
  initial_infected: 1,
  p: 0.1,
  generations: 20,
  n_trajectories: 100,
});
const { useOutputs } = useModel("rust_example");
const { outputs, error } = useOutputs("simulate", params);

const chartSeries = computed<Series[]>(() => {
  const d = outputs.value?.data;
  if (!d) return [];

  const gen = d.column("generation");
  const traj = d.column("trajectory");
  const cum = d.column("cumulative_infections");

  const nGen = params.generations + 1;
  const series: Series[] = [];

  for (let t = 0; t < params.n_trajectories; t++) {
    const offset = t * nGen;
    const data: number[] = [];
    for (let g = 0; g < nGen; g++) {
      data.push(cum[offset + g]);
    }
    series.push({ data, opacity: 0.3 });
  }

  return series;
});
</script>

<template>
  <Teleport to="#model-sidebar">
    <h2>Parameters</h2>
    <NumberInput
      v-model="params.population"
      label="Population"
      slider
      live
      :min="1"
      :max="50"
    />
    <NumberInput
      v-model="params.initial_infected"
      label="Initial infected"
      slider
      live
      :min="1"
      :max="10"
    />
    <NumberInput
      v-model="params.p"
      label="Transmission prob (p)"
      slider
      live
      percent
      :min="0"
      :max="1"
      :step="0.01"
    />
  </Teleport>
  <h1>Reed-Frost Epidemic</h1>
  <p v-if="error" style="color: red">{{ error }}</p>
  <LineChart
    v-if="chartSeries.length"
    :series="chartSeries"
    :height="400"
    x-label="Generation"
    y-label="Cumulative infections"
  />
  <DataTable
    v-if="outputs?.data"
    :data="outputs.data"
    :max-rows="20"
    :column-config="{
      generation: { label: '', width: 'small', cellClass: 'text-secondary' },
      trajectory: { label: 'Trajectory' },
      cumulative_infections: { label: 'Cumulative Infections' },
    }"
  />
</template>
