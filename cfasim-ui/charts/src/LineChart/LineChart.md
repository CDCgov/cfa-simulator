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

### Dates

Pass ISO date strings (`YYYY-MM-DD`) or `Date` objects as `x` and the
chart auto-detects a date axis: ticks anchor to year / month / week /
day / hour boundaries depending on the visible range, and labels
format themselves accordingly. Numeric `x` arrays keep their existing
behavior — auto-detection is content-driven and never promotes plain
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
> chart's resolved coordinate space — that's **epoch-ms** when the axis
> is in date mode. Pass `Date.UTC(2026, 0, 15)`, `new Date("2026-01-15").getTime()`,
> or `Date.parse("2026-01-15T00:00:00Z")`. Passing a small integer like
> `0` will place the annotation at 1970-01-01 (off-screen).
>
> **`xLabels` on a date axis.** When both `x: [...date strings]` and
> `xLabels` are supplied, the date axis wins — `xLabels` is ignored.
> Date strings carry their own labeling.

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

### Outline

Set `outline: true` on a series to draw a page-colored stroke behind the
line. This is useful when lines overlap, cross dense areas, or sit on a
busy background — the outline keeps each series visually distinct.

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

### Blend mode

Set `blendMode` on a `Series` to apply a CSS `mix-blend-mode` to that
series' line (and dots, if enabled). Useful when two thick or
high-contrast lines overlap — `"multiply"` darkens the crossing point
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
pointer line connects the anchor to the label, and the label gets an
outline stroke matching the background so it stays legible over series
lines.

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
  outlineColor?: string; // background-matched outline (default: var(--color-bg-0, #fff))
  outlineWidth?: number; // default: 3
  align?: "left" | "center" | "right"; // default: derived from offset[0] sign
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
        align: 'right',
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
      align: 'right',
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

### Chart menu

The chart menu (top-right) leads with Fullscreen and then Save as SVG,
Save as PNG, and Download CSV. Fullscreen grows the chart to fill the browser
window so the plot has more room; while expanded the menu trigger is replaced
by a close (✕) button — click it or press <kbd>Esc</kbd> to return to the
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

Pass `download-link` to also render a plain text link below the chart — set
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
  outline?: boolean; // page-colored stroke drawn behind the line
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
