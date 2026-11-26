<script setup lang="ts">
import { ToggleGroupItem, ToggleGroupRoot } from "reka-ui";
import type { AcceptableValue } from "reka-ui";
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
  /**
   * Keep a selection once one is made: clicking the pressed item (the last
   * pressed item in multiple mode) leaves it pressed.
   */
  required?: boolean;
  orientation?: "horizontal" | "vertical";
  /** Same palette as `Button`: how the pressed item is painted. */
  variant?: "primary" | "secondary" | "neutral";
  /**
   * Frame the group and divide its items, like a `ButtonGroup`. Without it
   * unpressed items are only their labels.
   */
  borders?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  orientation: "horizontal",
  variant: "primary",
});

const { labelId, ariaProps } = useField(props);
const type = computed<"single" | "multiple">(() =>
  props.multiple ? "multiple" : "single",
);

// reka only stays in sync with a swallowed update when it is controlled, and
// an `undefined` model would make it uncontrolled.
const groupValue = computed(() => model.value ?? (props.multiple ? [] : null));

function onUpdate(value: AcceptableValue | AcceptableValue[]) {
  const cleared = Array.isArray(value) ? value.length === 0 : value == null;
  if (props.required && cleared) return;
  // Option values are strings, so reka only ever hands those back.
  model.value = (value ?? undefined) as string | string[] | undefined;
}
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
      :model-value="groupValue"
      :type="type"
      :disabled="disabled"
      :orientation="orientation"
      :class="['toggle-group', `toggle-group--${orientation}`]"
      :data-variant="variant"
      :data-borders="borders || undefined"
      v-bind="ariaProps"
      @update:model-value="onUpdate"
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
  /* The palette, per variant and for `borders` below; the item rules only
   * read these. */
  --toggle-item-bg: transparent;
  --toggle-item-color: var(--color-text);
  --toggle-hover-bg: color-mix(in srgb, var(--color-text) 6%, transparent);
  --toggle-on-bg: var(--color-primary);
  --toggle-on-hover-bg: var(--color-primary-hover);
  --toggle-on-color: var(--color-text-on-primary);
  display: inline-flex;
  gap: 2px;
  /* Transparent unless `borders`, so both looks are the same size. */
  border: 1px solid transparent;
  border-radius: 0.375em;
}

.toggle-group--vertical {
  flex-direction: column;
}

.toggle-group-item {
  appearance: none;
  position: relative;
  /* Keeps the ring's negative z-index above the item's own background. */
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--input-height, 2.5em);
  padding: 0 1em;
  margin: 0;
  border: none;
  border-radius: inherit;
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
  outline-offset: 1px;
  z-index: 1;
}

/* Disabled never uses opacity: with `borders`, a translucent item would show
 * the divider-colored group background through it. Text fades, and a pressed
 * item mixes its fill toward the unpressed one. */
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

/* Variants mirror Button's. Secondary outlines the pressed item instead of
 * filling it; the outline is the label color, so it fades with the label
 * when disabled. */
.toggle-group[data-variant="secondary"] {
  --toggle-item-color: var(--color-primary);
  --toggle-hover-bg: color-mix(in srgb, var(--color-primary) 10%, transparent);
  --toggle-on-bg: var(--color-bg-0);
  --toggle-on-hover-bg: var(--toggle-on-bg);
  --toggle-on-color: var(--color-primary);
}

.toggle-group[data-variant="secondary"]:not([data-borders])
  > .toggle-group-item[data-state="on"] {
  box-shadow: inset 0 0 0 1px currentColor;
}

/* Neutral: muted labels, and a light grey pressed fill a step past the hover
 * tint under a full-strength label. */
.toggle-group[data-variant="neutral"] {
  --toggle-item-color: var(--color-text-secondary);
  --toggle-on-bg: color-mix(in srgb, var(--color-text) 12%, transparent);
  --toggle-on-hover-bg: var(--toggle-on-bg);
  --toggle-on-color: var(--color-text);
}

/* Borders: a frame, and 1px gaps that reveal the group background as
 * dividers between items. Tints mix into the item background rather than
 * into transparent, or that background would show through them. */
.toggle-group[data-borders] {
  --toggle-item-bg: var(--color-bg-0);
  --toggle-hover-bg: var(--color-bg-2);
  --toggle-on-ring: var(--color-primary-active);
  gap: 1px;
  background: var(--color-border);
  border-color: var(--color-border);
}

/* Only the end items keep the group's corner radii. The group cannot clip
 * them instead, because the pressed ring (below) overlaps its border. */
.toggle-group[data-borders] > .toggle-group-item {
  border-radius: 0;
}

.toggle-group--horizontal[data-borders] > .toggle-group-item:first-child {
  border-start-start-radius: inherit;
  border-end-start-radius: inherit;
}

.toggle-group--horizontal[data-borders] > .toggle-group-item:last-child {
  border-start-end-radius: inherit;
  border-end-end-radius: inherit;
}

.toggle-group--vertical[data-borders] > .toggle-group-item:first-child {
  border-start-start-radius: inherit;
  border-start-end-radius: inherit;
}

.toggle-group--vertical[data-borders] > .toggle-group-item:last-child {
  border-end-start-radius: inherit;
  border-end-end-radius: inherit;
}

.toggle-group[data-borders] > .toggle-group-item:focus-visible {
  outline-offset: -2px;
}

/* A ring around the pressed item, drawn on the group border and the dividers
 * next to it. Secondary needs none: its border and dividers are already the
 * primary color. The ring repeats the item's fill behind the label, because
 * its inner corner is 1px tighter than the item's and would otherwise leave
 * a sliver of the group background between the two. */
.toggle-group[data-borders]:not([data-variant="secondary"])
  .toggle-group-item[data-state="on"]::after {
  content: "";
  position: absolute;
  inset: -1px;
  z-index: -1;
  border: 1px solid var(--toggle-on-ring);
  border-radius: inherit;
  background: inherit;
  pointer-events: none;
}

.toggle-group-item[data-disabled][data-state="on"]::after {
  border-color: color-mix(
    in srgb,
    var(--toggle-on-ring) 40%,
    var(--color-border)
  );
}

.toggle-group[data-borders][data-variant="secondary"] {
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
  background: var(--color-primary);
  border-color: var(--color-primary);
}

/* Neutral with borders: the pressed item is the lighter one. Light mode has
 * grey items with the pressed one on the page background; dark mode has
 * items on the page background with a lighter grey pressed one. */
.toggle-group[data-borders][data-variant="neutral"] {
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
  /* The pressed fill is close to the unpressed one, so the ring marks it:
   * the lightest greys that keep 3:1 against both fills (WCAG 1.4.11). */
  --toggle-on-ring: light-dark(
    color-mix(in srgb, var(--color-text) 54%, var(--color-bg-0)),
    color-mix(in srgb, var(--color-text) 48%, var(--color-bg-0))
  );
}
</style>
