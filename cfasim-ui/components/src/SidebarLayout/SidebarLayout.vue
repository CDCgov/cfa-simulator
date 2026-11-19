<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import Icon from "../Icon/Icon.vue";
import LightDarkToggle from "../LightDarkToggle/LightDarkToggle.vue";
import Tabs from "../Tabs/Tabs.vue";
import type { Tab } from "../Tabs/Tabs.vue";

const props = defineProps<{
  hideTopbar?: boolean;
  tabs?: Tab[];
  /** Max width of the main content: a CSS length, or a number of pixels. Default 1024px. */
  maxWidth?: string | number;
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

const mainContentStyle = computed(() => {
  const w = props.maxWidth;
  if (w === undefined) return undefined;
  return {
    "--main-content-max-width": typeof w === "number" ? `${w}px` : w,
  };
});
</script>

<template>
  <div class="SidebarLayout" :data-collapsed="collapsed">
    <div class="SidebarRail">
      <aside class="Sidebar" :inert="collapsed">
        <div class="SidebarScroll">
          <div class="SidebarHeader">
            <div
              v-if="$slots['sidebar-header-start']"
              class="SidebarHeaderStart"
            >
              <slot name="sidebar-header-start" />
            </div>
            <div v-if="$slots['sidebar-header-end']" class="SidebarHeaderEnd">
              <slot name="sidebar-header-end" />
            </div>
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
        :inert="!collapsed"
        aria-label="Expand sidebar"
        title="Expand sidebar"
        @click="toggle"
      >
        <Icon icon="keyboard_double_arrow_right" size="sm" />
      </button>
    </div>
    <main class="Main">
      <div v-if="tabs?.length" class="TabsLayout">
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
          <div v-if="$slots['topbar-start']" class="TopbarStart">
            <slot name="topbar-start" />
          </div>
          <Tabs v-model="tab" :tabs="tabs" class="BarTabs" />
          <div
            v-if="$slots['topbar-end'] || $slots.topbar || !hideTopbar"
            class="TabsBarEnd"
          >
            <slot name="topbar-end" />
            <!-- `topbar` is the pre-slot-split name of topbar-end. -->
            <slot name="topbar" />
            <LightDarkToggle v-if="!hideTopbar" />
          </div>
        </div>
        <div class="MainScroll">
          <div class="MainContent" :style="mainContentStyle">
            <slot />
          </div>
        </div>
      </div>
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
          <div v-if="$slots['topbar-start']" class="TopbarStart">
            <slot name="topbar-start" />
          </div>
          <div class="TopbarEnd">
            <slot name="topbar-end" />
            <!-- `topbar` is the pre-slot-split name of topbar-end. -->
            <slot name="topbar" />
            <LightDarkToggle v-if="!hideTopbar" />
          </div>
        </div>
        <div class="MainScroll">
          <div class="MainContent" :style="mainContentStyle">
            <slot />
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
.SidebarLayout {
  --bar-height: 2.75rem;
  --bar-control-size: 1.75rem;
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

/* Both scroll panes are positioned so absolute descendants (visually-hidden
   labels) are contained by the pane instead of the page. */
.SidebarScroll {
  flex: 1;
  min-width: 0;
  position: relative;
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

.SidebarHeader + :deep(h2) {
  margin-top: 0;
}

.SidebarHeader :deep(h2) {
  margin: 0;
}

.Toggle {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--bar-control-size);
  height: var(--bar-control-size);
  margin: 0;
  padding: 0;
  border: none;
  border-radius: var(--radius-md);
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

/* Pulled into the pane's padding so the band starts at the top edge and
   the button sits a half step in from the corner. */
.SidebarHeader {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  flex-shrink: 0;
  height: var(--bar-height);
  margin: calc(-1 * var(--space-4)) calc(-1 * var(--space-2)) 0 0;
}

/* Controls slotted into any header band size to the toggles. */
.SidebarHeader,
.Topbar,
.TabsBar {
  --input-height: var(--bar-control-size);
  --button-height: var(--bar-control-size);
  --button-padding-x: 0.75em;
}

.SidebarHeaderStart,
.SidebarHeaderEnd,
.TopbarStart,
.TopbarEnd,
.TabsBarEnd {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.SidebarHeaderStart {
  flex: 1;
}

.SidebarHeaderEnd,
.TopbarEnd,
.TabsBarEnd {
  margin-left: auto;
}

.Toggle--expand {
  position: absolute;
  top: calc((var(--bar-height) - var(--bar-control-size)) / 2);
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
  container-type: inline-size;
}

.Topbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--bar-height);
  padding: 0 var(--space-4);
  flex-shrink: 0;
}

@container (min-width: 768px) {
  .Topbar {
    padding: 0 var(--space-4) 0 var(--space-20);
  }
}

.MainScroll {
  flex: 1;
  min-height: 0;
  position: relative;
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
  max-width: var(--main-content-max-width, 1024px);
  padding: 0 var(--space-4);
}

@container (min-width: 768px) {
  .MainContent {
    padding: 0 var(--space-4) 0 var(--space-20);
  }
}

/* Mobile: use transform instead of width resize. Screen only: a printed
   page is narrower than the breakpoint too. */
@media screen and (max-width: 767px) {
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
  gap: var(--space-2);
  min-height: var(--bar-height);
  border-bottom: 1px solid var(--color-border);
  padding: 0 var(--space-4);
}

/* The tabs give way (and scroll) before the end controls do. */
.TabsBar .BarTabs {
  flex: 0 1 auto;
  align-self: stretch;
  border-bottom: 0;
}

.TabsBarEnd {
  flex-shrink: 0;
}

/* Narrow: the tabs take their own row under the other bar controls. */
@container (max-width: 480px) {
  .TabsBar {
    flex-wrap: wrap;
    row-gap: 0;
  }

  .TabsBar > :not(.BarTabs) {
    margin-block: calc((var(--bar-height) - var(--bar-control-size)) / 2);
  }

  .TabsBar .BarTabs {
    order: 1;
    flex-basis: 100%;
    height: var(--bar-height);
  }
}

/* Print: the layout is a viewport-high flex box whose main pane scrolls, so a
   printout would be the one visible screenful. Unroll it into plain blocks
   with the chrome hidden so the active content paginates. Last in the file
   so it wins by source order. */
@media print {
  .SidebarLayout,
  .Main,
  .TabsLayout,
  .MainScroll {
    display: block;
    height: auto;
    min-width: 0;
    overflow: visible;
    transform: none;
  }

  .SidebarRail,
  .Topbar,
  .TabsBar,
  .Toggle {
    display: none;
  }

  .MainScroll,
  .MainContent {
    padding: 0;
    max-width: none;
  }
}
</style>
