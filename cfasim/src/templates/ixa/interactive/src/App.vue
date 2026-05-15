<script setup lang="ts">
import { computed, reactive } from "vue";
import { SidebarLayout, NumberInput, Button } from "cfasim-ui/components";
import { LineChart } from "cfasim-ui/charts";
import { useModel } from "cfasim-ui/wasm";
import { useUrlParams } from "cfasim-ui/shared";

// Keys here are passed positionally to `simulate` in the same order they're
// declared, so they must match the Rust signature in `src/lib.rs`.
const defaults = {
  infectionRate: 0.5,
  population: 1000,
  maxTime: 50,
  nSimulations: 20,
};
const params = reactive({ ...defaults });
const { reset } = useUrlParams(params, defaults);
const { useOutputs } = useModel("{{ module_name }}");
const { outputs, loading } = useOutputs("simulate", params);

// One translucent series per realization; the overlap reads as a fan.
const series = computed(() => {
  const s = outputs.value?.series;
  if (!s) return [];
  return s.names
    .filter((n) => n.startsWith("values_"))
    .map((n) => ({
      data: s.column(n),
      color: "#2563eb",
      opacity: 0.3,
    }));
});
</script>

<template>
  <SidebarLayout>
    <template #sidebar>
      <h2>{{ project_name }}</h2>
      <Button variant="secondary" @click="() => reset()">Reset</Button>
      <NumberInput
        v-model="params.infectionRate"
        label="Infection rate"
        :step="0.05"
      />
      <NumberInput v-model="params.population" label="Population" />
      <NumberInput v-model="params.maxTime" label="Max time" />
      <NumberInput
        v-model="params.nSimulations"
        label="Number of simulations"
        :min="1"
        :max="100"
      />
    </template>
    <h1>{{ project_name }}</h1>
    <p v-if="loading">Loading...</p>
    <LineChart
      v-else-if="series.length"
      :series="series"
      :height="300"
      x-label="time"
      y-label="cumulative infections"
      tooltip-trigger="hover"
    />
  </SidebarLayout>
</template>
