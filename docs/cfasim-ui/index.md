# cfasim-ui

cfasim-ui is the shared component and theming library you use to make simulators.

## Packages

| Package                 | Description                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `@cfasim-ui/components` | Accessible UI components built on [reka-ui](https://reka-ui.com)                      |
| `@cfasim-ui/charts`     | SVG charting components                                                               |
| `@cfasim-ui/theme`      | Design tokens, reset, and utility classes                                             |
| `@cfasim-ui/pyodide`    | Run Python models in the browser via [Pyodide](https://pyodide.org) Web Workers       |
| `@cfasim-ui/wasm`       | Run Rust/WASM models in the browser via a Web Worker                                  |
| `@cfasim-ui/server`     | Run long Python or Rust tasks on a local server with streamed progress and saved runs |
| `@cfasim-ui/shared`     | Shared utilities, including the [`useUrlParams`](./shared) composable                 |

## Components

- [Box](./components/box) — colored container for callouts and alerts
- [Button](./components/button) — primary and secondary actions
- [ButtonGroup](./components/button-group) — visually joins a set of buttons into one unit
- [Container](./components/container) — vertical or horizontal layout wrapper with optional border, height, and gap
- [DatePicker](./components/date-picker) — date field with a calendar popover and custom formats
- [DateRangePicker](./components/date-range-picker) — start and end date fields with a range calendar
- [Expander](./components/expander) — collapsible content section
- [Grid](./components/grid) — responsive multi-column layout
- [Hint](./components/hint) — inline tooltip for help text
- [Icon](./components/icon) — inline-SVG Material Symbols icon (tree-shakeable, no webfont)
- [MultiSelect](./components/multi-select) — multi-select combobox with autocomplete
- [NumberInput](./components/number-input) — number field with optional single, range, or multi-handle slider
- [ParamEditor](./components/param-editor) — lazy-loaded JSON/TOML/YAML editor for parameter sets
- [PriorInput](./components/prior-input) — distribution family and parameters for a Bayesian prior, using numpyro names
- [SelectBox](./components/select-box) — dropdown select
- [SidebarLayout](./components/sidebar-layout) — two-panel layout with a collapsible sidebar
- [Spinner](./components/spinner) — loading indicator
- [TextInput](./components/text-input) — text field
- [Toggle](./components/toggle) — boolean switch
- [ToggleGroup](./components/toggle-group) — segmented single/multi-select control

## Charts

- [BarChart](./charts/bar-chart) — grouped/stacked/overlay bar chart, vertical or horizontal
- [ChoroplethMap](./charts/choropleth-map) — choropleth map of US states, counties, and HSAs, or any custom geography
- [DataTable](./charts/data-table) — table for columnar data or ModelOutput
- [LineChart](./charts/line-chart) — responsive SVG line chart
- [VegaLiteChart](./charts/vega-lite-chart) — renders a Vega-Lite spec as a LineChart or BarChart

The export helpers behind the chart menu (standalone SVG, PNG blobs, file downloads) are documented under [Chart export](./export).

## Runtimes

- [Pyodide](./pyodide) — run Python models via Pyodide Web Workers
- [WASM](./wasm) — run Rust/WASM models via a Web Worker
- [Server](./server) — run Python or Rust tasks on a local server (`cfasim serve`) with progress streaming and run history
