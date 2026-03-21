# NumberInput

A number input field with optional slider, percent mode, and validation.

## Examples

### Basic

<script setup>
import { ref } from 'vue'
const days = ref(10)
const population = ref(100000)
const coverage = ref(0.5)
const r0 = ref(3.5)
</script>

<ComponentDemo>
  <div style="width: 300px">
    <NumberInput v-model="days" label="Days" placeholder="Number of days" />
  </div>

  <template #code>

```vue
<script setup>
import { ref } from 'vue'
const days = ref(10)
</script>

<NumberInput v-model="days" label="Days" placeholder="Number of days" />
```

  </template>
</ComponentDemo>

### With hint and validation

<ComponentDemo>
  <div style="width: 300px">
    <NumberInput
      v-model="population"
      label="Population"
      hint="Total number of individuals"
      :min="1000"
      :max="100000"
      :step="1"
    />
  </div>

  <template #code>

```vue
<NumberInput
  v-model="population"
  label="Population"
  hint="Total number of individuals"
  :min="1000"
  :max="100000"
  :step="1"
/>
```

  </template>
</ComponentDemo>

### Percent mode

<ComponentDemo>
  <div style="width: 300px">
    <NumberInput
      v-model="coverage"
      label="Vaccination coverage"
      percent
      :max="1"
    />
  </div>

  <template #code>

```vue
<NumberInput
  v-model="coverage"
  label="Vaccination coverage"
  percent
  :max="1"
/>
```

  </template>
</ComponentDemo>

### Slider

<ComponentDemo>
  <div style="width: 300px">
    <NumberInput
      v-model="r0"
      label="R0"
      hint="Basic reproduction number"
      :step="0.1"
      :min="1"
      :max="18"
      slider
    />
  </div>

  <template #code>

```vue
<NumberInput
  v-model="r0"
  label="R0"
  hint="Basic reproduction number"
  :step="0.1"
  :min="1"
  :max="18"
  slider
/>
```

  </template>
</ComponentDemo>

<!--@include: ./_api/number-input.md-->
