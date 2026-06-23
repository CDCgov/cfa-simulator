# rwasm

`@cfasim-ui/rwasm` runs bundled R models in the browser with webR.

## useModel

```ts
import { useModel } from "@cfasim-ui/rwasm";

const { useOutputs } = useModel("my.model");
const { outputs, error, loading } = useOutputs("simulate", params);
```

`useOutputs(fn, params)` matches the Python and Rust runtime packages. R functions return `cfasim` helper output, and the worker converts it into named `ModelOutput` tables for display.

## Vite

```ts
import { cfasimRwasm } from "@cfasim-ui/rwasm/vite";

cfasimRwasm({
  model: "model",
  name: "my.model",
  packages: ["jsonlite"],
  docker: true,
});
```

Docker is the recommended build environment for R package dependencies. The `packages` option is for external R dependencies; the local `cfasim` helper package and local model package are included automatically. The deployed app serves static assets only.

## R model packages

R models are ordinary minimal R packages. Add `cfasim` to `DESCRIPTION`:

```text
Imports: cfasim
```

Export callable model functions and import the helper package in `NAMESPACE`:

```r
export(simulate)
import(cfasim)
```

The `cfasim` package provides:

- `model_outputs(...)`
- `model_output(...)`
- `f64(x)`
- `i32(x)`
- `u32(x)`
- `bool(x)`
- `enum(indices, labels)`

These helpers create the same structured model-output contract used by the Python `cfasim_model` module and Rust `cfasim-model` crate.
