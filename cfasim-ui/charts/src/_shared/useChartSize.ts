import { ref, onMounted, onUnmounted, type Ref } from "vue";

export interface ChartSizeOptions {
  /** Fallback width when measurement is not yet available. */
  fallbackWidth?: number;
  /** Optional debounce in ms applied to ResizeObserver updates. */
  debounce?: () => number | undefined;
}

/**
 * Watches an element ref for size changes and exposes the measured width.
 * Mirrors the per-chart ResizeObserver wiring previously inlined in each
 * chart component.
 */
export function useChartSize(opts: ChartSizeOptions = {}) {
  const containerRef = ref<HTMLElement | null>(null);
  const measuredWidth = ref(0);
  const measuredHeight = ref(0);
  let observer: ResizeObserver | null = null;
  let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

  onMounted(() => {
    if (!containerRef.value) return;
    measuredWidth.value = containerRef.value.clientWidth;
    measuredHeight.value = containerRef.value.clientHeight;
    observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const apply = () => {
        measuredWidth.value = entry.contentRect.width;
        measuredHeight.value = entry.contentRect.height;
      };
      const debounce = opts.debounce?.();
      if (debounce) {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(apply, debounce);
      } else {
        apply();
      }
    });
    observer.observe(containerRef.value);
  });

  onUnmounted(() => {
    observer?.disconnect();
    if (resizeTimeout) clearTimeout(resizeTimeout);
  });

  return {
    containerRef,
    measuredWidth,
    measuredHeight,
  } as {
    containerRef: Ref<HTMLElement | null>;
    measuredWidth: Ref<number>;
    measuredHeight: Ref<number>;
  };
}
