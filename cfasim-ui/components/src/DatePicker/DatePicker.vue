<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import {
  CalendarDate,
  getLocalTimeZone,
  today,
  type DateValue,
} from "@internationalized/date";
import {
  CalendarCell,
  CalendarCellTrigger,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHead,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarHeader,
  CalendarNext,
  CalendarPrev,
  CalendarRoot,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from "reka-ui";
import Hint from "../Hint/Hint.vue";
import Icon from "../Icon/Icon.vue";
import FieldLabel from "../_internal/FieldLabel.vue";
import { useField, type FieldProps } from "../_internal/field";
import "../_internal/input.css";
import {
  DEFAULT_DATE_FORMAT,
  addDays,
  compareDates,
  daysBetween,
  formatDate,
  parseDate,
  type DateParts,
} from "./dateFormat";

/** A date string in the picker's `format`; `""` when cleared. */
const model = defineModel<string>();

interface Props extends FieldProps {
  /**
   * Format of the model value (and `min`, `max`, `referenceDate`). Tokens
   * (case-insensitive): `yyyy`, `yy`, `mmmm` (January), `mmm` (Jan),
   * `mm`, `m`, `dd`, `d`; other characters are literals.
   */
  format?: string;
  /** Format of the text in the input, with the same tokens. Defaults to `format`. */
  displayFormat?: string;
  /** Defaults to the display format string. */
  placeholder?: string;
  /** Earliest selectable date, in `format`. */
  min?: string;
  /** Latest selectable date, in `format`. */
  max?: string;
  /** BCP 47 locale for the calendar's month and weekday names. */
  locale?: string;
  /** Show a button that clears the value (emits `""`). */
  clearable?: boolean;
  /** Treat an empty field as invalid instead of committing `""`. */
  required?: boolean;
  /**
   * The date of model time 0, in `format`. Adds a field under the calendar
   * that converts a model day to a date.
   */
  referenceDate?: string;
  /** Label for the model day field shown with `referenceDate`. */
  timeLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  format: DEFAULT_DATE_FORMAT,
  timeLabel: "Day",
});

const { id, labelId, ariaProps } = useField(props);

const toCalendar = (p: DateParts | null) =>
  p ? new CalendarDate(p.year, p.month, p.day) : undefined;

const inputFormat = computed(() => props.displayFormat ?? props.format);
const parse = (s: string | undefined) =>
  s ? parseDate(s, props.format) : null;
const display = (p: DateParts) => formatDate(p, inputFormat.value);
const minParts = computed(() => parse(props.min));
const maxParts = computed(() => parse(props.max));
const referenceParts = computed(() => parse(props.referenceDate));

// "" when `p` is within min/max, else a message naming the bounds.
function rangeError(p: DateParts) {
  const min = minParts.value;
  const max = maxParts.value;
  const early = !!min && compareDates(p, min) < 0;
  const late = !!max && compareDates(p, max) > 0;
  if (!early && !late) return "";
  if (min && max)
    return `Choose a date from ${display(min)} to ${display(max)}`;
  return early
    ? `Choose a date on or after ${display(min!)}`
    : `Choose a date on or before ${display(max!)}`;
}

function formatError() {
  const t = new Date();
  const example = referenceParts.value ??
    minParts.value ?? {
      year: t.getFullYear(),
      month: t.getMonth() + 1,
      day: t.getDate(),
    };
  return `Enter a date as ${inputFormat.value}, like ${display(example)}`;
}

const local = ref(model.value ?? "");
const error = ref("");

// An empty value is only flagged after the user commits it (see `commit`).
// A model value that doesn't match `format` is shown as-is and flagged.
watch(
  [model, () => props.format, inputFormat, minParts, maxParts],
  () => {
    const p = parse(model.value);
    local.value = p ? display(p) : (model.value ?? "");
    error.value = !model.value ? "" : p ? rangeError(p) : formatError();
  },
  { immediate: true },
);

function commit() {
  const text = local.value;
  if (text.trim() === "") {
    error.value = props.required ? "Enter a date" : "";
    if (!props.required && model.value) model.value = "";
    return;
  }
  const p = parseDate(text, inputFormat.value);
  error.value = p ? rangeError(p) : formatError();
  if (!p || error.value) return;
  // Normalize lenient input ("2026-1-5") to the display format.
  local.value = display(p);
  const value = formatDate(p, props.format);
  if (value !== model.value) model.value = value;
}

const open = ref(false);
const calendarValue = computed(() => toCalendar(parse(model.value)));

const monthIndex = (year: number, month: number) => year * 12 + month;
function monthOutOfRange(year: number, month: number) {
  const m = monthIndex(year, month);
  const min = minParts.value;
  const max = maxParts.value;
  return (
    (!!min && m < monthIndex(min.year, min.month)) ||
    (!!max && m > monthIndex(max.year, max.month))
  );
}

