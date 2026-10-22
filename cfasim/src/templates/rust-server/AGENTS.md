# AGENTS.md

Instructions for AI agents working on this project.

## Important information about cfasim-ui and front end development

The frontend code for this repository is written in the cfasim-ui framework. You should check `cfasim docs --json` (or `uvx cfasim docs --json` if the user has not installed the `cfasim` command line tool) to look up docs.

The JSON output gives every component's `name`, `slug`, `keywords`, and absolute paths to its markdown docs and `.vue` source. Read those files directly for API details, examples, and props before reaching for a custom implementation. The docs and source ship inside the installed `@cfasim-ui/components` and `@cfasim-ui/charts` packages (their `docs/` and `src/` directories) — the paths from `cfasim docs --json` point into them, wherever pnpm has installed them.

## What this project is

`{{ project_name }}` is a [cfasim](https://cdcgov.github.io/cfa-simulator/docs/) simulation whose Rust model runs natively as **tasks on a local server**, not in the browser. The Vue page starts a task, streams its progress, and plots the outputs; every run is saved under `output/<run_id>/`.

- Rust model: `src/lib.rs` — pure functions (e.g. `compute`), unit-tested with `cargo test`
- Tasks: `src/main.rs` — the tasks binary. Functions registered with `Tasks::new().task(name, f)` from `cfasim_model::tasks` take `ctx: &mut Context` (`ctx.progress(fraction, message)`, `ctx.log(line)`, `ctx.emit(outputs)`, `ctx.run_dir()`) and an inputs struct (`Serialize + Deserialize + Default`, whose defaults describe the parameters to the page), and return `Outputs`
- Vue frontend: `interactive/src/App.vue` — wires UI components to the server via `useServerModel` from `cfasim-ui/server`
- UI library: [`cfasim-ui`](https://cdcgov.github.io/cfa-simulator/docs/cfasim-ui/) — Vue components, charts, and composables; see the [Server](https://cdcgov.github.io/cfa-simulator/docs/cfasim-ui/server) page for the task API and protocol

## Commands

- `pnpm dev` — start the Vite dev server; the `cfasimServer` Vite plugin also starts `cfasim serve` (which runs `cargo build --release` and keeps the tasks binary running) and proxies `/api` to it
- `pnpm server` — run only the task server (`cfasim serve`; `--debug` skips `--release`)
- `pnpm build` — production build (serve `dist/` with `cfasim serve --static dist`)
- `pnpm typecheck` — vue-tsc type checking
- `pnpm test:e2e` — Playwright integration test (boots the dev server and the task server, starts a run). If Chromium is missing, run `cfasim tools` to install it.
- `cargo test` — run Rust model unit tests
- `cfasim serve` needs the `cfasim` CLI on your PATH (`cargo install cfasim` or `uv tool install cfasim`); the Vite plugin falls back to `uvx cfasim` when it is missing

## Conventions

- Import UI components from `cfasim-ui/components`, charts from `cfasim-ui/charts`, the server composables from `cfasim-ui/server`, and utilities from `cfasim-ui/shared`.
- Keep model logic in `src/lib.rs` as pure functions and call them from thin task functions in `src/main.rs`, so `cargo test` never needs the server.
- Task inputs arrive as JSON and are deserialized with serde; `#[serde(default)]` plus a `Default` impl gives every input a default the page can show. Tasks return `Outputs` or call `ctx.emit(outputs)?` for results along the way (emitted tables accumulate across calls); anything else a run produces (CSVs, figures) goes in `ctx.run_dir()`.
- `println!` inside a task lands in the run log; `eprintln!` goes to the terminal. A child process spawned from a task inherits stdout, which is the event stream, so pipe its stdout or send it to stderr.
- Icons: render Material Symbols with `<Icon icon="..." />` from `cfasim-ui/components`. A base set (e.g. `help`, `dark_mode`) works out of the box; to use any other icon you must register it — see [Registering icons](https://cdcgov.github.io/cfa-simulator/docs/cfasim-ui/components/icon#registering-icons). No icon webfont is loaded.
- Use `useUrlParams` (from `cfasim-ui/shared`) to sync reactive parameters to the URL query string.
- The server rebuilds and restarts the worker when a file under `src/` or `Cargo.toml` changes (after the current run); a build error keeps the previous binary running.

## After making changes

- After any change: run `pnpm typecheck`.
- After changes to the Rust model (`src/`): run `cargo test`.
- After major changes (new UI wiring, task signature changes, chart/output changes): run `pnpm test:e2e` to verify the app still boots and a run produces output end-to-end.
