<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { SliderRoot, SliderTrack, SliderRange, SliderThumb } from "reka-ui";
import Hint from "./Hint.vue";

const model = defineModel<number>();

const props = defineProps<{
  label?: string;
  placeholder?: string;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
  percent?: boolean;
  slider?: boolean;
}>();

const sliderMin = computed(() => props.min ?? (props.percent ? 0 : 0));
const sliderMax = computed(() => props.max ?? (props.percent ? 1 : 100));
const sliderStep = computed(() => props.step ?? (props.percent ? 0.01 : 1));

function formatSliderValue(v: number | undefined) {
  if (v == null) return "";
  if (props.percent) return (v * 100).toFixed(0) + "%";
  return String(v);
}

function toDisplay(v: number | undefined) {
  if (v == null) return v;
  return props.percent ? Math.round(v * 10000) / 100 : v;
}

function fromDisplay(v: number) {
  return props.percent ? v / 100 : v;
}

const local = ref(toDisplay(model.value));
const sliderLocal = ref(model.value);
const validationError = ref<string>();

watch(model, (v) => {
  local.value = toDisplay(v);
  sliderLocal.value = v;
});

function validate(displayValue: number): string | undefined {
  if (inputMin.value != null && displayValue < inputMin.value) {
    return `Min ${inputMin.value}${props.percent ? "%" : ""}`;
  }
  if (inputMax.value != null && displayValue > inputMax.value) {
    return `Max ${inputMax.value}${props.percent ? "%" : ""}`;
  }
  return undefined;
}

function commit() {
  const parsed = Number(local.value);
  if (Number.isNaN(parsed)) return;

  const error = validate(parsed);
  validationError.value = error;
  if (error) return;

  model.value = fromDisplay(parsed);
  sliderLocal.value = model.value;
}

function onSliderUpdate(v: number[]) {
  sliderLocal.value = v[0];
  local.value = toDisplay(v[0]);
}

function onSliderCommit(v: number[]) {
  model.value = v[0];
}

const inputStep = computed(() => props.step ?? (props.percent ? 1 : undefined));
const inputMin = computed(() => {
  if (props.min != null) return props.percent ? props.min * 100 : props.min;
  return props.percent ? 0 : undefined;
});
const inputMax = computed(() => {
  if (props.max != null) return props.percent ? props.max * 100 : props.max;
  return props.percent ? 100 : undefined;
});
</script>

<template>
  <label v-if="props.label" class="input-label">
    <span class="input-label-row">
      {{ props.label }}
      <Hint v-if="props.hint" :text="props.hint" />
    </span>
    <span v-if="!props.slider" class="input-wrapper">
      <input
        type="number"
        v-model.number="local"
        :placeholder="props.placeholder"
        :step="inputStep"
        :min="inputMin"
        :max="inputMax"
        :aria-invalid="!!validationError"
        @blur="commit"
        @keydown.enter="commit"
      />
      <span v-if="props.percent" class="input-suffix">%</span>
    </span>
    <span v-if="validationError" class="input-error" role="alert">
      {{ validationError }}
    </span>
    <div v-if="props.slider" class="slider-container">
      <SliderRoot
        class="slider-root"
        :model-value="sliderLocal != null ? [sliderLocal] : [sliderMin]"
        :min="sliderMin"
        :max="sliderMax"
        :step="sliderStep"
        @update:model-value="onSliderUpdate"
        @value-commit="onSliderCommit"
      >
        <SliderTrack class="slider-track">
          <SliderRange class="slider-range" />
        </SliderTrack>
        <SliderThumb class="slider-thumb" :aria-label="props.label">
          <span class="slider-current">
            {{ formatSliderValue(sliderLocal) }}
          </span>
        </SliderThumb>
      </SliderRoot>
      <div class="slider-labels">
        <span>{{ formatSliderValue(sliderMin) }}</span>
        <span>{{ formatSliderValue(sliderMax) }}</span>
      </div>
    </div>
  </label>
  <div v-else>
    <span v-if="!props.slider" class="input-wrapper">
      <input
        type="number"
        v-model.number="local"
        :placeholder="props.placeholder"
        :step="inputStep"
        :min="inputMin"
        :max="inputMax"
        :aria-invalid="!!validationError"
        @blur="commit"
        @keydown.enter="commit"
      />
      <span v-if="props.percent" class="input-suffix">%</span>
    </span>
    <span v-if="validationError" class="input-error" role="alert">
      {{ validationError }}
    </span>
    <div v-if="props.slider" class="slider-container">
      <SliderRoot
        class="slider-root"
        :model-value="sliderLocal != null ? [sliderLocal] : [sliderMin]"
        :min="sliderMin"
        :max="sliderMax"
        :step="sliderStep"
        @update:model-value="onSliderUpdate"
        @value-commit="onSliderCommit"
      >
        <SliderTrack class="slider-track">
          <SliderRange class="slider-range" />
        </SliderTrack>
        <SliderThumb class="slider-thumb" :aria-label="props.label">
          <span class="slider-current">
            {{ formatSliderValue(sliderLocal) }}
          </span>
        </SliderThumb>
      </SliderRoot>
      <div class="slider-labels">
        <span>{{ formatSliderValue(sliderMin) }}</span>
        <span>{{ formatSliderValue(sliderMax) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.input-label {
  display: flex;
  flex-direction: column;
  gap: 0.25em;
}

.input-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.input-wrapper {
  display: flex;
  align-items: center;
  gap: 0.25em;
}

.input-wrapper input {
  flex: 1;
  min-width: 0;
}

input {
  display: block;
  width: 100%;
  height: 2.5em;
  padding: 0 0.75em;
  font-size: inherit;
  background-color: var(--color-bg-0);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 0.375em;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

input:hover {
  border-color: var(--color-border-hover);
}

input:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: var(--shadow-focus);
}

input[aria-invalid="true"] {
  border-color: var(--color-error);
}

input[aria-invalid="true"]:focus {
  border-color: var(--color-error);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-error) 25%, transparent);
}

input::placeholder {
  color: var(--color-text-tertiary);
}

.input-suffix {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  flex-shrink: 0;
}

.input-error {
  color: var(--color-error);
  font-size: var(--font-size-xs);
}

.slider-container {
  display: flex;
  flex-direction: column;
  gap: 0.25em;
  padding-top: 1.5em;
}

.slider-current {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 1px;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  white-space: nowrap;
  pointer-events: none;
}

.slider-root {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 1.5em;
  touch-action: none;
  user-select: none;
}

.slider-track {
  position: relative;
  flex-grow: 1;
  height: 3px;
  background-color: var(--color-bg-3);
  border-radius: var(--radius-full);
}

.slider-range {
  position: absolute;
  height: 100%;
  background-color: var(--color-primary);
  border-radius: var(--radius-full);
}

.slider-thumb {
  position: relative;
  display: block;
  width: 1em;
  height: 1em;
  background-color: var(--color-primary);
  border-radius: var(--radius-full);
  cursor: pointer;
}

.slider-thumb:hover {
  background-color: var(--color-primary-hover);
}

.slider-thumb:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-top: -0.5em;
}
</style>
