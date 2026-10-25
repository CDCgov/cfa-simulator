---
keywords:
  [
    bar,
    column,
    chart,
    categorical,
    grouped,
    stacked,
    overlay,
    vertical,
    horizontal,
    interval,
    error bars,
    whiskers,
    histogram,
    time series,
    continuous,
    svg,
  ]
---

<script setup>
import { binValues } from "@cfasim-ui/charts";

// R0 estimates from 60 calibration runs, for the histogram demo.
const r0Estimates = [2.78, 3.13, 2.8, 2.76, 2.48, 2.8, 3.4, 3.09, 3.37, 3.01, 3.08, 2.98, 2.15, 3.28, 3.13, 3.12, 2.14, 2.12, 2.5, 2.69, 3.04, 2.88, 3.13, 2.61, 3.04, 3.08, 2.6, 3.67, 3.15, 3.44, 2.62, 2.57, 2.75, 2.85, 3.18, 3.01, 2.7, 2.47, 2.67, 3.45, 2.54, 3.01, 3.09, 2.23, 2.92, 3.49, 1.99, 2.76, 2.85, 2.53, 3.12, 2.87, 2.24, 3.27, 3.2, 3.33, 3.55, 3.06, 2.95, 2.32];
const r0Bins = binValues(r0Estimates, { step: 0.25 });
</script>

# BarChart

A responsive SVG bar chart supporting single, grouped, stacked, and overlay
series in either vertical (column) or horizontal orientation, on a
categorical axis or a [continuous one](#continuous-x-axis) (numbers or
dates, with histogram bins). Shares axis, tooltip, menu, and CSV export
wiring with [`LineChart`](./line-chart).

## Layouts

### Single series

<ComponentDemo>
  <BarChart
    :data="[12, 19, 7, 24, 16]"
    :categories="['Mon', 'Tue', 'Wed', 'Thu', 'Fri']"
    :height="220"
    x-label="Day"
    y-label="Cases"
    tooltip-trigger="hover"
  />

<template #code>

```vue
<BarChart
  :data="[12, 19, 7, 24, 16]"
  :categories="['Mon', 'Tue', 'Wed', 'Thu', 'Fri']"
  :height="220"
  x-label="Day"
  y-label="Cases"
  tooltip-trigger="hover"
/>
```

  </template>
</ComponentDemo>

### Grouped series

<ComponentDemo>
  <BarChart
    :series="[
      { data: [10, 14, 9, 18], legend: 'Pediatric', color: '#0057b7' },
      { data: [22, 28, 19, 30], legend: 'Adult', color: '#f4a261' },
    ]"
    :categories="['Q1', 'Q2', 'Q3', 'Q4']"
    :height="220"
    y-label="Doses (thousands)"
    tooltip-trigger="hover"
  />

<template #code>

```vue
<BarChart
  :series="[
    { data: [10, 14, 9, 18], legend: 'Pediatric', color: '#0057b7' },
    { data: [22, 28, 19, 30], legend: 'Adult', color: '#f4a261' },
  ]"
  :categories="['Q1', 'Q2', 'Q3', 'Q4']"
  :height="220"
  y-label="Doses (thousands)"
  tooltip-trigger="hover"
/>
```

  </template>
</ComponentDemo>

### Stacked series

<ComponentDemo>
  <BarChart
    :series="[
      { data: [10, 14, 9, 18], legend: 'Pediatric', color: '#0057b7' },
      { data: [22, 28, 19, 30], legend: 'Adult', color: '#f4a261' },
    ]"
    :categories="['Q1', 'Q2', 'Q3', 'Q4']"
    layout="stacked"
    :height="220"
    y-label="Doses (thousands)"
    tooltip-trigger="hover"
  />

<template #code>

```vue
<BarChart
  :series="[
    { data: [10, 14, 9, 18], legend: 'Pediatric', color: '#0057b7' },
    { data: [22, 28, 19, 30], legend: 'Adult', color: '#f4a261' },
  ]"
  :categories="['Q1', 'Q2', 'Q3', 'Q4']"
  layout="stacked"
  :height="220"
  y-label="Doses (thousands)"
  tooltip-trigger="hover"
/>
```

  </template>
</ComponentDemo>

### Overlay series

`layout="overlay"` draws each series at full group width from the shared
baseline, painting later series on top of earlier ones. Use it to compare
a backdrop value (e.g. target, capacity, prior period) against a shorter
foreground value sharing the same axis.

Series render in the order they appear in `series`, so put the taller
backdrop first and the shorter foreground after. Use `opacity`, a
distinct color, or a per-series `blendMode` (see below) if bars might
overlap fully.

<ComponentDemo>
  <BarChart
    :series="[
      { data: [40, 40, 40, 40], legend: 'Target', color: '#d4d4d8' },
      { data: [22, 35, 28, 38], legend: 'Actual', color: '#0057b7' },
    ]"
    :categories="['Q1', 'Q2', 'Q3', 'Q4']"
    layout="overlay"
    :height="220"
    y-label="Doses (thousands)"
    tooltip-trigger="hover"
  />

