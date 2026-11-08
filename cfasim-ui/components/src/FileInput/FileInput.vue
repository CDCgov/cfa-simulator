<script setup lang="ts">
/// <reference path="../svg.d.ts" />
import { computed, ref, useTemplateRef } from "vue";
import close from "@material-symbols/svg-400/outlined/close.svg?component";
import Button from "../Button/Button.vue";
import FieldLabel from "../_internal/FieldLabel.vue";
import { useField, type FieldProps } from "../_internal/field";
import { acceptsFile } from "./accept";
import "../_internal/input.css";
import "../_internal/option.css";

type ButtonInstance = InstanceType<typeof Button>;

// `File | null` by default, `File[]` with `multiple`.
const model = defineModel<File | File[] | null>();

export interface FileInputProps extends FieldProps {
  /** Same syntax as the native `accept` attribute (`.csv,text/csv`). Dropped files are filtered by it too. */
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Text on the button; defaults to "Choose file" / "Choose files". */
  buttonLabel?: string;
  /** Text shown while nothing is selected. */
  placeholder?: string;
  /** Accept files dragged onto the field (default `true`). */
  dropzone?: boolean;
}

const props = withDefaults(defineProps<FileInputProps>(), {
  dropzone: true,
});

const emit = defineEmits<{
  /** Dropped files that `accept` rejected. */
  (e: "rejected", files: File[]): void;
}>();

const { id, labelId, ariaProps } = useField(props);
const errorId = `${id}-error`;
// The button is named by the field label and its own text ("Case data,
// Choose file"); a <label for> would replace the text with the label alone.
const buttonAria = computed(() => ({
  ...ariaProps.value,
  "aria-labelledby": props.label ? `${labelId} ${id}` : undefined,
}));
const input = useTemplateRef<HTMLInputElement>("input");
const button = useTemplateRef<ButtonInstance>("button");
const dragging = ref(false);
const error = ref("");

const files = computed<File[]>(() => {
  const value = model.value;
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
});

const summary = computed(() => {
  if (files.value.length === 0) {
    return props.placeholder ?? "No file chosen";
  }
  if (files.value.length <= 2) return files.value.map((f) => f.name).join(", ");
  return `${files.value.length} files`;
});

const buttonText = computed(
  () => props.buttonLabel ?? (props.multiple ? "Choose files" : "Choose file"),
);

function setFiles(list: File[]) {
  if (props.multiple) {
    model.value = list;
  } else {
    model.value = list[0] ?? null;
  }
}

function open() {
  input.value?.click();
}

function onChange(event: Event) {
  const target = event.target as HTMLInputElement;
  error.value = "";
  setFiles(Array.from(target.files ?? []));
  // Picking the same file again must fire `change` again.
  target.value = "";
}

function clear() {
  error.value = "";
  setFiles([]);
  button.value?.$el.focus();
}

function onDragOver(event: DragEvent) {
  if (!props.dropzone || props.disabled) return;
  event.preventDefault();
  dragging.value = true;
}

// `dragleave` also fires when the pointer moves onto a child of the field.
function onDragLeave(event: DragEvent) {
  const field = event.currentTarget as HTMLElement;
  if (!field.contains(event.relatedTarget as Node | null))
    dragging.value = false;
}

function onDrop(event: DragEvent) {
  if (!props.dropzone || props.disabled) return;
  event.preventDefault();
  dragging.value = false;
  const accepted: File[] = [];
  const rejected: File[] = [];
  for (const file of Array.from(event.dataTransfer?.files ?? [])) {
    (acceptsFile(file, props.accept) ? accepted : rejected).push(file);
  }
  if (rejected.length) {
    emit("rejected", rejected);
    error.value =
      rejected.length === 1
        ? `${rejected[0].name} is not an accepted file type`
        : `${rejected.length} files are not an accepted file type`;
  } else {
    error.value = "";
  }
  if (accepted.length === 0) return;
  setFiles(props.multiple ? accepted : accepted.slice(0, 1));
}
</script>

<template>
  <div class="file-input-field">
    <FieldLabel
      class="file-input-label"
      :label="props.label"
      :label-id="labelId"
      :hide-label="props.hideLabel"
      :hint="props.hint"
    />
    <div
      class="file-input cfasim-input-box"
      :data-dragging="dragging || undefined"
      :data-disabled="props.disabled || undefined"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <Button
        :id="id"
        ref="button"
        type="button"
        variant="secondary"
        class="file-input-button"
        :disabled="props.disabled"
        :aria-describedby="error ? errorId : undefined"
        v-bind="buttonAria"
        @click="open"
      >
        {{ buttonText }}
      </Button>
      <span
        class="file-input-summary"
        :class="{ 'file-input-placeholder': files.length === 0 }"
        :title="files.map((f) => f.name).join('\n') || undefined"
      >
        {{ summary }}
      </span>
      <button
        v-if="files.length && !props.disabled"
        type="button"
        class="cfasim-icon-button file-input-clear"
        aria-label="Clear selected files"
        @click="clear"
      >
        <close class="file-input-clear-icon" />
      </button>
      <input
        ref="input"
        type="file"
        class="visually-hidden"
        tabindex="-1"
        aria-hidden="true"
        :accept="props.accept"
        :multiple="props.multiple"
        :disabled="props.disabled"
        @change="onChange"
      />
    </div>
    <span v-if="error" :id="errorId" class="file-input-error" role="alert">
      {{ error }}
    </span>
  </div>
</template>

<style scoped>
.file-input-field {
  display: flex;
  flex-direction: column;
  gap: 0.25em;
  font-size: var(--font-size-sm);
}

.file-input-label {
  display: flex;
  align-items: center;
  gap: 0.25em;
}

.file-input {
  --button-height: calc(var(--input-height, 2.5em) - 0.5em - 2px);
  --button-padding-x: 0.75em;
  position: relative;
  min-height: var(--input-height, 2.5em);
  padding: 0.25em;
  padding-right: 0.5em;
}

.file-input[data-dragging] {
  border-color: var(--color-border-focus);
  border-style: dashed;
  background-color: color-mix(
    in srgb,
    var(--color-primary) 6%,
    var(--color-bg-0)
  );
}

.file-input[data-disabled] {
  background-color: var(--color-bg-1);
}

.file-input-summary {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text);
}

.file-input-placeholder {
  color: var(--color-text-tertiary);
}

.file-input-clear-icon {
  display: block;
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.file-input-error {
  font-size: var(--font-size-xs);
  color: var(--color-error);
}
</style>
