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
- **HSA-only maps**: the pre-merged `usHsaTopology` from `@cfasim-ui/charts/us-hsa-topology` renders identically to the county topology at roughly half the size — see [HSA-level map](#hsa-level-map)

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

### Theming (`theme`)

All map paint styling lives in one `theme` prop: the base `fill` for features without data, the feature `stroke` (+ `strokeWidth`), the state-`borders` mesh over county/HSA maps (+ `bordersWidth`), a `countyBorders` mesh over HSA and state-level maps (+ `countyBordersWidth`, see [County borders](#county-borders-over-an-hsa-map-theme-countyborders)), its complement `hsaBorders` over county and state-level maps (+ `hsaBordersWidth`, see [Color by HSA, interact by county](#color-by-hsa-interact-by-county-datageotype)), an exterior `outline` (+ `outlineWidth`), a `background` wash, and the hover/focus `highlight`. Every color accepts any CSS color the page can express, including `var()`, `light-dark()`, and `color-mix()`, resolved against the map container's cascade. When the effective values change (a site light/dark toggle, an OS scheme flip, a custom-property redefinition), the map repaints on its own — in both the SVG and canvas renderers. `colorScale` colors resolve the same way, so theme tokens work there too.

The `outline` is the exterior boundary of the rendered geography — the national outline, or the selected state's boundary in single-state mode — drawn on top of interior borders with its own color and width. It's off by default and turns on when a visible color resolves.

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

Every channel's default routes through a `--choropleth-*` custom property, so a stylesheet alone can theme every map on a page — JS `theme` values always win:

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

::: warning Breaking change
`theme` replaces the former `noDataColor`, `strokeColor`, and `strokeWidth` props: use `theme.fill`, `theme.stroke`, and `theme.strokeWidth` instead.
:::

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

Pass a `cities` array to overlay decorative point markers with name labels. Each entry is `{ name, coordinates: [lng, lat], capital?, minZoom? }`. Every city is a dot; `capital` cities are labeled first and never dropped, while any other label that can't be placed without overlapping is dropped (its dot stays), so labels never collide. The overlay is non-interactive — the choropleth's own hover/click is unaffected — and the markers pan/zoom with the map while staying a constant on-screen size. It works with both the SVG and canvas (`renderer`) backends.

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

// Washington, DC (flagged as the capital) + the 100 most-populous US cities.
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

Only the national capital is flagged on the national map; a state's own capital is flagged in its single-state view. A flagged capital's label is placed first and never dropped for collisions; it carries a `.choropleth-city-label-capital` class if you want to style it, but by default it looks like every other label — the marker is a plain dot too.

**Styling:** the default marker style is dark dots and labels with a thin white halo, which reads over any map fill in either color scheme. The `theme` prop's marker keys configure the layer — `markerColor` (dots + labels), `markerHalo` (the halo around both), `markerHaloWidth` (dot halo width in CSS px), and `markerOpacity` (the whole layer). Any CSS color works. A stylesheet can alternatively set the CSS custom properties on `.choropleth-cities` (`--choropleth-city-marker`, `--choropleth-city-label-color`, `--choropleth-city-halo`); theme keys win when both are set.

### State labels (`state-labels`)

Set `state-labels` to label every state with its USPS abbreviation. A label that fits renders centered inside its state, and its text is automatically colored dark or light for contrast against that state's fill. States too small for their label — the classic VT/NH/MA/RI/CT stack, plus NJ, DE, MD, and DC — get a **callout**: the abbreviation sits beside the state over open background. A leader line points back at the state only when the label had to move away (stacked into a column, or pushed past intervening land, like DC's across the Chesapeake); a label sitting right beside its state — Hawaii's next to the big island — stays clean with no line. The layer is non-interactive (hover/click pass through) and works with both the SVG and canvas backends.

The labels adapt to the rendered size twice over. They shrink on small maps (capped relative to the map, with a legibility floor) so a narrow inline map keeps its inside labels instead of dissolving into callouts. And on a zoomable map they re-fit continuously: zoom into New England and the called-out states gain inside labels once they're big enough on screen. A state clipped by the zoomed view keeps its label only while it can sit nearby — otherwise it's left unlabeled rather than pinned to a viewport edge with a leader dragged across the map.

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
<script setup>
import { ChoroplethMap } from "@cfasim-ui/charts";
import statesTopo from "us-atlas/states-10m.json";
</script>

<ChoroplethMap :topology="statesTopo" :data="stateData" state-labels zoom />
```

  </template>
</ComponentDemo>

Enabling `state-labels` also reserves a slim right margin in the national map fit so the coast column has room to sit beside its states. Labels always mark _states_, so the prop also works on county and HSA maps (and in single-state mode, where only the scoped state is labeled). There the fill under a label isn't one color, so inside labels keep the same scheme-independent dark-text + white-halo styling as callouts instead of contrast-picking.

**Styling:** a stylesheet can override the layer's CSS custom properties on `.choropleth-state-labels` — `--choropleth-state-label-color` and `--choropleth-state-label-halo` for the default (callout/halo) styling and the leader lines, and `--choropleth-state-label-dark` / `--choropleth-state-label-light` for the two contrast-picked inside colors. Callout labels carry a `.choropleth-state-label-callout` class and leader lines `.choropleth-state-leader` as hooks.

### Enlarging DC (`enlarge-dc`)

The District of Columbia is a few pixels wide on a national map — impossible to see or hover — so **state-level maps enlarge it 4× by default**, in place around its own centroid. Pass a number to change the factor, or `:enlarge-dc="false"` to render DC at its true size; county and HSA maps are opt-in instead. The enlarged shape is what you see and what you interact with (fills, tooltips, hover/click, canvas picking), while ids and data values stay untouched.

The enlargement is **zoom-aware**: as you zoom in, DC holds that enlarged on-screen size until its true geography reaches it, then renders at its actual size — zoomed-in views are never distorted, and the size animates continuously with the zoom (no threshold pop). **Try it: zoom into the mid-Atlantic and watch DC settle to its true size.**

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

Works on every `geoType` — the enlarged feature is DC's state on a state map, county `11001` on a county map, or DC's HSA on an HSA map (the latter two are off unless you set the prop). Factors of `1` or less are ignored, and single-state maps are unaffected (a map scoped to a state is already zoomed in).

### HSA-level map

Set `geoType="hsas"` to render Health Service Area boundaries. Use 6-digit HSA codes as IDs. State borders are overlaid for context. Two topologies work:

- `us-atlas/counties-10m.json` — HSAs are dissolved from the county boundaries at runtime using the built-in FIPS-to-HSA mapping.
- **`usHsaTopology` from `@cfasim-ui/charts/us-hsa-topology`** — the same merge performed ahead of time and shipped as a ~155&nbsp;KB-gzipped topology (about half the county topology's size, since arcs interior to an HSA are gone). It renders identically and still includes the state boundaries, so state borders, the `state` prop, and state-level `data` rows all work. Prefer it when the map only needs HSA and state levels; county-level rendering (`geoType="counties"` or `geoType: "counties"` data rows) still needs the county topology.

```vue
<script setup>
import { ChoroplethMap } from "@cfasim-ui/charts";
import { usHsaTopology } from "@cfasim-ui/charts/us-hsa-topology";
</script>

<template>
  <ChoroplethMap :topology="usHsaTopology" geo-type="hsas" :data="hsaData" />
</template>
```

This demo uses the pre-merged topology, and pairs `tooltip-trigger="hover"` with a custom `#tooltip` slot —
hover an HSA on desktop, or tap one on touch, before or after zooming in.

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

`theme.countyBorders` overlays county boundaries on an HSA (or state-level) map, so HSA-level data can be read against the county geography underneath. Only the county lines _interior_ to each HSA are drawn — the HSA separators keep their own `stroke`, and the state mesh and outline still paint on top. `countyBordersWidth` defaults to the feature stroke width; the color carries the distinction, so a translucent color works well.

It needs a topology with county arcs (`us-atlas/counties-10m.json`): the pre-merged `usHsaTopology` has none, so it never draws county borders. On `geoType="counties"` maps the key does nothing — the feature strokes already are the county lines. The complementary `theme.hsaBorders` draws HSA separators over county-level maps instead; see [Color by HSA, interact by county](#color-by-hsa-interact-by-county-datageotype).

Both meshes respect [mixed levels](#mixing-levels-on-one-map-datageotype): a state re-tiled through `data[].geoType` is left unruled, so a state reported as one merged state-level shape stays flat inside — its own feature strokes carry whatever structure it has.

With `zoom` enabled, the `countyBordersMinZoom` prop turns the mesh into a zoom-in detail layer, like per-city `minZoom` on markers: `:county-borders-min-zoom="2"` keeps the county lines hidden until the user zooms in one level.

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

### Single-state map (`state`)

Set the `state` prop to render just one state's outline with its `counties` or
`hsas` inside it — no surrounding states — and the projection zooms to fit it.
Accepts a state **name** (`"California"`) or a 2-digit **FIPS code** (`"06"`).
This needs a counties topology (the same `us-atlas/counties-10m.json`), or the
pre-merged `usHsaTopology` when `geoType` is `"hsas"`. `data`
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

This is the composition for a county-interactive map of HSA-level data:
pair it with `theme.hsaBorders` — the [county mesh](#county-borders-over-an-hsa-map-theme-countyborders)'s
complement — so the HSA boundaries stay crisp as their own line layer
(only HSA-crossing county edges are meshed; state borders are left to
the state layers). For the full hover story, listen to `@state-hover`
and set `focus` to the hovered county's parent HSA: the county carries
the built-in hover highlight while its whole HSA gets an outline.

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
    :theme="{ hsaBorders: 'light-dark(#fff, #18181b)', hsaBordersWidth: 0.75 }"
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
  :theme="{ hsaBorders: 'light-dark(#fff, #18181b)', hsaBordersWidth: 0.75 }"
  title="HSA-keyed data on a county map"
/>
```

  </template>
</ComponentDemo>

### Mixing levels on one map (`data[].geoType`)

`dataGeoType` re-keys _all_ the data at once. When only some regions report at
a different level — most of the country has county estimates, but California
only published a statewide number — give those rows their own `geoType`
instead. The state is then drawn at that level: one merged California shape
carrying the state value, with every other state still split into counties.

```vue
<ChoroplethMap
  :topology="countiesTopo"
  geo-type="counties"
  :data="[
    { id: '36061', value: 12 }, // county rows as usual
    { id: '06', value: 85, geoType: 'states' }, // …and California as a whole
  ]"
/>
```

The substituted region is a normal feature: it fills from its own row, hovers
and clicks as one unit, reports its own name (`California`) in the tooltip, and
can be focused by its id.

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

It works in the other direction too — a state-level map where one state is
broken out into counties. The whole state is re-tiled, so its counties without
a row of their own render as no-data:

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

Rules to keep in mind:

- **A whole state is the unit.** One off-level row re-tiles its entire state, so
  a single county row on a state map splits all of that state's counties out.
- **Any pair of levels works** (`states` / `counties` / `hsas`), in either
  direction, as long as the topology can supply them — splitting a state into
  counties or HSAs needs `counties-10m.json`, not `states-10m.json`. HSA
  substitution waits for the lazily-loaded FIPS→HSA table and leaves the base
  map untouched until it arrives.
- **Off-level rows ignore `dataGeoType`.** They're looked up by their own id, so
  a map can use `dataGeoType` for its base features and still mix.
- **One level per state.** If two rows claim the same state at different levels,
  the first wins and a warning is logged. A row whose id resolves to no state
  is ignored (also with a warning) and the base map renders as usual.
- Ids can be codes or feature names (`"06"` or `"California"`), resolved in the
  row's own `geoType`.

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
(the interactive HTML tooltip, the native SVG `<title>`, and each feature's
`aria-label`). Use the `#tooltip` slot if you want full control over the
tooltip's content.

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
- There is no per-feature DOM for assistive tech (SVG mode names every
  feature via `aria-label`) — stay on SVG where that matters.

`renderer` can also be switched on a mounted map (e.g. drop to canvas past a
feature-count threshold) — the map rebuilds for the new backend in place and
the current zoom/pan carries over.

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

In SVG mode (the default renderer) every region is exposed to assistive tech
as a named graphic: each feature path carries `role="img"` and an `aria-label`
of `"Name"` or `"Name: value"` (formatted through `tooltip-value-format`),
kept in sync as data changes. Maps without an interactive tooltip also get a
native SVG `<title>` on each feature, so hovering shows the browser tooltip;
configuring `tooltip-trigger`, `tooltip-format`, or the `#tooltip` slot
replaces the `<title>` (the two tooltips would fight) but the `aria-label`
stays. In canvas mode there is no per-feature DOM, so regions aren't exposed
individually.

The map also announces itself as a whole. When it has a `title`, the root
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

Pass an array of `CategoricalStop` as `colorScale` to map string values to colors. States whose `value` matches a stop's `value` get that color; unmatched values get the theme's base `fill`.

```ts
interface CategoricalStop {
  /** The categorical value to match */
  value: string;
  /** CSS color string */
  color: string;
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
   * non-interactive outlines on top of the base map. */
  geoType?: "states" | "counties" | "hsas";
  /** Outline style. "solid" (default) matches the hover highlight;
   * "dashed" uses long dashes; "dotted" uses small round dots. */
  style?: "solid" | "dashed" | "dotted";
  /** Stroke color for cross-geoType overlay paths. Default: "#fff". */
  stroke?: string;
}
```
