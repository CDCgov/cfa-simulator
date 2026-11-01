import { CATEGORICAL_COLORS } from "../_shared/palette.js";
import type { LineChartData, LineChartXInput, Series } from "./LineChart.vue";

/** A group key: rows with a missing key (`null`, `undefined`, NaN) are dropped. */
export type GroupKey = string | number;

/**
 * Long-format columns for `groupSeries`, all parallel to `y`. Besides
 * `x` and `group`, every per-point series field may be given here and is
 * split along with the data.
 */
export interface GroupSeriesColumns {
  y: LineChartData;
  group: ArrayLike<GroupKey | null | undefined>;
  x?: LineChartXInput;
  lower?: LineChartData;
  upper?: LineChartData;
  colorValue?: ArrayLike<number>;
  dotRadius?: ArrayLike<number>;
  dotOpacity?: ArrayLike<number>;
  dotFill?: ArrayLike<string>;
}

export interface GroupSeriesOptions<K extends GroupKey = GroupKey> {
  /**
   * Group keys in legend order. Groups not listed follow in the order
   * they first appear.
   */
  order?: readonly K[];
  /**
   * Series colors: a map by group key, or a list taken in group order
   * (cycled). Groups without one take `CATEGORICAL_COLORS` by position.
   */
  colors?: Readonly<Record<string, string>> | readonly string[];
  /** Legend label per group. Defaults to `String(key)`. */
  label?: (key: K) => string;
  /**
   * Fields set on every series (`line: false, dots: true` for a
   * scatter), or a function of the group and its position. They win
   * over the derived `legend` and `color`.
   */
  style?: Partial<Series> | ((key: K, index: number) => Partial<Series>);
}

const SPLIT_FIELDS = [
  "x",
  "lower",
  "upper",
  "colorValue",
  "dotRadius",
  "dotOpacity",
  "dotFill",
] as const;

function pick<T>(arr: ArrayLike<T>, idx: readonly number[]): ArrayLike<T> {
  if (ArrayBuffer.isView(arr)) {
    const Ctor = arr.constructor as new (n: number) => {
      [i: number]: T;
      length: number;
    };
    const out = new Ctor(idx.length);
    for (let j = 0; j < idx.length; j++) out[j] = arr[idx[j]];
    return out;
  }
  return idx.map((i) => arr[i]);
}

/**
 * Split long-format data into one LineChart series per group, for a
 * categorical color dimension: each series gets the group's `legend` and
 * `color`, so the legend, legend toggling, tooltip rows and CSV columns
 * all follow the groups.
 *
 * ```ts
 * groupSeries(
 *   { x: rows.r0, y: rows.peak, group: rows.region },
 *   { style: { line: false, dots: true } },
 * );
 * ```
 */
export function groupSeries<K extends GroupKey = GroupKey>(
  columns: GroupSeriesColumns,
  options: GroupSeriesOptions<K> = {},
): Series[] {
  const { y, group } = columns;
  const n = Math.min(y.length, group.length);
  const buckets = new Map<GroupKey, number[]>();
  for (const k of options.order ?? []) buckets.set(k, []);
  for (let i = 0; i < n; i++) {
    const k = group[i];
    if (k === null || k === undefined || k !== k) continue;
    let b = buckets.get(k);
    if (!b) buckets.set(k, (b = []));
    b.push(i);
  }
  const { colors } = options;
  const out: Series[] = [];
  let index = 0;
  for (const [key, idx] of buckets) {
    if (idx.length === 0) continue;
    const k = key as K;
    const color =
      (Array.isArray(colors)
        ? colors[index % colors.length]
        : (colors as Record<string, string> | undefined)?.[String(key)]) ??
      CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length];
    const s: Series = {
      y: pick(y, idx) as LineChartData,
      legend: options.label ? options.label(k) : String(key),
      color,
    };
    for (const f of SPLIT_FIELDS) {
      const col = columns[f];
      if (col)
        (s as Record<string, unknown>)[f] = pick(
          col as ArrayLike<unknown>,
          idx,
        );
    }
    const style =
      typeof options.style === "function"
        ? options.style(k, index)
        : options.style;
    out.push(style ? { ...s, ...style } : s);
    index++;
  }
  return out;
}
