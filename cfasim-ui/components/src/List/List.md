---
keywords:
  [list, items, collapsible, header, action, menu, swatch, legend, sidebar]
---

# List

A compact list of items with an optional header. The header can collapse the
list and carry an action button (such as `add`), each row can carry its own
action button (such as `more_horiz`), and a row can show an icon or a color
swatch. Rows can be selectable, clickable, or links.

<script setup>
import { ref } from 'vue'
const scenarios = ref([
  { value: 1, label: 'Baseline', swatch: '#1f77b4' },
  { value: 2, label: 'School closures', swatch: '#ff7f0e' },
  { value: 3, label: 'Vaccination campaign', swatch: '#2ca02c' },
])
const open = ref(true)
const lastAction = ref('')
const selectedScenario = ref('base')
const lastClick = ref('')
const menuScenarios = ref([
  { value: 1, label: 'Baseline', swatch: '#1f77b4' },
  { value: 2, label: 'School closures', swatch: '#ff7f0e' },
])
const lastMenu = ref('')
const rowMenu = [
  { value: 'rename', label: 'Rename', icon: 'edit' },
  { value: 'duplicate', label: 'Duplicate', icon: 'add' },
  { value: 'delete', label: 'Delete', icon: 'delete', danger: true },
]
const newMenu = [
  { value: 'blank', label: 'Blank scenario' },
  { value: 'copy', label: 'Copy of baseline', description: 'Starts from Baseline' },
]
let nextScenario = 3
function onRowMenu(option, item) {
  lastMenu.value = `${option.label}: ${item.label}`
  const list = menuScenarios.value
  if (option.value === 'delete') {
    menuScenarios.value = list.filter((s) => s.value !== item.value)
  } else if (option.value === 'duplicate') {
    list.push({ ...item, value: nextScenario++, label: `${item.label} copy` })
  }
}
function onNewMenu(option) {
  lastMenu.value = option.label
  menuScenarios.value.push({ value: nextScenario, label: `Scenario ${nextScenario++}`, swatch: '#9467bd' })
}
function addScenario() {
  const n = scenarios.value.length + 1
  scenarios.value.push({ value: n, label: `Scenario ${n}`, swatch: '#9467bd' })
}
</script>

## Examples

### Swatches and icons

Set `swatch` (a CSS color) on an item for a swatch, `icon` for an [Icon](./icon), and
`description` for a second line.

<ComponentDemo>
  <List
    style="width: 18rem"
    :items="[
      { label: 'Susceptible', swatch: '#1f77b4' },
      { label: 'Infected', swatch: '#d62728' },
      { label: 'Parameters', icon: 'tune', description: 'R0, duration' },
      { label: 'Export', icon: 'download' },
    ]"
  />

<template #code>

```vue
<List
  :items="[
    { label: 'Susceptible', swatch: '#1f77b4' },
    { label: 'Infected', swatch: '#d62728' },
    { label: 'Parameters', icon: 'tune', description: 'R0, duration' },
    { label: 'Export', icon: 'download' },
  ]"
/>
```

  </template>
</ComponentDemo>

### Collapsible header with actions

