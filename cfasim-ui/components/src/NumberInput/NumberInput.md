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
const cutpoints = ref([10, 40, 75])
const tiers = ref([25, 50, 80])
const barSegments = ref([20, 45, 70])
const barNone = ref(60)
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

### Multiple handles

Bind `v-model:values` with a `number[]` to get one handle per entry. Any
number of handles is supported, and the array length can change at runtime.
Like range mode, it's enabled by the binding alone and replaces the text
input with a slider.

<ComponentDemo>
  <div style="width: 300px">
    <NumberInput
      v-model:values="cutpoints"
      label="Age cutpoints"
      :min="0"
      :max="100"
      number-type="integer"
    />
  </div>

<template #code>

```vue
<script setup>
import { ref } from "vue";
const cutpoints = ref([10, 40, 75]);
</script>

<NumberInput
  v-model:values="cutpoints"
  label="Age cutpoints"
  :min="0"
  :max="100"
  number-type="integer"
/>
```

  </template>
</ComponentDemo>

Handles stay sorted, and each one is labeled by position for screen readers
(`Age cutpoints (handle 2 of 3)`); validation errors name the failing handle
the same way. `v-model:values` takes precedence over the range bindings if
both are present.

### Bar styles

`bar` controls how the track is filled. The default, `"range"`, fills
between the outermost handles (from the minimum to the handle in single
mode). `"segments"` paints one band per handle — minimum to the first, first
to the second, and so on — leaving the track past the last handle empty.
`"none"` paints no fill at all.

<ComponentDemo>
  <div style="width: 300px">
    <NumberInput
      v-model:values="barSegments"
      label="Segments"
      bar="segments"
      :min="0"
      :max="100"
      number-type="integer"
    />
    <NumberInput
      v-model="barNone"
      label="No bar"
      slider
      bar="none"
      :min="0"
      :max="100"
    />
  </div>

<template #code>

```vue
<script setup>
import { ref } from "vue";
const barSegments = ref([20, 45, 70]);
const barNone = ref(60);
</script>

<NumberInput
  v-model:values="barSegments"
  label="Segments"
  bar="segments"
  :min="0"
  :max="100"
  number-type="integer"
/>
<NumberInput
  v-model="barNone"
  label="No bar"
  slider
  bar="none"
  :min="0"
  :max="100"
/>
```

  </template>
</ComponentDemo>

Segments default to a ramp of `--color-primary`, from full strength for the
first band down to 45% for the last. Pass `segment-colors` to paint them
yourself — any CSS colors, cycled if the array is shorter than the number of
segments.

<ComponentDemo>
  <div style="width: 300px">
    <NumberInput
      v-model:values="tiers"
      label="Risk tiers"
      bar="segments"
      :segment-colors="[
        'var(--color-success)',
        'var(--color-warning)',
        'var(--color-error)',
      ]"
      :min="0"
      :max="100"
      number-type="integer"
    />
  </div>

<template #code>

```vue
<script setup>
import { ref } from "vue";
const tiers = ref([25, 50, 80]);
</script>

<NumberInput
  v-model:values="tiers"
  label="Risk tiers"
  bar="segments"
  :segment-colors="[
    'var(--color-success)',
    'var(--color-warning)',
    'var(--color-error)',
  ]"
  :min="0"
  :max="100"
  number-type="integer"
/>
```

  </template>
</ComponentDemo>

`bar` works in every mode, so a plain `slider` or a two-handle range can use
`"none"` or `"segments"` too.

### Accessibility

Every handle is its own `role="slider"`, focusable and steerable with the
arrow keys, <kbd>Home</kbd> and <kbd>End</kbd>. Two or more handles are
wrapped in a named `role="group"`, following the WAI-ARIA multi-thumb slider
pattern, and each one is named from the field: `Age cutpoints (handle 2 of
3)`, or `(lower)`/`(upper)` for a range. With no visible `label`, the name
falls back to `aria-label`.

`aria-valuenow` can only hold the raw number, so handles also carry
`aria-valuetext` with the value as displayed — `20%` rather than `0.2`,
`2024-03-01` rather than an epoch. Validation errors are announced with
`role="alert"` and referenced by `aria-describedby` on every handle, with
`aria-invalid` on the one that is out of range.

Segment bands are `aria-hidden` decoration: the handles carry the
information, and each boundary is marked by a high-contrast thumb. The
default shade ramp does not meet the 3:1 non-text contrast ratio between
adjacent bands — no single-hue ramp of three or more steps can — so don't
rely on shade alone to tell bins apart. Pass `segment-colors` when the bands
themselves have to be distinguishable. Under Windows High Contrast the ramp
collapses to system colors, so bands are separated by hairline dividers
instead.

### Custom display format

Pass `format` to control how the value is displayed in the text input and
in slider thumb/min/max labels. Accepts a
[`NumberFormat`](../charts/data-table.md#columnconfig) — a preset name
(optionally with a `:N` digits suffix, e.g. `"percent:1"`), a printf-style
format string (`"%.2f"`), or a `(value: number) => string` function. The
internal model stays a number — only the displayed text changes.

When unset, the default formatting follows the `percent` and `decimals`
props. When set, `format` overrides both. Formats that add suffixes or
scale the value (e.g. `"percent:1"` → `"12.3%"`) may not round-trip
through the text input — pair them with `percent: true` for value scaling
and use `format` for display shaping.

The older `slider-display` prop (a `(value: number) => string` function
that only affected slider thumb/min/max labels) is **deprecated** but
still honored when `format` is unset. Prefer `format` for new code.

<ComponentDemo>
  <div style="width: 300px">
    <NumberInput
      v-model:range="dateRange"
      label="Date range"
      :min="dateStart"
      :max="dateEnd"
      :step="dayMs"
      :format="formatDate"
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
  :format="formatDate"
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
