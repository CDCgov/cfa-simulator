export type TooltipClamp = "none" | "chart" | "window";

const GAP = 16;
const PAD = 8;

/**
 * Computes a tooltip position in client coordinates, flipping to the opposite
 * side of the pointer and clamping vertically when the preferred placement
 * would overflow the clamp boundary.
 *
 * The tooltip is assumed to be anchored with `transform: translateY(-50%)`,
 * so `top` is the vertical center.
 */
export function placeTooltip(
  clientX: number,
  centerY: number,
  tipW: number,
  tipH: number,
  clamp: TooltipClamp,
  chartRect?: DOMRect,
): { left: number; top: number } {
  if (clamp === "none") {
    return { left: clientX + GAP, top: centerY };
  }

  const bounds =
    clamp === "chart" && chartRect
      ? {
          left: chartRect.left,
          right: chartRect.right,
          top: chartRect.top,
          bottom: chartRect.bottom,
        }
      : {
          left: 0,
          right: window.innerWidth,
          top: 0,
          bottom: window.innerHeight,
        };

  const flip = clientX + GAP + tipW > bounds.right - PAD;
  const left = flip ? clientX - GAP - tipW : clientX + GAP;
  const halfH = tipH / 2;
  const top = Math.min(
    Math.max(centerY, bounds.top + PAD + halfH),
    bounds.bottom - PAD - halfH,
  );
  return { left, top };
}
