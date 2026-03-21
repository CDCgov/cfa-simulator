# Icon

Renders a [Material Symbols Outlined](https://fonts.google.com/icons) icon.

## Examples

### Sizes

<ComponentDemo>
  <Icon icon="help" size="sm" aria-label="help" />
  <Icon icon="help" size="md" aria-label="help" />
  <Icon icon="help" size="lg" aria-label="help" />

<template #code>

```vue
<Icon icon="help" size="sm" aria-label="help" />
<Icon icon="help" size="md" aria-label="help" />
<Icon icon="help" size="lg" aria-label="help" />
```

  </template>
</ComponentDemo>

### Filled

<ComponentDemo>
  <Icon icon="favorite" size="lg" aria-label="favorite" />
  <Icon icon="favorite" size="lg" :fill="true" aria-label="favorite filled" />

<template #code>

```vue
<Icon icon="favorite" size="lg" aria-label="favorite" />
<Icon icon="favorite" size="lg" :fill="true" aria-label="favorite filled" />
```

  </template>
</ComponentDemo>

### Inline in text

<ComponentDemo>
  <p style="margin: 0">Click the <Icon icon="help" size="sm" :inline="true" aria-label="help" /> icon for more info.</p>

<template #code>

```vue
<p>Click the <Icon icon="help" size="sm" :inline="true" aria-label="help" /> icon for more info.</p>
```

  </template>
</ComponentDemo>

<!--@include: ./_api/icon.md-->
