<script setup lang="ts">
import {
  CollapsibleRoot,
  CollapsibleTrigger,
  CollapsibleContent,
} from "reka-ui";
import "../_internal/collapsible.css";

const open = defineModel<boolean>("open", { default: false });

defineProps<{
  label?: string;
}>();
</script>

<template>
  <CollapsibleRoot v-model:open="open" class="expander">
    <CollapsibleTrigger class="expander-trigger">
      <span class="cfasim-caret" :data-open="open || undefined" />
      <slot name="label">{{ label }}</slot>
    </CollapsibleTrigger>
    <CollapsibleContent class="expander-content cfasim-collapsible">
      <slot />
    </CollapsibleContent>
  </CollapsibleRoot>
</template>

<style scoped>
.expander-trigger {
  display: flex;
  align-items: center;
  gap: 0.5em;
  width: 100%;
  padding: 0.5em 0;
  background: none;
  border: none;
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
}

.expander-trigger:hover {
  color: var(--color-text);
}

.expander-content {
  display: flex;
  flex-direction: column;
  gap: 0.75em;
}
</style>
