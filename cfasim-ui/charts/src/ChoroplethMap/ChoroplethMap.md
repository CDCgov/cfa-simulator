<script setup>
import { computed, ref } from "vue";
import countiesTopoForPerf from "us-atlas/counties-10m.json";
import { fipsToHsa } from "@cfasim-ui/charts/hsa-mapping";
import { nationalCityMarkers, stateCityMarkers } from "@cfasim-ui/charts/us-cities";

// Capital + 100 most-populous US cities for the national demo, and
// California's capital + top cities for the single-state demo.
const nationalCities = nationalCityMarkers();
const californiaCities = stateCityMarkers("06");

// One row per state for the state-labels demo, deterministic-ish values.
import statesTopoForLabels from "us-atlas/states-10m.json";
const stateLabelData = computed(() =>
  statesTopoForLabels.objects.states.geometries.map((g, i) => ({
    id: String(g.id).padStart(2, "0"),
    value: (i * 41) % 100,
  })),
);

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
// "Mixing levels" demo: county data everywhere except California and Texas,
// which report one whole-state estimate each (`geoType: "states"`).
const MERGED_STATES = ["06", "48"];
const mixedLevelData = computed(() => [
  ...denseCountyData.value.filter(
    (d) => !MERGED_STATES.includes(d.id.slice(0, 2)),
  ),
  { id: "06", value: 85, geoType: "states" },
  { id: "48", value: 15, geoType: "states" },
]);

// The other direction: a state map where New York alone is broken out into
// its counties.
const splitStateData = computed(() => [
  { id: "06", value: 70 },
  { id: "48", value: 30 },
  { id: "12", value: 55 },
  ...denseCountyData.value
    .filter((d) => d.id.slice(0, 2) === "36")
    .map((d) => ({ ...d, geoType: "counties" })),
]);

// County-borders demo: one row per California HSA, deterministic-ish values.
const caHsaData = computed(() =>
  [...new Set(Object.values(fipsToHsa))]
    .filter((code) => code.startsWith("06"))
    .map((code) => ({ id: code, value: parseInt(code.slice(-3), 10) % 100 })),
);

// Custom-geography demos. World countries from world-atlas (TopoJSON), one
// row per country with an id; three disputed territories carry none and
// are skipped by the map.
import worldTopo from "world-atlas/countries-110m.json";
const worldData = computed(() =>
  worldTopo.objects.countries.geometries
    .filter((g) => g.id != null)
    .map((g, i) => ({ id: String(g.id), value: (i * 53) % 100 })),
);
// Passed as stable objects: an inline `:regions="{ ... }"` literal is a new
// object on every render of the page, which would rebuild the map.
const worldRegions = { topology: worldTopo, object: "countries" };
const worldProjection = ref("equalEarth");
const worldRenderer = ref("svg");
const focusedCountry = ref(null);

// A synthetic GeoJSON set for the borders demo: a 6x4 grid of square
// "zones" keyed by `code`, grouped into four "districts".
function gridRect(x0, y0, w, h) {
  return {
    type: "Polygon",
    coordinates: [
      [
        [x0, y0],
        [x0 + w, y0],
        [x0 + w, y0 + h],
        [x0, y0 + h],
        [x0, y0],
      ],
    ],
  };
}
const gridZones = {
  type: "FeatureCollection",
  features: Array.from({ length: 24 }, (_, i) => {
    const col = i % 6;
    const row = Math.floor(i / 6);
    const district = `${row < 2 ? "North" : "South"} ${col < 3 ? "West" : "East"}`;
    return {
      type: "Feature",
      properties: { code: `Z${i + 1}`, label: `Zone ${i + 1}`, district },
      geometry: gridRect(col * 2, 8 - row * 2, 2, 2),
    };
  }),
};
const gridDistricts = {
  type: "FeatureCollection",
  features: [
    ["North West", 0, 6],
    ["North East", 6, 6],
    ["South West", 0, 2],
    ["South East", 6, 2],
  ].map(([name, x, y]) => ({
    type: "Feature",
    properties: { name },
    geometry: gridRect(x, y, 6, 4),
  })),
};
const gridRegions = {
  geojson: gridZones,
  idProperty: "code",
  nameProperty: "label",
  borders: { geojson: gridDistricts },
};
const gridData = computed(() =>
  gridZones.features.map((f, i) => ({
    id: f.properties.code,
    value: i % 7 === 0 ? "Watch" : i % 3 === 0 ? "Alert" : "Clear",
  })),
);

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

