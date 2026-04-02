<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onMounted,
  onUnmounted,
  getCurrentInstance,
} from "vue";
import { TabsRoot, TabsList, TabsTrigger, TabsIndicator } from "reka-ui";
import Icon from "../Icon/Icon.vue";
import LightDarkToggle from "../LightDarkToggle/LightDarkToggle.vue";

// Optional vue-router integration (no hard dependency).
// $router/$route on globalProperties is vue-router's stable public API.
const instance = getCurrentInstance();
const router = instance?.appContext.config.globalProperties.$router;
const route = instance?.appContext.config.globalProperties.$route;

export interface Tab {
  value: string;
  label: string;
  to?: string;
}

const props = defineProps<{
  hideTopbar?: boolean;
  tabs?: Tab[];
}>();

const tab = defineModel<string>("tab");

const mql = window.matchMedia("(max-width: 767px)");
const isMobile = ref(mql.matches);
const collapsed = ref(mql.matches);

function onMediaChange(e: MediaQueryListEvent) {
  isMobile.value = e.matches;
  collapsed.value = e.matches;
}

onMounted(() => {
  mql.addEventListener("change", onMediaChange);
});

onUnmounted(() => {
  mql.removeEventListener("change", onMediaChange);
});

function toggle() {
  collapsed.value = !collapsed.value;
}

const isRouterMode = computed(() => !!router && props.tabs?.some((t) => t.to));

const activeTab = computed({
  get() {
    return tab.value ?? props.tabs?.[0]?.value;
  },
  set(value: string | undefined) {
    if (!value) return;
    tab.value = value;
    if (isRouterMode.value && router) {
      const target = props.tabs?.find((t) => t.value === value);
      if (target?.to) router.push(target.to);
    }
  },
});

// Sync active tab from route changes in router mode
if (route) {
  watch(
    () => route.path,
    () => {
      if (isRouterMode.value) {
        const match = props.tabs?.find((t) => t.to === route.path);
        if (match) tab.value = match.value;
      }
    },
    { immediate: true },
  );
}
</script>

<template>
  <div class="SidebarLayout" :data-collapsed="collapsed">
    <div class="SidebarRail">
      <aside class="Sidebar">
        <div class="SidebarScroll">
          <div class="SidebarHeader">
            <button
              type="button"
              class="Toggle"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              @click="toggle"
            >
              <Icon icon="keyboard_double_arrow_left" size="sm" />
            </button>
          </div>
          <slot name="sidebar" />
        </div>
      </aside>
      <button
        type="button"
        class="Toggle Toggle--expand"
        aria-label="Expand sidebar"
        title="Expand sidebar"
        @click="toggle"
      >
        <Icon icon="keyboard_double_arrow_right" size="sm" />
      </button>
    </div>
    <main class="Main">
      <TabsRoot
        v-if="tabs?.length"
        :model-value="activeTab"
        class="TabsLayout"
        @update:model-value="activeTab = $event as string"
      >
        <div class="TabsBar">
          <button
            v-if="isMobile && collapsed"
            type="button"
            class="Toggle"
            aria-label="Expand sidebar"
            title="Expand sidebar"
            @click="toggle"
          >
            <Icon icon="keyboard_double_arrow_right" size="sm" />
          </button>
          <TabsList class="TabsList" aria-label="Tabs">
            <TabsTrigger
              v-for="t in tabs"
              :key="t.value"
              :value="t.value"
              class="TabsTrigger"
            >
              {{ t.label }}
            </TabsTrigger>
            <TabsIndicator
              class="TabsIndicator"
              :style="{
                width: 'var(--reka-tabs-indicator-size)',
                left: 'var(--reka-tabs-indicator-position)',
              }"
            />
          </TabsList>
          <div v-if="!hideTopbar" class="TabsBarEnd">
            <LightDarkToggle />
          </div>
        </div>
        <div class="MainScroll">
          <div class="MainContent">
            <slot />
          </div>
        </div>
      </TabsRoot>
      <template v-else>
        <div class="Topbar">
          <button
            v-if="isMobile && collapsed"
            type="button"
            class="Toggle"
            aria-label="Expand sidebar"
            title="Expand sidebar"
            @click="toggle"
          >
            <Icon icon="keyboard_double_arrow_right" size="sm" />
          </button>
          <div class="TopbarEnd">
            <LightDarkToggle v-if="!hideTopbar" />
          </div>
        </div>
        <div class="MainScroll">
          <div class="MainContent">
            <slot />
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
.SidebarLayout {
  display: flex;
  height: 100vh;
  height: 100dvh;
  background-color: var(--color-bg-0);
  color: var(--color-text);
  font-family: var(--font-family);
  position: relative;
}

