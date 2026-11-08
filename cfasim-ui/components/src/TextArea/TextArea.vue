<script setup lang="ts">
import { ref, watch } from "vue";
import { useId } from "reka-ui";
import FieldLabel from "../_internal/FieldLabel.vue";
import type { FieldProps } from "../_internal/field";
import "../_internal/input.css";

const model = defineModel<string>();
const local = ref(model.value);

watch(model, (v) => {
  local.value = v;
});

function commit() {
  model.value = local.value;
}

// Enter inserts a newline, so the keyboard commit is Ctrl/Cmd+Enter.
function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) commit();
}

export interface TextAreaProps extends FieldProps {
  placeholder?: string;
  /** Visible lines; with `autoGrow` the minimum height. */
  rows?: number;
  /** Which edges the user may drag to resize. */
  resize?: "vertical" | "horizontal" | "both" | "none";
  /** Grow with the text (`field-sizing: content`; browsers without it keep `rows`). */
  autoGrow?: boolean;
  maxLength?: number;
  disabled?: boolean;
}

const props = withDefaults(defineProps<TextAreaProps>(), {
  rows: 3,
  resize: "vertical",
});
const id = useId();
</script>

<template>
  <div :class="props.label ? 'cfasim-input-label' : undefined">
    <FieldLabel
      class="cfasim-input-label-row"
      :label="props.label"
      :hide-label="props.hideLabel"
      :hint="props.hint"
      :html-for="id"
    />
    <textarea
      :id="id"
      class="cfasim-input text-area"
      :class="{ 'text-area-auto-grow': props.autoGrow }"
      v-model="local"
      :rows="props.rows"
      :placeholder="props.placeholder"
      :maxlength="props.maxLength"
      :disabled="props.disabled"
      :style="{ resize: props.resize }"
      :aria-label="!props.label ? props.ariaLabel : undefined"
      @blur="commit"
      @keydown="onKeydown"
    />
  </div>
</template>

<style scoped>
.text-area {
  height: auto;
  min-height: 0;
  padding: 0.5em 0.75em;
  line-height: var(--line-height-normal, 1.5);
}

.text-area:disabled {
  color: var(--color-text-disabled);
  cursor: not-allowed;
}

.text-area-auto-grow {
  field-sizing: content;
}
</style>
