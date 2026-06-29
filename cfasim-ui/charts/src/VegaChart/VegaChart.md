---
keywords:
  [
    vega,
    vega-lite,
    spec,
    custom,
    arbitrary,
    plot,
    visualization,
    grammar of graphics,
  ]
---

# VegaChart

An escape hatch for arbitrary plots. Pass any [Vega-Lite](https://vega.github.io/vega-lite/)
(or Vega) spec and `VegaChart` renders it, themed to match the surrounding UI in light and
dark mode. Use it when the purpose-built charts (`LineChart`, `BarChart`, `ChoroplethMap`,
`DataTable`) don't cover what you need — faceted plots, layered marks, histograms, custom
encodings, interactive selections, and so on.

The [vega-embed](https://github.com/vega/vega-embed) runtime (~hundreds of KB) is
**lazy-loaded**: it's only fetched the first time a `VegaChart` mounts, so consumers who never
use it pay nothing.

## Examples

### Basic spec with inline data

Pass the plot definition as `spec` and the data separately as `data` (a row array). The data is
merged into the spec's primary dataset, so you don't have to embed it in the spec by hand.

<ComponentDemo>
  <VegaChart
    :height="260"
    :spec="{ mark: 'bar', encoding: { x: { field: 'category', type: 'nominal' }, y: { field: 'value', type: 'quantitative' } } }"
    :data="[ { category: 'A', value: 28 }, { category: 'B', value: 55 }, { category: 'C', value: 43 }, { category: 'D', value: 91 }, { category: 'E', value: 81 } ]"
  />

<template #code>

```vue
<VegaChart
  :height="260"
  :spec="{
    mark: 'bar',
    encoding: {
      x: { field: 'category', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
    },
  }"
  :data="[
    { category: 'A', value: 28 },
    { category: 'B', value: 55 },
    { category: 'C', value: 43 },
    { category: 'D', value: 91 },
    { category: 'E', value: 81 },
  ]"
/>
```

  </template>
</ComponentDemo>

### Columnar data from model output

Model output usually arrives as parallel columns. Pass an object of arrays
(`{ name: column }`) — `VegaChart` zips them into rows. This pairs directly with
`ModelOutput.column(...)`:

<ComponentDemo>
  <VegaChart
    :height="260"
    :spec="{ mark: { type: 'line', point: true }, encoding: { x: { field: 'day', type: 'quantitative' }, y: { field: 'infected', type: 'quantitative' } } }"
    :data="{ day: [0, 1, 2, 3, 4, 5, 6], infected: [1, 12, 45, 88, 121, 96, 54] }"
  />

<template #code>

```vue
<script setup>
// const out = await model.run(params);
const data = {
  day: out.column("day"),
  infected: out.column("infected"),
};
</script>

<template>
  <VegaChart
    :height="260"
    :spec="{
      mark: { type: 'line', point: true },
      encoding: {
        x: { field: 'day', type: 'quantitative' },
        y: { field: 'infected', type: 'quantitative' },
      },
    }"
    :data="data"
  />
</template>
```

  </template>
</ComponentDemo>

### A more involved spec (faceting, color)

Anything Vega-Lite can express works — here, a multi-series scatter colored by group:

<ComponentDemo>
  <VegaChart
    :height="280"
    :spec="{ mark: 'point', encoding: { x: { field: 'x', type: 'quantitative' }, y: { field: 'y', type: 'quantitative' }, color: { field: 'group', type: 'nominal' } } }"
    :data="[ { x: 1, y: 3, group: 'a' }, { x: 2, y: 5, group: 'a' }, { x: 3, y: 4, group: 'a' }, { x: 1, y: 6, group: 'b' }, { x: 2, y: 7, group: 'b' }, { x: 3, y: 9, group: 'b' } ]"
  />

<template #code>

```vue
<VegaChart
  :height="280"
  :spec="{
    mark: 'point',
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      color: { field: 'group', type: 'nominal' },
    },
  }"
  :data="points"
/>
```

  </template>
</ComponentDemo>

### Tooltips

Tooltips are powered by [vega-tooltip](https://github.com/vega/vega-tooltip), enabled by
default (set `tooltip="false"` to turn them off). For a multi-series chart, the most useful
tooltip is a shared crosshair that lists every series at the hovered x — Vega-Lite's
canonical pattern: a `rule` layer carrying the `tooltip` channel plus a `nearest` point
selection. Hover anywhere over the lines below:

<ComponentDemo>
  <VegaChart
    :height="300"
    :spec="{ encoding: { x: { field: 'day', type: 'quantitative', title: 'Day' } }, layer: [ { transform: [{ fold: ['Susceptible', 'Infected', 'Recovered'], as: ['compartment', 'people'] }], encoding: { y: { field: 'people', type: 'quantitative', title: 'People' }, color: { field: 'compartment', type: 'nominal', title: 'Compartment' } }, layer: [ { mark: 'line' }, { transform: [{ filter: { param: 'hover', empty: false } }], mark: { type: 'point', size: 60 } } ] }, { mark: 'rule', params: [{ name: 'hover', select: { type: 'point', fields: ['day'], nearest: true, on: 'pointerover', clear: 'pointerout' } }], encoding: { opacity: { condition: { value: 0.3, param: 'hover', empty: false }, value: 0 }, tooltip: [ { field: 'day', type: 'quantitative', title: 'Day' }, { field: 'Susceptible', type: 'quantitative' }, { field: 'Infected', type: 'quantitative' }, { field: 'Recovered', type: 'quantitative' } ] } } ] }"
    :data="[ { day: 0, Susceptible: 990, Infected: 10, Recovered: 0 }, { day: 1, Susceptible: 940, Infected: 55, Recovered: 5 }, { day: 2, Susceptible: 820, Infected: 150, Recovered: 30 }, { day: 3, Susceptible: 650, Infected: 270, Recovered: 80 }, { day: 4, Susceptible: 480, Infected: 350, Recovered: 170 }, { day: 5, Susceptible: 350, Infected: 380, Recovered: 270 }, { day: 6, Susceptible: 260, Infected: 360, Recovered: 380 } ]"
  />

<template #code>

```vue
<script setup>
// Wide rows: one per day, a column per compartment.
const data = [
  { day: 0, Susceptible: 990, Infected: 10, Recovered: 0 },
  { day: 1, Susceptible: 940, Infected: 55, Recovered: 5 },
  // ...
];

const spec = {
  encoding: { x: { field: "day", type: "quantitative", title: "Day" } },
  layer: [
    {
      // `fold` turns the wide columns into one line per compartment.
      transform: [
        {
          fold: ["Susceptible", "Infected", "Recovered"],
          as: ["compartment", "people"],
        },
      ],
      encoding: {
        y: { field: "people", type: "quantitative", title: "People" },
        color: { field: "compartment", type: "nominal", title: "Compartment" },
      },
      layer: [
        { mark: "line" },
        // Emphasize the points on the hovered day.
        {
          transform: [{ filter: { param: "hover", empty: false } }],
          mark: { type: "point", size: 60 },
        },
      ],
    },
    {
      // A full-height rule at the hovered day carries the shared tooltip.
      // The selection lives on this layer (not the top level) — a top-level
      // param on a layered spec trips Vega's "Duplicate signal" error.
      mark: "rule",
      params: [
        {
          name: "hover",
          select: {
            type: "point",
            fields: ["day"],
            nearest: true,
            on: "pointerover",
            clear: "pointerout",
          },
        },
      ],
      encoding: {
        opacity: {
          condition: { value: 0.3, param: "hover", empty: false },
          value: 0,
        },
        tooltip: [
          { field: "day", type: "quantitative", title: "Day" },
          { field: "Susceptible", type: "quantitative" },
          { field: "Infected", type: "quantitative" },
          { field: "Recovered", type: "quantitative" },
        ],
      },
    },
  ],
};
</script>

<template>
  <VegaChart :height="300" :spec="spec" :data="data" />
</template>
```

  </template>
</ComponentDemo>

## Data

The `data` prop accepts three shapes, all merged into the spec at render time (the source
spec is never mutated):

| Shape                                    | Merged as                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `Row[]` (array of objects)               | the spec's primary inline dataset (`data.values`)                                      |
| `{ col: column }` (object of arrays)     | zipped into rows, then the primary dataset                                             |
| `{ name: Row[] }` (record of row arrays) | named datasets (`spec.datasets[name]`), referenced via `{ "data": { "name": "..." } }` |

A primary dataset is only injected when the spec doesn't already define `data`, so a spec
that loads its own data (e.g. from a URL) is left untouched.

## Theming

By default `VegaChart` builds a Vega config from the app's `--color-*` and `--font-family`
theme tokens, so axes, legends, titles, and the default categorical palette match the
surrounding UI and update live when the theme toggles between light and dark.

- Set `theme="false"` to opt out and use Vega's own defaults.
- Pass `config` to override or extend the auto config — your values win (deep-merged):

```vue
<VegaChart :spec="spec" :data="data" :config="{ axis: { grid: false } }" />
```

## Sizing

Omit `width` / `height` and the chart fills its container width with a default responsive
height (the spec's `width`/`height` are set to `"container"`). Provide `width` and/or `height`
(numbers, px) to pin them. The chart re-renders on container resize.

## Exporting and fullscreen

The chart options menu (top-right) offers **Fullscreen**, **Save as SVG**, **Save as PNG**
(via the Vega view's own export), and **Download CSV** when `data` is tabular. Set
`menu="false"` to hide it, or `actions` to additionally enable vega-embed's native actions
menu.

## Advanced: the Vega view

`@viewReady` fires with the underlying [Vega `View`](https://vega.github.io/vega/docs/api/view/)
once rendered, for wiring signals, selections, or imperative updates:

```vue
<VegaChart :spec="spec" :data="data" @viewReady="onView" />
```

```ts
function onView(view: VegaView) {
  view.addSignalListener("brush", (_name, value) => {
    /* react to an interactive selection */
  });
}
```

## API

<!-- @include: ./_api/vega-chart.md -->
