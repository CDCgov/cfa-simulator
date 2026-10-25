<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { DateValue } from "@internationalized/date";
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
import CalendarMonthSelects from "../_internal/CalendarMonthSelects.vue";
import FieldLabel from "../_internal/FieldLabel.vue";
import { toCalendar, useCalendarView } from "../_internal/calendar";
import { dateMessages } from "../_internal/dateMessages";
import { useField, type FieldProps } from "../_internal/field";
import "../_internal/input.css";
import "../_internal/datefield.css";
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
  /** Show a button that clears the value (emits `""`). Not shown when `required`. */
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

const inputFormat = computed(() => props.displayFormat ?? props.format);
const parse = (s: string | undefined) =>
  s ? parseDate(s, props.format) : null;
const display = (p: DateParts) => formatDate(p, inputFormat.value);
const minParts = computed(() => parse(props.min));
const maxParts = computed(() => parse(props.max));
const referenceParts = computed(() => parse(props.referenceDate));

const { boundsError: rangeError, formatError } = dateMessages({
  noun: "a date",
  min: minParts,
  max: maxParts,
  inputFormat,
  display,
  example: () => referenceParts.value,
});
const minValue = computed(() => toCalendar(minParts.value));
const maxValue = computed(() => toCalendar(maxParts.value));

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

// Opens on the value, the reference date, or today.
const { view, years, showMonth, monthOutOfRange } = useCalendarView({
  min: minParts,
  max: maxParts,
  open,
  start: () => calendarValue.value ?? toCalendar(referenceParts.value),
});

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
  <div class="date-picker cfasim-date-field">
    <FieldLabel
      class="cfasim-date-label"
      :label="label"
      :label-id="labelId"
      :hide-label="hideLabel"
      :hint="hint"
      :html-for="`${id}-input`"
    />
    <PopoverRoot v-model:open="open">
      <div class="cfasim-date-anchor">
        <input
          :id="`${id}-input`"
          v-model="local"
          type="text"
          class="cfasim-date-input"
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
          v-if="clearable && !required && local"
          type="button"
          class="cfasim-date-trigger"
          :aria-label="`Clear ${label ?? ariaLabel ?? 'date'}`"
          @click="clear"
        >
          <Icon icon="close" :size="16" />
        </button>
        <PopoverTrigger class="cfasim-date-trigger" aria-label="Open calendar">
          <Icon icon="calendar_today" :size="16" />
        </PopoverTrigger>
      </div>
      <!-- prettier-ignore -->
      <p :id="`${id}-error`" class="cfasim-date-error" aria-live="polite">{{ error }}</p>
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
            :min-value="minValue"
            :max-value="maxValue"
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
              <CalendarMonthSelects
                :view="view"
                :years="years"
                :locale="calendarLocale"
                :month-out-of-range="monthOutOfRange"
                @show="showMonth"
              />
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
              class="cfasim-date-error"
              aria-live="polite"
              >{{ timeError }}</span
            >
          </div>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </div>
</template>
