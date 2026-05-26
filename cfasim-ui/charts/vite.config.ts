import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: "./tsconfig.json",
      cleanVueFileName: true,
    }),
  ],
  build: {
    lib: {
      entry: {
        index: "src/index.ts",
        "hsa-mapping": "src/hsa-mapping.ts",
      },
      formats: ["es"],
      cssFileName: "index",
    },
    rollupOptions: {
      external: [
        "vue",
        "reka-ui",
        "@cfasim-ui/shared",
        "d3-geo",
        "d3-selection",
        "d3-transition",
        "d3-zoom",
        "topojson-client",
      ],
    },
  },
});
