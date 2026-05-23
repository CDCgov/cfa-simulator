/**
 * Date axis support: parsing, auto-detection, tick selection, and
 * formatting for chart x-axes that carry temporal data. All functions
 * are pure (no Vue reactivity, no DOM); chart components call into this
 * module from their computed setup.
 *
 * Design notes:
 * - Parsing is regex-based, not `Date.parse`. The ES spec parses bare
 *   `YYYY-MM-DD` as UTC but offset-less `YYYY-MM-DDTHH:mm:ss` as local,
 *   which makes a `timezone` prop incoherent. Manual parsing keeps the
 *   timezone interpretation consistent.
 * - `isDateLike` deliberately rejects plain numbers so existing numeric
 *   demos (generation indices, day counters) aren't misclassified.
 * - Tick stepping for month/year (and day/week in local mode) goes
 *   through `Date` field math so DST and month-length irregularities
 *   don't drift the tick boundaries.
 */

export type DateTickUnit =
  | "year"
  | "month"
  | "week"
  | "day"
  | "hour"
  | "minute"
  | "second";

export type DateTimezone = "utc" | "local";

export type DateFormatPreset =
  | "iso"
  | "iso-datetime"
  | "year"
  | "month-year"
  | "month-day"
  | "day"
  | "time"
  | "datetime"
  | "medium";

/**
 * How to render a tick label on a date axis. Accepts:
 * - A preset name (`"iso"`, `"month-year"`, ...).
 * - An `Intl.DateTimeFormatOptions` literal for full control.
 * - A function receiving the tick's epoch-ms and the tick unit the
 *   chart picked. Useful for unit-aware custom formatting.
 */
export type DateFormat =
  | DateFormatPreset
  | Intl.DateTimeFormatOptions
  | ((ms: number, unit?: DateTickUnit) => string);

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?$/;

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MS_PER_WEEK = 7 * MS_PER_DAY;
const MS_PER_MONTH_APPROX = 30 * MS_PER_DAY;
const MS_PER_YEAR_APPROX = 365 * MS_PER_DAY;

/**
 * Candidate tick intervals sorted by ascending duration. `pickInterval`
 * walks this list in order and returns the smallest entry whose `ms`
 * is at least the rough per-tick duration the caller is targeting,
 * giving at most ~`targetCount` ticks. Year step set is locked to
 * `{1,2,5,10,25,50,100}` (no "3-year" step).
 */
interface TickInterval {
  unit: DateTickUnit;
  step: number;
  ms: number;
}
const TICK_INTERVALS: readonly TickInterval[] = [
  { unit: "second", step: 1, ms: 1 * MS_PER_SECOND },
  { unit: "second", step: 5, ms: 5 * MS_PER_SECOND },
  { unit: "second", step: 15, ms: 15 * MS_PER_SECOND },
  { unit: "second", step: 30, ms: 30 * MS_PER_SECOND },
  { unit: "minute", step: 1, ms: 1 * MS_PER_MINUTE },
  { unit: "minute", step: 5, ms: 5 * MS_PER_MINUTE },
  { unit: "minute", step: 15, ms: 15 * MS_PER_MINUTE },
  { unit: "minute", step: 30, ms: 30 * MS_PER_MINUTE },
  { unit: "hour", step: 1, ms: 1 * MS_PER_HOUR },
  { unit: "hour", step: 3, ms: 3 * MS_PER_HOUR },
  { unit: "hour", step: 6, ms: 6 * MS_PER_HOUR },
  { unit: "hour", step: 12, ms: 12 * MS_PER_HOUR },
  { unit: "day", step: 1, ms: 1 * MS_PER_DAY },
  { unit: "day", step: 2, ms: 2 * MS_PER_DAY },
  { unit: "week", step: 1, ms: 1 * MS_PER_WEEK },
  { unit: "month", step: 1, ms: 1 * MS_PER_MONTH_APPROX },
  { unit: "month", step: 3, ms: 3 * MS_PER_MONTH_APPROX },
  { unit: "month", step: 6, ms: 6 * MS_PER_MONTH_APPROX },
  { unit: "year", step: 1, ms: 1 * MS_PER_YEAR_APPROX },
  { unit: "year", step: 2, ms: 2 * MS_PER_YEAR_APPROX },
  { unit: "year", step: 5, ms: 5 * MS_PER_YEAR_APPROX },
  { unit: "year", step: 10, ms: 10 * MS_PER_YEAR_APPROX },
  { unit: "year", step: 25, ms: 25 * MS_PER_YEAR_APPROX },
  { unit: "year", step: 50, ms: 50 * MS_PER_YEAR_APPROX },
  { unit: "year", step: 100, ms: 100 * MS_PER_YEAR_APPROX },
];

