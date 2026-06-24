---
keywords:
  [
    toggle group,
    segmented control,
    single select,
    multi select,
    button group,
    radio,
    pressed,
  ]
---

# ToggleGroup

A segmented control that looks like a [`ButtonGroup`](./button-group) but tracks
which item(s) are pressed. By default it is single-select (like a radio group);
add `multiple` to let several items be pressed at once. Built on
[reka-ui's ToggleGroup](https://reka-ui.com/docs/components/toggle-group).

## Examples

### Single select

`v-model` holds the pressed value (a `string`). Clicking the active item again
clears the selection.

<script setup>
import { ref } from 'vue'
const interval = ref('weekly')
const days = ref(['mon', 'wed'])
</script>

<ComponentDemo>
  <ToggleGroup
    v-model="interval"
    label="Interval"
    :options="[
      { value: 'daily', label: 'Daily' },
      { value: 'weekly', label: 'Weekly' },
      { value: 'monthly', label: 'Monthly' },
    ]"
  />
  <p>Selected: {{ interval }}</p>

<template #code>

```vue
<script setup>
import { ref } from "vue";
const interval = ref("weekly");
</script>

<ToggleGroup
  v-model="interval"
  label="Interval"
  :options="[
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ]"
/>
```

  </template>
</ComponentDemo>

### Multiple select

With `multiple`, `v-model` is a `string[]` and any number of items can be
pressed at once.

<ComponentDemo>
  <ToggleGroup
    v-model="days"
    multiple
    label="Active days"
    :options="[
      { value: 'mon', label: 'Mon' },
      { value: 'tue', label: 'Tue' },
      { value: 'wed', label: 'Wed' },
      { value: 'thu', label: 'Thu' },
      { value: 'fri', label: 'Fri' },
    ]"
  />
  <p>Selected: {{ days.join(', ') || 'none' }}</p>

<template #code>

```vue
<script setup>
import { ref } from "vue";
const days = ref(["mon", "wed"]);
</script>

<ToggleGroup
  v-model="days"
  multiple
  label="Active days"
  :options="[
    { value: 'mon', label: 'Mon' },
    { value: 'tue', label: 'Tue' },
    { value: 'wed', label: 'Wed' },
    { value: 'thu', label: 'Thu' },
    { value: 'fri', label: 'Fri' },
  ]"
/>
```

  </template>
</ComponentDemo>

### Vertical and disabled options

Set `orientation="vertical"` to stack the items, and mark individual options
`disabled`.

<ComponentDemo>
  <ToggleGroup
    model-value="map"
    orientation="vertical"
    aria-label="View"
    :options="[
      { value: 'map', label: 'Map' },
      { value: 'chart', label: 'Chart' },
      { value: 'table', label: 'Table', disabled: true },
    ]"
  />

<template #code>

```vue
<ToggleGroup
  v-model="view"
  orientation="vertical"
  aria-label="View"
  :options="[
    { value: 'map', label: 'Map' },
    { value: 'chart', label: 'Chart' },
    { value: 'table', label: 'Table', disabled: true },
  ]"
/>
```

  </template>
</ComponentDemo>

<!--@include: ./_api/toggle-group.md-->

### ToggleGroupOption

```ts
interface ToggleGroupOption {
  value: string;
  label: string;
  disabled?: boolean;
}
```
