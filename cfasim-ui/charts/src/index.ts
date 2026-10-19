export {
  default as LineChart,
  type LineChartData,
  type Series,
  type Area,
  type AreaSection,
  type AreaSectionLayout,
} from "./LineChart/LineChart.vue";
export {
  default as BarChart,
  type BarChartData,
  type BarSeries,
  type BarSummaryLine,
} from "./BarChart/BarChart.vue";
export {
  default as ChoroplethMap,
  type GeoType,
  type StateData,
  type ChoroplethColorScale,
  type ThresholdStop,
  type CategoricalStop,
  type FocusItem,
  type FocusValue,
  type FocusStyle,
  type RegionsSource,
  type MapProjection,
  type MapProjectionName,
} from "./ChoroplethMap/ChoroplethMap.vue";
// The projections ChoroplethMap bundles, re-exported so a `projection`
// factory needs no d3-geo dependency of its own.
export {
  geoAlbersUsa,
  geoMercator,
  geoEquirectangular,
  geoEqualEarth,
  type GeoProjection,
} from "d3-geo";
export { geoAlbersUsaTerritories } from "./_shared/albersUsaTerritories.js";
export { default as ChartTooltip } from "./ChartTooltip/ChartTooltip.vue";
export {
  default as DataTable,
  type TableData,
  type TableRecord,
  type ColumnAlign,
  type ColumnConfig,
  type ColumnWidth,
} from "./DataTable/DataTable.vue";
export type { CityMarker, PlacedCity } from "./ChoroplethMap/cityLayout.js";
export {
  mapThemeDefaults,
  type MapTheme,
  type ResolvedMapTheme,
} from "./_shared/mapTheme.js";
export type { ChartAnnotation } from "./_shared/annotations.js";
export type { ChartInterval, IntervalStyle } from "./_shared/intervals.js";
export type { GridStyle, GridLineStyle } from "./_shared/grid.js";
export type {
  ChartTooltipValue,
  ChartTooltipInterval,
  ChartTooltipBaseProps,
} from "./_shared/chartProps.js";
export type { ChartMarker, ChartMarkerDragPayload } from "./_shared/markers.js";
export type { BlendMode, LineMarkStyle } from "./_shared/chartProps.js";
