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

export function formatTick(v: number): string {
  if (Math.abs(v) >= 1000) return numFmt.format(v);
  if (Number.isInteger(v)) return v.toString();
  return v.toFixed(1);
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
