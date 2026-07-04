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
} from "reka-ui";
import { computed, nextTick, ref, watch } from "vue";
import Icon from "../Icon/Icon.vue";
import FieldLabel from "../_internal/FieldLabel.vue";
import { useField, type FieldProps } from "../_internal/field";
import "../_internal/listbox.css";

export interface MultiSelectOption {
  value: string;
  label: string;
}

const model = defineModel<string[]>({ default: () => [] });

interface Props extends FieldProps {
  options: MultiSelectOption[];
  placeholder?: string;
}

const props = defineProps<Props>();

const { labelId, ariaProps } = useField(props);
const fieldRef = ref<HTMLElement | null>(null);

// In multiple mode the list stays open after a selection, so reka keeps
// `isUserInputted` true and suppresses its own `resetSearchTermOnSelect`. Clear
// the typed text (and the underlying filter) ourselves on every selection
// change by dispatching a native input event the combobox listens for.
watch(model, () => {
  nextTick(() => {
    const input = fieldRef.value?.querySelector("input");
    if (input?.value) {
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
});

const selectedOptions = computed(() =>
  model.value
    .map((v) => props.options.find((o) => o.value === v))
    .filter((o): o is MultiSelectOption => Boolean(o)),
);

function remove(value: string) {
  model.value = model.value.filter((v) => v !== value);
}

// Backspace in an empty input removes the last selected chip.
function onInputKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLInputElement;
  if (event.key === "Backspace" && !target.value && model.value.length) {
    remove(model.value[model.value.length - 1]);
  }
}
</script>

<template>
  <div class="multi-select">
    <FieldLabel
      class="multi-select-label"
      :label="label"
      :label-id="labelId"
      :hide-label="hideLabel"
      :hint="hint"
    />
    <ComboboxRoot
      v-model="model"
      multiple
      open-on-click
      class="multi-select-root"
    >
      <ComboboxAnchor class="multi-select-anchor">
        <div ref="fieldRef" class="multi-select-field">
          <ul v-if="selectedOptions.length" class="multi-select-chips">
            <li
              v-for="opt in selectedOptions"
              :key="opt.value"
              class="multi-select-chip"
            >
              <span class="multi-select-chip-label">{{ opt.label }}</span>
              <button
                type="button"
                class="multi-select-chip-remove"
                :aria-label="`Remove ${opt.label}`"
                @click="remove(opt.value)"
              >
                <Icon icon="close" :size="14" />
              </button>
            </li>
          </ul>
          <ComboboxInput
            class="multi-select-input"
            :placeholder="selectedOptions.length ? undefined : placeholder"
            v-bind="ariaProps"
            @keydown="onInputKeydown"
          />
        </div>
        <ComboboxTrigger
          class="multi-select-trigger"
          aria-label="Toggle options"
        >
          <span class="multi-select-icon" aria-hidden="true">
            <Icon icon="keyboard_arrow_down" :size="16" />
          </span>
        </ComboboxTrigger>
      </ComboboxAnchor>
      <ComboboxPortal>
        <ComboboxContent
          class="cfasim-listbox-content multi-select-content"
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
  </div>
</template>

<style scoped>
.multi-select {
  display: flex;
  flex-direction: column;
  gap: 0.25em;
}

.multi-select-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--font-size-sm);
}

.multi-select-anchor {
  display: flex;
  align-items: center;
  gap: 0.25em;
  min-height: 2.5em;
  padding: 0.25em 0.5em;
  font-size: var(--font-size-sm);
  background: var(--color-bg-0);
  border: 1px solid var(--color-border);
  border-radius: 0.375em;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.multi-select-anchor:hover {
  border-color: var(--color-border-hover);
}

.multi-select-anchor:focus-within {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: var(--shadow-focus);
}

.multi-select-field {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25em;
  flex: 1;
  min-width: 0;
}

.multi-select-chips {
  display: contents;
  list-style: none;
  margin: 0;
  padding: 0;
}

.multi-select-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25em;
  /* Reset list margins (e.g. a consumer's `li + li` spacing) so chips line up. */
  margin: 0;
  padding: 0.125em 0.25em 0.125em 0.5em;
  background: var(--color-bg-2);
  border: 1px solid var(--color-border);
  border-radius: 0.25em;
  line-height: 1.4;
}

.multi-select-chip-remove {
  display: inline-flex;
  align-items: center;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: 0.25em;
}

.multi-select-chip-remove:hover {
  color: var(--color-text);
}

.multi-select-chip-remove:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.multi-select-input {
  flex: 1;
  min-width: 3em;
  height: 1.75em;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-text);
  font: inherit;
}

.multi-select-input:focus {
  outline: none;
}

.multi-select-input::placeholder {
  color: var(--color-text-tertiary);
}

.multi-select-trigger {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
}

.multi-select-icon {
  display: flex;
  align-items: center;
}
</style>

<style>
/* Sizing only — the dropdown skin lives in _internal/listbox.css. */
.multi-select-content {
  width: var(--reka-combobox-trigger-width);
  max-height: var(--reka-combobox-content-available-height);
}
</style>
