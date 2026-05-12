import { intervalValues, niceStep } from "./axes.js";

export interface TickValueOptions {
  /** Data-space extent. */
  min: number;
  max: number;
  /** Tick spec: number = interval, array = explicit values, undefined = auto. */
  ticks?: number | number[];
  /** Target tick count when auto-spacing (typically innerSize / 50 for y, /80 for x). */
  targetTickCount?: number;
  /**
   * Display-space offset added to user-supplied explicit/interval values
   * before they are interpreted. Used by LineChart's `xMin` semantics so
   * users supply tick values in display coordinates.
   */
  displayOffset?: number;
}

/**
 * Returns tick values in data-space ([min, max]) according to the spec.
 * Display-space conversions (for labels) happen at the call site so
 * each chart can layer its own formatting / fallback behavior.
 */
export function computeTickValues(opts: TickValueOptions): number[] {
  const { min, max, ticks } = opts;
  if (min === max) return [];
  const offset = opts.displayOffset ?? 0;

  if (Array.isArray(ticks)) {
    return ticks.map((v) => v - offset).filter((v) => v >= min && v <= max);
  }
  if (typeof ticks === "number") {
    return intervalValues(min + offset, max + offset, ticks).map(
      (v) => v - offset,
    );
  }
  const target = Math.max(3, Math.floor(opts.targetTickCount ?? 3));
  const step = niceStep(max - min, target);
  return intervalValues(min + offset, max + offset, step).map(
    (v) => v - offset,
  );
}