<template #code>

```vue
<BarChart
  :series="[
    { data: [40, 40, 40, 40], legend: 'Target', color: '#d4d4d8' },
    { data: [22, 35, 28, 38], legend: 'Actual', color: '#0057b7' },
  ]"
  :categories="['Q1', 'Q2', 'Q3', 'Q4']"
  layout="overlay"
  :height="220"
  y-label="Doses (thousands)"
  tooltip-trigger="hover"
/>
```

  </template>
</ComponentDemo>

### Blend mode

Set `blendMode` on a series to apply a CSS `mix-blend-mode` to every
bar in that series. Useful with `layout="overlay"` (or just two
overlapping grouped bars) to combine colors instead of one obscuring
the other. Common picks: `"multiply"` (darkens light fills where bars
overlap), `"screen"` (lightens dark fills), `"difference"` (high
contrast).

<ComponentDemo>
  <BarChart
    :series="[
      { data: [22, 35, 28, 38], legend: 'Treatment A', color: '#ef4444', blendMode: 'multiply' },
      { data: [30, 24, 36, 32], legend: 'Treatment B', color: '#3b82f6', blendMode: 'multiply' },
    ]"
    :categories="['Q1', 'Q2', 'Q3', 'Q4']"
    layout="overlay"
    :height="220"
    y-label="Cases avoided"
    tooltip-trigger="hover"
  />

<template #code>

```vue
<BarChart
  :series="[
    {
      data: [22, 35, 28, 38],
      legend: 'Treatment A',
      color: '#ef4444',
      blendMode: 'multiply',
    },
    {
      data: [30, 24, 36, 32],
      legend: 'Treatment B',
      color: '#3b82f6',
      blendMode: 'multiply',
    },
  ]"
  :categories="['Q1', 'Q2', 'Q3', 'Q4']"
  layout="overlay"
  :height="220"
  y-label="Cases avoided"
  tooltip-trigger="hover"
/>
```

  </template>
</ComponentDemo>

### Horizontal orientation

Set `orientation="horizontal"` to lay the categories down the side and
run the bars left to right, which suits long category names. Every
layout works in either orientation; `x-label` then titles the value axis.

<ComponentDemo>
  <BarChart
    :data="[42, 31, 18, 12, 7]"
    :categories="['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']"
    orientation="horizontal"
    :height="220"
    x-label="Cases"
    tooltip-trigger="hover"
  />

<template #code>

```vue
<BarChart
  :data="[42, 31, 18, 12, 7]"
  :categories="['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']"
  orientation="horizontal"
  :height="220"
  x-label="Cases"
  tooltip-trigger="hover"
/>
```

  </template>
</ComponentDemo>

## Continuous x axis

Pass `x` (on the chart, or per series) to place bars at positions on a
continuous axis instead of in evenly spaced category slots, the way
[`LineChart`](./line-chart#x-y) takes `x`. Numbers give a numeric axis;
ISO date strings or `Date` objects give a date axis. A missing position
shows as a gap, and uneven spacing is drawn to scale. `categories` is
ignored when `x` is set.

Series share a slot where their x values are equal: grouped bars split
it, stacked bars stack in it. A series without its own `x` uses the
chart-level one. `x-ticks` and `x-tick-format` control the axis ticks,
as on `LineChart`, and `zoom` brushes a continuous x range. Intervals,
annotations and summary lines take x in axis units (epoch ms on a date
axis).

### Numeric x

By default each bar is centered on its x and as wide as the smallest
gap between x values, less `bar-padding`.

<ComponentDemo>
  <BarChart
    :data="[4, 9, 14, 11, 6, 3, 1]"
    :x="[0, 1, 2, 3, 6, 7, 8]"
    :height="220"
    x-label="Days since exposure"
    y-label="Cases"
    tooltip-trigger="hover"
  />

<template #code>

```vue
<BarChart
  :data="[4, 9, 14, 11, 6, 3, 1]"
  :x="[0, 1, 2, 3, 6, 7, 8]"
  :height="220"
  x-label="Days since exposure"
  y-label="Cases"
  tooltip-trigger="hover"
/>
```

  </template>
</ComponentDemo>

### Dates and periods

`period` makes each bar span `[x, x + period)`: a number in axis units
(milliseconds on a date axis) or a calendar unit, `"day"`, `"week"`,
`"month"`, `"quarter"` or `"year"`. Calendar periods follow month and
year lengths, so February's bar is narrower than March's. The tooltip
heading shows the span, and the CSV gains an `x_end` column. Dates are
parsed in UTC unless `timezone="local"`.

The week of January 19 below has no row, so its slot stays empty.

<ComponentDemo>
  <BarChart
    data-testid="weekly-bar-chart"
    :data="[42, 55, 61, 38, 30, 22]"
    :x="['2026-01-05', '2026-01-12', '2026-01-26', '2026-02-02', '2026-02-09', '2026-02-16']"
    period="week"
    :height="220"
    y-label="ED visits"
    tooltip-trigger="hover"
  />

<template #code>

```vue
<BarChart
  :data="[42, 55, 61, 38, 30, 22]"
  :x="[
    '2026-01-05',
    '2026-01-12',
    '2026-01-26',
    '2026-02-02',
    '2026-02-09',
    '2026-02-16',
  ]"
  period="week"
  :height="220"
  y-label="ED visits"
  tooltip-trigger="hover"
/>
```

  </template>
</ComponentDemo>

<ComponentDemo>
  <BarChart
    :series="[
      { data: [120, 95, 140, 88, 60, 45], legend: 'Influenza', color: '#0057b7' },
      { data: [40, 52, 61, 70, 66, 50], legend: 'RSV', color: '#fb7e38' },
    ]"
    :x="['2025-10-01', '2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01', '2026-03-01']"
    period="month"
    layout="stacked"
    :height="220"
    y-label="Admissions"
    tooltip-trigger="hover"
  />

