---
keywords: [button, click, action, primary, secondary]
---

# Button

A button for triggering actions. Supports primary and secondary variants.

Built on [reka-ui Primitive](https://reka-ui.com/docs/utilities/primitive), so it supports `as` and `asChild` for rendering as different elements.

## Examples

### Variants

<ComponentDemo>
  <Button>Primary</Button>
  <Button variant="secondary">Secondary</Button>

<template #code>

```vue
<Button>Primary</Button>
<Button variant="secondary">Secondary</Button>
```

  </template>
</ComponentDemo>

### Disabled

<ComponentDemo>
  <Button disabled>Disabled</Button>
  <Button variant="secondary" disabled>Disabled</Button>

<template #code>

```vue
<Button disabled>Disabled</Button>
<Button variant="secondary" disabled>Disabled</Button>
```

  </template>
</ComponentDemo>

### With label prop

<ComponentDemo>
  <Button label="Click me" />

<template #code>

```vue
<Button label="Click me" />
```

  </template>
</ComponentDemo>

<!--@include: ./_api/button.md-->
