import { ref, watch, onMounted, onUnmounted, type Ref } from "vue";

export interface ChartSizeOptions {
  /** Fallback width when measurement is not yet available. */
  fallbackWidth?: number;
  /** Optional debounce in ms applied to ResizeObserver updates. */
  debounce?: () => number | undefined;
  /**
   * Whether the chart is expanded. Its container then has a size of its
   * own, and `measuredHeight` follows it.
   */
  isFullscreen?: () => boolean;
}

/**
 * Measures the room a chart has: the width always, the height only while
 * expanded.
 *
 * Inline, the container's height follows the chart inside it. Observing
 * it there means a new width that changes the chart's height (section
 * labels taking another row, a CSS reset rescaling the stale svg) resizes
 * the observed box again from inside the callback, which the browser
 * reports as a ResizeObserver loop error. So the width comes from
 * `widthProbeRef`, an empty element in the container that is pinned to
 * the container's content width and, being empty, is always zero high.
 */
export function useChartSize(opts: ChartSizeOptions = {}) {
  const containerRef = ref<HTMLElement | null>(null);
  const widthProbeRef = ref<HTMLElement | null>(null);
  const measuredWidth = ref(0);
  const measuredHeight = ref(0);
  let observer: ResizeObserver | null = null;
  let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

  function observedElement(): HTMLElement | null {
    const container = containerRef.value;
    const probe = widthProbeRef.value;
    if (!container || !probe || opts.isFullscreen?.()) return container;
    // Without the chart stylesheet the container is not positioned, and
    // the probe would span some ancestor instead.
    const isPinned = getComputedStyle(container).position !== "static";
    return isPinned ? probe : container;
  }

  function observe() {
    const element = observedElement();
    if (!observer || !element) return;
    observer.disconnect();
    observer.observe(element);
  }

  onMounted(() => {
    if (!containerRef.value) return;
    if (widthProbeRef.value) {
      // Out of flow, so the probe spans the container whatever `display` a
      // consumer's class gives it (in flow it is zero wide in a flex row,
      // and a grid track would hold it at the svg's width). Inheriting the
      // container's inline padding makes its content box the container's.
      widthProbeRef.value.style.cssText =
        "position:absolute;inset:0 0 auto;padding-inline:inherit";
    }
    measuredWidth.value = containerRef.value.clientWidth;
    observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const apply = () => {
        measuredWidth.value = entry.contentRect.width;
        if (entry.target === containerRef.value) {
          measuredHeight.value = entry.contentRect.height;
        }
      };
      const debounce = opts.debounce?.();
      if (debounce) {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(apply, debounce);
      } else {
        apply();
      }
    });
    observe();
  });

  // After the DOM update, so the container is measured in its new place.
  watch(() => opts.isFullscreen?.(), observe, { flush: "post" });

  onUnmounted(() => {
    observer?.disconnect();
    if (resizeTimeout) clearTimeout(resizeTimeout);
  });

  return {
    containerRef,
    widthProbeRef,
    measuredWidth,
    measuredHeight,
  } as {
    containerRef: Ref<HTMLElement | null>;
    widthProbeRef: Ref<HTMLElement | null>;
    measuredWidth: Ref<number>;
    measuredHeight: Ref<number>;
  };
}
