# Python Projects

This guide walks through setting up a cfasim-ui project that runs a Python model in the browser via [Pyodide](https://pyodide.org).

## Prerequisites

- [Node.js](https://nodejs.org/) v24+
- [pnpm](https://pnpm.io/) v10+ (enabled via `corepack enable`)
- [uv](https://docs.astral.sh/uv/) — for building Python wheels

## Create the project

Scaffold a Vite + Vue app and install cfasim-ui packages:

```bash
pnpm create vite my-sim --template vue-ts
cd my-sim
pnpm add vue @cfasim-ui/components @cfasim-ui/charts @cfasim-ui/pyodide @cfasim-ui/theme
pnpm add -D @vitejs/plugin-vue vite typescript
```

## Set up the Python model

Create a Python package in a `model/` directory:

```
model/
├── pyproject.toml
└── src/
    └── my_model/
        └── __init__.py
```

**`model/pyproject.toml`**:

```toml
[project]
name = "my-model"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = ["cfasim-model"]

[build-system]
requires = ["setuptools"]
build-backend = "setuptools.backends._legacy:Backend"
```

**`model/src/my_model/__init__.py`**:

```python
import numpy as np
from cfasim_model import ModelOutput, model_outputs

def simulate(steps, rate):
    time = np.arange(steps, dtype=np.float64)
    values = np.exp(rate * time / steps)
    series = ModelOutput(
        columns={"time": time, "values": values},
    )
    return model_outputs(series=series)
```

## Configure Vite

The `@cfasim-ui/pyodide` package provides a Vite plugin that builds your Python model into a wheel and serves it to Pyodide at dev time.

**`vite.config.ts`**:

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { cfasimPyodide } from "@cfasim-ui/pyodide/vite";

export default defineConfig({
  plugins: [vue(), cfasimPyodide()],
});
```

The plugin runs `uv build` on your `model/` directory and generates a `public/wheels.json` file so the Pyodide worker can find your wheel.

Options:

- `model` — path to your Python model directory (default: `"model"`)
- `pypiDeps` — list of PyPI packages to prebuild as local wheels, avoiding PyPI round-trips on page load
- `pipCommand` — command used to invoke pip when downloading `pypiDeps` (default: `"uvx pip"`). Set to `"pip"` or `"uv run pip"` if you'd rather use a pip that's already on your PATH or in your project's venv.
- `pythonVersion` — Python version passed to pip's `--python-version` flag when downloading `pypiDeps` (default: `"3.12"`). Should match the Python shipped by your Pyodide runtime.

## Wire up the app

**`src/main.ts`**:

```ts
import "@cfasim-ui/theme/all";
import { createApp } from "vue";
import App from "./App.vue";

createApp(App).mount("#app");
```

**`src/App.vue`**:

```vue
<script setup lang="ts">
import { reactive } from "vue";
import { SidebarLayout, NumberInput } from "@cfasim-ui/components";
import { LineChart } from "@cfasim-ui/charts";
import { useModel } from "@cfasim-ui/pyodide";

const params = reactive({ steps: 100, rate: 0.5 });
const { useOutputs } = useModel("my_model");
const { outputs, loading } = useOutputs("simulate", params);
</script>

<template>
  <SidebarLayout>
    <template #sidebar>
      <NumberInput v-model="params.steps" label="Steps" :min="1" :max="500" />
      <NumberInput
        v-model="params.rate"
        label="Rate"
        :min="0"
        :max="2"
        :step="0.1"
      />
    </template>
    <LineChart v-if="outputs?.series" :model-output="outputs.series" />
  </SidebarLayout>
</template>
```

## Run it

```bash
pnpm dev
```

The Vite plugin will build your Python wheel on startup. Changes to your Python code will trigger a rebuild when you refresh.

## Next steps

- [Pyodide API reference](../cfasim-ui/pyodide) — `useModel`, `useOutputs`, and the lower-level worker API
- [Components](../cfasim-ui/) — all available UI components and charts
- [Theme](../cfasim-ui/theme) — customizing the theme
