<script setup lang="ts">
import { ref } from "vue";
import { SidebarLayout, NumberInput, Toggle } from "@cfasim-ui/components";

const population = ref(500);
const duration = ref(30);
const rate = ref(0.15);
const vaccination = ref(false);
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
    </template>
    <h1>SidebarLayout Demo</h1>
    <p>
      This is an example of the SidebarLayout component with interactive
      controls in the sidebar and main content on the right.
    </p>
  </SidebarLayout>
</template>

<style>
body {
  margin: 0;
}
</style>
