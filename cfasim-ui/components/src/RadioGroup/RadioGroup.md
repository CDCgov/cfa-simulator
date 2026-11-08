---
keywords: [radio, radio group, radio buttons, single select, options, choice]
---

# RadioGroup

A vertical list of radio buttons, each with a label and optional description,
built on [reka-ui's RadioGroup](https://reka-ui.com/docs/components/radio-group).
Use it when the options need explaining or there are more than a handful; for
two to four short labels a [`ToggleGroup`](./toggle-group) is more compact, and
for long lists use a [`SelectBox`](./select-box).

## Examples

<script setup>
import { ref } from 'vue'
const modelType = ref('sir')
const output = ref('weekly')
</script>

### Basic

`v-model` holds the selected `value`. Arrow keys move the selection between
enabled options.

<ComponentDemo>
  <RadioGroup
    v-model="modelType"
    label="Model type"
    hint="Compartmental models run in the browser"
    :options="[
      { value: 'sir', label: 'SIR' },
      { value: 'seir', label: 'SEIR', description: 'Adds an exposed stage before infectiousness' },
      { value: 'agent', label: 'Agent-based', description: 'Requires the local server', disabled: true },
    ]"
  />

<template #code>

```vue
<script setup>
import { ref } from "vue";
const modelType = ref("sir");
</script>

<RadioGroup
  v-model="modelType"
  label="Model type"
  hint="Compartmental models run in the browser"
  :options="[
    { value: 'sir', label: 'SIR' },
    {
      value: 'seir',
      label: 'SEIR',
      description: 'Adds an exposed stage before infectiousness',
    },
    {
      value: 'agent',
      label: 'Agent-based',
      description: 'Requires the local server',
      disabled: true,
    },
  ]"
/>
```

  </template>
</ComponentDemo>

### Horizontal

<ComponentDemo>
  <RadioGroup
    v-model="output"
    label="Output interval"
    orientation="horizontal"
    :options="[
      { value: 'daily', label: 'Daily' },
      { value: 'weekly', label: 'Weekly' },
      { value: 'monthly', label: 'Monthly' },
    ]"
  />

<template #code>

```vue
<RadioGroup
  v-model="output"
  label="Output interval"
  orientation="horizontal"
  :options="[
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ]"
/>
```

  </template>
</ComponentDemo>

<!--@include: ./_api/radio-group.md-->
