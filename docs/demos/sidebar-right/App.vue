<script setup lang="ts">
import { computed, ref } from "vue";
import {
  SidebarLayout,
  Button,
  NumberInput,
  TextInput,
  Toggle,
} from "@cfasim-ui/components";

const population = ref(500);
const duration = ref(30);
const rate = ref(0.15);
const vaccination = ref(false);
const notes = ref("");

function reset() {
  population.value = 500;
  duration.value = 30;
  rate.value = 0.15;
  vaccination.value = false;
}

const summary = computed(() => {
  const effectiveRate = vaccination.value ? rate.value / 2 : rate.value;
  const infected = Math.round(
    population.value * (1 - Math.exp(-effectiveRate * (duration.value / 10))),
  );
  return [
    { label: "Population", value: population.value.toLocaleString() },
    { label: "Days simulated", value: duration.value.toLocaleString() },
    { label: "Estimated infections", value: infected.toLocaleString() },
    {
      label: "Attack rate",
      value: `${Math.round((infected / population.value) * 100)}%`,
    },
  ];
});

const sections = Array.from({ length: 6 }, (_, i) => i + 1);
</script>

<template>
  <SidebarLayout>
    <template #sidebar-header-start>
      <h2>Parameters</h2>
    </template>
    <template #sidebar-header-end>
      <Button variant="neutral" @click="reset">Reset</Button>
    </template>
    <template #sidebar>
      <NumberInput
        v-model="population"
        label="Population"
        slider
        live
        :min="1"
        :max="1000"
      />
      <NumberInput
        v-model="duration"
        label="Duration (days)"
        slider
        live
        :min="1"
        :max="365"
      />
      <NumberInput
        v-model="rate"
        label="Transmission rate"
        slider
        live
        percent
        :min="0"
        :max="1"
        :step="0.01"
      />
      <Toggle v-model="vaccination" label="Vaccination" />
    </template>
    <template #sidebar-right-header-start>
      <h2>Summary</h2>
    </template>
    <template #sidebar-right>
      <dl class="summary">
        <div v-for="row in summary" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
      <h2>Notes</h2>
      <TextInput v-model="notes" label="Notes" hide-label placeholder="Notes" />
    </template>
    <h1>Two Sidebars Demo</h1>
    <p>
      The <code>sidebar-right</code> slot adds a second sidebar on the right. It
      collapses separately, and on a narrow window only one sidebar is open at a
      time.
    </p>
    <section v-for="n in sections" :key="n">
      <h2>Section {{ n }}</h2>
      <p>
        The main pane scrolls separately between the two sidebars, and gives up
        its width to whichever of them is open.
      </p>
    </section>
  </SidebarLayout>
</template>

<style>
body {
  margin: 0;
}

.summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
}

.summary > div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
}

.summary dt {
  color: var(--color-text-secondary);
}

.summary dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
</style>
