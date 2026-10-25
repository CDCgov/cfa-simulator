<script setup lang="ts">
import { computed, ref, watch, type Ref } from "vue";
import type { DateRange } from "reka-ui";
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
  RangeCalendarCell,
  RangeCalendarCellTrigger,
  RangeCalendarGrid,
  RangeCalendarGridBody,
  RangeCalendarGridHead,
  RangeCalendarGridRow,
  RangeCalendarHeadCell,
  RangeCalendarHeader,
  RangeCalendarNext,
  RangeCalendarPrev,
  RangeCalendarRoot,
} from "reka-ui";
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
  compareDates,
  formatDate,
  parseDate,
  type DateParts,
} from "../DatePicker/dateFormat";

/** First day of the range, in `format`; `""` when cleared. */
const start = defineModel<string>("start");
/** Last day of the range (inclusive), in `format`; `""` when cleared. */
const end = defineModel<string>("end");

export interface DateRangePickerProps extends FieldProps {
  /**
   * Format of the model values (and `min`, `max`). Same tokens as
   * DatePicker: `yyyy`, `yy`, `mmmm`, `mmm`, `mm`, `m`, `dd`, `d`.
   */
  format?: string;
  /** Format of the text in the inputs. Defaults to `format`. */
  displayFormat?: string;
  /** Placeholder for both inputs. Defaults to the display format string. */
  placeholder?: string;
  /** Earliest selectable date, in `format`. */
  min?: string;
  /** Latest selectable date, in `format`. */
  max?: string;
  /** BCP 47 locale for the calendar's month and weekday names. */
  locale?: string;
  /** Show a button that clears both dates (emits `""` for each). Not shown when `required`. */
  clearable?: boolean;
  /** Treat an empty start or end as invalid instead of committing `""`. */
  required?: boolean;
  /** Accessible name of the start input. */
  startLabel?: string;
  /** Accessible name of the end input. */
  endLabel?: string;
  /**
   * `"split"` (default) gives both inputs equal widths with a divider line
   * between; `"inline"` sizes each input to its date with a dash between.
   */
  layout?: "inline" | "split";
  /** Text between the two inputs in the `"inline"` layout, like `"to"`. */
  separator?: string;
}

const props = withDefaults(defineProps<DateRangePickerProps>(), {
  format: DEFAULT_DATE_FORMAT,
  startLabel: "Start date",
  endLabel: "End date",
  layout: "split",
  separator: "–",
});

const { id, labelId, ariaProps } = useField(props);

const inputFormat = computed(() => props.displayFormat ?? props.format);
const parse = (s: string | undefined) =>
  s ? parseDate(s, props.format) : null;
const display = (p: DateParts) => formatDate(p, inputFormat.value);
const minParts = computed(() => parse(props.min));
const maxParts = computed(() => parse(props.max));
const startParts = computed(() => parse(start.value));
const endParts = computed(() => parse(end.value));

const { boundsError, formatError } = dateMessages({
  noun: "dates",
  min: minParts,
  max: maxParts,
  inputFormat,
  display,
});

const ORDER_ERROR = "The end date must be on or after the start date";

/** Text, error and commit for one of the two inputs. */
function useSide(model: Ref<string | undefined>, isStart: boolean) {
  const text = ref("");
  const error = ref("");
  const parts = isStart ? startParts : endParts;
  const other = isStart ? endParts : startParts;
  const outOfOrder = (p: DateParts) =>
    !!other.value && compareDates(p, other.value) * (isStart ? 1 : -1) > 0;

  const modelText = () =>
    parts.value ? display(parts.value) : (model.value ?? "");

  /**
   * Show the model value and its error. Model values are shown as-is when
   * they don't parse, and an out-of-order pair is flagged on the end only.
   */
  function showModel() {
    text.value = modelText();
    const p = parts.value;
    error.value = !model.value
      ? ""
      : !p
        ? formatError()
        : boundsError(p) || (!isStart && outOfOrder(p) ? ORDER_ERROR : "");
  }

  function commit() {
    if (text.value.trim() === "") {
      error.value = props.required
        ? `Enter ${isStart ? "a start" : "an end"} date`
        : "";
      if (!props.required && model.value) model.value = "";
      return;
    }
    const p = parseDate(text.value, inputFormat.value);
    error.value = !p
      ? formatError()
      : boundsError(p) || (outOfOrder(p) ? ORDER_ERROR : "");
    if (!p || error.value) return;
    text.value = display(p);
    const value = formatDate(p, props.format);
    if (value !== model.value) model.value = value;
  }

  /**
   * The other end changed: retry typed text that was rejected (it may be
   * in order now), else refresh the error shown for the model value.
   */
  function onOtherChange() {
    if (error.value && text.value !== modelText()) commit();
    else showModel();
  }

  return { text, error, commit, showModel, onOtherChange };
}

