import { onBeforeUnmount, ref, type Ref } from "vue";

/** Pixels the pointer must travel before a press becomes a brush. */
const MIN_BRUSH_PX = 4;

/**
 * In box mode, a drag shorter than this across the main axis is read as a
 * band (main axis only), so a roughly straight drag doesn't have to be
 * pixel-perfect to avoid a sliver of a box.
 */
const MIN_BOX_CROSS_PX = 24;

/** Rectangle in pixels relative to the origin element. */
export interface BrushRect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface BrushBox extends BrushRect {
  /**
   * True when the brush selects along the main axis only; the rectangle
   * then spans the full plot on the cross axis.
   */
  band: boolean;
}

export interface BrushMode {
  /** Axis a drag always selects along. */
  axis: "x" | "y";
  /** Also select on the cross axis once the drag is tall/wide enough. */
  box: boolean;
}

export interface ChartBrushOptions {
  /** Current brush behavior, or null when brushing is off. */
  mode: () => BrushMode | null;
  /** Element whose top-left is the origin of the returned pixel values. */
  originRef: Ref<Element | null>;
  /** Pixel bounds of the plot; the brush is clamped to them. */
  bounds: () => BrushRect;
  /** Fired once per drag, when the press first becomes a brush. */
  onStart?: () => void;
  /** Fired on release with the brushed rectangle. */
  onSelect: (box: BrushBox) => void;
}

/**
 * Click-and-drag selection over a chart's plot area. Mouse only: touch
 * and pen drags stay with tooltip scrubbing and page scroll (the overlay's
 * `touch-action` lets the browser claim them for panning).
 */
export function useChartBrush(opts: ChartBrushOptions) {
  const selection = ref<BrushBox | null>(null);
  let cleanup: (() => void) | null = null;
  let swallowClick = false;

  function pointerPos(e: PointerEvent): { x: number; y: number } {
    const rect = opts.originRef.value?.getBoundingClientRect();
    const b = opts.bounds();
    return {
      x: Math.min(b.x1, Math.max(b.x0, e.clientX - (rect?.left ?? 0))),
      y: Math.min(b.y1, Math.max(b.y0, e.clientY - (rect?.top ?? 0))),
    };
  }

  function onPointerDown(e: PointerEvent) {
    const mode = opts.mode();
    if (!mode) return;
    if (e.pointerType === "touch" || e.pointerType === "pen") return;
    if (e.button !== 0) return;
    cleanup?.();
    const origin = pointerPos(e);
    /** The brushed box, or null while the drag is too small to count. */
    const boxAt = (ev: PointerEvent): BrushBox | null => {
      const p = pointerPos(ev);
      const b = opts.bounds();
      const dx = Math.abs(p.x - origin.x);
      const dy = Math.abs(p.y - origin.y);
      const alongX = mode.axis === "x";
      if ((alongX ? dx : dy) < MIN_BRUSH_PX) return null;
      const band = !mode.box || (alongX ? dy : dx) < MIN_BOX_CROSS_PX;
      const spanX = alongX || !band;
      const spanY = !alongX || !band;
      return {
        x0: spanX ? Math.min(origin.x, p.x) : b.x0,
        x1: spanX ? Math.max(origin.x, p.x) : b.x1,
        y0: spanY ? Math.min(origin.y, p.y) : b.y0,
        y1: spanY ? Math.max(origin.y, p.y) : b.y1,
        band,
      };
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("keydown", onKey);
      cleanup = null;
      selection.value = null;
    };
    const move = (ev: PointerEvent) => {
      const box = boxAt(ev);
      if (box && !selection.value) opts.onStart?.();
      selection.value = box;
    };
    const finish = (ev: PointerEvent) => {
      const box = boxAt(ev);
      stop();
      if (!box) return;
      // The release also dispatches a click on the overlay; keep it from
      // toggling a click-triggered tooltip.
      swallowClick = true;
      setTimeout(() => (swallowClick = false), 0);
      opts.onSelect(box);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") stop();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("keydown", onKey);
    cleanup = stop;
  }

  onBeforeUnmount(() => cleanup?.());

  return {
    /** Live brushed rectangle while dragging, else null. */
    selection,
    onPointerDown,
    /** True when the click that follows a completed brush should be ignored. */
    shouldSwallowClick: () => swallowClick,
  };
}
