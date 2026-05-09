<script setup lang="ts">
import { computed, onUnmounted, watch } from "vue";
import { type GapToken, resolveGap } from "../_internal/gap";

export type GridGap = GapToken;
export type GridCols = number | (number | string)[];

const props = defineProps<{
  cols?: GridCols;
  colsSmall?: GridCols;
  breakpoint?: string;
  gap?: GridGap | string;
  minColWidth?: string;
}>();

const resolvedGap = computed(() => resolveGap(props.gap));

const resolvedColumns = computed(() => {
  if (props.minColWidth) {
    return `repeat(auto-fit, minmax(${props.minColWidth}, 1fr))`;
  }
  return colsToTemplate(props.cols ?? 2);
});

const resolvedSmallColumns = computed(() => {
  if (props.minColWidth || props.colsSmall == null) {
    return resolvedColumns.value;
  }
  return colsToTemplate(props.colsSmall);
});

const safeBreakpoint = computed(() =>
  sanitizeBreakpoint(props.breakpoint ?? DEFAULT_BREAKPOINT),
);

let acquired: string | null = null;
const stopWatch = watch(
  safeBreakpoint,
  (next) => {
    if (acquired === next) return;
    acquireBreakpoint(next);
    if (acquired) releaseBreakpoint(acquired);
    acquired = next;
  },
  { immediate: true },
);

onUnmounted(() => {
  stopWatch();
  if (acquired) {
    releaseBreakpoint(acquired);
    acquired = null;
  }
});
</script>

<script lang="ts">
const DEFAULT_BREAKPOINT = "640px";

function colsToTemplate(cols: GridCols): string {
  if (typeof cols === "number") return `repeat(${cols}, 1fr)`;
  return cols.map((c) => (typeof c === "number" ? `${c}fr` : c)).join(" ");
}

// Allow only digits, dot, and unit letters/percent. Falls back to the default
// when input doesn't look like a CSS length, preventing rule-escape via the
// breakpoint prop.
function sanitizeBreakpoint(value: string): string {
  return /^\d+(\.\d+)?[a-zA-Z%]+$/.test(value) ? value : DEFAULT_BREAKPOINT;
}

// Module-scope cache: one <style> per unique breakpoint, ref-counted across
// all Grid instances. The grid's inline `--grid-cols-small` is consumed by
// the rule in the cached <style>.
type Entry = { count: number; el: HTMLStyleElement };
const breakpointSheets = new Map<string, Entry>();

function acquireBreakpoint(breakpoint: string) {
  if (typeof document === "undefined") return;
  const existing = breakpointSheets.get(breakpoint);
  if (existing) {
    existing.count++;
    return;
  }
  const el = document.createElement("style");
  el.setAttribute("data-cfasim-grid-bp", breakpoint);
  el.textContent =
    `@container (max-width: ${breakpoint}) {` +
    `[data-cfasim-grid-bp="${breakpoint}"] > .grid {` +
    `grid-template-columns: var(--grid-cols-small) !important;` +
    `}}`;
  document.head.appendChild(el);
  breakpointSheets.set(breakpoint, { count: 1, el });
}

function releaseBreakpoint(breakpoint: string) {
  if (typeof document === "undefined") return;
  const entry = breakpointSheets.get(breakpoint);
  if (!entry) return;
  entry.count--;
  if (entry.count === 0) {
    entry.el.remove();
    breakpointSheets.delete(breakpoint);
  }
}

const hmr = (import.meta as { hot?: { dispose: (cb: () => void) => void } })
  .hot;
hmr?.dispose(() => {
  breakpointSheets.forEach(({ el }) => el.remove());
  breakpointSheets.clear();
});
</script>

<template>
  <div :data-cfasim-grid-bp="safeBreakpoint" class="grid-wrapper">
    <div
      class="grid"
      :style="{
        gap: resolvedGap,
        gridTemplateColumns: resolvedColumns,
        '--grid-cols-small': resolvedSmallColumns,
      }"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.grid-wrapper {
  container-type: inline-size;
  width: 100%;
  min-width: 0;
}

.grid {
  display: grid;
  min-width: 0;
}

.grid > :deep(*) {
  min-width: 0;
}
</style>
