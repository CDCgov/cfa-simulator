---
keywords: [textarea, text area, multiline, multi-line text, notes, description]
---

# TextArea

A multi-line text field with optional label and hint. Like
[`TextInput`](./text-input), the model updates when the field loses focus or on
Ctrl/Cmd+Enter, not on every keystroke, so a model run bound to it does not fire
mid-sentence.

## Examples

<script setup>
import { ref } from 'vue'
const notes = ref('')
const description = ref('A short description that grows with its text.')
</script>

### Basic

<ComponentDemo>
  <div style="width: 360px">
    <TextArea
      v-model="notes"
      label="Scenario notes"
      placeholder="What does this scenario assume?"
      hint="Saved with the run"
    />
    <pre class="text-area-value" style="white-space: pre-wrap; margin-top: 0.5em; font-size: 0.75rem">{{ notes }}</pre>
  </div>

<template #code>

```vue
<script setup>
import { ref } from "vue";
const notes = ref("");
</script>

<TextArea
  v-model="notes"
  label="Scenario notes"
  placeholder="What does this scenario assume?"
  hint="Saved with the run"
/>
```

  </template>
</ComponentDemo>

### Auto grow

`auto-grow` sizes the field to its text (`field-sizing: content`), with `rows`
as the minimum. Browsers without `field-sizing` keep the fixed `rows` height.
`resize` picks which edges the user may drag (`vertical` by default).

<ComponentDemo>
  <div style="width: 360px">
    <TextArea
      v-model="description"
      label="Description"
      :rows="2"
      auto-grow
      resize="none"
    />
  </div>

<template #code>

```vue
<TextArea
  v-model="description"
  label="Description"
  :rows="2"
  auto-grow
  resize="none"
/>
```

  </template>
</ComponentDemo>

<!--@include: ./_api/text-area.md-->
