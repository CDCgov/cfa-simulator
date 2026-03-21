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

## Lower-level API

For more control, use the worker API directly:

```ts
import { asyncRunPython, loadModule } from "@cfasim-ui/pyodide";

await loadModule("my_module");
const { result, error } = await asyncRunPython(
  "import my_module\nmy_module.run()",
);
```

### asyncRunPython

Executes a Python script string on a Pyodide Web Worker.

```ts
function asyncRunPython(
  script: string,
  context?: Record<string, unknown>,
  worker?: "baseline" | "intervention",
): Promise<{ result?: unknown; error?: string }>;
```

### loadModule

Installs a Python wheel on all workers. The module name is looked up in `wheels.json` served from the app's public directory.

```ts
function loadModule(
  moduleName: string,
): Promise<{ result?: unknown; error?: string }>;
```

### loadModuleOnWorker

Same as `loadModule` but targets a specific worker.

```ts
function loadModuleOnWorker(
  moduleName: string,
  worker: "baseline" | "intervention",
): Promise<{ result?: unknown; error?: string }>;
```
