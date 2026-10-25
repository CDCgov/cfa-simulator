<script setup lang="ts">
/// <reference path="../svg.d.ts" />
import help from "@material-symbols/svg-400/outlined/help.svg?component";

// The (?) button on its own. `Hint.vue` renders this while the tooltip
// implementation loads, and `HintImpl.vue` wraps it as the tooltip trigger.
// `text` is declared only so it does not fall through onto the button as an
// attribute during the loading state.
defineProps<{ text?: string }>();
</script>

<template>
  <button
    type="button"
    class="HintTrigger"
    aria-label="More info"
    @pointerdown.prevent
  >
    <help class="HintIcon" />
  </button>
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

.HintIcon {
  display: block;
  width: 16px;
  height: 16px;
  fill: currentColor;
}
</style>
