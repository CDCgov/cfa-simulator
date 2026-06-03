<script setup lang="ts">
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
} from "reka-ui";

export interface ChartMenuItem {
  label: string;
  action: () => void;
  /** Sets aria-pressed on the menu item — use for toggle-style items. */
  ariaPressed?: boolean;
}

const props = withDefaults(
  defineProps<{
    items: ChartMenuItem[];
    /** Force the dropdown style even when only one item is provided. */
    forceDropdown?: boolean;
    /**
     * When the chart is expanded, the menu trigger is replaced by a
     * persistent close (✕) button that emits `close`.
     */
    isFullscreen?: boolean;
  }>(),
  { forceDropdown: false, isFullscreen: false },
);

const emit = defineEmits<{ (e: "close"): void }>();

const useDropdown = () => props.forceDropdown || props.items.length > 1;
</script>

<template>
  <div
    class="chart-menu-trigger-area"
    :class="{ 'chart-menu-trigger-area--expanded': isFullscreen }"
  >
    <!-- Expanded: a close button replaces the menu trigger -->
    <button
      v-if="isFullscreen"
      class="chart-menu-button chart-close-button"
      aria-label="Collapse"
      @click="emit('close')"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </button>
    <!-- Single item: plain button -->
    <button
      v-else-if="!useDropdown()"
      class="chart-menu-button chart-menu-single"
      :aria-label="items[0].label"
      @click="items[0].action"
    >
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
        <path d="M7 1v8M3 6l4 4 4-4M2 13h10" />
      </svg>
    </button>
    <!-- Multiple items: dropdown menu -->
    <DropdownMenuRoot v-else :modal="false">
      <DropdownMenuTrigger class="chart-menu-button" aria-label="Chart options">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="13" cy="8" r="1.5" />
        </svg>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          class="chart-menu-content"
          :side-offset="4"
          align="end"
        >
          <DropdownMenuItem
            v-for="item in items"
            :key="item.label"
            class="chart-menu-item"
            :aria-pressed="item.ariaPressed"
            @select="item.action"
          >
            {{ item.label }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </div>
</template>

<style scoped>
.chart-menu-trigger-area {
  position: absolute;
  top: 0.5em;
  right: 0.5em;
  z-index: 1;
}

/* In fullscreen the button anchors to the viewport corner (the wrapper's
   content padding doesn't move an absolutely-positioned child), so inset it
   further for modal-style breathing room. */
.chart-menu-trigger-area--expanded {
  top: 1.25em;
  right: 1.25em;
}

.chart-menu-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--color-border);
  border-radius: 0.25em;
  background: var(--color-bg-0, #fff);
  color: var(--color-text-secondary);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}

.chart-menu-button[data-state="open"] {
  opacity: 1;
}

/* The close button is always visible while the chart is expanded. */
.chart-close-button {
  opacity: 1;
}

.chart-menu-button:hover {
  background: var(--color-bg-1, rgba(0, 0, 0, 0.05));
  color: var(--color-text);
}
</style>

<style>
/* Reveal the menu button when the user hovers/focuses anywhere in the
   chart. These reference the parent wrapper classes, so they can't be
   scoped to ChartMenu. (In fullscreen the menu button is swapped for the
   always-visible close button, so no rule is needed there.) */
.line-chart-wrapper:hover .chart-menu-button,
.bar-chart-wrapper:hover .chart-menu-button,
.choropleth-wrapper:hover .chart-menu-button,
.line-chart-wrapper:focus-within .chart-menu-button,
.bar-chart-wrapper:focus-within .chart-menu-button,
.choropleth-wrapper:focus-within .chart-menu-button {
  opacity: 1;
}

/* Visually-hidden live region used by each chart wrapper to announce
   expansion. Lives here so it ships once with the shared menu. */
.chart-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.chart-menu-content {
  z-index: 100;
  background: var(--color-bg-0);
  border: 1px solid var(--color-border);
  border-radius: 0.25em;
  padding: 0.25em;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -2px rgba(0, 0, 0, 0.1);
  min-width: 140px;
}

.chart-menu-item {
  display: flex;
  align-items: center;
  padding: 0.375em 0.5em;
  border-radius: 0.25em;
  font-size: var(--font-size-sm);
  cursor: pointer;
  user-select: none;
  outline: none;
  white-space: nowrap;
}

.chart-menu-item[data-highlighted] {
  background: var(--color-primary);
  color: white;
}
</style>
