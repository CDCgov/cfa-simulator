/** Plot edges, `true` where the zoom window does not cut through the data. */
export interface PlotClipEdges {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

/**
 * Room, in px, left outside an open plot edge for marks that straddle it:
 * dots and whisker caps on the extreme points. Nothing else can reach past
 * an edge no data crosses.
 */
export const PLOT_CLIP_OVERHANG = 24;

export interface PlotClipRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The clip rectangle for the plot while zoomed. An edge the window cuts
 * through clips exactly, so marks continuing past it stop at the plot
 * boundary. An edge that coincides with the visible data's own boundary
 * is `open` and clips `overhang` px further out, which keeps the marks
 * on the extreme points whole, as they are when not zoomed.
 */
export function plotClipRect(
  padding: { top: number; left: number },
  innerW: number,
  innerH: number,
  open?: Partial<PlotClipEdges>,
  overhang = PLOT_CLIP_OVERHANG,
): PlotClipRect {
  const top = open?.top ? overhang : 0;
  const right = open?.right ? overhang : 0;
  const bottom = open?.bottom ? overhang : 0;
  const left = open?.left ? overhang : 0;
  return {
    x: padding.left - left,
    y: padding.top - top,
    width: innerW + left + right,
    height: innerH + top + bottom,
  };
}
