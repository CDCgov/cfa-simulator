# LineChart

A responsive SVG line chart with support for multiple series, axis labels, and custom styling.

## Examples

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

### Multiple series

<ComponentDemo>
  <LineChart
    :series="[
      { data: [0, 10, 25, 45, 60, 55, 40, 20, 8], color: '#fb7e38', strokeWidth: 3 },
      { data: [0, 5, 12, 20, 28, 25, 18, 10, 4], color: '#0057b7', strokeWidth: 3 },
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
      data: [0, 5, 12, 20, 28, 25, 18, 10, 4],
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

### Tooltip

Hover over the chart to see a tooltip with values at each data point. Set `tooltip-trigger="hover"` to enable the built-in tooltip with crosshair and highlight dots. Use the `#tooltip` slot for custom content.

<ComponentDemo>
  <LineChart
    :series="[
      { data: [0, 10, 25, 45, 60, 55, 40, 20, 8], color: '#fb7e38', strokeWidth: 3 },
      { data: [0, 5, 12, 20, 28, 25, 18, 10, 4], color: '#0057b7', strokeWidth: 3 },
    ]"
    :x-tick-format="(_, i) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'][i]"
    :height="200"
    x-label="Month"
    y-label="Incidence"
    tooltip-trigger="hover"
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
      data: [0, 5, 12, 20, 28, 25, 18, 10, 4],
      color: '#0057b7',
      strokeWidth: 3,
    },
  ]"
  :x-tick-format="(_, i) => months[i]"
  :height="200"
  x-label="Month"
  y-label="Incidence"
  tooltip-trigger="hover"
/>
```

  </template>
</ComponentDemo>

### Custom axis ticks

Control tick placement with `x-ticks` and `y-ticks`. Pass a **number** for a fixed interval (in data units, respecting `xMin`) or an **array** of explicit values. Use `x-tick-format` / `y-tick-format` to customize labels.

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

### Dashed baseline

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

### Many trajectories with low opacity

<ComponentDemo>
  <LineChart
    :series="Array.from({ length: 20 }, (_, i) => ({
      data: Array.from({ length: 50 }, (_, t) => Math.max(0, 30 * Math.sin(t / 8) + (Math.random() - 0.5) * 15 + i * 0.5)),
      color: '#0057b7',
    }))"
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

### Grid lines

<ComponentDemo>
  <LineChart
    :series="[
      { data: [0, 10, 25, 45, 60, 55, 40, 20, 8], color: '#fb7e38', strokeWidth: 3 },
      { data: [0, 5, 12, 20, 28, 25, 18, 10, 4], color: '#0057b7', strokeWidth: 3 },
    ]"
    :height="200"
    x-label="Weeks"
    y-label="Incidence"
    x-grid
    y-grid
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
      data: [0, 5, 12, 20, 28, 25, 18, 10, 4],
      color: '#0057b7',
      strokeWidth: 3,
    },
  ]"
  :height="200"
  x-label="Weeks"
  y-label="Incidence"
  x-grid
  y-grid
/>
```

  </template>
</ComponentDemo>

### Dots

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

### Area sections

Highlight a range of a series line by filling the area between the line and the x-axis. Labels are rendered below the chart and automatically stack when they overlap.

<ComponentDemo>
  <LineChart
    :series="[
      { data: [0, 2, 5, 12, 25, 45, 70, 100, 130, 155, 170], color: '#000', strokeWidth: 1, legend: 'No interventions' },
      { data: [0, 0, 0, 2, 8, 20, 40, 65, 90, 110, 120], color: '#999', strokeWidth: 1, dashed: true, legend: 'Interventions' },
    ]"
    :area-sections="[
      { startIndex: 2, endIndex: 7, color: '#6366f1', strokeWidth: 0, legend: 'inline', label: 'Day 2–7', description: 'Rapid growth phase' },
      { seriesIndex: 0, startIndex: 5, endIndex: 9, color: '#f43f5e', label: 'Day 5–9', description: 'Mitigation period' },
    ]"
    :height="250"
    x-label="Days"
    y-label="Cumulative count"
    tooltip-trigger="hover"
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
    {
      data: [0, 0, 0, 2, 8, 20, 40, 65, 90, 110, 120],
      color: '#999',
      strokeWidth: 1,
      dashed: true,
      legend: 'Interventions',
    },
  ]"
  :area-sections="[
    {
      startIndex: 2,
      endIndex: 7,
      color: '#6366f1',
      strokeWidth: 0,
      legend: 'inline',
      label: 'Day 2–7',
      description: 'Rapid growth phase',
    },
    {
      seriesIndex: 0,
      startIndex: 5,
      endIndex: 9,
      color: '#f43f5e',
      label: 'Day 5–9',
      description: 'Mitigation period',
    },
  ]"
  :height="250"
  x-label="Days"
  y-label="Cumulative count"
  tooltip-trigger="hover"
/>
```

  </template>
</ComponentDemo>

### Custom CSV download

By default, the Download CSV menu item exports the chart series as CSV. Use
the `csv` prop to supply your own content (for example, to include original
dates, categorical labels, or extra columns that aren't plotted). Use
`filename` to control the download filename (shared by SVG, PNG and CSV).

Pass `download-link` to also render a plain text link below the chart — set
it to `true` for the default label, or pass a string to customize it.

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

<!--@include: ./_api/line-chart.md-->

### Series

```ts
interface Series {
  data: number[];
  color?: string;
  dashed?: boolean;
  strokeWidth?: number;
  opacity?: number;
  line?: boolean;
  dots?: boolean;
  dotRadius?: number;
  dotFill?: string;
  dotStroke?: string;
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
  strokeWidth?: number; // default: 2
  dashed?: boolean;
  legend?: "inline" | "below" | false; // default: "below"
}
```
