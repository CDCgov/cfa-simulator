---
keywords:
  [
    line,
    chart,
    time-series,
    series,
    axis,
    area,
    confidence band,
    interval,
    error bars,
    whiskers,
    calibration,
    marker,
    svg,
  ]
---

# LineChart

A responsive SVG line chart with support for multiple series, axis labels, and custom styling.

<script setup>
import { ref, computed } from "vue";

// Deterministic jitter in [-0.5, 0.5): Math.random() would redraw the
// demos on every load and mismatch the server-rendered page.
function jitter(i, t) {
  const v = Math.sin(i * 127.1 + t * 311.7) * 43758.5453;
  return v - Math.floor(v) - 0.5;
}
const trajectories = Array.from({ length: 20 }, (_, i) => ({
  data: Array.from({ length: 50 }, (_, t) =>
    Math.max(0, 30 * Math.sin(t / 8) + jitter(i, t) * 15 + i * 0.5),
  ),
  color: "#0057b7",
}));
const calibrationRuns = Array.from({ length: 30 }, (_, i) => ({
  data: Array.from({ length: 40 }, (_, t) =>
    Math.max(
      0,
      40 * Math.exp(-((t - 18 - (i % 7)) ** 2) / 90) + jitter(i, t) * 6,
    ),
  ),
  color: "#0057b7",
}));

const infections = Array.from({ length: 45 }, (_, t) =>
  120 * Math.exp(-((t - 18) ** 2) / 160),
);
const hospitalizations = Array.from({ length: 45 }, (_, t) =>
  38 * Math.exp(-((t - 24) ** 2) / 180),
);
const growthRange = ref([2, 7]);
const mitigationRange = ref([3, 9]);
const sectionDemoSeries = [
  { data: [0, 2, 5, 12, 25, 45, 70, 100, 130, 155, 170], color: "#000", strokeWidth: 1, legend: "No interventions" },
  { data: [0, 0, 0, 2, 8, 20, 40, 65, 90, 110, 120], color: "#999", strokeWidth: 1, dashed: true, legend: "Interventions" },
];
const sectionDemoSections = computed(() => [
  {
    startIndex: growthRange.value[0],
    endIndex: growthRange.value[1],
    color: "#6366f1",
    strokeWidth: 0,
    label: `Day ${growthRange.value[0]}–${growthRange.value[1]}`,
    description: "Rapid growth phase",
  },
  {
    seriesIndex: 0,
    startIndex: mitigationRange.value[0],
    endIndex: mitigationRange.value[1],
    color: "#f43f5e",
    label: `Day ${mitigationRange.value[0]}–${mitigationRange.value[1]}`,
    description: "Mitigation period",
  },
]);
const annotationOutlineOptions = [
  { value: "both", label: "Text and line" },
  { value: "text", label: "Text only" },
  { value: "line", label: "Line only" },
  { value: "none", label: "None" },
];
const annotationBlendOptions = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "difference", label: "Difference" },
];
function annotationOutline(kind) {
  if (kind === "text") return { outlineWidth: 0, textOutlineWidth: 3 };
  if (kind === "line") return { textOutlineWidth: 0 };
  if (kind === "none") return { outlineWidth: 0 };
  return {};
}

const pointerKind = ref("curved");
const pointerPosition = ref("above-right");
const pointerOutline = ref("both");
const pointerBlend = ref("normal");
const pointerArrow = ref(true);
const pointerOffsets = {
  above: { x: 0, y: -50 },
  "above-right": { x: 50, y: -36 },
  right: { x: 70, y: 0 },
  "below-right": { x: 50, y: 50 },
  below: { x: 0, y: 50 },
  "below-left": { x: -50, y: 50 },
  left: { x: -70, y: 0 },
  "above-left": { x: -50, y: -36 },
};
const pointerAnnotation = computed(() => ({
  x: 3,
  y: 15,
  offset: pointerOffsets[pointerPosition.value],
  text: "**Cluster**\n_Day 3_",
  pointer: pointerKind.value,
  arrow: pointerArrow.value,
  blendMode: pointerBlend.value,
  color: pointerBlend.value === "normal" ? undefined : "#fb7e38",
  ...annotationOutline(pointerOutline.value),
}));

const ruleKind = ref("ruleX");
const ruleSide = ref("left");
const ruleRotate = ref("-90");
const ruleDash = ref("dashed");
const ruleOutline = ref("text");
const ruleBlend = ref("normal");
const ruleAnnotation = computed(() => {
  const rotate = Number(ruleRotate.value);
  const side = ruleSide.value;
  const offset =
    side === "left"
      ? { x: -6, y: rotate ? 0 : 4 }
      : side === "right"
        ? { x: 6, y: rotate ? 0 : 4 }
        : side === "above"
          ? { x: rotate ? 0 : 4, y: -8 }
          : { x: rotate ? 0 : 4, y: rotate ? 8 : 18 };
  return {
    x: 5,
    y: 14,
    offset,
    text: "Peak day",
    pointer: ruleKind.value,
    align: rotate ? "left" : undefined,
    rotate: rotate || undefined,
    lineDash:
      ruleDash.value === "dashed"
        ? "4 3"
        : ruleDash.value === "dotted"
          ? "1 3"
          : undefined,
    blendMode: ruleBlend.value,
    color: ruleBlend.value === "normal" ? undefined : "#fb7e38",
    ...annotationOutline(ruleOutline.value),
  };
});
const fanDays = Array.from({ length: 40 }, (_, t) => t);
const fanRuns = Array.from({ length: 30 }, (_, r) =>
  fanDays.map((t) =>
    Math.round(
      (90 + 40 * Math.sin(r * 1.7)) *
        Math.exp(-((t - 18 - (r % 7)) ** 2) / (90 + 6 * (r % 5))),
    ),
  ),
);
const fanQuantile = (q) =>
  fanDays.map((t) => {
    const v = fanRuns.map((run) => run[t]).sort((a, b) => a - b);
    return v[Math.round(q * (v.length - 1))];
  });
const fanSeries = [
  ...fanRuns.map((data) => ({ data, color: "#0057b7", opacity: 0.12 })),
  {
    data: fanQuantile(0.5),
    legend: "Median",
    color: "#0057b7",
    strokeWidth: 2.5,
  },
];
const fanAreas = [
  {
    lower: fanQuantile(0.05),
    upper: fanQuantile(0.95),
    legend: "90% interval",
    color: "#0057b7",
    opacity: 0.12,
  },
];
const markerDates = Array.from(
  { length: 45 },
  (_, t) => new Date(Date.UTC(2026, 0, 1 + t)),
);
const dateMarkers = ref([
  { x: "2026-01-13", label: "Isolation", snap: true },
  { x: "2026-02-02", label: "Recovery", labelBackground: true, snap: true },
]);
const isolation = ref(12);
const recovery = ref(32);
const markers = computed({
  get: () => [
    { x: isolation.value, label: "Isolation" },
    { x: recovery.value, label: "Recovery" },
  ],
  set: ([a, b]) => {
    isolation.value = a.x;
    recovery.value = b.x;
  },
});
const styledMarkers = ref([
  {
    x: 10,
    label: "Intervention",
    color: "#ef4444",
    strokeWidth: 2,
    dashed: false,
    outline: true,
    labelStyle: { color: "#ef4444", fontSize: 13 },
    labelOutlineWidth: 4,
  },
  {
    x: 22,
    label: "Peak",
    color: "#0057b7",
    dash: "2 6",
    labelBackground: true,
  },
]);
</script>

## Data

### Single series

<ComponentDemo>
  <LineChart :data="[0, 4, 8, 15, 22, 30, 28, 20, 12, 5, 2]" :height="200" x-label="Days" y-label="Cases" tooltip-trigger="hover" />

<template #code>

```vue
<LineChart
  :data="[0, 4, 8, 15, 22, 30, 28, 20, 12, 5, 2]"
  :height="200"
  x-label="Days"
  y-label="Cases"
  tooltip-trigger="hover"
/>
```

  </template>
</ComponentDemo>

### x/y

Pass paired `x` and `y` arrays to plot points at specific x positions.
`y` is equivalent to `data` (both names are accepted), and they both
take typed arrays. For multi-series
charts, set `x` and `y` (or `data`) on each `Series`.

<ComponentDemo>
  <LineChart
    :x="[0, 1, 2, 5, 10, 20, 50]"
    :y="[0, 2, 5, 12, 22, 30, 38]"
    :height="200"
    x-label="Days (log-ish)"
    y-label="Cases"
    tooltip-trigger="hover"
  />

<template #code>

```vue
<LineChart
  :x="[0, 1, 2, 5, 10, 20, 50]"
  :y="[0, 2, 5, 12, 22, 30, 38]"
  :height="200"
  x-label="Days"
  y-label="Cases"
  tooltip-trigger="hover"
/>
```

  </template>
