<script setup lang="ts">
import { computed, watch } from "vue";
import LineChart from "../LineChart/LineChart.vue";
import BarChart from "../BarChart/BarChart.vue";
import { vegaLiteToChart, type VegaLiteSpec } from "./vegaLite.js";

export interface VegaLiteChartProps {
  /** A Vega-Lite spec, in the subset the translator supports. */
  spec: VegaLiteSpec;
  /** Rows to plot. Wins over the spec's inline `data.values`. */
  data?: readonly Record<string, unknown>[];
  /**
   * Render nothing and emit `error` for the first unsupported piece of the
   * spec, instead of warning about it and rendering the rest.
   */
  strict?: boolean;
}

const props = defineProps<VegaLiteChartProps>();

const emit = defineEmits<{
  (e: "warnings", warnings: string[]): void;
  (e: "error", error: Error): void;
}>();

// Other attributes are chart props (`zoom`, `legend-toggle`, ...), merged
// over the translated ones.
defineOptions({ inheritAttrs: false });

const result = computed(() => {
  try {
    return vegaLiteToChart(props.spec, {
      data: props.data,
      strict: props.strict,
    });
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e));
  }
});

// Report only when the outcome changes, not on every re-translation (new
// data rows, or a spec literal rebuilt on each parent render).
const outcome = computed(() => {
  const r = result.value;
  return r instanceof Error ? `error:${r.message}` : r.warnings.join("\n");
});

watch(
  outcome,
  () => {
    const r = result.value;
    if (r instanceof Error) {
      // Under strict this is the expected way to refuse a spec; otherwise
      // the translator failed, and the empty chart needs an explanation.
      if (!props.strict) console.error("[VegaLiteChart]", r);
      emit("error", r);
      return;
    }
    if (r.warnings.length) {
      console.warn(`[VegaLiteChart] ${r.warnings.join("\n")}`);
    }
    emit("warnings", r.warnings);
  },
  { immediate: true },
);

const chart = computed(() =>
  result.value instanceof Error ? null : result.value,
);
</script>

<template>
  <component
    :is="chart.component === 'BarChart' ? BarChart : LineChart"
    v-if="chart"
    v-bind="{ ...chart.props, ...$attrs }"
  >
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </component>
</template>
