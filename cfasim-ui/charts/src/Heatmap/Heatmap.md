---
keywords:
  [
    heatmap,
    matrix,
    grid,
    cells,
    color scale,
    sequential,
    diverging,
    scores,
    table,
    rect,
    svg,
  ]
---

<script setup>
import { computed, ref } from "vue";

const models = ["Ensemble", "Baseline", "Renewal", "Trend"];
const locations = [
  "Alabama", "Colorado", "Delaware", "Hawaii", "Idaho", "Kansas",
  "Maine", "Nevada", "Oregon", "Tennessee", "Virginia", "Wyoming",
];
// Mean weighted interval score per location and model, synthetic.
const wis = locations.map((_, i) =>
  models.map((_, j) => {
    const base = 1.8 + 0.6 * Math.sin(i * 1.7 + j);
    const modelEffect = [-0.3, 0.4, 0, 0.2][j];
    return Math.round((base + modelEffect + 0.25 * Math.cos(i * j + 2)) * 100) / 100;
  }),
);
const sortBy = ref("name");
const sortOptions = [
  { value: "name", label: "Location name" },
  ...models.map((m, i) => ({ value: String(i), label: m })),
];
const scoreOrder = computed(() => {
  const order = locations.map((_, i) => i);
  if (sortBy.value !== "name") {
    const c = Number(sortBy.value);
    order.sort((a, b) => wis[a][c] - wis[b][c]);
  }
  return order;
});
const scoreRows = computed(() => scoreOrder.value.map((i) => locations[i]));
const scoreData = computed(() => scoreOrder.value.map((i) => wis[i]));
const picked = ref("");
function onCell(cell) {
  picked.value = `${cell.row} · ${cell.column}: ${cell.value.toFixed(2)}`;
}
function onRow(row) {
  picked.value = row.label;
}

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
const visits = days.map((_, d) =>
  hours.map((_, h) => {
    const commute = Math.exp(-((h - 8) ** 2) / 6) + Math.exp(-((h - 17) ** 2) / 8);
    const weekend = d >= 5 ? 0.5 : 1;
    return Math.round(40 * weekend * commute + 6 * Math.sin(d + h / 3) + 10);
  }),
);

const modelNames = [
  "Ensemble forecast", "Baseline persistence", "Renewal equation",
  "Trend extrapolation", "Mechanistic SEIR", "Gradient boosting",
];
const modelScores = locations.slice(0, 4).map((_, i) =>
  modelNames.map((_, j) => Math.round((1.5 + Math.sin(i + j * 1.3)) * 100) / 100),
);

const params = ["R₀", "latent", "infectious", "reporting", "dispersion"];
const correlation = [
  [1, 0.42, -0.18, 0.05, -0.61],
  [0.42, 1, -0.33, 0.12, -0.2],
  [-0.18, -0.33, 1, 0.08, 0.27],
  [0.05, 0.12, 0.08, 1, NaN],
  [-0.61, -0.2, 0.27, NaN, 1],
];
</script>

# Heatmap

A grid of cells colored by value: rows and columns of labels around a matrix
of numbers, with a continuous color scale and its gradient legend. Suits a
scores table (locations by models), a parameter sweep or counts by day and
hour. Shares the title, legend strip, tooltip, menu and CSV wiring with
[`LineChart`](./line-chart) and [`BarChart`](./bar-chart).

## Data

