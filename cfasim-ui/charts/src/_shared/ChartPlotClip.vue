<script setup lang="ts">
import { computed } from "vue";
import { plotClipRect, type PlotClipEdges } from "./plotClip.js";

/**
 * A `<clipPath>` covering the plot area, for clipping marks while zoomed.
 * `open` edges (ones no data crosses) get room for marks straddling them.
 */
const props = defineProps<{
  id: string;
  padding: { top: number; left: number };
  innerW: number;
  innerH: number;
  open?: Partial<PlotClipEdges>;
}>();

const rect = computed(() =>
  plotClipRect(props.padding, props.innerW, props.innerH, props.open),
);
</script>

<template>
  <defs>
    <clipPath :id="id">
      <rect :x="rect.x" :y="rect.y" :width="rect.width" :height="rect.height" />
    </clipPath>
  </defs>
</template>
