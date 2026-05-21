---
keywords: [line, chart, time-series, series, axis, area, confidence band, svg]
---

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

### Tooltip

Hover over the chart to see a tooltip with values at each data point. Set `tooltip-trigger="hover"` to enable the built-in tooltip with crosshair and highlight dots. Use the `#tooltip` slot for custom content. Pass `tooltip-value-format` to control how numeric values render (e.g. percentages, currency); it falls back to `y-tick-format` when omitted.

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

### Confidence band

Use the `areas` prop to fill a band between two y-series — useful for
confidence intervals or min/max envelopes around a mean line. Each `Area`
takes parallel `upper` and `lower` arrays (and an optional `x` array, just
like `Series`).

<ComponentDemo>
  <LineChart
    :data="[0, 4, 8, 15, 22, 30, 28, 20, 12, 5, 2]"
    :areas="[
      {
        upper: [2, 8, 14, 22, 30, 38, 36, 28, 19, 11, 7],
        lower: [0, 1, 3, 9, 15, 22, 21, 13, 6, 1, 0],
        color: '#0057b7',
        opacity: 0.15,
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

### Annotations

Pin callouts to data points with `annotations`. Each annotation anchors at
`(x, y)` in data coordinates (the same x-space as the chart axis, so it
respects `xMin` and explicit `x` values), with a pixel
`offset: { x, y }` for the label position. Text supports `\n` for line
breaks. A curved
pointer line connects the anchor to the label, and the label gets a halo
stroke matching the background so it stays legible over series lines.

<ComponentDemo>
  <LineChart
    :data="[0, 4, 8, 15, 22, 30, 28, 20, 12, 5, 2]"
    :annotations="[
      { x: 5, y: 30, offset: { x: 24, y: -28 }, text: 'Peak\nDay 5' },
      { x: 0, y: 0, offset: { x: 28, y: -22 }, text: 'Onset' },
    ]"
    :chart-padding="{ top: 40, right: 24 }"
    :height="240"
    x-label="Days"
    y-label="Cases"
  />

<template #code>

```vue
<LineChart
  :data="[0, 4, 8, 15, 22, 30, 28, 20, 12, 5, 2]"
  :annotations="[
    { x: 5, y: 30, offset: { x: 24, y: -28 }, text: 'Peak\nDay 5' },
    { x: 0, y: 0, offset: { x: 28, y: -22 }, text: 'Onset' },
  ]"
  :chart-padding="{ top: 40, right: 24 }"
  :height="240"
  x-label="Days"
  y-label="Cases"
/>
```

  </template>
</ComponentDemo>

Use `chart-padding` to reserve room outside the plot so annotations (or
any other overlay) don't clip the data area. It accepts a number (same on
all sides) or an object with `top`, `right`, `bottom`, `left`.

Annotation text supports a small set of inline markers:

- `**bold**` — bold
- `_italic_` — italic
- `\n` — line break

Markers compose (`**_bold italic_**`).

<ComponentDemo>
  <LineChart
    :data="[0, 4, 8, 15, 22, 30, 28, 20, 12, 5, 2]"
    :annotations="[
      { x: 5, y: 30, offset: { x: 24, y: -28 }, text: '**Peak**\n_Day 5_' },
    ]"
    :chart-padding="{ top: 40, right: 24 }"
    :height="240"
    x-label="Days"
    y-label="Cases"
  />

<template #code>

```vue
<LineChart
  :data="[0, 4, 8, 15, 22, 30, 28, 20, 12, 5, 2]"
  :annotations="[
    { x: 5, y: 30, offset: { x: 24, y: -28 }, text: '**Peak**\n_Day 5_' },
  ]"
  :chart-padding="{ top: 40, right: 24 }"
  :height="240"
  x-label="Days"
  y-label="Cases"
/>
```

  </template>
</ComponentDemo>

