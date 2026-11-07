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
  /** Same palette as `Button`: how the pressed item is painted. */
  variant?: "primary" | "secondary" | "neutral";
}

const props = withDefaults(defineProps<Props>(), {
  orientation: "horizontal",
  variant: "primary",
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
      :data-variant="variant"
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
  /* The palette, per variant below; the item rules only read these. */
  --toggle-item-bg: var(--color-bg-0);
  --toggle-item-color: var(--color-text);
  --toggle-hover-bg: var(--color-bg-2);
  --toggle-on-bg: var(--color-primary);
  --toggle-on-hover-bg: var(--color-primary-hover);
  --toggle-on-color: var(--color-text-on-primary);
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
  min-height: var(--input-height, 2.5em);
  padding: 0 1em;
  margin: 0;
  border: none;
  background: var(--toggle-item-bg);
  color: var(--toggle-item-color);
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
  background: var(--toggle-hover-bg);
}

.toggle-group-item[data-state="on"] {
  background: var(--toggle-on-bg);
  color: var(--toggle-on-color);
}

.toggle-group-item[data-state="on"]:hover:not([data-disabled]) {
  background: var(--toggle-on-hover-bg);
}

.toggle-group-item:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
  z-index: 1;
}

/* Disabled never uses opacity: a translucent item would show the
 * divider-colored group background through it. Text fades, and a pressed item
 * mixes its fill toward the unpressed one. */
.toggle-group-item[data-disabled] {
  color: color-mix(in srgb, var(--toggle-item-color) 40%, transparent);
  cursor: not-allowed;
}

.toggle-group-item[data-disabled][data-state="on"] {
  background: color-mix(
    in srgb,
    var(--toggle-on-bg) 50%,
    var(--toggle-item-bg)
  );
  color: color-mix(in srgb, var(--toggle-on-color) 80%, transparent);
}

/* Variants mirror Button's. Tints mix into the item background rather than
 * into transparent, for the same reason. */
.toggle-group[data-variant="secondary"] {
  --toggle-item-color: var(--color-primary);
  --toggle-hover-bg: color-mix(
    in srgb,
    var(--color-primary) 10%,
    var(--color-bg-0)
  );
  --toggle-on-bg: color-mix(
    in srgb,
    var(--color-primary) 15%,
    var(--color-bg-0)
  );
  --toggle-on-hover-bg: var(--toggle-on-bg);
  --toggle-on-color: var(--color-primary);
  background: var(--color-primary);
  border-color: var(--color-primary);
}

/* Neutral: the pressed item is the lighter one. Light mode has grey items
 * with the pressed one on the page background; dark mode has items on the
 * page background with a lighter grey pressed one. */
.toggle-group[data-variant="neutral"] {
  --toggle-item-bg: light-dark(
    color-mix(in srgb, var(--color-text) 6%, var(--color-bg-0)),
    var(--color-bg-0)
  );
  --toggle-hover-bg: light-dark(
    color-mix(in srgb, var(--color-text) 10%, var(--color-bg-0)),
    color-mix(in srgb, var(--color-text) 6%, var(--color-bg-0))
  );
  --toggle-on-bg: light-dark(
    var(--color-bg-0),
    color-mix(in srgb, var(--color-text) 12%, var(--color-bg-0))
  );
  --toggle-on-hover-bg: var(--toggle-on-bg);
  --toggle-on-color: var(--color-text);
}
</style>
