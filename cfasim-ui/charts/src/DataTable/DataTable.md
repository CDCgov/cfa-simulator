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
