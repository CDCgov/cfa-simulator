<script setup lang="ts">
import { ref } from "vue";
import { RouterView } from "vue-router";
import type { Tab } from "@cfasim-ui/components";
import {
  SidebarLayout,
  Button,
  Icon,
  NumberInput,
  Toggle,
} from "@cfasim-ui/components";

const population = ref(500);
const rate = ref(0.15);
const vaccination = ref(false);

function reset() {
  population.value = 500;
  rate.value = 0.15;
  vaccination.value = false;
}

function exportCsv() {
  const csv = `population,rate,vaccination\n${population.value},${rate.value},${vaccination.value}\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "parameters.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const tabs: Tab[] = [
  { value: "chart", label: "Chart", to: "/chart" },
  { value: "data", label: "Data", to: "/data" },
  { value: "settings", label: "Settings", to: "/settings" },
];
</script>

<template>
  <SidebarLayout :tabs="tabs">
    <template #sidebar-header-start>
      <h2>Parameters</h2>
    </template>
    <template #sidebar-header-end>
      <Button variant="neutral" @click="reset">Reset</Button>
    </template>
    <template #topbar-end>
      <Button variant="neutral" @click="exportCsv"
        ><Icon icon="download" :size="16" /> Export</Button
      >
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
    <RouterView />
  </SidebarLayout>
</template>

<style>
body {
  margin: 0;
}
</style>
