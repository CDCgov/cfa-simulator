# WASM

`@cfasim-ui/wasm` runs Rust-compiled WebAssembly in the browser using a Web Worker.

## useModel

A Vue composable that returns a `useOutputs` hook for reactive structured model outputs, and a `run` function for calling a model function yourself.

```ts
import { reactive } from "vue";
import { useModel } from "@cfasim-ui/wasm";

const params = reactive({ steps: 100, rate: 0.5 });
const { useOutputs } = useModel("my-model");
const { outputs, loading, error } = useOutputs("simulate", params);
```

### Parameters

| Param   | Type     | Description                                        |
| ------- | -------- | -------------------------------------------------- |
| `model` | `string` | Model name (loads from `/wasm/{model}/{model}.js`) |

### Returns

| Property     | Type                                                  | Description                                                                                              |
| ------------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `run`        | `(fn, inputs) => Promise`, `(fn, ...args) => Promise` | Call a model function with named inputs, or a plain `#[wasm_bindgen]` function with positional arguments |
| `result`     | `Ref<T>`                                              | Return value from the last call                                                                          |
| `error`      | `Ref<string>`                                         | Error message if the call failed                                                                         |
| `loading`    | `Ref<boolean>`                                        | `true` while a call is running                                                                           |
| `useOutputs` | `(fn, params) => { outputs, error, loading }`         | Reactive hook for structured `ModelOutput` results                                                       |

## useOutputs

