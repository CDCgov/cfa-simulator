import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { cfasimWasm } from "@cfasim-ui/wasm/vite";
import { cfasimPyodide } from "@cfasim-ui/pyodide/vite";

export default defineConfig({
  base: process.env.BASE_URL || "/",
  plugins: [
    vue(),
    cfasimWasm({ model: "src/reed-frost/model", name: "rust_example" }),
    cfasimPyodide({
      model: "src/python-example/model",
      pypiDeps: ["cfasim-model"],
    }),
  ],
});
