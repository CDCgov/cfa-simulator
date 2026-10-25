# DataTable

A table for displaying columnar data. Accepts a plain record of arrays or a `ModelOutput` from a simulation.

## Examples

### Basic usage

<ComponentDemo>
  <DataTable :data="{ day: [0, 1, 2, 3, 4], susceptible: [1000, 980, 945, 900, 860], infected: [1, 21, 56, 101, 141] }" />

<template #code>

```vue
<DataTable
  :data="{
    day: [0, 1, 2, 3, 4],
    susceptible: [1000, 980, 945, 900, 860],
    infected: [1, 21, 56, 101, 141],
  }"
/>
```

  </template>
</ComponentDemo>

### Column labels and width

<ComponentDemo>
  <DataTable
    :data="{ day: [0, 1, 2, 3, 4], susceptible: [1000, 980, 945, 900, 860], infected: [1, 21, 56, 101, 141] }"
    :column-config="{
      day: { label: 'Day', width: 'small' },
      susceptible: { label: 'Susceptible' },
      infected: { label: 'Infected' },
    }"
  />

<template #code>

```vue
<DataTable
  :data="{
    day: [0, 1, 2, 3, 4],
    susceptible: [1000, 980, 945, 900, 860],
    infected: [1, 21, 56, 101, 141],
  }"
  :column-config="{
    day: { label: 'Day', width: 'small' },
    susceptible: { label: 'Susceptible' },
    infected: { label: 'Infected' },
  }"
/>
```

  </template>
</ComponentDemo>

### Formatting cell values

Use `format` on a column to override the default rendering. Accepts a
{@link NumberFormat} value — a preset name (optionally with `:N` digits,
e.g. `"percent:1"`), a printf-style format string, or a function
`(value, row) => string`. Formatted values are also used in CSV exports.

<ComponentDemo>
  <DataTable
    :data="{ day: [0, 1, 2, 3, 4], rate: [0.012, 0.234, 0.467, 0.512, 0.601], cases: [1, 21, 56, 101, 141] }"
    :column-config="{
      day: { label: 'Day', width: 'small' },
      rate: { label: 'Attack rate', format: 'percent:1' },
      cases: { label: 'Cases', format: '%05d' },
    }"
  />

<template #code>

```vue
<DataTable
  :data="{
    day: [0, 1, 2, 3, 4],
    rate: [0.012, 0.234, 0.467, 0.512, 0.601],
    cases: [1, 21, 56, 101, 141],
  }"
  :column-config="{
    day: { label: 'Day', width: 'small' },
    rate: { label: 'Attack rate', format: 'percent:1' },
    cases: { label: 'Cases', format: '%05d' },
  }"
/>
```

  </template>
</ComponentDemo>

### Cell class and max rows

<ComponentDemo>
  <DataTable
    :data="{ generation: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], cases: [1, 3, 8, 15, 28, 45, 62, 71, 55, 30] }"
    :max-rows="5"
    :column-config="{
      generation: { label: 'Gen', cellClass: 'text-secondary', width: 50 },
      cases: { label: 'Cases' },
    }"
  />

<template #code>

```vue
<DataTable
  :data="{
    generation: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    cases: [1, 3, 8, 15, 28, 45, 62, 71, 55, 30],
  }"
  :max-rows="5"
  :column-config="{
    generation: { label: 'Gen', cellClass: 'text-secondary', width: 50 },
    cases: { label: 'Cases' },
  }"
/>
```

  </template>
</ComponentDemo>

### Wrapping long content

By default, cell content stays on one line and truncates with an ellipsis
when it's wider than the column — so a long string in one column can't
spill into the next. Set `wrap: true` on a column to let it grow
vertically instead.

