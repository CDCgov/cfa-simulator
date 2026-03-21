# WASM

`@cfasim-ui/wasm` runs Rust-compiled WebAssembly in the browser using a Web Worker.

## useModel

A Vue composable that calls a WASM function on mount.

```ts
import { useModel } from "@cfasim-ui/wasm";

const { result, error, loading } = useModel("my-model", "hello");
```

### Parameters

| Param   | Type       | Description                                        |
| ------- | ---------- | -------------------------------------------------- |
| `model` | `string`   | Model name (loads from `/wasm/{model}/{model}.js`) |
| `fn`    | `string`   | Exported function to call                          |
| `args`  | `string[]` | Optional arguments (rest params)                   |

### Returns

| Property  | Type           | Description                      |
| --------- | -------------- | -------------------------------- |
| `result`  | `Ref<string>`  | Return value from the WASM call  |
| `error`   | `Ref<string>`  | Error message if the call failed |
| `loading` | `Ref<boolean>` | `true` until the call completes  |

## Lower-level API

For more control, use the worker API directly:

```ts
import { runWasm } from "@cfasim-ui/wasm";

const result = await runWasm("my-model", "hello", "arg1", "arg2");
```

### runWasm

Calls a function on a dynamically-loaded WASM module in a Web Worker. Modules are cached after first load.

```ts
function runWasm(model: string, fn: string, ...args: string[]): Promise<string>;
```
