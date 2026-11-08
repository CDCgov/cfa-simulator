---
keywords: [checkbox, check box, boolean, tick, indeterminate, toggle]
---

# Checkbox

A labeled checkbox built on
[reka-ui's Checkbox](https://reka-ui.com/docs/components/checkbox). Use it where
a boolean reads as an option to tick, such as items in a list of settings; use
[`Toggle`](./toggle) for a switch that takes effect immediately.

## Examples

<script setup>
import { ref } from 'vue'
const vaccination = ref(false)
const isolation = ref(true)
const regions = ref(false)
const partial = ref(true)
const locked = ref(true)
</script>

### Basic

<ComponentDemo>
  <Checkbox v-model="vaccination" label="Enable vaccination" />

<template #code>

```vue
<script setup>
import { ref } from "vue";
const vaccination = ref(false);
</script>

<Checkbox v-model="vaccination" label="Enable vaccination" />
```

  </template>
</ComponentDemo>

### Description and hint

`description` renders under the label and is linked to the checkbox with
`aria-describedby`. `hint` adds the (?) tooltip after the label.

<ComponentDemo>
  <Checkbox
    v-model="isolation"
    label="Isolate symptomatic cases"
    description="Infected individuals stop mixing once symptoms appear"
    hint="Isolation starts on the day of symptom onset"
  />

<template #code>

```vue
<Checkbox
  v-model="isolation"
  label="Isolate symptomatic cases"
  description="Infected individuals stop mixing once symptoms appear"
  hint="Isolation starts on the day of symptom onset"
/>
```

  </template>
</ComponentDemo>

### Indeterminate

Set `indeterminate` on a parent checkbox whose children are partly selected. It
draws a dash in place of the checked state; the next click emits `true`, and the
consumer clears `indeterminate` itself, as with the native property.

<ComponentDemo>
  <Checkbox
    v-model="regions"
    :indeterminate="partial"
    label="All regions"
    @update:model-value="partial = false"
  />

<template #code>

```vue
<script setup>
import { ref } from "vue";
const regions = ref(false);
const partial = ref(true);
</script>

<Checkbox
  v-model="regions"
  :indeterminate="partial"
  label="All regions"
  @update:model-value="partial = false"
/>
```

  </template>
</ComponentDemo>

### Disabled

<ComponentDemo>
  <Checkbox v-model="locked" label="Locked setting" disabled />

<template #code>

```vue
<Checkbox v-model="locked" label="Locked setting" disabled />
```

  </template>
</ComponentDemo>

<!--@include: ./_api/checkbox.md-->
