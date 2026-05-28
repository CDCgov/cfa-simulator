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
    svg,
  ]
---

# BarChart

A responsive SVG bar chart supporting single, grouped, stacked, and overlay
series in either vertical (column) or horizontal orientation. Shares axis,
tooltip, menu, and CSV export wiring with [`LineChart`](./line-chart).

## Examples

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
depending on range). Bar positions stay ordinal — every category gets
a bar — only the labels are thinned.

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
Every bar still renders — only the tick labels are skipped.

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

### Annotations

Pin callouts to specific bars with `annotations`. `x` is the category
index (fractional values land between categories — e.g. `x: 1.5` sits at
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

## API

<!-- @include: ./_api/bar-chart.md -->
