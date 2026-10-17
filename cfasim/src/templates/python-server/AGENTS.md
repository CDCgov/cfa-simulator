# AGENTS.md

Instructions for AI agents working on this project.

## Important information about cfasim-ui and front end development

The frontend code for this repository is written in the cfasim-ui framework. You should check `cfasim docs --json` (or `uvx cfasim docs --json` if the user has not installed the `cfasim` command line tool) to look up docs.

The JSON output gives every component's `name`, `slug`, `keywords`, and absolute paths to its markdown docs and `.vue` source. Read those files directly for API details, examples, and props before reaching for a custom implementation. The docs and source ship inside the installed `@cfasim-ui/components` and `@cfasim-ui/charts` packages (their `docs/` and `src/` directories) — the paths from `cfasim docs --json` point into them, wherever pnpm has installed them.

## What this project is

`{{ project_name }}` is a [cfasim](https://cdcgov.github.io/cfa-simulator/docs/) simulation whose Python model runs as **tasks on a local server**, not in the browser. The Vue page starts a task, streams its progress, and plots the outputs; every run is saved under `output/<run_id>/`.

- Python model: `src/{{ module_name }}/__init__.py` — pure functions (e.g. `simulate`), unit-tested with pytest
- Tasks: `src/{{ module_name }}/tasks.py` — `@task` functions from `cfasim_model.server` that the UI can start. A task gets `ctx` (`ctx.progress(fraction, message)`, `ctx.log(line)`, `ctx.emit(outputs)`, `ctx.run_dir`) and keyword inputs, and returns `model_outputs(...)`
- Vue frontend: `interactive/src/App.vue` — wires UI components to the server via `useServerModel` from `cfasim-ui/server`
- UI library: [`cfasim-ui`](https://cdcgov.github.io/cfa-simulator/docs/cfasim-ui/) — Vue components, charts, and composables; see the [Server](https://cdcgov.github.io/cfa-simulator/docs/cfasim-ui/server) page for the task API and protocol

## Commands

- `pnpm dev` — start the Vite dev server; the `cfasimServer` Vite plugin also starts `cfasim serve` and proxies `/api` to it
- `pnpm server` — run only the task server (`cfasim serve`; it runs `src/{{ module_name }}/tasks.py` in a worker under `uv run`)
- `pnpm build` — production build (serve `dist/` with `cfasim serve --static dist`)
- `pnpm typecheck` — vue-tsc type checking
- `pnpm test:e2e` — Playwright integration test (boots the dev server and the task server, starts a run). If Chromium is missing, run `cfasim tools` to install it.
- `uv sync` — install Python dependencies after changing `pyproject.toml`
- `cfasim serve` needs the `cfasim` CLI on your PATH (`cargo install cfasim` or `uv tool install cfasim`); the Vite plugin falls back to `uvx cfasim` when it is missing
- `uv run pytest` — run Python model unit tests (colocated with the package at `src/{{ module_name }}/test_*.py`)
- `uv run ruff format` — format Python code (`--check` to verify without writing)
- `uv run ruff check` — lint Python code (`--fix` to auto-fix)

## Conventions

- Import UI components from `cfasim-ui/components`, charts from `cfasim-ui/charts`, the server composables from `cfasim-ui/server`, and utilities from `cfasim-ui/shared`.
- Keep model logic in pure functions and call them from thin `@task` wrappers so pytest never needs the server.
- Task inputs arrive as JSON (numbers, strings, booleans, lists, dicts). Tasks return `model_outputs(...)` or call `ctx.emit(...)` for partial results; anything else a run produces (CSVs, figures) goes in `ctx.run_dir`.
- Icons: render Material Symbols with `<Icon icon="..." />` from `cfasim-ui/components`. A base set (e.g. `help`, `dark_mode`) works out of the box; to use any other icon you must register it — see [Registering icons](https://cdcgov.github.io/cfa-simulator/docs/cfasim-ui/components/icon#registering-icons). No icon webfont is loaded.
- Use `useUrlParams` (from `cfasim-ui/shared`) to sync reactive parameters to the URL query string.
- The server keeps one worker process alive between runs, so module-level setup in `tasks.py` (for example `numpyro.set_host_device_count`) runs once per worker. Editing a task file restarts the worker after the current run.

## After making changes

- After any change: run `pnpm typecheck`.
- After changes to the Python model (`src/{{ module_name }}/`): run `uv run ruff format` and `uv run pytest`.
- After major changes (new UI wiring, task signature changes, chart/output changes): run `pnpm test:e2e` to verify the app still boots and a run produces output end-to-end.
