<script setup lang="ts">
import { reactive } from "vue";
import { SidebarLayout, NumberInput, Button } from "cfasim-ui/components";
import { LineChart } from "cfasim-ui/charts";
import { useModel } from "cfasim-ui/pyodide";
import { useUrlParams } from "cfasim-ui/shared";

const defaults = { steps: 10, rate: 2.5 };
const params = reactive({ ...defaults });
const { reset } = useUrlParams(params, defaults);
const { useOutputs } = useModel("%%module_name%%");
const { outputs, loading } = useOutputs("simulate", params);
</script>

<template>
  <SidebarLayout>
    <template #sidebar>
      <h2>%%project_name%%</h2>
      <Button variant="secondary" @click="() => reset()">Reset</Button>
      <NumberInput v-model="params.steps" label="Steps" />
      <NumberInput v-model="params.rate" label="Rate" />
    </template>
    <h1>%%project_name%%</h1>
    <p v-if="loading">Loading...</p>
    <LineChart
      v-else-if="outputs?.series"
      :data="Array.from(outputs.series.column('values'))"
      :height="300"
      x-label="time"
      y-label="value"
      tooltip-trigger="hover"
    />
  </SidebarLayout>
</template>
