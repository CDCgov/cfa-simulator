---
keywords:
  [menu, dropdown menu, actions, more, overflow, kebab, meatball, context]
---

# Menu

A dropdown menu of actions or links, opened from an icon button (`more_horiz`
by default) or any trigger you pass. Options use the same shape and row layout
as [List](./list): `label`, `description`, `icon`, `swatch`, `disabled`,
`href` and `to`, plus `danger` for destructive actions. Built on
[reka-ui's DropdownMenu](https://reka-ui.com/docs/components/dropdown-menu), so
arrow keys move between options, typing jumps to one, and Escape closes it.

The dropdown itself loads the first time a Menu mounts; the trigger renders
immediately, and a click made before the dropdown arrives still opens it.

To open a menu from a List row or header, use List's `item-menu` and
`header-menu` (see [List: Menus](./list#menus)).

<script setup>
import { ref } from 'vue'
const lastChoice = ref('')
</script>

## Examples

### Actions

`select` fires with the chosen option and its index. Give the default trigger
an accessible name with `label`.

<ComponentDemo>
  <div style="display: flex; align-items: center; gap: 0.5rem">
    <Menu
      label="Scenario actions"
      :items="[
        { value: 'rename', label: 'Rename', icon: 'edit' },
        { value: 'export', label: 'Export', icon: 'download', description: 'CSV of every output' },
        { value: 'archive', label: 'Archive', disabled: true },
        { value: 'delete', label: 'Delete', icon: 'delete', danger: true },
      ]"
      @select="(option) => (lastChoice = option.label)"
    />
    <span style="font-size: 0.875rem">Last choice: {{ lastChoice || 'none' }}</span>
  </div>

<template #code>

```vue
<Menu
  label="Scenario actions"
  :items="[
    { value: 'rename', label: 'Rename', icon: 'edit' },
    {
      value: 'export',
      label: 'Export',
      icon: 'download',
      description: 'CSV of every output',
    },
    { value: 'archive', label: 'Archive', disabled: true },
    { value: 'delete', label: 'Delete', icon: 'delete', danger: true },
  ]"
  @select="(option) => run(option.value)"
/>
```

  </template>
</ComponentDemo>

### Custom trigger

The `trigger` slot replaces the icon button; pass a single focusable element.
`align` (`start`, `center`, `end`; default `end`) and `side` place the
dropdown against it.

<ComponentDemo>
  <Menu
    align="start"
    description-position="end"
    swatch-position="end"
    :items="[
      { value: 'cases', label: 'Cases', description: '1,204', swatch: '#1f77b4' },
      { value: 'hosp', label: 'Hospitalizations', description: '87', swatch: '#ff7f0e' },
      { value: 'docs', label: 'Documentation', icon: 'help', href: 'https://github.com/CDCgov/cfa-simulator' },
    ]"
  >
    <template #trigger>
      <Button variant="neutral">Series</Button>
    </template>
  </Menu>

<template #code>

```vue
<Menu
  align="start"
  description-position="end"
  swatch-position="end"
  :items="[
    { value: 'cases', label: 'Cases', description: '1,204', swatch: '#1f77b4' },
    {
      value: 'hosp',
      label: 'Hospitalizations',
      description: '87',
      swatch: '#ff7f0e',
    },
    {
      value: 'docs',
      label: 'Documentation',
      icon: 'help',
      href: 'https://github.com/CDCgov/cfa-simulator',
    },
  ]"
>
  <template #trigger>
    <Button variant="neutral">Series</Button>
  </template>
</Menu>
```

  </template>
</ComponentDemo>

Like List, the `start`, `text` and `end` slots (`{ item, index }`) replace the
icon/swatch, the text, and the end of each option.

<!--@include: ./_api/menu.md-->
