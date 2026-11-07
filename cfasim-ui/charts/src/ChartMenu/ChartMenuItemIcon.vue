<script lang="ts">
export type ChartMenuIcon =
  "copy" | "download" | "image" | "vector" | "file" | "expand";
</script>

<script setup lang="ts">
withDefaults(defineProps<{ icon: ChartMenuIcon; size?: number }>(), {
  size: 12,
});
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="icon === 'copy'">
      <rect x="5" y="5" width="8" height="8" rx="1" />
      <path d="M3 9H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1" />
    </template>
    <path v-else-if="icon === 'download'" d="M7 1v8M3 6l4 4 4-4M2 13h10" />
    <template v-else-if="icon === 'image'">
      <rect x="1.5" y="2.5" width="11" height="9" rx="1" />
      <circle cx="5" cy="6" r="1" />
      <path d="M12.5 10L9 7l-4 4" />
    </template>
    <template v-else-if="icon === 'vector'">
      <path d="M3 11L6 5l3 4 3-6" />
      <circle cx="3" cy="11" r="1.25" />
      <circle cx="6" cy="5" r="1.25" />
      <circle cx="9" cy="9" r="1.25" />
      <circle cx="12" cy="3" r="1.25" />
    </template>
    <path v-else-if="icon === 'file'" d="M3 1h5l3 3v9H3zM8 1v3h3" />
    <path v-else d="M8 1h5v5M13 1L8 6M6 13H1V8M1 13l5-5" />
  </svg>
</template>