</ComponentDemo>

When `x` is omitted, `y`/`data` values are plotted at indices 0, 1, 2, etc.

### Multiple series

<ComponentDemo>
  <LineChart
    :series="[
      { data: [0, 10, 25, 45, 60, 55, 40, 20, 8], color: '#fb7e38', strokeWidth: 3 },
      { x: [0, 1, 3, 4, 6, 7, 8], y: [0, 5, 20, 28, 18, 10, 4], color: '#0057b7', strokeWidth: 3 },
    ]"
    :height="200"
    x-label="Weeks"
    y-label="Incidence"
  />

<template #code>

```vue
<LineChart
  :series="[
    {
      data: [0, 10, 25, 45, 60, 55, 40, 20, 8],
      color: '#fb7e38',
      strokeWidth: 3,
    },
    {
      x: [0, 1, 3, 4, 6, 7, 8],
      y: [0, 5, 20, 28, 18, 10, 4],
      color: '#0057b7',
      strokeWidth: 3,
    },
  ]"
  :height="200"
  x-label="Weeks"
  y-label="Incidence"
/>
```

  </template>
</ComponentDemo>

### Dates

Pass ISO date strings (`YYYY-MM-DD`) or `Date` objects as `x` and the
chart auto-detects a date axis: ticks anchor to year / month / week /
day / hour boundaries depending on the visible range, and labels
format themselves accordingly. Numeric `x` arrays keep their existing
behavior: auto-detection is content-driven and never promotes plain
numbers.

<ComponentDemo>
  <LineChart
    :x="['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26', '2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23', '2026-03-02', '2026-03-09']"
    :y="[4, 9, 18, 32, 41, 38, 27, 18, 11, 6]"
    :height="220"
    y-label="% ED visits"
  />

<template #code>

```vue
<LineChart
  :x="[
    '2026-01-05',
    '2026-01-12',
    '2026-01-19',
    '2026-01-26',
    '2026-02-02',
    '2026-02-09',
    '2026-02-16',
    '2026-02-23',
    '2026-03-02',
    '2026-03-09',
  ]"
  :y="[4, 9, 18, 32, 41, 38, 27, 18, 11, 6]"
  :height="220"
  y-label="% ED visits"
/>
```

  </template>
</ComponentDemo>

Override the format via `x-tick-format`. Presets: `"iso"`,
`"iso-datetime"`, `"year"`, `"month-year"`, `"month-day"`, `"day"`,
`"time"`, `"datetime"`, `"medium"`. You can also pass an
`Intl.DateTimeFormatOptions` literal, or a function `(ms, unit?) =>
string` for full control.

<ComponentDemo>
  <LineChart
    :x="['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26', '2026-02-02']"
    :y="[4, 9, 18, 32, 41]"
    x-tick-format="iso"
    :height="220"
    y-label="% ED visits"
  />

<template #code>

```vue
<LineChart
  :x="['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26', '2026-02-02']"
  :y="[4, 9, 18, 32, 41]"
  x-tick-format="iso"
  :height="220"
  y-label="% ED visits"
/>
```

  </template>
</ComponentDemo>

By default the chart parses bare `YYYY-MM-DD` (and offset-less
`YYYY-MM-DDTHH:mm:ss`) as UTC and renders tick labels in UTC. Set
`timezone="local"` to interpret offset-less strings in the browser's
timezone instead. Strings that include an explicit offset (`Z` or
`+05:00`) are always parsed exactly as written.

> **Annotations on a date axis.** `ChartAnnotation.x` is always in the
> chart's resolved coordinate space, which is **epoch-ms** when the axis
> is in date mode. Pass `Date.UTC(2026, 0, 15)`, `new Date("2026-01-15").getTime()`,
> or `Date.parse("2026-01-15T00:00:00Z")`. Passing a small integer like
> `0` will place the annotation at 1970-01-01 (off-screen).
>
> **`xLabels` on a date axis.** When both `x: [...date strings]` and
> `xLabels` are supplied, the date axis wins and `xLabels` is ignored.
> Date strings carry their own labeling.

### Typed arrays

`data`, `series[].data`, and `areas[].upper`/`lower` accept a plain
`number[]` or any standard numeric typed array (`Float64Array`,
`Int32Array`, etc.). This lets you pass the output of
`ModelOutput.column()` directly, with no `Array.from(...)` copy:

```vue
<LineChart :data="outputs.series.column('values')" />
```

```ts
type LineChartData =
  | readonly number[]
  | Float64Array
  | Float32Array
  | Int32Array
  | Uint32Array
  | Int16Array
  | Uint16Array
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray;
```

## Axes

### Custom axis ticks

Control tick placement with `x-ticks` and `y-ticks`. Pass a **number** for a fixed interval (in data units, respecting `xMin`) or an **array** of explicit values. Use `x-tick-format` / `y-tick-format` to customize labels; to reuse a d3 or Vega-Lite format string, wrap it with [`d3Format` / `d3TimeFormat`](../shared#d3format-d3timeformat) (e.g. `:y-tick-format="d3Format('.0%')"`). On a date axis the units are milliseconds: an interval steps from the first date (`7 * 86400000` is a tick every week, on the weekday the data starts), an array holds epoch-ms values, and the default label format follows the interval (days, weeks or months).

<ComponentDemo>
  <LineChart
    :data="[0, 0.12, 0.28, 0.45, 0.61, 0.74, 0.83, 0.89, 0.93, 0.96, 0.97, 0.98, 0.99, 0.99, 1.0]"
    :x-ticks="7"
    :y-ticks="[0, 0.5, 1]"
    :y-tick-format="(v) => `${(v * 100).toFixed(0)}%`"
    :x-tick-format="(v) => `day ${v}`"
    :height="220"
    x-label="Time"
    y-label="Coverage"
    x-grid
    y-grid
  />

<template #code>

```vue
<LineChart
  :data="coverage"
  :x-ticks="7"
  :y-ticks="[0, 0.5, 1]"
  :y-tick-format="(v) => `${(v * 100).toFixed(0)}%`"
  :x-tick-format="(v) => `day ${v}`"
  :height="220"
  x-label="Time"
  y-label="Coverage"
  x-grid
  y-grid
/>
```

  </template>
</ComponentDemo>

### Fixed y range

`y-min` and `y-max` set the lowest and highest values the y axis must include, so charts of the same quantity share a scale. They only widen the axis: data outside the range still extends it, nothing is clipped.

<ComponentDemo>
  <LineChart
    :data="[0.12, 0.28, 0.45, 0.61, 0.74, 0.83, 0.89]"
    :y-min="0"
    :y-max="1"
    :height="220"
    x-label="Week"
    y-label="Coverage"
    y-grid
  />

<template #code>

```vue
<LineChart
  :data="coverage"
  :y-min="0"
  :y-max="1"
  :height="220"
  x-label="Week"
  y-label="Coverage"
  y-grid
/>
```

  </template>
</ComponentDemo>

### Logarithmic y-axis

Set `y-scale-type="log"` to switch the y axis to base-10 log scaling. Useful
when data spans several orders of magnitude (e.g. epidemic case counts in
early exponential growth). Non-positive values collapse to the axis
floor, and `yMin <= 0` is ignored.

<ComponentDemo>
  <LineChart
    :data="[1, 3, 8, 22, 60, 165, 450, 1230, 3350]"
    y-scale-type="log"
    :height="220"
    x-label="Day"
    y-label="Cases"
    y-grid
  />

<template #code>

```vue
<LineChart
  :data="[1, 3, 8, 22, 60, 165, 450, 1230, 3350]"
  y-scale-type="log"
  :height="220"
  x-label="Day"
  y-label="Cases"
  y-grid
/>
```

  </template>
</ComponentDemo>

### Grid lines

Set `x-grid` / `y-grid` to draw grid lines at each axis' ticks (the
[custom ticks](#custom-axis-ticks) demo turns both on). Pass a `GridStyle` object instead of `true` to change an axis' line
weight, color, opacity, or pattern (`lineStyle: "dashed" | "dotted"`, or a
raw `lineDash`). The chart-level `grid-style` prop supplies defaults for
every grid on the chart; a field on the axis prop wins.

<ComponentDemo>
  <LineChart
    :series="[
      { data: [0, 10, 25, 45, 60, 55, 40, 20, 8], color: '#fb7e38', strokeWidth: 3 },
      { data: [0, 5, 12, 20, 28, 25, 18, 10, 4], color: '#0057b7', strokeWidth: 3 },
    ]"
    :height="200"
    x-label="Weeks"
    y-label="Incidence"
    :grid-style="{ color: '#6b7280', opacity: 0.35 }"
    :x-grid="{ lineStyle: 'dotted' }"
    :y-grid="{ lineStyle: 'dashed', lineWidth: 1.5 }"
  />

<template #code>

```vue
<LineChart
  :series="series"
  :height="200"
  x-label="Weeks"
  y-label="Incidence"
  :grid-style="{ color: '#6b7280', opacity: 0.35 }"
  :x-grid="{ lineStyle: 'dotted' }"
  :y-grid="{ lineStyle: 'dashed', lineWidth: 1.5 }"
/>
```

  </template>
</ComponentDemo>

## Titles and text

### Title

The `title` prop accepts `\n` to break across lines. Use `titleStyle`
to override `fontSize`, `lineHeight`, `color`, `fontWeight`, and
`align` (`"left" | "center" | "right"`, default `"left"`). Top padding
grows automatically for additional lines.

<ComponentDemo>
  <LineChart
    :data="[0, 4, 8, 15, 22, 30, 28, 20, 12, 5, 2]"
    :height="220"
    :title="'Daily ED visits\nInfluenza-like illness, last 11 days'"
    :title-style="{ fontSize: 16, lineHeight: 20, color: '#0057b7' }"
    x-label="Days"
    y-label="Cases"
  />

<template #code>

```vue
<LineChart
  :data="[0, 4, 8, 15, 22, 30, 28, 20, 12, 5, 2]"
  :height="220"
  :title="'Daily ED visits\nInfluenza-like illness, last 11 days'"
  :title-style="{ fontSize: 16, lineHeight: 20, color: '#0057b7' }"
  x-label="Days"
  y-label="Cases"
/>
```

  </template>
</ComponentDemo>

### Font sizes

Every text element on the chart has its own style prop and default size (in px). The text-styling props (`axisLabelStyle`, `tickLabelStyle`, `legendStyle`) take a `LabelStyle` (`{ fontSize?, color?, fontWeight? }`), and `titleStyle` adds `lineHeight` and `align`. Unset fields fall back to the defaults below.

| Chart part                                  | Prop / field                         | Type         | Default size |
| ------------------------------------------- | ------------------------------------ | ------------ | -----------: |
| Title                                       | `titleStyle`                         | `TitleStyle` |           14 |
| Axis labels (`xLabel` / `yLabel`)           | `axisLabelStyle`                     | `LabelStyle` |           13 |
| Axis tick labels (the numbers on each axis) | `tickLabelStyle`                     | `LabelStyle` |           10 |
| Inline legend                               | `legendStyle`                        | `LabelStyle` |           11 |
| Area section label                          | `areaSection.inlineLabelStyle`       | `LabelStyle` |           11 |
| Area section description                    | `areaSection.inlineDescriptionStyle` | `LabelStyle` |           11 |
| Annotation text                             | `annotation.fontSize`                | `number`     |           13 |
| Interval whiskers (stroke width)            | `intervalStyle.lineWidth`            | `number`     |          1.5 |

`xLabelAlign` places the x-axis label centered under the plot (`"center"`) or at its left edge (`"left"`); when omitted it is centered, except while area-section labels are showing, where it joins their first row at the left. These are single styles applied to both axes: there's no separate x vs y font size. The same props (except the LineChart-only area-section fields) exist on `BarChart`, since both compose `ChartCommonProps`.

<ComponentDemo>
  <LineChart
    :series="[
      { data: [0, 12, 28, 45, 60, 55, 40, 25, 12], color: '#0057b7', legend: 'No interventions' },
      { data: [0, 8, 18, 30, 40, 35, 25, 14, 6], color: '#ef4444', legend: 'Masking + distancing' },
    ]"
    :height="240"
    title="Daily ED visits"
    x-label="Days"
    y-label="Cases"
    :title-style="{ fontSize: 18 }"
    :axis-label-style="{ fontSize: 15, fontWeight: 700 }"
    :tick-label-style="{ fontSize: 13 }"
    :legend-style="{ fontSize: 14 }"
  />