/** The first day of `year`/`month`, moved into the months min/max allow. */
function clampMonth(year: number, month: number): CalendarDate {
  const min = minParts.value;
  const max = maxParts.value;
  if (min && monthIndex(year, month) < monthIndex(min.year, min.month))
    ({ year, month } = min);
  if (max && monthIndex(year, month) > monthIndex(max.year, max.month))
    ({ year, month } = max);
  return new CalendarDate(year, month, 1);
}

// The month the calendar shows, controlled so the month/year selects can
// move it. Reset on open to the value, the reference date, or today,
// clamped to min/max.
function initialView(): DateValue {
  const start =
    calendarValue.value ??
    toCalendar(referenceParts.value) ??
    today(getLocalTimeZone());
  const clamped = clampMonth(start.year, start.month);
  return clamped.year === start.year && clamped.month === start.month
    ? start
    : clamped;
}
const view = shallowRef<DateValue>(initialView());
// Unbounded year lists are centered on the year shown at open.
const anchorYear = ref(view.value.year);
watch(open, (isOpen) => {
  if (!isOpen) return;
  view.value = initialView();
  anchorYear.value = view.value.year;
});

const YEAR_SPAN = 50;
const years = computed(() => {
  const y = view.value.year;
  const lo = minParts.value?.year ?? Math.min(anchorYear.value - YEAR_SPAN, y);
  const hi = maxParts.value?.year ?? Math.max(anchorYear.value + YEAR_SPAN, y);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
});

function showMonth(year: number, month: number) {
  view.value = clampMonth(year, month);
}

const monthNameCache = new Map<string, string[]>();
function monthNames(locale: string): string[] {
  let names = monthNameCache.get(locale);
  if (!names) {
    const fmt = new Intl.DateTimeFormat(locale, {
      month: "long",
      timeZone: "UTC",
    });
    names = Array.from({ length: 12 }, (_, i) =>
      fmt.format(new Date(Date.UTC(2000, i, 1))),
    );
    monthNameCache.set(locale, names);
  }
  return names;
}

function clear() {
  local.value = "";
  error.value = "";
  if (model.value) model.value = "";
}

const isReference = (d: DateValue) =>
  !!referenceParts.value && compareDates(d, referenceParts.value) === 0;
const modelTime = computed(() => {
  const v = parse(model.value);
  return v && referenceParts.value
    ? daysBetween(referenceParts.value, v)
    : null;
});
const timeText = ref("");
const timeError = ref("");
watch(
  modelTime,
  (t) => {
    timeText.value = t === null ? "" : String(t);
    timeError.value = "";
  },
  { immediate: true },
);

function commitTime(close = false) {
  const text = String(timeText.value ?? "");
  const day = Number(text);
  if (!referenceParts.value || text.trim() === "" || !Number.isInteger(day)) {
    timeError.value = text.trim() ? "Enter a whole number of days" : "";
    return;
  }
  const date = addDays(referenceParts.value, day);
  timeError.value = rangeError(date);
  if (timeError.value) return;
  model.value = formatDate(date, props.format);
  if (close) open.value = false;
}

function onSelect(date: DateValue | undefined) {
  if (!date) return;
  model.value = formatDate(date, props.format);
  open.value = false;
}
</script>

