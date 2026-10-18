import type { BlendMode } from "./chartProps.js";

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
   * Color of the legibility outline drawn behind the text, pointer/rule
   * line, and arrow tip. Defaults to `var(--color-bg-0, #fff)` so it
   * matches the page background out of the box.
   */
  outlineColor?: string;
  /**
   * Outline stroke width in pixels. Applied to the text (via paint-order
   * stroke), and added to `lineWidth` for the pointer/rule line and
   * arrow tip outline pass. Set to `0` to disable the outline. Default: 3.
   */
  outlineWidth?: number;
  /**
   * Outline color for the text only. Defaults to `outlineColor`, so the
   * text halo and the line halo can be set apart (say, a white text halo
   * over a line with no outline).
   */
  textOutlineColor?: string;
  /**
   * Outline stroke width for the text only, in pixels. Defaults to
   * `outlineWidth`. Set to `0` to outline the line but not the text.
   */
  textOutlineWidth?: number;
  /**
   * Rotation of the label in degrees, clockwise, about its reference
   * position (the anchor plus `offset`). `-90` reads bottom to top,
   * which suits a label beside a `"ruleX"` line. Rotated text keeps to
   * the side of its position facing away from the anchor, so with
   * `rotate: -90` an `offset.x` of `6` sits just right of a vertical
   * rule and `-6` just left. `align` runs along the rotated baseline:
   * `"left"` extends the text away from the reference point in reading
   * direction. Pointer geometry is computed for unrotated text, so pair
   * rotation with a rule or `pointer: "none"`.
   */
  rotate?: number;
  /**
   * CSS `mix-blend-mode` for the whole annotation (line, arrow, text and
   * their outlines), so a label can sit over series without hiding them.
   * A light outline disappears under `"multiply"`; set `outlineWidth` or
   * `textOutlineWidth` to `0` there to avoid paying for one.
   */
  blendMode?: BlendMode;
  /**
   * Horizontal alignment of the label relative to its anchor position.
   * When omitted, derived from the sign of `offset.x`: positive →
   * `"left"`, negative → `"right"`, zero → `"center"`.
   */
  align?: "left" | "center" | "right";
  /** Pointer- or rule-line color override. Defaults to `color`. */
  lineColor?: string;
  /** Pointer- or rule-line width in pixels. Default: 1. */
  lineWidth?: number;
  /**
   * SVG `stroke-dasharray` for the pointer or rule line. Accepts the
   * raw string form (`"4 4"`), a single number (uniform dash/gap), or
   * an array of numbers. Default: solid line.
   */
  lineDash?: string | number | readonly number[];
  /**
   * Connector shape between anchor and label.
   * - `"curved"` (default): quarter-arc emerging vertically from the
   *   anchor, landing horizontally at the label.
   * - `"straight"`: single straight line from anchor to label.
   * - `"none"`: no connector — just the text label is rendered.
   * - `"ruleX"`: vertical rule at the annotation's `x` value spanning
   *   the full plot height. Label still positions via `offset`.
   * - `"ruleY"`: horizontal rule at the annotation's `y` value spanning
   *   the full plot width.
   * - `"ruleUp"`: vertical rule from the plot's bottom edge up to the
   *   anchor.
   * - `"ruleDown"`: vertical rule from the plot's top edge down to the
   *   anchor.
   * - `"ruleFromLeft"`: horizontal rule from the plot's left edge in to
   *   the anchor.
   * - `"ruleFromRight"`: horizontal rule from the plot's right edge in
   *   to the anchor.
   *
   * When the offset is purely horizontal or vertical (and `pointer`
   * isn't `"none"` or a rule), the pointer is always straight regardless
   * of this setting. Rule pointers ignore `arrow`.
   */
  pointer?:
    | "curved"
    | "straight"
    | "none"
    | "ruleX"
    | "ruleY"
    | "ruleUp"
    | "ruleDown"
    | "ruleFromLeft"
    | "ruleFromRight";
  /**
   * Whether to draw a small filled triangle at the anchor end of the
   * connector line. Defaults to `true`. Set to `false` for an
   * uncapped line. Ignored for rule pointers.
   */
  arrow?: boolean;
}
