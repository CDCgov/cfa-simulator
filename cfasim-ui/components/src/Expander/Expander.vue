<script setup lang="ts">
import {
  CollapsibleRoot,
  CollapsibleTrigger,
  CollapsibleContent,
} from "reka-ui";

const open = defineModel<boolean>("open", { default: false });

defineProps<{
  label?: string;
}>();
</script>

<template>
  <CollapsibleRoot v-model:open="open" class="expander">
    <CollapsibleTrigger class="expander-trigger">
      <span class="expander-caret" :class="{ open }" />
      <slot name="label">{{ label }}</slot>
    </CollapsibleTrigger>
    <CollapsibleContent class="expander-content">
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

.expander-caret {
  display: inline-block;
  width: 0;
  height: 0;
  border-left: 0.35em solid currentColor;
  border-top: 0.3em solid transparent;
  border-bottom: 0.3em solid transparent;
  transition: transform 0.15s;
}

.expander-caret.open {
  transform: rotate(90deg);
}

.expander-content {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.75em;
}

.expander-content[data-state="open"] {
  animation: slideDown 200ms ease-out;
}

.expander-content[data-state="closed"] {
  animation: slideUp 200ms ease-out;
}

@keyframes slideDown {
  from {
    height: 0;
  }
  to {
    height: var(--reka-collapsible-content-height);
  }
}

@keyframes slideUp {
  from {
    height: var(--reka-collapsible-content-height);
  }
  to {
    height: 0;
  }
}
</style>
