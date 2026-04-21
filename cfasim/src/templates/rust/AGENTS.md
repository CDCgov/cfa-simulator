# AGENTS.md

Instructions for AI agents working on this project.

## Important information about cfasim-ui and front end development

The frontend code for this repository is written in the cfasim-ui framework. You should check `cfasim docs --json` (or `uvx cfasim docs --json` if the user has not installed the `cfasim` command line tool) to look up docs.

The JSON output gives every component's `name`, `slug`, `keywords`, and absolute paths to its markdown docs and `.vue` source. Read those files directly for API details, examples, and props before reaching for a custom implementation.

## What this project is

`%%project_name%%` is a [cfasim](https://cdcgov.github.io/cfa-simulator/docs/) simulation. cfasim is a framework for interactive simulations built with Rust, Vue 3, and WebAssembly. The Rust model code compiles to WASM via [wasm-pack](https://rustwasm.github.io/wasm-pack/) and runs in the browser.

- Rust model: `src/lib.rs` — `#[wasm_bindgen]` functions (e.g. `simulate`) called from the frontend
- Vue frontend: `interactive/src/App.vue` — wires UI components to the model via `useModel` from `cfasim-ui/wasm`
- UI library: [`cfasim-ui`](https://cdcgov.github.io/cfa-simulator/docs/cfasim-ui/) — Vue components, charts, and composables

## Commands

- `pnpm dev` — start the Vite dev server (rebuilds WASM on Rust changes)
- `pnpm build` — production build
- `pnpm typecheck` — vue-tsc type checking
- `cargo test` — run Rust model tests

## Conventions

- Import UI components from `cfasim-ui/components`, charts from `cfasim-ui/charts`, the model hook from `cfasim-ui/wasm`, and utilities from `cfasim-ui/shared`.
- Use `useUrlParams` (from `cfasim-ui/shared`) to sync reactive parameters to the URL query string.
- Model functions should return types that implement `Serialize`; the `useModel` composable handles transfer between the WASM worker and the main thread.
