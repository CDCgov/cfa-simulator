# WASM

`@cfasim-ui/wasm` runs Rust-compiled WebAssembly in the browser using a Web Worker.

## useModel

A Vue composable that returns a `run` function for calling WASM functions, and a `useOutputs` hook for reactive structured model outputs.

```ts
import { ref, watch } from "vue";
import { useModel } from "@cfasim-ui/wasm";

const n = ref(5);
const { run, result, error, loading } = useModel<number>("my-model");

watch(n, (val) => run("double", val), { immediate: true });
```

### Parameters

| Param   | Type     | Description                                        |
| ------- | -------- | -------------------------------------------------- |
| `model` | `string` | Model name (loads from `/wasm/{model}/{model}.js`) |

### Returns

| Property     | Type                                                     | Description                                        |
| ------------ | -------------------------------------------------------- | -------------------------------------------------- |
| `run`        | `(fn: string, ...args: (string \| number)[]) => Promise` | Call an exported WASM function                     |
| `result`     | `Ref<T>`                                                 | Return value from the last call                    |
| `error`      | `Ref<string>`                                            | Error message if the call failed                   |
| `loading`    | `Ref<boolean>`                                           | `true` while a call is running                     |
| `useOutputs` | `(fn, params) => { outputs, error, loading }`            | Reactive hook for structured `ModelOutput` results |

## useOutputs

Returned from `useModel`. Watches a reactive params object and calls the model function whenever params change. The model function should return a `Record<string, ModelOutput>` via the `cfasim-model` crate's `model_outputs()` helper.

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

| Param    | Type                                | Description                    |
| -------- | ----------------------------------- | ------------------------------ |
| `fn`     | `string`                            | WASM function to call          |
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

## Cache busting

Both wasm files live at fixed URLs (`/wasm/{model}/{model}.js` and `{model}_bg.wasm`), so a browser or CDN cache can pair a freshly deployed app bundle with a stale wasm build. The `cfasimWasm` Vite plugin hashes the wasm-pack output after each build and injects a `__CFASIM_WASM_VERSIONS__` map (model name to hash) through Vite's `define`. The worker appends it as `?v=<hash>` to the glue import and passes the `_bg.wasm` URL explicitly to the glue's init function, so both requests change whenever the Rust build changes. Several plugin instances merge into the same map.

The explicit init path uses wasm-bindgen's `{ module_or_path }` form, which needs wasm-bindgen 0.2.93 or newer. Apps that ship prebuilt wasm without the plugin still load it from the plain URLs.

## Lower-level API

For more control, use the worker API directly:

```ts
import { runWasm } from "@cfasim-ui/wasm";

const result = await runWasm("my-model", "hello", "arg1", "arg2");
```

### runWasm

Calls a function on a dynamically-loaded WASM module in a Web Worker. Modules are cached after first load.

```ts
function runWasm(
  model: string,
  fn: string,
  ...args: string[]
): Promise<unknown>;
```
