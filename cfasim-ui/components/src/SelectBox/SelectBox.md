# SelectBox

A dropdown select built on reka-ui.

## Examples

<script setup>
import { ref } from 'vue'
const interval = ref('weekly')
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

<!--@include: ./_api/select-box.md-->

### SelectOption

```ts
interface SelectOption {
  value: string;
  label: string;
}
```
