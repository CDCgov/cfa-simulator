import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

export default defineConfig({
  root: path.resolve(import.meta.dirname),
  plugins: [vue()],
  base: "./",
  build: {
    outDir: "../../public/demos/sidebar-tabs",
    emptyOutDir: true,
  },
});
