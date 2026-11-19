---
keywords: [tabs, tab bar, tab list, navigation, router, mobile, scroll]
---

# Tabs

A tab strip built on [reka-ui's Tabs](https://reka-ui.com/docs/components/tabs).
It renders the tab list only: show the active content yourself from the
`v-model` value, or from the route in router mode. [`SidebarLayout`](./sidebar-layout)
uses it for its `tabs` prop.

When the tabs do not fit, the list scrolls sideways instead of wrapping or
overflowing its container. An edge fades while more tabs are hidden past it,
and the active tab is scrolled into view when it changes.

## Examples

<script setup>
import { ref } from 'vue'
const view = ref('chart')
const region = ref('northeast')
const views = [
  { value: 'chart', label: 'Chart' },
  { value: 'data', label: 'Data' },
  { value: 'settings', label: 'Settings' },
]
const regions = [
  { value: 'northeast', label: 'Northeast' },
  { value: 'mid-atlantic', label: 'Mid-Atlantic' },
  { value: 'southeast', label: 'Southeast' },
  { value: 'midwest', label: 'Midwest' },
  { value: 'great-plains', label: 'Great Plains' },
  { value: 'southwest', label: 'Southwest' },
  { value: 'mountain', label: 'Mountain' },
  { value: 'pacific', label: 'Pacific' },
]
</script>

### Basic

<ComponentDemo>
  <div style="width: 100%">
    <Tabs v-model="view" :tabs="views" />
    <p>Active tab: {{ view }}</p>
  </div>

<template #code>

```vue
<script setup>
import { ref } from "vue";
const view = ref("chart");
const views = [
  { value: "chart", label: "Chart" },
  { value: "data", label: "Data" },
  { value: "settings", label: "Settings" },
];
</script>

<Tabs v-model="view" :tabs="views" />
<p>Active tab: {{ view }}</p>
```

  </template>
</ComponentDemo>

### Overflow

In a narrow container, such as a phone screen, the list scrolls. Swipe or use
the arrow keys to reach the hidden tabs.

<ComponentDemo>
  <div style="max-width: 320px">
    <Tabs v-model="region" :tabs="regions" label="Regions" />
  </div>

<template #code>

```vue
<div style="max-width: 320px">
  <Tabs v-model="region" :tabs="regions" label="Regions" />
</div>
```

  </template>
</ComponentDemo>

## Router mode

When tabs have a `to` path and vue-router is installed, choosing a tab
navigates to its route and the active tab follows the current route, so no
`v-model` is needed.

```vue
<Tabs
  :tabs="[
    { value: 'chart', label: 'Chart', to: '/model/chart' },
    { value: 'data', label: 'Data', to: '/model/data' },
  ]"
/>
<RouterView />
```

## Tab type

```ts
interface Tab {
  value: string; // unique identifier
  label: string; // display text
  to?: string; // optional route path for vue-router integration
}
```

<!--@include: ./_api/tabs.md-->
