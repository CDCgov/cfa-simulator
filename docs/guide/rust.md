# Rust Projects

This guide walks through setting up a cfasim-ui project that runs a Rust model compiled to WebAssembly in the browser.

## Prerequisites

- [Node.js](https://nodejs.org/) v24+
- [pnpm](https://pnpm.io/) v10+ (enabled via `corepack enable`)
- [Rust](https://www.rust-lang.org/tools/install) toolchain
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) — for compiling Rust to WASM

## Create the project

Scaffold a Vite + Vue app and install cfasim-ui packages:

```bash
pnpm create vite my-sim --template vue-ts
cd my-sim
pnpm add vue @cfasim-ui/components @cfasim-ui/charts @cfasim-ui/wasm @cfasim-ui/theme
pnpm add -D @vitejs/plugin-vue vite typescript
```

## Set up the Rust model

Create a Rust library in a `model/` directory:

```
model/
├── Cargo.toml
└── src/
    └── lib.rs
```

**`model/Cargo.toml`**:

```toml
[package]
name = "my-sim"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
wasm-bindgen = "0.2"
cfasim-model = "0.1"
```

**`model/src/lib.rs`**:

```rust
use cfasim_model::{model_outputs, ModelOutput};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn simulate(steps: u32, rate: f64) -> JsValue {
    let time: Vec<f64> = (0..steps).map(|i| i as f64).collect();
    let values: Vec<f64> = time
        .iter()
        .map(|t| (rate * t / steps as f64).exp())
        .collect();

    let series = ModelOutput::new()
        .with_f64("time", time)
        .with_f64("values", values);

    model_outputs([("series", series)])
}
```

## Configure Vite

The `@cfasim-ui/wasm` package provides a Vite plugin that runs `wasm-pack build` and serves the output.

**`vite.config.ts`**:

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { cfasimWasm } from "@cfasim-ui/wasm/vite";

export default defineConfig({
  plugins: [vue(), cfasimWasm()],
});
```

The plugin compiles your `model/` crate and outputs to `public/wasm/{project-name}/`.

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
import { useModel } from "@cfasim-ui/wasm";

const params = reactive({ steps: 100, rate: 0.5 });
const { useOutputs } = useModel("my-sim");
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

The Vite plugin will compile your Rust model to WASM on startup. Changes to your Rust code will trigger a rebuild when you refresh.

## Next steps

- [WASM API reference](../cfasim-ui/wasm) — `useModel`, `useOutputs`, and the lower-level `runWasm` API
- [Components](../cfasim-ui/) — all available UI components and charts
- [Theme](../cfasim-ui/theme) — customizing the theme
