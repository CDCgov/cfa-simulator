import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import svgLoader from "vite-svg-loader";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    vue(),
    // Keep the viewBox (svgo's default preset strips it) and drop width/height
    // so icons scale to their container.
    svgLoader({
      svgoConfig: {
        plugins: [
          {
            name: "preset-default",
            params: { overrides: { removeViewBox: false } },
          },
          "removeDimensions",
        ],
      },
    }),
    dts({
      tsconfigPath: "./tsconfig.json",
      cleanVueFileName: true,
    }),
  ],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["vue", "reka-ui"],
    },
  },
});
