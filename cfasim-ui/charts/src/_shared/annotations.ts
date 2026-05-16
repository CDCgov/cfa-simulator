/**
 * Shared annotation API for charts. Each chart projects an annotation's
 * data-space `(x, y)` to pixels with its own scales and hands the resolved
 * positions to `ChartAnnotations.vue` for rendering.
 */

export interface ChartAnnotation {
  /**
   * Anchor x position in data coordinates. For `LineChart` this is the
   * same x-space as the series data; for `BarChart` it's the category
   * index (fractional values land between categories).
   */
  x: number;
  /** Anchor y position in data coordinates (value axis). */
  y: number;
  /**
   * Label text.
   * - `\n` produces a line break.
   * - `**bold**` renders a run in bold.
   * - `_italic_` renders a run in italic.
   * - The two compose: `**_both_**`.
   */
  text: string;
  /**
   * Pixel offset from the anchor to the label's reference position.
   * Positive `x` = right, positive `y` = down (screen-space).
   */
  offset: { x: number; y: number };
  /** Text and pointer-line color. Defaults to `currentColor`. */
  color?: string;
  /** Font size in pixels. Default: 13 (matches axis labels). */
  fontSize?: number;
  /**
   * Base font weight applied to all non-bold runs. Default: `"normal"`
   * (matches axis labels). `**bold**` runs in `text` always render at
   * weight 700.
   */
  fontWeight?: string | number;
  /**
   * Halo (stroke) color drawn behind the text so the label stays legible
   * against busy chart elements. Defaults to `var(--color-bg-0, #fff)` so
   * it matches the page background out of the box.
   */
  haloColor?: string;
  /** Halo stroke width in pixels. Default: 3. */
  haloWidth?: number;
  /**
   * SVG text-anchor for the label. When omitted, derived from the sign of
   * `offset.x`: positive → `start`, negative → `end`, zero → `middle`.
   */
  textAnchor?: "start" | "middle" | "end";
  /** Pointer-line color override. Defaults to `color`. */
  lineColor?: string;
  /** Pointer-line width in pixels. Default: 1. */
  lineWidth?: number;
  /**
   * Pointer shape. `"curved"` (default) draws a quarter-arc that emerges
   * vertically from the anchor and lands horizontally at the label.
   * `"straight"` draws a single straight line from the anchor to the
   * label. `"none"` omits the pointer entirely — just the text label is
   * rendered. When the offset is purely horizontal or vertical (and
   * `pointer` isn't `"none"`), the pointer is always straight regardless
   * of this setting.
   */
  pointer?: "curved" | "straight" | "none";
  /**
   * Whether to draw a small filled triangle at the anchor end of the
   * pointer line. Defaults to `true`. Set to `false` for an
   * uncapped line.
   */
  arrow?: boolean;
}
