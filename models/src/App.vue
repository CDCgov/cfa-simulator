<script setup lang="ts">
import { RouterView } from "vue-router";
import { SidebarLayout } from "@cfasim-ui/components";
import type { Tab } from "@cfasim-ui/components";
import { models } from "./router";

const tabs: Tab[] = models.map((m) => ({
  value: m.path,
  label: m.name,
  to: m.path,
}));
</script>

<template>
  <SidebarLayout :tabs="tabs">
    <template #sidebar>
      <div id="model-sidebar" class="model-sidebar"></div>
    </template>
    <template #topbar>
      <a
        href="https://cdcgov.github.io/cfa-simulator/docs/"
        class="topbar-link"
      >
        Docs
      </a>
      <a
        href="https://github.com/cdcgov/cfa-simulator"
        class="topbar-link"
        target="_blank"
        rel="noopener"
      >
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
          <path
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
          />
        </svg>
      </a>
    </template>
    <RouterView />
  </SidebarLayout>
</template>

<style scoped>
.model-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.topbar-link {
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 0.5rem;
  border-radius: 6px;
  font-size: var(--font-size-sm);
  text-decoration: none;
  color: var(--color-text-secondary);
}

.topbar-link:hover {
  color: var(--color-text);
}
</style>
