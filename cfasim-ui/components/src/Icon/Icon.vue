<script setup lang="ts">
import type { CSSProperties } from "vue";
import { computed } from "vue";

export type IconSize = "sm" | "md" | "lg" | "xl";

interface Props {
  icon: string;
  size?: IconSize | number;
  fill?: boolean;
  weight?: number;
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
const numericSize = computed(() =>
  typeof props.size === "number" ? props.size : undefined,
);

const inlineStyle = computed<CSSProperties>(() => {
  const style: CSSProperties = {};
  if (numericSize.value !== undefined) {
    style.fontSize = `${numericSize.value}px`;
    (style as Record<string, unknown>)["--icon-opsz"] = numericSize.value;
  }
  if (props.weight !== undefined) {
    (style as Record<string, unknown>)["--icon-weight"] = props.weight;
  }
  if (props.grade !== undefined) {
    (style as Record<string, unknown>)["--icon-grade"] = props.grade;
  }
  return style;
});
</script>

<template>
  <span
    class="Icon"
    :data-size="sizePreset"
    :data-fill="fill ? 'true' : undefined"
    :data-inline="inline ? 'true' : undefined"
    :style="inlineStyle"
    :aria-hidden="decorative ? true : undefined"
    :aria-label="decorative ? undefined : ariaLabel"
    :role="decorative ? undefined : 'img'"
    >{{ icon }}</span
  >
</template>

<style>
.Icon {
  font-family: "Material Symbols Outlined", sans-serif;
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  font-feature-settings: "liga";
  -webkit-font-smoothing: antialiased;
  font-variation-settings:
    "FILL" var(--icon-fill, 0),
    "wght" var(--icon-weight, 400),
    "GRAD" var(--icon-grade, 0),
    "opsz" var(--icon-opsz, 24);
  color: inherit;
}

.Icon[data-size="sm"] {
  font-size: 20px;
  --icon-opsz: 20;
}
.Icon[data-size="md"] {
  font-size: 24px;
  --icon-opsz: 24;
}
.Icon[data-size="lg"] {
  font-size: 28px;
  --icon-opsz: 28;
}
.Icon[data-size="xl"] {
  font-size: 32px;
  --icon-opsz: 32;
}

.Icon[data-fill="true"] {
  --icon-fill: 1;
}

.Icon[data-inline="true"] {
  font-size: inherit;
  vertical-align: middle;
  transform: scale(1.2) translateY(-0.05em);
  transform-origin: 50% 50%;
}
</style>