```ts
interface ChartAnnotation {
  x: number; // anchor in data coords (x-axis)
  y: number; // anchor in data coords (y-axis)
  text: string; // label text; \n produces line breaks
  offset: { x: number; y: number }; // pixel offset from anchor to label
  color?: string; // text / pointer color (default: currentColor)
  fontSize?: number; // default: 13 (matches axis labels)
  fontWeight?: string | number; // default: "normal"
  haloColor?: string; // background-matched halo (default: var(--color-bg-0, #fff))
  haloWidth?: number; // default: 3
  textAnchor?: "start" | "middle" | "end"; // default: derived from offset[0] sign
  lineColor?: string; // connector-line color override (default: color)
  lineWidth?: number; // default: 1
  lineDash?: string | number | readonly number[]; // SVG stroke-dasharray
  // default: "curved"
  // "ruleX" / "ruleY" span the full plot on the named axis;
  // "ruleUp" / "ruleDown" / "ruleFromLeft" / "ruleFromRight" run from an edge to the anchor.
  pointer?:
    | "curved"
    | "straight"
    | "none"
    | "ruleX"
    | "ruleY"
    | "ruleUp"
    | "ruleDown"
    | "ruleFromLeft"
    | "ruleFromRight";
  arrow?: boolean; // triangle marker at the anchor end (default: true)
}
```

### Rules

Set `pointer` to one of the rule values to replace the curved /
straight connector with a straight line through the anchor:

- `"ruleX"` — vertical line spanning the plot height at the annotation's `x`.
- `"ruleY"` — horizontal line spanning the plot width at the annotation's `y`.
- `"ruleUp"` — vertical from the bottom edge up to the anchor.
- `"ruleDown"` — vertical from the top edge down to the anchor.
- `"ruleFromLeft"` — horizontal from the left edge in to the anchor.
- `"ruleFromRight"` — horizontal from the right edge in to the anchor.

`lineColor`, `lineWidth`, and `lineDash` style the line. The label is
positioned from the anchor as usual via `offset`.

<ComponentDemo>
  <LineChart
    :data="[0, 4, 8, 15, 22, 30, 28, 20, 12, 5, 2]"
    :annotations="[
      {
        x: 5,
        y: 30,
        offset: { x: 8, y: 14 },
        text: 'Peak',
        pointer: 'ruleX',
        lineDash: '4 3',
      },
      {
        x: 5,
        y: 30,
        offset: { x: -8, y: -6 },
        text: 'Max',
        textAnchor: 'end',
        pointer: 'ruleFromLeft',
        lineDash: '4 3',
      },
    ]"
    :chart-padding="{ top: 24, right: 24 }"
    :height="240"
    x-label="Days"
    y-label="Cases"
  />

<template #code>

```vue
<LineChart
  :data="[0, 4, 8, 15, 22, 30, 28, 20, 12, 5, 2]"
  :annotations="[
    {
      x: 5,
      y: 30,
      offset: { x: 8, y: 14 },
      text: 'Peak',
      pointer: 'ruleX',
      lineDash: '4 3',
    },
    {
      x: 5,
      y: 30,
      offset: { x: -8, y: -6 },
      text: 'Max',
      textAnchor: 'end',
      pointer: 'ruleFromLeft',
      lineDash: '4 3',
    },
  ]"
  :chart-padding="{ top: 24, right: 24 }"
  :height="240"
  x-label="Days"
  y-label="Cases"
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

### Data

`data`, `series[].data`, and `areas[].upper`/`lower` accept a plain
`number[]` or any standard numeric typed array (`Float64Array`,
`Int32Array`, etc.). This lets you pass the output of
`ModelOutput.column()` directly — no `Array.from(...)` copy is needed:

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

### Series

```ts
interface Series {
  y?: LineChartData; // y-values (preferred)
  data?: LineChartData; // y-values (alternative name; one of y/data must be set)
  x?: LineChartData; // optional parallel x-values
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

### Area

```ts
interface Area {
  upper: LineChartData;
  lower: LineChartData;
  x?: LineChartData; // optional parallel x-values
  color?: string;
  opacity?: number;
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
