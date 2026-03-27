<script setup lang="ts">
import { computed } from "vue";
import { RouterView, RouterLink, useRoute, useRouter } from "vue-router";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from "reka-ui";
import { LightDarkToggle } from "@cfasim-ui/components";
import { models } from "./router";

const route = useRoute();
const router = useRouter();

const currentModel = computed(() => models.find((m) => m.path === route.path));

function navigate(path: string) {
  router.push(path);
}
</script>

<template>
  <nav class="nav">
    <RouterLink to="/" class="nav-title">CFA Simulator</RouterLink>
    <DropdownMenuRoot>
      <DropdownMenuTrigger class="nav-link">
        {{ currentModel?.name ?? "Models" }}
        <svg width="8" height="5" viewBox="0 0 10 6" fill="none">
          <path
            d="M1 1L5 5L9 1"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent class="nav-dropdown-menu" :side-offset="4">
          <DropdownMenuItem
            v-for="model in models"
            :key="model.path"
            class="nav-dropdown-item"
            @select="navigate(model.path)"
          >
            {{ model.name }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
    <a href="https://cdcgov.github.io/cfa-simulator/docs/" class="nav-link"
      >Docs</a
    >
    <div class="nav-spacer" />
    <LightDarkToggle />
    <a
      href="https://github.com/cdcgov/cfa-simulator"
      class="nav-link"
      target="_blank"
      rel="noopener"
    >
      <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
        <path
          d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
        />
      </svg>
    </a>
  </nav>
  <RouterView />
</template>

<style scoped>
.nav {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-0);
}

.nav-title {
  font-weight: 700;
  font-size: 1rem;
  text-decoration: none;
  color: var(--color-text);
  margin-right: 1rem;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.625rem;
  border-radius: 6px;
  font-size: 0.875rem;
  text-decoration: none;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
}

.nav-link:hover {
  color: var(--color-text);
  background: var(--color-bg-1, rgba(0, 0, 0, 0.05));
}

.nav-spacer {
  flex: 1;
}

@media (max-width: 767px) {
  .nav {
    padding-left: calc(var(--toggle-size, 2.25rem) + 0.5rem);
  }

  .nav-title {
    display: none;
  }
}
</style>

<style>
.nav-dropdown-menu {
  min-width: 200px;
  background: var(--color-bg-0);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.25rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.nav-dropdown-item {
  display: block;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
}

.nav-dropdown-item:hover,
.nav-dropdown-item[data-highlighted] {
  background: var(--color-bg-1, rgba(0, 0, 0, 0.05));
  color: var(--color-text);
  outline: none;
}
</style>