<template #code>

```vue
<LineChart
  :series="[
    {
      data: [0, 12, 28, 45, 60, 55, 40, 25, 12],
      color: '#0057b7',
      legend: 'No interventions',
    },
    {
      data: [0, 8, 18, 30, 40, 35, 25, 14, 6],
      color: '#ef4444',
      legend: 'Masking + distancing',
    },
  ]"
  :height="240"
  title="Daily ED visits"
  x-label="Days"
  y-label="Cases"
  :title-style="{ fontSize: 18 }"
  :axis-label-style="{ fontSize: 15, fontWeight: 700 }"
  :tick-label-style="{ fontSize: 13 }"
  :legend-style="{ fontSize: 14 }"
/>
```

  </template>
</ComponentDemo>

## Line styles

### Dashed baseline

Set `dashed: true` on a series to draw it dashed, for example to set a
baseline or counterfactual apart from the scenario it is compared to.

<ComponentDemo>
  <LineChart
    :series="[
      { data: [0, 10, 25, 45, 60, 55, 40, 20, 8], color: '#999', dashed: true, strokeWidth: 2 },
      { data: [0, 5, 12, 20, 28, 25, 18, 10, 4], color: '#2563eb', strokeWidth: 2 },
    ]"
    :height="200"
  />

<template #code>

```vue
<LineChart
  :series="[
    {
      data: [0, 10, 25, 45, 60, 55, 40, 20, 8],
      color: '#999',
      dashed: true,
      strokeWidth: 2,
    },
    {
      data: [0, 5, 12, 20, 28, 25, 18, 10, 4],
      color: '#2563eb',
      strokeWidth: 2,
    },
  ]"
  :height="200"
/>
```

  </template>
</ComponentDemo>

### Curves

`curve` sets how a series connects its points: `"linear"` (default),
`"step"`, `"step-before"`, `"step-after"` or `"monotone"`. Steps suit
values that hold between observations, such as cumulative counts or a
piecewise-constant parameter: `"step-after"` holds each value until the
next x, `"step-before"` takes the next value early, and `"step"` switches
halfway. `"monotone"` is a smooth curve that never overshoots the data, so
a peak stays at its data point. Set `curve` on the chart to apply it to
every series and area, or on a single series or area. The geometry
matches d3-shape and Vega-Lite's `interpolate`.

<ComponentDemo>
  <LineChart
    :series="[
      { data: [2, 5, 9, 14, 22, 30, 33, 35, 36], curve: 'step-after', color: '#2563eb', strokeWidth: 2, legend: 'Cumulative (step-after)' },
      { data: [2, 3, 4, 5, 8, 8, 3, 2, 1], curve: 'monotone', color: '#fb7e38', strokeWidth: 2, dots: true, legend: 'Daily (monotone)' },
    ]"
    :height="220"
  />

<template #code>

```vue
<LineChart
  :series="[
    {
      data: [2, 5, 9, 14, 22, 30, 33, 35, 36],
      curve: 'step-after',
      color: '#2563eb',
      strokeWidth: 2,
      legend: 'Cumulative (step-after)',
    },
    {
      data: [2, 3, 4, 5, 8, 8, 3, 2, 1],
      curve: 'monotone',
      color: '#fb7e38',
      strokeWidth: 2,
      dots: true,
      legend: 'Daily (monotone)',
    },
  ]"
  :height="220"
/>
```

  </template>
</ComponentDemo>

### Outline

Set `outline: true` on a series to draw a page-colored stroke behind the
line. This is useful when lines overlap, cross dense areas, or sit on a
busy background: the outline keeps each series visually distinct.

Override the outline's color with `outlineColor` (any CSS color; defaults
to the page background `var(--color-bg-0, #fff)`) and its thickness with
`outlineWidth` (extra width added to the line's `strokeWidth`, split evenly
per side; defaults to `4`).

<ComponentDemo>
  <LineChart
    :series="[
      { data: [0, 10, 25, 45, 60, 55, 40, 20, 8], color: '#fb7e38', strokeWidth: 3, outline: true },
      { data: [0, 12, 22, 40, 58, 58, 42, 22, 10], color: '#0057b7', strokeWidth: 3, outline: true },
    ]"
    :height="200"
  />

<template #code>

```vue
<LineChart
  :series="[
    {
      data: [0, 10, 25, 45, 60, 55, 40, 20, 8],
      color: '#fb7e38',
      strokeWidth: 3,
      outline: true,
    },
    {
      data: [0, 12, 22, 40, 58, 58, 42, 22, 10],
      color: '#0057b7',
      strokeWidth: 3,
      outline: true,
    },
  ]"
  :height="200"
/>
```

  </template>
</ComponentDemo>

### Dots

Set `dots: true` to draw a dot at every point. `dotRadius`, `dotFill` and
`dotStroke` style them; `line: false` keeps the dots and drops the line.

<ComponentDemo>
  <LineChart
    :series="[
      { data: [0, 4, 8, 15, 22, 30, 28, 20, 12, 5, 2], color: '#0057b7', strokeWidth: 2, dots: true, dotRadius: 4, dotFill: '#fff', dotStroke: '#0057b7' },
    ]"
    :height="200"
    x-label="Days"
    y-label="Cases"
  />

