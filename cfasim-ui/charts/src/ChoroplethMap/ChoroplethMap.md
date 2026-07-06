<script setup>
import { computed, ref } from "vue";
import countiesTopoForPerf from "us-atlas/counties-10m.json";
import { fipsToHsa } from "@cfasim-ui/charts/hsa-mapping";
import { nationalCityMarkers, stateCityMarkers } from "@cfasim-ui/charts/us-cities";

// Capital + 100 most-populous US cities for the national demo, and
// California's capital + top cities for the single-state demo.
const nationalCities = nationalCityMarkers();
const californiaCities = stateCityMarkers("06");

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

### Pan and zoom

Maps are **fully static by default** — tooltips, hover, click-select, and
programmatic `focus` zoom all work, but there are no zoom gestures and no
controls. That's the right mode when clicks mean navigation instead of
exploration (see the state-map pattern below); a parent driving `focus`
provides its own way back (e.g. a "Back" button that clears the focus).

Add the `zoom` prop to enable the interaction. The map is then **static
until the first zoom** — clicks and taps only ever select; it's the first
zoom gesture that switches panning on. The scroll wheel never zooms
inline, so the map can't hijack page scrolling. A grey hint overlaid on
the top of the map ("Double click to zoom" / "Double tap to zoom")
advertises the gesture until it's been used; pass `:zoom-hint="false"` to
hide it.

- **Desktop:** double-click zooms in place (shift+double-click zooms out),
  or press **+** in the always-present **+ / − / reset** control stack in
  the top-left corner. The first zoom — including a programmatic `focus`
  zoom — starts the pan/zoom mode; from then on, drag pans the map. The
  reset button (a counterclockwise arrow) animates back to the full extent
  (clearing any `focus`); − and reset are disabled while the map is at its
  full extent.
- **Touch:** a **double tap** expands the map to fill the window, zoomed
  in on the tapped point; single taps select features inline. Inside the
  expanded view, one finger pans, a pinch zooms, and a tap selects — its
  tooltip slides up as a bottom sheet; the +/−/reset controls sit top-left
  and a close (✕) button top-right returns to the inline map at full
  extent. A single finger over the inline map still scrolls the page.

Filling the window is always an activated state: whether entered via the
menu's **Fullscreen** item or a double tap, pan/zoom works immediately and
the controls are present — no double-click needed first. The scroll wheel
(and trackpad pinch) zooms there too, since page scrolling is locked while
the map fills the window.

Prefer in-place zooming on touch? Set `:touch-expand="false"` — a double
tap (or a pinch) zooms the inline map on that point instead of expanding
it. From there one finger pans, a pinch zooms, and taps keep selecting;
the +/−/reset controls render inline, and reset restores the original
static, page-scrollable state. Fullscreen is unaffected: that view stays
continuously interactive and its reset only recenters.

#### Full-page mode (`zoom-mode="scroll"`)

When the map _is_ the page — a dedicated map route, a dashboard panel, a
kiosk — the activation step just gets in the way, and there's no page
scroll to protect. Pair `zoom` with `zoom-mode="scroll"` to make the map
immediately interactive: the wheel (and trackpad pinch) zooms, dragging
pans, and touch gestures work inline with no tap-to-expand step. The
+/−/reset controls are always shown and the hint is suppressed.

```vue
<ChoroplethMap
  :topology="statesTopo"
  :data="stateData"
  zoom
  zoom-mode="scroll"
/>
```

### County-level map

Set `geoType="counties"` to render county-level data using 5-digit FIPS codes. State borders are drawn on top for context. Double-click (or double-tap on touch) to explore — useful for dense county data.

This demo also wires up an interactive tooltip (`tooltip-trigger="hover"`):
hover a county on desktop, or tap one on touch, and it works the same
before and after zooming in.

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

### Tighter national fit (`tight-fit`)

The Albers USA projection places Alaska and Hawaii in the bottom-left corner, and by default the whole composite is fit into view — so Alaska's western tail pushes the contiguous US in from the edges. Set `tight-fit` to crop that overhang and let the lower-48 fill more of the frame: Alaska's tail (and Hawaii) clip into the lower-left corner. Pass a number in `0`–`1` (e.g. `:tight-fit="0.5"`) to crop only partway.

