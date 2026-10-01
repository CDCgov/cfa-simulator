<script setup lang="ts">
/** The drag-to-zoom selection rectangle, drawn while a brush is in progress. */
defineProps<{
  rect: { x: number; y: number; width: number; height: number };
}>();
</script>

<template>
  <rect
    data-testid="zoom-brush"
    v-bind="rect"
    fill="currentColor"
    fill-opacity="0.1"
    stroke="currentColor"
    stroke-opacity="0.3"
    pointer-events="none"
  />
</template>
