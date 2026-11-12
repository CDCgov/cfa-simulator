<script setup lang="ts">
/**
 * Heatmap's row labels and row header, drawn in the chart's svg and again
 * in the pinned copy that stays put while a wide chart scrolls sideways.
 */

export interface HeatmapRowLabelItem {
  index: number;
  /** The full label, which `label` shortens when it would not fit. */
  raw: string;
  label: string;
  y: number;
}

export interface HeatmapRowLabelsProps {
  items: readonly HeatmapRowLabelItem[];
  /** Right edge of the labels. */
  x: number;
  header?: string;
  headerY: number;
  clickable: boolean;
  labelStyle: {
    fontSize: number;
    fill: string;
    fontWeight?: number | string;
    fillOpacity?: number;
  };
  /** `data-testid` prefix, so the pinned copy is told apart. */
  testIdPrefix?: string;
}

const props = withDefaults(defineProps<HeatmapRowLabelsProps>(), {
  testIdPrefix: "",
});

defineEmits<{
  (e: "rowClick", row: { index: number; label: string }): void;
}>();

const testId = (name: string) => props.testIdPrefix + name;
</script>

<template>
  <text
    v-for="item in items"
    :key="item.index"
    :data-testid="testId('row-label')"
    class="heatmap-axis-label"
    :class="{ 'is-clickable': clickable }"
    :x="x"
    :y="item.y"
    text-anchor="end"
    dominant-baseline="middle"
    :font-size="labelStyle.fontSize"
    :fill="labelStyle.fill"
    :font-weight="labelStyle.fontWeight"
    :fill-opacity="labelStyle.fillOpacity"
    @click="$emit('rowClick', { index: item.index, label: item.raw })"
  >
    {{ item.label }}
  </text>
  <text
    v-if="header"
    :data-testid="testId('row-header')"
    :x="x"
    :y="headerY"
    text-anchor="end"
    :font-size="labelStyle.fontSize"
    :fill="labelStyle.fill"
    font-weight="600"
    :fill-opacity="labelStyle.fillOpacity"
  >
    {{ header }}
  </text>
</template>

<style scoped>
.heatmap-axis-label.is-clickable {
  cursor: pointer;
}
</style>