const startSide = useSide(start, true);
const endSide = useSide(end, false);

// Each end resyncs only its own input, so typed text in the other survives.
watch(start, () => {
  startSide.showModel();
  endSide.onOtherChange();
});
watch(end, () => {
  endSide.showModel();
  startSide.onOtherChange();
});
watch(
  [() => props.format, inputFormat, minParts, maxParts],
  () => {
    startSide.showModel();
    endSide.showModel();
  },
  { immediate: true },
);

// Width fallback for browsers without `field-sizing: content`.
const inputChars = (text: string) =>
  Math.max(text.length, (props.placeholder ?? inputFormat.value).length);

// The end's message is only shown when it differs from the start's.
const endErrorShown = computed(
  () => !!endSide.error.value && endSide.error.value !== startSide.error.value,
);
const startDescribedBy = computed(() =>
  startSide.error.value ? `${id}-start-error` : undefined,
);
const endDescribedBy = computed(() =>
  !endSide.error.value
    ? undefined
    : endErrorShown.value
      ? `${id}-end-error`
      : `${id}-start-error`,
);

const open = ref(false);
const calendarRange = computed<DateRange>(() => ({
  start: toCalendar(startParts.value),
  end: toCalendar(endParts.value),
}));
const minValue = computed(() => toCalendar(minParts.value));
const maxValue = computed(() => toCalendar(maxParts.value));

const { view, years, showMonth, monthOutOfRange } = useCalendarView({
  min: minParts,
  max: maxParts,
  open,
  start: () => calendarRange.value.start ?? calendarRange.value.end,
});

// reka emits a half range ({ start, end: undefined }) after the first
// click; only a finished range is committed.
function onSelect(range: DateRange | null) {
  if (!range?.start || !range.end) return;
  start.value = formatDate(range.start, props.format);
  end.value = formatDate(range.end, props.format);
  open.value = false;
}

function clear() {
  for (const side of [startSide, endSide]) {
    side.text.value = "";
    side.error.value = "";
  }
  if (start.value) start.value = "";
  if (end.value) end.value = "";
}
</script>

