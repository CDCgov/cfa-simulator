<script setup lang="ts">
import {
  ComboboxAnchor,
  ComboboxCancel,
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
} from "reka-ui";
import { ref } from "vue";
import Icon from "../Icon/Icon.vue";
import FieldLabel from "../_internal/FieldLabel.vue";
import { useField, type FieldProps } from "../_internal/field";
import "../_internal/listbox.css";

export interface SelectOption {
  value: string;
  label: string;
}

const model = defineModel<string>();

interface Props extends FieldProps {
  options: SelectOption[];
  placeholder?: string;
  /** Turn the field into a filterable single-select autocomplete (combobox). */
  autocomplete?: boolean;
  /**
   * A value is required. In autocomplete mode there is no clear button, and
   * deleting the text restores the selected label on close.
   */
  required?: boolean;
}

const props = defineProps<Props>();

const { id, labelId, ariaProps } = useField(props);

// Shows the selected option's label in the combobox input when not filtering.
function displayValue(value: string) {
  return props.options.find((o) => o.value === value)?.label ?? "";
}

// Text typed since the list opened. Not a v-model on ComboboxInput: reka
// re-emits its stale prop a tick after setting the label, which blanks it.
const searchTerm = ref("");

// reka refills the input with the selected label on close, so deleting the
// text would never clear the value. Clear it as soon as the input is emptied.
function onInput(event: Event) {
  searchTerm.value = (event.target as HTMLInputElement).value;
  if (searchTerm.value === "" && model.value && !props.required) {
    model.value = "";
  }
}

function onOpenChange(open: boolean) {
  if (!open) searchTerm.value = "";
}

// ComboboxCancel empties the DOM input and refocuses it; the value and our
// copy of the search term are ours to reset.
function clear() {
  model.value = "";
  searchTerm.value = "";
}
</script>

<template>
  <div class="select-box">
    <FieldLabel
      class="select-label"
      :label="label"
      :label-id="labelId"
      :hide-label="hideLabel"
      :hint="hint"
      :html-for="autocomplete ? `${id}-input` : undefined"
    />

    <ComboboxRoot
      v-if="autocomplete"
      v-model="model"
      open-on-click
      class="select-combobox-root"
      @update:open="onOpenChange"
    >
      <ComboboxAnchor class="select-anchor">
        <ComboboxInput
          :id="`${id}-input`"
          class="select-input"
          :display-value="displayValue"
          :placeholder="placeholder"
          :aria-required="required || undefined"
          v-bind="ariaProps"
          @input="onInput"
        />
        <ComboboxCancel
          v-if="!required && (model || searchTerm)"
          class="select-clear"
          aria-label="Clear"
          @click="clear"
        >
          <span class="select-icon" aria-hidden="true">
            <Icon icon="close" :size="16" />
          </span>
        </ComboboxCancel>
        <ComboboxTrigger class="select-icon-button" aria-label="Toggle options">
          <span class="select-icon" aria-hidden="true">
            <Icon icon="keyboard_arrow_down" :size="16" />
          </span>
        </ComboboxTrigger>
      </ComboboxAnchor>
      <ComboboxPortal>
        <ComboboxContent
          class="cfasim-listbox-content cfasim-listbox-content-combobox"
          position="popper"
          :side-offset="4"
          :body-lock="false"
        >
          <ComboboxViewport class="cfasim-listbox-viewport">
            <ComboboxEmpty class="cfasim-listbox-empty">
              No matches
            </ComboboxEmpty>
            <ComboboxItem
              v-for="opt in options"
              :key="opt.value"
              :value="opt.value"
              class="cfasim-listbox-item"
            >
              <span>{{ opt.label }}</span>
              <ComboboxItemIndicator class="cfasim-listbox-indicator">
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
        :aria-required="required || undefined"
        v-bind="ariaProps"
      >
        <SelectValue :placeholder="placeholder" />
        <span class="select-icon" aria-hidden="true">
          <Icon icon="keyboard_arrow_down" :size="16" />
        </span>
      </SelectTrigger>
      <SelectPortal>
        <SelectContent
          class="cfasim-listbox-content select-content"
          position="popper"
          :side-offset="4"
          :body-lock="false"
        >
          <SelectViewport class="cfasim-listbox-viewport">
            <SelectItem
              v-for="opt in options"
              :key="opt.value"
              :value="opt.value"
              class="cfasim-listbox-item"
            >
              <SelectItemText>{{ opt.label }}</SelectItemText>
              <SelectItemIndicator class="cfasim-listbox-indicator">
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

.select-icon-button,
.select-clear {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
}

.select-clear {
  color: var(--color-text-secondary);
}

.select-clear:hover {
  color: inherit;
}

.select-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
</style>

<style>
/* Sizing only — the dropdown skin (and Combobox sizing) lives in
 * _internal/listbox.css. */
.select-content {
  min-width: var(--reka-select-trigger-width);
  max-height: var(--reka-select-content-available-height);
}
</style>
