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
}

defineProps<{
  items: ChartMenuItem[];
}>();
</script>

<template>
  <div class="chart-menu-trigger-area">
    <!-- Single item: plain button -->
    <button
      v-if="items.length === 1"
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
    <DropdownMenuRoot v-else>
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
  top: 0;
  right: 0;
  z-index: 1;
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

.chart-menu-button:hover {
  background: var(--color-bg-1, rgba(0, 0, 0, 0.05));
  color: var(--color-text);
}
</style>

<style>
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
