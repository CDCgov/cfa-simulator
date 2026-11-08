<script setup lang="ts">
import { RadioGroupIndicator, RadioGroupItem, RadioGroupRoot } from "reka-ui";
import FieldLabel from "../_internal/FieldLabel.vue";
import { useField, type FieldProps } from "../_internal/field";
import "../_internal/choice.css";

export interface RadioOption {
  value: string;
  label: string;
  /** Secondary text under the label, linked by `aria-describedby`. */
  description?: string;
  disabled?: boolean;
}

const model = defineModel<string>();

export interface RadioGroupProps extends FieldProps {
  options: RadioOption[];
  disabled?: boolean;
  orientation?: "vertical" | "horizontal";
}

const props = withDefaults(defineProps<RadioGroupProps>(), {
  orientation: "vertical",
});

const { id, labelId, ariaProps } = useField(props);
const itemId = (index: number) => `${id}-${index}`;
</script>

<template>
  <div class="radio-group-field">
    <FieldLabel
      class="radio-group-label"
      :label="props.label"
      :label-id="labelId"
      :hide-label="props.hideLabel"
      :hint="props.hint"
    />
    <RadioGroupRoot
      v-model="model"
      :disabled="props.disabled"
      :orientation="props.orientation"
      :class="['radio-group', `radio-group--${props.orientation}`]"
      v-bind="ariaProps"
    >
      <div
        v-for="(option, index) in props.options"
        :key="option.value"
        class="cfasim-choice"
        :data-disabled="props.disabled || option.disabled || undefined"
      >
        <RadioGroupItem
          :id="itemId(index)"
          :value="option.value"
          :disabled="option.disabled"
          :aria-describedby="
            option.description ? `${itemId(index)}-description` : undefined
          "
          class="cfasim-choice-control radio-button"
        >
          <RadioGroupIndicator class="radio-dot" />
        </RadioGroupItem>
        <div class="cfasim-choice-text">
          <label :for="itemId(index)" class="cfasim-choice-label">
            {{ option.label }}
          </label>
          <span
            v-if="option.description"
            :id="`${itemId(index)}-description`"
            class="cfasim-choice-description"
          >
            {{ option.description }}
          </span>
        </div>
      </div>
    </RadioGroupRoot>
  </div>
</template>

<style scoped>
.radio-group-field {
  display: flex;
  flex-direction: column;
  gap: 0.375em;
  font-size: var(--font-size-sm);
}

.radio-group-label {
  display: flex;
  align-items: center;
  gap: 0.25em;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.5em;
}

.radio-group--horizontal {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.5em 1.25em;
}

.radio-button {
  border-radius: 50%;
}

.radio-dot {
  display: block;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--color-primary);
}
</style>
