<script setup lang="ts">
import { reactive, computed } from "vue";
import { SidebarLayout, NumberInput } from "@cfasim-ui/components";
import { LineChart } from "@cfasim-ui/charts";
import type { Series } from "@cfasim-ui/charts";
import { useModel } from "@cfasim-ui/wasm";

const params = reactive({
  population: 10_000,
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
      <NumberInput v-model="params.population" label="Population" live />
      <NumberInput
        v-model="params.initial_infected"
        label="Initial infected"
        live
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
      <NumberInput v-model="params.seed" label="Random seed" live />
    </template>
    <h1>Reed-Frost Epidemic</h1>
    <p v-if="error" style="color: red">{{ error }}</p>
    <template v-if="outputs?.trajectory">
      <LineChart
        :series="chartSeries"
        :height="300"
        x-label="Generation"
        y-label="Count"
      />
    </template>
  </SidebarLayout>
</template>