`collapsible` turns the header into a toggle (`v-model:open`, open by default).
`header-action` puts an icon button in the header and `item-action` puts one on
every item; they emit `header-action` and `item-action` (with the item, its index
and the click event). To open a menu from them, see [Menus](#menus). Name them with `header-action-label`
and `item-action-label` (each row's button gets `": <label>"` appended); without
one, the button is named after its icon and a warning is logged.

<ComponentDemo>
  <div style="width: 18rem">
    <List
      v-model:open="open"
      label="Scenarios"
      collapsible
      header-action="add"
      header-action-label="Add scenario"
      item-action="more_horiz"
      item-action-label="More actions"
      :items="scenarios"
      @header-action="addScenario"
      @item-action="(item) => (lastAction = item.label)"
    />
    <p style="margin: 0.5em 0 0; font-size: 0.875rem">
      Last item action: {{ lastAction || 'none' }}
    </p>
  </div>

<template #code>

```vue
<script setup>
const scenarios = ref([
  { value: 1, label: "Baseline", swatch: "#1f77b4" },
  { value: 2, label: "School closures", swatch: "#ff7f0e" },
  { value: 3, label: "Vaccination campaign", swatch: "#2ca02c" },
]);
const open = ref(true);
</script>

<List
  v-model:open="open"
  label="Scenarios"
  collapsible
  header-action="add"
  header-action-label="Add scenario"
  item-action="more_horiz"
  item-action-label="More actions"
  :items="scenarios"
  @header-action="addScenario"
  @item-action="(item, index, event) => openMenu(item, event)"
/>
```

  </template>
</ComponentDemo>

### Menus

`item-menu` opens a [Menu](./menu) from each row's action button (`item-action`
sets its icon, `more_horiz` by default) and `header-menu` one from the header's
(`header-action`). Choosing an option emits `item-menu-select` with the option,
the row's item and its index, or `header-menu-select` with the option and its
index. `item-menu` can also be a function of `(item, index)` to vary the options
per row; a row whose function returns `[]` gets no button.

<ComponentDemo>
  <div style="width: 18rem">
    <List
      label="Scenarios"
      header-action="add"
      header-action-label="New scenario"
      :header-menu="newMenu"
      item-action-label="Scenario actions"
      :item-menu="rowMenu"
      action-visibility="hover"
      :items="menuScenarios"
      @header-menu-select="onNewMenu"
      @item-menu-select="onRowMenu"
    />
    <p style="margin: 0.5em 0 0; font-size: 0.875rem">
      Last choice: {{ lastMenu || 'none' }}
    </p>
  </div>

<template #code>

```vue
<script setup>
const rowMenu = [
  { value: "rename", label: "Rename", icon: "edit" },
  { value: "duplicate", label: "Duplicate", icon: "add" },
  { value: "delete", label: "Delete", icon: "delete", danger: true },
];
const newMenu = [
  { value: "blank", label: "Blank scenario" },
  {
    value: "copy",
    label: "Copy of baseline",
    description: "Starts from Baseline",
  },
];
</script>

<List
  label="Scenarios"
  header-action="add"
  header-action-label="New scenario"
  :header-menu="newMenu"
  item-action-label="Scenario actions"
  :item-menu="rowMenu"
  :items="scenarios"
  @header-menu-select="(option) => create(option.value)"
  @item-menu-select="(option, item) => run(option.value, item)"
/>
```

  </template>
</ComponentDemo>

### Actions on hover

`action-visibility="hover"` hides the action buttons until the row is hovered
or a button in it has focus. They stay in the tab order, and on touch screens
(no hover) they are always shown.

<ComponentDemo>
  <List
    style="width: 18rem"
    label="Layers"
    header-action="add"
    header-action-label="Add"
    item-action="more_horiz"
    item-action-label="More actions"
    action-visibility="hover"
    :items="[
      { label: 'Counties', icon: 'menu' },
      { label: 'States', icon: 'menu' },
      { label: 'Cities', icon: 'menu', disabled: true },
    ]"
  />

<template #code>

```vue
<List
  label="Layers"
  header-action="add"
  header-action-label="Add"
  item-action="more_horiz"
  item-action-label="More actions"
  action-visibility="hover"
  :items="[
    { label: 'Counties', icon: 'menu' },
    { label: 'States', icon: 'menu' },
    { label: 'Cities', icon: 'menu', disabled: true },
  ]"
/>
```

  </template>
</ComponentDemo>

### End of the row

`swatch-position="end"` moves the color swatch to the end of the row, beside the
item action, like a legend key. `description-position="end"` moves each item's
`description` there too, before the swatch, for a tag such as "Baseline" or a
value. The `end` slot (`{ item, index }`) replaces both.

<ComponentDemo>
  <List
    style="width: 20rem"
    label="Scenarios"
    header-action="add"
    header-action-label="Add"
    item-action="more_horiz"
    item-action-label="More actions"
    action-visibility="hover"
    swatch-position="end"
    description-position="end"
    :items="[
      { label: 'No intervention', swatch: '#1f77b4', description: 'Baseline' },
      { label: 'School closures', swatch: '#ff7f0e' },
      { label: 'Vaccination campaign', swatch: '#2ca02c' },
    ]"
  />

<template #code>

```vue
<List
  label="Scenarios"
  header-action="add"
  header-action-label="Add"
  item-action="more_horiz"
  item-action-label="More actions"
  action-visibility="hover"
  swatch-position="end"
  description-position="end"
  :items="[
    { label: 'No intervention', swatch: '#1f77b4', description: 'Baseline' },
    { label: 'School closures', swatch: '#ff7f0e' },
    { label: 'Vaccination campaign', swatch: '#2ca02c' },
  ]"
/>
```

  </template>
</ComponentDemo>

### Selectable

`selectable` makes each row with a `value` a button. `v-model:selected` holds
the selected option's `value`, and `select` fires with the option and its index.
Options without a `value` cannot be selected (a warning is logged). Item actions
still work on their own.

<ComponentDemo>
  <List
    v-model:selected="selectedScenario"
    style="width: 20rem"
    label="Scenarios"
    selectable
    item-action="more_horiz"
    item-action-label="More actions"
    action-visibility="hover"
    :items="[
      { value: 'base', label: 'No intervention', icon: 'menu', description: 'Baseline' },
      { value: 'schools', label: 'School closures', icon: 'menu' },
      { value: 'vax', label: 'Vaccination campaign', icon: 'menu', disabled: true },
    ]"
  />

