<script setup lang="ts">
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from "reka-ui";
import HintTrigger from "./HintTrigger.vue";

defineProps<{
  text: string;
}>();
</script>

<template>
  <TooltipProvider>
    <TooltipRoot :delay-duration="0" disable-closing-trigger>
      <TooltipTrigger as-child>
        <HintTrigger />
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
