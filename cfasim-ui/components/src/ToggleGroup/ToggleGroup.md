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

A group of toggle buttons that tracks which item(s) are pressed. By default it
is single-select (like a radio group); add `multiple` to let several items be
pressed at once. Add `borders` for a framed segmented control that looks like
a [`ButtonGroup`](./button-group). Built on
[reka-ui's ToggleGroup](https://reka-ui.com/docs/components/toggle-group).

## Examples

### Single select

`v-model` holds the pressed value (a `string`). Clicking the active item again
clears the selection.

<script setup>
import { ref } from 'vue'
const interval = ref('weekly')
const days = ref(['mon', 'wed'])
const variantValue = ref('weekly')
const bordersValue = ref('weekly')
const view = ref('chart')
</script>

<ComponentDemo>
  <ToggleGroup
    v-model="interval"
    label="Interval"
    hint="How often the model reports"
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
  hint="How often the model reports"
  :options="[
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ]"
/>
```

  </template>
</ComponentDemo>

### Required

Add `required` when one item must always be pressed, as with a view switcher.
Clicking the active item leaves it pressed. In `multiple` mode the last pressed
item cannot be cleared.

<ComponentDemo>
  <ToggleGroup
    v-model="view"
    required
    aria-label="View"
    :options="[
      { value: 'chart', label: 'Chart' },
      { value: 'table', label: 'Table' },
    ]"
  />
  <p>Selected: {{ view }}</p>

<template #code>

```vue
<ToggleGroup
  v-model="view"
  required
  aria-label="View"
  :options="[
    { value: 'chart', label: 'Chart' },
    { value: 'table', label: 'Table' },
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

### Variants

`variant` paints the pressed item with the same palette as
[`Button`](./button): `primary` (default, a solid primary fill), `secondary`
(a primary outline) or `neutral` (a light grey fill).

<ComponentDemo>
  <div style="display: flex; flex-wrap: wrap; gap: 1rem">
    <ToggleGroup
      v-model="variantValue"
      aria-label="Primary"
      :options="[
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
      ]"
    />
    <ToggleGroup
      v-model="variantValue"
      variant="secondary"
      aria-label="Secondary"
      :options="[
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
      ]"
    />
    <ToggleGroup
      v-model="variantValue"
      variant="neutral"
      aria-label="Neutral"
      :options="[
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
      ]"
    />
  </div>

<template #code>

```vue
<ToggleGroup v-model="value" aria-label="Primary" :options="options" />
<ToggleGroup
  v-model="value"
  variant="secondary"
  aria-label="Secondary"
  :options="options"
/>
<ToggleGroup
  v-model="value"
  variant="neutral"
  aria-label="Neutral"
  :options="options"
/>
```

  </template>
</ComponentDemo>

### Borders

`borders` frames the group and draws dividers between the items. The pressed
item is a solid primary fill for `primary`, a primary tint for `secondary` and
the lighter, outlined item for `neutral`.

<ComponentDemo>
  <div style="display: flex; flex-wrap: wrap; gap: 1rem">
    <ToggleGroup
      v-model="bordersValue"
      borders
      aria-label="Bordered primary"
      :options="[
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
      ]"
    />
    <ToggleGroup
      v-model="bordersValue"
      variant="secondary"
      borders
      aria-label="Bordered secondary"
      :options="[
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
      ]"
    />
    <ToggleGroup
      v-model="bordersValue"
      variant="neutral"
      borders
      aria-label="Bordered neutral"
      :options="[
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
      ]"
    />
  </div>

<template #code>

```vue
<ToggleGroup
  v-model="value"
  borders
  aria-label="Bordered primary"
  :options="options"
/>
<ToggleGroup
  v-model="value"
  variant="secondary"
  borders
  aria-label="Bordered secondary"
  :options="options"
/>
<ToggleGroup
  v-model="value"
  variant="neutral"
  borders
  aria-label="Bordered neutral"
  :options="options"
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
