/**
 * Shared grid-line styling for LineChart and BarChart. A per-axis grid
 * prop (`xGrid`, `yGrid`, `valueGrid`) is either a boolean or a
 * `GridStyle`; the chart-level `gridStyle` supplies defaults under it.
 */

/** Named dash patterns, scaled to the line width. */
export type GridLineStyle = "solid" | "dashed" | "dotted";

/**
 * Visual styling for one axis' grid lines. Every field is optional: a
 * value on the axis prop wins over the chart's `gridStyle`, which wins
 * over the defaults listed here.
 */
export interface GridStyle {
  /** Stroke color. Default: `currentColor`. */
  color?: string;
  /** Stroke opacity. Default: 0.1. */
  opacity?: number;
  /** Stroke width in pixels. Default: 1. */
  lineWidth?: number;
  /**
   * Named dash pattern. `"dashed"` and `"dotted"` scale with
   * `lineWidth`; `"dotted"` draws round dots. Default: `"solid"`.
   * Ignored when `lineDash` is set.
   */
  lineStyle?: GridLineStyle;
  /**
   * Explicit SVG `stroke-dasharray`: the raw string form (`"4 4"`), a
   * single number (uniform dash/gap), or an array of numbers. Overrides
   * `lineStyle`.
   */
  lineDash?: string | number | readonly number[];
}

/** Defaults applied after the axis prop and chart-level styles. */
export const GRID_DEFAULTS = {
  color: "currentColor",
  opacity: 0.1,
  lineWidth: 1,
  lineStyle: "solid",
} as const;

/** Fully-resolved style for one axis' grid lines. */
export interface ResolvedGridStyle {
  color: string;
  opacity: number;
  lineWidth: number;
  lineDash?: string;
  lineCap: "butt" | "round";
}

export function gridDash(
  lineStyle: GridLineStyle,
  lineDash: GridStyle["lineDash"],
  lineWidth: number,
): Pick<ResolvedGridStyle, "lineDash" | "lineCap"> {
  if (lineDash !== undefined) {
    const dash =
      typeof lineDash === "number"
        ? `${lineDash} ${lineDash}`
        : typeof lineDash === "string"
          ? lineDash
          : lineDash.join(" ");
    return { lineDash: dash, lineCap: "butt" };
  }
  const w = Math.max(lineWidth, 0.5);
  switch (lineStyle) {
    case "dashed":
      return { lineDash: `${4 * w} ${4 * w}`, lineCap: "butt" };
    case "dotted":
      // Zero-length dashes with round caps render as dots one line width
      // across, spaced two widths apart.
      return { lineDash: `0 ${3 * w}`, lineCap: "round" };
    default:
      return { lineDash: undefined, lineCap: "butt" };
  }
}

/**
 * Resolve an axis grid prop against the chart-level style. Returns
 * `null` when the grid is off (`false` or unset).
 */
export function resolveGridStyle(
  own: boolean | GridStyle | undefined,
  chart: GridStyle | undefined,
): ResolvedGridStyle | null {
  if (!own) return null;
  const o: GridStyle = own === true ? {} : own;
  const pick = <K extends keyof GridStyle>(k: K): GridStyle[K] =>
    o[k] !== undefined ? o[k] : chart?.[k];
  const lineWidth = pick("lineWidth") ?? GRID_DEFAULTS.lineWidth;
  return {
    color: pick("color") ?? GRID_DEFAULTS.color,
    opacity: pick("opacity") ?? GRID_DEFAULTS.opacity,
    lineWidth,
    ...gridDash(
      pick("lineStyle") ?? GRID_DEFAULTS.lineStyle,
      pick("lineDash"),
      lineWidth,
    ),
  };
}
