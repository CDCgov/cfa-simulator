# Getting Started

cfasim-ui is a Vue 3 component library for building interactive simulations. It runs your model — written in Python or Rust — directly in the browser using Web Workers.

## Create a new project

The simplest way to create a new project from the latest template is with uvx:

```sh
uvx cfasim init
```

Follow the prompts to bootstrap the new starter project. If you run into any issues
with missing dependencies, run:

```sh
uvx cfasim tools
```

to check your environment.

## Install the `cfasim` CLI

If you plan on working with projects often, you can install the `cfasim` CLI:

```sh
# Shell (macOS / Linux)
curl --proto '=https' --tlsv1.2 -LsSf https://cdcgov.github.io/cfa-simulator/install.sh | sh
```

```powershell
# PowerShell (Windows)
powershell -ExecutionPolicy Bypass -c "irm https://cdcgov.github.io/cfa-simulator/install.ps1 | iex"
```

You can also use a package manager of your choice:

```sh
# cargo
cargo install cfasim

# uv
uv tool install cfasim
```

Binaries installed via the shell or PowerShell installer can self-update with `cfasim update`. Copies installed via `cargo` or `uvx` are managed by those tools — update them with `cargo install cfasim --force` or `uv tool upgrade cfasim`.

When you have the tool installed, check your environment for required dependencies:

```sh
cfasim tools
```

And finally, create a new project:

```sh
cfasim init
```

`cfasim init` prompts for a project name and language (Python or Rust), then generates a Vite + Vue app wired up to run your model in the browser.

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
