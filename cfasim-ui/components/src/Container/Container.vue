<script setup lang="ts">
import { computed } from "vue";
import { type GapToken, resolveGap } from "../_internal/gap";

export type ContainerGap = GapToken;

const props = defineProps<{
  border?: boolean;
  height?: number | string;
  horizontal?: boolean;
  gap?: ContainerGap | string;
}>();

const resolvedGap = computed(() => resolveGap(props.gap));

const resolvedHeight = computed(() => {
  const h = props.height;
  if (h == null) return undefined;
  return typeof h === "number" ? `${h}px` : h;
});
</script>

<template>
  <div
    class="container"
    :class="{
      'container-border': border,
      'container-horizontal': horizontal,
      'container-scrollable': height != null,
    }"
    :style="{
      gap: resolvedGap,
      height: resolvedHeight,
    }"
  >
    <slot />
  </div>
</template>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.container-horizontal {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
}

.container-border {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.container-scrollable {
  overflow: auto;
}
</style>