<template #code>

```vue
<BarChart
  :series="[
    { data: flu, legend: 'Influenza', color: '#0057b7' },
    { data: rsv, legend: 'RSV', color: '#fb7e38' },
  ]"
  :x="[
    '2025-10-01',
    '2025-11-01',
    '2025-12-01',
    '2026-01-01',
    '2026-02-01',
    '2026-03-01',
  ]"
  period="month"
  layout="stacked"
  :height="220"
  y-label="Admissions"
  tooltip-trigger="hover"
/>
```

  </template>
</ComponentDemo>

### Histograms (`x2`)

A histogram bar covers a bin, not a point: bar `i` spans from `x[i]` to
`x2[i]`. `x2` gives every bar an explicit end like this, for bins of any
width (it wins over `period`). A small `bar-padding` such as `0.04`
leaves a hairline between bins; `0` makes them touch.

To build the arrays from raw values, `binValues` (exported from
`@cfasim-ui/charts` and `@cfasim-ui/shared`) counts them into bins and
returns `{ x, x2, count }`, ready to pass straight in. `step` sets the
bin width, with edges on its multiples; `thresholds` takes a bin count
or explicit edges instead, and `domain` fixes the range. Without either,
the bin count follows Sturges' rule. Below, 60 R₀ estimates go into
bins 0.25 wide.

<ComponentDemo>
  <BarChart
    :x="r0Bins.x"
    :x2="r0Bins.x2"
    :data="r0Bins.count"
    :bar-padding="0.04"
    :x-ticks="0.5"
    :height="220"
    x-label="R₀"
    y-label="Runs"
    tooltip-trigger="hover"
  />

<template #code>

```vue
<script setup>
import { BarChart, binValues } from "@cfasim-ui/charts";

// One R₀ estimate per calibration run (60 in all).
const r0Estimates = [2.78, 3.13, 2.8, 2.76, 2.48, 2.8, 3.4, 3.09 /* ... */];

const bins = binValues(r0Estimates, { step: 0.25 });
// bins.x     = [1.75, 2,    2.25, 2.5,  2.75, 3,    3.25, 3.5 ]
// bins.x2    = [2,    2.25, 2.5,  2.75, 3,    3.25, 3.5,  3.75]
// bins.count = [1,    5,    3,    10,   13,   18,   8,    2   ]
</script>

<BarChart
  :x="bins.x"
  :x2="bins.x2"
  :data="bins.count"
  :bar-padding="0.04"
  :x-ticks="0.5"
  :height="220"
  x-label="R₀"
  y-label="Runs"
  tooltip-trigger="hover"
/>
```

  </template>
</ComponentDemo>

Bins computed elsewhere work the same way. From NumPy,
`counts, edges = np.histogram(values, bins=...)` gives `n + 1` edges for
`n` bins: pass `x = edges[:-1]`, `x2 = edges[1:]` and `data = counts`.

## Axes and labels

### Custom value tick format

Use `value-tick-format` to format the value-axis labels. `tooltip-value-format` controls the tooltip values independently; if omitted, the tooltip uses `value-tick-format`.

<ComponentDemo>
  <BarChart
    :data="[0.12, 0.34, 0.56, 0.78]"
    :categories="['A', 'B', 'C', 'D']"
    :value-tick-format="(v) => `${(v * 100).toFixed(0)}%`"
    :tooltip-value-format="(v) => `${(v * 100).toFixed(1)}%`"
    :height="220"
    y-label="Coverage"
    tooltip-trigger="hover"
  />

<template #code>

```vue
<BarChart
  :data="[0.12, 0.34, 0.56, 0.78]"
  :categories="['A', 'B', 'C', 'D']"
  :value-tick-format="(v) => `${(v * 100).toFixed(0)}%`"
  :tooltip-value-format="(v) => `${(v * 100).toFixed(1)}%`"
  :height="220"
  y-label="Coverage"
  tooltip-trigger="hover"
/>
```

  </template>
</ComponentDemo>

### Date categories

