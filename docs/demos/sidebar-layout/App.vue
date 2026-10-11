<script setup lang="ts">
import { ref } from "vue";
import {
  SidebarLayout,
  NumberInput,
  SelectBox,
  TextInput,
  Toggle,
} from "@cfasim-ui/components";

const population = ref(500);
const duration = ref(30);
const rate = ref(0.15);
const vaccination = ref(false);
const scenario = ref("baseline");
const notes = ref("");
const metric = ref("cases");

const scenarios = [
  { value: "baseline", label: "Baseline" },
  { value: "lockdown", label: "Lockdown" },
  { value: "vaccine", label: "Vaccine rollout" },
];
const metrics = [
  { value: "cases", label: "Cases" },
  { value: "hospitalizations", label: "Hospitalizations" },
  { value: "deaths", label: "Deaths" },
];

const sections = Array.from({ length: 8 }, (_, i) => i + 1);
</script>

<template>
  <SidebarLayout>
    <template #sidebar>
      <h2 class="mt-0">Parameters</h2>
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
      <h2>Scenario</h2>
      <SelectBox v-model="scenario" label="Scenario" :options="scenarios" />
      <TextInput
        v-model="notes"
        label="Notes"
        hide-label
        placeholder="Notes"
        data-testid="sidebar-hidden-label"
      />
    </template>
    <h1>SidebarLayout Demo</h1>
    <p>
      This is an example of the SidebarLayout component with interactive
      controls in the sidebar and main content on the right.
    </p>
    <section v-for="n in sections" :key="n">
      <h2>Section {{ n }}</h2>
      <p>
        The main pane scrolls on its own. The document itself never grows past
        the viewport, so the sidebar and topbar stay put while this content
        scrolls underneath them.
      </p>
    </section>
    <SelectBox
      v-model="metric"
      label="Metric"
      hide-label
      :options="metrics"
      data-testid="main-hidden-label"
    />
  </SidebarLayout>
</template>

<style>
body {
  margin: 0;
}
</style>
