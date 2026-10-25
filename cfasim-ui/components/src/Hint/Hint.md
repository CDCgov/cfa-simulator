# Hint

An info icon that shows a tooltip on hover. Used alongside form labels to provide additional context.

The icon renders immediately; the tooltip behind it (reka-ui's Tooltip and its positioning code) is a separate chunk loaded the first time a Hint mounts, so apps whose fields never pass a `hint` do not bundle it.

## Examples

<ComponentDemo>
  <span style="display: flex; align-items: center; gap: 8px;">
    Population size <Hint text="The total number of individuals in the simulation." />
  </span>

<template #code>

```vue
<span style="display: flex; align-items: center; gap: 8px;">
  Population size
  <Hint text="The total number of individuals in the simulation." />
</span>
```

  </template>
</ComponentDemo>

<!--@include: ./_api/hint.md-->
