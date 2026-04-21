# Rust Projects

This guide walks through setting up a cfasim-ui project that runs a Rust model compiled to WebAssembly in the browser.

## Prerequisites

- [Node.js](https://nodejs.org/) v24+
- [pnpm](https://pnpm.io/) v10+ (enabled via `corepack enable`)
- [Rust](https://www.rust-lang.org/tools/install) toolchain
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) — for compiling Rust to WASM

You can check these with `uvx cfasim tools` (or `cfasim tools` if you've installed the CLI).

## Recommended: scaffold with `cfasim init`

The fastest way to start is with `uvx`, which runs `cfasim` ephemerally without installing it:

```bash
uvx cfasim init
```

Follow the prompts to pick a project name and choose the **Rust** template. The generated project is a Rust crate at the root, with the interactive UI in an `interactive/` subfolder:

```
my-project/
├── Cargo.toml
├── src/
│   └── lib.rs
└── interactive/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    └── src/
        ├── App.vue
        ├── env.d.ts
        └── main.ts
```

After scaffolding:

```bash
cd my-project/interactive
pnpm install
pnpm run dev
```

See [Getting Started](../getting-started) for other ways to install `cfasim`.

## Adding cfasim-ui to an existing Rust project

This section assumes you already have a Rust crate with a simulation function — for example, a project with `Cargo.toml` at the root and `src/lib.rs` exporting a `simulate(...)` function. What you don't have yet is a frontend.

The steps below walk through adding a new `interactive/` directory inside your project, wiring it up with pnpm, Vite, Vue, and cfasim-ui, and pointing the WASM plugin at the crate at the project root.

### Prepare your Rust crate

Make sure your crate builds as a `cdylib` and depends on `wasm-bindgen` and `cfasim-model`. The `cfasim-model` crate provides the `ModelOutput` and `model_outputs` helpers that the UI uses to read your simulation results.

**`Cargo.toml`** (minimum required):

```toml
[package]
name = "my_sim"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
wasm-bindgen = "0.2"
cfasim-model = "0.1"
```

**`src/lib.rs`**:

```rust
use cfasim_model::{model_outputs, ModelOutput};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn simulate(steps: u32, rate: f64) -> JsValue {
    let time: Vec<f64> = (0..steps).map(|i| i as f64).collect();
    let values: Vec<f64> = (0..steps).map(|i| rate * i as f64).collect();

    let series = ModelOutput::new(steps as usize)
        .add_f64("time", time)
        .add_f64("values", values);

    model_outputs([("series", series)])
}
```

Each `#[wasm_bindgen]`-exported function becomes a callable entry point from the UI side.

### Create a frontend directory

Inside your project, create a new `interactive/` directory for the frontend and initialize it with pnpm:

```bash
mkdir interactive
cd interactive
pnpm init
```

Install runtime and dev dependencies:

```bash
pnpm add vue cfasim-ui
pnpm add -D @vitejs/plugin-vue vite typescript
```

`cfasim-ui` is a single package that re-exports subpath entries for each area (`cfasim-ui/components`, `cfasim-ui/charts`, `cfasim-ui/wasm`, `cfasim-ui/shared`, `cfasim-ui/theme`).

Add `"type": "module"` and dev scripts to the generated `package.json`:

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

`cfasim-ui/wasm/vite` provides a Vite plugin that runs `wasm-pack build` and serves the output. Point the `model` option at your project root (relative to the `interactive/` directory), where `Cargo.toml` lives. Since the frontend directory name (`interactive`) doesn't match your crate name, also pass `name` so the output lands at `public/wasm/my_sim/`:

**`interactive/vite.config.ts`**:

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { cfasimWasm } from "cfasim-ui/wasm/vite";

export default defineConfig({
  plugins: [vue(), cfasimWasm({ model: "..", name: "my_sim" })],
});
```

The plugin runs `wasm-pack build .. --target web --out-dir public/wasm/my_sim`. The worker loads `/wasm/{name}/{name}.js` at runtime, so `name` must match the crate name (with hyphens converted to underscores).

Options:

- `model` — path to your Rust crate directory (default: `"model"`)
- `name` — output directory name and module name the worker loads (default: the Vite project directory's basename, hyphens converted to underscores)

Add a minimal `tsconfig.json`:

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
  "include": ["src"]
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
import { useModel } from "cfasim-ui/wasm";
import { useUrlParams } from "cfasim-ui/shared";

const defaults = { steps: 10, rate: 2.5 };
const params = reactive({ ...defaults });
const { reset } = useUrlParams(params, defaults);
const { useOutputs } = useModel("my_sim");
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

`useModel("my_sim")` must match the `name` you passed to `cfasimWasm`, which in turn must match your crate name (with hyphens converted to underscores). `useUrlParams` syncs your reactive params to the URL query string so reloads and shares preserve state.

### Run it

```bash
pnpm dev
```

The Vite plugin will compile your Rust model to WASM on startup. Changes to your Rust code will trigger a rebuild when you refresh.

## Next steps

- [WASM API reference](../cfasim-ui/wasm) — `useModel`, `useOutputs`, and the lower-level `runWasm` API
- [Components](../cfasim-ui/) — all available UI components and charts
- [Theme](../cfasim-ui/theme) — customizing the theme
