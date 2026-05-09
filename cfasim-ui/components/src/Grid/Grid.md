---
keywords:
  [
    grid,
    columns,
    layout,
    responsive,
    auto-fit,
    cards,
    side-by-side,
    proportional,
  ]
---

# Grid

A CSS-grid wrapper for arranging elements in equal, proportional, or auto-fitting columns.

For single-direction stacks (vertical or a flex row that wraps), use [Container](./container) instead.

## Examples

### Equal columns

Pass a number for N equal-width columns.

<ComponentDemo>
  <Grid :cols="3" gap="medium">
    <Box variant="info">Column 1</Box>
    <Box variant="info">Column 2</Box>
    <Box variant="info">Column 3</Box>
  </Grid>

<template #code>

```vue
<Grid :cols="3" gap="medium">
  <Box variant="info">Column 1</Box>
  <Box variant="info">Column 2</Box>
  <Box variant="info">Column 3</Box>
</Grid>
```

  </template>
</ComponentDemo>

### Proportional widths

Pass an array of `fr` weights for asymmetric layouts.

<ComponentDemo>
  <Grid :cols="[2, 3, 1]" gap="medium">
    <Box variant="info">2fr</Box>
    <Box variant="success">3fr</Box>
    <Box variant="warning">1fr</Box>
  </Grid>

<template #code>

```vue
<Grid :cols="[2, 3, 1]" gap="medium">
  <Box variant="info">2fr</Box>
  <Box variant="success">3fr</Box>
  <Box variant="warning">1fr</Box>
</Grid>
```

  </template>
</ComponentDemo>

### Mixed track sizes

Strings pass through unchanged, so you can combine fixed and flexible tracks.

<ComponentDemo>
  <Grid :cols="['200px', '1fr']" gap="medium">
    <Box variant="info">Fixed 200px</Box>
    <Box variant="info">Fills remaining space</Box>
  </Grid>

<template #code>

```vue
<Grid :cols="['200px', '1fr']" gap="medium">
  <Box variant="info">Fixed 200px</Box>
  <Box variant="info">Fills remaining space</Box>
</Grid>
```

  </template>
</ComponentDemo>

### Small-width breakpoint

`colsSmall` overrides `cols` when the grid's own width is at or below `breakpoint`. The default breakpoint is `640px` unless you specify it. The check is a CSS container query against the grid itself, so it triggers based on the grid's available width (e.g. when nested inside a sidebar), not the viewport.

<ComponentDemo>
  <Grid :cols="3" :cols-small="1" breakpoint="480px" gap="small">
    <Box variant="info">Card 1</Box>
    <Box variant="info">Card 2</Box>
    <Box variant="info">Card 3</Box>
  </Grid>

<template #code>

```vue
<Grid :cols="3" :cols-small="1" breakpoint="480px" gap="small">
  <Box variant="info">Card 1</Box>
  <Box variant="info">Card 2</Box>
  <Box variant="info">Card 3</Box>
</Grid>
```

  </template>
</ComponentDemo>

### Responsive auto-fit

`minColWidth` switches to `repeat(auto-fit, minmax(...))` so items reflow to fit the viewport without media queries. Great for metric tiles and card grids.

<ComponentDemo>
  <Grid min-col-width="180px" gap="medium">
    <Box variant="info">Card 1</Box>
    <Box variant="info">Card 2</Box>
    <Box variant="info">Card 3</Box>
    <Box variant="info">Card 4</Box>
    <Box variant="info">Card 5</Box>
  </Grid>

<template #code>

```vue
<Grid min-col-width="180px" gap="medium">
  <Box variant="info">Card 1</Box>
  <Box variant="info">Card 2</Box>
  <Box variant="info">Card 3</Box>
  <Box variant="info">Card 4</Box>
  <Box variant="info">Card 5</Box>
</Grid>
```

  </template>
</ComponentDemo>

### Nested grids

<ComponentDemo>
  <Grid :cols="2" gap="medium">
    <Box variant="info">Left</Box>
    <Grid :cols="2" gap="small">
      <Box variant="success">a</Box>
      <Box variant="success">b</Box>
      <Box variant="success">c</Box>
      <Box variant="success">d</Box>
    </Grid>
  </Grid>

<template #code>

```vue
<Grid :cols="2" gap="medium">
  <Box variant="info">Left</Box>
  <Grid :cols="2" gap="small">
    <Box variant="success">a</Box>
    <Box variant="success">b</Box>
    <Box variant="success">c</Box>
    <Box variant="success">d</Box>
  </Grid>
</Grid>
```

  </template>
</ComponentDemo>

<!--@include: ./_api/grid.md-->
