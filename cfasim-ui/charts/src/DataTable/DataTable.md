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
to customize the menu item label, `filename` to control the downloaded
filename, and `csv` to supply custom CSV content. Pass `:menu="false"`
to hide the menu entirely.

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

<!--@include: ./_api/data-table.md-->

### ColumnConfig

```ts
interface ColumnConfig {
  label?: string;
  width?: "small" | "medium" | "large" | number;
  align?: "left" | "center" | "right";
  cellClass?: string;
}
```
