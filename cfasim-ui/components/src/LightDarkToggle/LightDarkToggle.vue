<script setup lang="ts">
import { ref, watch } from "vue";
import Icon from "../Icon/Icon.vue";

const isDark = ref(window.matchMedia("(prefers-color-scheme: dark)").matches);

function apply(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.classList.toggle("light", !dark);
}

apply(isDark.value);

watch(isDark, apply);
</script>

<template>
  <button
    class="light-dark-toggle"
    type="button"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    @click="isDark = !isDark"
  >
    <Icon :icon="isDark ? 'dark_mode' : 'light_mode'" size="sm" />
  </button>
</template>

<style scoped>
.light-dark-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: 0.25em;
  background: var(--color-bg-0);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background-color var(--transition-fast);
}

.light-dark-toggle:hover {
  color: var(--color-text);
  background: var(--color-bg-1);
}
</style>