<template #code>

```vue
<LineChart
  :series="[
    {
      data: [0, 4, 8, 15, 22, 30, 28, 20, 12, 5, 2],
      color: '#0057b7',
      strokeWidth: 2,
      dots: true,
      dotRadius: 4,
      dotFill: '#fff',
      dotStroke: '#0057b7',
    },
  ]"
  :height="200"
  x-label="Days"
  y-label="Cases"
/>
```

  </template>
</ComponentDemo>

### Many trajectories with low opacity

For an ensemble of model runs, draw every trajectory faintly with the
chart-level `line-opacity` (or a per-series `opacity`) so the density of
the bundle shows where runs agree. To add a median and an interval, see
[named tooltip rows](#named-rows).

<ComponentDemo>
  <LineChart
    :series="trajectories"
    :height="250"
    :line-opacity="0.15"
    x-label="Days"
    y-label="Incidence"
  />

<template #code>

```vue
<LineChart
  :series="trajectories"
  :height="250"
  :line-opacity="0.15"
  x-label="Days"
  y-label="Incidence"
/>
```

  </template>
</ComponentDemo>

### Blend mode

Set `blendMode` on a `Series` to apply a CSS `mix-blend-mode` to that
series' line (and dots, if enabled). Useful when two thick or
high-contrast lines overlap: `"multiply"` darkens the crossing point
on light backgrounds, `"screen"` lightens on dark, `"difference"`
inverts. The white `outline`, if any, is unaffected.

<ComponentDemo>
  <LineChart
    :series="[
      {
        data: Array.from({ length: 30 }, (_, t) => 20 + 15 * Math.sin(t / 4)),
        color: '#ef4444',
        strokeWidth: 3,
        blendMode: 'multiply',
        legend: 'Strain A',
      },
      {
        data: Array.from({ length: 30 }, (_, t) => 20 + 15 * Math.cos(t / 4)),
        color: '#3b82f6',
        strokeWidth: 3,
        blendMode: 'multiply',
        legend: 'Strain B',
      },
    ]"
    :height="240"
    x-label="Day"
    y-label="Incidence"
  />

<template #code>

```vue
<LineChart
  :series="[
    {
      data: strainA,
      color: '#ef4444',
      strokeWidth: 3,
      blendMode: 'multiply',
      legend: 'Strain A',
    },
    {
      data: strainB,
      color: '#3b82f6',
      strokeWidth: 3,
      blendMode: 'multiply',
      legend: 'Strain B',
    },
  ]"
  :height="240"
  x-label="Day"
  y-label="Incidence"
/>
```

  </template>
</ComponentDemo>

## Legend and tooltip

### Legend

Set `legend` on a series to add an entry to the inline legend strip above the plot. When the items don't all fit on one row at the chart's current width, the legend wraps to additional rows and the plot area shrinks to keep the legend clear of the data. Use `showInLegend: false` to keep a series off the legend (e.g. when its `legend` string is reused as a CSV column header) and `showInTooltip: false` to omit it from the hover tooltip.

<ComponentDemo>
  <LineChart
    :series="[
      { data: [0, 12, 28, 45, 60, 55, 40, 25, 12], color: '#0057b7', legend: 'No interventions' },
      { data: [0, 10, 22, 38, 50, 45, 32, 18, 8], color: '#fb7e38', legend: 'School closures' },
      { data: [0, 8, 18, 30, 40, 35, 25, 14, 6], color: '#ef4444', legend: 'Masking + distancing' },
      { data: [0, 6, 14, 24, 32, 28, 20, 10, 4], color: '#10b981', legend: 'Vaccination only' },
      { data: [0, 4, 10, 16, 22, 19, 13, 7, 3], color: '#6366f1', legend: 'Vaccination + masking' },
      { data: [0, 3, 7, 11, 15, 13, 9, 5, 2], color: '#a855f7', legend: 'All interventions combined' },
    ]"
    :height="240"
    x-label="Weeks"
    y-label="Incidence"
  />

<template #code>

```vue
<LineChart
  :series="[
    { data: scenarioA, color: '#0057b7', legend: 'No interventions' },
    { data: scenarioB, color: '#fb7e38', legend: 'School closures' },
    { data: scenarioC, color: '#ef4444', legend: 'Masking + distancing' },
    { data: scenarioD, color: '#10b981', legend: 'Vaccination only' },
    { data: scenarioE, color: '#6366f1', legend: 'Vaccination + masking' },
    { data: scenarioF, color: '#a855f7', legend: 'All interventions combined' },
  ]"
  :height="240"
  x-label="Weeks"
  y-label="Incidence"
/>
```

  </template>
</ComponentDemo>

### Tooltip

Hover over the chart to see a tooltip with values at each data point. Set `tooltip-trigger="hover"` to enable the built-in tooltip with crosshair and highlight dots. Use the `#tooltip` slot for custom content. Pass `tooltip-value-format` to control how numeric values render (e.g. percentages, currency); it falls back to `y-tick-format` when omitted.

On touch devices, drag **horizontally** across the chart to scrub the tooltip between points; a **vertical** swipe scrolls the page instead of getting captured by the chart.

The tooltip stops at every x value of every series shown in it, so series sampled on different dates (say, weekly data over daily data) need no shared x grid. Each row shows its series' nearest point to the hovered x. The `index` passed to the slot, used for `tooltip-data` and emitted by `hover`, counts positions in the sorted union of those x values, which is the plain point index whenever the series share one x set.

<ComponentDemo>
  <LineChart
    :series="[
      { legend: 'Daily', x: Array.from({ length: 29 }, (_, i) => `2025-01-${String(i + 1).padStart(2, '0')}`), data: Array.from({ length: 29 }, (_, i) => Math.round(20 + 15 * Math.sin(i / 4) + (i % 3) * 3)), color: '#0057b7' },
      { legend: 'Weekly', x: ['2025-01-01', '2025-01-08', '2025-01-15', '2025-01-22', '2025-01-29'], data: [22, 38, 29, 14, 24], color: '#fb7e38', strokeWidth: 3, dots: true },
    ]"
    :height="200"
    y-label="Cases"
    tooltip-trigger="hover"
  />

<template #code>

```vue
<LineChart
  :series="[
    { legend: 'Daily', x: dailyDates, data: dailyCases, color: '#0057b7' },
    {
      legend: 'Weekly',
      x: weeklyDates,
      data: weeklyCases,
      color: '#fb7e38',
      strokeWidth: 3,
      dots: true,
    },
  ]"
  :height="200"
  y-label="Cases"
  tooltip-trigger="hover"
/>
```

  </template>
</ComponentDemo>

#### Named rows

Rows are named by the series' `legend`, or `tooltipLabel` to name a row without a legend entry. Once any row is named, unnamed series are left out, so ensemble trajectories drop out and the median stays. Series with no value at the hovered x are left out too. Named areas (`legend` or `tooltipLabel`) show their range, and `intervals` use `label`. `tooltip-title` formats the heading.

<ComponentDemo>
  <LineChart
    :series="fanSeries"
    :areas="fanAreas"
    :height="220"
    x-label="Day"
    y-label="Infections"
    tooltip-trigger="hover"
    :tooltip-title="(label) => `Day ${label}`"
  />

<template #code>

```vue
<script setup>
const series = [
  // One faint line per run: no legend, so no tooltip row.
  ...runs.map((data) => ({ data, color: "#0057b7", opacity: 0.12 })),
  { data: median, legend: "Median", color: "#0057b7", strokeWidth: 2.5 },
];
const areas = [
  { lower: q05, upper: q95, legend: "90% interval", color: "#0057b7" },
];
</script>

<LineChart
  :series="series"
  :areas="areas"
  :height="220"
  x-label="Day"
  y-label="Infections"
  tooltip-trigger="hover"
  :tooltip-title="(label) => `Day ${label}`"
/>
```

  </template>
</ComponentDemo>

#### Custom tooltip content

The `#tooltip` slot gets `title`, `values`, `areas`, `intervals`, `index`, `xLabel`, `data` and `format`. To extend the default body, render `ChartTooltipContent`:

```vue
<script setup>
import { LineChart, ChartTooltipContent } from "@cfasim-ui/charts";
</script>

<LineChart :series="series" :tooltip-data="notes" tooltip-trigger="hover">
  <template #tooltip="tip">
    <ChartTooltipContent
      :title="tip.title"
      :values="tip.values"
      :areas="tip.areas"
      :intervals="tip.intervals"
      :format="tip.format"
    />
    <p v-if="tip.data">{{ tip.data }}</p>
  </template>
</LineChart>
```

### Toggle series from the legend

Set `legend-toggle` to let readers show and hide marks by clicking their
legend item. Every series and area with a `legend` label becomes
toggleable; marks that share a label toggle together. A hidden mark leaves
the plot and the tooltip, its legend item dims with a strikethrough, and
the y axis rescales to what is still shown. CSV downloads always include
every series.

