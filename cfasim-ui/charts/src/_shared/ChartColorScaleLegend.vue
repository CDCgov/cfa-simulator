<script setup lang="ts">
import {
  RAMP_HEIGHT,
  type ColorScaleLegendLayout,
} from "./colorScaleLegend.js";

/**
 * The inline legend item for a continuous color scale: title, min label,
 * gradient ramp and max label on one row, plus an optional middle label
 * under the ramp. The gradient itself is defined
 * by the chart (`fill` is its `url(#id)`), since ids are per instance.
 */
defineProps<{
  layout: ColorScaleLegendLayout;
  /** Left edge of the item in svg pixels. */
  x: number;
  /** Row center in svg pixels. */
  y: number;
  /** Fill of the ramp rect, a gradient `url(#…)`. */
  fill: string;
  fontSize: number;
  textFill: string;
  fontWeight?: number | string;
}>();
</script>

<template>
  <g
    data-testid="legend-color-scale"
    :font-size="fontSize"
    :fill="textFill"
    :font-weight="fontWeight"
  >
    <text v-if="layout.label" :x="x" :y="y + 4">{{ layout.label }}</text>
    <text :x="x + layout.minX" :y="y + 4">{{ layout.min }}</text>
    <rect
      :x="x + layout.rampX"
      :y="y - RAMP_HEIGHT / 2"
      :width="layout.rampWidth"
      :height="RAMP_HEIGHT"
      rx="2"
      :fill="fill"
    />
    <text :x="x + layout.maxX" :y="y + 4">{{ layout.max }}</text>
    <text
      v-if="layout.mid !== undefined"
      data-testid="legend-color-scale-mid"
      :x="x + layout.midX!"
      :y="y + RAMP_HEIGHT / 2 + fontSize"
      text-anchor="middle"
    >
      {{ layout.mid }}
    </text>
  </g>
</template>
