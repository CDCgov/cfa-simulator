import type { Ref } from "vue";
import { compareDates, type DateParts } from "../DatePicker/dateFormat";

/**
 * Validation messages shared by DatePicker and DateRangePicker. `noun` is
 * what the field holds ("a date", "dates").
 */
export function dateMessages(opts: {
  noun: string;
  min: Ref<DateParts | null>;
  max: Ref<DateParts | null>;
  inputFormat: Ref<string>;
  display: (p: DateParts) => string;
  /** Date used in the format hint; falls back to `min`, then today. */
  example?: () => DateParts | null;
}) {
  const { noun, min, max, display } = opts;

  /** "" when `p` is within min/max, else a message naming the bounds. */
  function boundsError(p: DateParts) {
    const lo = min.value;
    const hi = max.value;
    const early = !!lo && compareDates(p, lo) < 0;
    const late = !!hi && compareDates(p, hi) > 0;
    if (!early && !late) return "";
    if (lo && hi) return `Choose ${noun} from ${display(lo)} to ${display(hi)}`;
    return early
      ? `Choose ${noun} on or after ${display(lo!)}`
      : `Choose ${noun} on or before ${display(hi!)}`;
  }

  function formatError() {
    const t = new Date();
    const example = opts.example?.() ??
      min.value ?? {
        year: t.getFullYear(),
        month: t.getMonth() + 1,
        day: t.getDate(),
      };
    return `Enter ${noun} as ${opts.inputFormat.value}, like ${display(example)}`;
  }

  return { boundsError, formatError };
}
