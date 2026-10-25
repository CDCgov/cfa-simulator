<script setup lang="ts">
import type { DateValue } from "@internationalized/date";
import Icon from "../Icon/Icon.vue";
import { monthNames } from "./calendar";

defineProps<{
  view: DateValue;
  years: number[];
  locale: string;
  monthOutOfRange: (year: number, month: number) => boolean;
}>();

const emit = defineEmits<{ show: [year: number, month: number] }>();

const selected = (e: Event) => Number((e.target as HTMLSelectElement).value);
</script>

<template>
  <div class="cfasim-calendar-heading">
    <span class="cfasim-calendar-select-wrap">
      <select
        class="cfasim-input cfasim-calendar-select"
        aria-label="Month"
        :value="view.month"
        @change="emit('show', view.year, selected($event))"
      >
        <option
          v-for="(name, i) in monthNames(locale)"
          :key="i"
          :value="i + 1"
          :disabled="monthOutOfRange(view.year, i + 1)"
        >
          {{ name }}
        </option>
      </select>
      <Icon icon="keyboard_arrow_down" :size="16" />
    </span>
    <span class="cfasim-calendar-select-wrap">
      <select
        class="cfasim-input cfasim-calendar-select"
        aria-label="Year"
        :value="view.year"
        @change="emit('show', selected($event), view.month)"
      >
        <option v-for="y in years" :key="y" :value="y">
          {{ y }}
        </option>
      </select>
      <Icon icon="keyboard_arrow_down" :size="16" />
    </span>
  </div>
</template>