The chart tracks the hidden labels itself. Bind `v-model:hidden-series` (an
array of legend labels) to read the state, set an initial selection, or
drive it from your own controls; `hidden-series` works without
`legend-toggle` too.

<ComponentDemo>
  <LineChart
    data-testid="legend-toggle-line-chart"
    :series="[
      { data: Array.from({ length: 60 }, (_, i) => Math.round(900 * Math.exp(-((i - 25) ** 2) / 120))), legend: 'Baseline', color: '#0057b7' },
      { data: Array.from({ length: 60 }, (_, i) => Math.round(400 * Math.exp(-((i - 32) ** 2) / 200))), legend: 'Vaccination', color: '#fb7e38' },
      { data: Array.from({ length: 60 }, (_, i) => Math.round(60 * Math.exp(-((i - 40) ** 2) / 260))), legend: 'Vaccination + masks', color: '#2e8540' },
    ]"
    :height="220"
    x-label="Days"
    y-label="Cases"
    tooltip-trigger="hover"
    legend-toggle
  />

<template #code>

```vue
<LineChart
  :series="[
    { data: baseline, legend: 'Baseline', color: '#0057b7' },
    { data: vaccination, legend: 'Vaccination', color: '#fb7e38' },
    { data: combined, legend: 'Vaccination + masks', color: '#2e8540' },
  ]"
  :height="220"
  x-label="Days"
  y-label="Cases"
  tooltip-trigger="hover"
  legend-toggle
  v-model:hidden-series="hidden"
/>
```

  </template>
</ComponentDemo>

## Uncertainty

### Confidence band

Use the `areas` prop to fill a band between two y-series, useful for
confidence intervals or min/max envelopes around a mean line. Each `Area`
takes parallel `upper` and `lower` arrays (and an optional `x` array, just
like `Series`). Set `legend` on an `Area` to include the band in the inline
legend; use `showInLegend: false` to hide a legend label without removing
the field from shared config. Set `blendMode` on an `Area` to apply a CSS
`mix-blend-mode` to its fill so overlapping bands combine their colors
(e.g. `"multiply"`) instead of the later one obscuring the earlier.

<ComponentDemo>
  <LineChart
    :data="[0, 4, 8, 15, 22, 30, 28, 20, 12, 5, 2]"
    :areas="[
      {
        upper: [2, 8, 14, 22, 30, 38, 36, 28, 19, 11, 7],
        lower: [0, 1, 3, 9, 15, 22, 21, 13, 6, 1, 0],
        color: '#0057b7',
        opacity: 0.15,
        legend: '95% interval',
      },
    ]"
    :height="220"
    x-label="Days"
    y-label="Cases"
    tooltip-trigger="hover"
  />

<template #code>

```vue
<LineChart
  :data="mean"
  :areas="[
    {
      upper: ci95Hi,
      lower: ci95Lo,
      color: '#0057b7',
      opacity: 0.15,
      legend: '95% interval',
    },
  ]"
  :height="220"
  x-label="Days"
  y-label="Cases"
  tooltip-trigger="hover"
/>
```

  </template>
</ComponentDemo>

### Intervals

Draw a whisker at any x with `intervals`: a line from `lower` to `upper`
with end caps, and a dot at `value` when one is given. Intervals are
independent of the series, which makes them a good fit for calibration
targets: observed ranges a bundle of simulated trajectories should pass
through. `x` is in the chart's x-space (so it respects `xMin`, explicit
`x` values, and epoch-ms on a date axis), and the y axis extends to cover
every interval.

<ComponentDemo>
  <LineChart
    data-testid="calibration-chart"
    :series="calibrationRuns"
    :intervals="[
      { x: 5, lower: 1, upper: 6, value: 3 },
      { x: 12, lower: 14, upper: 26, value: 20 },
      { x: 19, lower: 32, upper: 46, value: 39 },
      { x: 30, lower: 8, upper: 18, value: 13 },
    ]"
    :interval-style="{ color: '#c2410c', lineWidth: 2, capWidth: 10 }"
    :height="260"
    :line-opacity="0.15"
    x-label="Days"
    y-label="Incidence"
  />

<template #code>

```vue
<LineChart
  :series="trajectories"
  :intervals="[
    { x: 5, lower: 1, upper: 6, value: 3 },
    { x: 12, lower: 14, upper: 26, value: 20 },
    { x: 19, lower: 32, upper: 46, value: 39 },
    { x: 30, lower: 8, upper: 18, value: 13 },
  ]"
  :interval-style="{ color: '#c2410c', lineWidth: 2, capWidth: 10 }"
  :height="260"
  :line-opacity="0.15"
  x-label="Days"
  y-label="Incidence"
/>
```

  </template>
</ComponentDemo>

`intervalStyle` sets defaults for every whisker on the chart; any field
set on an individual interval wins. The style fields are `color`,
`lineWidth`, `capWidth` (`0` hides the caps), `opacity`, `lineDash`,
`outlineWidth` / `outlineColor` (a page-colored halo for legibility over
dense series, off by default), `dot` / `dotRadius` / `dotFill` /
`dotStroke` / `dotStrokeWidth` for the value marker, and `blendMode`.

For one whisker per data point, put parallel `lower` and `upper` arrays
on a `Series`. They draw in the series color under its line and dots,
follow its legend toggle, show up in the tooltip as a range, and export
as extra `_lower` / `_upper` CSV columns. Style them with the series'
`intervalStyle`.

<ComponentDemo>
  <LineChart
    :series="[
      {
        data: [12, 18, 25, 31, 28, 20, 14],
        lower: [9, 14, 20, 26, 23, 16, 10],
        upper: [15, 22, 30, 36, 33, 24, 18],
        color: '#0057b7',
        dots: true,
        legend: 'Observed',
        intervalStyle: { capWidth: 6, opacity: 0.8 },
      },
      {
        data: [10, 17, 24, 30, 29, 22, 15],
        color: '#ef4444',
        dashed: true,
        legend: 'Model',
      },
    ]"
    :height="240"
    x-label="Week"
    y-label="Cases"
    tooltip-trigger="hover"
  />

<template #code>

```vue
<LineChart
  :series="[
    {
      data: observed,
      lower: observedLo,
      upper: observedHi,
      color: '#0057b7',
      dots: true,
      legend: 'Observed',
      intervalStyle: { capWidth: 6, opacity: 0.8 },
    },
    { data: model, color: '#ef4444', dashed: true, legend: 'Model' },
  ]"
  :height="240"
  x-label="Week"
  y-label="Cases"
  tooltip-trigger="hover"
/>
```

  </template>
</ComponentDemo>

> **Intervals vs. areas.** `areas` fills a continuous band between two
> series and suits a model's own uncertainty envelope. `intervals` marks
> discrete ranges at specific positions and suits observations.

## Highlights and annotations

### Area sections

Highlight a range of a series line by filling the area between the line and the x-axis. A labeled section's fill continues past the axis to a faint bar, with its label and description beneath, left-aligned at the section start. Labels of sections that overlap in time stack into rows, and the x-axis label moves to the left of the first row (a section label that would overlap it drops a row). Set `legend: "inline"` to list a section in the legend strip instead. Tune the bar and row spacing with `area-section-layout` (see `AreaSectionLayout`); per section, `lineColor` and `strokeWidth` style the highlighted line (or, without `seriesIndex`, the boundary lines) and `barColor`, `barWidth`, and `barOpacity` style the bar. Move the sections below with the sliders to see the labels stack and unstack; with `x-label-align="center"` the x-axis label moves beneath the rows instead.

<ComponentDemo>
  <LineChart
    :series="sectionDemoSeries"
    :area-sections="sectionDemoSections"
    :height="250"
    x-label="Days"
    y-label="Cumulative count"
    :menu="false"
  />
  <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-top: 8px">
    <div style="flex: 1 1 220px">
      <NumberInput
        v-model:range="growthRange"
        label="Growth phase (days)"
        :min="0"
        :max="10"
        number-type="integer"
      />
    </div>
    <div style="flex: 1 1 220px">
      <NumberInput
        v-model:range="mitigationRange"
        label="Mitigation period (days)"
        :min="0"
        :max="10"
        number-type="integer"
      />
    </div>
  </div>

<template #code>

