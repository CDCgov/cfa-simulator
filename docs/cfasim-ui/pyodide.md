# Pyodide

`@cfasim-ui/pyodide` runs Python code in the browser using [Pyodide](https://pyodide.org) Web Workers.

## useModel

A Vue composable that loads a Python module and calls a function on mount.

```ts
import { useModel } from "@cfasim-ui/pyodide";

const { result, error, loading } = useModel("my_module", "hello");
```

### Parameters

| Param        | Type                      | Description                            |
| ------------ | ------------------------- | -------------------------------------- |
| `moduleName` | `string`                  | Python module to load (from wheel)     |
| `fn`         | `string`                  | Function to call on the module         |
| `args`       | `Record<string, unknown>` | Optional context dict passed to Python |

### Returns

| Property  | Type           | Description                       |
| --------- | -------------- | --------------------------------- |
| `result`  | `Ref<unknown>` | Return value from the Python call |
| `error`   | `Ref<string>`  | Error message if the call failed  |
| `loading` | `Ref<boolean>` | `true` until the call completes   |

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