When every entry of `categories` parses as a date (`YYYY-MM-DD` string
or `Date` instance), labels switch to date-aware formatting and the
chart thins them to clean date boundaries (week / month / year
depending on range). Bar positions stay ordinal: every category gets
a bar, and only the labels are thinned. For bars placed to scale in
time, with gaps where dates are missing, use a
[continuous x axis](#dates-and-periods) instead.

<ComponentDemo>
  <BarChart
    :data="[12, 18, 24, 35, 41, 38, 29, 21, 14, 9, 7, 4]"
    :categories="['2026-01-05','2026-01-12','2026-01-19','2026-01-26','2026-02-02','2026-02-09','2026-02-16','2026-02-23','2026-03-02','2026-03-09','2026-03-16','2026-03-23']"
    :height="220"
    y-label="% ED visits"
  />

<template #code>

```vue
<BarChart
  :data="[12, 18, 24, 35, 41, 38, 29, 21, 14, 9, 7, 4]"
  :categories="[
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
    '2026-03-16',
    '2026-03-23',
  ]"
  :height="220"
  y-label="% ED visits"
/>
```

  </template>
</ComponentDemo>

Use `date-format` to override the auto-picked preset. Same values as
LineChart's `x-tick-format` (e.g. `"iso"`, `"month-year"`, an
`Intl.DateTimeFormatOptions` object, or a `(ms, unit?) => string`
function).

### Crowded categorical labels

Non-date categorical labels are also thinned when they don't all fit:
the chart estimates label width from character count and font size,
then strides through the categories so adjacent labels never overlap.
Every bar still renders; only the tick labels are skipped.

<ComponentDemo>
  <BarChart
    data-testid="thinned-bar-chart"
    :data="[3, 5, 8, 12, 18, 24, 31, 27, 22, 16, 11, 7, 4, 2]"
    :categories="['2.11', '2.33', '2.56', '2.78', '3.00', '3.22', '3.44', '3.67', '3.89', '4.11', '4.33', '4.56', '4.78', '5.00']"
    :width="380"
    :height="220"
    x-label="R₀"
    y-label="Frequency"
  />

<template #code>

```vue
<BarChart
  :data="[3, 5, 8, 12, 18, 24, 31, 27, 22, 16, 11, 7, 4, 2]"
  :categories="[
    '2.11',
    '2.33',
    '2.56',
    '2.78',
    '3.00',
    '3.22',
    '3.44',
    '3.67',
    '3.89',
    '4.11',
    '4.33',
    '4.56',
    '4.78',
    '5.00',
  ]"
  :height="220"
  x-label="R₀"
  y-label="Frequency"
/>
```

  </template>
</ComponentDemo>

### Logarithmic value axis

Set `value-scale-type="log"` to switch the value axis to base-10 log
scaling. Non-positive values collapse to the axis floor, and
`valueMin <= 0` is ignored. With `layout="stacked"`, individual segment
sizes are no longer proportional to their raw values, but the cumulative
top still represents the sum.

<ComponentDemo>
  <BarChart
    :data="[3, 24, 180, 1450, 9800]"
    :categories="['Wk1', 'Wk2', 'Wk3', 'Wk4', 'Wk5']"
    value-scale-type="log"
    :height="220"
    x-label="Week"
    y-label="Cases"
  />

<template #code>

```vue
<BarChart
  :data="[3, 24, 180, 1450, 9800]"
  :categories="['Wk1', 'Wk2', 'Wk3', 'Wk4', 'Wk5']"
  value-scale-type="log"
  :height="220"
  x-label="Week"
  y-label="Cases"
/>
```

  </template>
</ComponentDemo>

### Grid lines

Value-axis grid lines are on by default. Set `value-grid` to `false` to
drop them, or pass a `GridStyle` object to change their weight, color,
opacity, or pattern (`lineStyle: "dashed" | "dotted"`, or a raw
`lineDash`). The chart-level `grid-style` prop supplies the same defaults
on both charts; see
[GridStyle](./line-chart#gridstyle) for the fields.

<ComponentDemo>
  <BarChart
    :series="[
      { data: [42, 55, 61, 48], color: '#0057b7', legend: 'Scenario A' },
      { data: [35, 47, 52, 44], color: '#fb7e38', legend: 'Scenario B' },
    ]"
    :categories="['Q1', 'Q2', 'Q3', 'Q4']"
    :height="220"
    y-label="Cases"
    :value-grid="{ lineStyle: 'dashed', color: '#6b7280', opacity: 0.4 }"
  />

<template #code>

```vue
<BarChart
  :series="series"
  :categories="['Q1', 'Q2', 'Q3', 'Q4']"
  :height="220"
  y-label="Cases"
  :value-grid="{ lineStyle: 'dashed', color: '#6b7280', opacity: 0.4 }"
/>
```

  </template>
</ComponentDemo>

### Value labels on bars

Set `bar-labels` to write values directly on the bars (pair with
`:value-axis="false"` for an axis-free look). Pass an options object to tune:

- `format`: a `NumberFormat` or `(value, ctx) => string` (`ctx` has
  `categoryIndex` / `seriesIndex`); return `""` to drop a label.
- `align`: `"center"` (default), `"start"`, or `"end"` within the segment.
- `color`: auto-contrast per segment by default, or a fixed color.
- Small/overlapping labels overflow past the segment edge and are spread
  apart (`overlap: "shift"`) or dropped (`overlap: "hide"`).

