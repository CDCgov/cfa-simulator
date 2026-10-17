# Rust Server Projects

A project whose Rust model runs **natively as tasks on a local server** instead of as WebAssembly in the browser. Choose it over the [WASM setup](./rust) when a run takes minutes, needs threads or native dependencies WASM cannot use, or should leave results on disk to keep and compare. The page starts a task, streams its progress and log, plots the outputs, and lists earlier runs to reload. The API and the HTTP protocol are on the [Server](../cfasim-ui/server) page.

Prerequisites: Node.js, pnpm, and the Rust toolchain as for [Rust projects](./rust#prerequisites) (no wasm-pack), plus the [`cfasim` CLI](../getting-started#install-the-cfasim-cli): `cfasim serve` is the server, and it builds and runs your tasks binary.

## Scaffold with `cfasim init`

```bash
cfasim init              # pick "Rust server", or pass --template rust-server
cd my-project
pnpm install
pnpm dev
```

`pnpm dev` starts Vite and, through the `cfasimServer` plugin, `cfasim serve`, which runs `cargo build --release` and keeps the tasks binary running as a worker; the dev server proxies `/api` to it. `pnpm server` runs the server alone (`cfasim serve --debug` skips `--release` for faster rebuilds while iterating).

```
my-project/
├── Cargo.toml              # cfasim-model with the "tasks" feature
├── src/
│   ├── lib.rs              # the model: pure functions, unit-tested
│   └── main.rs             # the tasks binary the page can start
├── output/                 # one folder per run (gitignored)
├── vite.config.ts          # cfasimServer() starts the server with vite
└── interactive/src/App.vue # useServerModel()
```

## The task

The scaffolded `src/main.rs` registers one task, `simulate`, with an inputs struct (`steps`, `rate`) and a `Default` for it, and calls `compute` from `src/lib.rs`. [Writing tasks in Rust](../cfasim-ui/server#writing-tasks-in-rust) walks through the same shape and lists what `Context` offers.

A task takes the context first and an inputs struct deserialized from the JSON the page sends; the struct's `Default` describes the parameters (names and defaults) to the page, so give every field a default. Return `Outputs`, or call `ctx.emit(&outputs, true)?` for partial results along the way. Anything else a run produces (CSVs, figures, a report) goes in `ctx.run_dir()`, and the page can list and download it. `println!` inside a task lands in the run log. Inputs must be a struct (or `()` for none): a misspelled input name is rejected by the server before the run starts.

The model itself stays in `src/lib.rs` as plain functions, so `cargo test` never needs the server.

## The page

The page is the same as for a [Python server project](./python-server#the-page): `useServerModel()` from `cfasim-ui/server` starts tasks, follows the current run, and lists saved runs. The scaffolded `App.vue` is the complete version.

## Existing projects and deployment

For a crate that already exists: add `cfasim-model = { version = "…", default-features = false, features = ["tasks"] }` and `serde`, add a binary target (`src/main.rs`, or a `[[bin]]` named in `[package.metadata.cfasim] tasks = "<name>"` when the package has several) that registers its tasks and calls `Tasks::serve()`, then add the UI as in the [WASM guide](./rust#set-up-the-frontend) with `cfasimServer()` in place of `cfasimWasm`.

Editing anything under `src/` or `Cargo.toml` rebuilds and restarts the worker after the current run; a build error keeps the previous binary running and is printed in the terminal.

To deploy, build the site and serve it with `cfasim serve --static dist`; see [Running the server](../cfasim-ui/server#running-the-server).
