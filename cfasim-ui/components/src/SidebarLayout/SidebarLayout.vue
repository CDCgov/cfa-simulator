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
// Room for both sidebars at their default widths beside a 480px main pane.
// Below it only one sidebar is open at a time.
const bothFitQuery = window.matchMedia("(min-width: 1200px)");
const isMobile = ref(mql.matches);
const collapsed = ref(mql.matches);
const rightCollapsed = ref(!bothFitQuery.matches);
// False once the user collapses the right sidebar where it had room. A
// window with no room closes it too, and that must not stick.
let rightWanted = true;

function onMediaChange(e: MediaQueryListEvent) {
  isMobile.value = e.matches;
  collapsed.value = e.matches;
  if (!bothFitQuery.matches) rightCollapsed.value = true;
}

function onBothFitChange(e: MediaQueryListEvent) {
  if (e.matches) {
    if (rightWanted) rightCollapsed.value = false;
  } else if (!collapsed.value) {
    rightCollapsed.value = true;
  }
}

onMounted(() => {
  mql.addEventListener("change", onMediaChange);
  bothFitQuery.addEventListener("change", onBothFitChange);
});

onUnmounted(() => {
  mql.removeEventListener("change", onMediaChange);
  bothFitQuery.removeEventListener("change", onBothFitChange);
});

function toggle() {
  collapsed.value = !collapsed.value;
  if (!collapsed.value && !bothFitQuery.matches) rightCollapsed.value = true;
}

function toggleRight() {
  rightCollapsed.value = !rightCollapsed.value;
  if (!rightCollapsed.value) {
    rightWanted = true;
    if (!bothFitQuery.matches) collapsed.value = true;
  } else if (!isMobile.value) {
    // On a phone collapsing is the only way back to the main pane.
    rightWanted = false;
  }
}

