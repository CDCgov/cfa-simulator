---
keywords: [select, dropdown, autocomplete, combobox, filter, search, typeahead]
---

# SelectBox

A single-select dropdown built on reka-ui. Set `autocomplete` to turn it into a
filterable single-select combobox: type to narrow the options, just like
[MultiSelect](./multi-select) but bound to a single `string`.

## Examples

<script setup>
import { ref } from 'vue'
const interval = ref('weekly')
const state = ref('')
</script>

<ComponentDemo>
  <div style="width: 200px">
    <SelectBox
      v-model="interval"
      label="Interval"
      :options="[
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
      ]"
    />
  </div>

<template #code>

```vue
<script setup>
import { ref } from "vue";
const interval = ref("weekly");
</script>

<SelectBox
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

### Hidden label

Use `hide-label` to visually hide the label while keeping it available to
screen readers. Prefer this over `aria-label` whenever you have label text,
since a real `<label>` is translated by browsers and keeps the naming in the
DOM.

<ComponentDemo>
  <div style="width: 200px">
    <SelectBox
      v-model="interval"
      label="Interval"
      hide-label
      :options="[
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
      ]"
    />
  </div>

<template #code>

```vue
<SelectBox
  v-model="interval"
  label="Interval"
  hide-label
  :options="[
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ]"
/>
```

  </template>
</ComponentDemo>

### Autocomplete

Add `autocomplete` to make the field filterable. Type to narrow the list; the
selected option's label fills the input. `v-model` is still a single `string`.

<ComponentDemo>
  <div style="width: 240px">
    <SelectBox
      v-model="state"
      autocomplete
      label="State"
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
const state = ref("");
</script>

<SelectBox
  v-model="state"
  autocomplete
  label="State"
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

## Accessibility

In the default mode the field is a reka-ui Select; with `autocomplete` it's a
reka-ui Combobox following the
[ARIA combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/):

- The input has `role="combobox"` with `aria-expanded`, `aria-controls`, and
  `aria-autocomplete="list"`; the popup is a `role="listbox"` and each option a
  `role="option"` that reflects its state via `aria-selected`.
- Keyboard support is handled for you: type to filter, ↑/↓ to move through the
  list, Enter to select the highlighted option, and Escape to close.
- Pass `label` so the field is named by a real `<label>`. In autocomplete mode
  the label is also wired to the input via `for`/`id`, so clicking it focuses
  the field; use `hide-label` to keep the label for screen readers while hiding
  it visually, or `aria-label` when there's no visible label text.
- The chevron is a labelled toggle (`aria-label="Toggle options"`) kept out of
  the tab order, and native browser autofill is disabled so it can't cover the
  option list.

<!--@include: ./_api/select-box.md-->

### SelectOption

```ts
interface SelectOption {
  value: string;
  label: string;
}
```
