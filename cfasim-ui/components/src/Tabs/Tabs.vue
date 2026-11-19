<script setup lang="ts">
import {
  getCurrentInstance,
  onMounted,
  onUnmounted,
  computed,
  ref,
  watch,
} from "vue";
import type { ComponentPublicInstance } from "vue";
import { TabsRoot, TabsList, TabsTrigger, TabsIndicator } from "reka-ui";

export interface Tab {
  value: string;
  label: string;
  /** Route path to navigate to when vue-router is installed. */
  to?: string;
}

export interface TabsProps {
  tabs: Tab[];
  /** Accessible name of the tab list. */
  label?: string;
}

const props = withDefaults(defineProps<TabsProps>(), { label: "Tabs" });

const model = defineModel<string>();

// Optional vue-router integration (no hard dependency).
// $router/$route on globalProperties is vue-router's stable public API.
// $route is defined as a getter that returns the current route, so we
// must re-read it from globalProperties on each access to track changes.
const instance = getCurrentInstance();
const globals = instance?.appContext.config.globalProperties;
const router = globals?.$router;

const isRouterMode = computed(
  () => !!router && props.tabs.some((tab) => tab.to),
);

// Read in the getter so the first render already shows the route's tab: the
// watch below only reaches a controlled model a tick later.
const routeTab = computed(() => {
  if (!isRouterMode.value) return undefined;
  const path = globals?.$route?.path;
  return props.tabs.find((tab) => tab.to === path)?.value;
});

const activeTab = computed({
  get() {
    return model.value ?? routeTab.value ?? props.tabs[0]?.value;
  },
  set(value: string | undefined) {
    if (!value) return;
    model.value = value;
    if (isRouterMode.value && router) {
      const target = props.tabs.find((tab) => tab.value === value);
      if (target?.to) router.push(target.to);
    }
  },
});

watch(
  routeTab,
  (value) => {
    if (value) model.value = value;
  },
  { immediate: true },
);

// The list scrolls sideways when the tabs do not fit. Each edge fades while
// more tabs are hidden past it.
const EDGE_PEEK = 24;
const list = ref<ComponentPublicInstance | null>(null);
const hiddenBefore = ref(false);
const hiddenAfter = ref(false);

function listElement(): HTMLElement | null {
  return list.value?.$el ?? null;
}

function updateEdges() {
  const el = listElement();
  if (!el) return;
  const maxScroll = el.scrollWidth - el.clientWidth;
  hiddenBefore.value = el.scrollLeft > 1;
  hiddenAfter.value = el.scrollLeft < maxScroll - 1;
}

// Scrolls only the list: scrollIntoView would also move the page.
function revealActiveTab() {
  const el = listElement();
  if (!el) return;
  const index = props.tabs.findIndex((tab) => tab.value === activeTab.value);
  const trigger = el.querySelectorAll<HTMLElement>("[role='tab']")[index];
  if (!trigger) return;
  const start = trigger.offsetLeft - EDGE_PEEK;
  const end = trigger.offsetLeft + trigger.offsetWidth + EDGE_PEEK;
  const widerThanList = end - start > el.clientWidth;
  if (start < el.scrollLeft || widerThanList) {
    el.scrollLeft = start;
  } else if (end > el.scrollLeft + el.clientWidth) {
    el.scrollLeft = end - el.clientWidth;
  }
  updateEdges();
}

// The triggers are observed too: a font swap or a label edit changes how much
// is hidden without resizing the list itself.
let resizeObserver: ResizeObserver | undefined;

function observeSizes() {
  const el = listElement();
  if (!el || !resizeObserver) return;
  resizeObserver.disconnect();
  resizeObserver.observe(el);
  for (const trigger of el.querySelectorAll("[role='tab']")) {
    resizeObserver.observe(trigger);
  }
}

onMounted(() => {
  resizeObserver = new ResizeObserver(updateEdges);
  observeSizes();
  revealActiveTab();
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

watch(activeTab, revealActiveTab, { flush: "post" });
watch(
  () => props.tabs,
  () => {
    observeSizes();
    revealActiveTab();
  },
  { deep: true, flush: "post" },
);
</script>

<template>
  <TabsRoot
    :model-value="activeTab"
    class="Tabs"
    @update:model-value="activeTab = $event as string"
  >
    <TabsList
      ref="list"
      class="TabsList"
      :aria-label="label"
      :data-hidden-before="hiddenBefore || undefined"
      :data-hidden-after="hiddenAfter || undefined"
      @scroll.passive="updateEdges"
    >
      <TabsTrigger
        v-for="tab in tabs"
        :key="tab.value"
        :value="tab.value"
        class="TabsTrigger"
      >
        {{ tab.label }}
      </TabsTrigger>
      <TabsIndicator
        class="TabsIndicator"
        :style="{
          width: 'var(--reka-tabs-indicator-size)',
          left: 'var(--reka-tabs-indicator-position)',
        }"
      />
    </TabsList>
  </TabsRoot>
</template>

<style scoped>
.Tabs {
  display: flex;
  min-width: 0;
  border-bottom: 1px solid var(--color-border);
}

.TabsList {
  --fade-before: 0px;
  --fade-after: 0px;
  display: flex;
  flex: 1;
  min-width: 0;
  gap: var(--space-1);
  position: relative;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  mask-image: linear-gradient(
    to right,
    transparent,
    black var(--fade-before),
    black calc(100% - var(--fade-after)),
    transparent
  );
}

.TabsList::-webkit-scrollbar {
  display: none;
}

.TabsList[data-hidden-before] {
  --fade-before: var(--space-8);
}

.TabsList[data-hidden-after] {
  --fade-after: var(--space-8);
}

.TabsTrigger {
  position: relative;
  flex-shrink: 0;
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
  font-weight: 500;
  font-family: inherit;
  white-space: nowrap;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background-color var(--transition-fast);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
}

.TabsTrigger:hover {
  color: var(--color-text);
  background-color: var(--color-bg-1);
}

.TabsTrigger[data-state="active"] {
  color: var(--color-text);
}

/* Inset: the scrolling list clips an outer ring. */
.TabsTrigger:focus-visible {
  outline: none;
  box-shadow: inset var(--shadow-focus);
}

.TabsIndicator {
  position: absolute;
  bottom: 0;
  height: 2px;
  background-color: var(--color-text);
  transition:
    width var(--transition-fast),
    left var(--transition-fast);
}
</style>
