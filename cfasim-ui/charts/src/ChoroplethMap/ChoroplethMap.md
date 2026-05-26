<script setup>
import { computed, ref } from "vue";
import countiesTopoForPerf from "us-atlas/counties-10m.json";
import { fipsToHsa } from "@cfasim-ui/charts/hsa-mapping";

// Build one row per county (~3,143) with a deterministic-ish value so the
// perf example can render every region with a custom tooltip.
const denseCountyData = computed(() => {
  const geoms = countiesTopoForPerf.objects.counties.geometries;
  return geoms.map((g, i) => ({
    id: String(g.id).padStart(5, "0"),
    value: (i * 37) % 100,
  }));
});

// Focus demo state — bound directly to v-model:focus. The component
// handles click-to-toggle and emits null when the focused feature is
// re-clicked.
const focused = ref(null);

// "Outline a focused feature's parent" demo: focus is a county id;
// we derive the parent HSA and add it to the focus array as a dashed
// overlay so clicking a county also outlines its HSA.
const focusedCounty = ref(null);
const parentFocus = computed(() => {
  const fips = focusedCounty.value;
  if (!fips) return null;
  const hsa = fipsToHsa[fips];
  return hsa
    ? [fips, { id: hsa, geoType: "hsas", style: "dashed", stroke: "#666" }]
    : fips;
});
</script>

# ChoroplethMap

A US choropleth map using D3's Albers USA projection, which repositions Alaska and Hawaii to the bottom left. Supports state-level, county-level, and HSA-level (Health Service Areas) rendering via the `geoType` prop.

You must provide your own TopoJSON topology data via the `topology` prop. We recommend the [`us-atlas`](https://github.com/topojson/us-atlas) package:

```sh
npm install us-atlas
```

- **State-level maps**: use `us-atlas/states-10m.json`
- **County or HSA maps**: use `us-atlas/counties-10m.json` (includes both county and state boundaries)

```vue
<script setup>
import { ChoroplethMap } from "@cfasim-ui/charts";
import statesTopo from "us-atlas/states-10m.json";
import countiesTopo from "us-atlas/counties-10m.json";
</script>

<!-- State map -->
<ChoroplethMap :topology="statesTopo" :data="stateData" />

<!-- County map -->
<ChoroplethMap
  :topology="countiesTopo"
  geo-type="counties"
  :data="countyData"
/>
```

## Examples

### Basic with state data

<ComponentDemo>
  <ChoroplethMap
    :topology="statesTopo"
    :data="[
      { id: '06', value: 100 },
      { id: '36', value: 80 },
      { id: '48', value: 90 },
      { id: '12', value: 70 },
      { id: '17', value: 60 },
      { id: '37', value: 50 },
      { id: '42', value: 55 },
      { id: '39', value: 45 },
      { id: '13', value: 40 },
      { id: '26', value: 35 },
    ]"
    title="Cases by State"
    :legend-title="'Cases'"
    :height="400"
  />

<template #code>

```vue
<script setup>
import statesTopo from "us-atlas/states-10m.json";
</script>

<ChoroplethMap
  :topology="statesTopo"
  :data="[
    { id: '06', value: 100 },
    { id: '36', value: 80 },
    { id: '48', value: 90 },
    { id: '12', value: 70 },
    { id: '17', value: 60 },
  ]"
  title="Cases by State"
  :legend-title="'Cases'"
  :height="400"
/>
```

  </template>
</ComponentDemo>

### Custom color scale

<ComponentDemo>
  <ChoroplethMap
    :topology="statesTopo"
    :data="[
      { id: 'California', value: 100 },
      { id: 'Texas', value: 85 },
      { id: 'Florida', value: 70 },
      { id: 'New York', value: 90 },
      { id: 'Pennsylvania', value: 50 },
      { id: 'Illinois', value: 60 },
      { id: 'Ohio', value: 40 },
      { id: 'Georgia', value: 55 },
      { id: 'North Carolina', value: 45 },
      { id: 'Michigan', value: 35 },
    ]"
    :color-scale="{ min: '#fff5f0', max: '#a50f15' }"
    :legend-title="'Severity'"
    :height="400"
  />

<template #code>

```vue
<ChoroplethMap
  :topology="statesTopo"
  :data="[
    { id: 'California', value: 100 },
    { id: 'Texas', value: 85 },
    { id: 'Florida', value: 70 },
    { id: 'New York', value: 90 },
  ]"
  :color-scale="{ min: '#fff5f0', max: '#a50f15' }"
  :legend-title="'Severity'"
  :height="400"
/>
```

  </template>
