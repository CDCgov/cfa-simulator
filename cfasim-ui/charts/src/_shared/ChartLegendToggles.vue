<script setup lang="ts">
import {
  INLINE_LEGEND_ROW_HEIGHT,
  LEGEND_TEXT_INDENT,
} from "./useChartPadding.js";

defineProps<{
  /** Legend items positioned in svg pixels (`y` is the row center). */
  items: readonly { label: string; x: number; y: number }[];
  isHidden: (label: string) => boolean;
  /** Legend text style, so each button sizes to its rendered label. */
  fontSize: number;
  fontWeight?: number | string;
}>();

defineEmits<{ (e: "toggle", label: string): void }>();

const HIT_PAD_X = 4;
</script>

<template>
  <!--
    HTML buttons laid over the svg legend: the svg is exposed as a single
    image, so its children can't carry the toggle semantics. Zero-height
    and in flow directly before the svg, so the buttons track the svg's
    origin wherever the wrapper places it (e.g. padded in fullscreen).
  -->
  <div
    class="chart-legend-toggles"
    role="group"
    aria-label="Show or hide series"
  >
    <button
      v-for="(item, i) in items"
      :key="i"
      type="button"
      class="chart-legend-toggle"
      :aria-label="item.label"
      :aria-pressed="!isHidden(item.label)"
      :style="{
        left: `${item.x - HIT_PAD_X}px`,
        top: `${item.y - INLINE_LEGEND_ROW_HEIGHT / 2}px`,
        height: `${INLINE_LEGEND_ROW_HEIGHT}px`,
        padding: `0 ${HIT_PAD_X}px 0 ${HIT_PAD_X + LEGEND_TEXT_INDENT}px`,
        fontSize: `${fontSize}px`,
        fontWeight,
      }"
      @click="$emit('toggle', item.label)"
    >
      <!-- Invisible copy of the svg label: sizes the button to the text. -->
      <span class="chart-legend-toggle-sizer" aria-hidden="true">{{
        item.label
      }}</span>
    </button>
  </div>
</template>

<style scoped>
.chart-legend-toggles {
  position: relative;
  height: 0;
  z-index: 1;
}

.chart-legend-toggle {
  position: absolute;
  border: 0;
  font: inherit;
  line-height: 1;
  white-space: nowrap;
  border-radius: 0.25em;
  background: transparent;
  cursor: pointer;
}

.chart-legend-toggle-sizer {
  visibility: hidden;
}

.chart-legend-toggle:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
}

.chart-legend-toggle:focus-visible {
  outline: 2px solid var(--color-primary, #0057b7);
  outline-offset: 1px;
}
</style>
