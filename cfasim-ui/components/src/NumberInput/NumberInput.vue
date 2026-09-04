<script setup lang="ts">
import { ref, watch, computed, onMounted, getCurrentInstance } from "vue";
import {
  SliderRoot,
  SliderTrack,
  SliderRange,
  SliderThumb,
  useId,
} from "reka-ui";
import { formatNumber, type NumberFormat } from "@cfasim-ui/shared";
import Hint from "../Hint/Hint.vue";
import type { FieldProps } from "../_internal/field";
import "../_internal/input.css";

export type NumberRange = [number, number];

// The default `v-model` is always a scalar number. For range mode, bind
// `v-model:range` (a tuple) and/or the split `v-model:lower`/`v-model:upper`.
// Mode is auto-detected from which v-model bindings the parent provides;
// no explicit toggle prop. Precedence on read: lower/upper > range >
// slider defaults.
const model = defineModel<number>();
const range = defineModel<NumberRange>("range");
const lower = defineModel<number>("lower");
const upper = defineModel<number>("upper");
// Multi-handle mode: an arbitrary-length array of handle positions.
const values = defineModel<number[]>("values");

interface Props extends FieldProps {
  placeholder?: string;
  step?: number;
  min?: number;
  max?: number;
  percent?: boolean;
  slider?: boolean;
  live?: boolean;
  // How the track is filled. "range" (default) fills between the outermost
  // handles (min to the handle in single mode); "segments" paints one band
  // per handle — min to the first, first to the second, and so on, leaving
  // the track past the last handle empty; "none" paints no fill at all.
  bar?: "range" | "segments" | "none";
  // Per-segment colors for `bar="segments"`, cycled if shorter than the
  // segment count. Defaults to a ramp of --color-primary.
  segmentColors?: string[];
  numberType?: "integer" | "float";
  required?: boolean;
  decimals?: number;
  // Custom formatter for the displayed value. Accepts a NumberFormat
  // (preset name, printf string, or function) — see `formatNumber` in
  // `@cfasim-ui/shared`. When set, overrides the default percent/decimal
  // formatting for both the text input value and slider thumb/min/max
  // labels. The model stays a raw number; only the display changes. Note
  // that formats which add suffixes or scale the value (e.g.
  // `"percent:1"`) may not round-trip through the text input — use
  // `percent: true` for value scaling and `format` for display shaping.
  format?: NumberFormat;
  /** @deprecated Use `format` instead. Still honored for slider labels
   * when `format` is unset, but will be removed in a future release. */
  sliderDisplay?: (value: number) => string;
}

const props = defineProps<Props>();

const errorId = `${useId()}-error`;

function isRangeValue(v: unknown): v is NumberRange {
  return Array.isArray(v) && v.length === 2;
}

// Auto-detect range mode from the parent's v-model bindings. We check both
// the listener (which Vue attaches as `onUpdate:<name>` on the vnode) and
// the initial value — that way one-way `:range="x"` bindings also work.
// Determined once at setup; mode doesn't change for the component's life.
const instance = getCurrentInstance();
const vnodeProps = instance?.vnode.props;
const isMulti =
  !!vnodeProps?.["onUpdate:values"] || Array.isArray(values.value);
const hasRangeBinding =
  !!vnodeProps?.["onUpdate:range"] ||
  !!vnodeProps?.["onUpdate:lower"] ||
  !!vnodeProps?.["onUpdate:upper"] ||
  range.value !== undefined ||
  lower.value !== undefined ||
  upper.value !== undefined;
const isRange = !isMulti && hasRangeBinding;

// Range and multi both imply slider — several handles have no sensible
// text-input form.
const isSlider = computed(() => !!props.slider || isRange || isMulti);

// Warn if the parent bound a v-model that will never receive updates in the
// mode it selected — almost always a bug.
onMounted(() => {
  if ((isRange || isMulti) && !!vnodeProps?.["onUpdate:modelValue"]) {
    console.warn(
      `[NumberInput] In ${isMulti ? "multi-handle" : "range"} mode, the default \`v-model\` is unused. Bind \`v-model:${isMulti ? "values" : "range"}\` instead.`,
    );
  }
  if (isMulti && hasRangeBinding) {
    console.warn(
      "[NumberInput] `v-model:values` takes precedence — the range bindings are unused.",
    );
  }
});