`category-header` / `value-header` title the two columns, and
`category-align="start"` left-aligns the category labels.

<ComponentDemo>
  <BarChart
    :series="[
      { data: [99, 88, 50, 1], legend: 'High', color: '#3f1f5e' },
      { data: [0.5, 10, 30, 20], legend: 'Medium', color: '#8a5fb0' },
      { data: [0.5, 2, 20, 79], legend: 'Low', color: '#c9aee0' },
    ]"
    :categories="['Alpha', 'Beta', 'Gamma', 'Delta']"
    title="Projected outbreak size by scenario"
    :title-style="{ fontSize: 16 }"
    orientation="horizontal"
    layout="stacked"
    :value-axis="false"
    category-header="Scenario"
    value-header="Proportion of simulations in each category"
    category-align="start"
    :height="260"
    :chart-padding="{ left: 18, right: 64 }"
    :tick-label-style="{ fontSize: 11, color: 'currentColor' }"
    :bar-labels="{
      align: 'start',
      fontWeight: 600,
      format: (v, { categoryIndex }) =>
        v < 1
          ? '<1%'
          : categoryIndex === 0
            ? `${Math.round(v)}%`
            : String(Math.round(v)),
    }"
  />

<template #code>

```vue
<BarChart
  :series="[
    { data: [99, 88, 50, 1], legend: 'High', color: '#3f1f5e' },
    { data: [0.5, 10, 30, 20], legend: 'Medium', color: '#8a5fb0' },
    { data: [0.5, 2, 20, 79], legend: 'Low', color: '#c9aee0' },
  ]"
  :categories="['Alpha', 'Beta', 'Gamma', 'Delta']"
  title="Projected outbreak size by scenario"
  :title-style="{ fontSize: 16 }"
  orientation="horizontal"
  layout="stacked"
  :value-axis="false"
  category-header="Scenario"
  value-header="Proportion of simulations in each category"
  category-align="start"
  :height="260"
  :chart-padding="{ left: 18, right: 64 }"
  :tick-label-style="{ fontSize: 11, color: 'currentColor' }"
  :bar-labels="{
    align: 'start',
    fontWeight: 600,
    format: (v, { categoryIndex }) =>
      v < 1
        ? '<1%'
        : categoryIndex === 0
          ? `${Math.round(v)}%`
          : String(Math.round(v)),
  }"
/>
```

  </template>
</ComponentDemo>

#### Small segments

A single proportion bar with two tiny tail segments (98% / 1% / 1%). The
dominant segment labels inside; the two slivers can't fit their text, so the
labels overflow to the right and the overlap pass spreads them apart instead
of letting them pile up.

<ComponentDemo>
  <BarChart
    :series="[
      { data: [98], legend: 'Recovered', color: '#3f1f5e' },
      { data: [1], legend: 'Hospitalized', color: '#8a5fb0' },
      { data: [1], legend: 'Deceased', color: '#c9aee0' },
    ]"
    :categories="['Outcome']"
    orientation="horizontal"
    layout="stacked"
    :value-axis="false"
    :height="120"
    :chart-padding="{ left: 60, right: 40 }"
    :bar-labels="{ format: (v) => `${v}%` }"
  />

<template #code>

```vue
<BarChart
  :series="[
    { data: [98], legend: 'Recovered', color: '#3f1f5e' },
    { data: [1], legend: 'Hospitalized', color: '#8a5fb0' },
    { data: [1], legend: 'Deceased', color: '#c9aee0' },
  ]"
  :categories="['Outcome']"
  orientation="horizontal"
  layout="stacked"
  :value-axis="false"
  :height="120"
  :chart-padding="{ left: 60, right: 40 }"
  :bar-labels="{ format: (v) => `${v}%` }"
/>
```

  </template>
</ComponentDemo>

## Overlays

### Summary line overlay

Layer a curve (KDE, rolling mean, target) on top of the bars with
`summary-lines`. By default each line scales to **its own value extent**,
independent of the bar axis, so a probability-density curve in
`[0, 0.02]` and a histogram in `[0, 500]` can share the same chart.

<ComponentDemo>
  <BarChart
    :data="[3, 5, 8, 12, 18, 24, 31, 27, 22, 16, 11, 7, 4, 2]"
    :categories="['2.11', '2.33', '2.56', '2.78', '3.00', '3.22', '3.44', '3.67', '3.89', '4.11', '4.33', '4.56', '4.78', '5.00']"
    :summary-lines="[
      {
        data: [0.05, 0.10, 0.20, 0.40, 0.75, 1.10, 1.32, 1.20, 0.92, 0.60, 0.32, 0.16, 0.07, 0.03],
        color: '#ef4444',
        strokeWidth: 2,
        legend: 'KDE',
      },
    ]"
    :width="380"
    :height="240"
    x-label="R₀"
    y-label="Frequency"
  />

<template #code>

