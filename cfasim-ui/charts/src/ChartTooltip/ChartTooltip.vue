<script setup lang="ts">
import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipPortal,
  TooltipContent,
  PopoverRoot,
  PopoverAnchor,
  PopoverPortal,
  PopoverContent,
} from "reka-ui";

withDefaults(
  defineProps<{
    /** Pixel x-coordinate relative to the positioned parent container */
    x: number;
    /** Pixel y-coordinate relative to the positioned parent container */
    y: number;
    /** Whether the tooltip is visible */
    open: boolean;
    /** Interaction mode. Default: 'hover' */
    mode?: "hover" | "click";
    /** Preferred side for placement. Default: 'top' */
    side?: "top" | "right" | "bottom" | "left";
    /** Offset from anchor in pixels. Default: 8 */
    sideOffset?: number;
  }>(),
  {
    mode: "hover",
    side: "top",
    sideOffset: 8,
  },
);

defineEmits<{
  /** Fired in click mode when user dismisses the tooltip */
  (e: "close"): void;
}>();
</script>

<template>
  <!-- Hover mode: reka-ui Tooltip -->
  <TooltipProvider v-if="mode === 'hover'" :delay-duration="0">
    <TooltipRoot :open="open" :delay-duration="0" disable-closing-trigger>
      <TooltipTrigger as-child>
        <div
          class="chart-tooltip-anchor"
          :style="{ left: `${x}px`, top: `${y}px` }"
        />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          v-if="open"
          class="chart-tooltip-content"
          :side="side"
          :side-offset="sideOffset"
          update-position-strategy="always"
        >
          <slot />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>

  <!-- Click mode: reka-ui Popover -->
  <PopoverRoot v-else :open="open">
    <PopoverAnchor as-child>
      <div
        class="chart-tooltip-anchor"
        :style="{ left: `${x}px`, top: `${y}px` }"
      />
    </PopoverAnchor>
    <PopoverPortal>
      <PopoverContent
        v-if="open"
        class="chart-tooltip-content"
        :side="side"
        :side-offset="sideOffset"
        update-position-strategy="always"
        @pointer-down-outside="$emit('close')"
        @escape-key-down="$emit('close')"
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style scoped>
.chart-tooltip-anchor {
  position: absolute;
  width: 1px;
  height: 1px;
  pointer-events: none;
}
</style>

<style>
.chart-tooltip-content {
  z-index: 100;
  background: var(--color-bg-0, #fff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 0.375em;
  padding: 0.5em 0.75em;
  font-size: var(--font-size-sm, 0.875rem);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -2px rgba(0, 0, 0, 0.1);
  pointer-events: none;
}
</style>
