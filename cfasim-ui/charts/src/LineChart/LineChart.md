# LineChart

A responsive SVG line chart with support for multiple series, axis labels, and custom styling.

## Examples

### Single series

<ComponentDemo>
  <LineChart :data="[0, 4, 8, 15, 22, 30, 28, 20, 12, 5, 2]" :height="200" x-label="Days" y-label="Cases" />

<template #code>

```vue
<LineChart
  :data="[0, 4, 8, 15, 22, 30, 28, 20, 12, 5, 2]"
  :height="200"
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

<!--@include: ./_api/line-chart.md-->

### Series

```ts
interface Series {
  data: number[];
  color?: string;
  dashed?: boolean;
  strokeWidth?: number;
  opacity?: number;
}
```
