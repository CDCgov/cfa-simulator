<script setup lang="ts">
import { reactive } from "vue";
import { useRouter, useRoute } from "vue-router";
import { NumberInput, Button } from "@cfasim-ui/components";
import { useModel } from "@cfasim-ui/pyodide";
import { useUrlParams } from "@cfasim-ui/shared";

const defaults = { steps: 10, rate: 2.5 };
const params = reactive({ ...defaults });
const { reset } = useUrlParams(params, defaults, {
  router: useRouter(),
  route: useRoute(),
});
const { useOutputs } = useModel("python_example");
const { outputs, loading, error } = useOutputs("simulate", params);
</script>

<template>
  <Teleport to="#model-sidebar">
    <Button variant="secondary" @click="reset">Reset</Button>
    <h2>Parameters</h2>
    <NumberInput v-model="params.steps" label="Steps" number-type="integer" />
    <NumberInput v-model="params.rate" label="Rate" number-type="float" />
  </Teleport>
  <h1>Python Example</h1>
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
</template>
