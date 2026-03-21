# cfasim-ui

cfasim-ui is the shared component and theming library you use to make simulators.

## Packages

| Package                 | Description                                                                     |
| ----------------------- | ------------------------------------------------------------------------------- |
| `@cfasim-ui/components` | Accessible UI components built on [reka-ui](https://reka-ui.com)                |
| `@cfasim-ui/charts`     | SVG charting components                                                         |
| `@cfasim-ui/theme`      | Design tokens, reset, and utility classes                                       |
| `@cfasim-ui/pyodide`    | Run Python models in the browser via [Pyodide](https://pyodide.org) Web Workers |
| `@cfasim-ui/wasm`       | Run Rust/WASM models in the browser via a Web Worker                            |

## Components

- [Box](./components/box) — colored container for callouts and alerts
- [Button](./components/button) — primary and secondary actions
- [Expander](./components/expander) — collapsible content section
- [Hint](./components/hint) — inline tooltip for help text
- [Icon](./components/icon) — Material Symbols icon
- [NumberInput](./components/number-input) — number field with optional slider
- [SelectBox](./components/select-box) — dropdown select
- [Spinner](./components/spinner) — loading indicator
- [TextInput](./components/text-input) — text field
- [Toggle](./components/toggle) — boolean switch

## Charts

- [DataTable](./charts/data-table) — table for columnar data or ModelOutput
- [LineChart](./charts/line-chart) — responsive SVG line chart

## Workers

- [Pyodide](./pyodide) — run Python models via Pyodide Web Workers
- [WASM](./wasm) — run Rust/WASM models via a Web Worker
