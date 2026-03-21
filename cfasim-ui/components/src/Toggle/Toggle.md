# Toggle

A boolean switch built on reka-ui.

## Examples

<script setup>
import { ref } from 'vue'
const enabled = ref(false)
const disabled = ref(true)
</script>

### Basic

<ComponentDemo>
  <Toggle v-model="enabled" label="Enable vaccination" />

<template #code>

```vue
<script setup>
import { ref } from "vue";
const enabled = ref(false);
</script>

<Toggle v-model="enabled" label="Enable vaccination" />
```

  </template>
</ComponentDemo>

### With hint

<ComponentDemo>
  <Toggle
    v-model="enabled"
    label="Enable isolation"
    hint="Whether symptomatic individuals are isolated"
  />

<template #code>

```vue
<Toggle
  v-model="enabled"
  label="Enable isolation"
  hint="Whether symptomatic individuals are isolated"
/>
```

  </template>
</ComponentDemo>

### Disabled

<ComponentDemo>
  <Toggle v-model="disabled" label="Locked setting" :disabled="true" />

<template #code>

```vue
<Toggle v-model="value" label="Locked setting" :disabled="true" />
```

  </template>
</ComponentDemo>

<!--@include: ./_api/toggle.md-->
