# R Projects

This guide walks through setting up a cfasim-ui project that runs an R model in the browser with [webR](https://docs.r-wasm.org/webr/latest/) and bundles R package assets with rwasm.

## Prerequisites

- [Node.js](https://nodejs.org/) v24+
- [pnpm](https://pnpm.io/) v10+ (enabled via `corepack enable`)
- Docker, for building browser-compatible R package assets

## Model Package

R models are ordinary minimal R packages. In a scaffolded project the model package lives at the project root; in the examples app it lives under `models/src/r-example/model`.

```text
model/
├── DESCRIPTION
├── NAMESPACE
└── R/
    └── model.R
```

Add the helper package to `DESCRIPTION`:

```text
Imports: cfasim
```

Export callable model functions in `NAMESPACE`:

```r
export(simulate)
import(cfasim)
```

Then define those functions in `model/R/model.R` or other `.R` files in the
`model/R` directory:

```r
simulate <- function(steps, rate) {
  time <- seq(0, steps - 1)
  values <- time * rate
  model_outputs(
    series = model_output(
      time = f64(time),
      values = f64(values)
    )
  )
}
```

The model package is built and installed into webR, then the frontend calls the exported function by name. Internal helper functions can stay unexported.

For very small models, the Vite plugin can also source a loose `model.R` file
from the model directory instead of loading an R package. In that case, put
`library(cfasim)` at the top of the script and define callable functions
directly:

```r
library(cfasim)

simulate <- function(steps, rate) {
  time <- seq(0, steps - 1)
  values <- time * rate
  model_outputs(
    series = model_output(
      time = f64(time),
      values = f64(values)
    )
  )
}
```

The package structure is still preferred for most projects because it gives you
normal R dependency metadata, exported function declarations, and model unit
tests.

## Vite

`cfasim-ui/rwasm/vite` provides a Vite plugin that copies the model package, builds the local `cfasim` helper package and model package with rwasm, and writes static assets under `public/rwasm/{name}/`.

```ts
import { cfasimRwasm } from "cfasim-ui/rwasm/vite";

plugins: [
  vue(),
  cfasimRwasm({
    model: "..",
    name: "my_model",
    docker: true,
  }),
];
```

`name` is the browser bundle name used by `useModel`. The plugin includes the local `cfasim` helper package and model package automatically. Use `packages` for additional external R dependencies:

```ts
cfasimRwasm({
  model: "..",
  name: "my_model",
  packages: ["jsonlite"],
});
```

Docker is required at build time. Runtime deployment is static.

## UI

```ts
import { useModel } from "cfasim-ui/rwasm";

const { useOutputs } = useModel("my_model");
const { outputs, loading, error } = useOutputs("simulate", params);
```

`useModel("my_model")` must match the Vite plugin `name`. `useOutputs("simulate", params)` watches the reactive params object, calls the exported R function, and returns named `ModelOutput` tables for charts and tables.

## Run It

From the project root:

```bash
pnpm install
pnpm run dev
```

The Vite plugin builds the R package assets on startup. `pnpm run build` produces a static site in `dist/`.

By default the plugin also copies the matching `webR` runtime files into the
app bundle and points the generated manifest at those local assets. That keeps
generated projects portable and avoids depending on the public webR CDN at app
startup. `webRBaseUrl` remains available when you want to override that with a
self-hosted location.