Works on national state, county, and HSA maps — it's a no-op only in single-state mode. (County features are split by FIPS prefix; HSAs, whose ids are HSA codes rather than FIPS, are identified through the built-in FIPS-to-HSA table.)

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
<!-- Crop Alaska's overhang so the lower-48 fills the frame -->
<ChoroplethMap :topology="statesTopo" tight-fit :data="data" />

<!-- ...or crop only partway -->
<ChoroplethMap :topology="statesTopo" :tight-fit="0.5" :data="data" />
```

  </template>
</ComponentDemo>

### City markers (`cities`)

Pass a `cities` array to overlay decorative point markers with name labels. Each entry is `{ name, coordinates: [lng, lat], capital?, minZoom? }`. Every city is a dot; `capital` cities are labeled first (with a lightly emphasized label) and never dropped, while any other label that can't be placed without overlapping is dropped (its dot stays), so labels never collide. The overlay is non-interactive — the choropleth's own hover/click is unaffected — and the markers pan/zoom with the map while staying a constant on-screen size. It works with both the SVG and canvas (`renderer`) backends.

**Level-of-detail:** on a zoomable map (`zoom`), each city has a `minZoom` and shows only once the map is zoomed to `scaleK >= minZoom`, so you can reveal the biggest cities first and progressively add more as the user zooms in. `nationalCityMarkers()` / `stateCityMarkers()` assign these tiers by population automatically (the capital always shows). A city without its own `minZoom` falls back to the `cities-min-zoom` prop (default `2`) — set that to `1` for a flat "always visible" layer, or pass `{ tiered: false }` to the selectors. **The overview below shows the biggest cities; double-click to zoom in and reveal more:**

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

// Washington, DC (emphasized) + the 100 most-populous US cities.
const cities = nationalCityMarkers();
</script>

<!-- zoom in one level to reveal the cities -->
<ChoroplethMap :topology="statesTopo" :cities="cities" zoom />
```

  </template>
</ComponentDemo>

In a single-state map, pass that state's cities so its capital and top cities show:

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

#### Bundled US city data (`@cfasim-ui/charts/us-cities`)

`nationalCityMarkers()` and `stateCityMarkers()` come from the `@cfasim-ui/charts/us-cities` subpath — a ~5 KB gzipped dataset (Natural Earth, public domain) of the 100 most-populous US cities plus every state capital and DC. It's a separate entry point, so consumers who don't use it never pull it into their bundle.

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

Only the national capital is flagged on the national map; a state's own capital is flagged in its single-state view. A flagged capital's label is emphasized and never dropped for collisions — the marker itself is a plain dot like any other city. Override the marker/label colors per instance with CSS custom properties on `.choropleth-cities`: `--choropleth-city-marker`, `--choropleth-city-label-color`, and `--choropleth-city-halo`.

### HSA-level map

Set `geoType="hsas"` to render Health Service Area boundaries. HSAs are dissolved from county boundaries using a built-in FIPS-to-HSA mapping. Use 6-digit HSA codes as IDs. State borders are overlaid for context.

This demo pairs `tooltip-trigger="hover"` with a custom `#tooltip` slot —
hover an HSA on desktop, or tap one on touch, before or after zooming in.

<ComponentDemo>
  <ChoroplethMap
    :topology="countiesTopo"
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
  :topology="countiesTopo"
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

### Single-state map (`state`)

Set the `state` prop to render just one state's outline with its `counties` or
`hsas` inside it — no surrounding states — and the projection zooms to fit it.
Accepts a state **name** (`"California"`) or a 2-digit **FIPS code** (`"06"`).
This needs a counties topology (the same `us-atlas/counties-10m.json`). `data`
can stay national; only features inside the selected state are drawn and
colored.

This demo also opts for the quieter touch flow: `:touch-expand="false"` makes
a double tap (or pinch) zoom in place instead of expanding to fill the
window, and `:zoom-hint="false"` drops the grey gesture hint.

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