`rows` and `columns` are the labels; `data` is one array per row, with one
entry per column (`data[rowIndex][columnIndex]`), so a typed-array column
from a model output is one row of the matrix. A missing or non-finite entry
leaves its cell empty (see [missing values](#missing-values)).

Long-format records, one per cell, pivot into that shape with `pivotCells`:

```ts
import { pivotCells } from "@cfasim-ui/charts";

const scores = [
  { location: "Alabama", model: "Ensemble", wis: 1.52 },
  { location: "Alabama", model: "Baseline", wis: 2.21 },
  // …
];
// { rows: ["Alabama", …], columns: ["Ensemble", "Baseline"], data: [[1.52, 2.21], …] }
const matrix = pivotCells(scores, {
  row: "location",
  column: "model",
  value: "wis",
});
```

Labels keep their first-seen order unless `rows` / `columns` are given, which
also drop records outside them. Accessor functions work in place of field
names (`row: (r) => r.location.toUpperCase()`).

## Color scale

`colorScale` maps values to fills (see `ColorScale`): `range` lists two or
more colors mixed in Oklab (default viridis), `domain` fixes the values at
the ends (default the data's extent), `label` titles the legend and
`format` its end labels (defaulting to `valueFormat`). Hex and `rgb()`
colors are mixed in JS; `var()` colors go through CSS `color-mix()` and so
follow the theme.

A three-value `domain` with three colors makes a diverging scale with the
middle color at the middle value. The legend then labels the middle value
too, under the middle of the ramp, so readers can see where the neutral
point sits:

<ComponentDemo>
  <Heatmap
    data-testid="diverging-heatmap"
    :rows="params"
    :columns="params"
    :data="correlation"
    :color-scale="{ domain: [-1, 0, 1], range: ['#b2182b', '#f7f7f7', '#2166ac'], label: 'Correlation' }"
    :cell-labels="{ format: '%.2f' }"
    :cell-gap="2"
    :cell-radius="3"
    missing-color="var(--color-bg-subtle)"
    missing-label="–"
    :cell-height="36"
    :width="420"
    tooltip-trigger="hover"
  />

<template #code>

```vue
<Heatmap
  :rows="params"
  :columns="params"
  :data="correlation"
  :color-scale="{
    domain: [-1, 0, 1],
    range: ['#b2182b', '#f7f7f7', '#2166ac'],
    label: 'Correlation',
  }"
  :cell-labels="{ format: '%.2f' }"
  :cell-gap="2"
  :cell-radius="3"
  missing-color="var(--color-bg-subtle)"
  missing-label="–"
  :cell-height="36"
  :width="420"
  tooltip-trigger="hover"
/>
```

  </template>
</ComponentDemo>

Pass `colorScale: { legend: false }` to drop the legend; `legendPosition:
"bottom"` moves it under the plot.

## Cell labels

`cellLabels` prints each value on its cell in black or white, whichever reads
better on the fill. A label that does not fit its cell is left out, so
narrow columns or short rows stay clean. Pass an object to set `format`,
`fontSize`, `fontWeight` or a fixed `color`.

`valueFormat` formats the labels, the tooltip and the legend ends alike: a
preset such as `"percent:1"`, a printf string such as `"%.2f"`, or a
function.

## Axes

Column labels sit under the plot by default (`columnAxis: "bottom"`), above
it with `"top"`, or not at all with `"none"`; `rowAxis: "none"` drops the
row labels. Row labels take the width of the widest one or of `rowHeader`,
whichever is wider (capped at 40% of the chart, or `rowLabelWidth`). Column labels turn diagonal or vertical on
their own when they would collide (`columnLabelAngle: "auto"`); pass a
number of degrees between -90 and 90 to fix the angle. `xLabel` and `yLabel` title the axes
and `rowHeader` heads the row labels like a table's first column.

With an explicit `height` the rows share the plot. Here 24 columns turn the
hour labels vertical:

<ComponentDemo>
  <Heatmap
    data-testid="hourly-heatmap"
    :rows="days"
    :columns="hours"
    :data="visits"
    :height="260"
    x-label="Hour"
    y-label="Day"
    :color-scale="{ label: 'Visits' }"
    title="Clinic visits by hour"
    tooltip-trigger="hover"
  />

<template #code>

```vue
<Heatmap
  :rows="days"
  :columns="hours"
  :data="visits"
  :height="260"
  x-label="Hour"
  y-label="Day"
  :color-scale="{ label: 'Visits' }"
  title="Clinic visits by hour"
  tooltip-trigger="hover"
/>
```

  </template>
</ComponentDemo>

Tilted labels that would run past the chart's edge get extra side padding,
so the plot gives up a little width to keep them whole. A label is only
shortened with `…` when that would take more than a fifth of the width, or
when the labels would take more than 40% of an explicit `height`.

<ComponentDemo>
  <div style="max-width: 420px">
    <Heatmap
      data-testid="long-labels-heatmap"
      :rows="locations.slice(0, 4)"
      :columns="modelNames"
      :data="modelScores"
      column-axis="top"
      :column-label-angle="-45"
      :color-scale="{ label: 'WIS' }"
    />
  </div>

<template #code>

```vue
<Heatmap
  :rows="locations"
  :columns="modelNames"
  :data="modelScores"
  column-axis="top"
  :column-label-angle="-45"
  :color-scale="{ label: 'WIS' }"
/>
```

  </template>
</ComponentDemo>

### Wide tables

The chart fits its container by default, so with many columns or a narrow
screen the cell labels that no longer fit drop out. `minCellWidth` keeps
every column at least that many pixels wide instead: when they would be
narrower, the chart draws wider than its container and the plot scrolls
sideways, with the row labels and `rowHeader` pinned at the left. The title
and legend scroll with the plot. The pinned strip is painted with
`--heatmap-pinned-bg` (default the theme background), so set it when the
chart sits on another color. In a grid or flex item, set `min-width: 0` on
the item, as for any wide content, or the drawn width widens the track
instead of scrolling.

<ComponentDemo>
  <div style="max-width: 420px">
    <Heatmap
      data-testid="scrolling-heatmap"
      :rows="locations.slice(0, 4)"
      :columns="modelNames"
      :data="modelScores"
      :min-cell-width="120"
      column-axis="top"
      row-header="Location"
      cell-labels
      value-format="%.2f"
      :color-scale="{ label: 'WIS' }"
      tooltip-trigger="hover"
      interactive
    />
  </div>

<template #code>

```vue
<Heatmap
  :rows="locations"
  :columns="modelNames"
  :data="modelScores"
  :min-cell-width="120"
  column-axis="top"
  row-header="Location"
  cell-labels
  value-format="%.2f"
  :color-scale="{ label: 'WIS' }"
  tooltip-trigger="hover"
  interactive
/>
```

  </template>
</ComponentDemo>

## Missing values

A `NaN`, `null` or absent entry draws no cell. `missingColor` fills those
cells instead (the diverging demo above uses the theme's subtle background),
and they read as `—` in the tooltip and the keyboard labels. A pale missing
fill is easy to mistake for a low value, so `missingLabel` prints text such
as `"–"` on missing cells, in black or white against `missingColor` (or in
the text color without one). It uses the `cellLabels` style, and works
without `cellLabels` too.

## Tooltip and events

`tooltipTrigger: "hover"` (or `"click"`) shows the hovered cell's row as the
title and its column and value as the row, with a swatch of the cell color.
`tooltipTitle` rewrites the title. The `tooltip` slot gets the shared chart
props (`index`, `values`, `title`, `format`, `data` from `tooltipData`) plus
the cell itself: `row`, `column`, `rowIndex`, `columnIndex`, `value` and
`color`. `index` is the cell's row-major position (`rowIndex *
columns.length + columnIndex`), which is also what `tooltipData` is indexed
by. The tooltip closes when `rows` or `columns` change (re-sorting, say),
since the cell under it is then a different one; new `data` alone keeps it
open with the new value.

```vue
<Heatmap :rows :columns :data tooltip-trigger="hover">
  <template #tooltip="{ row, column, value, format }">
    <strong>{{ row }}</strong> scored {{ format(value) }} with {{ column }}
  </template>
</Heatmap>
```

Events: `hover` with `{ index }` (or `null`), `cell-click` with the cell,
`row-click` and `column-click` with `{ index, label }` from a click on a
label.

The CSV download heads the row column with `rowHeader`, else `yLabel`,
else `row`.

## Accessibility

The `<svg>` is exposed as one labeled image (`role="img"` with the `title`
or `ariaLabel`), as on the other charts. `interactive` adds a real
`<button>` over every cell and row label, laid over the svg outside it: the
grid is one <kbd>Tab</kbd> stop, the arrow keys move between cells
(<kbd>Home</kbd> reaches the row label, <kbd>End</kbd> the last column), a
focused cell shows the tooltip and <kbd>Enter</kbd> or <kbd>Space</kbd>
emits `cell-click` / `row-click`. <kbd>Escape</kbd> hides the tooltip (on
every chart, for hover too) and leaves focus where it is; the next arrow key
or pointer move shows it again. Pointer events pass through to the plot, so
hover and click work the same with or without it.

Each cell button is named `row, column: value` and each row button by its
label. Screen readers do not announce the tooltip, so when the tooltip slot
shows more than the value, say the same in `cellAriaLabel`; `rowAriaLabel`
does the same for the row buttons, for example to say what clicking does:

```vue
<Heatmap
  :rows
  :columns
  :data
  interactive
  :cell-aria-label="
    (cell) =>
      `${cell.row}, ${cell.column}. Mean CRPS: ${cell.value.toFixed(3)}. ` +
      `Change vs baseline: ${change(cell)}. Open forecast detail.`
  "
  :row-aria-label="(row) => `${row.label}. Open forecast detail.`"
/>
```

## Examples

### Scores table

A model-evaluation table: column labels on top, values on the cells, keyboard
access, and page-driven sorting (reorder `rows` and `data` together).

<ComponentDemo>
  <div class="heatmap-controls">
    <SelectBox v-model="sortBy" label="Sort locations by" :options="sortOptions" />
    <span v-if="picked">Clicked: {{ picked }}</span>
  </div>
  <Heatmap
    data-testid="scores-heatmap"
    :rows="scoreRows"
    :columns="models"
    :data="scoreData"
    :color-scale="{ range: ['#deebf7', '#08519c'], label: 'Mean WIS' }"
    value-format="%.2f"
    cell-labels
    column-axis="top"
    row-header="Location"
    :cell-height="32"
    :cell-gap="2"
    :cell-radius="2"
    tooltip-trigger="hover"
    interactive
    @cell-click="onCell"
    @row-click="onRow"
  />

<template #code>

```vue
<script setup>
import { computed, ref } from "vue";

const models = ["Ensemble", "Baseline", "Renewal", "Trend"];
const locations = ["Alabama", "Colorado", "Delaware" /* … */];
const wis = [[1.52, 2.21, 1.84, 2.03] /* one array per location */];

const sortBy = ref("name");
const order = computed(() => {
  const idx = locations.map((_, i) => i);
  if (sortBy.value !== "name") {
    const c = Number(sortBy.value);
    idx.sort((a, b) => wis[a][c] - wis[b][c]);
  }
  return idx;
});
const rows = computed(() => order.value.map((i) => locations[i]));
const data = computed(() => order.value.map((i) => wis[i]));
</script>

<template>
  <Heatmap
    :rows="rows"
    :columns="models"
    :data="data"
    :color-scale="{ range: ['#deebf7', '#08519c'], label: 'Mean WIS' }"
    value-format="%.2f"
    cell-labels
    column-axis="top"
    row-header="Location"
    :cell-height="32"
    :cell-gap="2"
    :cell-radius="2"
    tooltip-trigger="hover"
    interactive
    @cell-click="(cell) => openDetail(cell.row, cell.column)"
    @row-click="(row) => openDetail(row.label)"
  />
</template>
```

  </template>
</ComponentDemo>

<!-- @include: ./_api/heatmap.md -->

<style>
.heatmap-controls {
  display: flex;
  align-items: flex-end;
  gap: 1em;
}

.demo-preview:has(.heatmap-controls) {
  row-gap: 0.25em;
}
</style>
