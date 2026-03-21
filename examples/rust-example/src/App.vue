<script setup lang="ts">
import { reactive, computed } from "vue";
import { SidebarLayout, NumberInput } from "@cfasim-ui/components";
import { LineChart } from "@cfasim-ui/charts";
import type { Series } from "@cfasim-ui/charts";
import { useModel } from "@cfasim-ui/wasm";

const params = reactive({
  population: 100,
  initial_infected: 3,
  p: 0.03,
  seed: 42,
});
const { useOutputs } = useModel("rust_example");
const { outputs, error, loading } = useOutputs("simulate", params);

const chartSeries = computed<Series[]>(() => {
  const t = outputs.value?.trajectory;
  if (!t) return [];
  return [
    { data: Array.from(t.column("susceptible")), color: "#4a90d9" },
    { data: Array.from(t.column("infected")), color: "#d94a4a" },
    { data: Array.from(t.column("recovered")), color: "#5cb85c" },
  ];
});
</script>

<template>
  <SidebarLayout>
    <template #sidebar>
      <h2>Reed-Frost Epidemic</h2>
      <NumberInput v-model="params.population" label="Population" />
      <NumberInput v-model="params.initial_infected" label="Initial infected" />
      <NumberInput
        v-model="params.p"
        label="Transmission prob (p)"
        :step="0.01"
      />
      <NumberInput v-model="params.seed" label="Random seed" />
    </template>
    <h1>Reed-Frost Epidemic</h1>
    <p v-if="loading">Loading...</p>
    <p v-else-if="error" style="color: red">{{ error }}</p>
    <template v-else-if="outputs?.trajectory">
      <LineChart
        :series="chartSeries"
        :height="300"
        x-label="Generation"
        y-label="Count"
      />
    </template>
  </SidebarLayout>
</template>
