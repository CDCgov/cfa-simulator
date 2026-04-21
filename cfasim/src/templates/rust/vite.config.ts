import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { cfasimWasm } from "cfasim-ui/wasm/vite";

export default defineConfig({
  root: "interactive",
  build: { outDir: "../dist", emptyOutDir: true },
  plugins: [vue(), cfasimWasm({ model: "..", name: "%%module_name%%" })],
});
