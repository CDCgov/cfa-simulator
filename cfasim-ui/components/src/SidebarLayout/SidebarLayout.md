# SidebarLayout

A responsive two-panel layout with a collapsible sidebar and main content area. On mobile, the sidebar becomes an overlay.

## Demo

<a href="/cfa-simulator/docs/demos/sidebar-layout/index.html" target="_blank">Open in full window ↗</a>

<div style="border: 1px solid var(--vp-c-border); border-radius: 8px; overflow: hidden; height: 500px;">
  <iframe src="/cfa-simulator/docs/demos/sidebar-layout/index.html" style="width: 100%; height: 100%; border: none;" />
</div>

## Tabs Demo (Router Mode)

<a href="/cfa-simulator/docs/demos/sidebar-tabs/index.html" target="_blank">Open in full window ↗</a>

<div style="border: 1px solid var(--vp-c-border); border-radius: 8px; overflow: hidden; height: 500px;">
  <iframe src="/cfa-simulator/docs/demos/sidebar-tabs/index.html" style="width: 100%; height: 100%; border: none;" />
</div>

## Usage

```vue
<SidebarLayout>
  <template #sidebar>
    <h2>Controls</h2>
    <NumberInput v-model="value" label="Parameter" slider live />
  </template>
  <h1>Main Content</h1>
  <p>Your charts and data go here.</p>
</SidebarLayout>
```

## Slots

| Slot      | Description                                |
| --------- | ------------------------------------------ |
| `sidebar` | Content rendered in the left sidebar panel |
| `default` | Main content area                          |

## Props

| Prop          | Type      | Default     | Description                                          |
| ------------- | --------- | ----------- | ---------------------------------------------------- |
| `hideTopbar`  | `boolean` | `false`     | Hides the topbar that contains the light/dark toggle |
| `tabs`        | `Tab[]`   | `undefined` | Array of tab definitions to render in the main area  |
| `v-model:tab` | `string`  | `undefined` | The active tab value (two-way binding)               |

### Tab type

```ts
interface Tab {
  value: string; // unique identifier
  label: string; // display text
  to?: string; // optional route path for vue-router integration
}
```

## Tabs

When the `tabs` prop is provided, a tab bar renders at the top of the main content area. Tabs support two modes:

### Local mode

Use `v-model:tab` to control which tab is active. Render content conditionally in the default slot.

```vue
<script setup>
import { ref } from "vue";
const activeTab = ref("chart");
</script>

<SidebarLayout
  v-model:tab="activeTab"
  :tabs="[
    { value: 'chart', label: 'Chart' },
    { value: 'data', label: 'Data' },
  ]"
>
  <template #sidebar>
    <h2>Controls</h2>
  </template>
  <div v-if="activeTab === 'chart'">Chart content</div>
  <div v-if="activeTab === 'data'">Data table</div>
</SidebarLayout>
```

### Router mode

When tabs include a `to` property and vue-router is installed, clicking a tab navigates to that route. The active tab is automatically determined from the current route.

```vue
<SidebarLayout
  :tabs="[
    { value: 'chart', label: 'Chart', to: '/model/chart' },
    { value: 'data', label: 'Data', to: '/model/data' },
  ]"
>
  <template #sidebar>
    <h2>Controls</h2>
  </template>
  <RouterView />
</SidebarLayout>
```
