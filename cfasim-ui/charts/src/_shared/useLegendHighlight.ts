import { computed, ref } from "vue";
import type { ChartInterval } from "./intervals.js";

/** Opacity of every mark outside the highlighted legend label. */
export const LEGEND_DIM_OPACITY = 0.15;

export interface LegendHighlightOptions {
  /** Whether hovering dims the other marks; the event fires regardless. */
  enabled: () => boolean | undefined;
  /** The chart's `legendToggle`: its buttons report hover when set. */
  toggle: () => boolean | string | undefined;
  /** Whether a label's marks are hidden, so highlighting it fades nothing. */
  isHidden: (label: string) => boolean;
  /** Legend label of the series at an index, for marks tied to one. */
  seriesLabel: (index: number) => string | undefined;
  onChange: (label: string | null) => void;
}

/**
 * The legend label under the pointer (or focused toggle button), and the
 * opacity each mark takes while one is: `undefined` leaves a mark as it
 * is, `LEGEND_DIM_OPACITY` fades the rest, unlabeled marks included.
 * `dimForSeries` does the same for a mark that knows only its series
 * index (intervals, sections, bars), or no series at all.
 */
export function useLegendHighlight(opts: LegendHighlightOptions) {
  const highlighted = ref<string | null>(null);

  /** Svg hit rects behind the legend items; toggle buttons otherwise. */
  const hitTargets = computed(() => !!opts.enabled() && !opts.toggle());

  function setHighlight(label: string | null) {
    if (label === highlighted.value) return;
    highlighted.value = label;
    opts.onChange(label);
  }

  function dimFor(label: string | undefined): number | undefined {
    const current = highlighted.value;
    if (!opts.enabled() || current === null || opts.isHidden(current)) {
      return undefined;
    }
    return label === current ? undefined : LEGEND_DIM_OPACITY;
  }

  function dimForSeries(index: number | undefined): number | undefined {
    return dimFor(index != null ? opts.seriesLabel(index) : undefined);
  }

  // A stable function, so ChartIntervals' props keep their identity.
  const dimForInterval = (iv: ChartInterval) => dimForSeries(iv.seriesIndex);

  return {
    highlighted,
    hitTargets,
    setHighlight,
    dimFor,
    dimForSeries,
    dimForInterval,
  };
}
