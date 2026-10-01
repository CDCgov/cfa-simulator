/**
 * Pure helpers shared by chart components for axis tick math and value
 * formatting. No Vue reactivity here; see `useAxisTicks` for the
 * reactive wrapper.
 */

/** Round to nearest half-pixel so 1px SVG strokes stay sharp. */
export function snap(v: number): number {
  return Math.round(v) + 0.5;
}

export function niceStep(range: number, targetTicks: number): number {
  const rough = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  let step: number;
  if (norm <= 1.5) step = 1;
  else if (norm <= 3) step = 2;
  else if (norm <= 7) step = 5;
  else step = 10;
  return step * mag;
}

/** Generate interval-spaced values in [min, max], inclusive. */
export function intervalValues(
  min: number,
  max: number,
  step: number,
): number[] {
  if (!(step > 0) || !isFinite(step)) return [];
  const out: number[] = [];
  const start = Math.ceil(min / step) * step;
  // Cap iteration to avoid runaway loops from pathological inputs.
  const maxIterations = 1000;
  for (
    let i = 0, v = start;
    v <= max + 1e-9 && i < maxIterations;
    i++, v = start + i * step
  ) {
    out.push(v);
  }
  return out;
}

const numFmt = new Intl.NumberFormat();

/**
 * Default tick label. `decimals` (see `tickDecimals`) raises the
 * precision when ticks sit closer together than the default rounding can
 * tell apart, e.g. on a deeply zoomed axis.
 */
export function formatTick(v: number, decimals = 0): string {
  if (Math.abs(v) >= 1000) {
    return decimals > 3
      ? v.toLocaleString(undefined, { maximumFractionDigits: decimals })
      : numFmt.format(v);
  }
  if (Number.isInteger(v)) return v.toString();
  return v.toFixed(Math.max(1, decimals));
}

/** Decimal places needed to tell apart the given (sorted) tick values. */
export function tickDecimals(values: readonly number[]): number {
  let step = Infinity;
  for (let i = 1; i < values.length; i++) {
    const d = Math.abs(values[i] - values[i - 1]);
    if (d > 0 && d < step) step = d;
  }
  if (!isFinite(step)) return 0;
  return Math.max(0, Math.min(12, Math.ceil(-Math.log10(step) - 1e-9)));
}

/**
 * Numeric input accepted by chart components. `number[]` and any standard
 * numeric typed array are supported, so the output of
 * `ModelOutput.column('x')` (e.g. a `Float64Array`) can be passed
 * directly without copying.
 */
export type ChartData =
  | readonly number[]
  | Float64Array
  | Float32Array
  | Int32Array
  | Uint32Array
  | Int16Array
  | Uint16Array
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray;
