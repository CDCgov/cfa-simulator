<script setup lang="ts">
import type { ResolvedGridStyle } from "./grid.js";

/**
 * Grid lines for one axis. `axis` names the axis the ticks belong to:
 * `"y"` ticks produce horizontal lines spanning `start`..`end` on x,
 * `"x"` ticks produce vertical lines spanning `start`..`end` on y.
 */
defineProps<{
  axis: "x" | "y";
  /** Pixel position of each tick along `axis`. */
  positions: readonly number[];
  start: number;
  end: number;
  gridStyle: ResolvedGridStyle;
}>();
</script>

<template>
  <g class="chart-grid" :data-axis="axis" pointer-events="none">
    <line
      v-for="(pos, i) in positions"
      :key="i"
      data-testid="grid-line"
      :x1="axis === 'y' ? start : pos"
      :y1="axis === 'y' ? pos : start"
      :x2="axis === 'y' ? end : pos"
      :y2="axis === 'y' ? pos : end"
      :stroke="gridStyle.color"
      :stroke-opacity="gridStyle.opacity"
      :stroke-width="gridStyle.lineWidth"
      :stroke-dasharray="gridStyle.lineDash"
      :stroke-linecap="gridStyle.lineCap"
    />
  </g>
</template>
