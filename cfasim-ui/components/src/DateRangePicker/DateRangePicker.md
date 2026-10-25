---
keywords:
  [
    date range,
    daterangepicker,
    start date,
    end date,
    calendar,
    period,
    window,
    date,
  ]
---

# DateRangePicker

Start and end date fields with one range calendar. Bind the two ends with
`v-model:start` and `v-model:end`; each is a string in the picker's `format`
(`yyyy-mm-dd` by default), so they drop straight into URL params or model
inputs. The end date is inclusive.

In the calendar, the first click picks the start and the second the end (a
second click before the start swaps them), with the range previewed on
hover. The value is only emitted once both ends are picked. Typed dates
commit per field on blur or Enter, like [DatePicker](./date-picker), and an
end before the start is flagged and not emitted.

## Examples

<script setup>
import { ref } from 'vue'
const start = ref('2026-05-14')
const end = ref('2026-06-30')
const usStart = ref('05/14/2026')
const usEnd = ref('06/30/2026')
const boundedStart = ref('2026-06-01')
const boundedEnd = ref('2026-06-14')
const optionalStart = ref('')
const optionalEnd = ref('')
const inlineStart = ref('2026-05-14')
const inlineEnd = ref('2026-06-30')
const toStart = ref('2026-05-14')
const toEnd = ref('2026-06-30')
</script>

<ComponentDemo>
  <div style="width: 320px">
    <DateRangePicker
      v-model:start="start"
      v-model:end="end"
      label="Simulation window"
    />
    <p>Start: <code>{{ start }}</code>, end: <code>{{ end }}</code></p>
  </div>

<template #code>

```vue
<script setup>
import { ref } from "vue";
const start = ref("2026-05-14");
const end = ref("2026-06-30");
</script>

<DateRangePicker
  v-model:start="start"
  v-model:end="end"
  label="Simulation window"
/>
```

  </template>
</ComponentDemo>

### Inline layout

By default the two inputs get equal widths with a divider line between them
(`layout="split"`). `layout="inline"` instead sizes each input to its date
and puts a dash between them; `separator` replaces the dash with other
text, such as `"to"`.

<ComponentDemo>
  <div style="width: 320px; display: flex; flex-direction: column; gap: 1em">
    <DateRangePicker
      v-model:start="inlineStart"
      v-model:end="inlineEnd"
      label="Simulation window"
      layout="inline"
    />
    <DateRangePicker
      v-model:start="toStart"
      v-model:end="toEnd"
      label="Reporting period"
      layout="inline"
      separator="to"
    />
  </div>

<template #code>

```vue
<DateRangePicker
  v-model:start="start"
  v-model:end="end"
  label="Simulation window"
  layout="inline"
/>
<DateRangePicker
  v-model:start="start"
  v-model:end="end"
  label="Reporting period"
  layout="inline"
  separator="to"
/>
```

  </template>
</ComponentDemo>

### Formats

`format` and `display-format` work as in
[DatePicker](./date-picker#custom-formats): `format` is the model format,
and `display-format` (defaulting to `format`) is what the inputs show and
accept.

<ComponentDemo>
  <div style="width: 320px">
    <DateRangePicker
      v-model:start="usStart"
      v-model:end="usEnd"
      label="Reporting period"
      format="mm/dd/yyyy"
    />
    <p>Values: <code>{{ usStart }}</code>, <code>{{ usEnd }}</code></p>
  </div>

<template #code>

```vue
<DateRangePicker
  v-model:start="start"
  v-model:end="end"
  label="Reporting period"
  format="mm/dd/yyyy"
/>
```

  </template>
</ComponentDemo>

### Min and max

`min` and `max` (in `format`) bound both ends. Days outside them are
disabled in the calendar, and typed dates outside them are flagged.

<ComponentDemo>
  <div style="width: 320px">
    <DateRangePicker
      v-model:start="boundedStart"
      v-model:end="boundedEnd"
      label="Campaign"
      min="2026-05-14"
      max="2026-08-31"
    />
  </div>

<template #code>

```vue
<DateRangePicker
  v-model:start="start"
  v-model:end="end"
  label="Campaign"
  min="2026-05-14"
  max="2026-08-31"
/>
```

  </template>
</ComponentDemo>

### Clearing

An emptied field emits `""` for that end. `clearable` adds a button that
clears both, and `required` flags an empty field instead and keeps the last
value.

<ComponentDemo>
  <div style="width: 320px">
    <DateRangePicker
      v-model:start="optionalStart"
      v-model:end="optionalEnd"
      label="Intervention period"
      clearable
    />
    <p>
      Values: <code>{{ JSON.stringify(optionalStart) }}</code>,
      <code>{{ JSON.stringify(optionalEnd) }}</code>
    </p>
  </div>

<template #code>

```vue
<DateRangePicker
  v-model:start="start"
  v-model:end="end"
  label="Intervention period"
  clearable
/>
```

  </template>
</ComponentDemo>

### Accessibility

The two inputs sit in a `role="group"` named by `label` (or `aria-label`),
and are named "Start date" and "End date" by default; override them with
`start-label` and `end-label`.

<!--@include: ./_api/date-range-picker.md-->