<ComponentDemo>
  <DataTable
    :data="{
      drug: ['Compound A', 'Compound B', 'Compound C'],
      note: [
        'Well tolerated at all tested doses; no adverse events reported.',
        'Mild GI symptoms in 4% of participants; resolved without intervention.',
        'Discontinued at week 6 after liver-enzyme elevation in two participants.',
      ],
    }"
    :column-config="{
      drug: { width: 'small' },
      note: { wrap: true, width: 'large' },
    }"
  />

<template #code>

```vue
<DataTable
  :data="{
    drug: ['Compound A', 'Compound B', 'Compound C'],
    note: [
      'Well tolerated at all tested doses; no adverse events reported.',
      'Mild GI symptoms in 4% of participants; resolved without intervention.',
      'Discontinued at week 6 after liver-enzyme elevation in two participants.',
    ],
  }"
  :column-config="{
    drug: { width: 'small' },
    note: { wrap: true, width: 'large' },
  }"
/>
```

  </template>
</ComponentDemo>

Use `columnClass` to attach a class to both the header and every body
cell in a column — handy when whole-column styling (background, border,
font weight) should match across the header and data. `cellClass` keeps
its meaning (body cells only).

### Striped rows

Pass `striped` to shade every other row, which helps the eye follow wide
rows. Stripes follow the displayed order, so they stay alternating after
sorting. The default shade is `--color-bg-subtle`; pass a CSS color
(`striped="#eef4fb"`) or set `--data-table-stripe-color` to change it.

<ComponentDemo>
  <DataTable
    :data="{ day: [0, 1, 2, 3, 4, 5], susceptible: [1000, 980, 945, 900, 860, 825], infected: [1, 21, 56, 101, 141, 170] }"
    striped
  />

<template #code>

```vue
<DataTable
  :data="{
    day: [0, 1, 2, 3, 4, 5],
    susceptible: [1000, 980, 945, 900, 860, 825],
    infected: [1, 21, 56, 101, 141, 170],
  }"
  striped
/>
```

  </template>
</ComponentDemo>

### Sortable columns

Pass `sortable` to make every column header a button that sorts the rows.
Clicking a header cycles ascending, descending, then back to the data's
own order. Numbers and dates sort numerically, strings naturally
(`"x2"` before `"x10"`), enum columns by label, and missing values (empty,
`NaN`, missing dates) always sort last. Sorting happens before `max-rows`
is applied, and CSV exports follow the displayed order. Set
`sortable` in `column-config` to opt individual columns in or out, and bind
`v-model:sort` (`{ column, direction } | null`) to control or read the
sort.

<ComponentDemo>
  <DataTable
    :data="{ state: ['Ohio', 'Texas', 'Maine', 'Iowa'], cases: [1204, 5310, 88, 412], rate: [0.012, 0.018, 0.006, 0.013] }"
    sortable
    :column-config="{
      state: { label: 'State' },
      cases: { label: 'Cases', align: 'right' },
      rate: { label: 'Rate', format: 'percent:1', sortable: false },
    }"
  />

<template #code>

```vue
<script setup lang="ts">
import { ref } from "vue";
import type { TableSort } from "@cfasim-ui/charts";

const sort = ref<TableSort | null>(null);
</script>

<template>
  <DataTable
    v-model:sort="sort"
    :data="{
      state: ['Ohio', 'Texas', 'Maine', 'Iowa'],
      cases: [1204, 5310, 88, 412],
      rate: [0.012, 0.018, 0.006, 0.013],
    }"
    sortable
    :column-config="{
      state: { label: 'State' },
      cases: { label: 'Cases', align: 'right' },
      rate: { label: 'Rate', format: 'percent:1', sortable: false },
    }"
  />
</template>
```

  </template>
</ComponentDemo>

### Custom cell content

To render cells with your own markup or components, such as a color
swatch, set `template` on a column in `column-config` and pass a
`<template #name>` with that name. Several columns can share one template.
It gets `{ value, text, row, column }`: the raw value, the default text (with
`format` applied), the row index in the source data (unaffected by
sorting) and the column name. Templates only change what is displayed:
sorting uses the raw values and CSV exports use the text.

