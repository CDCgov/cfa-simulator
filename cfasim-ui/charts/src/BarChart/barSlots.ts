import type { ChartData, DateTimezone } from "../_shared/index.js";

/**
 * How far a bar on a continuous x axis extends past its `x`. A number is
 * in data units (milliseconds on a date axis); a calendar unit only
 * applies on a date axis and follows month and year lengths.
 */
export type BarPeriod = number | "day" | "week" | "month" | "quarter" | "year";

const MS_PER_DAY = 86_400_000;

/**
 * Bar positions on a continuous x axis: one slot per distinct x across
 * every series, sorted, with the data-space span its bars fill.
 */
export interface BarSlots {
  x: number[];
  start: number[];
  end: number[];
  /** Whether the span came from `x2` or `period` rather than the auto width. */
  explicit: boolean[];
}

/** `x` advanced by one `period`. NaN for a calendar unit off a date axis. */
export function addPeriod(
  x: number,
  period: BarPeriod,
  isDate: boolean,
  tz: DateTimezone,
): number {
  if (typeof period === "number") return x + period;
  if (!isDate) return NaN;
  if (period === "day") return addCalendar(x, 0, 1, tz);
  if (period === "week") return addCalendar(x, 0, 7, tz);
  if (period === "month") return addCalendar(x, 1, 0, tz);
  if (period === "quarter") return addCalendar(x, 3, 0, tz);
  return addCalendar(x, 12, 0, tz);
}

function addCalendar(
  ms: number,
  months: number,
  days: number,
  tz: DateTimezone,
): number {
  const d = new Date(ms);
  if (tz === "utc") {
    d.setUTCMonth(d.getUTCMonth() + months, d.getUTCDate() + days);
  } else {
    d.setMonth(d.getMonth() + months, d.getDate() + days);
  }
  return d.getTime();
}

/**
 * Build the slots for every series' numeric x (and optional x2) arrays.
 * A span comes from the first finite `x2` given for its x, else
 * `period`, else the auto width: the smallest gap between neighboring x
 * values (one unit, or one day on a date axis, for a single x), centered.
 */
export function buildBarSlots(
  inputs: readonly { x: ChartData; x2?: ChartData }[],
  opts: { period?: BarPeriod; isDate: boolean; tz: DateTimezone },
): BarSlots {
  const ends = new Map<number, number>();
  for (const { x, x2 } of inputs) {
    for (let i = 0; i < x.length; i++) {
      const v = Number(x[i]);
      if (!isFinite(v)) continue;
      const e = x2 ? Number(x2[i]) : NaN;
      if (!ends.has(v) || (!isFinite(ends.get(v)!) && isFinite(e))) {
        ends.set(v, e);
      }
    }
  }
  const xs = [...ends.keys()].sort((a, b) => a - b);
  let gap = Infinity;
  for (let i = 1; i < xs.length; i++) gap = Math.min(gap, xs[i] - xs[i - 1]);
  if (!isFinite(gap)) gap = opts.isDate ? MS_PER_DAY : 1;

  const slots: BarSlots = { x: xs, start: [], end: [], explicit: [] };
  for (const v of xs) {
    const e = ends.get(v)!;
    const p =
      opts.period === undefined
        ? NaN
        : addPeriod(v, opts.period, opts.isDate, opts.tz);
    if (isFinite(e) && e !== v) {
      slots.start.push(Math.min(v, e));
      slots.end.push(Math.max(v, e));
      slots.explicit.push(true);
    } else if (isFinite(p) && p !== v) {
      slots.start.push(Math.min(v, p));
      slots.end.push(Math.max(v, p));
      slots.explicit.push(true);
    } else {
      slots.start.push(v - gap / 2);
      slots.end.push(v + gap / 2);
      slots.explicit.push(false);
    }
  }
  return slots;
}

/** Map from slot x to slot index. */
export function slotIndexMap(slots: BarSlots): Map<number, number> {
  const m = new Map<number, number>();
  slots.x.forEach((v, i) => m.set(v, i));
  return m;
}

/**
 * Values re-laid onto the slots: entry `i` is the value whose x is slot
 * `i`, NaN where the series has none. A repeated x keeps the last value.
 */
export function reindexToSlots(
  values: ChartData,
  x: ChartData,
  index: Map<number, number>,
  count: number,
): Float64Array {
  const out = new Float64Array(count).fill(NaN);
  const n = Math.min(values.length, x.length);
  for (let i = 0; i < n; i++) {
    const slot = index.get(Number(x[i]));
    if (slot !== undefined) out[slot] = Number(values[i]);
  }
  return out;
}

/**
 * The slot whose span holds `v`, else the one with the nearest center;
 * null with no slots or a non-finite `v`.
 */
export function slotIndexAt(slots: BarSlots, v: number): number | null {
  const n = slots.x.length;
  if (n === 0 || !isFinite(v)) return null;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (slots.start[mid] <= v) lo = mid;
    else hi = mid - 1;
  }
  if (slots.start[lo] <= v && v < slots.end[lo]) return lo;
  let best = 0;
  let bestD = Infinity;
  for (const i of [lo - 1, lo, lo + 1]) {
    if (i < 0 || i >= n) continue;
    const d = Math.abs((slots.start[i] + slots.end[i]) / 2 - v);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
