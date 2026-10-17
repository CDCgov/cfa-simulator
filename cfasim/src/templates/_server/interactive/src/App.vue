<script setup lang="ts">
import { reactive } from "vue";
import { SidebarLayout, NumberInput, Button } from "cfasim-ui/components";
import { LineChart } from "cfasim-ui/charts";
import { useServerModel } from "cfasim-ui/server";
import type { RunSummary } from "cfasim-ui/server";
import { useUrlParams } from "cfasim-ui/shared";

const defaults = { steps: 10, rate: 2.5 };
const params = reactive({ ...defaults });
const { reset } = useUrlParams(params, defaults);
const { start, cancel, load, current, runs, connected, error } =
  useServerModel();

function run() {
  start("simulate", { ...params });
}

function runLabel(r: RunSummary) {
  return `${r.created_at.slice(0, 19).replace("T", " ")} (${r.status})`;
}
</script>

<template>
  <SidebarLayout>
    <template #sidebar>
      <h2>{{ project_name }}</h2>
      <Button variant="secondary" @click="() => reset()">Reset</Button>
      <NumberInput v-model="params.steps" label="Steps" />
      <NumberInput v-model="params.rate" label="Rate" />
      <Button :disabled="!connected || current.active.value" @click="run">
        Run
      </Button>
      <Button
        v-if="current.active.value"
        variant="secondary"
        @click="() => cancel()"
      >
        Cancel
      </Button>
      <h3 v-if="runs.length">Previous runs</h3>
      <ul class="runs">
        <li v-for="r in runs" :key="r.run_id">
          <button type="button" @click="load(r.run_id)" v-text="runLabel(r)" />
        </li>
      </ul>
    </template>
    <h1>{{ project_name }}</h1>
    <p v-if="!connected">
      The server is not reachable. Start it with <code>pnpm dev</code> or
      <code>pnpm server</code>.
    </p>
    <p v-else-if="error" class="error" v-text="error" />
    <template v-if="current.active.value">
      <progress :value="current.progress.value?.fraction ?? 0" max="1" />
      <p v-text="current.progress.value?.message ?? 'Starting'" />
    </template>
    <LineChart
      v-if="current.outputs.value?.series"
      :data="Array.from(current.outputs.value.series.column('values'))"
      :height="300"
      x-label="time"
      y-label="value"
      tooltip-trigger="hover"
    />
  </SidebarLayout>
</template>

<style scoped>
.runs {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.25rem;
}
.runs button {
  width: 100%;
  text-align: left;
  font: inherit;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-0);
  color: inherit;
  cursor: pointer;
}
.error {
  color: var(--color-error);
}
</style>