const sliderMin = computed(() => props.min ?? 0);
const sliderMax = computed(() => props.max ?? (props.percent ? 1 : 100));
const sliderStep = computed(() => props.step ?? (props.percent ? 0.01 : 1));

// Count fractional digits in a finite number's decimal representation.
// Uses toPrecision + parseFloat to mask float-multiplication artifacts
// (e.g. 0.007 * 100 === 0.7000000000000001 would otherwise return 16).
function countDecimals(n: number): number {
  if (!Number.isFinite(n) || Number.isInteger(n)) return 0;
  const s = parseFloat(Math.abs(n).toPrecision(12)).toString();
  const dot = s.indexOf(".");
  if (dot !== -1) return s.length - dot - 1;
  const eNeg = s.indexOf("e-");
  if (eNeg !== -1) return Number(s.slice(eNeg + 2));
  return 0;
}

const inputStep = computed(() => {
  if (props.step != null) return props.percent ? props.step * 100 : props.step;
  return 1;
});

const inputMin = computed(() => {
  if (props.min != null) return props.percent ? props.min * 100 : props.min;
  return props.percent ? 0 : undefined;
});
const inputMax = computed(() => {
  if (props.max != null) return props.percent ? props.max * 100 : props.max;
  return props.percent ? 100 : undefined;
});

// Display precision: explicit `decimals` wins; otherwise inferred from the
// input step (which is already in display units — see `inputStep`). Integer
// mode always collapses to 0.
const displayDecimals = computed(() => {
  if (props.numberType === "integer") return 0;
  if (props.decimals != null) return Math.max(0, props.decimals);
  return countDecimals(inputStep.value);
});

function roundToDecimals(v: number, d: number): number {
  const factor = Math.pow(10, d);
  return Math.round(v * factor) / factor;
}

