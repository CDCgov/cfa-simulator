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
const ageRange = ref([18, 65])
const coverageRange = ref([0.2, 0.8])
const minAge = ref(18)
const maxAge = ref(65)
const dayMs = 24 * 60 * 60 * 1000
const dateStart = Date.UTC(2024, 0, 1)
const dateEnd = Date.UTC(2024, 11, 31)
const dateRange = ref([Date.UTC(2024, 2, 1), Date.UTC(2024, 8, 30)])
const formatDate = (ms) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" })
</script>

<ComponentDemo>
  <div style="width: 300px">
    <NumberInput v-model="days" label="Days" placeholder="Number of days" />
  </div>

<template #code>

```vue
<script setup>
import { ref } from "vue";
const days = ref(10);
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
<NumberInput v-model="coverage" label="Vaccination coverage" percent :max="1" />
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

### Range slider

Bind `v-model:range` with a `[low, high]` tuple to render a two-handle
slider. Range mode is enabled automatically by the binding — there's no
explicit toggle prop.

<ComponentDemo>
  <div style="width: 300px">
    <NumberInput
      v-model:range="ageRange"
      label="Age range"
      :min="0"
      :max="100"
      number-type="integer"
    />
  </div>

<template #code>

```vue
<script setup>
import { ref } from "vue";
const ageRange = ref([18, 65]);
</script>

<NumberInput
  v-model:range="ageRange"
  label="Age range"
  :min="0"
  :max="100"
  number-type="integer"
/>
```

  </template>
</ComponentDemo>

### Range slider with split bindings

When your state stores the bounds in separate refs (rather than as a tuple),
bind them directly with `v-model:lower` and `v-model:upper`. You can bind
either pair or combine them with `v-model:range` — writes from the component
go to every bound sink.

<ComponentDemo>
  <div style="width: 300px">
    <NumberInput
      v-model:lower="minAge"
      v-model:upper="maxAge"
      label="Age range (split)"
      :min="0"
      :max="100"
      number-type="integer"
    />
  </div>

<template #code>

```vue
<script setup>
import { ref } from "vue";
const minAge = ref(18);
const maxAge = ref(65);
</script>

<NumberInput
  v-model:lower="minAge"
  v-model:upper="maxAge"
  label="Age range"
  :min="0"
  :max="100"
  number-type="integer"
/>
```

  </template>
</ComponentDemo>

Range mode works with `percent` and `live` as well:

<ComponentDemo>
  <div style="width: 300px">
    <NumberInput
      v-model:range="coverageRange"
      label="Coverage range"
      percent
      live
      :max="1"
    />
  </div>

<template #code>

```vue
<NumberInput
  v-model:range="coverageRange"
  label="Coverage range"
  percent
  live
  :max="1"
/>
```

  </template>
</ComponentDemo>

### Custom slider display

Pass `slider-display` (a `(value: number) => string` function) to format the
thumb labels and the min/max labels however you like. The internal model is
still a number — only the displayed text changes. This applies to single
sliders and ranges; the regular text input is unaffected.

<ComponentDemo>
  <div style="width: 300px">
    <NumberInput
      v-model:range="dateRange"
      label="Date range"
      :min="dateStart"
      :max="dateEnd"
      :step="dayMs"
      :slider-display="formatDate"
    />
  </div>

<template #code>

```vue
<script setup>
import { ref } from "vue";
const dayMs = 24 * 60 * 60 * 1000;
const dateStart = Date.UTC(2024, 0, 1);
const dateEnd = Date.UTC(2024, 11, 31);
const dateRange = ref([Date.UTC(2024, 2, 1), Date.UTC(2024, 8, 30)]);
const formatDate = (ms) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
</script>

<NumberInput
  v-model:range="dateRange"
  label="Date range"
  :min="dateStart"
  :max="dateEnd"
  :step="dayMs"
  :slider-display="formatDate"
/>
```

  </template>
</ComponentDemo>

### Live slider

With `live`, the model updates while dragging the slider thumb rather than only on release.

<ComponentDemo>
  <div style="width: 300px">
    <NumberInput
      v-model="coverage"
      label="Vaccination coverage"
      percent
      slider
      live
      :max="1"
    />
  </div>

<template #code>

```vue
<NumberInput
  v-model="coverage"
  label="Vaccination coverage"
  percent
  slider
  live
  :max="1"
/>
```

  </template>
</ComponentDemo>

### Live input

With `live` on a regular input, the model updates as you type (debounced 300ms). Arrow keys and spinner buttons commit immediately.

<ComponentDemo>
  <div style="width: 300px">
    <NumberInput v-model="days" label="Days" live />
  </div>

<template #code>

```vue
<NumberInput v-model="days" label="Days" live />
```

  </template>
</ComponentDemo>

### Integer type

With `number-type="integer"`, decimal values are truncated to whole numbers on commit. When combined with `percent`, the display value (e.g. 42%) is treated as the integer — so internal values like 0.42 are valid.

<ComponentDemo>
  <div style="width: 300px">
    <NumberInput v-model="days" label="Steps" number-type="integer" />
  </div>

<template #code>

```vue
<NumberInput v-model="days" label="Steps" number-type="integer" />
```

  </template>
</ComponentDemo>

### Decimal places

Display precision is inferred from `step` (e.g. `step="0.001"` in percent mode
shows tenths of a percent). Set `decimals` explicitly to override.

<ComponentDemo>
  <div style="width: 300px; display: flex; flex-direction: column; gap: 0.75em">
    <NumberInput
      v-model="coverage"
      label="Coverage (inferred from step)"
      percent
      :step="0.001"
      :max="1"
    />
    <NumberInput
      v-model="r0"
      label="R0 (explicit decimals)"
      :decimals="3"
      :min="0"
      :max="18"
    />
  </div>

<template #code>

```vue
<NumberInput
  v-model="coverage"
  label="Coverage"
  percent
  :step="0.001"
  :max="1"
/>
<NumberInput v-model="r0" label="R0" :decimals="3" :min="0" :max="18" />
```

  </template>
</ComponentDemo>

### Required

With `required`, clearing the field shows a validation error on commit.

<ComponentDemo>
  <div style="width: 300px">
    <NumberInput v-model="days" label="Days" required />
  </div>

<template #code>

```vue
<NumberInput v-model="days" label="Days" required />
```

  </template>
</ComponentDemo>

Combine `required` with `live` to validate as the user types (debounced).

<ComponentDemo>
  <div style="width: 300px; display: flex; flex-direction: column; gap: 0.75em">
    <NumberInput v-model="days" label="Days (on blur)" required />
    <NumberInput v-model="days" label="Days (live)" required live />
  </div>

<template #code>

```vue
<NumberInput v-model="days" label="Days (on blur)" required />
<NumberInput v-model="days" label="Days (live)" required live />
```

  </template>
</ComponentDemo>

### Hidden label

Use `hide-label` to visually hide the label while keeping it available to
screen readers. Useful when a heading or surrounding context already describes
the input visually.

<ComponentDemo>
  <div style="width: 300px">
    <NumberInput v-model="days" label="Days" hide-label />
  </div>

<template #code>

```vue
<NumberInput v-model="days" label="Days" hide-label />
```

  </template>
</ComponentDemo>

<!--@include: ./_api/number-input.md-->
