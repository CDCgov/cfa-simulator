<script setup lang="ts">
import type { CSSProperties } from "vue";
import { computed } from "vue";
import { getIconComponent, warnMissingIcon } from "./registry";
import { registerDefaultIcons } from "./defaultIcons";

// Driven from setup (a retained code path) so the base set survives
// tree-shaking; idempotent, so the per-instance call is effectively free.
registerDefaultIcons();

export type IconSize = "sm" | "md" | "lg" | "xl";

interface Props {
  icon: string;
  size?: IconSize | number;
  fill?: boolean;
  /** @deprecated No effect — SVG icons ship at weight 400. */
  weight?: number;
  /** @deprecated No effect — SVG icons ship at grade 0. */
  grade?: number;
  decorative?: boolean;
  ariaLabel?: string;
  inline?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: "md",
  fill: false,
  decorative: true,
  inline: false,
});

const sizePreset = computed(() =>
  typeof props.size === "string" ? props.size : undefined,
);

const inlineStyle = computed<CSSProperties>(() =>
  typeof props.size === "number"
    ? { width: `${props.size}px`, height: `${props.size}px` }
    : {},
);

const svg = computed(() => {
  const component = getIconComponent(props.icon, props.fill);
  if (!component) warnMissingIcon(props.icon);
  return component;
});
</script>

<template>
  <span
    class="Icon"
    :data-size="sizePreset"
    :data-inline="inline ? 'true' : undefined"
    :style="inlineStyle"
    :aria-hidden="decorative ? true : undefined"
    :aria-label="decorative ? undefined : ariaLabel"
    :role="decorative ? undefined : 'img'"
  >
    <component :is="svg" v-if="svg" />
  </span>
</template>

<style>
.Icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 24px;
  height: 24px;
  color: inherit;
}

.Icon svg {
  display: block;
  width: 100%;
  height: 100%;
  fill: currentColor;
}

.Icon[data-size="sm"] {
  width: 20px;
  height: 20px;
}
.Icon[data-size="md"] {
  width: 24px;
  height: 24px;
}
.Icon[data-size="lg"] {
  width: 28px;
  height: 28px;
}
.Icon[data-size="xl"] {
  width: 32px;
  height: 32px;
}

.Icon[data-inline="true"] {
  width: 1em;
  height: 1em;
  vertical-align: -0.125em;
}
</style>