```vue
<BarChart
  :data="[3, 5, 8, 12, 18, 24, 31, 27, 22, 16, 11, 7, 4, 2]"
  :categories="[
    '2.11',
    '2.33',
    '2.56',
    '2.78',
    '3.00',
    '3.22',
    '3.44',
    '3.67',
    '3.89',
    '4.11',
    '4.33',
    '4.56',
    '4.78',
    '5.00',
  ]"
  :summary-lines="[
    {
      data: [
        0.05, 0.1, 0.2, 0.4, 0.75, 1.1, 1.32, 1.2, 0.92, 0.6, 0.32, 0.16, 0.07,
        0.03,
      ],
      color: '#ef4444',
      strokeWidth: 2,
      legend: 'KDE',
    },
  ]"
  :height="240"
  x-label="R₀"
  y-label="Frequency"
/>
```

  </template>
</ComponentDemo>

Set `scale: "shared"` to plot a line on the bars' own value axis instead,
for a line in the same units as the bars: a rolling mean over daily
counts, or a target. The axis grows to fit the line, and the line's
`valueMin` / `valueMax` are ignored.

<ComponentDemo>
  <BarChart
    :data="[4, 7, 5, 9, 12, 10, 15, 18, 14, 20, 23, 19, 26, 24]"
    :summary-lines="[
      {
        x: [6, 7, 8, 9, 10, 11, 12, 13],
        data: [9, 10.9, 11.9, 14, 15.9, 17, 19.3, 20.6],
        scale: 'shared',
        curve: 'monotone',
        color: '#ef4444',
        strokeWidth: 2,
        legend: '7-day mean',
      },
    ]"
    :height="240"
    x-label="Day"
    y-label="Cases"
  />

<template #code>

```vue
<BarChart
  :data="[4, 7, 5, 9, 12, 10, 15, 18, 14, 20, 23, 19, 26, 24]"
  :summary-lines="[
    {
      x: [6, 7, 8, 9, 10, 11, 12, 13],
      data: [9, 10.9, 11.9, 14, 15.9, 17, 19.3, 20.6],
      scale: 'shared',
      curve: 'monotone',
      color: '#ef4444',
      strokeWidth: 2,
      legend: '7-day mean',
    },
  ]"
  :height="240"
  x-label="Day"
  y-label="Cases"
/>
```

  </template>
</ComponentDemo>