<template>
  <div class="date-range-picker cfasim-date-field" :data-layout="layout">
    <FieldLabel
      class="cfasim-date-label"
      :label="label"
      :label-id="labelId"
      :hide-label="hideLabel"
      :hint="hint"
      :html-for="`${id}-start`"
    />
    <PopoverRoot v-model:open="open">
      <div class="cfasim-date-anchor" role="group" v-bind="ariaProps">
        <input
          :id="`${id}-start`"
          v-model="startSide.text.value"
          type="text"
          class="cfasim-date-input date-range-picker-input"
          :style="{ '--chars': inputChars(startSide.text.value) }"
          autocomplete="off"
          :aria-label="startLabel"
          :placeholder="placeholder ?? inputFormat"
          :aria-invalid="!!startSide.error.value || undefined"
          :aria-required="required || undefined"
          :aria-describedby="startDescribedBy"
          @blur="startSide.commit"
          @keydown.enter="startSide.commit"
        />
        <span
          v-if="layout === 'split'"
          class="date-range-picker-divider"
          aria-hidden="true"
        />
        <span v-else class="date-range-picker-separator" aria-hidden="true">{{
          separator
        }}</span>
        <input
          :id="`${id}-end`"
          v-model="endSide.text.value"
          type="text"
          class="cfasim-date-input date-range-picker-input date-range-picker-end"
          :style="{ '--chars': inputChars(endSide.text.value) }"
          autocomplete="off"
          :aria-label="endLabel"
          :placeholder="placeholder ?? inputFormat"
          :aria-invalid="!!endSide.error.value || undefined"
          :aria-required="required || undefined"
          :aria-describedby="endDescribedBy"
          @blur="endSide.commit"
          @keydown.enter="endSide.commit"
        />
        <button
          v-if="
            clearable &&
            !required &&
            (startSide.text.value || endSide.text.value)
          "
          type="button"
          class="cfasim-date-trigger"
          :aria-label="`Clear ${label ?? ariaLabel ?? 'dates'}`"
          @click="clear"
        >
          <Icon icon="close" :size="16" />
        </button>
        <PopoverTrigger class="cfasim-date-trigger" aria-label="Open calendar">
          <Icon icon="calendar_today" :size="16" />
        </PopoverTrigger>
      </div>
      <!-- prettier-ignore -->
      <p class="cfasim-date-error" aria-live="polite"><span v-if="startSide.error.value" :id="`${id}-start-error`">{{ startSide.error.value }}</span><span v-if="endErrorShown" :id="`${id}-end-error`">{{ endSide.error.value }}</span></p>
      <PopoverPortal>
        <PopoverContent
          class="cfasim-date-picker-content"
          align="end"
          :side-offset="4"
          @open-auto-focus.prevent
        >
          <RangeCalendarRoot
            v-slot="{ weekDays, grid, locale: calendarLocale }"
            v-model:placeholder="view"
            :model-value="calendarRange"
            :min-value="minValue"
            :max-value="maxValue"
            :locale="locale"
            :calendar-label="label ?? ariaLabel"
            prevent-deselect
            initial-focus
            weekday-format="short"
            @update:model-value="onSelect"
          >
            <RangeCalendarHeader class="cfasim-calendar-header">
              <RangeCalendarPrev class="cfasim-calendar-nav">
                <Icon icon="chevron_left" :size="18" />
              </RangeCalendarPrev>
              <CalendarMonthSelects
                :view="view"
                :years="years"
                :locale="calendarLocale"
                :month-out-of-range="monthOutOfRange"
                @show="showMonth"
              />
              <RangeCalendarNext class="cfasim-calendar-nav">
                <Icon icon="chevron_right" :size="18" />
              </RangeCalendarNext>
            </RangeCalendarHeader>
            <RangeCalendarGrid
              v-for="month in grid"
              :key="month.value.toString()"
              class="cfasim-calendar-grid"
            >
              <RangeCalendarGridHead>
                <RangeCalendarGridRow class="cfasim-calendar-row">
                  <RangeCalendarHeadCell
                    v-for="day in weekDays"
                    :key="day"
                    class="cfasim-calendar-head-cell"
                  >
                    {{ day }}
                  </RangeCalendarHeadCell>
                </RangeCalendarGridRow>
              </RangeCalendarGridHead>
              <RangeCalendarGridBody>
                <RangeCalendarGridRow
                  v-for="(week, i) in month.rows"
                  :key="i"
                  class="cfasim-calendar-row"
                >
                  <RangeCalendarCell
                    v-for="date in week"
                    :key="date.toString()"
                    :date="date"
                    class="cfasim-calendar-cell"
                  >
                    <RangeCalendarCellTrigger
                      :day="date"
                      :month="month.value"
                      class="cfasim-calendar-day"
                      data-range-day
                      data-mark-today
                    />
                  </RangeCalendarCell>
                </RangeCalendarGridRow>
              </RangeCalendarGridBody>
            </RangeCalendarGrid>
          </RangeCalendarRoot>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </div>
</template>

<style scoped>
/* Inputs hug their text so the dash sits between the two dates. */
.date-range-picker-input {
  flex: 0 1 auto;
  width: calc(var(--chars) * 1ch + 0.5ch);
}

@supports (field-sizing: content) {
  .date-range-picker-input {
    width: auto;
    min-width: 2ch;
    field-sizing: content;
  }
}

.date-range-picker-end {
  margin-right: auto;
}

.cfasim-date-error > span {
  display: block;
}

.date-range-picker-separator {
  flex-shrink: 0;
  margin: 0 0.25em;
  white-space: nowrap;
  color: var(--color-text-secondary);
}

[data-layout="split"] .date-range-picker-input {
  flex: 1 1 0;
  width: auto;
  min-width: 0;
  field-sizing: fixed;
}

[data-layout="split"] .date-range-picker-end {
  margin-right: 0;
  padding-left: 0.25em;
}

.date-range-picker-divider {
  align-self: stretch;
  width: 1px;
  margin: 0.5em 0.25em;
  background: var(--color-border);
}
</style>