const MAX_TICK_ITER = 1000;

/**
 * Parse `v` into an epoch-ms timestamp under the given timezone.
 * Accepts `Date` instances and ISO-shaped strings; returns `null` for
 * anything else (including plain `number`s — see `isDateLike`).
 */
export function parseDate(v: unknown, tz: DateTimezone): number | null {
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof v !== "string") return null;

  const dm = ISO_DATE_RE.exec(v);
  if (dm) {
    const y = +dm[1];
    const mo = +dm[2] - 1;
    const d = +dm[3];
    if (tz === "utc") return Date.UTC(y, mo, d);
    return new Date(y, mo, d).getTime();
  }

  const tm = ISO_DATETIME_RE.exec(v);
  if (tm) {
    const y = +tm[1];
    const mo = +tm[2] - 1;
    const d = +tm[3];
    const h = +tm[4];
    const mi = +tm[5];
    const se = tm[6] ? +tm[6] : 0;
    // Regex caps the fractional-second group at 3 digits, so this is
    // always 0..999.
    const ms = tm[7] ? Number("0." + tm[7]) * 1000 : 0;
    const offset = tm[8];
    if (offset) {
      // Explicit offset overrides the prop's tz interpretation.
      if (offset === "Z" || offset === "z") {
        return Date.UTC(y, mo, d, h, mi, se, ms);
      }
      const sign = offset[0] === "+" ? 1 : -1;
      const offHour = +offset.slice(1, 3);
      const offMin = +offset.slice(-2);
      const offsetMs = sign * (offHour * 60 + offMin) * MS_PER_MINUTE;
      return Date.UTC(y, mo, d, h, mi, se, ms) - offsetMs;
    }
    if (tz === "utc") return Date.UTC(y, mo, d, h, mi, se, ms);
    return new Date(y, mo, d, h, mi, se, ms).getTime();
  }

  return null;
}

/**
 * Whether `v` looks like a date value to the auto-detector. Strict:
 * `Date` instances or ISO-shaped strings only. Plain numbers are *not*
 * considered date-like so numeric demos can't be silently promoted to
 * a date axis.
 */
export function isDateLike(v: unknown): boolean {
  if (v instanceof Date) return Number.isFinite(v.getTime());
  if (typeof v !== "string") return false;
  return ISO_DATE_RE.test(v) || ISO_DATETIME_RE.test(v);
}

/**
 * Whether every entry of `values` is date-like and parses cleanly. An
 * empty array is *not* considered all-dates (auto-detection should
 * stay opt-in by content).
 */
export function isAllDates(
  values: ArrayLike<unknown>,
  tz: DateTimezone,
): boolean {
  if (values.length === 0) return false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!isDateLike(v)) return false;
    if (parseDate(v, tz) === null) return false;
  }
  return true;
}

/**
 * Pick the smallest tick interval whose duration is at least the rough
 * per-tick budget (`span / targetCount`). Guarantees at most
 * ~`targetCount` ticks.
 */
function chooseInterval(spanMs: number, targetCount: number): TickInterval {
  const rough = spanMs / Math.max(1, targetCount);
  for (const candidate of TICK_INTERVALS) {
    if (rough <= candidate.ms) return candidate;
  }
  return TICK_INTERVALS[TICK_INTERVALS.length - 1];
}

