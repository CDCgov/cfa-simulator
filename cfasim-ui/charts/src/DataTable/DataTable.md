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
  cellClass?: string;
  format?: NumberFormat | ((value: CellValue, row: number) => string);
}

type CellValue = number | string | boolean;

type NumberFormat =
  | NumberFormatPreset // "plain" | "localized" | "percent" | "compact" | "scientific" | "engineering" (optionally with ":N" digits, e.g. "percent:1")
  | string // printf-style format, e.g. "%.2f", "%05d"
  | ((value: number) => string);
```

See `formatNumber` in `@cfasim-ui/shared` for the underlying utility — you
can also call it directly in your own code.
