import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { cfasimRwasm } from "cfasim-ui/rwasm/vite";

export default defineConfig({
  root: "interactive",
  build: { outDir: "../dist", emptyOutDir: true },
  plugins: [vue(), cfasimRwasm({ model: "..", name: "{{ package_name }}" })],
});
