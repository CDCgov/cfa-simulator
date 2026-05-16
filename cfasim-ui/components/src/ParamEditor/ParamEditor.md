---
keywords:
  [parameters, editor, code, json, toml, yaml, codemirror, import, export]
---

# ParamEditor

A code editor for editing simulation parameters as JSON, TOML, or YAML. Backed by CodeMirror 6 with syntax highlighting. Includes Import, Export, and Apply actions. Apply can also be triggered with `Cmd`/`Ctrl`+`S`, and the editor auto-applies on blur whenever the text parses cleanly and the parsed value differs from the current `value`.

Exported files default to `params-YYYYMMDD-HHMMSS.<ext>` (local-time timestamp captured when Export is clicked). Override the basename with the `filename` prop.

The editor is **lazy-loaded**: the underlying CodeMirror bundle and YAML/TOML parsers are only fetched the first time `<ParamEditor>` mounts, so consumers that never open the editor never pay for it.

Users can switch formats from the dropdown; the editor round-trips the current value through the new format. Apply emits an `apply` event with the parsed value — the parent decides what to do with it (typically merge back into its own parameter state).

## Examples

<script setup>
import { reactive } from 'vue'
const params = reactive({ beta: 0.5, gamma: 0.1, population: 10000 })
function onApply(v) { Object.assign(params, v) }
const yamlParams = reactive({ beta: 0.5, gamma: 0.1 })
function onYamlApply(v) { Object.assign(yamlParams, v) }
</script>

### Basic usage

<ComponentDemo>
  <div style="width: 100%">
    <ParamEditor :value="params" @apply="onApply" />
    <p data-testid="basic-output">beta = {{ params.beta }}</p>
  </div>

<template #code>

```vue
<script setup>
import { reactive } from "vue";
const params = reactive({ beta: 0.5, gamma: 0.1, population: 10000 });
function onApply(v) {
  Object.assign(params, v);
}
</script>

<template>
  <ParamEditor :value="params" @apply="onApply" />
</template>
```

  </template>
</ComponentDemo>

### Starting in a different format

<ComponentDemo>
  <div style="width: 100%">
    <ParamEditor :value="yamlParams" format="yaml" @apply="onYamlApply" />
  </div>

<template #code>

```vue
<ParamEditor :value="params" format="yaml" @apply="onApply" />
```

  </template>
</ComponentDemo>

<!--@include: ./_api/param-editor.md-->
