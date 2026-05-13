<script setup lang="ts">
import { ref, useTemplateRef } from "vue";

export interface ChoroplethTooltipData {
  id: string;
  name: string;
  value?: number | string;
  feature: unknown;
}

defineSlots<{
  default?(props: ChoroplethTooltipData): unknown;
}>();

// Local reactive state. Held inside the child so the parent's render scope
// never subscribes to it — hover updates re-render only this small tree,
// not the parent's 3,000+ paths.
const data = ref<ChoroplethTooltipData | null>(null);
const rootRef = useTemplateRef<HTMLDivElement>("root");

defineExpose({
  setData(next: ChoroplethTooltipData | null) {
    data.value = next;
  },
  getEl(): HTMLDivElement | null {
    return rootRef.value;
  },
});
</script>

<template>
  <Teleport to="body">
    <div
      ref="root"
      class="chart-tooltip-content"
      style="
        position: fixed;
        left: 0;
        top: 0;
        visibility: hidden;
        will-change: transform;
        pointer-events: none;
        transform: translateY(-50%);
      "
    >
      <slot v-if="data" v-bind="data" />
    </div>
  </Teleport>
</template>