.SidebarRail {
  flex-shrink: 0;
  width: var(--sidebar-width);
  height: 100%;
  overflow: hidden;
  transition: width var(--transition-normal);
  position: relative;
}

@media (min-width: 768px) {
  .SidebarLayout[data-collapsed="true"] .SidebarRail {
    width: var(--toggle-size);
    background-color: var(--color-bg-1);
    border-right: 1px solid var(--color-border);
    box-shadow: var(--shadow-sm);
  }
}

.Sidebar {
  font-size: var(--font-size-sm);
  display: flex;
  width: var(--sidebar-width);
  height: 100%;
  transform: translateX(0);
  transition: transform var(--transition-normal);
}

.SidebarLayout[data-collapsed="true"] .Sidebar {
  transform: translateX(-100%);
}

.SidebarScroll {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: var(--space-4);
  background-color: var(--color-bg-1);
  border-right: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.SidebarScroll:hover {
  scrollbar-color: var(--color-border) transparent;
}

.SidebarScroll :deep(h2) {
  font-size: var(--font-size-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
  margin: var(--space-4) 0 var(--space-2);
}

.SidebarScroll > :deep(h2:first-child) {
  margin-top: 0;
}

.Toggle {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--toggle-size);
  height: var(--toggle-size);
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background-color var(--transition-fast);
}

.Toggle:hover {
  color: var(--color-text);
  background-color: var(--color-bg-2);
}

.Toggle:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.SidebarHeader {
  display: flex;
  justify-content: flex-end;
  margin: calc(-1 * var(--space-4)) calc(-1 * var(--space-4))
    calc(-1 * var(--space-3));
}

.Toggle--expand {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--transition-fast);
}

.SidebarLayout[data-collapsed="true"] .Toggle--expand {
  opacity: 1;
  pointer-events: auto;
}

.Main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--color-bg-0);
  font-size: var(--font-size-md);
}

.Topbar {
  display: flex;
  align-items: center;
  min-height: var(--toggle-size);
  padding: 0 var(--space-4);
  flex-shrink: 0;
}

.TopbarEnd {
  margin-left: auto;
}

@media (min-width: 768px) {
  .Topbar {
    padding: 0 var(--space-4) 0 var(--space-20);
  }
}

.MainScroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--space-6) 0;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.MainScroll:hover {
  scrollbar-color: var(--color-border) transparent;
}

.MainContent {
  max-width: 1024px;
  padding: 0 var(--space-4);
}

@media (min-width: 768px) {
  .MainContent {
    padding: 0 var(--space-4) 0 var(--space-20);
  }
}

/* Mobile: use transform instead of width resize */
@media (max-width: 767px) {
  .SidebarLayout {
    transition: transform var(--transition-normal);
  }

  .SidebarLayout[data-collapsed="true"] {
    transform: translateX(calc(-1 * var(--sidebar-width)));
  }

  .SidebarLayout[data-collapsed="true"] .Sidebar {
    transform: translateX(0);
  }

  .SidebarRail {
    min-width: var(--sidebar-width);
  }

  .Main {
    min-width: 100vw;
  }

  .Toggle--expand {
    display: none;
  }
}

/* Tabs */
.TabsLayout {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.TabsBar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  min-height: var(--toggle-size);
  border-bottom: 1px solid var(--color-border);
  padding: 0 var(--space-4);
}

.TabsBarEnd {
  margin-left: auto;
}

.TabsList {
  display: flex;
  gap: var(--space-1);
  position: relative;
  align-self: stretch;
}

.TabsTrigger {
  position: relative;
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
  font-weight: 500;
  font-family: inherit;
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

.TabsTrigger:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
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