// On a phone an open sidebar pushes the main pane off screen, where the
// layout clips it. Keyboard focus landing there would be invisible, so bring
// the main pane back. Not for a pointer: the control would slide out from
// under it before the click lands.
function onMainFocusIn(event: FocusEvent) {
  if (!isMobile.value || (collapsed.value && rightCollapsed.value)) return;
  const target = event.target as Element;
  const focused = target.getBoundingClientRect();
  const clipped = focused.left < 0 || focused.right > window.innerWidth;
  if (clipped && target.matches(":focus-visible")) {
    collapsed.value = true;
    rightCollapsed.value = true;
  }
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
  <div
    class="SidebarLayout"
    :data-collapsed="collapsed"
    :data-right-collapsed="$slots['sidebar-right'] ? rightCollapsed : undefined"
  >
    <div class="SidebarRail" :data-collapsed="collapsed">
      <aside
        class="Sidebar"
        :aria-label="$slots['sidebar-right'] ? 'Left sidebar' : undefined"
        :inert="collapsed"
      >
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
    <main class="Main" @focusin="onMainFocusIn">
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
          <button
            v-if="isMobile && $slots['sidebar-right'] && rightCollapsed"
            type="button"
            class="Toggle Toggle--end"
            aria-label="Expand right sidebar"
            title="Expand right sidebar"
            @click="toggleRight"
          >
            <Icon icon="keyboard_double_arrow_left" size="sm" />
          </button>
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
          <button
            v-if="isMobile && $slots['sidebar-right'] && rightCollapsed"
            type="button"
            class="Toggle Toggle--end"
            aria-label="Expand right sidebar"
            title="Expand right sidebar"
            @click="toggleRight"
          >
            <Icon icon="keyboard_double_arrow_left" size="sm" />
          </button>
        </div>
        <div class="MainScroll">
          <div class="MainContent" :style="mainContentStyle">
            <slot />
          </div>
        </div>
      </template>
    </main>
    <div
      v-if="$slots['sidebar-right']"
      class="SidebarRail SidebarRail--right"
      :data-collapsed="rightCollapsed"
    >
      <aside class="Sidebar" aria-label="Right sidebar" :inert="rightCollapsed">
        <div class="SidebarScroll">
          <div class="SidebarHeader">
            <button
              type="button"
              class="Toggle"
              aria-label="Collapse right sidebar"
              title="Collapse right sidebar"
              @click="toggleRight"
            >
              <Icon icon="keyboard_double_arrow_right" size="sm" />
            </button>
            <div
              v-if="$slots['sidebar-right-header-start']"
              class="SidebarHeaderStart"
            >
              <slot name="sidebar-right-header-start" />
            </div>
            <div
              v-if="$slots['sidebar-right-header-end']"
              class="SidebarHeaderEnd"
            >
              <slot name="sidebar-right-header-end" />
            </div>
          </div>
          <slot name="sidebar-right" />
        </div>
      </aside>
      <button
        type="button"
        class="Toggle Toggle--expand"
        :inert="!rightCollapsed"
        aria-label="Expand right sidebar"
        title="Expand right sidebar"
        @click="toggleRight"
      >
        <Icon icon="keyboard_double_arrow_left" size="sm" />
      </button>
    </div>
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

.SidebarRail--right {
  width: var(--sidebar-right-width);
}

@media (min-width: 768px) {
  .SidebarRail[data-collapsed="true"] {
    width: var(--toggle-size);
    background-color: var(--color-bg-1);
    border-right: 1px solid var(--color-border);
    box-shadow: var(--shadow-sm);
  }

  .SidebarRail--right[data-collapsed="true"] {
    border-right: 0;
    border-left: 1px solid var(--color-border);
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

.SidebarRail--right .Sidebar {
  width: var(--sidebar-right-width);
}

.SidebarRail[data-collapsed="true"] .Sidebar {
  transform: translateX(-100%);
}

.SidebarRail--right[data-collapsed="true"] .Sidebar {
  transform: translateX(100%);
}

/* The scroll panes are positioned so absolute descendants (visually-hidden
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

.SidebarRail--right .SidebarScroll {
  border-right: 0;
  border-left: 1px solid var(--color-border);
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

/* Mirrored: the collapse button leads, on the edge next to the main pane. */
.SidebarRail--right .SidebarHeader {
  justify-content: flex-start;
  margin: calc(-1 * var(--space-4)) 0 0 calc(-1 * var(--space-2));
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

.SidebarRail[data-collapsed="true"] .Toggle--expand {
  opacity: 1;
  pointer-events: auto;
}

/* The phone's right expand button takes the far end of the bar, after the
   end group when there is one. */
.Toggle--end {
  margin-left: auto;
}

.TopbarEnd + .Toggle--end,
.TabsBarEnd + .Toggle--end {
  margin-left: 0;
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

/* Phone: the panes sit side by side, wider than the screen, and shift
   together to bring one into view. The layout clips whatever is off screen,
   so the page itself never scrolls sideways. Screen only: a printed page is
   narrower than the breakpoint too. */
@media screen and (max-width: 767px) {
  .SidebarLayout {
    --sidebar-shown-width: min(var(--sidebar-width), 100vw);
    --sidebar-right-shown-width: min(var(--sidebar-right-width), 100vw);
    --pane-shift: 0px;
    overflow-x: clip;
  }

  .SidebarLayout[data-collapsed="true"] {
    --pane-shift: calc(-1 * var(--sidebar-shown-width));
  }

  .SidebarLayout[data-right-collapsed="false"] {
    --pane-shift: calc(
      -1 * (var(--sidebar-shown-width) + var(--sidebar-right-shown-width))
    );
  }

  .SidebarRail,
  .Main {
    transform: translateX(var(--pane-shift));
  }

  .SidebarRail {
    min-width: var(--sidebar-shown-width);
    width: var(--sidebar-shown-width);
    transition:
      transform var(--transition-normal),
      width var(--transition-normal);
  }

  .Main {
    min-width: 100vw;
    transition: transform var(--transition-normal);
  }

  .Sidebar {
    width: var(--sidebar-shown-width);
  }

  .SidebarRail[data-collapsed="true"] .Sidebar {
    transform: translateX(0);
  }

  /* The right rail opens by growing from nothing as the panes shift by the
     same amount, so it slides in from the edge of the screen. */
  .SidebarRail--right {
    min-width: 0;
    width: var(--sidebar-right-shown-width);
  }

  .SidebarRail--right[data-collapsed="true"] {
    width: 0;
  }

  .SidebarRail--right .Sidebar {
    width: var(--sidebar-right-shown-width);
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
