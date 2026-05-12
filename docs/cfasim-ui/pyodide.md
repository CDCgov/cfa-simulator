# Pyodide

`@cfasim-ui/pyodide` runs Python code in the browser using [Pyodide](https://pyodide.org) Web Workers.

## useModel

A Vue composable that loads a Python module and returns a `run` function for calling module functions, and a `useOutputs` hook for reactive structured model outputs.

```ts
import { ref, watch } from "vue";
import { useModel } from "@cfasim-ui/pyodide";

const n = ref(5);
const { run, result, error, loading } = useModel<number>("my_module");

watch(n, (val) => run("double", { n: val }), { immediate: true });
```

### Parameters

| Param        | Type     | Description                        |
| ------------ | -------- | ---------------------------------- |
| `moduleName` | `string` | Python module to load (from wheel) |

### Returns

| Property     | Type                                                         | Description                                                        |
| ------------ | ------------------------------------------------------------ | ------------------------------------------------------------------ |
| `run`        | `(fn: string, context?: Record<string, unknown>) => Promise` | Call a function on the module. Context keys become Python globals. |
| `result`     | `Ref<T>`                                                     | Return value from the last call                                    |
| `error`      | `Ref<string>`                                                | Error message if the call failed                                   |
| `loading`    | `Ref<boolean>`                                               | `true` while loading module or running a call                      |
| `useOutputs` | `(fn, params) => { outputs, error, loading }`                | Reactive hook for structured `ModelOutput` results                 |

## useOutputs

Returned from `useModel`. Watches a reactive params object and calls the model function whenever params change. The model function should return a dict via the `cfasim_model` package's `model_outputs()` helper.

```ts
import { reactive } from "vue";
import { useModel } from "@cfasim-ui/pyodide";

const params = reactive({ steps: 100, rate: 0.5 });
const { useOutputs } = useModel("my_module");
const { outputs, loading } = useOutputs("simulate", params);

// outputs.value?.series.column("time")   → Float64Array
// outputs.value?.series.column("values") → Float64Array
```

### Parameters

| Param    | Type                                | Description                    |
| -------- | ----------------------------------- | ------------------------------ |
| `fn`     | `string`                            | Python function to call        |
| `params` | `MaybeRef<Record<string, unknown>>` | Reactive params (deep-watched) |

### Returns

| Property  | Type                               | Description                        |
| --------- | ---------------------------------- | ---------------------------------- |
| `outputs` | `Ref<Record<string, ModelOutput>>` | Named output tables from the model |
| `error`   | `Ref<string>`                      | Error message if the call failed   |
| `loading` | `Ref<boolean>`                     | `true` while running               |

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

## Workers

Each worker is an independent Pyodide interpreter. By default a single worker
named `"default"` is spawned on first use. Pass any string as the `worker`
argument to spin up additional named interpreters for parallel runs (e.g.
`"baseline"` and `"intervention"` for side-by-side comparisons).

Workers spawn lazily — you only pay for what you use. Modules registered via
`loadModule()` are remembered globally and auto-installed on any worker that
spawns later.

```ts
import { callPython, loadModule } from "@cfasim-ui/pyodide";

// "my_model" gets installed on whichever worker each call lands on.
await loadModule("my_model");

const [baseline, intervention] = await Promise.all([
  callPython("my_model", "simulate", { vaccine: 0 }, "baseline"),
  callPython("my_model", "simulate", { vaccine: 0.5 }, "intervention"),
]);
```

## Lower-level API

For more control, use the worker API directly:

```ts
import { callPython, loadModule } from "@cfasim-ui/pyodide";

await loadModule("my_module");
const { result, error } = await callPython("my_module", "run", { n: 5 });
```

### callPython

Calls `module.fn(**kwargs)` on the named worker. Faster than `asyncRunPython`
for repeated calls — the worker caches the imported module and dispatches
straight to the function, skipping Python source parsing on every invocation.

```ts
function callPython(
  module: string,
  fn: string,
  kwargs?: Record<string, unknown>,
  worker?: string, // defaults to "default"
): Promise<{ result?: unknown; error?: string }>;
```

### asyncRunPython

Executes an arbitrary Python script string. Use this for ad-hoc Python that
isn't a function call on a loaded module.

```ts
function asyncRunPython(
  script: string,
  context?: Record<string, unknown>,
  worker?: string, // defaults to "default"
): Promise<{ result?: unknown; error?: string }>;
```

### loadModule

Marks `moduleName` as a shared module: installs it on every currently-spawned
worker, and registers it so any future worker auto-installs it on spawn. The
module name is looked up in `wheels.json` served from the app's public directory.

```ts
function loadModule(
  moduleName: string,
): Promise<{ result?: unknown; error?: string }>;
```

### loadModuleOnWorker

Installs a module on a single named worker only — doesn't mark it as shared.
Use when one worker should diverge from the others.

```ts
function loadModuleOnWorker(
  moduleName: string,
  worker: string,
): Promise<{ result?: unknown; error?: string }>;
```

### warmWorkers

Pre-spawns named workers (and optionally pre-installs modules) so the first
call returns without waiting for Pyodide to boot. Workers spawn lazily by
default; call this when you know up front that you'll need parallel
interpreters and want to overlap their cold-start with the rest of page load.

```ts
function warmWorkers(options: {
  workers: string[];
  modules?: string[];
}): Promise<void>;
```

```ts
// Kick off warmup at app startup. Don't await — let Pyodide boot in the
// background while the rest of the UI mounts.
import { warmWorkers } from "@cfasim-ui/pyodide";

warmWorkers({
  workers: ["baseline", "intervention"],
  modules: ["my_model"],
});
```

```ts
// Or await it if you want to gate UI on workers being ready.
await warmWorkers({ workers: ["a", "b", "c"], modules: ["my_model"] });
```

Modules passed in `modules` are also registered as shared (same as if you'd
called `loadModule()` for each), so any worker spawned later — including the
implicit `"default"` worker — auto-installs them on first use.