function formatSliderValue(v: number | undefined) {
  if (v == null) return "";
  // sliderDisplay (deprecated) is a function — i.e. already a valid
  // NumberFormat — so route it through formatNumber. `format` wins when
  // both are set.
  const fmt = props.format ?? props.sliderDisplay;
  if (fmt !== undefined) return formatNumber(v, fmt);
  const d = displayDecimals.value;
  if (props.percent) return (v * 100).toFixed(d) + "%";
  return v.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

function toDisplay(v: number | undefined) {
  if (v == null) return v;
  if (!props.percent) return v;
  // Round in display units to hide float-multiplication artifacts like
  // 0.1 * 100 === 10.000000000000002. Precision follows displayDecimals.
  return roundToDecimals(v * 100, displayDecimals.value);
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
  if (v == null) return "";
  if (props.format !== undefined) return formatNumber(v, props.format);
  const d = displayDecimals.value;
  if (d > 0) {
    return v.toLocaleString("en-US", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
  }
  const s = formatWithCommas(v);
  if (props.numberType === "float" && Number.isInteger(v)) {
    return s + ".0";
  }
  return s;
}

function stripCommas(s: string): string {
  return s.replace(/,/g, "");
}

// Resolve the current value across all bindings:
// - In multi-handle mode: the `values` array.
// - In range mode: lower/upper take precedence; falls back per-side to
//   `range`; finally to slider min/max. The default `v-model` is
//   unused in this mode.
// - In single mode: just the default `v-model`.
function effectiveValue(): number | number[] | undefined {
  if (isMulti) return values.value;
  if (isRange) {
    const tuple = range.value;
    const lo = lower.value ?? tuple?.[0];
    const hi = upper.value ?? tuple?.[1];
    if (lo !== undefined || hi !== undefined) {
      return [lo ?? sliderMin.value, hi ?? sliderMax.value];
    }
    return undefined;
  }
  return model.value;
}

// Initial single-value display string. The text input isn't rendered in
// range mode, so `local` is only consulted in single mode.
const initialEffective = effectiveValue();
const initialSingle =
  typeof initialEffective === "number" ? initialEffective : undefined;
const local = ref(formatForDisplay(toDisplay(initialSingle)));

// Slider state is always an array, even in single mode (reka-ui's API).
// In multi mode it holds every handle; in range mode [low, high]; in single
// mode [value].
function modelToSliderArray(v: number | number[] | undefined): number[] {
  if (isMulti) {
    // Sorted on the way in: thumb order, `handle N of M` labels and the
    // segment bands all index the same array, and reka-ui hands values back
    // sorted anyway. An empty or unbound array still needs one handle to be
    // draggable.
    if (Array.isArray(v) && v.length > 0) return [...v].sort((a, b) => a - b);
    return [sliderMin.value];
  }
  if (isRange) {
    if (isRangeValue(v)) return [v[0], v[1]];
    return [sliderMin.value, sliderMax.value];
  }
  if (typeof v === "number") return [v];
  return [sliderMin.value];
}
const sliderArrayLocal = ref<number[]>(modelToSliderArray(initialEffective));
const validationError = ref<string>();

// Deep: `values`/`range` are arrays the parent may mutate in place, and a
// ref source alone only fires when the whole array is replaced.
watch(
  [model, range, lower, upper, values],
  () => {
    const v = effectiveValue();
    if (!isRange && !isMulti && !Array.isArray(v)) {
      local.value = formatForDisplay(toDisplay(v));
    }
    sliderArrayLocal.value = modelToSliderArray(v);
    validationError.value = validate(v);
  },
  { deep: true },
);

// Characters that can appear in a valid JS number literal: digits, thousands
// separators (commas), decimal point, sign, and scientific-notation exponent.
// Anything else is stripped when the value is committed.
const INVALID_NUMBER_CHARS = /[^0-9,.\-+eE]/g;

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
  if (local.value.trim() === "") return;
  const parsed = Number(stripCommas(local.value));
  if (!Number.isNaN(parsed)) {
    local.value = formatForDisplay(parsed);
  }
}

let liveTimeout: ReturnType<typeof setTimeout> | null = null;
function onInputEvent() {
  if (!props.live || isSlider.value) return;
  if (liveTimeout) clearTimeout(liveTimeout);
  liveTimeout = setTimeout(commit, 300);
}
function onChangeEvent() {
  if (!props.live || isSlider.value) return;
  if (liveTimeout) clearTimeout(liveTimeout);
  commit();
}

function validateScalar(v: number): string | undefined {
  const display = toDisplay(v) as number;
  if (inputMin.value != null && display < inputMin.value) {
    return `Min ${inputMin.value}${props.percent ? "%" : ""}`;
  }
  if (inputMax.value != null && display > inputMax.value) {
    return `Max ${inputMax.value}${props.percent ? "%" : ""}`;
  }
  return undefined;
}

// Single source of truth for required / min / max errors — used on commit,
// programmatic updates, and arrow-key stepping. With several handles,
// returns the first failing handle's error, suffixed with which one it is.
function validate(v: number | number[] | undefined): string | undefined {
  if (v == null || (Array.isArray(v) && v.length === 0)) {
    return props.required ? "Required" : undefined;
  }
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const error = validateScalar(v[i]);
      if (error) return `${error} (${handleName(i, v.length)})`;
    }
    return undefined;
  }
  return validateScalar(v);
}

