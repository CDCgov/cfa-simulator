---
keywords: [button group, buttons, group, toolbar, segmented, joined]
---

# ButtonGroup

A container that visually joins a set of [`Button`](./button)s (or any
elements) into a single connected unit. It only handles layout and styling —
each button keeps its own click handler and state. For a stateful "pick one (or
more)" control that looks like a button group, use
[`ToggleGroup`](./toggle-group) instead.

## Examples

### Joined buttons

<ComponentDemo>
  <ButtonGroup aria-label="Document actions">
    <Button variant="secondary">Cut</Button>
    <Button variant="secondary">Copy</Button>
    <Button variant="secondary">Paste</Button>
  </ButtonGroup>

<template #code>

```vue
<ButtonGroup aria-label="Document actions">
  <Button variant="secondary">Cut</Button>
  <Button variant="secondary">Copy</Button>
  <Button variant="secondary">Paste</Button>
</ButtonGroup>
```

  </template>
</ComponentDemo>

### Vertical

Set `orientation="vertical"` to stack the buttons. They stretch to a common
width so the dividers line up.

<ComponentDemo>
  <ButtonGroup orientation="vertical" aria-label="Zoom">
    <Button>Zoom in</Button>
    <Button>Reset</Button>
    <Button>Zoom out</Button>
  </ButtonGroup>

<template #code>

```vue
<ButtonGroup orientation="vertical" aria-label="Zoom">
  <Button>Zoom in</Button>
  <Button>Reset</Button>
  <Button>Zoom out</Button>
</ButtonGroup>
```

  </template>
</ComponentDemo>

<!--@include: ./_api/button-group.md-->
