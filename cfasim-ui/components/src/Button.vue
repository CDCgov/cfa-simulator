<script setup lang="ts">
import { Primitive } from "reka-ui";
import type { PrimitiveProps } from "reka-ui";

interface Props extends PrimitiveProps {
  label?: string;
  variant?: "primary" | "secondary";
}

withDefaults(defineProps<Props>(), {
  as: "button",
  variant: "primary",
});

defineEmits<{
  click: [event: MouseEvent];
}>();
</script>

<template>
  <Primitive
    class="button"
    :data-variant="variant"
    :as="as"
    :as-child="asChild"
    @click="$emit('click', $event)"
  >
    <slot>{{ label }}</slot>
  </Primitive>
</template>

<style scoped>
.button {
  display: inline-flex;
  border: none;
  align-items: center;
  justify-content: center;
  align-self: flex-start;
  flex-shrink: 0;
  min-height: 2.5em;
  padding: 0 1em;
  font-size: var(--font-size-sm);
  font-weight: 500;
  border-radius: 0.375em;
  background-color: var(--color-primary);
  color: var(--color-text-on-primary);
}

.button:hover {
  cursor: pointer;
  background-color: var(--color-primary-hover);
}

.button:active {
  background-color: var(--color-primary-active);
}

.button:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button[data-variant="secondary"] {
  background-color: transparent;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
}

.button[data-variant="secondary"]:hover {
  background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.button[data-variant="secondary"]:active {
  background-color: color-mix(in srgb, var(--color-primary) 15%, transparent);
}
</style>
