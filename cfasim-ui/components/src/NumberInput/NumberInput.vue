<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { SliderRoot, SliderTrack, SliderRange, SliderThumb } from "reka-ui";
import Hint from "../Hint/Hint.vue";

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
  live?: boolean;
  numberType?: "integer" | "float";
}>();

const sliderMin = computed(() => props.min ?? (props.percent ? 0 : 0));
const sliderMax = computed(() => props.max ?? (props.percent ? 1 : 100));
const sliderStep = computed(() => props.step ?? (props.percent ? 0.01 : 1));

function formatSliderValue(v: number | undefined) {
  if (v == null) return "";
  if (props.percent) return (v * 100).toFixed(0) + "%";
  return v.toLocaleString("en-US");
}

function toDisplay(v: number | undefined) {
  if (v == null) return v;
  return props.percent ? Math.round(v * 10000) / 100 : v;
}

function fromDisplay(v: number) {
  return props.percent ? v / 100 : v;
}

function coerceInteger(v: number): number {
  if (props.numberType !== "integer") return v;
  // Truncate the display value to an integer, then convert back
  const display = toDisplay(v);
  if (display == null) return v;
  return fromDisplay(Math.trunc(display));
}

function formatWithCommas(v: number | undefined): string {
  if (v == null) return "";
  return v.toLocaleString("en-US");
}

function formatForDisplay(v: number | undefined): string {
  const s = formatWithCommas(v);
  if (props.numberType === "float" && v != null && Number.isInteger(v)) {
    return s + ".0";
  }
  return s;
}

function stripCommas(s: string): string {
  return s.replace(/,/g, "");
}

const local = ref(formatForDisplay(toDisplay(model.value)));
const sliderLocal = ref(model.value);
const validationError = ref<string>();

watch(model, (v) => {
  local.value = formatForDisplay(toDisplay(v));
  sliderLocal.value = v;
});

function reformatInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const raw = stripCommas(input.value);
  if (raw === "" || raw === "-") return;
  if (raw.endsWith(".") || (raw.includes(".") && raw.endsWith("0"))) return;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) return;

  const formatted = formatWithCommas(parsed);
  if (formatted === input.value) return;

  const cursorPos = input.selectionStart ?? 0;
  const commasBefore = (input.value.slice(0, cursorPos).match(/,/g) || [])
    .length;
  local.value = formatted;

  requestAnimationFrame(() => {
    const rawPos = cursorPos - commasBefore;
    let newPos = 0;
    let rawCount = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (formatted[i] !== ",") rawCount++;
      if (rawCount >= rawPos) {
        newPos = i + 1;
        break;
      }
    }
    if (rawCount < rawPos) newPos = formatted.length;
    input.setSelectionRange(newPos, newPos);
  });
}

function onBlur() {
  commit();
  const parsed = Number(stripCommas(local.value));
  if (!Number.isNaN(parsed)) {
    local.value = formatForDisplay(parsed);
  }
}

let liveTimeout: ReturnType<typeof setTimeout> | null = null;
function onInputEvent() {
  if (!props.live || props.slider) return;
  if (liveTimeout) clearTimeout(liveTimeout);
  liveTimeout = setTimeout(commit, 300);
}
function onChangeEvent() {
  if (!props.live || props.slider) return;
  if (liveTimeout) clearTimeout(liveTimeout);
  commit();
}

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
  let parsed = Number(stripCommas(local.value));
  if (Number.isNaN(parsed)) return;

  if (props.numberType === "integer") {
    parsed = Math.trunc(parsed);
    local.value = formatForDisplay(parsed);
  }

  const error = validate(parsed);
  validationError.value = error;
  if (error) return;

  model.value = fromDisplay(parsed);
  sliderLocal.value = model.value;
}

function onSliderUpdate(v: number[] | undefined) {
  if (!v) return;
  const val = coerceInteger(v[0]);
  sliderLocal.value = val;
  local.value = formatForDisplay(toDisplay(val));
  if (props.live) {
    model.value = val;
  }
}

function onSliderCommit(v: number[] | undefined) {
  if (!v) return;
  model.value = coerceInteger(v[0]);
}

const inputStep = computed(() => {
  if (props.step != null) return props.percent ? props.step * 100 : props.step;
  return 1;
});

function onArrowStep(event: KeyboardEvent, direction: 1 | -1) {
  event.preventDefault();
  const parsed = Number(stripCommas(local.value));
  const current = Number.isNaN(parsed) ? 0 : parsed;
  const step = inputStep.value * (event.shiftKey ? 10 : 1);
  let next = current + step * direction;
  if (props.numberType === "integer") next = Math.trunc(next);
  if (inputMin.value != null) next = Math.max(next, inputMin.value);
  if (inputMax.value != null) next = Math.min(next, inputMax.value);
  local.value = formatForDisplay(next);
  validationError.value = undefined;
  model.value = fromDisplay(next);
  sliderLocal.value = model.value;
}

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
        type="text"
        :inputmode="props.numberType === 'integer' ? 'numeric' : 'decimal'"
        v-model="local"
        :placeholder="props.placeholder"
        :aria-invalid="!!validationError"
        @blur="onBlur"
        @keydown.enter="commit"
        @keydown.up="onArrowStep($event, 1)"
        @keydown.down="onArrowStep($event, -1)"
        @input="
          reformatInput($event);
          onInputEvent();
        "
        @change="onChangeEvent"
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
        type="text"
        :inputmode="props.numberType === 'integer' ? 'numeric' : 'decimal'"
        v-model="local"
        :placeholder="props.placeholder"
        :aria-invalid="!!validationError"
        @blur="onBlur"
        @keydown.enter="commit"
        @keydown.up="onArrowStep($event, 1)"
        @keydown.down="onArrowStep($event, -1)"
        @input="
          reformatInput($event);
          onInputEvent();
        "
        @change="onChangeEvent"
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

.slider-thumb:active,
.slider-thumb:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px
    color-mix(in srgb, var(--color-primary) 25%, transparent);
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-top: -0.5em;
}
</style>
