<script lang="ts">
import { ref } from "vue";
import { COLOR_SCHEME_STORAGE_KEY } from "@cfasim-ui/shared/colorScheme";

export type ColorScheme = "auto" | "light" | "dark";

const ICONS: Record<ColorScheme, string> = {
  auto: "contrast",
  light: "light_mode",
  dark: "dark_mode",
};

function nextScheme(current: ColorScheme, systemDark: boolean): ColorScheme {
  if (current === "auto") return systemDark ? "light" : "dark";
  if (current === "light") return systemDark ? "dark" : "auto";
  return systemDark ? "auto" : "light";
}

function readStored(): ColorScheme {
  try {
    const v = localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // localStorage may be unavailable in restricted contexts
  }
  return "auto";
}

function writeStored(value: ColorScheme) {
  try {
    if (value === "auto") {
      localStorage.removeItem(COLOR_SCHEME_STORAGE_KEY);
    } else {
      localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, value);
    }
  } catch {
    // localStorage may be unavailable in restricted contexts
  }
}

function apply(value: ColorScheme) {
  document.documentElement.classList.toggle("dark", value === "dark");
  document.documentElement.classList.toggle("light", value === "light");
}

const scheme = ref<ColorScheme>("auto");
</script>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from "vue";
import Icon from "../Icon/Icon.vue";

const mql = window.matchMedia("(prefers-color-scheme: dark)");
const systemDark = ref(mql.matches);

function onMediaChange(e: MediaQueryListEvent) {
  systemDark.value = e.matches;
}

onMounted(() => {
  mql.addEventListener("change", onMediaChange);
});

onUnmounted(() => {
  mql.removeEventListener("change", onMediaChange);
});

scheme.value = readStored();
apply(scheme.value);

watch(scheme, apply);

const label = computed(
  () => `Switch to ${nextScheme(scheme.value, systemDark.value)} mode`,
);

function cycle() {
  scheme.value = nextScheme(scheme.value, systemDark.value);
  writeStored(scheme.value);
}
</script>

<template>
  <button
    class="light-dark-toggle"
    type="button"
    :aria-label="label"
    :title="label"
    @click="cycle"
  >
    <template v-if="scheme === 'auto'">
      <Icon
        class="resolved-icon"
        :icon="systemDark ? ICONS.dark : ICONS.light"
        size="sm"
      />
      <Icon class="auto-icon" :icon="ICONS.auto" size="sm" />
    </template>
    <Icon v-else :icon="ICONS[scheme]" size="sm" />
  </button>
</template>

<style scoped>
.light-dark-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.25em;
  background: var(--color-bg-0);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.light-dark-toggle:hover {
  color: var(--color-text);
  background: var(--color-bg-1);
}

/* Auto shows the resolved scheme, revealing the auto icon on hover/focus. */
.light-dark-toggle .auto-icon,
.light-dark-toggle:is(:hover, :focus-visible) .resolved-icon {
  display: none;
}

.light-dark-toggle:is(:hover, :focus-visible) .auto-icon {
  display: inline-flex;
}
</style>
