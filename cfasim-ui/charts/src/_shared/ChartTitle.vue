<script setup lang="ts">
import { computed } from "vue";
import type { TitleStyle } from "./chartProps.js";
import {
  TITLE_FONT_SIZE,
  TITLE_FONT_WEIGHT,
  TITLE_LINE_HEIGHT,
  type ChartBounds,
} from "./useChartPadding.js";

/**
 * The chart title `<text>` block shared by LineChart and BarChart:
 * multi-line via `\n`, aligned left/center/right against the plot bounds.
 */
const props = defineProps<{
  title?: string;
  titleStyle?: TitleStyle;
  bounds: ChartBounds;
  /**
   * X used when the title is left-aligned; defaults to the plot's left
   * edge. BarChart passes `headerLeftX` so start-aligned category labels
   * and the title share a left edge.
   */
  leftX?: number;
}>();

const resolved = computed(() => {
  const s = props.titleStyle;
  const align = s?.align ?? "left";
  const b = props.bounds;
  const x =
    align === "left"
      ? (props.leftX ?? b.left)
      : align === "right"
        ? b.right
        : b.left + b.width / 2;
  const anchor =
    align === "left" ? "start" : align === "right" ? "end" : "middle";
  return {
    lines: (props.title ?? "").split("\n"),
    fontSize: s?.fontSize ?? TITLE_FONT_SIZE,
    lineHeight: s?.lineHeight ?? TITLE_LINE_HEIGHT,
    fontWeight: s?.fontWeight ?? TITLE_FONT_WEIGHT,
    color: s?.color ?? "currentColor",
    x,
    anchor,
  };
});
</script>

<template>
  <text
    v-if="title"
    :x="resolved.x"
    :y="resolved.lineHeight"
    :text-anchor="resolved.anchor"
    :font-size="resolved.fontSize"
    :font-weight="resolved.fontWeight"
    :fill="resolved.color"
  >
    <tspan
      v-for="(line, i) in resolved.lines"
      :key="i"
      :x="resolved.x"
      :dy="i === 0 ? 0 : resolved.lineHeight"
    >
      {{ line }}
    </tspan>
  </text>
</template>