```vue
<script setup>
import { ref, computed } from "vue";

const growthRange = ref([2, 7]);
const mitigationRange = ref([3, 9]);
const sections = computed(() => [
  {
    startIndex: growthRange.value[0],
    endIndex: growthRange.value[1],
    color: "#6366f1",
    strokeWidth: 0,
    label: `Day ${growthRange.value[0]}–${growthRange.value[1]}`,
    description: "Rapid growth phase",
  },
  {
    seriesIndex: 0,
    startIndex: mitigationRange.value[0],
    endIndex: mitigationRange.value[1],
    color: "#f43f5e",
    label: `Day ${mitigationRange.value[0]}–${mitigationRange.value[1]}`,
    description: "Mitigation period",
  },
]);
</script>

<LineChart
  :series="series"
  :area-sections="sections"
  :height="250"
  x-label="Days"
  y-label="Cumulative count"
/>
<NumberInput
  v-model:range="growthRange"
  label="Growth phase (days)"
  :min="0"
  :max="10"
  number-type="integer"
/>
<NumberInput
  v-model:range="mitigationRange"
  label="Mitigation period (days)"
  :min="0"
  :max="10"
  number-type="integer"
/>
```

  </template>
</ComponentDemo>

Without a below-chart label (no `label`/`description`, or `legend: "inline"`)
the fill stays inside the plot and nothing is drawn under the axis.

<ComponentDemo>
  <LineChart
    :series="[
      { data: [0, 2, 5, 12, 25, 45, 70, 100, 130, 155, 170], color: '#000', strokeWidth: 1, legend: 'No interventions' },
    ]"
    :area-sections="[
      { seriesIndex: 0, startIndex: 3, endIndex: 7, color: '#6366f1', legend: 'inline', label: 'Day 3–7', description: 'Rapid growth phase' },
    ]"
    :height="250"
    x-label="Days"
    y-label="Cumulative count"
    :menu="false"
  />

<template #code>

```vue
<LineChart
  :series="[
    {
      data: [0, 2, 5, 12, 25, 45, 70, 100, 130, 155, 170],
      color: '#000',
      strokeWidth: 1,
      legend: 'No interventions',
    },
  ]"
  :area-sections="[
    {
      seriesIndex: 0,
      startIndex: 3,
      endIndex: 7,
      color: '#6366f1',
      legend: 'inline',
      label: 'Day 3–7',
      description: 'Rapid growth phase',
    },
  ]"
  :height="250"
  x-label="Days"
  y-label="Cumulative count"
/>
```

  </template>
</ComponentDemo>

### Annotations

Pin callouts to data points with `annotations`. Each annotation anchors at
`(x, y)` in data coordinates (the same x-space as the chart axis, so it
respects `xMin` and explicit `x` values), with a pixel
`offset: { x, y }` for the label position. A pointer line connects the
anchor to the label: `pointer` picks `"curved"` (default), `"straight"`
or `"none"`, and `arrow` caps the anchor end. Text supports `\n` for line
breaks, `**bold**` and `_italic_` runs (they compose: `**_both_**`).
Multi-line callouts attach to whichever edge of the text faces the anchor,
so the pointer never cuts through the lines.

The label and line each get a legibility outline in the page background
color: `outlineColor` / `outlineWidth` style the line's halo and are the
defaults for the text's `textOutlineColor` / `textOutlineWidth`.
`blendMode` applies a CSS `mix-blend-mode` to the whole annotation so it
combines with the series under it instead of covering them. Try the
options below.

<ComponentDemo>
  <LineChart
    :data="[0, 4, 8, 15, 22, 30, 28, 20, 12, 5, 2]"
    :annotations="[pointerAnnotation]"
    :chart-padding="{ top: 50, right: 70, bottom: 16, left: 70 }"
    :height="280"
    x-label="Days"
    y-label="Cases"
    :menu="false"
  />
  <div class="annotation-controls">
    <SelectBox
      v-model="pointerKind"
      label="Pointer"
      :options="[
        { value: 'curved', label: 'Curved' },
        { value: 'straight', label: 'Straight' },
        { value: 'none', label: 'None' },
      ]"
    />
    <SelectBox
      v-model="pointerPosition"
      label="Label position"
      :options="[
        { value: 'above', label: 'Above' },
        { value: 'above-right', label: 'Above right' },
        { value: 'right', label: 'Right' },
        { value: 'below-right', label: 'Below right' },
        { value: 'below', label: 'Below' },
        { value: 'below-left', label: 'Below left' },
        { value: 'left', label: 'Left' },
        { value: 'above-left', label: 'Above left' },
      ]"
    />
    <SelectBox
      v-model="pointerOutline"
      label="Outline"
      :options="annotationOutlineOptions"
    />
    <SelectBox
      v-model="pointerBlend"
      label="Blend mode"
      :options="annotationBlendOptions"
    />
    <Toggle v-model="pointerArrow" label="Arrow" />
  </div>

<template #code>

```vue
<LineChart
  :data="[0, 4, 8, 15, 22, 30, 28, 20, 12, 5, 2]"
  :annotations="[
    {
      x: 3,
      y: 15,
      offset: { x: 50, y: -36 },
      text: '**Cluster**\n_Day 3_',
      pointer: 'curved',
      arrow: true,
      outlineWidth: 3,
      textOutlineWidth: 3,
      blendMode: 'normal',
    },
  ]"
  :chart-padding="{ top: 50, right: 70, bottom: 16, left: 70 }"
  :height="280"
  x-label="Days"
  y-label="Cases"
/>
```

  </template>
</ComponentDemo>

Use `chart-padding` to reserve room outside the plot so annotations (or
any other overlay) don't clip the data area. It accepts a number (same on
all sides) or an object with `top`, `right`, `bottom`, `left`.

### Rules

Set `pointer` to one of the rule values to replace the connector with a
straight line through the anchor:

- `"ruleX"`: vertical line spanning the plot height at the annotation's `x`.
- `"ruleY"`: horizontal line spanning the plot width at the annotation's `y`.
- `"ruleUp"`: vertical from the bottom edge up to the anchor.
- `"ruleDown"`: vertical from the top edge down to the anchor.
- `"ruleFromLeft"`: horizontal from the left edge in to the anchor.
- `"ruleFromRight"`: horizontal from the right edge in to the anchor.

`lineColor`, `lineWidth`, and `lineDash` style the line, and the label is
positioned from the anchor as usual via `offset`. `rotate` turns the label
about its position, in degrees clockwise: `-90` reads bottom to top beside a
vertical rule. Rotated text keeps to the side of its position facing away
from the anchor, so a small `offset.x` of either sign puts the label just
beside the rule. Set `align` explicitly for rotated text, since it runs
along the rotated baseline (`"left"` extends away from the position in
reading direction).

<ComponentDemo>
  <LineChart
    :data="[0, 4, 8, 15, 22, 30, 28, 20, 12, 5, 2]"
    :annotations="[ruleAnnotation]"
    :chart-padding="{ top: 24, right: 24 }"
    :height="260"
    x-label="Days"
    y-label="Cases"
    :menu="false"
  />
  <div class="annotation-controls">
    <SelectBox
      v-model="ruleKind"
      label="Rule"
      :options="[
        { value: 'ruleX', label: 'ruleX' },
        { value: 'ruleY', label: 'ruleY' },
        { value: 'ruleUp', label: 'ruleUp' },
        { value: 'ruleDown', label: 'ruleDown' },
        { value: 'ruleFromLeft', label: 'ruleFromLeft' },
        { value: 'ruleFromRight', label: 'ruleFromRight' },
      ]"
    />
    <SelectBox
      v-model="ruleSide"
      label="Label side"
      :options="[
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' },
        { value: 'above', label: 'Above' },
        { value: 'below', label: 'Below' },
      ]"
    />
    <SelectBox
      v-model="ruleRotate"
      label="Label rotation"
      :options="[
        { value: '0', label: 'None' },
        { value: '-90', label: '-90° (reads up)' },
        { value: '90', label: '90° (reads down)' },
      ]"
    />
    <SelectBox
      v-model="ruleDash"
      label="Line dash"
      :options="[
        { value: 'solid', label: 'Solid' },
        { value: 'dashed', label: 'Dashed' },
        { value: 'dotted', label: 'Dotted' },
      ]"
    />
    <SelectBox
      v-model="ruleOutline"
      label="Outline"
      :options="annotationOutlineOptions"
    />
    <SelectBox
      v-model="ruleBlend"
      label="Blend mode"
      :options="annotationBlendOptions"
    />
  </div>

<template #code>

```vue
<LineChart
  :data="[0, 4, 8, 15, 22, 30, 28, 20, 12, 5, 2]"
  :annotations="[
    {
      x: 5,
      y: 14,
      offset: { x: -6, y: 0 },
      text: 'Peak day',
      pointer: 'ruleX',
      align: 'left',
      rotate: -90,
      lineDash: '4 3',
      outlineWidth: 0,
      textOutlineWidth: 3,
    },
  ]"
  :chart-padding="{ top: 24, right: 24 }"
  :height="260"
  x-label="Days"
  y-label="Cases"
/>
```

  </template>
</ComponentDemo>

### Draggable markers

Use `markers` to draw vertical lines spanning the full plot height, each
with a label just above the top of the line. Markers are **draggable**
along the x-axis by default; bind with `v-model:markers` to receive
position updates while dragging (plus `marker-drag` / `marker-drag-end`
events). Labels are painted above all series lines with a background-colored
stroke so they stay legible, and labels that would collide move down to the
next row.

