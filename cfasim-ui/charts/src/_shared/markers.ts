/**
 * Draggable full-height vertical marker lines for cartesian charts.
 * The chart resolves each marker's data-space `x` to pixels with its
 * own scales; `layoutMarkerLabels` runs the label collision pass so
 * labels that would overlap drop down to the next row.
 */

import type { BlendMode, LabelStyle } from "./chartProps.js";

export interface ChartMarker {
  /**
   * X position in data coordinates — the same x-space as the chart's
   * axis, so it respects `xMin`. On a date axis, accepts a `Date`, a
   * date string, or epoch-ms.
   */
  x: number | string | Date;
  /** Text drawn just above the top of the marker line. */
  label?: string;
  /** Line color. Default: `#999`. */
  color?: string;
  /** Line width in pixels. Default: 1.5. */
  strokeWidth?: number;
  /** Dashed line. Default: true — set `false` for a solid line. */
  dashed?: boolean;
  /**
   * SVG `stroke-dasharray` override for full control of the dash
   * pattern. Accepts the raw string form (`"2 6"`), a single number
   * (uniform dash/gap), or an array of numbers. Takes precedence over
   * `dashed`.
   */
  dash?: string | number | readonly number[];
  /**
   * Draw a page-colored stroke behind the line so it stays visually
   * separated from series lines and filled areas. Default: false.
   */
  outline?: boolean;
  /** Outline stroke color. Default: `var(--color-bg-0, #fff)`. */
  outlineColor?: string;
  /**
   * Total extra width added to `strokeWidth` for the outline (split
   * evenly per side). Default: 4. Only applies when `outline` is true.
   */
  outlineWidth?: number;
  /**
   * Label text style (`fontSize`, `color`, `fontWeight`). Defaults:
   * font-size 12, weight 600, currentColor.
   */
  labelStyle?: LabelStyle;
  /**
   * Color of the legibility stroke drawn behind the label text so it
   * stays readable over series lines. Default: `var(--color-bg-0, #fff)`.
   */
  labelOutlineColor?: string;
  /**
   * Label outline stroke width in pixels. `0` disables. Default: 3, or
   * 0 when the label has a `labelBackground`.
   */
  labelOutlineWidth?: number;
  /**
   * Draw the label on a filled pill that sits on top of the marker line:
   * flat where it meets the line, rounded on its other corners. `true`
   * fills it with the marker `color`; a string is a fill of its own. The
   * text defaults to white or near-black, whichever reads better on the
   * fill, unless `labelStyle.color` is set. A draggable marker's pill
   * darkens on hover and keyboard focus.
   */
  labelBackground?: boolean | string;
  /**
   * Padding inside the label pill in pixels: one number for all sides
   * or `{ x, y }`. Default: `MARKER_PILL_PADDING` (`{ x: 6, y: 5 }`).
   * Only applies with `labelBackground`.
   */
  labelPadding?: number | { x?: number; y?: number };
  /** Whether the marker can be dragged along the x-axis. Default: true. */
  draggable?: boolean;
  /**
   * Snap the marker while dragging. `true` snaps to the x positions of
   * the chart's series (indices, explicit `x` values, or dates), and a
   * number snaps to multiples of that step in axis units (data units
   * from the axis origin, or milliseconds from the first date). Arrow
   * keys then step from one snap position to the next. Default: no
   * snapping.
   */
  snap?: boolean | number;
  /**
   * While the marker is being dragged, show its current `x` just above
   * the x axis beside the line, formatted like the x axis unless
   * `valueFormat` is set. Default: true; set `false` to hide it.
   */
  showValueOnDrag?: boolean;
  /**
   * Formats the value shown by `showValueOnDrag`. Receives the marker's
   * `x` in its own coordinate space (a `Date` on a date axis).
   */
  valueFormat?: (x: number | Date) => string;
  /**
   * Text style of the drag value (`fontSize`, `color`, `fontWeight`).
   * Defaults: the label's font size, currentColor, weight 400.
   */
  valueStyle?: LabelStyle;
  /** Legibility stroke color behind the drag value. Default: `labelOutlineColor`. */
  valueOutlineColor?: string;
  /** Drag value outline width in pixels. `0` disables. Default: 3. */
  valueOutlineWidth?: number;
  /** CSS `mix-blend-mode` for the drag value text. */
  valueBlendMode?: BlendMode;
}

/** Payload emitted on `marker-drag` / `marker-drag-end`. */
export interface ChartMarkerDragPayload {
  /** Index into the `markers` prop. */
  index: number;
  /** New x in data coordinates (a `Date` on a date axis). */
  x: number | Date;
  /** The updated marker object. */
  marker: ChartMarker;
}

