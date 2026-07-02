import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import svgLoader from "vite-svg-loader";
import { iconSvgoConfig } from "./svgLoaderConfig.mjs";

export default defineConfig({
  plugins: [vue(), svgLoader({ svgoConfig: iconSvgoConfig })],
  test: {
    environment: "happy-dom",
    // .spec is for e2e tests
    exclude: ["src/**/*.spec.ts"],
  },
});
