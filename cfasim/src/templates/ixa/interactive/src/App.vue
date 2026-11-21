<script setup lang="ts">
import { computed, reactive } from "vue";
import { SidebarLayout, NumberInput, Button } from "cfasim-ui/components";
import { LineChart } from "cfasim-ui/charts";
import { useModel } from "cfasim-ui/wasm";
import { useUrlParams } from "cfasim-ui/shared";

const defaults = {
  infectiousness: 0.4,
  infectiousPeriod: 5,
  population: 1000,
  initialInfections: 5,
  maxTime: 100,
  nSimulations: 20,
};
const params = reactive({ ...defaults });
const { reset } = useUrlParams(params, defaults);
const { useOutputs } = useModel("{{ module_name }}");
// The params are matched by name to the `SimulateArgs` struct in `src/lib.rs`.
const { outputs, loading, error } = useOutputs("simulate", params);

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
    <template #sidebar-header-start>
      <h2>{{ project_name }}</h2>
    </template>
    <template #sidebar>
      <Button variant="secondary" @click="() => reset()">Reset</Button>
      <NumberInput
        v-model="params.infectiousness"
        label="Infectiousness (attempts per day)"
        :step="0.05"
        :min="0"
      />
      <NumberInput
        v-model="params.infectiousPeriod"
        label="Mean infectious period (days)"
        :step="0.5"
      />
      <NumberInput
        v-model="params.population"
        label="Population"
        number-type="integer"
        :min="1"
      />
      <NumberInput
        v-model="params.initialInfections"
        label="Initial infections"
        number-type="integer"
        :min="0"
      />
      <NumberInput v-model="params.maxTime" label="Max time (days)" :min="0" />
      <NumberInput
        v-model="params.nSimulations"
        label="Number of simulations"
        number-type="integer"
        :min="1"
        :max="100"
      />
    </template>
    <h1>{{ project_name }}</h1>
    <p v-if="loading">Loading...</p>
    <p v-else-if="error" class="text-error" v-text="error" />
    <LineChart
      v-else-if="series.length"
      :series="series"
      :height="300"
      x-label="day"
      y-label="cumulative infections"
      tooltip-trigger="hover"
    />
  </SidebarLayout>
</template>
