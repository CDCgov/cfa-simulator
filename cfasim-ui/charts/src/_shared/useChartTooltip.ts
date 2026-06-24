import { ref, computed, watch, type Ref } from "vue";
import { placeTooltip, type TooltipClamp } from "../tooltip-position.js";

export interface ChartTooltipOptions {
  /** Whether tooltip interactions are wired up at all. */
  enabled: () => boolean;
  /** Tooltip activation mode. */
  trigger?: () => "hover" | "click" | undefined;
  /** Boundary for tooltip flip/clamp. */
  clamp?: () => TooltipClamp;
  /**
   * Maps a client (x, y) pointer location to a data index, or null when
   * the pointer is outside the chart. Most charts only need `clientX`
   * (categorical or x-indexed), but horizontal bar charts also need
   * `clientY`.
   */
  pointerToIndex: (clientX: number, clientY: number) => number | null;
  /** The chart's container element (used to compute relative position). */
  containerRef: Ref<HTMLElement | null>;
  /** Pointer-vertical offset applied for touch interactions. */
  touchYOffset?: number;
  /**
   * Axis a finger drags *along* to scrub the tooltip. On touch, a drag in
   * the orthogonal direction is left to the browser so the page can still
   * scroll. Defaults to `"x"` (horizontal scrub, vertical page scroll) —
   * correct for time-series line charts and vertical bar charts.
   */
  scrubAxis?: () => "x" | "y";
  /**
   * Emit hover events. The first arg is `{ index }` while hovering and
   * `null` when leaving.
   */
  onHover?: (payload: { index: number } | null) => void;
}

/**
 * Shared tooltip state + pointer/touch handlers used by chart components.
 * The caller wires the returned `handlers` to its hit-test overlay and
 * places the floating tooltip with `tooltipPos`.
 */
export function useChartTooltip(opts: ChartTooltipOptions) {
  const TOUCH_Y_OFFSET = opts.touchYOffset ?? 50;
  // Pixels a finger must travel before we commit a touch drag to either
  // scrubbing the tooltip or scrolling the page.
  const TOUCH_SLOP = 10;
  const hoverIndex = ref<number | null>(null);
  const isTouching = ref(false);
  const tooltipRef = ref<HTMLElement | null>(null);
  const pointer = ref<{ clientX: number; clientY: number } | null>(null);
  const tooltipPos = ref<{ left: number; top: number } | null>(null);

  // Touch-gesture tracking (plain locals — they don't drive rendering).
  // "pending" until the drag direction is known; then "scrub" (we own the
  // gesture and move the tooltip) or "scroll" (the browser scrolls the page).
  let touchStart: { x: number; y: number } | null = null;
  let touchMode: "pending" | "scrub" | "scroll" = "pending";

  function pointerFromEvent(
    event: MouseEvent | TouchEvent,
  ): { clientX: number; clientY: number } | null {
    if ("touches" in event) {
      return event.touches[0] ?? null;
    }
    return event;
  }

  function updateHover(event: MouseEvent | TouchEvent) {
    const pt = pointerFromEvent(event);
    if (!pt) return;
    const idx = opts.pointerToIndex(pt.clientX, pt.clientY);
    if (idx === null) return;
    hoverIndex.value = idx;
    pointer.value = { clientX: pt.clientX, clientY: pt.clientY };
    opts.onHover?.({ index: idx });
  }

  watch(
    [pointer, hoverIndex],
    () => {
      if (hoverIndex.value === null || !pointer.value) {
        tooltipPos.value = null;
        return;
      }
      const el = tooltipRef.value;
      const container = opts.containerRef.value;
      if (!el || !container) return;
      const rect = container.getBoundingClientRect();
      const offset = isTouching.value ? TOUCH_Y_OFFSET : 0;
      const clamp = opts.clamp?.() ?? "chart";
      const { left, top } = placeTooltip(
        pointer.value.clientX,
        pointer.value.clientY - offset,
        el.offsetWidth,
        el.offsetHeight,
        clamp,
        rect,
      );
      tooltipPos.value = { left: left - rect.left, top: top - rect.top };
    },
    { flush: "post" },
  );

  function onMouseMove(event: MouseEvent) {
    if (!opts.enabled()) return;
    updateHover(event);
  }

  function onMouseLeave() {
    if (!opts.enabled()) return;
    if (opts.trigger?.() !== "click") {
      hoverIndex.value = null;
      opts.onHover?.(null);
    }
  }

  function onClick(event: MouseEvent) {
    if (!opts.enabled()) return;
    if (opts.trigger?.() !== "click") return;
    const pt = pointerFromEvent(event);
    if (!pt) return;
    const idx = opts.pointerToIndex(pt.clientX, pt.clientY);
    if (idx === null) return;
    hoverIndex.value = hoverIndex.value === idx ? null : idx;
    opts.onHover?.(hoverIndex.value !== null ? { index: idx } : null);
  }

  function onTouchStart(event: TouchEvent) {
    if (!opts.enabled()) return;
    const pt = pointerFromEvent(event);
    if (!pt) return;
    // Don't preventDefault here: that would cancel the browser's scroll for
    // the whole gesture before we know its direction. We decide on the
    // first move instead. (`touch-action` on the overlay caps which
    // direction the browser may still claim.)
    touchStart = { x: pt.clientX, y: pt.clientY };
    touchMode = "pending";
    isTouching.value = true;
    updateHover(event);
  }

  function onTouchMove(event: TouchEvent) {
    if (!opts.enabled()) return;
    // The page owns this gesture — let it scroll, leave the tooltip hidden.
    if (touchMode === "scroll") return;

    if (touchMode === "pending") {
      const pt = pointerFromEvent(event);
      if (!pt || !touchStart) return;
      const dx = Math.abs(pt.clientX - touchStart.x);
      const dy = Math.abs(pt.clientY - touchStart.y);
      if (dx + dy < TOUCH_SLOP) {
        // Too small to classify — track under the finger, but don't yet
        // preventDefault so the browser can still start a scroll.
        updateHover(event);
        return;
      }
      const scrubAxis = opts.scrubAxis?.() ?? "x";
      const isScrub = scrubAxis === "x" ? dx >= dy : dy >= dx;
      if (!isScrub) {
        // Drag is across the scrub axis — hand the gesture to the browser.
        touchMode = "scroll";
        hoverIndex.value = null;
        opts.onHover?.(null);
        return;
      }
      touchMode = "scrub";
    }

    // Scrubbing: we own the gesture, so suppress the native scroll.
    event.preventDefault();
    updateHover(event);
  }

  function onTouchEnd() {
    if (!opts.enabled()) return;
    isTouching.value = false;
    touchStart = null;
    touchMode = "pending";
    hoverIndex.value = null;
    opts.onHover?.(null);
  }

  // Note: when binding via `v-on="handlers"`, Vue expects event names
  // *without* the `on` prefix. The touch handlers call `preventDefault`
  // internally (only while scrubbing), so the overlay must NOT bind them
  // passively, and should set `touch-action` to the scroll direction it
  // wants to keep (e.g. `pan-y` when `scrubAxis` is `"x"`).
  const handlers = {
    mousemove: onMouseMove,
    mouseleave: onMouseLeave,
    click: onClick,
    touchstart: onTouchStart,
    touchmove: onTouchMove,
    touchend: onTouchEnd,
  };

  return {
    hoverIndex,
    isTouching,
    pointer,
    tooltipRef,
    tooltipPos,
    handlers,
  };
}