</ComponentDemo>

### Threshold color scale

Use an array of `ThresholdStop` objects instead of a linear scale. Each stop defines a `min` threshold — values at or above that threshold get the stop's color. The highest matching stop wins.

<ComponentDemo>
  <ChoroplethMap
    :topology="statesTopo"
    :data="[
      { id: 'California', value: 80 },
      { id: 'Texas', value: 45 },
      { id: 'Florida', value: 60 },
      { id: 'New York', value: 25 },
      { id: 'Pennsylvania', value: 8 },
      { id: 'Illinois', value: 55 },
      { id: 'Ohio', value: 30 },
      { id: 'Georgia', value: 70 },
      { id: 'North Carolina', value: 15 },
      { id: 'Michigan', value: 3 },
    ]"
    :color-scale="[
      { min: 0, color: '#fee5d9', label: 'Low' },
      { min: 10, color: '#fcae91', label: 'Some' },
      { min: 30, color: '#fb6a4a', label: 'Moderate' },
      { min: 60, color: '#cb181d', label: 'High' },
    ]"
    title="Risk Level"
    :legend-title="'Risk'"
    :height="400"
  />

<template #code>

```vue
<ChoroplethMap
  :topology="statesTopo"
  :data="stateData"
  :color-scale="[
    { min: 0, color: '#fee5d9', label: 'Low' },
    { min: 10, color: '#fcae91', label: 'Some' },
    { min: 30, color: '#fb6a4a', label: 'Moderate' },
    { min: 60, color: '#cb181d', label: 'High' },
  ]"
  title="Risk Level"
  :legend-title="'Risk'"
  :height="400"
/>
```

  </template>
</ComponentDemo>

### Categorical color scale

Use an array of `CategoricalStop` objects to map string values to colors. Each stop defines a `value` to match and a `color` to apply.

<ComponentDemo>
  <ChoroplethMap
    :topology="statesTopo"
    :data="[
      { id: 'California', value: 'high' },
      { id: 'Texas', value: 'medium' },
      { id: 'Florida', value: 'high' },
      { id: 'New York', value: 'low' },
      { id: 'Pennsylvania', value: 'low' },
      { id: 'Illinois', value: 'medium' },
      { id: 'Ohio', value: 'low' },
      { id: 'Georgia', value: 'high' },
      { id: 'North Carolina', value: 'medium' },
      { id: 'Michigan', value: 'low' },
    ]"
    :color-scale="[
      { value: 'low', color: '#fee5d9' },
      { value: 'medium', color: '#fb6a4a' },
      { value: 'high', color: '#cb181d' },
    ]"
    title="Risk Category"
    :legend-title="'Risk'"
    :height="400"
  />

<template #code>

```vue
<ChoroplethMap
  :topology="statesTopo"
  :data="stateData"
  :color-scale="[
    { value: 'low', color: '#fee5d9' },
    { value: 'medium', color: '#fb6a4a' },
    { value: 'high', color: '#cb181d' },
  ]"
  title="Risk Category"
  :legend-title="'Risk'"
  :height="400"
/>
```

  </template>
</ComponentDemo>

### County-level map with pan and zoom

Set `geoType="counties"` to render county-level data using 5-digit FIPS codes. State borders are drawn on top for context. Use `pan` and `zoom` props to enable interactive navigation — useful for dense county data.

<ComponentDemo>
  <ChoroplethMap
    :topology="countiesTopo"
    geo-type="counties"
    :pan="true"
    :zoom="true"
    :data="[
      { id: '06037', value: 100 },
      { id: '06073', value: 80 },
      { id: '06059', value: 70 },
      { id: '36061', value: 90 },
      { id: '36047', value: 75 },
      { id: '17031', value: 85 },
      { id: '48201', value: 65 },
      { id: '04013', value: 60 },
      { id: '12086', value: 55 },
      { id: '53033', value: 50 },
    ]"
    title="Cases by County"
    :legend-title="'Cases'"
    :height="400"
  />

<template #code>

```vue
<ChoroplethMap
  :topology="countiesTopo"
  geo-type="counties"
  pan
  zoom
  :data="[
    { id: '06037', value: 100 },
    { id: '36061', value: 90 },
    { id: '17031', value: 85 },
    { id: '48201', value: 65 },
    { id: '04013', value: 60 },
  ]"
  title="Cases by County"
  :legend-title="'Cases'"
  :height="400"
/>
```

  </template>