function snapToUnit(ms: number, unit: DateTickUnit, tz: DateTimezone): number {
  const d = new Date(ms);
  if (tz === "utc") {
    switch (unit) {
      case "second":
        return Math.floor(ms / MS_PER_SECOND) * MS_PER_SECOND;
      case "minute":
        return Math.floor(ms / MS_PER_MINUTE) * MS_PER_MINUTE;
      case "hour":
        return Math.floor(ms / MS_PER_HOUR) * MS_PER_HOUR;
      case "day":
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      case "week": {
        // ISO 8601 week starts Monday. JS day: Sun=0..Sat=6.
        const dayIndex = d.getUTCDay();
        const daysSinceMonday = (dayIndex + 6) % 7;
        return Date.UTC(
          d.getUTCFullYear(),
          d.getUTCMonth(),
          d.getUTCDate() - daysSinceMonday,
        );
      }
      case "month":
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
      case "year":
        return Date.UTC(d.getUTCFullYear(), 0, 1);
    }
  }
  switch (unit) {
    case "second":
      return Math.floor(ms / MS_PER_SECOND) * MS_PER_SECOND;
    case "minute":
      return Math.floor(ms / MS_PER_MINUTE) * MS_PER_MINUTE;
    case "hour":
      return new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        d.getHours(),
      ).getTime();
    case "day":
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    case "week": {
      const dayIndex = d.getDay();
      const daysSinceMonday = (dayIndex + 6) % 7;
      return new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate() - daysSinceMonday,
      ).getTime();
    }
    case "month":
      return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    case "year":
      return new Date(d.getFullYear(), 0, 1).getTime();
  }
}

function addUnit(
  ms: number,
  unit: DateTickUnit,
  step: number,
  tz: DateTimezone,
): number {
  if (unit === "second") return ms + step * MS_PER_SECOND;
  if (unit === "minute") return ms + step * MS_PER_MINUTE;
  if (unit === "hour" && tz === "utc") return ms + step * MS_PER_HOUR;
  if (unit === "week" && tz === "utc") return ms + step * MS_PER_WEEK;

  const d = new Date(ms);
  if (tz === "utc") {
    switch (unit) {
      case "day":
        return Date.UTC(
          d.getUTCFullYear(),
          d.getUTCMonth(),
          d.getUTCDate() + step,
          d.getUTCHours(),
          d.getUTCMinutes(),
          d.getUTCSeconds(),
          d.getUTCMilliseconds(),
        );
      case "month":
        return Date.UTC(
          d.getUTCFullYear(),
          d.getUTCMonth() + step,
          d.getUTCDate(),
          d.getUTCHours(),
          d.getUTCMinutes(),
          d.getUTCSeconds(),
          d.getUTCMilliseconds(),
        );
      case "year":
        return Date.UTC(
          d.getUTCFullYear() + step,
          d.getUTCMonth(),
          d.getUTCDate(),
          d.getUTCHours(),
          d.getUTCMinutes(),
          d.getUTCSeconds(),
          d.getUTCMilliseconds(),
        );
    }
  }
  // Local mode: Date field math handles DST and month length.
  switch (unit) {
    case "hour":
      return new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        d.getHours() + step,
        d.getMinutes(),
        d.getSeconds(),
        d.getMilliseconds(),
      ).getTime();
    case "day":
      return new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate() + step,
        d.getHours(),
        d.getMinutes(),
        d.getSeconds(),
        d.getMilliseconds(),
      ).getTime();
    case "week":
      return new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate() + step * 7,
        d.getHours(),
        d.getMinutes(),
        d.getSeconds(),
        d.getMilliseconds(),
      ).getTime();
    case "month":
      return new Date(
        d.getFullYear(),
        d.getMonth() + step,
        d.getDate(),
        d.getHours(),
        d.getMinutes(),
        d.getSeconds(),
        d.getMilliseconds(),
      ).getTime();
    case "year":
      return new Date(
        d.getFullYear() + step,
        d.getMonth(),
        d.getDate(),
        d.getHours(),
        d.getMinutes(),
        d.getSeconds(),
        d.getMilliseconds(),
      ).getTime();
  }
  // Unreachable — the early returns above cover second/minute/hour-utc/week-utc.
  return ms;
}

