<script setup lang="ts">
import type { resolveLabelStyle } from "./useChartPadding.js";

/**
 * The x/y axis labels shared by the cartesian charts: the y label rotated
 * along the left edge, the x label centered below the plot.
 */
defineProps<{
  xLabel?: string;
  yLabel?: string;
  padding: { top: number; left: number };
  innerW: number;
  innerH: number;
  height: number;
  labelStyle: ReturnType<typeof resolveLabelStyle>;
}>();
</script>

<template>
  <!-- y axis label -->
  <text
    v-if="yLabel"
    :x="0"
    :y="0"
    :transform="`translate(14, ${padding.top + innerH / 2}) rotate(-90)`"
    text-anchor="middle"
    :font-size="labelStyle.fontSize"
    :fill="labelStyle.fill"
    :font-weight="labelStyle.fontWeight"
  >
    {{ yLabel }}
  </text>
  <!-- x axis label -->
  <text
    v-if="xLabel"
    :x="padding.left + innerW / 2"
    :y="height - 4"
    text-anchor="middle"
    :font-size="labelStyle.fontSize"
    :fill="labelStyle.fill"
    :font-weight="labelStyle.fontWeight"
  >
    {{ xLabel }}
  </text>
</template>
