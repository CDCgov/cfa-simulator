<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import Icon from "../Icon/Icon.vue";
import LightDarkToggle from "../LightDarkToggle/LightDarkToggle.vue";

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
</script>

<template>
  <div
    class="SidebarLayout"
    :data-collapsed="collapsed"
    :data-mobile="isMobile"
  >
    <div v-if="isMobile && !collapsed" class="Overlay" @click="toggle" />
    <button
      v-if="isMobile"
      type="button"
      class="Toggle MobileToggle"
      :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      @click="toggle"
    >
      <Icon
        :icon="collapsed ? 'left_panel_open' : 'left_panel_close'"
        size="sm"
      />
    </button>
    <div class="SidebarRail">
      <aside class="Sidebar">
        <div class="SidebarScroll">
          <slot name="sidebar" />
        </div>
        <button
          v-if="!isMobile"
          type="button"
          class="Toggle"
          :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          @click="toggle"
        >
          <Icon
            :icon="collapsed ? 'left_panel_open' : 'left_panel_close'"
            size="sm"
          />
        </button>
      </aside>
    </div>
    <main class="Main">
      <div class="Topbar">
        <slot name="topbar">
          <LightDarkToggle />
        </slot>
      </div>
      <div class="MainScroll">
        <div class="MainContent">
          <slot />
        </div>
      </div>
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
}

.SidebarLayout[data-collapsed="true"] .SidebarRail {
  width: var(--toggle-size);
  background-color: var(--color-bg-1);
  border-right: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
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

.SidebarLayout[data-collapsed="true"] .Toggle:not(.MobileToggle) {
  transform: translateX(100%);
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
  justify-content: flex-end;
  padding: var(--space-2) var(--space-4);
  flex-shrink: 0;
}

@media (min-width: 768px) {
  .Topbar {
    padding: var(--space-2) var(--space-4) var(--space-2) var(--space-20);
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

.SidebarLayout[data-mobile="true"] .MainScroll {
  padding-top: calc(var(--toggle-size) + var(--space-2));
}

@media (min-width: 768px) {
  .MainContent {
    padding: 0 var(--space-4) 0 var(--space-20);
  }
}

/* Mobile: sidebar overlays content */
.Overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 10;
}

.SidebarLayout[data-mobile="true"] .SidebarRail {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 11;
  width: var(--sidebar-width);
  max-width: 85vw;
  transition: transform var(--transition-normal);
  transform: translateX(0);
}

.SidebarLayout[data-mobile="true"][data-collapsed="true"] .SidebarRail {
  transform: translateX(-100%);
  width: var(--sidebar-width);
  max-width: 85vw;
  background-color: transparent;
  border-right: none;
  box-shadow: none;
}

.SidebarLayout[data-mobile="true"] .Sidebar {
  width: 100%;
}

.SidebarLayout[data-mobile="true"][data-collapsed="true"] .Sidebar {
  transform: translateX(0);
}

.MobileToggle {
  position: fixed;
  top: var(--space-1);
  left: calc(min(var(--sidebar-width), 85vw) + var(--space-1));
  z-index: 12;
  background: none;
  border: none;
  box-shadow: none;
  border-radius: var(--radius-md);
  transition: left var(--transition-normal);
}

.SidebarLayout[data-collapsed="true"] .MobileToggle {
  left: var(--space-1);
}
</style>
