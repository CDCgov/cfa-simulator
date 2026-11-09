import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { cfasimTheme } from "@cfasim-ui/theme/vite";
import path from "node:path";

export default defineConfig({
  root: path.resolve(import.meta.dirname),
  plugins: [vue(), cfasimTheme()],
  base: "./",
  build: {
    outDir: "../../public/demos/sidebar-layout",
    emptyOutDir: true,
  },
});
