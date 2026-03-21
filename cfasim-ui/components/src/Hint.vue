<script setup lang="ts">
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from "reka-ui";
import Icon from "./Icon.vue";

defineProps<{
  text: string;
}>();
</script>

<template>
  <TooltipProvider>
    <TooltipRoot :delay-duration="0">
      <TooltipTrigger as-child>
        <button type="button" class="HintTrigger" aria-label="More info">
          <Icon icon="help" :size="16" />
        </button>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent class="HintContent" side="top" :side-offset="4">
          {{ text }}
          <TooltipArrow class="HintArrow" :width="10" :height="5" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>

<style scoped>
.HintTrigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25em;
  height: 1.25em;
  padding: 0;
  margin: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  flex-shrink: 0;
}

.HintTrigger:hover {
  color: var(--color-text);
}

.HintTrigger:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}
</style>

<style>
.HintContent {
  max-width: 15rem;
  padding: 0.5em 0.75em;
  font-size: var(--font-size-xs);
  line-height: 1.4;
  color: var(--color-bg-0);
  background-color: var(--color-text);
  border-radius: 0.25em;
  box-shadow: var(--shadow-md);
  z-index: 100;
}

.HintArrow {
  fill: var(--color-text);
}
</style>
