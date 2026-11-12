/**
 * Geometry of the inline color-scale legend (title, min label, gradient
 * ramp, max label, and an optional middle label under the ramp) shared by
 * LineChart's `colorScale` and Heatmap.
 */

export const RAMP_WIDTH = 64;
export const RAMP_HEIGHT = 8;
export const RAMP_GAP = 4;
/** Gap between the scale's title and its min label. */
export const RAMP_LABEL_GAP = 6;
/**
 * Height the middle label adds below the legend row: it hangs under the
 * ramp, past the row's own bottom edge.
 */
export const RAMP_MID_LABEL_HEIGHT = 12;

export interface ColorScaleLegendLayout {
  /** Legend title, empty when the scale has no label. */
  label: string;
  min: string;
  max: string;
  /** X offsets of the parts from the item's left edge. */
  minX: number;
  rampX: number;
  maxX: number;
  /** Label of the domain's middle value, centered under the ramp. */
  mid?: string;
  /** Center of the middle label from the item's left edge. */
  midX?: number;
  rampWidth: number;
  /** Full width of the item, for legend row flow. */
  width: number;
}

export interface ColorScaleLegendOptions {
  /**
   * Label for the middle of the ramp, e.g. the neutral value of a
   * diverging scale. The caller reserves `RAMP_MID_LABEL_HEIGHT` below
   * the row for it.
   */
  mid?: string;
  rampWidth?: number;
}

/**
 * Lay the legend's parts out left to right from their measured text
 * widths. `textWidth` measures in the legend font (see `measureText`).
 */
export function layoutColorScaleLegend(
  label: string | undefined,
  min: string,
  max: string,
  textWidth: (text: string) => number,
  options: ColorScaleLegendOptions = {},
): ColorScaleLegendLayout {
  const rampWidth = options.rampWidth ?? RAMP_WIDTH;
  const title = label ?? "";
  const minX = title ? textWidth(title) + RAMP_LABEL_GAP : 0;
  const rampX = minX + textWidth(min) + RAMP_GAP;
  const maxX = rampX + rampWidth + RAMP_GAP;
  const layout: ColorScaleLegendLayout = {
    label: title,
    min,
    max,
    minX,
    rampX,
    maxX,
    rampWidth,
    width: maxX + textWidth(max),
  };
  if (options.mid !== undefined) {
    const midX = rampX + rampWidth / 2;
    layout.mid = options.mid;
    layout.midX = midX;
    // A middle label wider than the ramp can reach past the max label.
    layout.width = Math.max(layout.width, midX + textWidth(options.mid) / 2);
  }
  return layout;
}
