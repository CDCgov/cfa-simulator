---
keywords:
  [
    vega-lite,
    vega,
    spec,
    json,
    altair,
    grammar of graphics,
    translate,
    line,
    bar,
    chart,
  ]
---

# VegaLiteChart

Renders a [Vega-Lite](https://vega.github.io/vega-lite/) spec with the
native cfasim charts: a spec with a `bar` mark becomes a `BarChart`, anything
else a `LineChart`, so the chart gets the same styling, tooltips, CSV
download, zoom and dark mode as the rest of the app. Specs from Altair
(`chart.to_dict()`), Observable or an LLM work as long as they stay in the
[supported subset](#supported-subset). There is no Vega dependency: the spec
is translated, not run.

It lives at its own entry point, so apps that never use it pay nothing:

```ts
import { VegaLiteChart, vegaLiteToChart } from "@cfasim-ui/charts/vega-lite";
```

<script setup>
const days = ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26", "2026-02-02", "2026-02-09", "2026-02-16", "2026-02-23"];
const north = [12, 18, 31, 47, 52, 44, 30, 19];
const south = [8, 10, 15, 22, 34, 41, 38, 27];
const weekly = days.flatMap((week, i) => [
  { week, region: "North", cases: north[i], lo: north[i] * 0.8, hi: north[i] * 1.25 },
  { week, region: "South", cases: south[i], lo: south[i] * 0.8, hi: south[i] * 1.25 },
]);

const lineSpec = {
  title: "Weekly cases",
  data: { values: weekly },
  mark: { type: "line", interpolate: "monotone", point: true },
  encoding: {
    x: { field: "week", type: "temporal", title: "Week", axis: { format: "%b %d" } },
    y: { field: "cases", type: "quantitative", title: "Cases" },
    color: { field: "region", type: "nominal" },
  },
};

const bandSpec = {
  data: { values: weekly.filter((r) => r.region === "North") },
  encoding: { x: { field: "week", type: "temporal", title: "Week", axis: { format: "%b %d" } } },
  layer: [
    {
      mark: { type: "area", opacity: 0.25 },
      encoding: { y: { field: "lo", type: "quantitative", title: "Cases" }, y2: { field: "hi" } },
    },
    { mark: "line", encoding: { y: { field: "cases", type: "quantitative" } } },
    { mark: { type: "rule", color: "#dc2626", strokeDash: [4, 4] }, encoding: { y: { datum: 50 } } },
  ],
};

const ages = [
  { age: "0-17", vaccinated: 0.42, unvaccinated: 0.58 },
  { age: "18-49", vaccinated: 0.61, unvaccinated: 0.39 },
  { age: "50-64", vaccinated: 0.74, unvaccinated: 0.26 },
  { age: "65+", vaccinated: 0.88, unvaccinated: 0.12 },
].flatMap((r) => [
  { age: r.age, status: "Vaccinated", share: r.vaccinated },
  { age: r.age, status: "Unvaccinated", share: r.unvaccinated },
]);

const barSpec = {
  data: { values: ages },
  mark: "bar",
  encoding: {
    x: { field: "age", type: "ordinal", title: "Age group" },
    y: { field: "share", type: "quantitative", title: "Share", axis: { format: ".0%" } },
    color: {
      field: "status",
      type: "nominal",
      scale: { domain: ["Vaccinated", "Unvaccinated"], range: ["#2563eb", "#cbd5e1"] },
    },
  },
};

const runs = [1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0, 3.3].map((r0, i) => ({
  r0,
  peak: Math.round(8 + r0 * 9 + (i % 3) * 2),
  attack: Math.round(20 + r0 * 18),
}));

const scatterSpec = {
  data: { values: runs },
  mark: "circle",
  encoding: {
    x: { field: "r0", type: "quantitative", title: "R₀" },
    y: { field: "peak", type: "quantitative", title: "Peak cases (%)" },
    size: { field: "attack", type: "quantitative" },
    color: { field: "attack", type: "quantitative", scale: { range: ["#bfdbfe", "#1e3a8a"] } },
  },
};

const unsupportedSpec = {
  data: { values: weekly.filter((r) => r.region === "North") },
  transform: [{ filter: "datum.cases > 10" }],
  mark: "line",
  encoding: {
    x: { field: "week", type: "temporal", timeUnit: "yearweek", title: "Week" },
    y: { field: "cases", type: "quantitative", title: "Cases" },
  },
};
</script>

## Examples

### Line chart

A `color` field splits the rows into one series per value, colored in the
order Vega-Lite sorts the field's values. `interpolate` sets the line curve,
and `axis.format` takes a d3 format string.

<ComponentDemo>
  <VegaLiteChart :spec="lineSpec" :height="260" data-testid="vega-line" />

<template #code>

```vue
<script setup>
import { VegaLiteChart } from "@cfasim-ui/charts/vega-lite";

const spec = {
  title: "Weekly cases",
  data: { values: weekly }, // [{ week: "2026-01-05", region: "North", cases: 12 }, ...]
  mark: { type: "line", interpolate: "monotone", point: true },
  encoding: {
    x: {
      field: "week",
      type: "temporal",
      title: "Week",
      axis: { format: "%b %d" },
    },
    y: { field: "cases", type: "quantitative", title: "Cases" },
    color: { field: "region", type: "nominal" },
  },
};
</script>

<template>
  <VegaLiteChart :spec="spec" :height="260" />
</template>
```

  </template>
</ComponentDemo>

### Layers: band, line and threshold

Layers share the data and encodings of the spec that holds them. An `area`
with `y` and `y2` is a band; a `rule` with only a `y` datum is a
threshold across the plot, and the y axis grows to keep it in view.

<ComponentDemo>
  <VegaLiteChart :spec="bandSpec" :height="260" data-testid="vega-band" />

<template #code>

```ts
const spec = {
  data: { values: north },
  encoding: {
    x: {
      field: "week",
      type: "temporal",
      title: "Week",
      axis: { format: "%b %d" },
    },
  },
  layer: [
    {
      mark: { type: "area", opacity: 0.25 },
      encoding: {
        y: { field: "lo", type: "quantitative", title: "Cases" },
        y2: { field: "hi" },
      },
    },
    { mark: "line", encoding: { y: { field: "cases", type: "quantitative" } } },
    {
      mark: { type: "rule", color: "#dc2626", strokeDash: [4, 4] },
      encoding: { y: { datum: 50 } },
    },
  ],
};
```

  </template>
</ComponentDemo>

### Stacked bars

Colored bars stack by default, as in Vega-Lite. Set `xOffset` to the color
field to group them side by side, or `stack: null` on `y` to overlay them.

<ComponentDemo>
  <VegaLiteChart :spec="barSpec" :height="260" data-testid="vega-bar" />

<template #code>

```ts
const spec = {
  data: { values: ages }, // [{ age: "0-17", status: "Vaccinated", share: 0.42 }, ...]
  mark: "bar",
  encoding: {
    x: { field: "age", type: "ordinal", title: "Age group" },
    y: {
      field: "share",
      type: "quantitative",
      title: "Share",
      axis: { format: ".0%" },
    },
    color: {
      field: "status",
      type: "nominal",
      scale: {
        domain: ["Vaccinated", "Unvaccinated"],
        range: ["#2563eb", "#cbd5e1"],
      },
    },
  },
};
```

  </template>
</ComponentDemo>

### Scatter with size and color

`size`, `opacity` and a quantitative `color` encode more fields on point
marks. Size is an area, as in Vega-Lite; a continuous color runs between the
two colors of `scale.range`.

<ComponentDemo>
  <VegaLiteChart :spec="scatterSpec" :height="260" :chart-padding="12" />

<template #code>

```ts
const spec = {
  data: { values: runs }, // [{ r0: 1.2, peak: 19, attack: 42 }, ...]
  mark: "circle",
  encoding: {
    x: { field: "r0", type: "quantitative", title: "R₀" },
    y: { field: "peak", type: "quantitative", title: "Peak cases (%)" },
    size: { field: "attack", type: "quantitative" },
    color: {
      field: "attack",
      type: "quantitative",
      scale: { range: ["#bfdbfe", "#1e3a8a"] },
    },
  },
};
```

  </template>
</ComponentDemo>

## Data and chart props

Pass rows with the `data` prop to keep the spec separate from its data (it
wins over `data.values`, and is the way to feed a spec whose data is a
`url`). Every other attribute is a prop of the chart that renders, merged
over what the spec sets, and slots such as `tooltip` pass through:

```vue
<VegaLiteChart :spec="spec" :data="rows" zoom legend-toggle :height="320" />
```

## Unsupported pieces

Anything outside the supported subset is skipped and the rest renders. The
component logs each skipped piece with `console.warn` and emits them as
`warnings`; with `strict` it renders nothing and emits `error` instead.
Data must arrive ready to plot: transforms and aggregates are not applied.

<ComponentDemo>
  <VegaLiteChart :spec="unsupportedSpec" :height="200" />

<template #code>

```vue
<!-- Warns that the `transform` and `x.timeUnit` are not applied. -->
<VegaLiteChart :spec="spec" @warnings="(w) => (skipped = w)" />
```

  </template>
</ComponentDemo>

## vegaLiteToChart

The translation on its own, for rendering the chart yourself or adjusting
its props first. It returns which chart to render, its props, and the
warnings; `strict: true` throws on the first unsupported piece instead.

```ts
import { vegaLiteToChart } from "@cfasim-ui/charts/vega-lite";
import { LineChart, BarChart } from "@cfasim-ui/charts";

const { component, props, warnings } = vegaLiteToChart(spec, { data: rows });
// <component :is="component === 'BarChart' ? BarChart : LineChart" v-bind="props" />
```

## Supported subset

| Spec                        | Supported                                                                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Top level                   | `title` (text, multi-line), numeric `width` / `height`, inline `data.values`, `layer` (nested, inheriting data and encodings)                                                                                       |
| Marks                       | `line`, `trail`, `point`, `circle`, `square`, `area`, `bar`, `rule`, `errorbar`, `errorband`, `text`                                                                                                                |
| Mark properties             | `color`, `opacity`, `strokeWidth`, `strokeDash`, `interpolate` (`linear`, `step`, `step-before`, `step-after`, `monotone`), `point: true`, `filled`, `size`                                                         |
| `x` / `y`                   | `quantitative`, `temporal`, `nominal` and `ordinal` fields; `datum` for rules and text; `x2` / `y2`; `bin: "binned"` bars                                                                                           |
| `color`                     | a nominal or ordinal field (one series per value; `scale.domain` / `scale.range`), a constant `value`, a quantitative field on point marks                                                                          |
| `size`, `opacity`           | fields on point marks, `value`                                                                                                                                                                                      |
| `xOffset` / `yOffset`       | groups bars side by side                                                                                                                                                                                            |
| `text`                      | a field or value on `text` marks                                                                                                                                                                                    |
| Stacking                    | stacked bars and areas by color (default), `stack: "normalize"`, `stack: null`                                                                                                                                      |
| `sort`                      | arrays, `"ascending"` / `"descending"`, `null`, and channel sorts like `"-y"` (by each value's sum)                                                                                                                 |
| `scale`                     | `type: "log"` on the value axis, `domain`                                                                                                                                                                           |
| `axis`                      | `title`, `format` (d3), `formatType: "time"`, `grid`, `axis: null` for a bar value axis                                                                                                                             |
| Not supported (each warned) | `transform`, `aggregate`, `timeUnit`, `bin: true`, `url` data without the `data` prop, `config`, `params` / selections, `facet` / `repeat` / `concat`, color `scheme`s, other marks, interpolations and scale types |

The chart applies its own styling: Vega-Lite's default grid lines, axis
padding and color scheme are not copied.

<!--@include: ./_api/vega-lite-chart.md-->