<template>
  <div class="date-picker">
    <FieldLabel
      class="date-picker-label"
      :label="label"
      :label-id="labelId"
      :hide-label="hideLabel"
      :hint="hint"
      :html-for="`${id}-input`"
    />
    <PopoverRoot v-model:open="open">
      <div class="date-picker-anchor">
        <input
          :id="`${id}-input`"
          v-model="local"
          type="text"
          class="date-picker-input"
          autocomplete="off"
          :placeholder="placeholder ?? inputFormat"
          :aria-invalid="!!error || undefined"
          :aria-required="required || undefined"
          :aria-describedby="error ? `${id}-error` : undefined"
          v-bind="ariaProps"
          @blur="commit"
          @keydown.enter="commit"
        />
        <button
          v-if="clearable && local"
          type="button"
          class="date-picker-trigger"
          :aria-label="`Clear ${label ?? ariaLabel ?? 'date'}`"
          @click="clear"
        >
          <Icon icon="close" :size="16" />
        </button>
        <PopoverTrigger class="date-picker-trigger" aria-label="Open calendar">
          <Icon icon="calendar_today" :size="16" />
        </PopoverTrigger>
      </div>
      <!-- prettier-ignore -->
      <p :id="`${id}-error`" class="date-picker-error" aria-live="polite">{{ error }}</p>
      <PopoverPortal>
        <PopoverContent
          class="cfasim-date-picker-content"
          align="end"
          :side-offset="4"
          @open-auto-focus.prevent
        >
          <CalendarRoot
            v-slot="{ weekDays, grid, locale: calendarLocale }"
            v-model:placeholder="view"
            :model-value="calendarValue"
            :min-value="toCalendar(minParts)"
            :max-value="toCalendar(maxParts)"
            :locale="locale"
            :calendar-label="label ?? ariaLabel"
            prevent-deselect
            initial-focus
            weekday-format="short"
            @update:model-value="onSelect"
          >
            <CalendarHeader class="cfasim-calendar-header">
              <CalendarPrev class="cfasim-calendar-nav">
                <Icon icon="chevron_left" :size="18" />
              </CalendarPrev>
              <div class="cfasim-calendar-heading">
                <span class="cfasim-calendar-select-wrap">
                  <select
                    class="cfasim-input cfasim-calendar-select"
                    aria-label="Month"
                    :value="view.month"
                    @change="
                      showMonth(
                        view.year,
                        Number(($event.target as HTMLSelectElement).value),
                      )
                    "
                  >
                    <option
                      v-for="(name, i) in monthNames(calendarLocale)"
                      :key="i"
                      :value="i + 1"
                      :disabled="monthOutOfRange(view.year, i + 1)"
                    >
                      {{ name }}
                    </option>
                  </select>
                  <Icon icon="keyboard_arrow_down" :size="16" />
                </span>
                <span class="cfasim-calendar-select-wrap">
                  <select
                    class="cfasim-input cfasim-calendar-select"
                    aria-label="Year"
                    :value="view.year"
                    @change="
                      showMonth(
                        Number(($event.target as HTMLSelectElement).value),
                        view.month,
                      )
                    "
                  >
                    <option v-for="y in years" :key="y" :value="y">
                      {{ y }}
                    </option>
                  </select>
                  <Icon icon="keyboard_arrow_down" :size="16" />
                </span>
              </div>
              <CalendarNext class="cfasim-calendar-nav">
                <Icon icon="chevron_right" :size="18" />
              </CalendarNext>
            </CalendarHeader>
            <CalendarGrid
              v-for="month in grid"
              :key="month.value.toString()"
              class="cfasim-calendar-grid"
            >
              <CalendarGridHead>
                <CalendarGridRow class="cfasim-calendar-row">
                  <CalendarHeadCell
                    v-for="day in weekDays"
                    :key="day"
                    class="cfasim-calendar-head-cell"
                  >
                    {{ day }}
                  </CalendarHeadCell>
                </CalendarGridRow>
              </CalendarGridHead>
              <CalendarGridBody>
                <CalendarGridRow
                  v-for="(week, i) in month.rows"
                  :key="i"
                  class="cfasim-calendar-row"
                >
                  <CalendarCell
                    v-for="date in week"
                    :key="date.toString()"
                    :date="date"
                    class="cfasim-calendar-cell"
                  >
                    <CalendarCellTrigger
                      :day="date"
                      :month="month.value"
                      class="cfasim-calendar-day"
                      :data-reference="isReference(date) || undefined"
                      :aria-describedby="
                        isReference(date) ? `${id}-reference` : undefined
                      "
                      :data-mark-today="referenceParts ? undefined : ''"
                    />
                  </CalendarCell>
                </CalendarGridRow>
              </CalendarGridBody>
            </CalendarGrid>
          </CalendarRoot>
          <div v-if="referenceParts" class="cfasim-calendar-time">
            <div class="cfasim-calendar-time-row">
              <label :for="`${id}-time`">{{ timeLabel }}</label>
              <Hint :text="`Days from ${display(referenceParts)}`" />
              <input
                :id="`${id}-time`"
                type="number"
                step="1"
                class="cfasim-input"
                v-model="timeText"
                :aria-invalid="!!timeError || undefined"
                :aria-describedby="`${id}-time-ref ${id}-time-error`"
                @change="commitTime()"
                @keydown.enter.prevent="commitTime(true)"
              />
            </div>
            <span :id="`${id}-time-ref`" class="visually-hidden">
              Days from {{ display(referenceParts) }}
            </span>
            <span :id="`${id}-reference`" class="visually-hidden">
              {{ timeLabel }} 0
            </span>
            <span
              :id="`${id}-time-error`"
              class="date-picker-error"
              aria-live="polite"
              >{{ timeError }}</span
            >
          </div>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </div>
</template>

<style scoped>
.date-picker {
  display: flex;
  flex-direction: column;
}

.date-picker-label {
  margin-bottom: 0.25em;
  font-size: var(--font-size-sm);
}

/* Always rendered so the live region exists before a message arrives. */
.date-picker-error {
  margin: 0;
  line-height: 1.4;
  font-size: var(--font-size-xs);
  color: var(--color-error);
}