Returned from `useModel`. Watches a reactive params object and calls the model function whenever params change, passing the params as its [named inputs](#model-inputs). The model function returns `Outputs`, which arrive as a `Record<string, ModelOutput>`.

```ts
import { reactive } from "vue";
import { useModel } from "@cfasim-ui/wasm";

const params = reactive({ steps: 100, rate: 0.5 });
const { useOutputs } = useModel("my-model");
const { outputs, loading } = useOutputs("simulate", params);

// outputs.value?.series.column("time")   → Float64Array
// outputs.value?.series.column("values") → Float64Array
```

### Parameters

| Param    | Type                                | Description                                      |
| -------- | ----------------------------------- | ------------------------------------------------ |
| `fn`     | `string`                            | Model function to call                           |
| `params` | `MaybeRef<Record<string, unknown>>` | Reactive params (deep-watched), its named inputs |

### Returns

| Property  | Type                               | Description                        |
| --------- | ---------------------------------- | ---------------------------------- |
| `outputs` | `Ref<Record<string, ModelOutput>>` | Named output tables from the model |
| `error`   | `Ref<string>`                      | Error message if the call failed   |
| `loading` | `Ref<boolean>`                     | `true` while running               |

## Model inputs

A model function takes one inputs struct and is exported with `export!` from the `cfasim-model` crate:

```rust
use cfasim_model::{export, ModelOutput, Outputs};
use serde::Deserialize;

#[derive(Deserialize)]
struct SimulateInputs {
    steps: u32,
    rate: f64,
}

fn simulate(inputs: SimulateInputs) -> Outputs {
    let values: Vec<f64> = (0..inputs.steps).map(|t| t as f64 * inputs.rate).collect();
    let series = ModelOutput::new(values.len()).add_f64("values", values);
    Outputs::new().add("series", series)
}

export!(simulate);
```

The keys of the params object are matched to the struct's fields by name, so their order does not matter. Values can be numbers, booleans, strings, arrays (typed arrays included) and nested objects, for anything serde can deserialize:

```rust
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SimulateInputs {
    infection_rate: f64,       // { infectionRate: 0.5, ... }
    stochastic: bool,
    contacts: Vec<Vec<f64>>,   // [[1, 0.2], [0.2, 1]]
    groups: Vec<Group>,        // [{ label: "adults", size: 80 }]
    #[serde(default)]
    seed: u64,                 // optional, 0 when the page leaves it out
}
```

- Keys the struct does not declare are ignored, so UI-only state can live in the same params object. Add `#[serde(deny_unknown_fields)]` to reject them.
- Types are checked, where a positional function would coerce: a fractional or negative number for a `u32` field fails the call. Give integer params `number-type="integer"` on their `NumberInput`, or take an `f64` and round it in the model.
- A missing or mistyped value fails the call with an error naming the field, such as ``invalid inputs for simulate: missing field `rate` ``. A cleared `NumberInput` is `undefined`, which counts as missing: use `Option<f64>` or `#[serde(default)]` for inputs that may be empty.
- The function may return `Result<Outputs, E>` for any `E` that implements `Display`. The `Err` text becomes the `error` on the page.
- Exported functions stay plain Rust, so `cargo test` can call them directly.
- Call `export!` once, at the crate root, listing every exported function: `export!(simulate, summarize);`.

### Positional functions

A function exported with plain `#[wasm_bindgen]` still works with `useOutputs`: the params' values are passed as positional string arguments in key order, as in cfasim-ui 0.15 and earlier. The order of the keys then has to match the Rust signature, and only numbers and strings survive the trip, so the worker logs a warning once per function suggesting `export!`. Models built against a `cfasim-model` release without `export!` keep working this way.

`run(fn, ...args)` and [`runWasm`](#runwasm) call positional functions on purpose and never warn. Use them for exports that do not return `Outputs`, such as a function returning a single number.

## Errors and panics

Both `run` and `useOutputs` set `error` to a string when a call fails, and the worker logs the same text with `console.error` as `[wasm-worker] <model>.<fn> failed: ...`, followed by the thrown error for its stack.

For failures the model expects, return a `Result`. The `Err` message is what the page sees:

```rust
fn simulate(inputs: SimulateInputs) -> Result<Outputs, String> {
    if inputs.rate > 5.0 {
        return Err(format!("rate must be <= 5, got {}", inputs.rate));
    }
    // ...
    Ok(Outputs::new().add("series", series))
}
```

A panic (`panic!`, `unwrap`, `expect`, an index out of range, ...) aborts the WebAssembly instance with an `unreachable` trap, which on its own carries no message. `cfasim-model` installs a panic hook that records the message and location, and the worker reports it as:

```
Model panicked at src/lib.rs:21:9: rate must be <= 5, got 9
```

An `unreachable` trap with nothing recorded is reported as an abort: the allocator giving up, or a panic after the model replaced the hook. Models built against cfasim-model 0.10.0 or older have no hook; their traps say so and ask for a rebuild.

A panic does not unwind, so a `RefCell` borrow or a half-updated cache inside the instance stays poisoned, and a stack overflow (reported by the engine as a `RangeError`) leaves the wasm stack pointer wherever it was. After either, `runWasm` terminates the worker and starts a fresh one, re-sending the other calls that were in flight. Queued repeats of the trapped call, and every queued call into a model whose initialization trapped, fail with the same error instead, and that model is not retried for two seconds. The next call pays the module init cost again, as after `cancelWasm`.

No `console_error_panic_hook` is needed in the model. One set from a `#[wasm_bindgen(start)]` function keeps working, since the hook from `cfasim-model` is installed after init and chains in front of it. A hook set later, such as `set_once()` at the top of an exported function, replaces the chain, and panics after that are reported without their message.

## ModelOutput

A columnar data structure for model results. Each column is a typed array (`Float64Array`, `Int32Array`, `Uint32Array`, or `Uint8Array`).

```ts
import { ModelOutput, modelOutputToCSV } from "@cfasim-ui/shared";

output.column("time"); // Float64Array
output.names; // ["time", "infections", "status"]
output.label("status", 0); // "S" (enum label)
modelOutputToCSV(output); // CSV string
```

### Column types

| Type   | TypedArray     | Description                        |
| ------ | -------------- | ---------------------------------- |
| `f64`  | `Float64Array` | 64-bit floats                      |
| `i32`  | `Int32Array`   | 32-bit signed integers             |
| `u32`  | `Uint32Array`  | 32-bit unsigned integers           |
| `bool` | `Uint8Array`   | Booleans (0/1)                     |
| `enum` | `Uint32Array`  | Integer indices with string labels |

## Cache busting

Both wasm files live at fixed URLs (`/wasm/{model}/{model}.js` and `{model}_bg.wasm`), so a browser or CDN cache can pair a freshly deployed app bundle with a stale wasm build. The `cfasimWasm` Vite plugin hashes the wasm-pack output after each build and injects a `__CFASIM_WASM_VERSIONS__` map (model name to hash) through Vite's `define`. The worker appends it as `?v=<hash>` to the glue import and passes the `_bg.wasm` URL explicitly to the glue's init function, so both requests change whenever the Rust build changes. Several plugin instances merge into the same map.

The explicit init path uses wasm-bindgen's `{ module_or_path }` form, which needs wasm-bindgen 0.2.93 or newer. Apps that ship prebuilt wasm without the plugin still load it from the plain URLs.

## Rebuilding in dev

In `vite dev` the plugin watches the crate's `src/` directory and `Cargo.toml` through Vite's own file watcher. A change runs the same `wasm-pack build` in the background (the dev server keeps serving meanwhile), and when it finishes the page reloads, so the fresh worker loads the new module and the app re-runs the model with its current inputs. The terminal shows `cfasim-wasm (<name>): rebuilt in 4.2s, reloading`. If the build fails, the compiler output goes to the terminal and to Vite's error overlay in the browser, and the page keeps running the last good build until the next successful one.

Changes within 100 ms are batched into one build, and a change that lands while a build is running schedules one more after it. Vite's watcher never sees the crate's `target/` at all (the plugin adds it to `server.watch.ignored`), since cargo writes thousands of files there per build. Files or directories whose name starts with a dot or ends in `~` are ignored, as are `node_modules` and the crate's own `target/`, Vite's `publicDir` (where the build lands) and `build.outDir`. `Cargo.lock` is not watched: cargo rewrites it during the build.

```ts
cfasimWasm({
  model: "..",
  name: "my_sim",
  // Also rebuild when a path dependency changes (relative to the Vite root).
  watch: ["../../shared-crate/src"],
});
```

`watch: false` builds once at startup, as before. Extra paths should be source directories that exist when the dev server starts: a path that contains the Vite root would rebuild the model on every `.vue` edit too, and one that does not exist is reported with a warning. `watch` only affects `vite dev`; the `__CFASIM_WASM_VERSIONS__` hash is fixed for the dev server's lifetime; that is fine in dev because Vite serves `public/` with `Cache-Control: no-cache`, so the reloaded page revalidates both wasm URLs. Production builds hash every time.

## Lower-level API

For more control (your own scheduling, batching or cancellation), use the worker API directly:

```ts
import { callWasm, runWasm, cancelWasm } from "@cfasim-ui/wasm";

const outputs = await callWasm("my-model", "simulate", {
  steps: 100,
  rate: 0.5,
});
const doubled = await runWasm("my-model", "double", "4");
```

Modules load in a Web Worker and are cached after the first call.

### callWasm

Calls a model function with [named inputs](#model-inputs), like `useOutputs` does. The inputs are copied to the worker, typed arrays as they are, so `NaN` and `Infinity` arrive intact. The promise rejects when they hold something that cannot be copied, such as a function.

```ts
function callWasm(
  model: string,
  fn: string,
  inputs: Record<string, unknown>,
): Promise<unknown>;
```

### runWasm

Calls a plain `#[wasm_bindgen]` function with positional string arguments.

```ts
function runWasm(
  model: string,
  fn: string,
  ...args: string[]
): Promise<unknown>;
```

### cancelWasm

Terminates the worker and rejects the calls in flight with `Error("cancelled")`. The next call starts a fresh worker and pays the module init cost again.
