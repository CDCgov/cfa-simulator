import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { cfasimPyodide } from "cfasim-ui/pyodide/vite";

export default defineConfig({
  root: "interactive",
  build: { outDir: "../dist", emptyOutDir: true },
  plugins: [vue(), cfasimPyodide({ model: ".." })],
});
