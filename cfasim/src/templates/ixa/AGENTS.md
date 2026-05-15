# AGENTS.md

Instructions for AI agents working on this project.

## Important information about cfasim-ui and front end development

The frontend code for this repository is written in the cfasim-ui framework. You should check `cfasim docs --json` (or `uvx cfasim docs --json` if the user has not installed the `cfasim` command line tool) to look up docs.

The JSON output gives every component's `name`, `slug`, `keywords`, and absolute paths to its markdown docs and `.vue` source. Read those files directly for API details, examples, and props before reaching for a custom implementation.

## What this project is

`{{ project_name }}` is a [cfasim](https://cdcgov.github.io/cfa-simulator/docs/) simulation built on the [ixa](https://github.com/cdcgov/ixa) agent-based modelling framework. cfasim is a framework for interactive simulations using Rust, Vue 3, and WebAssembly; the Rust model compiles to WASM via [wasm-pack](https://rustwasm.github.io/wasm-pack/) and runs in the browser.

- ixa model: `src/model.rs` — a minimal SI epidemic. `Parameters` struct plus `define_entity!`, `define_property!`, `define_global_property!`, and `define_rng!`; a subscription to `Status` changes drives each newly-infected person to schedule their own next exponential transmission attempt. The `run` function takes `Parameters` and returns `(time, cumulative_infections)`.
- Stats sink: `src/stats.rs` — wraps `define_data_plugin!` so the model just calls `record_infection(ctx, time)` per event and `cumulative_timeseries(ctx, max_time)` at the end. In-memory replacement for ixa's CSV-on-disk reports, which don't work in WASM.
- WASM entry: `src/lib.rs` — `#[wasm_bindgen] simulate(args: &str)` deserializes a `SimulateArgs` struct from the JSON sent by `App.vue`, builds `Parameters`, calls `model::run`, and returns the timeseries via `cfasim-model`'s `ModelOutput`.
- Vue frontend: `interactive/src/App.vue` — wires UI components to the model via `useModel` from `cfasim-ui/wasm`
- UI library: [`cfasim-ui`](https://cdcgov.github.io/cfa-simulator/docs/cfasim-ui/) — Vue components, charts, and composables

## Commands

- `pnpm dev` — start the Vite dev server (rebuilds WASM on Rust changes)
- `pnpm build` — production build
- `pnpm typecheck` — vue-tsc type checking
- `pnpm test:e2e` — Playwright integration test (boots the dev server, loads the app). If Chromium is missing, run `cfasim tools` to install it.
- `cargo test` — run Rust model unit tests. Extract pure helpers from `#[wasm_bindgen]` functions so they're testable natively.

## Conventions

- Import UI components from `cfasim-ui/components`, charts from `cfasim-ui/charts`, the model hook from `cfasim-ui/wasm`, and utilities from `cfasim-ui/shared`.
- Use `useUrlParams` (from `cfasim-ui/shared`) to sync reactive parameters to the URL query string.
- `App.vue` passes params to `simulate` as a JSON string (`{ json: JSON.stringify(params) }`); the Rust side deserializes into `SimulateArgs`, whose `#[serde(rename_all = "camelCase")]` maps the JS keys (`infectionRate`, `nSimulations`, ...) to snake_case fields. When adding a param, update both the JS `defaults` object and the `SimulateArgs` struct.
- For in-browser ixa runs, never use `context.report_options().directory(...)` — disk I/O fails in the browser. Collect data in an in-memory plugin (see `src/stats.rs` + `define_data_plugin!` in `src/sir.rs`) and serialize through `ModelOutput`.
- `.cargo/config.toml` sets `--cfg getrandom_backend="wasm_js"` for the `wasm32-unknown-unknown` target, which is required for `getrandom` (transitively used by `rand` / `rand_distr`) to work in the browser.

## After making changes

- After any change: run `pnpm typecheck`.
- After changes to the Rust model (`src/*.rs`): run `cargo test`.
- After major changes (new UI wiring, model signature changes, chart/output changes): run `pnpm test:e2e` to verify the app still boots and produces output end-to-end.