function commit() {
  // commit() is only reachable when !isSlider (only text-input events call
  // it). Default `v-model` is scalar-only.
  const current = model.value;
  if (local.value.trim() === "") {
    model.value = undefined;
    sliderArrayLocal.value = modelToSliderArray(undefined);
    validationError.value = validate(undefined);
    return;
  }
  // Strip any characters that can't be part of a valid number literal.
  // People are free to type anything while editing; we clean it up on commit.
  const cleaned = local.value.replace(INVALID_NUMBER_CHARS, "");
  // Require at least one digit. Otherwise Number("") === 0 would silently
  // turn pure garbage ("abc") into 0. Reset to the current model value so
  // invalid input doesn't linger in the field.
  if (!/\d/.test(cleaned)) {
    local.value = formatForDisplay(toDisplay(current));
    validationError.value = validate(current);
    return;
  }
  if (cleaned !== local.value) {
    local.value = cleaned;
  }
  let parsed = Number(stripCommas(cleaned));
  if (Number.isNaN(parsed)) return;

  if (props.numberType === "integer") {
    parsed = Math.trunc(parsed);
    local.value = formatForDisplay(parsed);
  }

  const next = fromDisplay(parsed);
  const error = validate(next);
  validationError.value = error;
  if (error) return;

  model.value = next;
  sliderArrayLocal.value = [next];
}

function commitSliderArray(v: number[], asModel: boolean): void {
  const coerced = v.map(coerceInteger);
  sliderArrayLocal.value = coerced;
  if (!isRange && !isMulti) {
    local.value = formatForDisplay(toDisplay(coerced[0]));
  }
  if (asModel) {
    if (isMulti) {
      values.value = coerced;
    } else if (isRange) {
      // Emit to all range sinks; consumers without a matching v-model just
      // ignore their `update:*` event. The default `v-model` is unused in
      // range mode.
      range.value = [coerced[0], coerced[1]] as NumberRange;
      lower.value = coerced[0];
      upper.value = coerced[1];
    } else {
      model.value = coerced[0];
    }
  }
}

// Names a handle for aria-labels and validation errors: "lower"/"upper" for
// a two-handle range, "handle N of M" for anything wider.
function handleName(i: number, count: number): string {
  if (isRange) return i === 0 ? "lower" : "upper";
  return `handle ${i + 1} of ${count}`;
}

// The field's accessible name. Falls back to `ariaLabel` when the label is
// not rendered, so thumbs never drop to reka-ui's generic "Value 1 of 3".
const fieldName = computed(() => props.label || props.ariaLabel);

function thumbAriaLabel(i: number): string | undefined {
  const name = fieldName.value;
  if (!name) return undefined;
  if (!isRange && !isMulti) return name;
  return `${name} (${handleName(i, sliderArrayLocal.value.length)})`;
}

// aria-valuenow carries the raw number, which is meaningless once `percent`
// or `format` reshapes it (0.5 for "50%", an epoch for "Mar 1"). valuetext
// announces what's actually on screen.
function thumbValueText(v: number): string | undefined {
  const text = formatSliderValue(v);
  return text === String(v) ? undefined : text;
}

// Which handle tripped min/max, so the error can be pinned to that thumb
// rather than the whole slider.
function handleIsInvalid(i: number): true | undefined {
  const v = sliderArrayLocal.value[i];
  return v !== undefined && validateScalar(v) ? true : undefined;
}

// A slider with several thumbs is a group of sliders (WAI-ARIA multi-thumb
// pattern), so it needs its own name.
const isMultiHandle = computed(() => sliderArrayLocal.value.length > 1);

const barMode = computed(() => props.bar ?? "range");

function segmentColor(i: number, count: number): string {
  const custom = props.segmentColors;
  if (custom && custom.length > 0) return custom[i % custom.length];
  if (count <= 1) return "var(--color-primary)";
  // Ramp from full primary down to 45%, mixed toward the track color so the
  // lighter bands stay opaque against whatever sits behind the slider.
  const weight = Math.round(100 - (i * 55) / (count - 1));
  return `color-mix(in srgb, var(--color-primary) ${weight}%, var(--color-bg-3))`;
}

// One band per handle: min → first, first → second, …, leaving the track
// past the last handle empty.
const segments = computed(() => {
  const span = sliderMax.value - sliderMin.value;
  if (!(span > 0)) return [];
  const stops = [sliderMin.value, ...sliderArrayLocal.value];
  const pct = (v: number) =>
    Math.min(100, Math.max(0, ((v - sliderMin.value) / span) * 100));
  return stops.slice(1).map((_, i) => {
    const start = pct(stops[i]);
    return {
      left: start,
      width: Math.max(0, pct(stops[i + 1]) - start),
      color: segmentColor(i, stops.length - 1),
    };
  });
});

