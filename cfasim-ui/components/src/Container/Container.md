---
keywords: [container, layout, stack, row, flex, scrollable, border, card]
---

# Container

A flexible wrapper for grouping elements vertically (default) or horizontally. Optionally adds a border, fixed height with scrolling, and configurable gap between children.

For multi-column layouts use [Grid](./grid).

## Examples

### Vertical stack (default)

<ComponentDemo>
  <Container gap="small">
    <Box variant="info">First</Box>
    <Box variant="info">Second</Box>
    <Box variant="info">Third</Box>
  </Container>

<template #code>

```vue
<Container gap="small">
  <Box variant="info">First</Box>
  <Box variant="info">Second</Box>
  <Box variant="info">Third</Box>
</Container>
```

  </template>
</ComponentDemo>

### Horizontal row

A row of buttons or chips. Wraps onto multiple lines when space runs out.

<ComponentDemo>
  <Container horizontal gap="small">
    <Button>Save</Button>
    <Button variant="secondary">Cancel</Button>
    <Button variant="secondary">Reset</Button>
  </Container>

<template #code>

```vue
<Container horizontal gap="small">
  <Button>Save</Button>
  <Button variant="secondary">Cancel</Button>
  <Button variant="secondary">Reset</Button>
</Container>
```

  </template>
</ComponentDemo>

### Card with border

<ComponentDemo>
  <Container border gap="small">
    <strong>Run summary</strong>
    <span>Generated 1,000 samples in 2.4s</span>
  </Container>

<template #code>

```vue
<Container border gap="small">
  <strong>Run summary</strong>
  <span>Generated 1,000 samples in 2.4s</span>
</Container>
```

  </template>
</ComponentDemo>

### Scrollable region

Setting `height` automatically enables scrolling when content overflows.

<ComponentDemo>
  <Container border :height="180" gap="small">
    <div v-for="i in 30" :key="i">Line {{ i }}</div>
  </Container>

<template #code>

```vue
<Container border :height="180" gap="small">
  <div v-for="i in 30" :key="i">Line {{ i }}</div>
</Container>
```

  </template>
</ComponentDemo>

<!--@include: ./_api/container.md-->
