---
keywords: [file, file input, upload, file upload, csv, drag and drop, dropzone]
---

# FileInput

A file picker: a button that opens the file dialog, the chosen file names, a
clear button, and a drop target for files dragged onto the field. The model is
a `File` (or `null`) by default and a `File[]` with `multiple`; read the
contents with `file.text()` or `file.arrayBuffer()`.

## Examples

<script setup>
import { ref, watch } from 'vue'
const file = ref(null)
const preview = ref('')
watch(file, async (f) => {
  if (!f) { preview.value = ''; return }
  const text = await f.text()
  const lines = text.split('\n').filter(Boolean)
  preview.value = `${lines.length} lines, first: ${lines[0] ?? ''}`
})
const files = ref([])
</script>

### Single file

`accept` takes the native syntax (extensions and MIME types). The dialog filters
by it, and so does the drop target: a dropped file that does not match is
reported under the field and in the `rejected` event.

<ComponentDemo>
  <div style="width: 360px">
    <FileInput
      v-model="file"
      label="Case data"
      hint="A CSV with a date column and a count column"
      accept=".csv,text/csv"
    />
    <p class="file-input-preview" style="margin-top: 0.5em; font-size: 0.75rem">{{ preview }}</p>
  </div>

<template #code>

```vue
<script setup>
import { ref, watch } from "vue";
const file = ref(null);
watch(file, async (f) => {
  if (f) console.log(await f.text());
});
</script>

<FileInput
  v-model="file"
  label="Case data"
  hint="A CSV with a date column and a count column"
  accept=".csv,text/csv"
/>
```

  </template>
</ComponentDemo>

### Multiple files

<ComponentDemo>
  <div style="width: 360px">
    <FileInput
      v-model="files"
      label="Scenario files"
      multiple
      accept=".json,.yaml,.yml,.toml"
      placeholder="Drop parameter files here"
    />
  </div>

<template #code>

```vue
<script setup>
import { ref } from "vue";
const files = ref([]);
</script>

<FileInput
  v-model="files"
  label="Scenario files"
  multiple
  accept=".json,.yaml,.yml,.toml"
  placeholder="Drop parameter files here"
/>
```

  </template>
</ComponentDemo>

Set `:dropzone="false"` to turn the drop target off, and `button-label` to
rename the button.

<!--@include: ./_api/file-input.md-->
