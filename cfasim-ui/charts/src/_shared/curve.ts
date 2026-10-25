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
 * Path commands that follow a start point: `[x, y]` is a line to `(x, y)`,
 * `[x1, y1, x2, y2, x, y]` a cubic Bezier.
 */
export type CurveSegment = number[];

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

/** Segments from `points[from]` to `points[to]`. */
export function curveSegments(
  points: readonly CurvePoint[],
  curve: LineCurve = "linear",
  opts: CurveOptions = {},
): CurveSegment[] {
  const n = points.length;
  const from = Math.max(0, opts.from ?? 0);
  const to = Math.min(n - 1, opts.to ?? n - 1);
  const out: CurveSegment[] = [];
  if (to <= from) return out;
  const swap = opts.axis === "y";
  const t = (i: number) => (swap ? points[i].y : points[i].x);
  const v = (i: number) => (swap ? points[i].x : points[i].y);
  const line = (a: number, b: number) => out.push(swap ? [b, a] : [a, b]);
  const m = curve === "monotone" && n > 2 ? monotoneTangent(t, v, n) : null;

  for (let i = from; i < to; i++) {
    const t0 = t(i);
    const t1 = t(i + 1);
    const v0 = v(i);
    const v1 = v(i + 1);
    if (m) {
      const dt = (t1 - t0) / 3;
      const c = [t0 + dt, v0 + dt * m(i), t1 - dt, v1 - dt * m(i + 1), t1, v1];
      out.push(swap ? [c[1], c[0], c[3], c[2], c[5], c[4]] : c);
      continue;
    }
    switch (curve) {
      case "step-before":
        line(t0, v1);
        line(t1, v1);
        break;
      case "step-after":
        line(t1, v0);
        line(t1, v1);
        break;
      case "step": {
        const mid = (t0 + t1) / 2;
        line(mid, v0);
        line(mid, v1);
        // d3 only finishes the last half step once, at the line's end.
        if (i + 1 === to) line(t1, v1);
        break;
      }
      default:
        line(t1, v1);
    }
  }
  return out;
}

// Steffen's method, as in d3-shape's monotoneX: interior tangents from
// both neighboring slopes, clamped so the curve stays monotone; the end
// tangents from a one-sided three-point estimate.
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

function segmentsPath(
  start: CurvePoint,
  segments: readonly CurveSegment[],
  command: "M" | "L",
): string {
  let d = `${command}${start.x},${start.y}`;
  for (const s of segments) {
    d +=
      s.length === 2
        ? `L${s[0]},${s[1]}`
        : `C${s[0]},${s[1]},${s[2]},${s[3]},${s[4]},${s[5]}`;
  }
  return d;
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
  const from = Math.max(0, opts.from ?? 0);
  const to = Math.min(points.length - 1, opts.to ?? points.length - 1);
  if (to < from) return "";
  if (curve === "linear") {
    let d = `${command}${points[from].x},${points[from].y}`;
    for (let i = from + 1; i <= to; i++) d += `L${points[i].x},${points[i].y}`;
    return d;
  }
  return segmentsPath(
    points[from],
    curveSegments(points, curve, opts),
    command,
  );
}

/**
 * The same curve traced from `points[to]` back to `points[from]`, for the
 * return edge of a filled area. Starts with `L` unless told otherwise.
 */
export function reverseCurvePath(
  points: readonly CurvePoint[],
  curve: LineCurve = "linear",
  opts: CurveOptions = {},
  command: "M" | "L" = "L",
): string {
  const from = Math.max(0, opts.from ?? 0);
  const to = Math.min(points.length - 1, opts.to ?? points.length - 1);
  if (to < from) return "";
  if (curve === "linear") {
    let d = `${command}${points[to].x},${points[to].y}`;
    for (let i = to - 1; i >= from; i--) d += `L${points[i].x},${points[i].y}`;
    return d;
  }
  const segs = curveSegments(points, curve, opts);
  const ends: CurvePoint[] = [points[from]];
  for (const s of segs) ends.push({ x: s[s.length - 2], y: s[s.length - 1] });
  const reversed: CurveSegment[] = [];
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    const back = ends[i];
    reversed.push(
      s.length === 2
        ? [back.x, back.y]
        : [s[2], s[3], s[0], s[1], back.x, back.y],
    );
  }
  return segmentsPath(ends[ends.length - 1], reversed, command);
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
