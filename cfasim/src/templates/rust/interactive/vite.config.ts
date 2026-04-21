import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { cfasimWasm } from "cfasim-ui/wasm/vite";

export default defineConfig({
  plugins: [vue(), cfasimWasm({ model: "..", name: "%%module_name%%" })],
});
