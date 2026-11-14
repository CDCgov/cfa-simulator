import { computed, inject, provide, toValue } from "vue";
import type { ComputedRef, InjectionKey, MaybeRefOrGetter } from "vue";
import type { LabelStyle, TitleStyle } from "./chartProps.js";

/**
 * Props a chart falls back to when it is not given its own, set for a
 * subtree with `provideChartDefaults`.
 */
export interface ChartDefaults {
  /** Show the tooltip on hover or click without setting it per chart. */
  tooltipTrigger?: "hover" | "click";
  titleStyle?: TitleStyle;
  axisLabelStyle?: LabelStyle;
  tickLabelStyle?: LabelStyle;
  legendStyle?: LabelStyle;
}

// A string, so two copies of this module (the vega-lite entry bundles its
// own) still share one key.
const CHART_DEFAULTS_KEY =
  "cfasim-ui:chart-defaults" as unknown as InjectionKey<
    MaybeRefOrGetter<ChartDefaults>
  >;

type StyleKey =
  "titleStyle" | "axisLabelStyle" | "tickLabelStyle" | "legendStyle";
const STYLE_KEYS: StyleKey[] = [
  "titleStyle",
  "axisLabelStyle",
  "tickLabelStyle",
  "legendStyle",
];

/** `over` on top of `base`: style objects merge key by key. */
function mergeDefaults(
  base: ChartDefaults,
  over: ChartDefaults,
): ChartDefaults {
  const merged: ChartDefaults = {
    tooltipTrigger: over.tooltipTrigger ?? base.tooltipTrigger,
  };
  for (const key of STYLE_KEYS) {
    const style =
      base[key] && over[key]
        ? { ...base[key], ...over[key] }
        : (over[key] ?? base[key]);
    if (style) Object.assign(merged, { [key]: style });
  }
  return merged;
}

/**
 * Set default props for every chart rendered below the calling component.
 * Call it in `setup`. A chart's own prop wins, and a style prop is merged
 * over the default key by key. A nested call layers over the defaults
 * provided above it. Pass a ref or getter to change them later.
 */
export function provideChartDefaults(
  defaults: MaybeRefOrGetter<ChartDefaults>,
): void {
  const outer = inject(CHART_DEFAULTS_KEY, undefined);
  provide(CHART_DEFAULTS_KEY, () =>
    mergeDefaults(toValue(outer) ?? {}, toValue(defaults)),
  );
}

/** A chart's own style and tooltip props. */
export interface ChartDefaultProps extends Omit<
  ChartDefaults,
  "tooltipTrigger"
> {
  tooltipTrigger?: "hover" | "click" | "none";
}

/**
 * A chart's props with the provided defaults applied. `tooltipTrigger:
 * "none"` opts a chart out of a provided trigger, and resolves to none.
 */
export function useChartDefaults(props: ChartDefaultProps): {
  [K in keyof ChartDefaults]-?: ComputedRef<ChartDefaults[K]>;
} {
  const provided = inject(CHART_DEFAULTS_KEY, undefined);
  const resolved = computed(() => {
    // Read only these props, so no other prop change recomputes the styles.
    const own: ChartDefaults = {};
    for (const key of STYLE_KEYS) Object.assign(own, { [key]: props[key] });
    const trigger = props.tooltipTrigger;
    if (trigger !== "none") own.tooltipTrigger = trigger;
    const merged = mergeDefaults(toValue(provided) ?? {}, own);
    if (trigger === "none") merged.tooltipTrigger = undefined;
    return merged;
  });
  return {
    tooltipTrigger: computed(() => resolved.value.tooltipTrigger),
    titleStyle: computed(() => resolved.value.titleStyle),
    axisLabelStyle: computed(() => resolved.value.axisLabelStyle),
    tickLabelStyle: computed(() => resolved.value.tickLabelStyle),
    legendStyle: computed(() => resolved.value.legendStyle),
  };
}
