<script setup lang="ts">
import { SwitchRoot, SwitchThumb, useId } from "reka-ui";
import Hint from "./Hint.vue";

const model = defineModel<boolean>();

const props = defineProps<{
  label: string;
  hint?: string;
  disabled?: boolean;
}>();

const id = useId();
</script>

<template>
  <div class="toggle">
    <label :for="id">{{ label }}</label>
    <Hint v-if="props.hint" :text="props.hint" />
    <SwitchRoot :id="id" v-model="model" :disabled="disabled" class="switch">
      <SwitchThumb class="thumb" />
    </SwitchRoot>
  </div>
</template>

<style scoped>
.toggle {
  display: flex;
  align-items: center;
  gap: 0.5em;
}

.toggle label {
  user-select: none;
}

.switch {
  --switch-w: 2.25em;
  --switch-h: 1.25em;
  --thumb-size: 1em;
  --thumb-offset: 0.125em;

  position: relative;
  width: var(--switch-w);
  height: var(--switch-h);
  flex-shrink: 0;
  background: var(--color-border-hover);
  border-radius: var(--switch-h);
  border: none;
  padding: 0;
  cursor: pointer;
  transition: background 0.15s;
}

.switch[data-state="checked"] {
  background: var(--color-primary);
}

.switch[data-disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

.thumb {
  display: block;
  width: var(--thumb-size);
  height: var(--thumb-size);
  background: white;
  border-radius: 50%;
  position: absolute;
  top: var(--thumb-offset);
  left: var(--thumb-offset);
  transition: transform 0.15s;
}

.switch[data-state="checked"] .thumb {
  transform: translateX(
    calc(var(--switch-w) - var(--thumb-size) - var(--thumb-offset) * 2)
  );
}
</style>
