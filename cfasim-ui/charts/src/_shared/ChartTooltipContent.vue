<script setup lang="ts">
import { computed } from "vue";
import { formatTick } from "./axes.js";
import type { ChartTooltipInterval, ChartTooltipValue } from "./chartProps.js";

export interface ChartTooltipContentProps {
  title?: string;
  values: ChartTooltipValue[];
  /** Named bands at the hovered position (LineChart `areas`). */
  areas?: ChartTooltipInterval[];
  intervals?: ChartTooltipInterval[];
  format?: (value: number) => string;
}

const props = defineProps<ChartTooltipContentProps>();

const fmt = (v: number) =>
  isFinite(v) ? (props.format ?? formatTick)(v) : "—";

// Rows with nothing to show at the hovered x drop out, and once any row
// is named, so do unnamed ones (e.g. fan trajectories).
const rows = computed(() => {
  const finite = props.values.filter(
    (v) => isFinite(v.value) || v.lower !== undefined,
  );
  return finite.some((v) => v.label) ? finite.filter((v) => v.label) : finite;
});
</script>

<template>
  <div class="chart-tooltip-body">
    <div v-if="title" class="chart-tooltip-label">{{ title }}</div>
    <div
      v-for="v in rows"
      :key="v.seriesIndex"
      class="chart-tooltip-row"
      :class="{ 'is-named': v.label }"
    >
      <span class="chart-tooltip-swatch" :style="{ background: v.color }" />
      <span v-if="v.label" class="chart-tooltip-name">{{ v.label }}</span>
      <span class="chart-tooltip-value">
        {{ fmt(v.value) }}
        <span
          v-if="v.lower !== undefined && v.upper !== undefined"
          class="chart-tooltip-range"
        >
          ({{ fmt(v.lower) }}–{{ fmt(v.upper) }})
        </span>
      </span>
    </div>
    <div
      v-for="(a, i) in areas"
      :key="'a' + i"
      class="chart-tooltip-row"
      :class="{ 'is-named': a.label }"
    >
      <span
        class="chart-tooltip-swatch is-area"
        :style="{ background: a.color }"
      />
      <span v-if="a.label" class="chart-tooltip-name">{{ a.label }}</span>
      <span class="chart-tooltip-value">
        <template v-if="a.value !== undefined">{{ fmt(a.value) }}</template>
        <template v-else>{{ fmt(a.lower) }}–{{ fmt(a.upper) }}</template>
      </span>
    </div>
    <div
      v-for="(iv, i) in intervals"
      :key="'iv' + i"
      class="chart-tooltip-row"
      :class="{ 'is-named': iv.label }"
    >
      <span class="chart-tooltip-swatch" :style="{ background: iv.color }" />
      <span v-if="iv.label" class="chart-tooltip-name">{{ iv.label }}</span>
      <span class="chart-tooltip-value">
        <template v-if="iv.value !== undefined">
          {{ fmt(iv.value) }}
          <span class="chart-tooltip-range">
            ({{ fmt(iv.lower) }}–{{ fmt(iv.upper) }})
          </span>
        </template>
        <template v-else>{{ fmt(iv.lower) }}–{{ fmt(iv.upper) }}</template>
      </span>
    </div>
  </div>
</template>

<style scoped>
.chart-tooltip-label {
  font-weight: 600;
  margin-bottom: 0.25em;
}

.chart-tooltip-row {
  display: flex;
  align-items: center;
  gap: 0.375em;
}

.chart-tooltip-row.is-named .chart-tooltip-value {
  margin-left: auto;
  padding-left: 1em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.chart-tooltip-range {
  opacity: 0.7;
}

.chart-tooltip-swatch {
  display: inline-block;
  width: 0.625em;
  height: 0.625em;
  border-radius: 50%;
  flex-shrink: 0;
}

.chart-tooltip-swatch.is-area {
  border-radius: 2px;
  opacity: 0.6;
}
</style>
