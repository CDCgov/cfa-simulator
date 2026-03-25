# Getting Started

cfasim-ui is a Vue 3 component library for building interactive simulations. It runs your model — written in Python or Rust — directly in the browser using Web Workers.

## Packages

| Package                 | Description                                                   |
| ----------------------- | ------------------------------------------------------------- |
| `@cfasim-ui/components` | Accessible UI components built on reka-ui                     |
| `@cfasim-ui/charts`     | SVG charting components (LineChart, ChoroplethMap, DataTable) |
| `@cfasim-ui/theme`      | Design tokens, reset, and utility classes                     |
| `@cfasim-ui/pyodide`    | Run Python models in the browser via Pyodide                  |
| `@cfasim-ui/wasm`       | Run Rust/WASM models in the browser                           |

## Choose your guide

Follow the guide for the language your model is written in:

- **[Python Projects](./guide/python)** — Vite + Vue + Pyodide. Write your model in Python, build it as a wheel, and run it in the browser.
- **[Rust Projects](./guide/rust)** — Vite + Vue + WebAssembly. Write your model in Rust, compile to WASM, and run it in the browser.

Both guides walk through project setup, model creation, Vite configuration, and wiring up the UI from scratch.