Each line accepts `color`, `strokeWidth`, `dashed`, `opacity`,
`blendMode`, `curve` (`"step-after"`, `"monotone"`, ...; see
LineChart's [Curves](./line-chart#curves)), `dots`, and `dotRadius` for
styling (`dotRadius` can be one radius per point), the same vocabulary as
`LineChart` series (both extend `LineMarkStyle`). Override the line's
extent with `valueMin` / `valueMax`. Pass `x: number[]` (in
category-index space: `0` is the first category center, fractional
values land between) to plot at custom positions; useful when the
summary samples are denser or sparser than the histogram bins.

### Intervals

Give a series parallel `lower` and `upper` arrays to draw a whisker on
every bar: a line between the bounds with end caps, centered on the bar.
Whiskers draw in `currentColor` (the chart's text color) rather than the
series color, since a bar-colored whisker would vanish wherever it
overlaps the bar; set `color` in `intervalStyle` to change it. Bounds are
absolute values on the value axis
(not offsets from the bar), including in `stacked` layout, and the axis
extends to cover them. Whiskers follow the series' legend toggle, show up
in the tooltip as a range, and export as extra `_lower` / `_upper` CSV
columns.

<ComponentDemo>
  <BarChart
    data-testid="interval-bar-chart"
    :series="[
      {
        data: [42, 55, 61, 48],
        lower: [36, 49, 54, 41],
        upper: [48, 61, 68, 55],
        color: '#0057b7',
        legend: 'Scenario A',
      },
      {
        data: [35, 47, 52, 44],
        lower: [30, 41, 46, 38],
        upper: [40, 53, 58, 50],
        color: '#ef4444',
        legend: 'Scenario B',
      },
    ]"
    :categories="['Q1', 'Q2', 'Q3', 'Q4']"
    :interval-style="{ capWidth: 6 }"
    :height="240"
    value-label="Cases"
    tooltip-trigger="hover"
  />

<template #code>

```vue
<BarChart
  :series="[
    {
      data: [42, 55, 61, 48],
      lower: [36, 49, 54, 41],
      upper: [48, 61, 68, 55],
      color: '#0057b7',
      legend: 'Scenario A',
    },
    {
      data: [35, 47, 52, 44],
      lower: [30, 41, 46, 38],
      upper: [40, 53, 58, 50],
      color: '#ef4444',
      legend: 'Scenario B',
    },
  ]"
  :categories="['Q1', 'Q2', 'Q3', 'Q4']"
  :interval-style="{ capWidth: 6 }"
  :height="240"
  value-label="Cases"
  tooltip-trigger="hover"
/>
```

  </template>
</ComponentDemo>

Standalone `intervals` place a whisker at a category index (fractional
values land between categories) independent of any series, with an
optional `value` dot. Add `seriesIndex` to center it on one series' bar
within a grouped category. In horizontal
orientation the whisker runs sideways and the caps stand upright. See
[`LineChart` → Intervals](./line-chart#intervals) for the full
`ChartInterval` / `IntervalStyle` shape and the chart-level
`intervalStyle` defaults.

<ComponentDemo>
  <BarChart
    :data="[18, 27, 31, 22]"
    :categories="['North', 'South', 'East', 'West']"
    :intervals="[
      { x: 1, lower: 22, upper: 34, value: 29 },
      { x: 2, lower: 26, upper: 38, value: 33, color: '#c2410c' },
    ]"
    :interval-style="{ lineWidth: 2, capWidth: 10, outlineWidth: 2 }"
    orientation="horizontal"
    :height="220"
    value-label="Observed vs. modeled"
  />

<template #code>

```vue
<BarChart
  :data="[18, 27, 31, 22]"
  :categories="['North', 'South', 'East', 'West']"
  :intervals="[
    { x: 1, lower: 22, upper: 34, value: 29 },
    { x: 2, lower: 26, upper: 38, value: 33, color: '#c2410c' },
  ]"
  :interval-style="{ lineWidth: 2, capWidth: 10, outlineWidth: 2 }"
  orientation="horizontal"
  :height="220"
  value-label="Observed vs. modeled"
/>
```

  </template>
</ComponentDemo>

### Annotations

Pin callouts to specific bars with `annotations`. `x` is the category
index (fractional values land between categories, e.g. `x: 1.5` sits at
the boundary between categories 1 and 2). `y` is on the value axis. See
[`LineChart` → Annotations](./line-chart#annotations) for the full
`ChartAnnotation` shape.

<ComponentDemo>
  <BarChart
    :data="[12, 19, 7, 24, 16]"
    :categories="['Mon', 'Tue', 'Wed', 'Thu', 'Fri']"
    :annotations="[
      { x: 3, y: 24, offset: { x: 18, y: -22 }, text: 'Peak day' },
    ]"
    :chart-padding="{ top: 32, right: 32 }"
    :height="240"
    x-label="Day"
    y-label="Cases"
  />

<template #code>

```vue
<BarChart
  :data="[12, 19, 7, 24, 16]"
  :categories="['Mon', 'Tue', 'Wed', 'Thu', 'Fri']"
  :annotations="[{ x: 3, y: 24, offset: { x: 18, y: -22 }, text: 'Peak day' }]"
  :chart-padding="{ top: 32, right: 32 }"
  :height="240"
  x-label="Day"
  y-label="Cases"
/>
```

  </template>
</ComponentDemo>

`chart-padding` reserves extra space outside the plot so the annotation
label and pointer don't get clipped by the data area. Pass a number for
uniform padding or an object with `top` / `right` / `bottom` / `left`.

Set `pointer` to a rule value (`"ruleX"`, `"ruleY"`, `"ruleUp"`,
`"ruleDown"`, `"ruleFromLeft"`, `"ruleFromRight"`) to draw a line
through the anchor instead of the default curved connector. The first
two span the full plot; the latter four extend from one edge to the
anchor. `lineColor`, `lineWidth`, and `lineDash` style the line.

<ComponentDemo>
  <BarChart
    :data="[12, 19, 7, 24, 16]"
    :categories="['Mon', 'Tue', 'Wed', 'Thu', 'Fri']"
    :annotations="[
      {
        x: 0,
        y: 15.6,
        offset: { x: 6, y: -6 },
        text: 'Avg 15.6',
        pointer: 'ruleY',
        lineDash: '4 3',
      },
      {
        x: 3,
        y: 20,
        offset: { x: 8, y: 4 },
        text: 'Target hit',
        pointer: 'ruleFromLeft',
        lineColor: '#0a7',
      },
    ]"
    :chart-padding="{ top: 24, right: 24 }"
    :height="240"
    x-label="Day"
    y-label="Cases"
  />

<template #code>

```vue
<BarChart
  :data="[12, 19, 7, 24, 16]"
  :categories="['Mon', 'Tue', 'Wed', 'Thu', 'Fri']"
  :annotations="[
    {
      x: 0,
      y: 15.6,
      offset: { x: 6, y: -6 },
      text: 'Avg 15.6',
      pointer: 'ruleY',
      lineDash: '4 3',
    },
    {
      x: 3,
      y: 20,
      offset: { x: 8, y: 4 },
      text: 'Target hit',
      pointer: 'ruleFromLeft',
      lineColor: '#0a7',
    },
  ]"
  :chart-padding="{ top: 24, right: 24 }"
  :height="240"
  x-label="Day"
  y-label="Cases"
/>
```

  </template>
</ComponentDemo>

## Interaction

### Tooltip

Rows are named by `legend` or `tooltipLabel`, and `tooltip-title` formats the heading. The slot works like [LineChart's](./line-chart#tooltip), plus `category`.

On touch devices the tooltip scrubs along the category axis: drag horizontally on a vertical (column) chart and vertically on a horizontal chart. A swipe in the other direction scrolls the page instead of being captured by the chart.

<ComponentDemo>
  <BarChart
    :series="[
      { data: [12, 19, 7, 24], legend: '2024', color: '#0057b7' },
      { data: [15, 22, 9, 20], legend: '2025', color: '#fb7e38' },
    ]"
    :categories="['North', 'South', 'East', 'West']"
    :height="220"
    y-label="Cases"
    tooltip-trigger="hover"
    :tooltip-title="(label) => `${label} region`"
  />

