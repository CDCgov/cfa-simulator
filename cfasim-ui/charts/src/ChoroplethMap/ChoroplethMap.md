# ChoroplethMap

A US choropleth map using D3's Albers USA projection, which repositions Alaska and Hawaii to the bottom left. Supports state-level and county-level rendering via the `geoType` prop. Includes built-in GeoJSON for all US states, territories, and counties.

## Examples

### Basic with state data

<ComponentDemo>
  <ChoroplethMap
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
<ChoroplethMap
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

### County-level map

Set `geoType="counties"` to render county-level data using 5-digit FIPS codes. State borders are drawn on top for context.

<ComponentDemo>
  <ChoroplethMap
    geo-type="counties"
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
  geo-type="counties"
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
