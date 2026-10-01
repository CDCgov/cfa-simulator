<script setup lang="ts">
withDefaults(
  defineProps<{
    canZoomIn?: boolean;
    canZoomOut?: boolean;
    /** Reset is a no-op at the identity transform — disable it there. */
    canReset?: boolean;
    /** Insets the stack further from the corner while the chart fills the
     * window, matching the ChartMenu trigger area. */
    isFullscreen?: boolean;
    /** Render only the reset button (charts that zoom by dragging). */
    resetOnly?: boolean;
    /**
     * Corner the stack sits in. `"beside-menu"` is top-right, shifted left
     * to clear the ChartMenu trigger.
     */
    position?: "left" | "right" | "beside-menu";
  }>(),
  {
    canZoomIn: true,
    canZoomOut: true,
    canReset: true,
    isFullscreen: false,
    resetOnly: false,
    position: "left",
  },
);

const emit = defineEmits<{
  (e: "zoomIn"): void;
  (e: "zoomOut"): void;
  (e: "reset"): void;
}>();
</script>

<template>
  <div
    class="chart-zoom-controls"
    :class="[
      `chart-zoom-controls--${position}`,
      { 'chart-zoom-controls--expanded': isFullscreen },
    ]"
  >
    <button
      v-if="!resetOnly"
      type="button"
      class="chart-zoom-button"
      aria-label="Zoom in"
      :disabled="!canZoomIn"
      @click="emit('zoomIn')"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M7 2v10M2 7h10" />
      </svg>
    </button>
    <button
      v-if="!resetOnly"
      type="button"
      class="chart-zoom-button"
      aria-label="Zoom out"
      :disabled="!canZoomOut"
      @click="emit('zoomOut')"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M2 7h10" />
      </svg>
    </button>
    <button
      type="button"
      class="chart-zoom-button"
      :aria-label="resetOnly ? 'Reset zoom' : 'Reset view'"
      :disabled="!canReset"
      @click="emit('reset')"
    >
      <!-- Counterclockwise "reset" arrow (rotate-ccw). -->
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path
          d="M1.75 7a5.25 5.25 0 1 0 5.25-5.25c-1.48 0-2.9.6-3.94 1.6L1.75 4.7"
        />
        <path d="M1.75 1.75v2.95h2.95" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.chart-zoom-controls {
  position: absolute;
  --zoom-controls-inset: 0.5em;
  top: var(--zoom-controls-inset);
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Mirror .chart-menu-trigger-area--expanded: while the chart fills the
   window the wrapper's padding doesn't move absolute children, so inset
   further for modal-style breathing room. */
.chart-zoom-controls--expanded {
  --zoom-controls-inset: 1.25em;
}

.chart-zoom-controls--left {
  left: var(--zoom-controls-inset);
}

.chart-zoom-controls--right {
  right: var(--zoom-controls-inset);
}

/* Menu trigger is 28px wide; leave the same 4px gap the stack uses. */
.chart-zoom-controls--beside-menu {
  right: calc(var(--zoom-controls-inset) + 32px);
}

/* Same look as .chart-menu-button, but always visible — no hover reveal. */
.chart-zoom-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 0.25em;
  background: var(--color-bg-0, #fff);
  color: var(--color-text-secondary, #555);
  cursor: pointer;
}

.chart-zoom-button:hover:not(:disabled) {
  background: var(--color-bg-1, rgba(0, 0, 0, 0.05));
  color: var(--color-text);
}

.chart-zoom-button:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
