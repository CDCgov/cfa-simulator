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

<!--@include: ./_api/text-input.md-->
