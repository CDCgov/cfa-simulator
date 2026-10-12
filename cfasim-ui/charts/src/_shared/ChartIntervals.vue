<script setup lang="ts">
import { computed } from "vue";
import {
  intervalGeometry,
  resolveIntervalStyle,
  type ChartInterval,
  type IntervalGeometry,
  type IntervalStyle,
  type ResolvedIntervalStyle,
} from "./intervals.js";

const props = withDefaults(
  defineProps<{
    intervals?: readonly ChartInterval[];
    /** Chart-level style defaults, applied under each interval's own. */
    defaults?: IntervalStyle;
    /**
     * Project a data-space `(x, value)` to pixels. Return `null` to
     * drop the interval (e.g. its series is hidden).
     */
    project: (
      interval: ChartInterval,
      value: number,
    ) => { x: number; y: number } | null;
    /** Fallback color when neither the interval nor `defaults` sets one. */
    colorFor?: (interval: ChartInterval) => string | undefined;
  }>(),
  {
    intervals: () => [],
    defaults: undefined,
    colorFor: undefined,
  },
);

interface RenderedInterval extends IntervalGeometry {
  style: ResolvedIntervalStyle;
  dot?: { x: number; y: number };
}

const items = computed<RenderedInterval[]>(() => {
  const out: RenderedInterval[] = [];
  for (const iv of props.intervals) {
    if (!isFinite(iv.x) || !isFinite(iv.lower) || !isFinite(iv.upper)) {
      continue;
    }
    const lo = props.project(iv, Math.min(iv.lower, iv.upper));
    const hi = props.project(iv, Math.max(iv.lower, iv.upper));
    if (!lo || !hi) continue;
    if (![lo.x, lo.y, hi.x, hi.y].every(isFinite)) continue;
    const style = resolveIntervalStyle(
      iv,
      props.defaults,
      props.colorFor?.(iv),
    );
    let dot: RenderedInterval["dot"];
    if (style.dot && iv.value !== undefined && isFinite(iv.value)) {
      const p = props.project(iv, iv.value);
      if (p && isFinite(p.x) && isFinite(p.y)) dot = p;
    }
    out.push({ ...intervalGeometry(lo, hi, style.capWidth), style, dot });
  }
  return out;
});
</script>

<template>
  <g class="chart-intervals" pointer-events="none">
    <g
      v-for="(item, i) in items"
      :key="i"
      data-testid="interval"
      :stroke-opacity="item.style.opacity"
      :fill-opacity="item.style.opacity"
      :style="
        item.style.blendMode
          ? { mixBlendMode: item.style.blendMode }
          : undefined
      "
    >
      <!-- Outline pass: whisker and caps in the page color at a wider stroke. -->
      <template v-if="item.style.outlineWidth > 0">
        <line
          v-bind="item.line"
          class="interval-outline"
          :stroke="item.style.outlineColor"
          :stroke-width="item.style.lineWidth + item.style.outlineWidth"
          stroke-linecap="round"
        />
        <line
          v-for="(cap, c) in item.caps"
          :key="'oc' + c"
          v-bind="cap"
          class="interval-outline"
          :stroke="item.style.outlineColor"
          :stroke-width="item.style.lineWidth + item.style.outlineWidth"
          stroke-linecap="round"
        />
      </template>
      <line
        v-bind="item.line"
        class="interval-line"
        :stroke="item.style.color"
        :stroke-width="item.style.lineWidth"
        :stroke-dasharray="item.style.lineDash"
        stroke-linecap="butt"
      />
      <line
        v-for="(cap, c) in item.caps"
        :key="'c' + c"
        v-bind="cap"
        class="interval-cap"
        :stroke="item.style.color"
        :stroke-width="item.style.lineWidth"
        stroke-linecap="butt"
      />
      <circle
        v-if="item.dot"
        class="interval-dot"
        :cx="item.dot.x"
        :cy="item.dot.y"
        :r="item.style.dotRadius"
        :fill="item.style.dotFill"
        :stroke="item.style.dotStroke ?? 'none'"
        :stroke-width="item.style.dotStrokeWidth"
      />
    </g>
  </g>
</template>
