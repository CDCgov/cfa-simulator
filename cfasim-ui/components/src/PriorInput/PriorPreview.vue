<script setup lang="ts">
import { computed } from "vue";
import { densityCurve } from "./density";
import { priorLabel, type PriorSpec } from "./distributions";

// Density sparkline for a prior. Renders nothing when the family is unknown
// or the parameters give a non-finite curve.
const props = defineProps<{ spec: PriorSpec }>();

const WIDTH = 120;
const HEIGHT = 32;
const TOP_PAD = 1.5;

const paths = computed(() => {
  const curve = densityCurve(props.spec);
  if (!curve) return undefined;
  const { xs, ys } = curve;
  let max = 0;
  for (const y of ys) if (y > max) max = y;
  const x0 = xs[0];
  const span = xs[xs.length - 1] - x0;
  if (!(max > 0) || !(span > 0)) return undefined;
  const points: string[] = [];
  for (let i = 0; i < xs.length; i++) {
    const px = ((xs[i] - x0) / span) * WIDTH;
    const py = HEIGHT - (ys[i] / max) * (HEIGHT - TOP_PAD);
    points.push(`${px.toFixed(2)},${py.toFixed(2)}`);
  }
  const line = `M${points.join("L")}`;
  return { line, area: `${line}L${WIDTH},${HEIGHT}L0,${HEIGHT}Z` };
});
</script>

<template>
  <svg
    v-if="paths"
    class="prior-preview"
    role="img"
    :aria-label="priorLabel(spec)"
    :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
    preserveAspectRatio="none"
  >
    <path class="prior-preview-area" :d="paths.area" />
    <path
      class="prior-preview-line"
      :d="paths.line"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>

<style scoped>
.prior-preview {
  display: block;
  width: 100%;
  height: 2.5em;
  color: var(--color-primary);
  overflow: visible;
}

.prior-preview-area {
  fill: currentColor;
  opacity: 0.25;
}

.prior-preview-line {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linejoin: round;
}
</style>
