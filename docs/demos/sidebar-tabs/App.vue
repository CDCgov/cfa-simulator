<script setup lang="ts">
import { ref } from "vue";
import { RouterView } from "vue-router";
import type { Tab } from "@cfasim-ui/components";
import { SidebarLayout, NumberInput, Toggle } from "@cfasim-ui/components";

const population = ref(500);
const rate = ref(0.15);
const vaccination = ref(false);

const tabs: Tab[] = [
  { value: "chart", label: "Chart", to: "/chart" },
  { value: "data", label: "Data", to: "/data" },
  { value: "settings", label: "Settings", to: "/settings" },
];
</script>

<template>
  <SidebarLayout :tabs="tabs">
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
