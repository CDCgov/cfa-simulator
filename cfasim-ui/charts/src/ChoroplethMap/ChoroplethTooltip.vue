<script setup lang="ts">
import { ref, useTemplateRef } from "vue";

export interface ChoroplethTooltipData {
  id: string;
  name: string;
  value?: number | string;
  feature: unknown;
}

withDefaults(
  defineProps<{
    /**
     * `"float"` (default) renders the classic pointer-anchored tooltip.
     * `"sheet"` renders a bottom sheet that slides up inside the map
     * wrapper instead — used in the expanded touch view, where it stays
     * correctly positioned regardless of the page's pinch-zoom state
     * (the wrapper is pinned to the visual viewport; floating fixed
     * positioning is not).
     */
    mode?: "float" | "sheet";
  }>(),
  { mode: "float" },
);

// Local reactive state. Held inside the child so the parent's render scope
// never subscribes to it — hover updates re-render only this small tree,
// not the parent's 3,000+ paths.
const data = ref<ChoroplethTooltipData | null>(null);
const open = ref(false);
const rootRef = useTemplateRef<HTMLDivElement>("root");

defineExpose({
  setData(next: ChoroplethTooltipData | null) {
    data.value = next;
  },
  /** Sheet-mode visibility (float mode is driven imperatively via getEl). */
  setOpen(next: boolean) {
    open.value = next;
  },
  getEl(): HTMLDivElement | null {
    return rootRef.value;
  },
});
</script>

<template>
  <!-- Float: always mounted (the parent's ResizeObserver holds onto it);
  its slot only renders in float mode. z-index sits one above the
  fullscreen overlay so it stays visible while the map fills the window
  (both live in body). -->
  <Teleport to="body">
    <div
      ref="root"
      class="chart-tooltip-content"
      style="
        position: fixed;
        left: 0;
        top: 0;
        z-index: calc(var(--cfasim-z-fullscreen, 1000) + 1);
        visibility: hidden;
        will-change: transform;
        pointer-events: none;
        transform: translateY(-50%);
      "
    >
      <slot v-if="data && mode === 'float'" v-bind="data" />
    </div>
  </Teleport>
  <!-- Sheet: rendered in place inside the map wrapper, so it anchors to
  the (visual-viewport-pinned) expanded box. -->
  <div
    v-if="mode === 'sheet'"
    class="chart-tooltip-sheet"
    :class="{ 'is-open': open }"
  >
    <slot v-if="data" v-bind="data" />
  </div>
</template>

<style scoped>
.chart-tooltip-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  background: var(--color-bg-0, #fff);
  color: var(--color-text, inherit);
  border-top: 1px solid var(--color-border, #e5e7eb);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.12);
  padding: 14px 16px calc(14px + env(safe-area-inset-bottom, 0px));
  font-size: 14px;
  line-height: 1.4;
  pointer-events: none;
  transform: translateY(100%);
  transition: transform 0.25s ease;
}

.chart-tooltip-sheet.is-open {
  transform: translateY(0);
}
</style>
