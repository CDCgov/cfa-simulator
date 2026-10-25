import { computed, ref, shallowRef, watch, type Ref } from "vue";
import {
  CalendarDate,
  getLocalTimeZone,
  today,
  type DateValue,
} from "@internationalized/date";
import type { DateParts } from "../DatePicker/dateFormat";

export const toCalendar = (p: DateParts | null | undefined) =>
  p ? new CalendarDate(p.year, p.month, p.day) : undefined;

const monthIndex = (year: number, month: number) => year * 12 + month;
const YEAR_SPAN = 50;

/**
 * The month a calendar popover shows, controlled so the month/year selects
 * can move it. Reset on open to `start()` (or today), clamped to min/max.
 */
export function useCalendarView(opts: {
  min: Ref<DateParts | null>;
  max: Ref<DateParts | null>;
  open: Ref<boolean>;
  start: () => DateValue | undefined;
}) {
  const { min, max } = opts;

  function monthOutOfRange(year: number, month: number) {
    const m = monthIndex(year, month);
    return (
      (!!min.value && m < monthIndex(min.value.year, min.value.month)) ||
      (!!max.value && m > monthIndex(max.value.year, max.value.month))
    );
  }

  /** The first day of `year`/`month`, moved into the months min/max allow. */
  function clampMonth(year: number, month: number): CalendarDate {
    const lo = min.value;
    const hi = max.value;
    if (lo && monthIndex(year, month) < monthIndex(lo.year, lo.month))
      ({ year, month } = lo);
    if (hi && monthIndex(year, month) > monthIndex(hi.year, hi.month))
      ({ year, month } = hi);
    return new CalendarDate(year, month, 1);
  }

  function initialView(): DateValue {
    const start = opts.start() ?? today(getLocalTimeZone());
    const clamped = clampMonth(start.year, start.month);
    return clamped.year === start.year && clamped.month === start.month
      ? start
      : clamped;
  }

  // shallowRef: `ref` unwraps CalendarDate's private fields and fails typecheck.
  const view = shallowRef<DateValue>(initialView());
  // Unbounded year lists are centered on the year shown at open.
  const anchorYear = ref(view.value.year);
  watch(opts.open, (isOpen) => {
    if (!isOpen) return;
    view.value = initialView();
    anchorYear.value = view.value.year;
  });

  const years = computed(() => {
    const y = view.value.year;
    const lo = min.value?.year ?? Math.min(anchorYear.value - YEAR_SPAN, y);
    const hi = max.value?.year ?? Math.max(anchorYear.value + YEAR_SPAN, y);
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  });

  function showMonth(year: number, month: number) {
    view.value = clampMonth(year, month);
  }

  return { view, years, showMonth, monthOutOfRange };
}

const monthNameCache = new Map<string, string[]>();
export function monthNames(locale: string): string[] {
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
