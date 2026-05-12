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
  const hoverIndex = ref<number | null>(null);
  const isTouching = ref(false);
  const tooltipRef = ref<HTMLElement | null>(null);
  const pointer = ref<{ clientX: number; clientY: number } | null>(null);
  const tooltipPos = ref<{ left: number; top: number } | null>(null);

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
    event.preventDefault();
    isTouching.value = true;
    updateHover(event);
  }

  function onTouchMove(event: TouchEvent) {
    if (!opts.enabled()) return;
    event.preventDefault();
    updateHover(event);
  }

  function onTouchEnd() {
    if (!opts.enabled()) return;
    isTouching.value = false;
    hoverIndex.value = null;
    opts.onHover?.(null);
  }

  // Note: when binding via `v-on="handlers"`, Vue expects event names
  // *without* the `on` prefix. Touch events default to passive in some
  // contexts; consumers using touch overlays should still bind the
  // touch handlers individually with `.prevent`.
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
