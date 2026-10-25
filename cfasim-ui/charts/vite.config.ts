import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";
import { libBuildOptions } from "../libOutput.mjs";

export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: "./tsconfig.json",
      cleanVueFileName: true,
      exclude: ["**/*.test.ts", "**/*.spec.ts", "**/*.testUtils.ts"],
    }),
  ],
  build: {
    lib: {
      entry: {
        index: "src/index.ts",
        "hsa-mapping": "src/hsa-mapping.ts",
        "us-cities": "src/us-cities.ts",
        "us-hsa-topology": "src/us-hsa-topology.ts",
        "vega-lite": "src/vega-lite.ts",
      },
      formats: ["es"],
      cssFileName: "index",
    },
    rollupOptions: libBuildOptions(new URL("./package.json", import.meta.url)),
  },
});
