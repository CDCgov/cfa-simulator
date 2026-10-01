<script setup lang="ts">
/** A `<clipPath>` covering the plot area, for clipping marks while zoomed. */
defineProps<{
  id: string;
  padding: { top: number; left: number };
  innerW: number;
  innerH: number;
}>();
</script>

<template>
  <defs>
    <clipPath :id="id">
      <rect
        :x="padding.left"
        :y="padding.top"
        :width="innerW"
        :height="innerH"
      />
    </clipPath>
  </defs>
</template>