</ComponentDemo>

### HSA-level map

Set `geoType="hsas"` to render Health Service Area boundaries. HSAs are dissolved from county boundaries using a built-in FIPS-to-HSA mapping. Use 6-digit HSA codes as IDs. State borders are overlaid for context.

<ComponentDemo>
  <ChoroplethMap
    :topology="countiesTopo"
    geo-type="hsas"
    :pan="true"
    :zoom="true"
    :data="[
      { id: '010259', value: 100 },
      { id: '060766', value: 90 },
      { id: '120159', value: 85 },
      { id: '090121', value: 70 },
      { id: '110061', value: 60 },
      { id: '040765', value: 55 },
      { id: '080731', value: 50 },
      { id: '050527', value: 45 },
      { id: '100075', value: 40 },
      { id: '020820', value: 35 },
    ]"
    title="Cases by HSA"
    :legend-title="'Cases'"
    :height="400"
  />

<template #code>

```vue
<ChoroplethMap
  :topology="countiesTopo"
  geo-type="hsas"
  pan
  zoom
  :data="[
    { id: '010259', value: 100 },
    { id: '060766', value: 90 },
    { id: '120159', value: 85 },
    { id: '090121', value: 70 },
    { id: '110061', value: 60 },
  ]"
  title="Cases by HSA"
  :legend-title="'Cases'"
  :height="400"
/>
```

  </template>
</ComponentDemo>

### Click to focus (`v-model:focus`)

Bind the `focus` prop to pan and zoom to a specific feature. Pass a feature
id (FIPS code, HSA code, or name) — or an array of ids to focus on a region.
With `v-model:focus`, clicking an unfocused feature focuses it and clicking
the focused feature toggles back off. If a tooltip is configured, focusing
shows that feature's tooltip. Users can pan/zoom freely around the focused
area; the built-in **Reset** button clears focus and snaps back.

Counties are tiny without a zoom — focus is a natural fit for drill-down.

<ComponentDemo>
  <ChoroplethMap
    :topology="countiesTopo"
    geo-type="counties"
    v-model:focus="focused"
    :focus-zoom-level="8"
    :data="[
      { id: '06037', value: 100 },
      { id: '06073', value: 80 },
      { id: '36061', value: 90 },
      { id: '17031', value: 85 },
      { id: '48201', value: 65 },
      { id: '04013', value: 60 },
      { id: '12086', value: 55 },
      { id: '53033', value: 50 },
    ]"
    title="Click a county to focus"
    :legend-title="'Cases'"
    :height="400"
  >
    <template #tooltip="{ name, value }">
      <div style="font-weight: 600">{{ name }}</div>
      <div v-if="value != null">Cases: {{ value }}</div>
      <div v-else style="opacity: 0.6">No data</div>
    </template>
  </ChoroplethMap>

<template #code>

```vue
<script setup>
import { ref } from "vue";
const focused = ref(null);
</script>

<ChoroplethMap
  :topology="countiesTopo"
  geo-type="counties"
  v-model:focus="focused"
  :focus-zoom-level="8"
  :data="data"
  title="Click a county to focus"
>
  <template #tooltip="{ name, value }">
    <div style="font-weight: 600">{{ name }}</div>
    <div v-if="value != null">Cases: {{ value }}</div>
    <div v-else style="opacity: 0.6">No data</div>
  </template>
</ChoroplethMap>
```

  </template>
</ComponentDemo>

### Color by HSA, interact by county (`dataGeoType`)

Set `dataGeoType` when your data is keyed by a coarser geography than
the one you want to render. Each county fills with its parent HSA's
value (via the built-in FIPS → HSA mapping); hover, click, and `focus`
still operate on the county geometry, and you can layer an HSA outline
on top with a `FocusItem`.

<ComponentDemo>
  <ChoroplethMap
    :topology="countiesTopo"
    geo-type="counties"
    data-geo-type="hsas"
    :pan="true"
    :zoom="true"
    :data="[
      { id: '060737', value: 80 },
      { id: '060723', value: 60 },
      { id: '060757', value: 45 },
      { id: '060807', value: 35 },
      { id: '060768', value: 25 },
      { id: '060774', value: 50 },
    ]"
    :focus="[
      { id: '06043' },
      { id: '060737', geoType: 'hsas', style: 'dashed' },
    ]"
    :focus-zoom-level="6"
    title="HSA-keyed data on a county map"
    :legend-title="'Cases'"
    :height="400"
  />

