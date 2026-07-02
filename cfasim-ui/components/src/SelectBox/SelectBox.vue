<script setup lang="ts">
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
  useId,
} from "reka-ui";
import Icon from "../Icon/Icon.vue";

export interface SelectOption {
  value: string;
  label: string;
}

const model = defineModel<string>();

const props = defineProps<{
  label?: string;
  hideLabel?: boolean;
  ariaLabel?: string;
  options: SelectOption[];
  placeholder?: string;
  /** Turn the field into a filterable single-select autocomplete (combobox). */
  autocomplete?: boolean;
}>();

const id = useId();

// Shows the selected option's label in the combobox input when not filtering.
function displayValue(value: string) {
  return props.options.find((o) => o.value === value)?.label ?? "";
}
</script>

<template>
  <div class="select-box">
    <label
      v-if="label"
      :id="`${id}-label`"
      :for="autocomplete ? `${id}-input` : undefined"
      class="select-label"
      :class="{ 'visually-hidden': hideLabel }"
      >{{ label }}</label
    >

    <ComboboxRoot
      v-if="autocomplete"
      v-model="model"
      open-on-click
      class="select-combobox-root"
    >
      <ComboboxAnchor class="select-anchor">
        <ComboboxInput
          :id="`${id}-input`"
          class="select-input"
          :display-value="displayValue"
          :placeholder="placeholder"
          :aria-labelledby="props.label ? `${id}-label` : undefined"
          :aria-label="!props.label ? props.ariaLabel : undefined"
        />
        <ComboboxTrigger class="select-icon-button" aria-label="Toggle options">
          <span class="select-icon" aria-hidden="true">
            <Icon icon="keyboard_arrow_down" :size="16" />
          </span>
        </ComboboxTrigger>
      </ComboboxAnchor>
      <ComboboxPortal>
        <ComboboxContent
          class="select-content select-content-autocomplete"
          position="popper"
          :side-offset="4"
          :body-lock="false"
        >
          <ComboboxViewport class="select-viewport">
            <ComboboxEmpty class="select-empty">No matches</ComboboxEmpty>
            <ComboboxItem
              v-for="opt in options"
              :key="opt.value"
              :value="opt.value"
              class="select-item"
            >
              <span>{{ opt.label }}</span>
              <ComboboxItemIndicator class="select-indicator">
                <Icon icon="check" :size="14" />
              </ComboboxItemIndicator>
            </ComboboxItem>
          </ComboboxViewport>
        </ComboboxContent>
      </ComboboxPortal>
    </ComboboxRoot>

    <SelectRoot v-else v-model="model">
      <SelectTrigger
        class="select-trigger"
        :aria-labelledby="props.label ? `${id}-label` : undefined"
        :aria-label="!props.label ? props.ariaLabel : undefined"
      >
        <SelectValue :placeholder="placeholder" />
        <span class="select-icon" aria-hidden="true">
          <Icon icon="keyboard_arrow_down" :size="16" />
        </span>
      </SelectTrigger>
      <SelectPortal>
        <SelectContent
          class="select-content"
          position="popper"
          :side-offset="4"
          :body-lock="false"
        >
          <SelectViewport class="select-viewport">
            <SelectItem
              v-for="opt in options"
              :key="opt.value"
              :value="opt.value"
              class="select-item"
            >
              <SelectItemText>{{ opt.label }}</SelectItemText>
              <SelectItemIndicator class="select-indicator">
                <Icon icon="check" :size="14" />
              </SelectItemIndicator>
            </SelectItem>
          </SelectViewport>
        </SelectContent>
      </SelectPortal>
    </SelectRoot>
  </div>
</template>

<style scoped>
.select-box {
  display: flex;
  flex-direction: column;
  gap: 0.25em;
}

.select-label {
  font-size: var(--font-size-sm);
}

.select-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5em;
  font-size: var(--font-size-sm);
  height: 2.5em;
  padding: 0 0.75em;
  border: 1px solid var(--color-border);
  border-radius: 0.375em;
  background: var(--color-bg-0);
  cursor: pointer;
  width: auto;
  font-family: inherit;
  color: inherit;
  line-height: 1.4;
}

.select-trigger:hover {
  border-color: var(--color-border-hover);
}

.select-trigger:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -1px;
}

.select-trigger[data-placeholder] {
  color: var(--color-text-secondary);
}

/* Autocomplete (combobox) field */
.select-anchor {
  display: flex;
  align-items: center;
  gap: 0.5em;
  height: 2.5em;
  padding: 0 0.5em 0 0.75em;
  font-size: var(--font-size-sm);
  background: var(--color-bg-0);
  border: 1px solid var(--color-border);
  border-radius: 0.375em;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.select-anchor:hover {
  border-color: var(--color-border-hover);
}

.select-anchor:focus-within {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: var(--shadow-focus);
}

.select-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
}

.select-input:focus {
  outline: none;
}

.select-input::placeholder {
  color: var(--color-text-secondary);
}

.select-icon-button {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
}

.select-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
</style>

<style>
.select-content {
  z-index: 100;
  background: var(--color-bg-0);
  border: 1px solid var(--color-border);
  border-radius: 0.25em;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -2px rgba(0, 0, 0, 0.1);
  min-width: var(--reka-select-trigger-width);
  max-height: var(--reka-select-content-available-height);
}

/* Combobox exposes the anchor width under its own custom property. */
.select-content-autocomplete {
  width: var(--reka-combobox-trigger-width);
  max-height: var(--reka-combobox-content-available-height);
}

.select-viewport {
  padding: 0.25em;
}

.select-empty {
  padding: 0.5em;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-align: center;
}

.select-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5em;
  padding: 0.25em 0.5em;
  border-radius: 0.25em;
  font-size: var(--font-size-sm);
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  outline: none;
}

.select-item[data-highlighted] {
  background: var(--color-primary);
  color: white;
}

.select-item[data-state="checked"] {
  font-weight: 600;
}

.select-indicator {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
</style>