<template #code>

```vue
<script setup>
const selected = ref("base");
</script>

<List
  v-model:selected="selected"
  label="Scenarios"
  selectable
  item-action="more_horiz"
  item-action-label="More actions"
  action-visibility="hover"
  :items="[
    {
      value: 'base',
      label: 'No intervention',
      icon: 'menu',
      description: 'Baseline',
    },
    { value: 'schools', label: 'School closures', icon: 'menu' },
    {
      value: 'vax',
      label: 'Vaccination campaign',
      icon: 'menu',
      disabled: true,
    },
  ]"
/>
```

  </template>
</ComponentDemo>

### Links and clicks

An option with `href` renders as a link, and one with `to` as a vue-router link
(navigating through the router when one is installed, a plain `href` otherwise).
On a `selectable` list the selected link gets `aria-current="page"`. Set
`clickable` to make rows buttons that emit `item-click` without selection;
`item-click` also fires for selectable and link rows.

<ComponentDemo>
  <div style="width: 20rem">
    <List
      label="Pages"
      clickable
      :items="[
        { value: 'readme', label: 'Readme', icon: 'menu' },
        { value: 'params', label: 'Parameters', icon: 'tune' },
        { value: 'gh', label: 'GitHub', icon: 'github', href: 'https://github.com/CDCgov/cfa-simulator' },
      ]"
      @item-click="(item) => (lastClick = item.label)"
    />
    <p style="margin: 0.5em 0 0; font-size: 0.875rem">
      Last click: {{ lastClick || 'none' }}
    </p>
  </div>

<template #code>

```vue
<List
  label="Pages"
  clickable
  :items="[
    { value: 'readme', label: 'Readme', icon: 'menu' },
    { value: 'params', label: 'Parameters', icon: 'tune' },
    {
      value: 'gh',
      label: 'GitHub',
      icon: 'github',
      href: 'https://github.com/CDCgov/cfa-simulator',
    },
  ]"
  @item-click="(item) => open(item.value)"
/>
```

  </template>
</ComponentDemo>

### Custom actions

The `action` slot replaces the icon button, for different or several actions
per row. It is hidden with the buttons under `action-visibility="hover"`.

<ComponentDemo>
  <List
    style="width: 20rem"
    label="Layers"
    action-visibility="hover"
    :items="[
      { value: 'counties', label: 'Counties', swatch: '#1f77b4' },
      { value: 'states', label: 'States', swatch: '#ff7f0e' },
    ]"
  >
    <template #action="{ item }">
      <Button variant="neutral" style="--button-height: 1.5rem; --button-padding-x: 0.5em" :aria-label="`Edit ${item.label}`">Edit</Button>
    </template>
  </List>

<template #code>

```vue
<List
  label="Layers"
  action-visibility="hover"
  :items="[
    { value: 'counties', label: 'Counties', swatch: '#1f77b4' },
    { value: 'states', label: 'States', swatch: '#ff7f0e' },
  ]"
>
  <template #action="{ item }">
    <Button variant="neutral" @click="edit(item)">Edit</Button>
  </template>
</List>
```

  </template>
</ComponentDemo>

### Custom content

In the header, `header` replaces the text, `header-end` fills the space before
the action, and `header-action` replaces the action button. On rows, `start`
replaces the swatch/icon, `text` the label and description, `end` the space
before the action, and `action` the action button; all four get
`{ item, index }`. Buttons and other interactive content in `end` and `action`
stay clickable on a `selectable` or `clickable` list.

<ComponentDemo>
  <List
    style="width: 20rem"
    label="Runs"
    header-action="add"
    header-action-label="Add"
    :items="[{ label: 'Run 1' }, { label: 'Run 2' }]"
  >
    <template #header-end>
      <span style="font-weight: 400; font-size: 0.75rem">2 runs</span>
    </template>
    <template #start="{ index }">
      <span style="width: 1.25em; color: var(--color-text-secondary)">{{ index + 1 }}.</span>
    </template>
    <template #end="{ index }">
      <code style="font-size: 0.75rem">{{ ['12 s', '9 s'][index] }}</code>
    </template>
  </List>

<template #code>

```vue
<List
  label="Runs"
  header-action="add"
  header-action-label="Add"
  :items="[{ label: 'Run 1' }, { label: 'Run 2' }]"
>
  <template #header-end><span>2 runs</span></template>
  <template #start="{ index }">
    <span>{{ index + 1 }}.</span>
  </template>
  <template #end="{ index }">
    <code>{{ durations[index] }}</code>
  </template>
</List>
```

  </template>
</ComponentDemo>

<!--@include: ./_api/list.md-->
