<script setup lang="ts">
import { ToggleGroupItem, ToggleGroupRoot } from "reka-ui";
import { computed } from "vue";
import FieldLabel from "../_internal/FieldLabel.vue";
import { useField, type FieldProps } from "../_internal/field";

export interface ToggleGroupOption {
  value: string;
  label: string;
  disabled?: boolean;
}

// `string` in single mode, `string[]` in multiple mode.
const model = defineModel<string | string[]>();

interface Props extends FieldProps {
  options: ToggleGroupOption[];
  multiple?: boolean;
  disabled?: boolean;
  orientation?: "horizontal" | "vertical";
}

const props = withDefaults(defineProps<Props>(), {
  orientation: "horizontal",
});

const { labelId, ariaProps } = useField(props);
const type = computed<"single" | "multiple">(() =>
  props.multiple ? "multiple" : "single",
);
</script>

<template>
  <div class="toggle-group-field">
    <FieldLabel
      class="toggle-group-label"
      :label="label"
      :label-id="labelId"
      :hide-label="hideLabel"
      :hint="hint"
    />
    <ToggleGroupRoot
      v-model="model"
      :type="type"
      :disabled="disabled"
      :orientation="orientation"
      :class="['toggle-group', `toggle-group--${orientation}`]"
      v-bind="ariaProps"
    >
      <ToggleGroupItem
        v-for="opt in options"
        :key="opt.value"
        :value="opt.value"
        :disabled="opt.disabled"
        class="toggle-group-item"
      >
        {{ opt.label }}
      </ToggleGroupItem>
    </ToggleGroupRoot>
  </div>
</template>

<style scoped>
.toggle-group-field {
  display: flex;
  flex-direction: column;
  gap: 0.25em;
  align-items: flex-start;
}

.toggle-group-label {
  display: flex;
  align-items: center;
  gap: 0.25em;
  font-size: var(--font-size-sm);
}

.toggle-group {
  display: inline-flex;
  /* 1px gaps reveal the group background as dividers between items. */
  gap: 1px;
  background: var(--color-border);
  border: 1px solid var(--color-border);
  border-radius: 0.375em;
  /* Clip items to the rounded outer corners. Focus uses an inset outline
   * (below) so it isn't clipped away. */
  overflow: hidden;
}

.toggle-group--vertical {
  flex-direction: column;
}

.toggle-group-item {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.5em;
  padding: 0 1em;
  margin: 0;
  border: none;
  background: var(--color-bg-0);
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.toggle-group-item:hover:not([data-disabled]) {
  background: var(--color-bg-2);
}

.toggle-group-item[data-state="on"] {
  background: var(--color-primary);
  color: var(--color-text-on-primary);
}

.toggle-group-item[data-state="on"]:hover:not([data-disabled]) {
  background: var(--color-primary-hover);
}

.toggle-group-item:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
  z-index: 1;
}

.toggle-group-item[data-disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
