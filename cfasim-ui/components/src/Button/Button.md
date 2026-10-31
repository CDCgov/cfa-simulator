---
keywords: [button, click, action, primary, secondary, neutral]
---

# Button

A button for triggering actions. Supports primary, secondary and neutral variants; neutral is an outlined, text-colored button with no fill, for actions that sit beside form fields.

Built on [reka-ui Primitive](https://reka-ui.com/docs/utilities/primitive), so it supports `as` and `asChild` for rendering as different elements.

## Examples

### Variants

<ComponentDemo>
  <Button>Primary</Button>
  <Button variant="secondary">Secondary</Button>
  <Button variant="neutral">Neutral</Button>

<template #code>

```vue
<Button>Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="neutral">Neutral</Button>
```

  </template>
</ComponentDemo>

### Disabled

<ComponentDemo>
  <Button disabled>Disabled</Button>
  <Button variant="secondary" disabled>Disabled</Button>
  <Button variant="neutral" disabled>Disabled</Button>

<template #code>

```vue
<Button disabled>Disabled</Button>
<Button variant="secondary" disabled>Disabled</Button>
<Button variant="neutral" disabled>Disabled</Button>
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
