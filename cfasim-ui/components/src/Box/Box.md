# Box

A colored container for callouts, alerts, and grouped content.

## Examples

### Variants

<ComponentDemo>
  <Box variant="info">This is an info box.</Box>
  <Box variant="success">This is a success box.</Box>
  <Box variant="warning">This is a warning box.</Box>
  <Box variant="error">This is an error box.</Box>

<template #code>

```vue
<Box variant="info">This is an info box.</Box>
<Box variant="success">This is a success box.</Box>
<Box variant="warning">This is a warning box.</Box>
<Box variant="error">This is an error box.</Box>
```

  </template>
</ComponentDemo>

### Custom colors

<ComponentDemo>
  <Box bg-color="#f0e6ff" text-color="#4a1d96">Custom purple box</Box>

<template #code>

```vue
<Box bg-color="#f0e6ff" text-color="#4a1d96">Custom purple box</Box>
```

  </template>
</ComponentDemo>

<!--@include: ./_api/box.md-->
