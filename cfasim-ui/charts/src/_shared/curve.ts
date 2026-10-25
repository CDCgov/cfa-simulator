/**
 * How a line connects its points. Geometry matches d3-shape (and so
 * Vega-Lite's `interpolate`):
 * - `"linear"` (default): straight segments.
 * - `"step"`: horizontal to the midpoint between x values, then vertical.
 * - `"step-before"`: vertical first, then horizontal (the value applies up
 *   to and including its x).
 * - `"step-after"`: horizontal first, then vertical (the value holds from
 *   its x until the next point), the usual shape for cumulative counts.
 * - `"monotone"`: a smooth cubic that never overshoots the data between
 *   points (d3's `curveMonotoneX`).
 */
export type LineCurve =
  "linear" | "step" | "step-before" | "step-after" | "monotone";

export interface CurvePoint {
  x: number;
  y: number;
}

/**
 * Which part of a curve to draw: `axis` names the independent pixel axis
 * (`"y"` steps and smooths along y, for a horizontal BarChart's summary
 * lines), and `from` / `to` pick a stretch of the points while the curve
 * keeps its shape from all of them (a monotone tangent depends on the
 * neighbors on both sides).
 */
export interface CurveOptions {
  axis?: "x" | "y";
  from?: number;
  to?: number;
}

// Steffen's method, as in d3-shape's monotoneX: interior tangents from
// both neighboring slopes, clamped so the curve stays monotone; the end
// tangents from a one-sided three-point estimate. Both are the same read
// in either direction, which `reverseCurvePath` relies on.
function monotoneTangent(
  t: (i: number) => number,
  v: (i: number) => number,
  n: number,
): (i: number) => number {
  const sign = (x: number) => (x < 0 ? -1 : 1);
  const interior = (i: number) => {
    const h0 = t(i) - t(i - 1);
    const h1 = t(i + 1) - t(i);
    const s0 = (v(i) - v(i - 1)) / (h0 || (h1 < 0 ? -0 : 0));
    const s1 = (v(i + 1) - v(i)) / (h1 || (h0 < 0 ? -0 : 0));
    const p = (s0 * h1 + s1 * h0) / (h0 + h1);
    return (
      (sign(s0) + sign(s1)) *
        Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
    );
  };
  const end = (a: number, b: number, tb: number) => {
    const h = t(b) - t(a);
    return h ? ((3 * (v(b) - v(a))) / h - tb) / 2 : tb;
  };
  return (i) =>
    i === 0
      ? end(0, 1, interior(1))
      : i === n - 1
        ? end(n - 2, n - 1, interior(n - 2))
        : interior(i);
}

/**
 * Path data drawing `points[from..to]` with `curve`, starting with `M` (or
 * `L` to continue a path). Empty for no points.
 */
export function curvePath(
  points: readonly CurvePoint[],
  curve: LineCurve = "linear",
  opts: CurveOptions = {},
  command: "M" | "L" = "M",
): string {
  return draw(points, curve, opts, command, false);
}

/** `curvePath`, optionally walking `points` from the end (no copy). */
function draw(
  points: readonly CurvePoint[],
  curve: LineCurve,
  opts: CurveOptions,
  command: "M" | "L",
  reversed: boolean,
): string {
  const n = points.length;
  const from = Math.max(0, opts.from ?? 0);
  const to = Math.min(n - 1, opts.to ?? n - 1);
  if (to < from) return "";
  const swap = opts.axis === "y";
  const at = (i: number) => points[reversed ? n - 1 - i : i];
  const t = (i: number) => (swap ? at(i).y : at(i).x);
  const v = (i: number) => (swap ? at(i).x : at(i).y);
  const pt = (a: number, b: number) => (swap ? `${b},${a}` : `${a},${b}`);
  const m = curve === "monotone" && n > 2 ? monotoneTangent(t, v, n) : null;
  let m0 = m ? m(from) : 0;
  let d = command + pt(t(from), v(from));
  for (let i = from; i < to; i++) {
    const t0 = t(i);
    const t1 = t(i + 1);
    const v0 = v(i);
    const v1 = v(i + 1);
    if (m) {
      const m1 = m(i + 1);
      const dt = (t1 - t0) / 3;
      d += `C${pt(t0 + dt, v0 + dt * m0)},${pt(t1 - dt, v1 - dt * m1)},${pt(t1, v1)}`;
      m0 = m1;
      continue;
    }
    if (curve === "step-before") d += `L${pt(t0, v1)}`;
    else if (curve === "step-after") d += `L${pt(t1, v0)}`;
    else if (curve === "step") {
      const mid = (t0 + t1) / 2;
      d += `L${pt(mid, v0)}L${pt(mid, v1)}`;
      // d3 only finishes the last half step once, at the line's end.
      if (i + 1 < to) continue;
    }
    d += `L${pt(t1, v1)}`;
  }
  return d;
}

/**
 * The same curve traced from `points[to]` back to `points[from]`, for the
 * return edge of a filled area: the curve over the reversed points, with
 * step-before and step-after trading places. Starts with `L` unless told
 * otherwise.
 */
export function reverseCurvePath(
  points: readonly CurvePoint[],
  curve: LineCurve = "linear",
  opts: CurveOptions = {},
  command: "M" | "L" = "L",
): string {
  const last = points.length - 1;
  return draw(
    points,
    curve === "step-before"
      ? "step-after"
      : curve === "step-after"
        ? "step-before"
        : curve,
    {
      axis: opts.axis,
      from: last - Math.min(last, opts.to ?? last),
      to: last - Math.max(0, opts.from ?? 0),
    },
    command,
    true,
  );
}

/**
 * Visit the values a line shows inside an x-window: every point in the
 * window, plus the value its curve draws where a segment crosses either
 * edge. Non-finite points break the line.
 */
export function visitCurveWindow(
  n: number,
  xAt: (i: number) => number,
  yAt: (i: number) => number,
  win: { min: number; max: number },
  curve: LineCurve | undefined,
  visit: (v: number) => void,
): void {
  let px = NaN;
  let py = NaN;
  for (let i = 0; i < n; i++) {
    const x = xAt(i);
    const y = yAt(i);
    if (!isFinite(x) || !isFinite(y)) {
      px = NaN;
      continue;
    }
    if (x >= win.min && x <= win.max) visit(y);
    if (isFinite(px)) {
      for (const edge of [win.min, win.max]) {
        if ((edge - px) * (edge - x) < 0) {
          visit(curveValueAt(curve, px, py, x, y, edge));
        }
      }
    }
    px = x;
    py = y;
  }
}

/**
 * The value a curve draws at `x` between neighboring points `(x0, y0)` and
 * `(x1, y1)`: the held value for steps, else linear interpolation (a
 * monotone curve stays between `y0` and `y1`, so this is close).
 */
export function curveValueAt(
  curve: LineCurve | undefined,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x: number,
): number {
  switch (curve) {
    case "step-after":
      return x === x1 ? y1 : y0;
    case "step-before":
      return x === x0 ? y0 : y1;
    case "step":
      return Math.abs(x - x0) < Math.abs(x - x1) ? y0 : y1;
    default:
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
}