<template #code>

```vue
<ChoroplethMap
  :topology="countiesTopo"
  geo-type="counties"
  data-geo-type="hsas"
  :data="hsaData"
  :focus="[{ id: '06043' }, { id: '060737', geoType: 'hsas', style: 'dashed' }]"
  title="HSA-keyed data on a county map"
/>
```

  </template>
</ComponentDemo>

### Outline a focused feature's parent

Use `v-model:focus` together with a computed that derives a parent
feature (e.g. an HSA from a county via `fipsToHsa`). Pass both as a
`FocusItem` array — the focused county lights up as usual and the
parent HSA renders on top as a dashed overlay (`stroke: "#666"` here —
default is white).

`fipsToHsa` and `hsaNames` ship from the `@cfasim-ui/charts/hsa-mapping`
subpath so consumers that don't need HSA lookups don't pay for the
~25 KB of mapping data.

<ComponentDemo>
  <ChoroplethMap
    :topology="countiesTopo"
    geo-type="counties"
    data-geo-type="hsas"
    :pan="true"
    :zoom="true"
    :focus="parentFocus"
    @update:focus="focusedCounty = typeof $event === 'string' ? $event : null"
    :data="[
      { id: '060737', value: 80 },
      { id: '060723', value: 60 },
      { id: '060757', value: 45 },
      { id: '060807', value: 35 },
      { id: '060768', value: 25 },
      { id: '060774', value: 50 },
    ]"
    :focus-zoom-level="6"
    title="Click a county to outline its HSA"
    :legend-title="'Cases'"
    :height="400"
  >
    <template #tooltip="{ name, value }">
      <div style="font-weight: 600">{{ name }}</div>
      <div v-if="value != null">Cases: {{ value }}</div>
      <div v-else style="opacity: 0.6">No data</div>
    </template>
  </ChoroplethMap>

<template #code>

```vue
<script setup>
import { ref, computed } from "vue";
import { fipsToHsa } from "@cfasim-ui/charts/hsa-mapping";

const focusedCounty = ref(null);
const focus = computed(() => {
  const fips = focusedCounty.value;
  if (!fips) return null;
  const hsa = fipsToHsa[fips];
  return hsa
    ? [fips, { id: hsa, geoType: "hsas", style: "dashed", stroke: "#666" }]
    : fips;
});
</script>

<ChoroplethMap
  :topology="countiesTopo"
  geo-type="counties"
  data-geo-type="hsas"
  :data="hsaData"
  :focus="focus"
  @update:focus="focusedCounty = typeof $event === 'string' ? $event : null"
  title="Click a county to outline its HSA"
/>
```

  </template>
</ComponentDemo>

### Custom tooltip number format

Pass `tooltip-value-format` to format numeric values shown in the tooltip
(both the native SVG `<title>` and the interactive HTML tooltip). Use the
`#tooltip` slot if you want full control over the tooltip's content.

<ComponentDemo>
  <ChoroplethMap
    :topology="statesTopo"
    :data="[
      { id: '06', value: 39538223 },
      { id: '48', value: 29145505 },
      { id: '12', value: 21538187 },
      { id: '36', value: 20201249 },
    ]"
    :tooltip-value-format="(v) => v.toLocaleString('en-US')"
    title="US population (2020)"
    :height="300"
  />

<template #code>

```vue
<ChoroplethMap
  :topology="statesTopo"
  :data="[
    { id: '06', value: 39538223 },
    { id: '48', value: 29145505 },
    { id: '12', value: 21538187 },
    { id: '36', value: 20201249 },
  ]"
  :tooltip-value-format="(v) => v.toLocaleString('en-US')"
  title="US population (2020)"
  :height="300"
/>
```

  </template>
</ComponentDemo>

### Dense county map

Renders every US county with a value and a custom tooltip slot.

<ComponentDemo>
  <ChoroplethMap
    :topology="countiesTopo"
    geo-type="counties"
    :data="denseCountyData"
    :pan="true"
    :zoom="true"
    :color-scale="{ min: '#f0f5ff', max: '#08306b' }"
    title="All US counties — tooltip perf demo"
    :height="500"
  >
    <template #tooltip="{ id, name, value }">
      <div style="font-weight: 600">{{ name }}</div>
      <div style="opacity: 0.7; font-size: 0.85em">FIPS {{ id }}</div>
      <div>Value: {{ value }}</div>
    </template>
  </ChoroplethMap>