<template #code>

```vue
<BarChart
  :series="[
    { data: [12, 19, 7, 24], legend: '2024', color: '#0057b7' },
    { data: [15, 22, 9, 20], legend: '2025', color: '#fb7e38' },
  ]"
  :categories="['North', 'South', 'East', 'West']"
  :height="220"
  y-label="Cases"
  tooltip-trigger="hover"
  :tooltip-title="(label) => `${label} region`"
/>
```

  </template>
</ComponentDemo>

### Zoom

Set `zoom` to let readers click and drag on the plot to zoom. One gesture
covers two kinds of zoom:

- **Along the categories:** a roughly straight drag along the category
  axis (horizontal for vertical bars, vertical for horizontal bars)
  selects a run of whole categories. The value axis rescales to the
  visible bars.
- **Box:** once the drag also covers about 24px on the value axis, the
  selection becomes a box and the value axis zooms to it too.

Pass `zoom="x"` to allow only the category zoom, whatever the drag's
shape. While zoomed, marks outside the window are clipped at the edges
the window cuts through; marks on an edge that is the visible data's own
boundary (a whisker's dot at the top of the rescaled value axis) are left
whole. A reset button appears at the top right; double-clicking the plot
also resets, and <kbd>Esc</kbd> cancels a drag in progress.

Drag-to-zoom is a mouse gesture. On touch screens (and with a pen) a drag
keeps scrubbing the tooltip and scrolling the page, so the chart stays at
its full extent there.

<ComponentDemo>
  <BarChart
    data-testid="zoom-bar-chart"
    :data="Array.from({ length: 40 }, (_, i) => Math.round(200 * Math.exp(-((i - 14) ** 2) / 40) + 5))"
    :height="220"
    x-label="Week"
    y-label="Cases"
    tooltip-trigger="hover"
    zoom
  />

<template #code>

```vue
<BarChart
  :data="weeklyCases"
  :height="220"
  x-label="Week"
  y-label="Cases"
  tooltip-trigger="hover"
  zoom
/>
```

  </template>
</ComponentDemo>

### Toggle series from the legend

Set `legend-toggle` to let readers show and hide marks by clicking their
legend item. Every series and summary line with a `legend` label becomes
toggleable; marks that share a label toggle together. A hidden mark leaves
the plot and the tooltip, its legend item dims with a strikethrough, and
the value axis rescales to what is still shown. CSV downloads always include
every series.

The chart tracks the hidden labels itself. Bind `v-model:hidden-series` (an
array of legend labels) to read the state, set an initial selection, or
drive it from your own controls; `hidden-series` works without
`legend-toggle` too.

<ComponentDemo>
  <BarChart
    data-testid="legend-toggle-bar-chart"
    :series="[
      { data: [120, 180, 90, 60], legend: 'Unvaccinated', color: '#0057b7' },
      { data: [30, 45, 20, 12], legend: 'Vaccinated', color: '#fb7e38' },
    ]"
    :categories="['0-17', '18-49', '50-64', '65+']"
    :height="220"
    y-label="Cases"
    tooltip-trigger="hover"
    legend-toggle
  />

<template #code>

```vue
<BarChart
  :series="[
    { data: unvaccinated, legend: 'Unvaccinated', color: '#0057b7' },
    { data: vaccinated, legend: 'Vaccinated', color: '#fb7e38' },
  ]"
  :categories="['0-17', '18-49', '50-64', '65+']"
  :height="220"
  y-label="Cases"
  tooltip-trigger="hover"
  legend-toggle
  v-model:hidden-series="hidden"
/>
```

  </template>
</ComponentDemo>

## Accessibility

The chart's `<svg>` is exposed as a single labeled image so screen readers
announce one accessible name instead of wandering through the individual bars.
When the chart has a `title`, the `<svg>` gets `role="img"` and an `aria-label`
set to the title. The menu and download controls live outside the `<svg>`, so
they stay reachable regardless.

Set `ariaLabel` to give screen readers a fuller summary than the visible title
(it overrides `title` for the accessible name only):

```vue
<BarChart
  :data="cases"
  :categories="regions"
  title="Cases by region"
  aria-label="Cases by region: North 120, South 80, West 45"
/>
```

Pass `role` to override the default `"img"` (e.g. `role="figure"`, or a role of
your own).

With `legend-toggle`, each toggleable legend item is a real `<button>` laid
over the legend, outside the `<svg>`. The buttons sit in a group named "Show
or hide series", are reachable with <kbd>Tab</kbd>, activate with
<kbd>Enter</kbd> or <kbd>Space</kbd>, and report whether the mark is shown
through `aria-pressed`. They stay in place while the chart is expanded.

<!-- @include: ./_api/bar-chart.md -->