/**
 * Choose tick values for a date axis spanning `[minMs, maxMs]`. The
 * returned `unit` lets the default formatter pick a unit-appropriate
 * preset (year ticks → "year", month → "month-year", day → "month-day",
 * etc.) — same trick Vega-Lite uses.
 */
export function pickDateTicks(
  minMs: number,
  maxMs: number,
  targetCount: number,
  tz: DateTimezone,
): { values: number[]; unit: DateTickUnit } {
  if (
    !Number.isFinite(minMs) ||
    !Number.isFinite(maxMs) ||
    minMs >= maxMs ||
    targetCount < 1
  ) {
    return { values: [], unit: "day" };
  }
  const span = maxMs - minMs;
  const { unit, step } = chooseInterval(span, targetCount);

  let v = snapToUnit(minMs, unit, tz);
  let safety = 0;
  while (v < minMs && safety < MAX_TICK_ITER) {
    v = addUnit(v, unit, step, tz);
    safety++;
  }

  const values: number[] = [];
  for (let i = 0; i < MAX_TICK_ITER && v <= maxMs; i++) {
    values.push(v);
    v = addUnit(v, unit, step, tz);
  }
  return { values, unit };
}

const PRESET_OPTIONS: Record<DateFormatPreset, Intl.DateTimeFormatOptions> = {
  // "iso" and "iso-datetime" route through manual formatters below so
  // the output stays exactly YYYY-MM-DD regardless of locale.
  iso: { year: "numeric", month: "2-digit", day: "2-digit" },
  "iso-datetime": {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  },
  year: { year: "numeric" },
  "month-year": { month: "short", year: "numeric" },
  "month-day": { month: "short", day: "numeric" },
  day: { day: "numeric" },
  time: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
  datetime: {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  },
  medium: { dateStyle: "medium" } as Intl.DateTimeFormatOptions,
};

const UNIT_DEFAULT_PRESET: Record<DateTickUnit, DateFormatPreset> = {
  year: "year",
  month: "month-year",
  week: "month-day",
  day: "month-day",
  hour: "time",
  minute: "time",
  second: "time",
};

/** All valid preset names. Exported for the disjointness invariant test. */
export const DATE_FORMAT_PRESETS = Object.keys(
  PRESET_OPTIONS,
) as readonly DateFormatPreset[];

function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

function formatIso(ms: number, tz: DateTimezone): string {
  const d = new Date(ms);
  if (tz === "utc") {
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatIsoDateTime(ms: number, tz: DateTimezone): string {
  const d = new Date(ms);
  if (tz === "utc") {
    return (
      `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}` +
      `T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}Z`
    );
  }
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  );
}

function isPreset(name: string): name is DateFormatPreset {
  return name in PRESET_OPTIONS;
}

/**
 * Format an epoch-ms timestamp into a tick label. When `format` is
 * undefined, picks a preset based on the tick `unit` (Vega-Lite style:
 * year ticks read as "2024", month ticks as "Jan 2024", etc.).
 */
export function formatDate(
  ms: number,
  format: DateFormat | undefined,
  tz: DateTimezone,
  unit?: DateTickUnit,
): string {
  if (typeof format === "function") return format(ms, unit);

  let presetName: DateFormatPreset | null = null;
  let options: Intl.DateTimeFormatOptions;
  if (format === undefined) {
    presetName = unit ? UNIT_DEFAULT_PRESET[unit] : "iso";
    options = PRESET_OPTIONS[presetName];
  } else if (typeof format === "string") {
    if (!isPreset(format)) {
      throw new Error(`Unknown date format preset: "${format}"`);
    }
    presetName = format;
    options = PRESET_OPTIONS[presetName];
  } else {
    options = format;
  }

  if (presetName === "iso") return formatIso(ms, tz);
  if (presetName === "iso-datetime") return formatIsoDateTime(ms, tz);

  const finalOpts: Intl.DateTimeFormatOptions =
    tz === "utc" ? { ...options, timeZone: "UTC" } : options;
  return new Intl.DateTimeFormat(undefined, finalOpts).format(ms);
}
