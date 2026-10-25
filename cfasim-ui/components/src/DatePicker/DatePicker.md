---
keywords: [date, datepicker, calendar, date input, start date, day, format]
---

# DatePicker

A date field with a calendar popover. The value is a string in the picker's
`format`, `yyyy-mm-dd` by default, so it can go straight into URL params or
model inputs. Typed input commits on blur or Enter and is normalized to the
format (`2026-5-4` becomes `2026-05-04`). Text that doesn't parse, or falls
outside `min`/`max`, is marked `aria-invalid` and not emitted.

The calendar header has month and year dropdowns for jumping to a distant
date, next to the previous/next month arrows. The year list runs from
`min` to `max`, or 50 years either side of the opened date when unbounded,
and months outside `min`/`max` are disabled.

## Examples

<script setup>
import { ref } from 'vue'
const start = ref('2026-05-14')
const us = ref('05/14/2026')
const named = ref('May 14, 2026')
const iso = ref('2026-05-14')
const bounded = ref('2026-05-20')
const optional = ref('')
const policyStart = ref('2026-06-01')
</script>

<ComponentDemo>
  <div style="width: 300px">
    <DatePicker
      v-model="start"
      label="Start date"
      hint="The date of day 0"
    />
    <p>Value: <code>{{ start }}</code></p>
  </div>

<template #code>

```vue
<script setup>
import { ref } from "vue";
const start = ref("2026-05-14");
</script>

<DatePicker v-model="start" label="Start date" hint="The date of day 0" />
```

  </template>
</ComponentDemo>

### Custom formats

`format` sets both the displayed text and the model value (see
[display format](#display-format) to split them). The placeholder defaults to
the format string.

| Token  | Output    |
| ------ | --------- |
| `yyyy` | `2026`    |
| `yy`   | `26`      |
| `mmmm` | `January` |
| `mmm`  | `Jan`     |
| `mm`   | `01`      |
| `m`    | `1`       |
| `dd`   | `05`      |
| `d`    | `5`       |

Tokens are case-insensitive (`YYYY-MM-DD` works), and every other character is
a literal. Parsing is lenient: numbers can be typed with or without padding,
month names ignore case, and `yy` reads as 2000–2099. Month names are English.

<ComponentDemo>
  <div style="width: 300px; display: flex; flex-direction: column; gap: 1em">
    <DatePicker v-model="us" label="US format" format="mm/dd/yyyy" />
    <DatePicker v-model="named" label="Month name" format="mmm d, yyyy" />
    <p>Values: <code>{{ us }}</code>, <code>{{ named }}</code></p>
  </div>

<template #code>

```vue
<DatePicker v-model="us" label="US format" format="mm/dd/yyyy" />
<DatePicker v-model="named" label="Month name" format="mmm d, yyyy" />
```

  </template>
</ComponentDemo>

### Display format

To show one format but keep another as the value, set `display-format`. The
input shows and accepts `display-format`, while `v-model`, `min`, `max`, and
`reference-date` stay in `format`. This keeps a friendly field over an ISO
value for URLs and model inputs.

<ComponentDemo>
  <div style="width: 300px">
    <DatePicker v-model="iso" label="Report date" display-format="mmmm d, yyyy" />
    <p>Value: <code>{{ iso }}</code></p>
  </div>

<template #code>

```vue
<DatePicker v-model="iso" label="Report date" display-format="mmmm d, yyyy" />
```

  </template>
</ComponentDemo>

### Min and max

`min` and `max` take dates in the same `format`. Days outside the range are
disabled in the calendar, and typed dates outside it are flagged as invalid.

<ComponentDemo>
  <div style="width: 300px">
    <DatePicker
      v-model="bounded"
      label="Campaign start"
      min="2026-05-14"
      max="2026-08-31"
    />
  </div>

<template #code>

```vue
<DatePicker
  v-model="bounded"
  label="Campaign start"
  min="2026-05-14"
  max="2026-08-31"
/>
```

  </template>
</ComponentDemo>

### Clearing

An empty field emits `""`. Add `clearable` for a clear button, or `required` to
flag an empty field as invalid and keep the last value.

<ComponentDemo>
  <div style="width: 300px">
    <DatePicker v-model="optional" label="End date" clearable />
    <p>Value: <code>{{ JSON.stringify(optional) }}</code></p>
  </div>

<template #code>

```vue
<DatePicker v-model="optional" label="End date" clearable />
```

  </template>
</ComponentDemo>

### Model time

Simulations often count time in days from a start date. Pass `reference-date`
(the date of day 0, in `format`) to add a day field under the calendar: it
shows the current value as a day, and entering a day sets the date that many
days after the reference (negative days go before it). The reference day is
marked with a dot in place of today. `time-label` sets the day field's
label (default "Day"), and its hint names the reference date.

<ComponentDemo>
  <div style="width: 300px">
    <DatePicker
      v-model="policyStart"
      label="Policy start"
      reference-date="2026-05-14"
      time-label="Model day"
    />
    <p>Value: <code>{{ policyStart }}</code></p>
  </div>

<template #code>

```vue
<DatePicker
  v-model="policyStart"
  label="Policy start"
  reference-date="2026-05-14"
  time-label="Model day"
/>
```

  </template>
</ComponentDemo>

<!--@include: ./_api/date-picker.md-->
