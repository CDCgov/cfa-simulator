import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "happy-dom",
    // .spec is for e2e tests
    exclude: ["src/**/*.spec.ts"],
  },
});
