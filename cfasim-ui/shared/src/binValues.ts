export interface BinOptions {
  /**
   * Number of equal-width bins across the domain, or explicit, ascending
   * bin edges. Default: Sturges' rule, `ceil(log2(n) + 1)`.
   */
  thresholds?: number | readonly number[];
  /**
   * Bin width. Wins over a `thresholds` count, and the edges fall on
   * multiples of it (a step of 0.5 gives edges at 2.0, 2.5, ...).
   */
  step?: number;
  /** Range to bin over. Defaults to the values' extent; values outside are dropped. */
  domain?: readonly [number, number];
}

/** Histogram bins: bin `i` spans `[x[i], x2[i])` and holds `count[i]` values. */
export interface Bins {
  x: number[];
  x2: number[];
  count: number[];
}

// Rounds away float drift from repeated steps (0.1 + 0.2).
const clean = (v: number) => Number(v.toPrecision(12));

/**
 * Count `values` into bins, ready for `BarChart`'s `x` / `x2`:
 * `<BarChart :x="bins.x" :x2="bins.x2" :data="bins.count" :bar-padding="0" />`.
 * Bins are half-open except the last, which also holds the domain's
 * upper bound. Non-finite values are skipped.
 */
export function binValues(
  values: ArrayLike<number>,
  opts: BinOptions = {},
): Bins {
  const finite: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = Number(values[i]);
    if (Number.isFinite(v)) finite.push(v);
  }
  const edges = binEdges(finite, opts);
  const n = edges.length - 1;
  const bins: Bins = {
    x: edges.slice(0, -1),
    x2: edges.slice(1),
    count: new Array(Math.max(0, n)).fill(0),
  };
  if (n < 1) return { x: [], x2: [], count: [] };
  const lo = edges[0];
  const hi = edges[n];
  for (const v of finite) {
    if (v < lo || v > hi) continue;
    let a = 0;
    let b = n - 1;
    while (a < b) {
      const mid = (a + b + 1) >> 1;
      if (edges[mid] <= v) a = mid;
      else b = mid - 1;
    }
    bins.count[a]++;
  }
  return bins;
}

function binEdges(values: readonly number[], opts: BinOptions): number[] {
  if (Array.isArray(opts.thresholds)) {
    return [...new Set(opts.thresholds as number[])]
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
  }
  let lo = opts.domain?.[0] ?? Infinity;
  let hi = opts.domain?.[1] ?? -Infinity;
  if (!opts.domain) {
    for (const v of values) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  const step = opts.step;
  if (step !== undefined && step > 0 && Number.isFinite(step)) {
    const first = Math.floor(lo / step);
    // Always at least one bin, and the last edge at or past `hi`.
    const last = Math.max(first + 1, Math.ceil(hi / step));
    const edges: number[] = [];
    for (let i = first; i <= last; i++) edges.push(clean(i * step));
    return edges;
  }
  if (lo === hi) return [lo - 0.5, hi + 0.5];
  const count =
    typeof opts.thresholds === "number" && opts.thresholds >= 1
      ? Math.floor(opts.thresholds)
      : Math.max(1, Math.ceil(Math.log2(values.length) + 1));
  const width = (hi - lo) / count;
  const edges: number[] = [];
  for (let i = 0; i < count; i++) edges.push(clean(lo + i * width));
  edges.push(hi);
  return edges;
}