Switch `geo-type="hsas"` to fill the same state with Health Service Areas
instead. An unrecognized `state` value logs a warning and falls back to the
full national map.

### Click to focus (`v-model:focus`)

Bind the `focus` prop to pan and zoom to a specific feature. Pass a feature
id (FIPS code, HSA code, or name) — or an array of ids to focus on a region.
With `v-model:focus`, clicking an unfocused feature focuses it and clicking
the focused feature toggles back off. If a tooltip is configured, focusing
shows that feature's tooltip. Users can keep exploring around the focused
area; the built-in **reset** button clears focus and snaps back to the full
extent.

Each focus target's outline can be styled by passing a `FocusItem` object:
`style` picks the dash pattern (`"solid" | "dashed" | "dotted"`), `stroke`
the color, and `strokeWidth` the width in CSS px. In-place highlights
default to pure black/white following the theme (`light-dark(#000, #fff)`);
cross-geoType overlays default to white.

Set `:focus-zoom="false"` to highlight (and draw cross-geoType overlays)
**without** panning or zooming — useful for a click-to-select interaction
where the map should stay put while a side panel shows the details.

Selection works the same on touch: a single-finger **tap** on a feature
emits `stateClick` and toggles focus, inline or inside the expanded view.
(Inline with `zoom` on, the selection fires after the brief double-tap
window.) A tap also stands in for hover — it applies the hover highlight,
emits `stateHover`, and shows the feature's tooltip (anchored to the
feature inline; sliding up as a bottom sheet in the expanded view); only
continuous hover _tracking_ is off on touch, for performance.

Click-to-focus interactions usually pair best with `:touch-expand="false"`,
as in the demos below — a double tap zooms in place while taps keep
selecting, so the map stays in your layout instead of taking over the
window.

Counties are tiny without a zoom — focus is a natural fit for drill-down.

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
    zoom
    renderer="canvas"
    :touch-expand="false"
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
  zoom
  renderer="canvas"
  :touch-expand="false"
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

### Canvas rendering (`renderer="canvas"`)

For dense maps — every US county, HSAs, or anything that feels sluggish on
mobile — set `renderer="canvas"`. Instead of one DOM path per feature, the
whole map paints into a single `<canvas>`: zooming, panning, and hover/tap
highlights redraw in a few milliseconds regardless of feature count, and
DOM memory stays flat. Interactions are identical (hover, click/tap
selection, `focus`, every zoom mode and touch flow); hit-testing runs
through an offscreen picking bitmap, so it stays pixel-accurate.

Differences from the default SVG renderer:

- The menu offers **Fullscreen** and **Save as PNG** only (there is no SVG
  DOM to serialize; the PNG exports straight off the rendering canvas).
- There is no per-feature `<title>` fallback or per-feature DOM for
  assistive tech — configure an interactive tooltip (`tooltip-trigger` or
  the `#tooltip` slot), or stay on SVG where that fallback matters.
- `renderer` is fixed at mount.

The dense county demo below uses it.

### Dense county map

Renders every US county with a value and a custom tooltip slot, on the
canvas backend.

<ComponentDemo>
  <ChoroplethMap
    :topology="countiesTopo"
    geo-type="counties"
    :data="denseCountyData"
    zoom
    renderer="canvas"
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

## Accessibility

The map's individual regions aren't exposed to assistive tech, so the map
announces itself with a single accessible name. When it has a `title`, the root
element gets `role="figure"` and an `aria-label` set to the title, so screen
readers announce it as a labeled figure while the menu and reset controls stay
reachable.

Set `ariaLabel` to give screen readers a fuller summary than the visible title
(it overrides `title` for the accessible name only):

```vue
<ChoroplethMap
  :topology="usStates"
  :data="cases"
  title="Cases by state"
  aria-label="US map shaded by case count per state, highest in the Southeast"
/>
```

Pass `role` to override the default, e.g. `role="img"` to expose the map as a
single image (note this hides the inner menu/reset controls from assistive
tech).

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
