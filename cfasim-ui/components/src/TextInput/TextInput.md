# TextInput

A text input field with optional label and hint.

## Examples

<script setup>
import { ref } from 'vue'
const name = ref('')
</script>

<ComponentDemo>
  <div style="width: 300px">
    <TextInput
      v-model="name"
      label="Model name"
      placeholder="e.g. my-model"
      hint="A short identifier used in URLs"
    />
  </div>

<template #code>

```vue
<script setup>
import { ref } from "vue";
const name = ref("");
</script>

<TextInput
  v-model="name"
  label="Model name"
  placeholder="e.g. my-model"
  hint="A short identifier used in URLs"
/>
```

  </template>
</ComponentDemo>

### Hidden label

Use `hide-label` to visually hide the label while keeping it available to screen
readers. The label is still a real `<label>` in the DOM, so clicking the input
area still works and the control is properly named for assistive tech. Prefer
this over omitting the label whenever the input has no visible text describing
it.

<ComponentDemo>
  <div style="width: 300px">
    <TextInput
      v-model="name"
      label="Search"
      placeholder="Search…"
      hide-label
    />
  </div>

<template #code>

```vue
<TextInput v-model="name" label="Search" placeholder="Search…" hide-label />
```

  </template>
</ComponentDemo>

<!--@include: ./_api/text-input.md-->
