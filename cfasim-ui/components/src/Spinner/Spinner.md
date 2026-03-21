# Spinner

A loading indicator with accessible labeling.

## Examples

### Sizes

<ComponentDemo>
  <Spinner size="sm" label="Loading" />
  <Spinner size="md" label="Loading" />
  <Spinner size="lg" label="Loading" />

<template #code>

```vue
<Spinner size="sm" label="Loading" />
<Spinner size="md" label="Loading" />
<Spinner size="lg" label="Loading" />
```

  </template>
</ComponentDemo>

### In context

<ComponentDemo>
  <div style="display: flex; align-items: center; gap: 8px;">
    <Spinner size="sm" label="Running model" />
    <span>Running model...</span>
  </div>

<template #code>

```vue
<div style="display: flex; align-items: center; gap: 8px;">
  <Spinner size="sm" label="Running model" />
  <span>Running model...</span>
</div>
```

  </template>
</ComponentDemo>

<!--@include: ./_api/spinner.md-->
