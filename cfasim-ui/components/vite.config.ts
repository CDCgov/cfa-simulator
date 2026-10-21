import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import svgLoader from "vite-svg-loader";
import dts from "vite-plugin-dts";
import { libBuildOptions } from "../libOutput.mjs";
import { iconSvgoConfig } from "./svgLoaderConfig.mjs";

export default defineConfig({
  plugins: [
    vue(),
    svgLoader({ svgoConfig: iconSvgoConfig }),
    dts({
      tsconfigPath: "./tsconfig.json",
      cleanVueFileName: true,
      exclude: ["**/*.test.ts", "**/*.spec.ts", "**/*.testUtils.ts"],
    }),
  ],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: libBuildOptions(new URL("./package.json", import.meta.url)),
  },
});
