import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import svgLoader from "vite-svg-loader";
import dts from "vite-plugin-dts";
import { iconSvgoConfig } from "./svgLoaderConfig.mjs";

export default defineConfig({
  plugins: [
    vue(),
    svgLoader({ svgoConfig: iconSvgoConfig }),
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
