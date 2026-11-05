/**
 * Geometry of the inline color-scale legend (title, min label, gradient
 * ramp, max label) shared by LineChart's `colorScale` and Heatmap.
 */

export const RAMP_WIDTH = 64;
export const RAMP_HEIGHT = 8;
export const RAMP_GAP = 4;
/** Gap between the scale's title and its min label. */
export const RAMP_LABEL_GAP = 6;

export interface ColorScaleLegendLayout {
  /** Legend title, empty when the scale has no label. */
  label: string;
  min: string;
  max: string;
  /** X offsets of the parts from the item's left edge. */
  minX: number;
  rampX: number;
  maxX: number;
  rampWidth: number;
  /** Full width of the item, for legend row flow. */
  width: number;
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
  rampWidth = RAMP_WIDTH,
): ColorScaleLegendLayout {
  const title = label ?? "";
  const minX = title ? textWidth(title) + RAMP_LABEL_GAP : 0;
  const rampX = minX + textWidth(min) + RAMP_GAP;
  const maxX = rampX + rampWidth + RAMP_GAP;
  return {
    label: title,
    min,
    max,
    minX,
    rampX,
    maxX,
    rampWidth,
    width: maxX + textWidth(max),
  };
}