/** Resolve a marker's `dashed`/`dash` fields to a stroke-dasharray. */
export function markerDashArray(m: ChartMarker): string | undefined {
  if (m.dash != null) {
    if (typeof m.dash === "string") return m.dash;
    if (typeof m.dash === "number") return String(m.dash);
    return m.dash.join(" ");
  }
  return m.dashed === false ? undefined : "4 4";
}

export interface MarkerLabelItem {
  /** Pixel x of the marker line. */
  x: number;
  /** Estimated label width in pixels. */
  width: number;
}

export interface MarkerLabelPlacement {
  /** Pixel x for the `<text>` element (already offset from the line). */
  x: number;
  anchor: "start" | "end";
  /** Row index, 0-based; each collision pushes a label one row down. */
  row: number;
}

/**
 * Place marker labels next to their lines, avoiding collisions. Each
 * label prefers to extend rightward with its left edge aligned over
 * the line (`anchor: "start"`); a label that would overflow
 * `bounds.right` flips to the left side when it fits, ending flush at
 * the line. `pad` shifts the label away from the line on its anchored
 * side. Labels are then assigned rows greedily in x order: a label
 * whose horizontal span comes within `gap` px of an already placed
 * label on that row moves down to the next row. Returned placements
 * are in input order.
 */
export function layoutMarkerLabels(
  items: readonly MarkerLabelItem[],
  bounds: { left: number; right: number },
  opts: { pad?: number; gap?: number } = {},
): MarkerLabelPlacement[] {
  const pad = opts.pad ?? 0;
  const gap = opts.gap ?? 12;
  const order = items.map((_, i) => i).sort((a, b) => items[a].x - items[b].x);
  const placements: MarkerLabelPlacement[] = new Array(items.length);
  const rowRightEdges: number[] = [];
  for (const i of order) {
    const it = items[i];
    let anchor: "start" | "end" = "start";
    let left = it.x + pad;
    if (
      left + it.width > bounds.right &&
      it.x - pad - it.width >= bounds.left
    ) {
      anchor = "end";
      left = it.x - pad - it.width;
    }
    const right = left + it.width;
    let row = 0;
    while (row < rowRightEdges.length && left < rowRightEdges[row] + gap) {
      row++;
    }
    rowRightEdges[row] = Math.max(rowRightEdges[row] ?? -Infinity, right);
    placements[i] = {
      x: anchor === "start" ? it.x + pad : it.x - pad,
      anchor,
      row,
    };
  }
  return placements;
}

export const MARKER_PILL_PADDING = { x: 6, y: 5 } as const;
const MARKER_PILL_RADIUS = 3;
/** Cap height as a fraction of font size; label boxes are built on it. */
export const MARKER_CAP_HEIGHT_RATIO = 0.75;

/** The marker's pill padding, or `null` when it has no pill. */
export function markerPillPadding(
  m: ChartMarker,
): { x: number; y: number } | null {
  if (!m.labelBackground) return null;
  const p = m.labelPadding;
  if (typeof p === "number") return { x: p, y: p };
  return { x: p?.x ?? MARKER_PILL_PADDING.x, y: p?.y ?? MARKER_PILL_PADDING.y };
}

/**
 * Vertical extent of a marker label around its baseline: the cap height
 * above and the descender space below for plain text, or the pill's
 * edges (cap height plus padding above, padding below, so caps center
 * and descenders tuck into the bottom padding) when `pad` is given.
 */
export function markerLabelBox(
  fontSize: number,
  pad: { x: number; y: number } | null,
): { ascent: number; descent: number } {
  const cap = fontSize * MARKER_CAP_HEIGHT_RATIO;
  return pad
    ? { ascent: cap + pad.y, descent: pad.y }
    : { ascent: cap, descent: fontSize - cap };
}

/**
 * A label pill flush against the marker line at `x` (flat on that side)
 * and rounded on the far corners, extending `dir` (1 right, -1 left).
 */
export function markerPillPath(
  x: number,
  top: number,
  bottom: number,
  width: number,
  dir: 1 | -1,
): string {
  const r = Math.min(MARKER_PILL_RADIUS, width / 2, (bottom - top) / 2);
  const far = x + dir * width;
  const inner = far - dir * r;
  const sweep = dir === 1 ? 1 : 0;
  return (
    `M${x},${top} L${inner},${top} ` +
    `A${r},${r} 0 0 ${sweep} ${far},${top + r} ` +
    `L${far},${bottom - r} ` +
    `A${r},${r} 0 0 ${sweep} ${inner},${bottom} ` +
    `L${x},${bottom} Z`
  );
}