Each marker can drive its **own variable**: assemble the `markers` array
from your refs in a writable computed and split drag updates back out in
its setter, as below. (Alternatively, listen to `marker-drag` and dispatch
on `payload.index` or `payload.marker.label`.)

Drag the lines below (or focus one and use the arrow keys). While a
marker is dragged it shows its current `x` just above the x axis,
formatted like the x axis or through `valueFormat` and styled with
`valueStyle`, `valueOutlineColor` / `valueOutlineWidth` and
`valueBlendMode`; set `showValueOnDrag: false` to hide it:

<ComponentDemo>
  <LineChart
    v-model:markers="markers"
    :series="[
      { data: infections, color: '#1a1a1a', strokeWidth: 2, legend: 'Infections' },
      { data: hospitalizations, color: '#0057b7', strokeWidth: 2, legend: 'Hospitalizations' },
    ]"
    :height="260"
    x-label="Days"
    y-label="Count"
  />
  <p class="marker-demo-readout">
    Isolation: day {{ isolation.toFixed(1) }} · Recovery: day
    {{ recovery.toFixed(1) }}
  </p>

<template #code>

```vue
<script setup>
import { ref, computed } from "vue";

// Each marker drives its own variable...
const isolation = ref(12);
const recovery = ref(32);

// ...mapped through a writable computed: the getter assembles the
// markers array, the setter splits drag updates back out.
const markers = computed({
  get: () => [
    { x: isolation.value, label: "Isolation" },
    { x: recovery.value, label: "Recovery" },
  ],
  set: ([a, b]) => {
    isolation.value = a.x;
    recovery.value = b.x;
  },
});
</script>

<LineChart
  v-model:markers="markers"
  :series="[
    {
      data: infections,
      color: '#1a1a1a',
      strokeWidth: 2,
      legend: 'Infections',
    },
    {
      data: hospitalizations,
      color: '#0057b7',
      strokeWidth: 2,
      legend: 'Hospitalizations',
    },
  ]"
  :height="260"
  x-label="Days"
  y-label="Count"
/>
<p>
  Isolation: day {{ isolation.toFixed(1) }} · Recovery: day
  {{ recovery.toFixed(1) }}
</p>
```

  </template>
</ComponentDemo>

Drag positions are continuous floats; round in the setter
(`isolation.value = Math.round(a.x)`) if the variable should be whole
days; the marker then snaps as you drag. If you don't need separate
variables, a plain `ref` holding the array works too:
`const markers = ref([{ x: 12, label: "Isolation" }])` with
`v-model:markers="markers"`.

Labels sit `marker-label-gap` pixels above the top of the lines
(default 7). Increase it for more clearance; the chart reserves the
extra top padding automatically (the gap plus the tallest label font
size), so nothing clips.

The line's style is configurable per marker: `color`, `strokeWidth`,
`dashed: false` for a solid line (or `dash` for a custom pattern), and
`outline: true` for a page-colored stroke behind the line. The label's
text styles via `labelStyle` and its legibility stroke via
`labelOutlineColor` / `labelOutlineWidth` (set `0` to disable). Set
`labelBackground: true` to draw the label on a pill in the marker color
(or pass a color), flat where it sits on the line and rounded on its
other corners, padded by `labelPadding` (a number or `{ x, y }`, default
6 by 5); the text turns white or near-black to suit the fill unless
`labelStyle.color` says otherwise, and a draggable marker's pill darkens
on hover and keyboard focus. Set `draggable: false` to pin a marker in
place.

<ComponentDemo>
  <LineChart
    v-model:markers="styledMarkers"
    :series="[
      { data: infections, color: '#1a1a1a', strokeWidth: 2 },
      { data: hospitalizations, color: '#9ca3af', strokeWidth: 2 },
    ]"
    :height="240"
    x-label="Days"
    y-label="Count"
  />

<template #code>

```vue
<LineChart
  v-model:markers="markers"
  :series="[...]"
  :height="240"
  x-label="Days"
  y-label="Count"
/>

<script setup>
const markers = ref([
  {
    x: 10,
    label: "Intervention",
    color: "#ef4444",
    strokeWidth: 2,
    dashed: false,
    outline: true,
    labelStyle: { color: "#ef4444", fontSize: 13 },
    labelOutlineWidth: 4,
  },
  {
    x: 22,
    label: "Peak",
    color: "#0057b7",
    dash: "2 6",
    labelBackground: true,
  },
]);
</script>
```

  </template>
</ComponentDemo>

On a date axis, set `x` to a `Date`, a date string, or epoch-ms; drag
updates then emit `Date` values, and the drag readout formats them like
the axis ticks. On a numeric axis `x` is in the same display space as the
axis (it respects `xMin`). `snap: true` snaps a dragged marker to the
series' x positions (whole days below) and a number snaps to multiples
of that step (`7 * 86400000` for weeks on a date axis, `5` for every
fifth unit on a numeric one); arrow keys then step between snap
positions.

<ComponentDemo>
  <LineChart
    v-model:markers="dateMarkers"
    :x="markerDates"
    :y="infections"
    :height="240"
    y-label="Infections"
    :menu="false"
  />

<template #code>

```vue
<LineChart v-model:markers="markers" :x="dates" :y="infections" :height="240" />

<script setup>
const dates = Array.from(
  { length: 45 },
  (_, t) => new Date(Date.UTC(2026, 0, 1 + t)),
);
const markers = ref([
  { x: "2026-01-13", label: "Isolation", snap: true },
  { x: "2026-02-02", label: "Recovery", labelBackground: true, snap: true },
]);
</script>
```

  </template>
</ComponentDemo>

```ts
interface ChartMarker {
  x: number | string | Date; // position in data coords (Date/string on a date axis)
  label?: string; // text above the top of the line
  color?: string; // line color (default: #999)
  strokeWidth?: number; // line width (default: 1.5)
  dashed?: boolean; // default: true; false = solid
  dash?: string | number | readonly number[]; // custom stroke-dasharray (wins over dashed)
  outline?: boolean; // page-colored stroke behind the line
  outlineColor?: string; // default: var(--color-bg-0, #fff)
  outlineWidth?: number; // extra width added to strokeWidth (default: 4)
  labelStyle?: LabelStyle; // { fontSize?, color?, fontWeight? }, defaults 12 / currentColor / 600
  labelOutlineColor?: string; // label legibility stroke (default: var(--color-bg-0, #fff))
  labelOutlineWidth?: number; // default: 3 (0 with labelBackground); 0 disables
  labelBackground?: boolean | string; // pill behind the label: true = marker color
  labelPadding?: number | { x?: number; y?: number }; // pill padding (default: { x: 6, y: 5 })
  draggable?: boolean; // default: true
  snap?: boolean | number; // true = series x positions; number = step in axis units
  showValueOnDrag?: boolean; // current x above the x axis while dragging (default: true)
  valueFormat?: (x: number | Date) => string; // formats that value (default: like the x axis)
  valueStyle?: LabelStyle; // drag value text style (defaults: label font size / currentColor / 400)
  valueOutlineColor?: string; // drag value halo (default: labelOutlineColor)
  valueOutlineWidth?: number; // default: 3; 0 disables
  valueBlendMode?: BlendMode; // mix-blend-mode for the drag value text
}
```

Each draggable marker is exposed as a horizontal slider (`role="slider"`):
it's keyboard-focusable, and <kbd>←</kbd>/<kbd>→</kbd> move it one step
(hold <kbd>Shift</kbd> for ×10). Note that when the chart has a `title` or
`ariaLabel`, the `<svg>` defaults to `role="img"`, which hides the sliders
from assistive tech; pass `role="figure"` if screen-reader users should
reach them.

## Interaction and export

### Zoom

Set `zoom` to let readers click and drag on the plot to zoom. One gesture
covers two kinds of zoom:

- **Along x:** a roughly straight horizontal drag selects a full-height
  band. The chart zooms to that x-range and the y axis rescales to the
  data visible in it.
- **Box:** once the drag also covers about 24px vertically, the selection
  becomes a box and the chart zooms both axes to it.

Pass `zoom="x"` to allow only the x-range zoom, whatever the drag's
height. While zoomed, marks outside the window are clipped at the edges
the window cuts through; an edge that is the visible data's own boundary
(the top and bottom of a rescaled y axis, or an x edge at the first or
last point) leaves the dots and whisker caps sitting on it whole. A reset
button appears at the top right; double-clicking the plot also resets,
and <kbd>Esc</kbd> cancels a drag in progress. Repeated drags zoom
further in, up to 10,000× per axis.

Drag-to-zoom is a mouse gesture. On touch screens (and with a pen) a drag
keeps scrubbing the tooltip and scrolling the page, so the chart stays at
its full extent there.

