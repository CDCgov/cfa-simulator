---
keywords:
  [bar, column, chart, categorical, grouped, stacked, vertical, horizontal, svg]
---

# BarChart

A responsive SVG bar chart supporting single, grouped, and stacked series in
either vertical (column) or horizontal orientation. Shares axis, tooltip,
menu, and CSV export wiring with [`LineChart`](./line-chart).

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

## API

<!-- @include: ./_api/bar-chart.md -->