.date-picker-error:not(:empty) {
  margin-top: 0.25em;
}

.date-picker-anchor {
  display: flex;
  align-items: center;
  gap: 0.5em;
  height: 2.5em;
  padding: 0 0.25em 0 0.75em;
  font-size: var(--font-size-sm);
  background: var(--color-bg-0);
  border: 1px solid var(--color-border);
  border-radius: 0.375em;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.date-picker-anchor:hover {
  border-color: var(--color-border-hover);
}

.date-picker-anchor:focus-within {
  border-color: var(--color-border-focus);
  box-shadow: var(--shadow-focus);
}

.date-picker-anchor:has([aria-invalid="true"]) {
  border-color: var(--color-error);
}

.date-picker-anchor:has([aria-invalid="true"]):focus-within {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-error) 25%, transparent);
}

.date-picker-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-text);
  font: inherit;
}

.date-picker-input:focus {
  outline: none;
}

.date-picker-input::placeholder {
  color: var(--color-text-tertiary);
}

.date-picker-anchor > .date-picker-trigger + .date-picker-trigger {
  margin-left: -0.5em;
}

.date-picker-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0.375em;
  border: none;
  border-radius: 0.25em;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.date-picker-trigger:hover {
  color: var(--color-text);
}

.date-picker-trigger:focus-visible {
  outline: 2px solid var(--color-primary);
}
</style>

<style>
/* The popover is portaled out of the component, so its styles are global. */
.cfasim-date-picker-content {
  z-index: 100;
  padding: 0.5em;
  font-size: var(--font-size-sm);
  color: var(--color-text);
  background: var(--color-bg-0);
  border: 1px solid var(--color-border);
  border-radius: 0.375em;
  box-shadow: var(--shadow-md);
}

.cfasim-calendar-time {
  display: flex;
  flex-direction: column;
  margin-top: 0.5em;
  padding-top: 0.5em;
  border-top: 1px solid var(--color-border);
}

.cfasim-calendar-time-row {
  display: flex;
  align-items: center;
  gap: 0.5em;
}

.cfasim-calendar-time .cfasim-input {
  width: 5em;
  height: 2em;
}

.cfasim-calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.25em;
}

.cfasim-calendar-heading {
  display: flex;
  gap: 0.25em;
}

.cfasim-calendar-select-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.cfasim-date-picker-content .cfasim-calendar-select {
  width: auto;
  height: 2em;
  padding: 0 1.75em 0 0.625em;
  font-weight: 600;
  appearance: none;
  cursor: pointer;
}

.cfasim-calendar-select-wrap > .Icon {
  position: absolute;
  right: 0.375em;
  pointer-events: none;
  color: var(--color-text-secondary);
}

.cfasim-calendar-nav {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2em;
  height: 2em;
  padding: 0;
  border: none;
  border-radius: 0.25em;
  background: none;
  color: inherit;
  cursor: pointer;
}

.cfasim-calendar-nav:hover {
  background: var(--color-bg-1);
}

.cfasim-calendar-nav[data-disabled] {
  opacity: 0.4;
  cursor: default;
}

.cfasim-calendar-grid {
  width: 100%;
  border-collapse: collapse;
}

.cfasim-calendar-head-cell {
  width: 2em;
  padding-bottom: 0.125em;
  font-size: var(--font-size-xs);
  font-weight: 400;
  color: var(--color-text-secondary);
}

.cfasim-calendar-cell {
  padding: 1px;
  text-align: center;
}

.cfasim-calendar-day {
  position: relative;
  display: flex;
  margin: 0 auto;
  align-items: center;
  justify-content: center;
  width: 2em;
  height: 2em;
  border-radius: 0.25em;
  cursor: pointer;
  outline: none;
}

.cfasim-calendar-day:hover {
  background: var(--color-bg-1);
}

.cfasim-calendar-day:focus-visible {
  box-shadow: var(--shadow-focus);
}

/* A dot under the reference day (day 0), or today when there is none. */
.cfasim-calendar-day[data-reference]::after,
.cfasim-calendar-day[data-mark-today][data-today]::after {
  content: "";
  position: absolute;
  bottom: 0.25em;
  left: 50%;
  width: 0.25em;
  height: 0.25em;
  border-radius: 50%;
  background: currentColor;
  transform: translateX(-50%);
}

.cfasim-calendar-day[data-outside-view] {
  color: var(--color-text-secondary);
}

.cfasim-calendar-day[data-selected] {
  background: var(--color-primary);
  color: white;
}

.cfasim-calendar-day[data-disabled],
.cfasim-calendar-day[data-unavailable] {
  color: var(--color-text-tertiary);
  text-decoration: line-through;
  cursor: default;
  background: none;
}
</style>