<ComponentDemo>
  <LineChart
    data-testid="zoom-line-chart"
    :data="Array.from({ length: 120 }, (_, i) => Math.round(400 * Math.exp(-((i - 45) ** 2) / 300) + 150 * Math.exp(-((i - 95) ** 2) / 80)))"
    :height="220"
    x-label="Days"
    y-label="Cases"
    tooltip-trigger="hover"
    zoom
  />

<template #code>

```vue
<LineChart
  :data="cases"
  :height="220"
  x-label="Days"
  y-label="Cases"
  tooltip-trigger="hover"
  zoom
/>
```

  </template>
</ComponentDemo>

### Chart menu

The chart menu (top-right) leads with Fullscreen and then Save as SVG,
Save as PNG, and Download CSV. Fullscreen grows the chart to fill the browser
window so the plot has more room; while expanded the menu trigger is replaced
by a close (✕) button: click it or press <kbd>Esc</kbd> to return to the
inline size. Set `menu="false"` to hide the trigger entirely.

While expanded the chart is teleported to `<body>` so it reliably covers the
viewport even when an ancestor uses `transform`, `filter`, `contain`, or
establishes a stacking context. If your app doesn't mount at the document root
(e.g. inside a shadow root or a dedicated overlay container), point
`fullscreenTarget` at a CSS selector or element to teleport there instead.

### Custom CSV download

By default, the Download CSV menu item exports the chart series as CSV. Use
the `csv` prop to supply your own content (for example, to include original
dates, categorical labels, or extra columns that aren't plotted). Use
`filename` to control the download filename (shared by SVG, PNG and CSV).

Pass `download-link` to also render a plain text link below the chart: set
it to `true` for the default label, or pass a string to customize it. Use
`download-button` instead to render a styled `<button>` (with the class
`line-chart-download-button`, available for custom CSS) in place of the
link.

<ComponentDemo>
  <LineChart
    :data="[10, 22, 35, 48]"
    :height="200"
    filename="weekly-cases"
    :csv="'week,cases\n2024-W01,10\n2024-W02,22\n2024-W03,35\n2024-W04,48'"
    x-label="Week"
    y-label="Cases"
    download-link="Download weekly cases (CSV)"
  />

<template #code>

```vue
<LineChart
  :data="[10, 22, 35, 48]"
  :height="200"
  filename="weekly-cases"
  :csv="`week,cases
2024-W01,10
2024-W02,22
2024-W03,35
2024-W04,48`"
  x-label="Week"
  y-label="Cases"
  download-link="Download weekly cases (CSV)"
/>
```

  </template>
</ComponentDemo>

`csv` also accepts a function, which is useful for deferring serialization
until the user clicks Download:

```vue
<LineChart :data="cases" :csv="() => buildCsv(cases, dates)" />
```

## Accessibility

The chart's `<svg>` is exposed as a single labeled image so screen readers
announce one accessible name instead of wandering through the individual marks.
When the chart has a `title`, the `<svg>` gets `role="img"` and an `aria-label`
set to the title. The menu and download controls live outside the `<svg>`, so
they stay reachable regardless.

Set `ariaLabel` to give screen readers a fuller summary than the visible title
(it overrides `title` for the accessible name only):

```vue
<LineChart
  :data="cases"
  title="Daily ED visits"
  aria-label="Daily ED visits over 11 days, rising from 12 to a peak of 48"
/>
```

Pass `role` to override the default `"img"` (e.g. `role="figure"`, or a role of
your own).

With `legend-toggle`, each toggleable legend item is a real `<button>` laid
over the legend, outside the `<svg>`. The buttons sit in a group named "Show
or hide series", are reachable with <kbd>Tab</kbd>, activate with
<kbd>Enter</kbd> or <kbd>Space</kbd>, and report whether the mark is shown
through `aria-pressed`. They stay in place while the chart is expanded.

<!--@include: ./_api/line-chart.md-->

### Series

```ts
interface Series {
  y?: LineChartData; // y-values (one of y / data must be set; y wins)
  data?: LineChartData; // y-values (alternative name)
  x?: LineChartXInput; // optional parallel x-values; dates switch on a date axis
  color?: string;
  strokeWidth?: number;
  dashed?: boolean;
  curve?: LineCurve; // "linear" | "step" | "step-before" | "step-after" | "monotone"
  opacity?: number;
  lineOpacity?: number; // overrides opacity for the line only
  dotOpacity?: number; // overrides opacity for the dots only
  blendMode?: BlendMode; // CSS mix-blend-mode for the line and dots
  line?: boolean; // default: true
  outline?: boolean; // page-colored stroke drawn behind the line
  outlineColor?: string; // default: var(--color-bg-0, #fff)
  outlineWidth?: number; // extra width added to strokeWidth (default: 4)
  dots?: boolean;
  dotRadius?: number;
  dotFill?: string;
  dotStroke?: string;
  legend?: string; // inline legend label, also names the tooltip row
  showInLegend?: boolean; // default: true when legend is set
  showInTooltip?: boolean; // default: true
  tooltipLabel?: string; // names the tooltip row without a legend entry
  lower?: LineChartData; // per-point whisker bounds, parallel to y
  upper?: LineChartData;
  intervalStyle?: IntervalStyle; // styles those whiskers
}
```

### Area

```ts
interface Area {
  upper: LineChartData;
  lower: LineChartData;
  x?: LineChartXInput; // optional parallel x-values
  curve?: LineCurve; // both edges; defaults to the chart's curve
  color?: string;
  opacity?: number;
  legend?: string; // inline legend label, also names the tooltip row
  showInLegend?: boolean; // default: true when legend is set
  showInTooltip?: boolean; // default: true for a named area
  tooltipLabel?: string; // names the tooltip row without a legend entry
  blendMode?: BlendMode; // CSS mix-blend-mode for the fill
}
```

### AreaSection

```ts
interface AreaSection {
  seriesIndex?: number; // omit for full-height fill
  startIndex: number;
  endIndex: number;
  color?: string;
  opacity?: number; // default: 0.15
  label?: string;
  description?: string;
  strokeWidth?: number; // highlighted line segment, or the boundary lines of a full-height section; default: 2, 0 hides
  lineColor?: string; // same line; default: color
  dashed?: boolean;
  barColor?: string; // bar under a labeled section's fill; default: color
  barWidth?: number; // default: 1
  barOpacity?: number; // default: 0.5
  legend?: "inline" | "below" | false; // default: "below"
  inlineLabelStyle?: LabelStyle;
  inlineDescriptionStyle?: LabelStyle;
}
```

### AreaSectionLayout

Chart-level spacing of the below-chart section labels, passed as
`area-section-layout`. The bar and label rows are shared by every section,
so the spacing is set once per chart.

```ts
interface AreaSectionLayout {
  barOffset?: number; // plot bottom to the bar; default: 26
  labelGap?: number; // bar to the first label row; default: 6
  rowHeight?: number; // each stacked label row; default: 32
}
```

### ChartInterval

```ts
interface ChartInterval extends IntervalStyle {
  x: number; // data-space x (epoch ms on a date axis)
  lower: number;
  upper: number;
  value?: number; // point estimate, drawn as a dot
  seriesIndex?: number; // tie to a series: hides with it; LineChart takes its color, BarChart centers on its bar
}

interface IntervalStyle {
  color?: string; // default: currentColor (LineChart series whiskers: the series color)
  lineWidth?: number; // default: 1.5
  capWidth?: number; // default: 8; 0 hides the caps
  opacity?: number; // default: 1
  lineDash?: string | number | number[]; // whisker only; caps stay solid
  outlineWidth?: number; // default: 0 (no halo)
  outlineColor?: string; // default: var(--color-bg-0, #fff)
  dot?: boolean; // default: true for `intervals`, false for series whiskers
  dotRadius?: number; // default: 3
  dotFill?: string; // default: color
  dotStroke?: string;
  dotStrokeWidth?: number; // default: 1
  blendMode?: BlendMode;
}
```

The tooltip slot receives `intervals` (standalone intervals whose `x` is
the hovered x) alongside `values`, and each series value carries `lower`
/ `upper` when the series has whiskers.

### GridStyle

Accepted by `xGrid` / `yGrid` (and `BarChart`'s `valueGrid`) in place of
`true`, and by the chart-level `gridStyle` prop as defaults.

```ts
interface GridStyle {
  color?: string; // default: currentColor
  opacity?: number; // default: 0.1
  lineWidth?: number; // default: 1
  lineStyle?: "solid" | "dashed" | "dotted"; // default: solid; scales with lineWidth
  lineDash?: string | number | number[]; // raw stroke-dasharray; overrides lineStyle
}
```

<style>
.annotation-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  align-items: end;
  width: 100%;
  margin-top: 12px;
}
.annotation-controls > * {
  flex: 1 1 150px;
}
</style>