A choropleth map built on d3-geo. By default it draws the United States at
state, county, or HSA (Health Service Area) level with the Albers USA
projection; any other geography renders through the
[`regions` prop](#custom-geography-regions).

- [Basic usage](#basic-usage) and [color scales](#color-scales)
- [Theming](#theming-theme)
- [Interaction](#interaction): pan and zoom, click to focus, tooltips
- [US geography](#us-geography): counties, single states, HSAs, mixed levels
- [Overlays](#overlays): city markers and state labels
- [Custom geography](#custom-geography-regions)
- [Rendering](#rendering): the canvas backend for dense maps
- [Accessibility](#accessibility) and the [API reference](#props)

## Basic usage

US maps take a TopoJSON topology from the
[`us-atlas`](https://github.com/topojson/us-atlas) package via `topology`:
`us-atlas/states-10m.json` for states, `us-atlas/counties-10m.json` for
counties and HSAs (it includes state boundaries), or the pre-merged
`usHsaTopology` for [HSA-only maps](#hsa-level-map).

```sh
npm install us-atlas
```

```vue
<script setup>
import { ChoroplethMap } from "@cfasim-ui/charts";
import statesTopo from "us-atlas/states-10m.json";
import countiesTopo from "us-atlas/counties-10m.json";
</script>

<ChoroplethMap :topology="statesTopo" :data="stateData" />
<ChoroplethMap
  :topology="countiesTopo"
  geo-type="counties"
  :data="countyData"
/>
```

`data` is an array of `{ id, value }` rows keyed by FIPS code, HSA code, or
feature name (`"California"`). Rows that match no feature are ignored;
features without a row take the theme's base fill.

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

## Color scales

`colorScale` is continuous by default, or an array of threshold or
categorical stops. Any CSS color works, including `var()` and
`light-dark()`; colors resolve against the map's container and follow page
theme changes. The legend matches the scale: a gradient with ticks, or one
swatch per stop.

### Continuous (`ChoroplethColorScale`)

Numeric values interpolate between `min` and `max` over the data's range.
Pass `domain` to pin that range instead, so colors keep their meaning as
`data` changes (an animated map, or a probability that should always span
`[0, 1]`); values outside it take the end colors.

```vue
<ChoroplethMap
  :topology="statesTopo"
  :data="dayRows"
  :color-scale="{ min: '#fff5f0', max: '#a50f15', domain: [0, 1] }"
/>
```

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

### Threshold (`ThresholdStop[]`)

Values at or above a stop's `min` get its color; the highest matching stop
wins. A stop may also override the feature `stroke` and hover/focus
`highlight`.

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

### Categorical (`CategoricalStop[]`)

String values match a stop's `value`; unmatched values get the base `fill`.
Stops take the same optional `stroke` and `highlight` overrides.

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

## Theming (`theme`)

All paint styling lives in the `theme` prop: `fill` for features without
data, feature `stroke` and `strokeWidth`, the `borders` mesh over
county/HSA maps, the `countyBorders` and `hsaBorders` detail meshes, an
exterior `outline`, a `background` wash, and the hover/focus `highlight`.
Any CSS color works (`var()`, `light-dark()`, `color-mix()`), resolved
against the map's container and repainted when the page theme changes, in
both renderers. The `outline` is off until a visible color resolves.

<ComponentDemo>
  <ChoroplethMap
    :topology="statesTopo"
    :data="[
      { id: 'California', value: 100 },
      { id: 'Texas', value: 85 },
      { id: 'Florida', value: 70 },
      { id: 'New York', value: 90 },
      { id: 'Illinois', value: 60 },
      { id: 'Ohio', value: 40 },
    ]"
    :theme="{
      fill: 'light-dark(#e2e8f0, #334155)',
      stroke: 'light-dark(#f8fafc, #0f172a)',
      outline: 'light-dark(#334155, #cbd5e1)',
      outlineWidth: 1.5,
    }"
    title="Themed map with an exterior outline"
    :legend-title="'Cases'"
    :height="400"
  />

<template #code>

```vue
<ChoroplethMap
  :topology="statesTopo"
  :data="stateData"
  :theme="{
    fill: 'light-dark(#e2e8f0, #334155)',
    stroke: 'light-dark(#f8fafc, #0f172a)',
    outline: 'light-dark(#334155, #cbd5e1)',
    outlineWidth: 1.5,
  }"
  title="Themed map with an exterior outline"
  :legend-title="'Cases'"
  :height="400"
/>
```

  </template>
</ComponentDemo>

Every default routes through a `--choropleth-*` custom property, so a
stylesheet can theme every map on a page. JS `theme` values win:

```css
:root {
  color-scheme: light dark; /* required for light-dark() to engage */
  --choropleth-fill: light-dark(#dbe4d7, #24332a);
  --choropleth-stroke: light-dark(#f4f7f2, #131e17);
  --choropleth-outline: light-dark(#3f5245, #93ac9b); /* enables the outline */
  --choropleth-background: light-dark(
    #f4f7f2,
    #131e17
  ); /* enables a background */
  --choropleth-highlight: light-dark(#000, #fff);
  --choropleth-borders: transparent; /* falls back to the stroke color */
}
```

| Theme key            | Default                                               | Notes                                                                                |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `fill`               | `var(--choropleth-fill, light-dark(#ddd, #3f3f46))`   | Fill for features without a data value                                               |
| `stroke`             | `var(--choropleth-stroke, light-dark(#fff, #18181b))` | Interior feature borders                                                             |
| `strokeWidth`        | `0.5` (halved on county/HSA maps)                     | Explicit values apply as-is on every geoType; `0` disables                           |
| `borders`            | `var(--choropleth-borders, transparent)`              | State mesh over county/HSA maps; falls back to `stroke`; hide with `bordersWidth: 0` |
| `countyBorders`      | `var(--choropleth-county-borders, transparent)`       | County mesh over HSA/state-level maps; off until a visible color resolves            |
| `countyBordersWidth` | feature stroke width                                  | `0` disables                                                                         |
| `hsaBorders`         | `var(--choropleth-hsa-borders, transparent)`          | HSA mesh over county/state-level maps; off until a visible color resolves            |
| `hsaBordersWidth`    | feature stroke width                                  | `0` disables                                                                         |
| `outline`            | `var(--choropleth-outline, transparent)`              | Exterior boundary; off until a visible color resolves                                |
| `outlineWidth`       | `1`                                                   | `0` disables                                                                         |
| `background`         | `var(--choropleth-background, transparent)`           | Wash behind the map; off until a visible color resolves                              |
| `highlight`          | `var(--choropleth-highlight, light-dark(#000, #fff))` | Hover/focus stroke; per-item `FocusItem.stroke` wins                                 |
| `markerColor`        | `--choropleth-city-marker` / `-label-color` vars      | `cities` overlay dot + label color                                                   |
| `markerHalo`         | `--choropleth-city-halo` var                          | Halo around marker dots and labels                                                   |
| `markerHaloWidth`    | `0.9`                                                 | Dot halo width in CSS px; `0` disables                                               |
| `markerOpacity`      | `1`                                                   | Opacity of the whole marker layer                                                    |

## Interaction

### Pan and zoom (`zoom`)

Maps are static by default: hover, tooltips, click-select, and programmatic
`focus` work, but there are no zoom gestures or controls. Add `zoom` to
enable them. The map stays static until the first zoom, so clicks and taps
only select and the wheel never hijacks page scrolling:

- **Desktop:** double-click zooms in place, or use the **+ / − / reset**
  controls. After the first zoom, drag pans.
- **Touch:** a double tap expands the map to fill the window, where one
  finger pans, a pinch zooms, and a tap selects (its tooltip opens as a
  bottom sheet). With `:touch-expand="false"` the double tap zooms in place
  instead.

A grey "Double click to zoom" hint shows until the gesture is used; hide it
with `:zoom-hint="false"`. The menu's **Fullscreen** item opens the same
always-interactive expanded view.

When the map _is_ the page (a map route, a kiosk), pair `zoom` with
`zoom-mode="scroll"`: the wheel zooms, dragging pans, and touch gestures
work inline from the start, with the controls always shown.

```vue
<ChoroplethMap
  :topology="statesTopo"
  :data="stateData"
  zoom
  zoom-mode="scroll"
/>
```

### Click to focus (`v-model:focus`)

`focus` pans and zooms to a feature id (or name), or an array of them. With
`v-model:focus`, clicking a feature focuses it and clicking it again clears
focus; the reset button clears focus and the zoom together. A `FocusItem`
object styles the outline (`style: "solid" | "dashed" | "dotted"`,
`stroke`, `strokeWidth`), and `:focus-zoom="false"` highlights without
moving the map, for click-to-select UIs. Taps select the same way on touch
and double as hover (highlight, `stateHover`, tooltip).

<ComponentDemo>
  <ChoroplethMap
    :topology="countiesTopo"
    geo-type="counties"
    v-model:focus="focused"
    :focus-zoom-level="8"
    zoom
    :touch-expand="false"
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
  zoom
  :touch-expand="false"
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

### Tooltips

By default each feature carries a native `<title>` of `"Name: value"`. Set
`tooltip-trigger="hover"` for the HTML tooltip, or provide the `#tooltip`
slot (which enables it automatically) to render any template from
`{ id, name, value, feature }`. `tooltip-value-format` formats numbers in
the default text instead:

```vue
<ChoroplethMap
  :topology="statesTopo"
  :data="population"
  :tooltip-value-format="(v) => v.toLocaleString('en-US')"
/>
```

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

## US geography

### County-level map

`geoType="counties"` renders counties keyed by 5-digit FIPS codes, with
state borders drawn on top.

<ComponentDemo>
  <ChoroplethMap
    :topology="countiesTopo"
    geo-type="counties"
    zoom
    tooltip-trigger="hover"
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
  zoom
  tooltip-trigger="hover"
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

### Single-state map (`state`)

`state` (a name or 2-digit FIPS code) renders one state's counties or HSAs
with the projection fitted to it. It needs a counties topology, or
`usHsaTopology` for HSAs. `data` can stay national; only features inside
the state draw. An unknown value logs a warning and shows the full map.

<ComponentDemo>
  <ChoroplethMap
    :topology="countiesTopo"
    geo-type="counties"
    state="California"
    zoom
    :touch-expand="false"
    :zoom-hint="false"
    :data="[
      { id: '06037', value: 100 },
      { id: '06073', value: 80 },
      { id: '06059', value: 65 },
      { id: '06065', value: 55 },
      { id: '06001', value: 45 },
      { id: '06085', value: 40 },
    ]"
    title="California cases by county"
    :legend-title="'Cases'"
    :height="400"
  />

<template #code>

```vue
<ChoroplethMap
  :topology="countiesTopo"
  geo-type="counties"
  state="California"
  zoom
  :touch-expand="false"
  :zoom-hint="false"
  :data="[
    { id: '06037', value: 100 }, // Los Angeles
    { id: '06073', value: 80 }, // San Diego
    { id: '06059', value: 65 }, // Orange
  ]"
  title="California cases by county"
  :legend-title="'Cases'"
  :height="400"
/>
```

  </template>
</ComponentDemo>

### HSA-level map

`geoType="hsas"` renders Health Service Areas keyed by 6-digit HSA codes.
Either topology works: `us-atlas/counties-10m.json` (HSAs are dissolved from
counties at runtime) or the pre-merged `usHsaTopology` from
`@cfasim-ui/charts/us-hsa-topology`, about half the size and identical on
screen. The pre-merged one still carries state boundaries, so `state` and
state-level rows work; only county-level rendering needs the county
topology.

```vue
<script setup>
import { ChoroplethMap } from "@cfasim-ui/charts";
import { usHsaTopology } from "@cfasim-ui/charts/us-hsa-topology";
</script>

<ChoroplethMap :topology="usHsaTopology" geo-type="hsas" :data="hsaData" />
```

<ComponentDemo>
  <ChoroplethMap
    :topology="hsaTopo"
    geo-type="hsas"
    zoom
    tooltip-trigger="hover"
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
  >
    <template #tooltip="{ id, name, value }">
      <div style="font-weight: 600">{{ name }}</div>
      <div style="opacity: 0.7; font-size: 0.85em">HSA {{ id }}</div>
      <div v-if="value != null">Cases: {{ value }}</div>
      <div v-else style="opacity: 0.6">No data</div>
    </template>
  </ChoroplethMap>

<template #code>

```vue
<ChoroplethMap
  :topology="usHsaTopology"
  geo-type="hsas"
  zoom
  tooltip-trigger="hover"
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
>
  <template #tooltip="{ id, name, value }">
    <div style="font-weight: 600">{{ name }}</div>
    <div style="opacity: 0.7; font-size: 0.85em">HSA {{ id }}</div>
    <div v-if="value != null">Cases: {{ value }}</div>
    <div v-else style="opacity: 0.6">No data</div>
  </template>
</ChoroplethMap>
```

  </template>
</ComponentDemo>

### County borders over an HSA map (`theme.countyBorders`)

`theme.countyBorders` draws the county lines interior to each HSA (or
state) under HSA-level data; the HSA separators keep their own stroke. It
needs county arcs, so it does nothing with `usHsaTopology` or on county
maps. With `zoom`, `:county-borders-min-zoom="2"` hides the mesh until the
user zooms in one level. The complementary `theme.hsaBorders` rules HSA
separators over a county map, as in
[the next example](#color-by-hsa-interact-by-county-datageotype).

<ComponentDemo>
  <ChoroplethMap
    :topology="countiesTopo"
    geo-type="hsas"
    state="California"
    :data="caHsaData"
    :theme="{
      countyBorders: 'light-dark(rgba(15, 23, 42, 0.3), rgba(226, 232, 240, 0.3))',
    }"
    tooltip-trigger="hover"
    title="Cases by HSA, county boundaries overlaid"
    :legend-title="'Cases'"
    :height="420"
  />

<template #code>

```vue
<ChoroplethMap
  :topology="countiesTopo"
  geo-type="hsas"
  state="California"
  :data="hsaData"
  :theme="{
    countyBorders:
      'light-dark(rgba(15, 23, 42, 0.3), rgba(226, 232, 240, 0.3))',
  }"
  tooltip-trigger="hover"
  title="Cases by HSA, county boundaries overlaid"
  :legend-title="'Cases'"
  :height="420"
/>
```

  </template>
</ComponentDemo>

### Color by HSA, interact by county (`dataGeoType`)

`dataGeoType="hsas"` colors each county with its parent HSA's value while
hover, click, and `focus` stay on the county geometry. Add `theme.hsaBorders`
to keep the HSA boundaries crisp. To outline the parent of the focused
county, derive its HSA with `fipsToHsa` (from the
`@cfasim-ui/charts/hsa-mapping` subpath) and pass both as a `FocusItem`
array; the cross-geoType item renders as a dashed overlay.

<ComponentDemo>
  <ChoroplethMap
    :topology="countiesTopo"
    geo-type="counties"
    data-geo-type="hsas"
    zoom
    :touch-expand="false"
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
    :theme="{ hsaBorders: 'light-dark(#fff, #18181b)', hsaBordersWidth: 0.75 }"
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
  zoom
  :touch-expand="false"
  :data="hsaData"
  :focus="focus"
  @update:focus="focusedCounty = typeof $event === 'string' ? $event : null"
  :theme="{ hsaBorders: 'light-dark(#fff, #18181b)', hsaBordersWidth: 0.75 }"
  title="Click a county to outline its HSA"
/>
```

  </template>
</ComponentDemo>

### Mixing levels on one map (`data[].geoType`)

When only some regions report at a different level, give those rows their
own `geoType`. The row's whole state is re-tiled at that level: a state row
on a county map merges that state into one shape; a county row on a state
map splits that state into counties (its counties without rows render as
no-data). The substituted features fill, hover, and focus like any other.

<ComponentDemo>
  <ChoroplethMap
    :topology="countiesTopo"
    geo-type="counties"
    renderer="canvas"
    :data="mixedLevelData"
    title="County estimates, with California and Texas reported statewide"
    legend-title="Rate"
    :height="420"
  />

<template #code>

```vue
<ChoroplethMap
  :topology="countiesTopo"
  geo-type="counties"
  renderer="canvas"
  :data="[
    ...countyRows,
    { id: '06', value: 85, geoType: 'states' },
    { id: '48', value: 15, geoType: 'states' },
  ]"
/>
```

  </template>
</ComponentDemo>

<ComponentDemo>
  <ChoroplethMap
    :topology="countiesTopo"
    geo-type="states"
    :data="splitStateData"
    title="State estimates, with New York broken out by county"
    legend-title="Rate"
    :height="420"
  />

<template #code>

```vue
<ChoroplethMap
  :topology="countiesTopo"
  geo-type="states"
  :data="[
    { id: '06', value: 70 },
    { id: '48', value: 30 },
    ...newYorkCountyRows.map((r) => ({ ...r, geoType: 'counties' })),
  ]"
/>
```

  </template>
</ComponentDemo>

Any pair of `states` / `counties` / `hsas` works if the topology can supply
both levels. Off-level rows are looked up by their own id and ignore
`dataGeoType`. One level per state: a second row claiming the same state at
another level is ignored with a warning, as is a row that resolves to no
state.

### Tighter national fit (`tight-fit`)

Albers USA fits Alaska's full extent into view, which pushes the contiguous
US in from the edges. `tight-fit` crops that overhang so the lower 48 fill
the frame; a number in `0`–`1` crops partway. No effect in single-state
mode.

<ComponentDemo>
  <ChoroplethMap
    :topology="statesTopo"
    tight-fit
    :data="[
      { id: '06', value: 100 },
      { id: '36', value: 80 },
      { id: '48', value: 90 },
      { id: '12', value: 70 },
      { id: '17', value: 60 },
    ]"
    title="Cases by State (tight fit)"
    :legend-title="'Cases'"
    :height="400"
  />

<template #code>

```vue
<ChoroplethMap :topology="statesTopo" tight-fit :data="data" />
<ChoroplethMap :topology="statesTopo" :tight-fit="0.5" :data="data" />
```

  </template>
</ComponentDemo>

### Enlarging DC (`enlarge-dc`)

State-level maps enlarge the District of Columbia 4× by default so it can be
seen and hovered; pass a number for another factor, or `false` for its true
size. County and HSA maps are opt-in. The enlargement is zoom-aware: DC
holds its on-screen size until the real geography catches up, so zoomed-in
views are never distorted.

<ComponentDemo>
  <ChoroplethMap
    :topology="statesTopo"
    :data="stateLabelData"
    :enlarge-dc="5"
    state-labels
    zoom
    tooltip-trigger="hover"
    title="DC enlarged 5× at the overview; true size once zoomed in"
    :legend="false"
    :height="440"
  />

<template #code>

```vue
<ChoroplethMap
  :topology="statesTopo"
  :data="stateData"
  :enlarge-dc="5"
  state-labels
  zoom
  tooltip-trigger="hover"
/>
```

  </template>
</ComponentDemo>

## Overlays

Two non-interactive layers sit on top of US maps. Both follow pan and zoom
at a constant on-screen size, in both renderers.

### City markers (`cities`)

`cities` is an array of `{ name, coordinates: [lng, lat], capital?, minZoom? }`.
Every city gets a dot; labels that would overlap are dropped, except for
capitals, which are placed first. On a zoomable map a city shows once the
zoom reaches its `minZoom` (default from `cities-min-zoom`, `2`), so the
largest cities appear first and more reveal as the user zooms in.

<ComponentDemo>
  <ChoroplethMap
    :topology="statesTopo"
    :cities="nationalCities"
    zoom
    title="100 most-populous US cities and the capital"
    :legend="false"
    :height="440"
  />

<template #code>

```vue
<script setup>
import { ChoroplethMap } from "@cfasim-ui/charts";
import { nationalCityMarkers } from "@cfasim-ui/charts/us-cities";
import statesTopo from "us-atlas/states-10m.json";

// Washington, DC (flagged as the capital) + the 100 most-populous US cities.
const cities = nationalCityMarkers();
</script>

<!-- zoom in one level to reveal the cities -->
<ChoroplethMap :topology="statesTopo" :cities="cities" zoom />
```

  </template>
</ComponentDemo>

<ComponentDemo>
  <ChoroplethMap
    :topology="countiesTopo"
    state="California"
    geo-type="counties"
    :cities="californiaCities"
    zoom
    :legend="false"
    :height="440"
  />

<template #code>

```vue
<!-- Sacramento (capital) + California's most-populous cities -->
<ChoroplethMap
  :topology="countiesTopo"
  state="California"
  geo-type="counties"
  :cities="stateCityMarkers('06')"
  zoom
/>
```

  </template>
</ComponentDemo>

The `@cfasim-ui/charts/us-cities` subpath (a separate ~5 KB gzipped entry
point) ships the 100 most-populous US cities plus every state capital:

```js
import {
  usCities,
  nationalCityMarkers,
  stateCityMarkers,
} from "@cfasim-ui/charts/us-cities";

nationalCityMarkers(); //=> DC (capital) + top 100 cities, tiered by population
nationalCityMarkers({ limit: 25 }); //=> DC + top 25
nationalCityMarkers({ tiered: false }); //=> flat layer, no per-city minZoom
stateCityMarkers("48"); //=> Austin (capital) + top Texas cities
usCities; //=> the raw UsCity[] to build your own selection
```

Style the layer with the theme's `markerColor`, `markerHalo`,
`markerHaloWidth`, and `markerOpacity`, or the `--choropleth-city-*` custom
properties on `.choropleth-cities`. Capital labels carry a
`.choropleth-city-label-capital` class.

### State labels (`state-labels`)

`state-labels` labels every state with its USPS abbreviation: inside the
state where it fits (colored for contrast against the fill), otherwise as a
callout beside it with a leader line when the label had to move. Labels
shrink on small maps and re-fit as the map zooms, and they act as hover and
click proxies for their state. They work on county and HSA maps too, where
labels always mark states.

<ComponentDemo>
  <ChoroplethMap
    :topology="statesTopo"
    :data="stateLabelData"
    state-labels
    zoom
    title="State abbreviations: inside where they fit, callouts elsewhere"
    :legend="false"
    :height="440"
  />

<template #code>

```vue
<ChoroplethMap :topology="statesTopo" :data="stateData" state-labels zoom />
```

  </template>
</ComponentDemo>

Override `--choropleth-state-label-color`, `--choropleth-state-label-halo`,
and the contrast pair `--choropleth-state-label-dark` / `-light` on
`.choropleth-state-labels` to restyle them; callouts carry
`.choropleth-state-label-callout` and leader lines `.choropleth-state-leader`.

## Custom geography (`regions`)

Pass `regions` instead of `topology` to draw any set of regions from a
TopoJSON topology (plus the `object` to draw) or a GeoJSON
`FeatureCollection`. Color scales, legend, tooltips, focus, theme, zoom, the
menu, the canvas renderer, and the `stateClick` / `stateHover` events all
work the same. Keep the `regions` object stable (a module or `script setup`
constant): a new object rebuilds the map.

- **Ids and names** come from `idProperty` (default `"id"`, falling back to
  the feature's own `id`) and `nameProperty` (default `"name"`). `data`
  rows match by id or name; features with no id are skipped with a warning.
  Rings may wind either way: the map rewinds them to d3-geo's convention.
- **Projection** defaults to `"mercator"`, fitted to the regions. Choose
  `"equalEarth"` or `"equirectangular"`, or pass a factory
  `(width, height) => GeoProjection`; the bundled projections are
  re-exported from `@cfasim-ui/charts`.
- **Borders and outline.** `regions.borders` draws a second set of regions
  as a mesh styled by `theme.borders`: `borders.object` meshes the shared
  edges of a topology object, `borders.geojson` draws every ring of a
  collection. `theme.outline` needs a topology; GeoJSON regions draw none.
- **Ignored props.** The US-only props (`topology`, `geoType`,
  `dataGeoType`, `state`, `tightFit`, `stateLabels`, `enlargeDc`, `cities`)
  and the `geoType` of data rows and focus items do nothing with `regions`.

<ComponentDemo>
  <div style="display: flex; gap: 16px; flex-wrap: wrap; width: 100%">
    <label>
      Projection
      <select v-model="worldProjection" data-testid="world-projection">
        <option value="equalEarth">equalEarth</option>
        <option value="mercator">mercator</option>
        <option value="equirectangular">equirectangular</option>
      </select>
    </label>
    <label>
      Renderer
      <select v-model="worldRenderer" data-testid="world-renderer">
        <option value="svg">svg</option>
        <option value="canvas">canvas</option>
      </select>
    </label>
  </div>
  <ChoroplethMap
    data-testid="world-map"
    :regions="worldRegions"
    :projection="worldProjection"
    :renderer="worldRenderer"
    :data="worldData"
    v-model:focus="focusedCountry"
    :focus-zoom="false"
    zoom
    :touch-expand="false"
    :theme="{ outline: 'light-dark(#334155, #cbd5e1)' }"
    title="Click a country to select it"
    legend-title="Value"
    :height="440"
  >
    <template #tooltip="{ name, value }">
      <div style="font-weight: 600">{{ name }}</div>
      <div>Value: {{ value }}</div>
    </template>
  </ChoroplethMap>

<template #code>

```vue
<script setup>
import { ref } from "vue";
import worldTopo from "world-atlas/countries-110m.json";

// Keep `regions` a stable object; a new one rebuilds the map.
const regions = { topology: worldTopo, object: "countries" };
// One row per country, keyed by the topology's feature ids.
const data = worldTopo.objects.countries.geometries
  .filter((g) => g.id != null)
  .map((g, i) => ({ id: String(g.id), value: (i * 53) % 100 }));
const focused = ref(null);
</script>

<ChoroplethMap
  :regions="regions"
  projection="equalEarth"
  :data="data"
  v-model:focus="focused"
  :focus-zoom="false"
  zoom
  :theme="{ outline: 'light-dark(#334155, #cbd5e1)' }"
  title="Click a country to select it"
  legend-title="Value"
>
  <template #tooltip="{ name, value }">
    <div style="font-weight: 600">{{ name }}</div>
    <div>Value: {{ value }}</div>
  </template>
</ChoroplethMap>
```

  </template>
</ComponentDemo>

A GeoJSON collection keyed by a `code` property, named by `label`, with a
second collection of districts as the borders mesh:

<ComponentDemo>
  <ChoroplethMap
    data-testid="zones-map"
    :regions="gridRegions"
    :data="gridData"
    :color-scale="[
      { value: 'Clear', color: 'light-dark(#dcfce7, #14532d)' },
      { value: 'Watch', color: 'light-dark(#fef9c3, #713f12)' },
      { value: 'Alert', color: 'light-dark(#fecaca, #7f1d1d)' },
    ]"
    :theme="{ borders: 'light-dark(#1e293b, #e2e8f0)', bordersWidth: 2 }"
    title="Zones grouped into districts"
    :height="300"
  >
    <template #tooltip="{ name, value, feature }">
      <div style="font-weight: 600">{{ name }}</div>
      <div>{{ feature.properties.district }}: {{ value }}</div>
    </template>
  </ChoroplethMap>

<template #code>

```vue
<ChoroplethMap
  :regions="{
    geojson: zones, // FeatureCollection with `code` / `label` / `district`
    idProperty: 'code',
    nameProperty: 'label',
    borders: { geojson: districts },
  }"
  :data="[
    { id: 'Z1', value: 'Watch' },
    { id: 'Z2', value: 'Clear' },
  ]"
  :color-scale="[
    { value: 'Clear', color: 'light-dark(#dcfce7, #14532d)' },
    { value: 'Watch', color: 'light-dark(#fef9c3, #713f12)' },
    { value: 'Alert', color: 'light-dark(#fecaca, #7f1d1d)' },
  ]"
  :theme="{ borders: 'light-dark(#1e293b, #e2e8f0)', bordersWidth: 2 }"
  title="Zones grouped into districts"
>
  <template #tooltip="{ name, value, feature }">
    <div style="font-weight: 600">{{ name }}</div>
    <div>{{ feature.properties.district }}: {{ value }}</div>
  </template>
</ChoroplethMap>
```

  </template>
</ComponentDemo>

## Rendering

### Canvas renderer (`renderer="canvas"`)

For dense maps, `renderer="canvas"` paints every feature into one
`<canvas>` instead of a DOM path each, so zoom, pan, and hover redraw in
milliseconds regardless of feature count. Interactions are identical; the
menu offers PNG export only, and there is no per-feature DOM for assistive
tech. `renderer` can be switched on a mounted map and the zoom carries over.

<ComponentDemo>
  <ChoroplethMap
    :topology="countiesTopo"
    geo-type="counties"
    :data="denseCountyData"
    zoom
    renderer="canvas"
    :color-scale="{ min: '#f0f5ff', max: '#08306b' }"
    title="All US counties"
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
  zoom
  renderer="canvas"
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

## Accessibility

In SVG mode every feature path has `role="img"` and an `aria-label` of
`"Name"` or `"Name: value"` (formatted by `tooltip-value-format`), kept in
sync with the data, plus a native `<title>` when no interactive tooltip is
configured. Canvas mode exposes no per-feature DOM.

With a `title` the root element becomes a `role="figure"` named by it, so
the menu and controls stay reachable. `aria-label` replaces the accessible
name with a fuller summary, and `role="img"` exposes the map as a single
image instead.

```vue
<ChoroplethMap
  :topology="usStates"
  :data="cases"
  title="Cases by state"
  aria-label="US map shaded by case count per state, highest in the Southeast"
/>
```

<!--@include: ./_api/choropleth-map.md-->

## Types

### StateData

```ts
interface StateData {
  /** FIPS code (e.g. "06" for California, "06037" for LA County) or name.
   * With `regions`: the region's `idProperty` value or name. */
  id: string;
  value: number | string;
  /**
   * Level of *this row*, when it differs from the map's `geoType`. The row's
   * state is re-tiled at this level — see "Mixing levels on one map".
   */
  geoType?: GeoType;
}
```

### ChoroplethColorScale

Any CSS color works, including `var()` and `light-dark()` — scale colors resolve against the map's container and re-resolve on page theme changes.

```ts
interface ChoroplethColorScale {
  /** Minimum color (any CSS color). Default: "#e5f0fa" */
  min?: string;
  /** Maximum color (any CSS color). Default: "#08519c" */
  max?: string;
  /** Fixed value range mapped onto min..max. Default: the data's min and
   * max. Values outside it take the end colors. */
  domain?: [number, number];
}
```

### ThresholdStop

Pass an array of `ThresholdStop` as `colorScale` for discrete color buckets instead of a linear gradient. The highest matching `min` wins.

```ts
interface ThresholdStop {
  /** Lower bound (inclusive). Values at or above this get this color. */
  min: number;
  color: string;
  /** Optional feature border; falls back to theme.stroke. */
  stroke?: string;
  /** Optional hover/focus border; falls back to theme.highlight. */
  highlight?: string;
  /** Optional label for the legend (defaults to the min value) */
  label?: string;
}
```

### CategoricalStop

Pass an array of `CategoricalStop` as `colorScale` to map string values to colors. States whose `value` matches a stop's `value` get that color; unmatched values get the theme's base `fill`.

```ts
interface CategoricalStop {
  /** The categorical value to match */
  value: string;
  /** CSS color string */
  color: string;
  /** Optional feature border; falls back to theme.stroke. */
  stroke?: string;
  /** Optional hover/focus border; falls back to theme.highlight. */
  highlight?: string;
}
```

### MapTheme

All keys are optional; unset keys fall back to their `--choropleth-*` custom property (see [Theming](#theming-theme)).

```ts
interface MapTheme {
  /** Base fill for features without a data value (any CSS color). */
  fill?: string;
  /** Interior feature borders (any CSS color). */
  stroke?: string;
  /** Feature border width in CSS px, constant at any zoom. 0 disables. */
  strokeWidth?: number;
  /** State-boundary mesh over county/HSA maps. Falls back to `stroke`. */
  borders?: string;
  /** State-borders mesh width in CSS px. Default 1; 0 disables. */
  bordersWidth?: number;
  /** County-boundary mesh over HSA/state-level maps. Off by default. */
  countyBorders?: string;
  /** County-borders mesh width in CSS px. Default: the feature stroke width. */
  countyBordersWidth?: number;
  /** HSA-boundary mesh over county/state-level maps. Off by default. */
  hsaBorders?: string;
  /** HSA-borders mesh width in CSS px. Default: the feature stroke width. */
  hsaBordersWidth?: number;
  /** Exterior boundary, drawn on top of interior borders. Off by default. */
  outline?: string;
  /** Exterior outline width in CSS px. Default 1; 0 disables. */
  outlineWidth?: number;
  /** Background wash behind the map features. Off by default. */
  background?: string;
  /** Hover/focus highlight stroke. */
  highlight?: string;
  /** Marker overlay (`cities` prop): dot + label color. */
  markerColor?: string;
  /** Marker overlay: halo color around dots and labels. */
  markerHalo?: string;
  /** Dot halo width in CSS px. Default 0.9; 0 disables. */
  markerHaloWidth?: number;
  /** Opacity of the whole marker layer. Default 1. */
  markerOpacity?: number;
}
```

### FocusItem

The `focus` prop accepts a bare id, a `FocusItem`, or an array of either. Use objects when you want to pin features from a different `geoType` than the base map, or pick a non-default outline style.

```ts
interface FocusItem {
  /** Feature id (FIPS code, HSA code) or name. */
  id: string;
  /** Defaults to the map's geoType. Cross-geoType items render as
   * non-interactive outlines on top of the base map. Ignored with `regions`. */
  geoType?: "states" | "counties" | "hsas";
  /** Outline style. "solid" (default) matches the hover highlight;
   * "dashed" uses long dashes; "dotted" uses small round dots. */
  style?: "solid" | "dashed" | "dotted";
  /** Stroke color for cross-geoType overlay paths. Default: "#fff". */
  stroke?: string;
}
```

### RegionsSource

The `regions` prop: a custom geography in place of the US topology. See [Custom geography](#custom-geography-regions).

```ts
interface RegionsSource {
  /** TopoJSON topology; `object` names the object to draw (default: the
   * topology's first object). */
  topology?: Topology;
  object?: string;
  /** GeoJSON FeatureCollection to draw instead of a topology. */
  geojson?: FeatureCollection;
  /** Feature property holding each region's id. Default "id"; falls back
   * to the feature's own `id`. */
  idProperty?: string;
  /** Feature property holding each region's display name. Default "name";
   * falls back to the id. */
  nameProperty?: string;
  /** A second set of regions drawn as a borders mesh on top (styled by
   * `theme.borders`): another object of `topology` (shared edges only) or
   * a GeoJSON collection (every ring). */
  borders?: { object?: string; geojson?: FeatureCollection };
}
```

### MapProjection

The `projection` prop. Defaults to `"albersUsa"` for US maps and `"mercator"` with `regions`; always fitted to the drawn regions.

```ts
type MapProjectionName =
  "albersUsa" | "mercator" | "equirectangular" | "equalEarth";

type MapProjection =
  MapProjectionName | ((width: number, height: number) => GeoProjection);
```
