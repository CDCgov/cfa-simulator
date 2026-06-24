---
keywords:
  [
    multiselect,
    multi-select,
    autocomplete,
    combobox,
    tags,
    chips,
    filter,
    search,
    typeahead,
  ]
---

# MultiSelect

A multi-select combobox with autocomplete. Built on reka-ui's Combobox: type to
filter the options, click to add them, and selected values appear as removable
chips. Binds to a `string[]` via `v-model`.

## Examples

<script setup>
import { ref } from 'vue'
const states = ref(['ca'])
const stationery = ref([])
</script>

<ComponentDemo>
  <div style="width: 280px">
    <MultiSelect
      v-model="states"
      label="States"
      placeholder="Search states…"
      :options="[
        { value: 'ca', label: 'California' },
        { value: 'ny', label: 'New York' },
        { value: 'tx', label: 'Texas' },
        { value: 'wa', label: 'Washington' },
        { value: 'fl', label: 'Florida' },
      ]"
    />
  </div>

<template #code>

```vue
<script setup>
import { ref } from "vue";
const states = ref(["ca"]);
</script>

<MultiSelect
  v-model="states"
  label="States"
  placeholder="Search states…"
  :options="[
    { value: 'ca', label: 'California' },
    { value: 'ny', label: 'New York' },
    { value: 'tx', label: 'Texas' },
    { value: 'wa', label: 'Washington' },
    { value: 'fl', label: 'Florida' },
  ]"
/>
```

  </template>
</ComponentDemo>

Type in the field to filter, click an option to add it, and use a chip's `✕`
button (or press Backspace in an empty input) to remove a selection.

### Hidden label

Use `hide-label` to visually hide the label while keeping it available to screen
readers. Prefer this over `aria-label` whenever you have label text.

<ComponentDemo>
  <div style="width: 280px">
    <MultiSelect
      v-model="stationery"
      label="Supplies"
      hide-label
      placeholder="Add supplies…"
      :options="[
        { value: 'pen', label: 'Pen' },
        { value: 'pencil', label: 'Pencil' },
        { value: 'marker', label: 'Marker' },
        { value: 'eraser', label: 'Eraser' },
      ]"
    />
  </div>

<template #code>

```vue
<MultiSelect
  v-model="supplies"
  label="Supplies"
  hide-label
  placeholder="Add supplies…"
  :options="[
    { value: 'pen', label: 'Pen' },
    { value: 'pencil', label: 'Pencil' },
    { value: 'marker', label: 'Marker' },
    { value: 'eraser', label: 'Eraser' },
  ]"
/>
```

  </template>
</ComponentDemo>

## Accessibility

MultiSelect is built on reka-ui's Combobox, which implements the
[ARIA combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/):

- The text field has `role="combobox"` with `aria-expanded`, `aria-controls`,
  `aria-autocomplete="list"`, and `aria-activedescendant` tracking the
  highlighted option as you arrow through the list.
- The popup is a `role="listbox"` with `aria-multiselectable="true"`; each option
  is a `role="option"` and reflects its state via `aria-selected`.
- Keyboard support is handled for you: type to filter, ↑/↓ to move, Enter to
  toggle the highlighted option, Escape to close, and Backspace in an empty input
  removes the last chip.
- Pass `label` so the field is named by a real `<label>` (associated via
  `aria-labelledby`); use `hide-label` to keep it for screen readers while hiding
  it visually, or `aria-label` when there's no visible label text.
- Each chip's remove button has an `aria-label` (e.g. "Remove California").

<!--@include: ./_api/multi-select.md-->

### MultiSelectOption

```ts
interface MultiSelectOption {
  value: string;
  label: string;
}
```
