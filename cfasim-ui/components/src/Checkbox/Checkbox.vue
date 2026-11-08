<script setup lang="ts">
import { CheckboxIndicator, CheckboxRoot, useId } from "reka-ui";
import Hint from "../Hint/Hint.vue";
import "../_internal/choice.css";

const model = defineModel<boolean>();

export interface CheckboxProps {
  label: string;
  /** Secondary text under the label, linked by `aria-describedby`. */
  description?: string;
  hint?: string;
  disabled?: boolean;
  /** Draw a dash instead of the checked state; the next click checks the box. */
  indeterminate?: boolean;
}

const props = defineProps<CheckboxProps>();

const id = useId();
const descriptionId = `${id}-description`;
</script>

<template>
  <div class="cfasim-choice" :data-disabled="props.disabled || undefined">
    <CheckboxRoot
      :id="id"
      :model-value="props.indeterminate ? 'indeterminate' : model"
      :disabled="props.disabled"
      :aria-describedby="props.description ? descriptionId : undefined"
      class="cfasim-choice-control checkbox-box"
      @update:model-value="model = $event === true"
    >
      <CheckboxIndicator class="checkbox-indicator">
        <svg viewBox="0 0 16 16" aria-hidden="true" class="checkbox-mark">
          <path
            :d="props.indeterminate ? 'M3.5 8h9' : 'M3.5 8.5l3 3 6-6.5'"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          />
        </svg>
      </CheckboxIndicator>
    </CheckboxRoot>
    <div class="cfasim-choice-text">
      <div class="checkbox-label-row">
        <label :for="id" class="cfasim-choice-label">{{ props.label }}</label>
        <Hint v-if="props.hint" :text="props.hint" />
      </div>
      <span
        v-if="props.description"
        :id="descriptionId"
        class="cfasim-choice-description"
      >
        {{ props.description }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.checkbox-box {
  border-radius: 0.25em;
  color: var(--color-text-on-primary);
}

.checkbox-box[data-state="checked"],
.checkbox-box[data-state="indeterminate"] {
  background: var(--color-primary);
}

.checkbox-indicator {
  display: flex;
}

.checkbox-mark {
  display: block;
  width: 14px;
  height: 14px;
}

.checkbox-label-row {
  display: flex;
  align-items: center;
  gap: 0.25em;
}
</style>