`template` can also be a function `(value, row) => name | undefined` that
picks a template per cell from the data; returning `undefined` renders the
plain text. For example, to render missing colors as text instead of a
swatch:

```ts
fill: { template: (value) => (value ? "swatch" : undefined) },
```

<ComponentDemo>
  <DataTable
    :data="{ series: ['Susceptible', 'Infected', 'Recovered'], fill: ['#9ecae1', '#fc9272', '#a1d99b'], stroke: ['#2b8cbe', '#e34a33', '#31a354'] }"
    :column-config="{ series: { label: 'Series' }, fill: { label: 'Fill', template: 'swatch' }, stroke: { label: 'Stroke', template: 'swatch' } }"
  >
    <template #swatch="{ value, text }">
      <span style="display: inline-flex; align-items: center; gap: 0.5em">
        <span :style="{ width: '1em', height: '1em', borderRadius: '2px', background: value }" />
        {{ text }}
      </span>
    </template>
  </DataTable>

<template #code>

```vue
<DataTable
  :data="{
    series: ['Susceptible', 'Infected', 'Recovered'],
    fill: ['#9ecae1', '#fc9272', '#a1d99b'],
    stroke: ['#2b8cbe', '#e34a33', '#31a354'],
  }"
  :column-config="{
    series: { label: 'Series' },
    fill: { label: 'Fill', template: 'swatch' },
    stroke: { label: 'Stroke', template: 'swatch' },
  }"
>
  <template #swatch="{ value, text }">
    <span class="swatch-cell">
      <span class="swatch" :style="{ background: value }" />
      {{ text }}
    </span>
  </template>
</DataTable>
```

  </template>
</ComponentDemo>

### Full width

