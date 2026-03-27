<script setup lang="ts">
import { reactive } from "vue";
import { SidebarLayout, NumberInput } from "@cfasim-ui/components";
import { useModel } from "@cfasim-ui/pyodide";

const params = reactive({ steps: 10, rate: 2.5 });
const { useOutputs } = useModel("python_example");
const { outputs, loading, error } = useOutputs("simulate", params);
</script>

<template>
  <SidebarLayout hide-topbar>
    <template #sidebar>
      <h2>python-example</h2>
      <NumberInput v-model="params.steps" label="Steps" />
      <NumberInput v-model="params.rate" label="Rate" />
    </template>
    <h1>python-example</h1>
    <p v-if="error" style="color: red">{{ error }}</p>
    <p v-if="loading">Loading...</p>
    <template v-else-if="outputs?.series">
      <ul>
        <li v-for="(_, i) in outputs.series.column('time')" :key="i">
          t={{ outputs.series.column("time")[i] }}, v={{
            outputs.series.column("values")[i]
          }}
        </li>
      </ul>
    </template>
  </SidebarLayout>
</template>