<template #code>

```vue
<script setup>
import countiesTopo from "us-atlas/counties-10m.json";

// One row per county
const data = countiesTopo.objects.counties.geometries.map((g, i) => ({
  id: String(g.id).padStart(5, "0"),
  value: (i * 37) % 100,
}));
</script>

<ChoroplethMap
  :topology="countiesTopo"
  geo-type="counties"
  :data="data"
  pan
  zoom
>
  <template #tooltip="{ id, name, value }">
    <div style="font-weight: 600">{{ name }}</div>
    <div style="opacity: 0.7; font-size: 0.85em">FIPS {{ id }}</div>
    <div>Value: {{ value }}</div>
  </template>
</ChoroplethMap>
```

  </template>
</ComponentDemo>

### Custom tooltip content (`#tooltip` slot)

Use the `#tooltip` slot to render any Vue template — components, scoped
styles, multi-line layouts — instead of the default `name: value`. The slot
receives `{ id, name, value, feature }` for the hovered region. Providing the
slot automatically enables interactive (HTML) tooltips, so you don't need to
set `tooltip-trigger`.

<ComponentDemo>
  <ChoroplethMap
    :topology="statesTopo"
    :data="[
      { id: '06', value: 39538223 },
      { id: '48', value: 29145505 },
      { id: '12', value: 21538187 },
      { id: '36', value: 20201249 },
      { id: '17', value: 12812508 },
    ]"
    title="US population (2020)"
    :height="300"
  >
    <template #tooltip="{ name, value }">
      <div style="font-weight:600">{{ name }}</div>
      <div v-if="typeof value === 'number'">
        Pop: {{ value.toLocaleString('en-US') }}
      </div>
      <div v-else style="opacity:0.6">No data</div>
    </template>
  </ChoroplethMap>

<template #code>

```vue
<ChoroplethMap :topology="statesTopo" :data="data" title="US population (2020)">
  <template #tooltip="{ name, value }">
    <div style="font-weight: 600">{{ name }}</div>
    <div v-if="typeof value === 'number'">
      Pop: {{ value.toLocaleString("en-US") }}
    </div>
    <div v-else style="opacity: 0.6">No data</div>
  </template>
</ChoroplethMap>
```

  </template>
</ComponentDemo>

<!--@include: ./_api/choropleth-map.md-->

### StateData

```ts
interface StateData {
  /** FIPS code (e.g. "06" for California, "06037" for LA County) or name */
  id: string;
  value: number | string;
}
```

### ChoroplethColorScale

```ts
interface ChoroplethColorScale {
  /** Minimum color (CSS color string). Default: "#e5f0fa" */
  min?: string;
  /** Maximum color (CSS color string). Default: "#08519c" */
  max?: string;
}
```

### ThresholdStop

Pass an array of `ThresholdStop` as `colorScale` for discrete color buckets instead of a linear gradient. The highest matching `min` wins.

```ts
interface ThresholdStop {
  /** Lower bound (inclusive). Values at or above this get this color. */
  min: number;
  color: string;
  /** Optional label for the legend (defaults to the min value) */
  label?: string;
}
```

### CategoricalStop

Pass an array of `CategoricalStop` as `colorScale` to map string values to colors. States whose `value` matches a stop's `value` get that color; unmatched values get `noDataColor`.

```ts
interface CategoricalStop {
  /** The categorical value to match */
  value: string;
  /** CSS color string */
  color: string;
}
```

### FocusItem

The `focus` prop accepts a bare id, a `FocusItem`, or an array of either. Use objects when you want to pin features from a different `geoType` than the base map, or pick a non-default outline style.

```ts
interface FocusItem {
  /** Feature id (FIPS code, HSA code) or name. */
  id: string;
  /** Defaults to the map's geoType. Cross-geoType items render as
   * non-interactive outlines on top of the base map. */
  geoType?: "states" | "counties" | "hsas";
  /** Outline style. "solid" (default) matches the hover highlight;
   * "dashed" uses long dashes; "dotted" uses small round dots. */
  style?: "solid" | "dashed" | "dotted";
  /** Stroke color for cross-geoType overlay paths. Default: "#fff". */
  stroke?: string;
}
```