function onSliderUpdate(v: number[] | undefined) {
  if (!v) return;
  commitSliderArray(v, !!props.live);
}

function onSliderCommit(v: number[] | undefined) {
  if (!v) return;
  commitSliderArray(v, true);
}

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
  const nextModel = fromDisplay(next);
  model.value = nextModel;
  sliderArrayLocal.value = [nextModel];
}
</script>

<template>
  <component
    :is="props.label ? 'label' : 'div'"
    :class="props.label ? 'cfasim-input-label' : undefined"
  >
    <span
      v-if="props.label"
      class="cfasim-input-label-row"
      :class="{ 'visually-hidden': props.hideLabel }"
    >
      {{ props.label }}
      <Hint v-if="props.hint && !props.hideLabel" :text="props.hint" />
    </span>
    <span v-if="!isSlider" class="input-wrapper">
      <input
        type="text"
        class="cfasim-input"
        :inputmode="props.numberType === 'integer' ? 'numeric' : 'decimal'"
        v-model="local"
        :placeholder="props.placeholder"
        :aria-label="!props.label ? props.ariaLabel : undefined"
        :aria-invalid="!!validationError"
        :aria-describedby="validationError ? errorId : undefined"
        :aria-required="props.required || undefined"
        :required="props.required"
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
    <span v-if="validationError" :id="errorId" class="input-error" role="alert">
      {{ validationError }}
    </span>
    <div v-if="isSlider" class="slider-container">
      <SliderRoot
        class="slider-root"
        :role="isMultiHandle ? 'group' : undefined"
        :aria-label="isMultiHandle ? fieldName : undefined"
        :model-value="sliderArrayLocal"
        :min="sliderMin"
        :max="sliderMax"
        :step="sliderStep"
        @update:model-value="onSliderUpdate"
        @value-commit="onSliderCommit"
      >
        <SliderTrack
          class="slider-track"
          :class="{ 'slider-track-segmented': barMode === 'segments' }"
        >
          <SliderRange v-if="barMode === 'range'" class="slider-range" />
          <span
            v-for="(segment, i) in barMode === 'segments' ? segments : []"
            :key="i"
            class="slider-segment"
            aria-hidden="true"
            :style="{
              left: `${segment.left}%`,
              width: `${segment.width}%`,
              '--segment-color': segment.color,
            }"
          />
        </SliderTrack>
        <SliderThumb
          v-for="(v, i) in sliderArrayLocal"
          :key="i"
          class="slider-thumb"
          :aria-label="thumbAriaLabel(i)"
          :aria-valuetext="thumbValueText(v)"
          :aria-invalid="handleIsInvalid(i)"
          :aria-describedby="validationError ? errorId : undefined"
        >
          <span class="slider-current">
            {{ formatSliderValue(v) }}
          </span>
        </SliderThumb>
      </SliderRoot>
      <div class="slider-labels">
        <span>{{ formatSliderValue(sliderMin) }}</span>
        <span>{{ formatSliderValue(sliderMax) }}</span>
      </div>
    </div>
  </component>
</template>

<style scoped>
.input-wrapper {
  display: flex;
  align-items: center;
  gap: 0.25em;
}

.input-wrapper .cfasim-input {
  flex: 1;
  min-width: 0;
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

/* Clip square-cornered segments to the track's rounded ends. */
.slider-track-segmented {
  overflow: hidden;
}

.slider-segment {
  position: absolute;
  top: 0;
  height: 100%;
  background-color: var(--segment-color, var(--color-primary));
}

/* Windows High Contrast forces every background to the system palette, so
   the shade ramp collapses to one block — keep the divisions as hairlines. */
@media (forced-colors: active) {
  .slider-segment {
    background-color: Highlight;
    border-inline-end: 1px solid CanvasText;
  }

  .slider-range {
    background-color: Highlight;
  }
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
