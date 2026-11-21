# AGENTS.md

Instructions for AI agents working on this project.

## Important information about cfasim-ui and front end development

The frontend code for this repository is written in the cfasim-ui framework. You should check `cfasim docs --json` (or `uvx cfasim docs --json` if the user has not installed the `cfasim` command line tool) to look up docs.

The JSON output gives every component's `name`, `slug`, `keywords`, and absolute paths to its markdown docs and `.vue` source. Read those files directly for API details, examples, and props before reaching for a custom implementation. The docs and source ship inside the installed `@cfasim-ui/components` and `@cfasim-ui/charts` packages (their `docs/` and `src/` directories) — the paths from `cfasim docs --json` point into them, wherever pnpm has installed them.

## What this project is

`{{ project_name }}` is a [cfasim](https://cdcgov.github.io/cfa-simulator/docs/) simulation. cfasim is a framework for interactive simulations built with Rust, Vue 3, and WebAssembly. The Rust model code compiles to WASM via [wasm-pack](https://rustwasm.github.io/wasm-pack/) and runs in the browser.

- Rust model: `src/lib.rs` — functions (e.g. `simulate`) that take an inputs struct and return `Outputs`, made callable from the frontend by `cfasim_model::export!`
- Vue frontend: `interactive/src/App.vue` — wires UI components to the model via `useModel` from `cfasim-ui/wasm`
- UI library: [`cfasim-ui`](https://cdcgov.github.io/cfa-simulator/docs/cfasim-ui/) — Vue components, charts, and composables

## Commands

- `pnpm dev`: start the Vite dev server (rebuilds WASM and reloads the page when `src/` or `Cargo.toml` changes; a compile error shows in the browser overlay and the terminal)
- `pnpm build`: production build
- `pnpm typecheck`: vue-tsc type checking
- `pnpm test:e2e`: Playwright integration test (boots the dev server, loads the app). If Chromium is missing, run `cfasim tools` to install it.
- `cargo test`: run Rust model unit tests (exported functions are plain Rust, so tests can call them directly)

## Conventions

- Import UI components from `cfasim-ui/components`, charts from `cfasim-ui/charts`, the model hook from `cfasim-ui/wasm`, and utilities from `cfasim-ui/shared`.
- Icons: render Material Symbols with `<Icon icon="..." />` from `cfasim-ui/components`. A base set (e.g. `help`, `dark_mode`) works out of the box; to use any other icon you must register it — see [Registering icons](https://cdcgov.github.io/cfa-simulator/docs/cfasim-ui/components/icon#registering-icons). No icon webfont is loaded.
- Use `useUrlParams` (from `cfasim-ui/shared`) to sync reactive parameters to the URL query string.
- `useOutputs("simulate", params)` passes the params object to the model, where its keys are matched by name to the fields of the `SimulateInputs` struct (`#[derive(Deserialize)]`); order does not matter, and values can be numbers, booleans, strings, arrays or nested objects. When adding a param, update both the JS `defaults` object and the struct. Add `#[serde(rename_all = "camelCase")]` to the struct to use camelCase keys in JS.
- Model functions return `Outputs` (named `ModelOutput` tables), or a `Result` of them to report an error to the page; the `useModel` composable handles transfer between the WASM worker and the main thread. List every exported function in the one `export!(...)` call at the end of `src/lib.rs`.

## After making changes

- After any change: run `pnpm typecheck`.
- After changes to the Rust model (`src/lib.rs`): run `cargo test`.
- After major changes (new UI wiring, model signature changes, chart/output changes): run `pnpm test:e2e` to verify the app still boots and produces output end-to-end.
