# Python Projects

This guide walks through setting up a cfasim-ui project that runs a Python model in the browser via [Pyodide](https://pyodide.org).

## Prerequisites

- [Node.js](https://nodejs.org/) v24+
- [pnpm](https://pnpm.io/) v10+ (enabled via `corepack enable`)
- [uv](https://docs.astral.sh/uv/) — for building Python wheels

You can check these with `uvx cfasim tools` (or `cfasim tools` if you've installed the CLI).

## Recommended: scaffold with `cfasim init`

The fastest way to start is with `uvx`, which runs `cfasim` ephemerally without installing it:

```bash
uvx cfasim init
```

Follow the prompts to pick a project name and choose the **Python** template. The generated project is a Python package at the root, with the interactive UI source in an `interactive/` subfolder. All tasks run from the project root:

```
my-project/
├── pyproject.toml
├── src/
│   └── my_project/
│       └── __init__.py
├── package.json
├── vite.config.ts
├── tsconfig.json
└── interactive/
    ├── index.html
    └── src/
        ├── App.vue
        ├── env.d.ts
        └── main.ts
```

After scaffolding:

```bash
cd my-project
pnpm install
pnpm run dev
```

See [Getting Started](../getting-started) for other ways to install `cfasim`.

## Adding cfasim-ui to an existing Python project

This section assumes you already have a Python package with a simulation function — for example, a project with `pyproject.toml` at the root and `src/my_model/__init__.py` exporting a `simulate(...)` function. What you don't have yet is a frontend.

The steps below walk through adding a new `interactive/` directory inside your project, wiring it up with pnpm, Vite, Vue, and cfasim-ui, and pointing the Pyodide plugin at the Python package at the project root.

### Prepare your Python model

Make sure your model's `pyproject.toml` has `cfasim-model` listed as a dependency, and that your `simulate` function returns a `model_outputs(...)` result. The `cfasim-model` package provides the `ModelOutput` and `model_outputs` helpers that the UI uses to read your simulation results.

**`pyproject.toml`** (minimum required):

```toml
[build-system]
requires = ["setuptools>=68.0"]
build-backend = "setuptools.build_meta"

[project]
name = "my-model"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = ["cfasim-model"]
```

**`src/my_model/__init__.py`**:

```python
import numpy as np
from cfasim_model import ModelOutput, model_outputs


def simulate(steps, rate):
    time = np.arange(steps, dtype=np.float64)
    values = time * rate
    series = ModelOutput().add_f64("time", time).add_f64("values", values)
    return model_outputs(series=series)
```

Each top-level function becomes a callable entry point from the UI side.

### Set up the frontend

At your project root, initialize a `package.json` and create an `interactive/` subfolder for the Vue source:

```bash
pnpm init
mkdir -p interactive/src
```

Install runtime and dev dependencies:

```bash
pnpm add vue cfasim-ui
pnpm add -D @vitejs/plugin-vue vite typescript
```

`cfasim-ui` is a single package that re-exports subpath entries for each area (`cfasim-ui/components`, `cfasim-ui/charts`, `cfasim-ui/pyodide`, `cfasim-ui/shared`, `cfasim-ui/theme`).

Add scripts to the generated `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}
```

### Configure Vite

`cfasim-ui/pyodide/vite` provides a Vite plugin that builds your Python model into a wheel and serves it to Pyodide at dev time. Put `vite.config.ts` at the project root and set Vite's `root` to `interactive/` so the Vue source is served from there; redirect the build output to a top-level `dist/`:

**`vite.config.ts`**:

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { cfasimPyodide } from "cfasim-ui/pyodide/vite";

export default defineConfig({
  root: "interactive",
  build: { outDir: "../dist", emptyOutDir: true },
  plugins: [vue(), cfasimPyodide({ model: ".." })],
});
```

`model: ".."` resolves from the Vite root (`interactive/`) back to the project root where `pyproject.toml` lives. The plugin runs `uv build` on that directory and generates an `interactive/public/wheels.json` file so the Pyodide worker can find your wheel.

Other options:

- `pypiDeps` — list of PyPI packages to prebuild as local wheels, avoiding PyPI round-trips on page load
- `pipCommand` — command used to invoke pip when downloading `pypiDeps` (default: `"uvx pip"`). Set to `"pip"` or `"uv run pip"` if you'd rather use a pip that's already on your PATH or in your project's venv.
- `pythonVersion` — Python version passed to pip's `--python-version` flag when downloading `pypiDeps` (default: `"3.12"`). Should match the Python shipped by your Pyodide runtime.

Add a minimal `tsconfig.json` at the project root:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true
  },
  "include": ["interactive/src"]
}
```

### Wire up the app

**`interactive/index.html`**:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Sim</title>
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined"
    />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

**`interactive/src/main.ts`**:

```ts
import { createApp } from "vue";
import "cfasim-ui/theme/all";
import App from "./App.vue";

createApp(App).mount("#app");
```

**`interactive/src/App.vue`**:

```vue
<script setup lang="ts">
import { reactive } from "vue";
import { SidebarLayout, NumberInput, Button } from "cfasim-ui/components";
import { useModel } from "cfasim-ui/pyodide";
import { useUrlParams } from "cfasim-ui/shared";

const defaults = { steps: 10, rate: 2.5 };
const params = reactive({ ...defaults });
const { reset } = useUrlParams(params, defaults);
const { useOutputs } = useModel("my_model");
const { outputs, loading } = useOutputs("simulate", params);
</script>

<template>
  <SidebarLayout>
    <template #sidebar>
      <Button variant="secondary" @click="reset">Reset</Button>
      <NumberInput v-model="params.steps" label="Steps" />
      <NumberInput v-model="params.rate" label="Rate" />
    </template>
    <p v-if="loading">Loading...</p>
    <template v-else-if="outputs?.series">
      <ul>
        <li v-for="(_, i) in outputs.series.column('time')" :key="i">
          t={{ outputs.series.column("time")[i] }}, v={{
            outputs.series.column("values")[i]
          }}
        </li>
      </ul>
    </template>
  </SidebarLayout>
</template>
```

`useModel("my_model")` must match the Python module name from `pyproject.toml` (with hyphens converted to underscores). `useUrlParams` syncs your reactive params to the URL query string so reloads and shares preserve state.

### Run it

From the project root:

```bash
pnpm dev
```

The Vite plugin will build your Python wheel on startup. Changes to your Python code will trigger a rebuild when you refresh. `pnpm build` produces a static site in `dist/` at the project root.

## Next steps

- [Pyodide API reference](../cfasim-ui/pyodide) — `useModel`, `useOutputs`, and the lower-level worker API
- [Components](../cfasim-ui/) — all available UI components and charts
- [Theme](../cfasim-ui/theme) — customizing the theme
