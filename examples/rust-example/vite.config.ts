import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { cfasimWasm } from "@cfasim-ui/wasm/vite";

export default defineConfig({
  base: process.env.BASE_URL || "/",
  plugins: [vue(), cfasimWasm()],
});
