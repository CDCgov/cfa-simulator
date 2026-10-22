# Server

`@cfasim-ui/server` runs model code as **tasks on a local server** instead of in the browser: every run gets its own folder under `output/`, progress streams into the page, and earlier runs can be reloaded or compared. The server is `cfasim serve`, part of the [`cfasim` CLI](../getting-started#install-the-cfasim-cli), and it works for Python and Rust projects alike: it never runs model code itself but keeps one long-lived **worker** process (your Python task module under `uv run`, or your Rust tasks binary built with `cargo build --release`) and feeds it runs one at a time. The browser side only speaks a small HTTP [protocol](#protocol), and the worker a small [stdio protocol](#worker-protocol), so either half can be replaced.

## Writing tasks in Python

Add `cfasim-model` to the project (`uv add cfasim-model`; it depends only on numpy). A task is a function that takes a context and keyword inputs, decorated with `@task`:

```python
# tasks.py
import numpy as np
from cfasim_model import ModelOutput, model_outputs
from cfasim_model.server import task


@task
def simulate(ctx, steps: int = 10, rate: float = 2.5):
    values = np.zeros(steps)
    for t in range(1, steps):
        values[t] = values[t - 1] + rate
        ctx.progress(t / steps, f"step {t}")
    series = ModelOutput().add_f64("time", np.arange(steps)).add_f64("values", values)
    return model_outputs(series=series)
```

The context gives a task three hooks and one directory:

| Member                            | Purpose                                                                                                                                                                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ctx.progress(fraction, message)` | Report progress in `[0, 1]` with an optional label                                                                                                                                                                                                          |
| `ctx.log(line)`                   | Append a line to the run log. `print()` and `sys.stderr` output is captured too, including progress bars that use `\r`                                                                                                                                      |
| `ctx.emit(outputs, **tables)`     | Publish tables as a new revision of `outputs.cfasim`. Tables accumulate across emits (a repeated name replaces the earlier table, with a `SchemaChangeWarning` if its columns changed), so call it repeatedly to stream results; `ctx.clear()` forgets them |
| `ctx.run_dir`                     | The run's folder. Write CSVs, figures, or reports there; the page can list and download them                                                                                                                                                                |

A task may also return (or `emit`) a dict of pandas or polars DataFrames; each becomes a table through `ModelOutput.from_dataframe`, so a calibration task is usually "run the model, return the frames to plot". The run's final revision is the state when the task returns, merged with whatever it returned: a task that only emits still ends with a final revision, and CSVs (with `--csv`) are written then. Inputs arrive as JSON; the server describes each task's parameters from its signature and rejects unknown or missing inputs before anything runs.

## Writing tasks in Rust

Enable the `tasks` feature of the `cfasim-model` crate (`default-features = false` unless the crate is also built for the browser) and make the tasks a binary target, usually `src/main.rs`:

```rust
use cfasim_model::tasks::{Context, Result, Tasks};
use cfasim_model::{ModelOutput, Outputs};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
#[serde(default)]
struct SimulateInputs {
    steps: u32,
    rate: f64,
}

impl Default for SimulateInputs {
    fn default() -> Self {
        Self { steps: 10, rate: 2.5 }
    }
}

fn simulate(ctx: &mut Context, inputs: SimulateInputs) -> Result<Outputs> {
    let mut values = vec![0.0; inputs.steps as usize];
    for t in 1..values.len() {
        values[t] = values[t - 1] + inputs.rate;
        ctx.progress(t as f64 / values.len() as f64, &format!("step {t}"));
    }
    let series = ModelOutput::new(values.len()).add_f64("values", values);
    Ok(Outputs::new().add("series", series))
}

fn main() {
    Tasks::new()
        .task("simulate", simulate)
        .doc("Run the model and return its series.")
        .serve();
}
```

A task takes `&mut Context` and an inputs struct that is `Serialize + Deserialize + Default`: the defaults describe its parameters to the page, and the JSON the page sends is deserialized into it (a task without inputs takes `()`). It returns `Outputs` (named `ModelOutput` tables) or any error that converts into `Box<dyn Error>`, so `?` works with `anyhow` and `std::io`. A panic inside a task fails the run, not the worker.

| Member                            | Purpose                                                                                                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ctx.progress(fraction, message)` | Report progress in `[0, 1]`; an empty message means none                                                                                                                                                            |
| `ctx.log(line)`                   | Append a line to the run log. `println!` inside a task lands there too; `eprintln!` goes to the terminal. A child process inherits stdout, which is the event stream: pipe its stdout or point it at stderr         |
| `ctx.emit(outputs)?`              | Publish tables as a new revision of `outputs.cfasim`; returns `io::Result<()>`. Tables accumulate across emits as in Python (a replaced table whose columns changed logs a warning), and `ctx.clear()` forgets them |
| `ctx.run_dir()`                   | The run's folder for CSVs, figures, or reports                                                                                                                                                                      |

`Tasks::serve()` reads commands from stdin until `cfasim serve` closes it. `cfasim_model::outputs_file` has the file writer (`write_outputs`, `write_csvs`) if a plain binary wants to produce `.cfasim` files on its own.

## Running the server

```sh
cfasim serve                      # in the project root; detects Python or Rust
cfasim serve --tasks pkg.tasks    # Python: a module path or .py file
cfasim serve --tasks my-bin       # Rust: the tasks binary when the package has several
cfasim serve --static dist        # serve a built site at / next to /api
```

How the worker is found:

- **Python** (`pyproject.toml` present): `--tasks`, else `[tool.cfasim] tasks = "pkg.tasks"` in `pyproject.toml`, else `tasks.py` at the root, else a single `src/<package>/tasks.py`. The worker is `uv run python -m cfasim_model.server.worker <spec>`, so it uses the project's own environment.
- **Rust** (`Cargo.toml` present): `cargo build --release` (`--debug` to skip `--release`), then the one executable it produced; `--tasks <name>` or `[package.metadata.cfasim] tasks = "<name>"` picks a `[[bin]]` when there are several. Build output streams to the terminal.
- **Anything else**: `--worker "<command>"` starts a command that speaks the [worker protocol](#worker-protocol).

Options: `--host`, `--port` (8765), `--output` (`output`), `--csv` (also write each output table as `<table>.csv`), `--static dist`, `--cors`, `--app-url` (the page's URL, printed once the server is up; the Vite plugin passes its own), `--tasks`, `--debug`, `--worker`.

Once its port is bound the server prints where the API is and, when it knows, the URL to open. The API port itself has no page on it.

To deploy, `pnpm build` the site to `dist/` and serve it from the API process with `cfasim serve --static dist`, so `/api` stays same-origin. The server binds to `127.0.0.1` and has no authentication; put it behind your own proxy before exposing it further.

Tasks run one at a time in the long-lived worker, so in-process caches such as JAX's compiled executables survive between runs; further runs queue, and cancelling kills the worker (and anything it started) and starts a fresh one. Editing a task file restarts the worker after the current run: Python workers report the project files they imported, and Rust projects are watched under `src/` and `Cargo.toml` and rebuilt first, keeping the previous binary when the build fails.

### Limitations

- The 60 s a worker has to report ready includes `uv run` syncing the environment, so a first start that installs a large dependency (JAX, numpyro) can time out. Run `uv sync` once beforehand.
- `--worker` splits its command on whitespace; quoted arguments and paths with spaces are not supported. Wrap them in a script.
- On Windows only the server process itself is signalled on shutdown and cancel, not its process group, so a launcher such as `uv run` can leave the interpreter behind.
- Rust task inputs are described by serializing their `Default`, so a field that skips serialization (`#[serde(skip_serializing_if = ...)]`) is missing from the task's parameters and the server rejects it as an unknown input.

### numpyro helpers

`cfasim_model.numpyro` (numpyro and jax are your project's dependencies, not cfasim's):

- `to_distribution(spec)` turns `{"family": "Normal", "params": {"loc": 0, "scale": 1}}`, the shape [`PriorInput`](./components/prior-input) emits, into `numpyro.distributions.Normal(loc=0, scale=1)`. `distribution`/`kwargs`/`args` keys are accepted as aliases so existing config files work.
- `posterior_outputs(mcmc)` turns an `MCMC` (or a samples dict) into a `posterior` table (`chain`, `draw`, one column per scalar site, `name[i,j]` for arrays) and a `summary` table (mean, std, median, HPDI bounds, `n_eff`, `r_hat` per column).
- `run_mcmc(ctx, mcmc, rng_key, chunks=4, **model_kwargs)` runs warmup, then samples in `chunks` pieces, emitting the posterior so far after each so the page fills in while sampling continues. With `chunks=1` it is a plain `mcmc.run`.

Module-level JAX setup (`numpyro.set_host_device_count`, `jax_compilation_cache_dir`) belongs at the top of `tasks.py`: the module is imported inside the worker, before JAX initializes. Prefer `progress_bar=False` and let `run_mcmc` report progress; `print()` output and tqdm bars are captured into the run log either way.

## Vite plugin

`cfasim-ui/server/vite` starts `cfasim serve` alongside `vite dev` and proxies `/api` to it:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { cfasimServer } from "cfasim-ui/server/vite";

export default defineConfig({
  root: "interactive",
  plugins: [vue(), cfasimServer()],
});
```

It runs `bin`, else `$CFASIM_BIN`, else the `cfasim` on your PATH. When neither `bin` nor `$CFASIM_BIN` is set and `cfasim` is not installed, it falls back to `uvx cfasim@<version>`, the release matching the installed `@cfasim-ui/server`, which `uv` caches after the first start.

| Option    | Default                                                            | Description                                                                              |
| --------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `bin`     | `$CFASIM_BIN`, else `cfasim`                                       | The executable to run                                                                    |
| `tasks`   | detected by `cfasim serve`                                         | Passed as `--tasks`: a Python module or `.py` file, or the name of the Rust tasks binary |
| `port`    | `8765`                                                             | Port the server listens on                                                               |
| `output`  | `"output"`                                                         | Directory with one folder per run                                                        |
| `csv`     | `false`                                                            | Pass `--csv`                                                                             |
| `debug`   | `false`                                                            | Pass `--debug` (build a Rust worker without `--release`)                                 |
| `cwd`     | `process.cwd()`                                                    | Where to start the server (your project root)                                            |
| `command` | `cfasim serve --port <port> --output <output> --app-url <dev url>` | Full command override; a custom command gets no `--app-url`                              |

The plugin only acts during `vite dev`; see [Running the server](#running-the-server) for serving a production build.

## useServerModel

```ts
import { useServerModel } from "cfasim-ui/server";

const { tasks, runs, start, cancel, load, current, connected, error } =
  useServerModel();

await start("simulate", { steps: 20, rate: 1.5 });
// current.progress.value?.fraction, current.log.value, current.outputs.value
```

### Returns

| Property       | Type                                                        | Description                                                                                                                                                                   |
| -------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tasks`        | `Ref<TaskInfo[]>`                                           | Registered tasks with their parameters                                                                                                                                        |
| `runs`         | `Ref<RunSummary[]>`                                         | Saved runs, newest first; refreshed when the current run finishes                                                                                                             |
| `start`        | `(task, inputs, { name? }) => Promise<string \| undefined>` | Start a run; it becomes `current`. Resolves to the run id, or `undefined` when the server refused it (`error` says why). A name labels the run and prefixes its id and folder |
| `cancel`       | `(runId?) => Promise<void>`                                 | Cancel a run (default: the current one)                                                                                                                                       |
| `load`         | `(runId) => void`                                           | Make a saved run `current`. Its events replay while the server still holds them (runs from this server session); otherwise its saved log is loaded                            |
| `current`      | `RunHandle`                                                 | The run being followed                                                                                                                                                        |
| `useRun`       | `(runId) => RunHandle`                                      | Follow another run, e.g. for a side-by-side comparison                                                                                                                        |
| `connected`    | `Ref<boolean>`                                              | `false` while the server cannot be reached (including the dev proxy's 502); retried every few seconds until it answers                                                        |
| `error`        | `Ref<string>`                                               | Last error message                                                                                                                                                            |
| `refreshRuns`  | `() => Promise<void>`                                       | Reload the run list                                                                                                                                                           |
| `refreshTasks` | `() => Promise<void>`                                       | Reload the task list                                                                                                                                                          |

Pass `{ baseUrl }` when the API is not under `/api`.

## useRun

`useRun(runId, options?)` follows one run and is what `current` is built on; `runId` may be a ref.

| Property   | Type                               | Description                                                      |
| ---------- | ---------------------------------- | ---------------------------------------------------------------- |
| `id`       | `Ref<string>`                      | Run id being followed                                            |
| `status`   | `Ref<RunStatus>`                   | `queued`, `running`, `done`, `error`, or `cancelled`             |
| `active`   | `ComputedRef<boolean>`             | `true` while queued or running                                   |
| `progress` | `Ref<{ fraction, message }>`       | Latest progress report                                           |
| `log`      | `Ref<{ stream, line }[]>`          | Log lines; progress-bar updates replace the previous line        |
| `outputs`  | `Ref<Record<string, ModelOutput>>` | Latest emitted tables, decoded for the charts                    |
| `revision` | `Ref<number>`                      | Which emit `outputs` holds                                       |
| `inputs`   | `Ref<Record<string, unknown>>`     | The inputs the run was started with (to reload them into a form) |
| `files`    | `Ref<RunFile[]>`                   | Files the task wrote to its run directory                        |
| `fileUrl`  | `(path) => string`                 | Download URL for one of those files (`""` with no run)           |
| `error`    | `Ref<string>`                      | Error message of a failed run, or a connection problem           |

```ts
// Compare two saved runs
const baseline = useRun("20261016-101500-a1b2c3");
const variant = useRun(selectedRunId);
```

## Protocol

Everything under one prefix (`/api` by default). Any implementation of this section works with `@cfasim-ui/server`; `cfasim serve` is the reference and `cfasim-model-py/tests/fixtures/` holds a sample outputs file to test against (the Rust and Python writers are byte-compared against it).

### Routes

| Method | Path                                          | Response                                                                                                                                                                                                                                                                                                         |
| ------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`                                     | `{ ok, version, worker, queued, current }`                                                                                                                                                                                                                                                                       |
| GET    | `/tasks`                                      | `{ tasks: [{ name, doc, params: [{ name, required, default, annotation }], accepts_extra }], ready, error }`; waits up to 10 s for a starting worker, `error` carries an import or build failure                                                                                                                 |
| POST   | `/tasks/{name}/run`                           | Body `{ "inputs": {...}, "name"?: "label" }` → `202 { run_id, name, inputs_hash, status: "queued" }`; `400` on bad inputs; `404` unknown task; `503` with `Retry-After: 2` while the worker is still starting (after a 10 s wait) or has failed. A name is stored on the run and, slugified, prefixes the run id |
| GET    | `/runs?task=&limit=`                          | `{ runs: [status, …] }` newest first                                                                                                                                                                                                                                                                             |
| GET    | `/runs/{id}`                                  | The run's status document (below)                                                                                                                                                                                                                                                                                |
| GET    | `/runs/{id}/events`                           | Server-Sent Events: history so far, then live; closes after a terminal event (at once for a run from an earlier server session, whose status document is the record). Frames carry `id:`; `Last-Event-ID` resumes                                                                                                |
| GET    | `/runs/{id}/outputs`                          | The `.cfasim` file, `application/octet-stream`; `404` before the first emit                                                                                                                                                                                                                                      |
| GET    | `/runs/{id}/inputs`, `/runs/{id}/log?tail=N`  | Inputs JSON; log text                                                                                                                                                                                                                                                                                            |
| GET    | `/runs/{id}/files`, `/runs/{id}/files/{path}` | `{ files: [{ path, size, modified }] }` of task-written files; the file itself                                                                                                                                                                                                                                   |
| POST   | `/runs/{id}/cancel`                           | `202`; `409` if the run already finished                                                                                                                                                                                                                                                                         |

Errors are `{ "error": "message" }` with a 4xx status.

### Status document

```json
{
  "run_id": "wide-prior-20261016-143012-a1b2c3",
  "name": "wide prior",
  "task": "simulate",
  "inputs_hash": "a1b2c3d4e5f60718",
  "status": "running",
  "created_at": "2026-10-16T14:30:12.000-04:00",
  "started_at": "2026-10-16T14:30:12.100-04:00",
  "finished_at": null,
  "progress": { "fraction": 0.4, "message": "chunk 2/5" },
  "outputs": {
    "revision": 2,
    "partial": true,
    "names": ["posterior", "summary"]
  },
  "error": null
}
```

`status` is one of `queued`, `running`, `done`, `error`, `cancelled`. `inputs_hash` is the first 16 hex characters of the SHA-256 of the inputs as compact JSON with sorted keys (as the server serializes them; Python's `json.dumps` agrees for ASCII inputs and plain numbers); the run id is a timestamp plus its first six characters, prefixed by the slugified name when one was given. On disk a run is `output/<run_id>/` with `inputs.json`, `status.json`, `log.txt`, `outputs.cfasim`, and whatever the task wrote.

### Events

Every frame's `data` is JSON with `type`, `run_id`, `seq`, `time`, plus:

| Event       | Fields                         | Meaning                                                                                                                                                                                                                             |
| ----------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status`    | `status`                       | The run moved from queued to running                                                                                                                                                                                                |
| `progress`  | `fraction`, `message`          | Progress in `[0, 1]`                                                                                                                                                                                                                |
| `log`       | `stream`, `line`, `overwrite`  | A log line; `overwrite: true` replaces the previous overwrite line of that stream                                                                                                                                                   |
| `outputs`   | `revision`, `partial`, `names` | A new `outputs.cfasim` is available; the client fetches `/outputs`. `partial` is false once the task has returned; when it returned nothing new, the last revision is announced again with `partial: false` and the same `revision` |
| `done`      |                                | Finished successfully (terminal)                                                                                                                                                                                                    |
| `error`     | `message`, `traceback`         | Failed (terminal)                                                                                                                                                                                                                   |
| `cancelled` |                                | Cancelled (terminal)                                                                                                                                                                                                                |

### Outputs file

```
[0, 4)               u32 little-endian: header length
[4, 4 + len)         UTF-8 JSON header, space-padded so the data section starts on an 8-byte boundary
[4 + len, …)         column buffers in column order, each padded to 8 bytes
```

```json
{
  "version": 1,
  "outputs": {
    "series": {
      "length": 3,
      "columns": [
        { "name": "time", "type": "f64" },
        { "name": "status", "type": "enum", "enumLabels": ["S", "I", "R"] }
      ],
      "byteOffsets": [0, 24],
      "byteLengths": [24, 12]
    }
  }
}
```

`columns` is the same `ColumnDescriptor` list `ModelOutput` uses (`f64`, `i32`, `u32`, `bool` as one byte, `enum` as `u32` indices with `enumLabels`, `date` as `u32` days since 1970-01-01); buffers are little-endian. Offsets are relative to the start of the data section. `decodeModelOutputs(buffer)` from `cfasim-ui/shared` reads the file into `ModelOutput` tables; `cfasim_model.outputs_file` (Python) and `cfasim_model::outputs_file` (Rust) have the writers.

### Worker protocol

The server starts one worker process and talks to it over its pipes: one JSON object per line on the worker's **stdin** (commands) and **stdout** (events). Anything else the worker prints to stdout that is not a JSON object is taken as a `log` line of the current run, so a stray `print` cannot break the stream; the worker's stderr is inherited and shows in the terminal. The worker exits on `shutdown` or when stdin closes.

| Direction       | Line                                                                       | Meaning                                                                                                  |
| --------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| worker → server | `{"type":"worker_ready","protocol":"1.0","pid":…,"tasks":[…],"files":[…]}` | Sent once after start. `tasks` are the `/tasks` entries; `files` are project source files to watch       |
| worker → server | `{"type":"worker_exited","message":…,"traceback":…}`                       | The task module failed to load; the worker then exits non-zero and is not restarted until a file changes |
| server → worker | `{"cmd":"run","run_id":…,"task":…,"inputs":{…},"run_dir":"…","csv":false}` | Run one task; the worker writes `outputs.cfasim` (and CSVs when asked) into `run_dir`                    |
| worker → server | `progress`, `log`, `outputs`, `done`, `error` events with `run_id`         | The run [events](#events) above, without `seq` (the server stamps it, and `time` when missing)           |
| server → worker | `{"cmd":"shutdown"}`                                                       | Exit cleanly after the current command                                                                   |

Cancelling a run kills the worker's whole process group and starts a new worker; a worker that exits during a run fails that run with its exit code. `cfasim serve --worker "<command>"` runs any program that follows this table.

`protocol` is the version of this table as `major.minor`, currently `1.0`. A minor bump only adds fields; a major bump is the only change that breaks a worker. The server warns on startup when the worker's major differs from its own, or when the field is missing, and reports the worker's version as `worker.protocol` on `/health`. The constant lives in `cfasim_model.server.events.PROTOCOL` (Python) and `cfasim_model::tasks::PROTOCOL` (Rust).
