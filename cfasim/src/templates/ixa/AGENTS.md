# AGENTS.md

Instructions for AI agents working on this project.

## Important information about cfasim-ui and front end development

The frontend code for this repository is written in the cfasim-ui framework. You should check `cfasim docs --json` (or `uvx cfasim docs --json` if the user has not installed the `cfasim` command line tool) to look up docs.

The JSON output gives every component's `name`, `slug`, `keywords`, and absolute paths to its markdown docs and `.vue` source. Read those files directly for API details, examples, and props before reaching for a custom implementation. The docs and source ship inside the installed `@cfasim-ui/components` and `@cfasim-ui/charts` packages (their `docs/` and `src/` directories) — the paths from `cfasim docs --json` point into them, wherever pnpm has installed them.

## What this project is

`{{ project_name }}` is a [cfasim](https://cdcgov.github.io/cfa-simulator/docs/) simulation built on the [ixa](https://github.com/cdcgov/ixa) agent-based modelling framework. cfasim is a framework for interactive simulations using Rust, Vue 3, and WebAssembly; the Rust model compiles to WASM via [wasm-pack](https://rustwasm.github.io/wasm-pack/) and runs in the browser.

- ixa model: `src/model.rs` — a minimal stochastic SIR outbreak with homogeneous mixing, built on ixa's [`core_epi`](https://github.com/CDCgov/ixa/blob/main/docs/book/src/topics/core-epi.md) transmission loop. `impl InfectionManager<Pathogen> for Context` gives each infected person a constant infectiousness over an exponentially distributed infectious period (`draw_infectiousness_rate_fn`) and tracks disease state in `on_infected`; `impl TransmissionManager<Pathogen> for Context {}` keeps the defaults (uniformly random contacts, permanent immunity). The `run` function takes `Parameters` and a seed, validates the parameters, and returns `Result<(time, cumulative_infections), String>`.
- Stats sink: `src/stats.rs` — wraps `define_data_plugin!` so the model just calls `record_infection(ctx, time)` per event and `cumulative_timeseries(ctx, max_time)` at the end. In-memory replacement for ixa's CSV-on-disk reports, which don't work in WASM.
- WASM entry: `src/lib.rs`, where `simulate(args: SimulateArgs)` receives the params object from `App.vue` as a struct, builds `Parameters`, calls `model::run`, and returns the timeseries via `cfasim-model`'s `ModelOutput`. It returns `Result<Outputs, String>`, so an invalid parameter reaches the page as the `error` from `useOutputs`. `cfasim_model::export!(simulate)` makes it callable from the page.
- Vue frontend: `interactive/src/App.vue` — wires UI components to the model via `useModel` from `cfasim-ui/wasm`
- UI library: [`cfasim-ui`](https://cdcgov.github.io/cfa-simulator/docs/cfasim-ui/) — Vue components, charts, and composables

## Commands

- `pnpm dev`: start the Vite dev server (rebuilds WASM and reloads the page when `src/` or `Cargo.toml` changes; a compile error shows in the browser overlay and the terminal)
- `pnpm build`: production build
- `pnpm typecheck`: vue-tsc type checking
- `pnpm test:e2e`: Playwright integration test (boots the dev server, loads the app). If Chromium is missing, run `cfasim tools` to install it.
- `cargo test`: run Rust model unit tests. Exported functions are plain Rust, so tests can call them directly.

## Conventions

- Import UI components from `cfasim-ui/components`, charts from `cfasim-ui/charts`, the model hook from `cfasim-ui/wasm`, and utilities from `cfasim-ui/shared`.
- Icons: render Material Symbols with `<Icon icon="..." />` from `cfasim-ui/components`. A base set (e.g. `help`, `dark_mode`) works out of the box; to use any other icon you must register it — see [Registering icons](https://cdcgov.github.io/cfa-simulator/docs/cfasim-ui/components/icon#registering-icons). No icon webfont is loaded.
- Use `useUrlParams` (from `cfasim-ui/shared`) to sync reactive parameters to the URL query string.
- `App.vue` passes its params object to `simulate` with `useOutputs("simulate", params)`; the keys are matched by name to the fields of `SimulateArgs` (order does not matter), whose `#[serde(rename_all = "camelCase")]` maps the JS keys (`infectiousPeriod`, `nSimulations`, ...) to snake_case fields. Values can be numbers, booleans, strings, arrays or nested objects, and types are checked: a fractional or negative number for a `u32` field fails the call, so give integer params `number-type="integer"` on their `NumberInput`. When adding a param, update both the JS `defaults` object and the `SimulateArgs` struct, and list any new exported function in the `export!(...)` call.
- For in-browser ixa runs, never use `context.report_options().directory(...)` — disk I/O fails in the browser. Collect data in an in-memory plugin (see `define_data_plugin!` in `src/stats.rs`) and serialize through `ModelOutput`.
- To extend the epidemiology (contact structure, susceptibility, modifiers such as vaccines or antivirals, settings such as households, variants), override methods on the two `core_epi` traits rather than scheduling transmission by hand; the ixa book's `core-epi` chapters and `examples/core-epi*` in the ixa repository show each. `rand_distr` must stay on the version line that pairs with ixa's `rand`.

## After making changes

- After any change: run `pnpm typecheck`.
- After changes to the Rust model (`src/*.rs`): run `cargo test`.
- After major changes (new UI wiring, model signature changes, chart/output changes): run `pnpm test:e2e` to verify the app still boots and produces output end-to-end.