By default the table sizes to its content (columns default to a fixed
medium width, so they're evenly spaced). Pass `full-width` to stretch the
table to fill its container; columns without an explicit width will share
the available space equally.

<ComponentDemo>
  <DataTable
    :data="{ day: [0, 1, 2, 3, 4], susceptible: [1000, 980, 945, 900, 860], infected: [1, 21, 56, 101, 141] }"
    full-width
  />

<template #code>

```vue
<DataTable
  :data="{
    day: [0, 1, 2, 3, 4],
    susceptible: [1000, 980, 945, 900, 860],
    infected: [1, 21, 56, 101, 141],
  }"
  full-width
/>
```

  </template>
</ComponentDemo>

### Download menu

A `⋯` menu appears in the top-right corner of every table with a
**Download** item that exports the data as CSV. Use `download-menu-link`
to customize the menu item label and `filename` to control the
downloaded filename. Pass `:menu="false"` to hide the menu entirely.

<ComponentDemo>
  <DataTable
    :data="{ day: [0, 1, 2, 3, 4], cases: [1, 21, 56, 101, 141] }"
    filename="sir-cases"
    download-menu-link="Download cases (CSV)"
  />

<template #code>

```vue
<DataTable
  :data="{
    day: [0, 1, 2, 3, 4],
    cases: [1, 21, 56, 101, 141],
  }"
  filename="sir-cases"
  download-menu-link="Download cases (CSV)"
/>
```

  </template>
</ComponentDemo>

### Custom CSV download

By default, the Download menu item exports the displayed table as CSV.
Use the `csv` prop to supply your own content — for example, to include
ISO dates, extra columns that aren't in the table, or values formatted
differently from the on-screen rendering. Accepts a raw string or a
function returning one (called lazily on click).

<ComponentDemo>
  <DataTable
    :data="{ day: [0, 1, 2, 3, 4], cases: [1, 21, 56, 101, 141] }"
    filename="sir-cases"
    :csv="'date,day,cases\n2024-01-01,0,1\n2024-01-02,1,21\n2024-01-03,2,56\n2024-01-04,3,101\n2024-01-05,4,141'"
  />

<template #code>

```vue
<DataTable
  :data="{
    day: [0, 1, 2, 3, 4],
    cases: [1, 21, 56, 101, 141],
  }"
  filename="sir-cases"
  :csv="`date,day,cases
2024-01-01,0,1
2024-01-02,1,21
2024-01-03,2,56
2024-01-04,3,101
2024-01-05,4,141`"
/>
```

  </template>
</ComponentDemo>

### Download button

Pass `download-button` to render a visible, labeled button beneath the
table instead of exposing the download only via the top-right menu. The
button uses `download-menu-link` as its label, and the menu's Download
item is suppressed so the action isn't duplicated. The button has the
class `data-table-download-button` and its styles are unscoped, so it
can be targeted directly from custom CSS without specificity battles.

<ComponentDemo>
  <DataTable
    :data="{ day: [0, 1, 2, 3, 4], cases: [1, 21, 56, 101, 141] }"
    filename="sir-cases"
    download-menu-link="Download CSV"
    download-button
    :csv="'date,day,cases\n2024-01-01,0,1\n2024-01-02,1,21\n2024-01-03,2,56\n2024-01-04,3,101\n2024-01-05,4,141'"
  />

<template #code>

```vue
<DataTable
  :data="{
    day: [0, 1, 2, 3, 4],
    cases: [1, 21, 56, 101, 141],
  }"
  filename="sir-cases"
  download-menu-link="Download CSV"
  download-button
  :csv="`date,day,cases
2024-01-01,0,1
2024-01-02,1,21
2024-01-03,2,56
2024-01-04,3,101
2024-01-05,4,141`"
/>
```

  </template>
</ComponentDemo>

### Download link

Pass `download-link` to render a plain text link beneath the table
instead of (or alongside) the menu. It's a real `<a href download>` —
right-click → Save As works. Pass `true` for the default "Download data
(CSV)" label, or a string to customize. The menu's Download item is
suppressed when this is set. If both `download-link` and
`download-button` are set, the button wins.

<ComponentDemo>
  <DataTable
    :data="{ day: [0, 1, 2, 3, 4], cases: [1, 21, 56, 101, 141] }"
    filename="sir-cases"
    download-link
  />

<template #code>

```vue
<DataTable
  :data="{
    day: [0, 1, 2, 3, 4],
    cases: [1, 21, 56, 101, 141],
  }"
  filename="sir-cases"
  download-link
/>
```

  </template>
</ComponentDemo>

<!--@include: ./_api/data-table.md-->

### ColumnConfig

```ts
interface ColumnConfig {
  label?: string;
  width?: "small" | "medium" | "large" | number;
  align?: "left" | "center" | "right";
  /** Class applied to body `<td>` cells only. */
  cellClass?: string;
  /** Class applied to both the header `<th>` and body `<td>` cells. */
  columnClass?: string;
  /** Allow cell contents to wrap. Default `false` (nowrap + ellipsis). */
  wrap?: boolean;
  format?: NumberFormat | ((value: CellValue, row: number) => string);
  /** Override the table-level `sortable` prop for this column. */
  sortable?: boolean;
  /**
   * Name of a `<template #name>` that renders this column's body cells, or
   * a function choosing one per cell (`undefined` = plain text).
   */
  template?:
    | string
    | ((value: CellValue | undefined, row: number) => string | undefined);
}

interface CellSlotProps {
  value: CellValue | undefined;
  /** Default text, with `format` applied. */
  text: string;
  /** Row index in the source data, unaffected by sorting. */
  row: number;
  column: string;
}

interface TableSort {
  column: string;
  direction: "asc" | "desc";
}

type CellValue = number | string | boolean;

type NumberFormat =
  | NumberFormatPreset // "plain" | "localized" | "percent" | "compact" | "scientific" | "engineering" (optionally with ":N" digits, e.g. "percent:1")
  | string // printf-style format, e.g. "%.2f", "%05d"
  | ((value: number) => string);
```

See `formatNumber` in `@cfasim-ui/shared` for the underlying utility — you
can also call it directly in your own code.
