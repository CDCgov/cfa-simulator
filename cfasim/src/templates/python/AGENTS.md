# AGENTS.md

Instructions for AI agents working on this project.

## Important information about cfasim-ui and front end development

The frontend code for this repository is written in the cfasim-ui framework. You should check `cfasim docs --json` (or `uvx cfasim docs --json` if the user has not installed the `cfasim` command line tool) to look up docs.

The JSON output gives every component's `name`, `slug`, `keywords`, and absolute paths to its markdown docs and `.vue` source. Read those files directly for API details, examples, and props before reaching for a custom implementation.

## What this project is

`%%project_name%%` is a [cfasim](https://cdcgov.github.io/cfa-simulator/docs/) simulation. cfasim is a framework for interactive simulations built with Python, Vue 3, and WebAssembly. The Python model code runs in the browser via [Pyodide](https://pyodide.org/).

- Python model: `src/%%module_name%%/__init__.py` — exposes functions (e.g. `simulate`) called from the frontend
- Vue frontend: `interactive/src/App.vue` — wires UI components to the model via `useModel` from `cfasim-ui/pyodide`
- UI library: [`cfasim-ui`](https://cdcgov.github.io/cfa-simulator/docs/cfasim-ui/) — Vue components, charts, and composables

## Commands

- `pnpm dev` — start the Vite dev server
- `pnpm build` — production build
- `pnpm typecheck` — vue-tsc type checking
- `pnpm test:e2e` — Playwright integration test (boots the dev server, loads the app). If Chromium is missing, run `cfasim tools` to install it.
- `uv run pytest` — run Python model unit tests (colocated with the package at `src/%%module_name%%/test_*.py`)
- `uv run ruff format` — format Python code (`--check` to verify without writing)
- `uv run ruff check` — lint Python code (`--fix` to auto-fix)

## Conventions

- Import UI components from `cfasim-ui/components`, charts from `cfasim-ui/charts`, the model hook from `cfasim-ui/pyodide`, and utilities from `cfasim-ui/shared`.
- Use `useUrlParams` (from `cfasim-ui/shared`) to sync reactive parameters to the URL query string.
- Model functions should return JSON-serializable data; the `useModel` composable handles transfer between the Pyodide worker and the main thread.

## After making changes

- After any change: run `pnpm typecheck`.
- After changes to the Python model (`src/%%module_name%%/`): run `uv run ruff format` and `uv run pytest`.
- After major changes (new UI wiring, model signature changes, chart/output changes): run `pnpm test:e2e` to verify the app still boots and produces output end-to-end.
